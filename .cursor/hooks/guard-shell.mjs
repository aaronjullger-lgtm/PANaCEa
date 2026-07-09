#!/usr/bin/env node
/**
 * Cursor beforeShellExecution hook — safety guard.
 *
 * Reads a JSON payload on stdin ({ command, cwd, ... }) and prints a JSON
 * permission decision on stdout:
 *   { "permission": "allow" | "deny" | "ask", "user_message"?, "agent_message"? }
 *
 * Design goals:
 *  - Non-destructive: this hook NEVER runs the command; it only advises.
 *  - Fail-open: any parse/logic error results in "allow" so normal work is
 *    never blocked by a broken guard (hooks.json also sets failClosed: false).
 *
 * Deny  = clearly destructive / secret-exposing / production-touching.
 * Ask   = risky but sometimes legitimate (force push, deploy, prod migrate).
 * Allow = everything else.
 */

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    try {
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (c) => (data += c));
      process.stdin.on('end', () => resolve(data));
      process.stdin.on('error', () => resolve(data));
      // Safety: if no stdin arrives, resolve empty shortly.
      setTimeout(() => resolve(data), 2000);
    } catch {
      resolve(data);
    }
  });
}

const allow = () => ({ permission: 'allow' });
const deny = (msg) => ({
  permission: 'deny',
  user_message: msg,
  agent_message: `Blocked by .cursor safety guard: ${msg} If this is genuinely required, ask the user to run it manually or adjust .cursor/hooks/guard-shell.mjs.`,
});
const ask = (msg) => ({
  permission: 'ask',
  user_message: msg,
  agent_message: `The safety guard flagged this as risky: ${msg} Confirm before proceeding.`,
});

// Destructive / unsafe patterns -> deny
const DENY = [
  { re: /\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r/i, msg: 'recursive force delete (rm -rf).' },
  { re: /\brm\s+-[rf]{1,2}\s+(\/|~|\$HOME|\.\s|\*)/i, msg: 'deleting root/home/broad paths.' },
  { re: /:\(\)\s*\{.*\}\s*;\s*:/, msg: 'fork bomb.' },
  { re: /\bmkfs\b|\bdd\s+if=.*of=\/dev\//i, msg: 'disk-destroying command.' },
  { re: /\bchmod\s+-R?\s*777\b/i, msg: 'world-writable chmod 777.' },
  { re: /\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)\b/i, msg: 'destructive SQL (DROP/TRUNCATE).' },
  { re: /prisma\s+migrate\s+reset\b/i, msg: 'prisma migrate reset (wipes the database).' },
  { re: /db\s+push\b[^\n]*--force-reset/i, msg: 'prisma db push --force-reset (data loss).' },
  { re: /\bgit\s+reset\s+--hard\b/i, msg: 'git reset --hard (loses uncommitted work).' },
  { re: /\bgit\s+clean\s+-[a-z]*f/i, msg: 'git clean -f (deletes untracked files).' },
  // Curl/wget piped straight into a shell = untrusted remote code execution.
  { re: /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(bash|sh|zsh)\b/i, msg: 'piping a downloaded script directly into a shell.' },
  // Writing likely-real secrets into tracked files.
  { re: /\b(sk_live_|pk_live_|whsec_)[A-Za-z0-9]/, msg: 'writing what looks like a live secret/key.' },
];

// Risky but sometimes valid -> ask
const ASK = [
  { re: /\bgit\s+push\b[^\n]*(--force\b|-f\b|--force-with-lease)/i, msg: 'force push.' },
  { re: /\bgit\s+push\b[^\n]*\bpush\s+--delete|\bgit\s+push\s+[^\n]*:\S/i, msg: 'deleting a remote branch.' },
  { re: /wrangler\s+(pages\s+)?deploy\b|deploy:local\b|migrate:production\b/i, msg: 'a production deploy/migration.' },
  { re: /prisma\s+migrate\s+deploy\b/i, msg: 'applying migrations (verify the target is not production).' },
  { re: /\bnpm\s+publish\b/i, msg: 'publishing a package.' },
  { re: /\bgit\s+add\s+(\.|-A|--all)\b/i, msg: 'staging all files (prefer explicit paths; avoid committing stray/secret files).' },
];

async function main() {
  let cmd = '';
  try {
    const raw = await readStdin();
    if (raw && raw.trim()) {
      const payload = JSON.parse(raw);
      cmd = String(payload.command ?? payload.args ?? '');
    }
  } catch {
    return allow(); // fail-open on unparsable input
  }

  if (!cmd) return allow();

  for (const rule of DENY) if (rule.re.test(cmd)) return deny(rule.msg);
  for (const rule of ASK) if (rule.re.test(cmd)) return ask(rule.msg);
  return allow();
}

main()
  .then((res) => process.stdout.write(JSON.stringify(res)))
  .catch(() => process.stdout.write(JSON.stringify(allow())));
