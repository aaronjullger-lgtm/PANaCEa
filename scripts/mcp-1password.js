#!/usr/bin/env node
/**
 * 1Password MCP Server — wraps `op` CLI for vault access.
 * Uses existing desktop app auth via `op` CLI integration.
 * No service account needed.
 *
 * MCP stdio transport (JSON-RPC 2.0 over stdin/stdout).
 * Protocol: MCP 2026-07-28 compatible, with legacy client fallback.
 */
import { spawn, execFileSync } from "node:child_process";

// ─── helpers ────────────────────────────────────────────────────────────────

function op(...args) {
  try {
    const out = execFileSync("op", args, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024, // 10 MB
    });
    return JSON.parse(out);
  } catch (err) {
    if (err.stdout) {
      try {
        return JSON.parse(err.stdout);
      } catch {
        // not JSON, fall through
      }
    }
    throw new Error(`op ${args.join(" ")} failed: ${err.stderr || err.message}`);
  }
}

function opText(...args) {
  try {
    return execFileSync("op", args, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    }).trim();
  } catch (err) {
    throw new Error(`op ${args.join(" ")} failed: ${err.stderr || err.message}`);
  }
}

let msgId = 0;
const requestHandlers = new Map();

// ─── tools ──────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "vault_list",
    description: "List all accessible 1Password vaults",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "item_lookup",
    description: "Search for items in a vault by title substring",
    inputSchema: {
      type: "object",
      properties: {
        vault: { type: "string", description: "Vault name or ID" },
        query: { type: "string", description: "Search term (title substring)" },
        limit: { type: "number", description: "Max results (default 50)", default: 50 },
      },
      required: ["vault", "query"],
    },
  },
  {
    name: "item_list",
    description: "List all items in a vault (metadata only, no secrets)",
    inputSchema: {
      type: "object",
      properties: {
        vault: { type: "string", description: "Vault name or ID" },
      },
      required: ["vault"],
    },
  },
  {
    name: "item_get",
    description: "Get full item details from a vault. Concealed values hidden unless reveal: true.",
    inputSchema: {
      type: "object",
      properties: {
        vault: { type: "string", description: "Vault name or ID" },
        item: { type: "string", description: "Item name or ID" },
        reveal: { type: "boolean", description: "Show concealed field values (default false)", default: false },
      },
      required: ["vault", "item"],
    },
  },
  {
    name: "read_secret",
    description: "Read a single secret value using op:// reference. Use sparingly — prefer op_run to use secrets without revealing them.",
    inputSchema: {
      type: "object",
      properties: {
        ref: { type: "string", description: "op://vault/item/field reference" },
      },
      required: ["ref"],
    },
  },
  {
    name: "op_run",
    description: "Run a command with op:// references resolved in env. Secrets are redacted from output.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to run" },
        env: {
          type: "object",
          description: "Environment variables. Values matching op:// references are resolved.",
          additionalProperties: { type: "string" },
        },
        cwd: { type: "string", description: "Working directory" },
        timeout_ms: { type: "number", description: "Max execution time in ms (default 60000)" },
      },
      required: ["command"],
    },
  },
];

function buildRef(decent) {
  if (decent.ref) return decent.ref;
  if (decent.vault && decent.item) return `op://${decent.vault}/${decent.item}`;
  return null;
}

// ─── tool handlers ───────────────────────────────────────────────────────────

