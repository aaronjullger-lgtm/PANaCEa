/**
 * Cursor Cloud Agents API client.
 * Launches background agents via POST /v0/agents with Basic Auth.
 * @see https://docs.cursor.com/background-agent/api/launch-an-agent
 */

const DEFAULT_BASE_URL = 'https://api.cursor.com';

export interface LaunchAgentOptions {
  /** Instruction/prompt for the agent */
  instruction: string;
  /** Full GitHub repo URL (e.g. https://github.com/org/repo) */
  repository?: string;
  /** Git ref: branch name, tag, or commit SHA */
  ref?: string;
  /** If true, agent can auto-create a PR with changes */
  autoCreatePr?: boolean;
  /** Custom branch name for agent to create */
  branchName?: string;
  /** Webhook URL for status callbacks */
  webhookUrl?: string;
  /** Webhook secret (min 32 chars) if using webhook */
  webhookSecret?: string;
}

export interface LaunchAgentResult {
  /** Agent run ID for polling or reference */
  id: string;
  /** API response payload (may include status, etc.) */
  raw?: Record<string, unknown>;
}

/**
 * Launch a Cloud Agent with the given instruction and optional context.
 * Requires CURSOR_AGENTS_API_KEY in env. Optionally CURSOR_AGENTS_BASE_URL.
 */
export async function launchAgent(options: LaunchAgentOptions): Promise<LaunchAgentResult> {
  const apiKey = process.env.CURSOR_AGENTS_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error(
      'CURSOR_AGENTS_API_KEY is required. Set it in .env or GitHub Secrets. Get the key from Cursor Dashboard.'
    );
  }

  const baseUrl = (process.env.CURSOR_AGENTS_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const url = `${baseUrl}/v0/agents`;

  const body: Record<string, unknown> = {
    prompt: { text: options.instruction },
  };

  if (options.repository) {
    body.source = { repository: options.repository };
    if (options.ref) (body.source as Record<string, string>).ref = options.ref;
  }

  if (options.autoCreatePr !== undefined) {
    body.target = body.target || {};
    (body.target as Record<string, boolean>).autoCreatePr = options.autoCreatePr;
  }
  if (options.branchName) {
    body.target = body.target || {};
    (body.target as Record<string, string>).branchName = options.branchName;
  }

  if (options.webhookUrl) {
    body.webhook = { url: options.webhookUrl };
    if (options.webhookSecret && options.webhookSecret.length >= 32) {
      (body.webhook as Record<string, string>).secret = options.webhookSecret;
    }
  }

  const auth = Buffer.from(`${apiKey}:`, 'utf8').toString('base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloud Agents API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const id = (data?.id ?? data?.agentId ?? data?.runId) as string | undefined;
  if (!id || typeof id !== 'string') {
    throw new Error(`Cloud Agents API returned no run ID: ${JSON.stringify(data)}`);
  }

  return { id, raw: data };
}