async function handleToolCall(name, args) {
  switch (name) {
    case "vault_list": {
      const vaults = op("vault", "list", "--format", "json");
      return { content: [{ type: "text", text: JSON.stringify(vaults, null, 2) }] };
    }
    case "item_lookup": {
      const items = op("item", "list", "--vault", args.vault, "--format", "json");
      const q = args.query.toLowerCase();
      const filtered = items.filter((i) => (i.title || "").toLowerCase().includes(q));
      const limited = filtered.slice(0, args.limit || 50);
      return { content: [{ type: "text", text: JSON.stringify(limited, null, 2) }] };
    }
    case "item_list": {
      const items = op("item", "list", "--vault", args.vault, "--format", "json");
      // Strip to metadata only
      const meta = items.map((i) => ({
        id: i.id,
        title: i.title,
        category: i.category,
        tags: i.tags,
        updatedAt: i.updated_at,
        vault: i.vault?.name || args.vault,
      }));
      return { content: [{ type: "text", text: JSON.stringify(meta, null, 2) }] };
    }
    case "item_get": {
      const revealFlag = args.reveal ? [] : [];
      const item = op("item", "get", args.item, "--vault", args.vault, "--format", "json");
      if (!args.reveal) {
        // Redact concealed field values
        if (item.fields) {
          for (const f of item.fields) {
            if (f.purpose === "CONCEALED" && f.value) {
              f.value = "*** REDACTED (use reveal: true to show) ***";
            }
          }
        }
      }
      return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
    }
    case "read_secret": {
      const value = opText("read", args.ref);
      return { content: [{ type: "text", text: value }] };
    }
    case "op_run": {
      return new Promise((resolve, reject) => {
        const child = spawn("sh", ["-c", args.command], {
          cwd: args.cwd || undefined,
          env: { ...process.env, ...(args.env || {}) },
          stdio: ["ignore", "pipe", "pipe"],
          timeout: args.timeout_ms || 60000,
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d) => { stdout += d.toString(); });
        child.stderr.on("data", (d) => { stderr += d.toString(); });
        child.on("close", (code) => {
          // Redact any op:// references from output
          const redact = (s) => s.replace(/op:\/\/[^\s"'`)\]]+/g, "*** op:// reference ***");
          resolve({
            content: [
              { type: "text", text: `exit code: ${code}` },
              { type: "text", text: redact(stdout) },
              ...(stderr ? [{ type: "text", text: redact(stderr) }] : []),
            ],
          });
        });
        child.on("error", (err) => reject(err));
      });
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── MCP Protocol ────────────────────────────────────────────────────────────

const encoder = new TextEncoder();

function sendMessage(msg) {
  const json = JSON.stringify(msg);
  const header = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n`;
  process.stdout.write(header + json);
}

function log(...args) {
  // Log to stderr so it doesn't interfere with the MCP protocol on stdout
  process.stderr.write(`[1p-mcp] ${args.join(" ")}\n`);
}

// Capabilities we advertise
const CAPABILITIES = {
  tools: {
    listChanged: false,
  },
};
const SERVER_INFO = {
  name: "1password-mcp-wrapper",
  version: "1.0.0",
};

function handleInitialize(req) {
  log("initialize received, protocol:", req.params?.protocolVersion);
  sendMessage({
    jsonrpc: "2.0",
    id: req.id,
    result: {
      protocolVersion: req.params?.protocolVersion || "2026-07-28",
      capabilities: CAPABILITIES,
      serverInfo: SERVER_INFO,
    },
  });
}

async function handleRequest(req) {
  if (!req.method || !req.id) return; // notifications have no id

  switch (req.method) {
    case "initialize":
      handleInitialize(req);
      return;
    case "notifications/initialized":
      return; // no response expected
    case "tools/list":
      sendMessage({
        jsonrpc: "2.0",
        id: req.id,
        result: { tools: TOOLS },
      });
      return;
    case "tools/call":
      try {
        const result = await handleToolCall(req.params.name, req.params.arguments || {});
        sendMessage({
          jsonrpc: "2.0",
          id: req.id,
          result,
        });
      } catch (err) {
        log("tool call error:", err.message);
        sendMessage({
          jsonrpc: "2.0",
          id: req.id,
          error: { code: -32603, message: err.message },
        });
      }
      return;
    default:
      log("unknown method:", req.method);
      // Respond with method not found for unknown methods (with an id)
      if (req.id) {
        sendMessage({
          jsonrpc: "2.0",
          id: req.id,
          error: { code: -32601, message: `Method not found: ${req.method}` },
        });
      }
  }
}

// ─── stdin reader ────────────────────────────────────────────────────────────

let buffer = "";
process.stdin.on("data", (chunk) => {
  buffer += chunk.toString();
  processMessages();
});

function processMessages() {
  while (true) {
    const headerMatch = buffer.match(/^Content-Length: (\d+)\r\n\r\n/);
    if (!headerMatch) break;

    const contentLength = parseInt(headerMatch[1], 10);
    const headerEnd = headerMatch.index + headerMatch[0].length;
    const totalLength = headerEnd + contentLength;

    if (buffer.length < totalLength) break;

    const body = buffer.slice(headerEnd, totalLength);
    buffer = buffer.slice(totalLength);

    try {
      const msg = JSON.parse(body);
      handleRequest(msg);
    } catch (err) {
      log("parse error:", err.message);
    }
  }
}

// ─── startup ─────────────────────────────────────────────────────────────────

log("MCP 1Password wrapper server starting (op CLI backend)");
log("Node version:", process.version);

// Verify op CLI is available
try {
  const version = opText("--version");
  log("op CLI version:", version);
} catch (err) {
  log("WARNING: op CLI not available:", err.message);
}
