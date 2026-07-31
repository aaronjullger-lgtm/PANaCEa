/**
 * LangSmith Hub Prompt Management
 *
 * Centralized prompt management via LangSmith Hub. Replaces hardcoded
 * prompt strings with versioned, collaborative prompts that can be
 * A/B tested and iterated on without code changes.
 *
 * Architecture:
 *   Agent code → pullPrompt("agent/name") → LangSmith Hub
 *   Fallback: hardcoded defaults if Hub is unavailable
 *
 * Usage:
 *   const prompt = await pullPrompt("agent/ddx-generator", { condition: "CHF" });
 *   const messages = prompt.format({ condition: "CHF", age: 65 });
 *
 * @module lib/langchain/hub/prompts
 */

import { Client } from 'langsmith';
import type { AIEnvKeys } from '@/lib/langchain/models';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface HubPrompt {
  /** Prompt name on LangSmith Hub (e.g., "panacea/agent/ddx-generator") */
  name: string;
  /** Human-readable description */
  description: string;
  /** Current version hash */
  version: string;
  /** The prompt template string */
  template: string;
  /** Expected input variables */
  inputVariables: string[];
  /** Commit message for this version */
  commitMessage?: string;
  /** Tags for filtering */
  tags: string[];
  /** Last updated timestamp */
  updatedAt: string;
}

export interface PullPromptOptions {
  /** Specific version to pull (default: latest) */
  version?: string;
  /** Fallback template if Hub is unavailable */
  fallback?: string;
  /** Cache TTL in seconds (default: 300 = 5 min) */
  cacheTtlSeconds?: number;
}

export interface PushPromptOptions {
  /** Commit message for the new version */
  commitMessage: string;
  /** Tags to apply */
  tags?: string[];
}

// ─── Prompt Registry (Hardcoded Fallbacks) ─────────────────────────────────

/**
 * Hardcoded prompt fallbacks. These are used when LangSmith Hub is
 * unavailable. Keep these in sync with the Hub versions.
 */
const FALLBACK_PROMPTS: Record<string, HubPrompt> = {
  'panacea/agent/ddx-generator': {
    name: 'panacea/agent/ddx-generator',
    description: 'Generates differential diagnoses from patient presentations',
    version: 'v1',
    template: `You are a clinical reasoning expert. Based on the following patient presentation, generate a comprehensive differential diagnosis.

Patient Presentation:
{patientPresentation}

Instructions:
1. List diagnoses from most likely to least likely
2. For each diagnosis, provide:
   - Key supporting findings from the presentation
   - Key findings that argue against it
   - Recommended next diagnostic steps
3. Include at least 5 differential diagnoses
4. Flag any "cannot miss" diagnoses (life-threatening or time-sensitive)

Format your response as a structured differential diagnosis.`,
    inputVariables: ['patientPresentation'],
    tags: ['agent', 'clinical', 'ddx'],
    updatedAt: new Date().toISOString(),
  },

  'panacea/agent/soap-note-grader': {
    name: 'panacea/agent/soap-note-grader',
    description: 'Grades SOAP notes for completeness and clinical accuracy',
    version: 'v1',
    template: `You are a medical education grader evaluating a SOAP note.

SOAP Note to Grade:
{soapNote}

Grading Criteria:
1. Subjective (S): Complete history, chief complaint, HPI, review of systems
2. Objective (O): Relevant vitals, physical exam findings, lab/imaging results
3. Assessment (A): Accurate diagnosis, differential diagnoses, clinical reasoning
4. Plan (P): Appropriate management, medications, follow-up, patient education

For each section, provide:
- Score (1-5)
- Specific strengths
- Areas for improvement
- Overall grade and recommendations`,
    inputVariables: ['soapNote'],
    tags: ['agent', 'clinical', 'grading'],
    updatedAt: new Date().toISOString(),
  },

  'panacea/agent/feedback-summarizer': {
    name: 'panacea/agent/feedback-summarizer',
    description: 'Summarizes student performance and provides actionable feedback',
    version: 'v1',
    template: `You are a medical education feedback specialist. Summarize the student's performance and provide constructive feedback.

Performance Data:
{performanceData}

Instructions:
1. Highlight 2-3 key strengths with specific examples
2. Identify 2-3 areas for improvement with actionable suggestions
3. Provide an overall assessment of clinical reasoning level
4. Suggest specific study resources or practice areas
5. Keep feedback encouraging and growth-oriented

Format as a structured feedback summary.`,
    inputVariables: ['performanceData'],
    tags: ['agent', 'feedback', 'education'],
    updatedAt: new Date().toISOString(),
  },

  'panacea/agent/standardized-patient': {
    name: 'panacea/agent/standardized-patient',
    description: 'Standardized patient for OSCE encounters',
    version: 'v1',
    template: `You are a standardized patient in an OSCE (Objective Structured Clinical Examination) encounter.

Patient Case:
{patientCase}

Instructions:
1. Stay in character throughout the encounter
2. Respond naturally to the student's questions
3. Provide realistic symptoms and history when asked
4. React appropriately to physical exam maneuvers
5. Show appropriate emotional responses (anxiety, pain, concern)
6. Do NOT reveal the diagnosis unless the student states it explicitly
7. If the student asks something you wouldn't know as this patient, say so

Current conversation:
{conversation}

Student's last question: {studentQuestion}

Respond as the patient.`,
    inputVariables: ['patientCase', 'conversation', 'studentQuestion'],
    tags: ['agent', 'osce', 'simulation'],
    updatedAt: new Date().toISOString(),
  },

  'panacea/agent/intent-classifier': {
    name: 'panacea/agent/intent-classifier',
    description: 'Classifies student intent during OSCE encounters',
    version: 'v1',
    template: `Classify the student's intent in this OSCE encounter.

Student's statement: "{studentStatement}"

Possible intents:
- history_question: Asking about patient history, symptoms, or background
- exam_request: Requesting to perform a physical exam
- lab_order: Ordering laboratory tests
- imaging_order: Ordering imaging studies
- assessment_present: Presenting their assessment or diagnosis
- closure: Ending the encounter
- small_talk: Non-clinical conversation

Respond with ONLY the intent label (e.g., "history_question").`,
    inputVariables: ['studentStatement'],
    tags: ['agent', 'osce', 'classification'],
    updatedAt: new Date().toISOString(),
  },

  'panacea/agent/question-generator': {
    name: 'panacea/agent/question-generator',
    description: 'Generates PANCE/PANRE practice questions',
    version: 'v1',
    template: `You are a medical education expert creating PANCE/PANRE practice questions.

Topic: {topic}
Organ System: {organSystem}
Task Category: {taskCategory}
Cognitive Level: {cognitiveLevel}

Instructions:
1. Create a clinically accurate, board-relevant question
2. Include a detailed clinical vignette when appropriate
3. Provide 5 answer choices (A-E) with one clearly correct answer
4. Include a comprehensive explanation with rationale for each choice
5. Cite relevant guidelines or evidence when applicable
6. Ensure the question tests clinical reasoning, not just recall

Output as valid JSON:
{
  "question": "stem text with vignette",
  "choices": ["A. ...", "B. ...", "C. ...", "D. ...", "E. ..."],
  "correctAnswer": "A",
  "explanation": "detailed rationale",
  "learningObjective": "what the student should learn",
  "organSystem": "{organSystem}",
  "taskCategory": "{taskCategory}",
  "cognitiveLevel": "{cognitiveLevel}"
}`,
    inputVariables: ['topic', 'organSystem', 'taskCategory', 'cognitiveLevel'],
    tags: ['agent', 'generation', 'questions'],
    updatedAt: new Date().toISOString(),
  },
};

// ─── Hub Client ────────────────────────────────────────────────────────────

let _hubClient: Client | null = null;
const _promptCache = new Map<string, { prompt: HubPrompt; cachedAt: number }>();

function getHubClient(env: AIEnvKeys): Client | null {
  if (!env.LANGSMITH_API_KEY) return null;

  if (!_hubClient) {
    _hubClient = new Client({
      apiKey: env.LANGSMITH_API_KEY,
      apiUrl: env.LANGSMITH_ENDPOINT ?? 'https://api.smith.langchain.com',
    });
  }

  return _hubClient;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Pull a prompt from LangSmith Hub by name.
 *
 * Falls back to hardcoded defaults if Hub is unavailable or the prompt
 * doesn't exist on Hub. Results are cached for the specified TTL.
 *
 * @example
 * ```ts
 * const prompt = await pullPrompt("panacea/agent/ddx-generator", env);
 * const formatted = formatPrompt(prompt, { patientPresentation: "..." });
 * ```
 */
export async function pullPrompt(
  name: string,
  env: AIEnvKeys,
  options: PullPromptOptions = {},
): Promise<HubPrompt> {
  const cacheTtl = (options.cacheTtlSeconds ?? 300) * 1000;

  // Check cache
  const cached = _promptCache.get(name);
  if (cached && Date.now() - cached.cachedAt < cacheTtl) {
    return cached.prompt;
  }

  // Try LangSmith Hub
  const client = getHubClient(env);
  if (client) {
    try {
      const identifier = options.version ? `${name}:${options.version}` : name;
      const commit = await client.pullPromptCommit(identifier);

      if (commit) {
        const manifest = commit.manifest as Record<string, unknown> | undefined;
        const template = typeof manifest?.template === 'string'
          ? manifest.template
          : JSON.stringify(manifest);

        const prompt: HubPrompt = {
          name,
          description: (commit.description as string) ?? '',
          version: commit.commit_hash ?? 'latest',
          template,
          inputVariables: (manifest?.input_variables as string[]) ?? extractVariables(template),
          tags: (commit.tags as string[]) ?? [],
          updatedAt: commit.created_at ?? new Date().toISOString(),
        };

        _promptCache.set(name, { prompt, cachedAt: Date.now() });
        return prompt;
      }
    } catch (err) {
      console.warn(`[HubPrompts] Failed to pull "${name}" from Hub:`, (err as Error).message);
    }
  }

  // Fallback to hardcoded
  const fallback = FALLBACK_PROMPTS[name];
  if (fallback) {
    console.log(`[HubPrompts] Using fallback prompt for: ${name}`);
    _promptCache.set(name, { prompt: fallback, cachedAt: Date.now() });
    return fallback;
  }

  // Custom fallback provided
  if (options.fallback) {
    const customFallback: HubPrompt = {
      name,
      description: 'Custom fallback prompt',
      version: 'fallback',
      template: options.fallback,
      inputVariables: extractVariables(options.fallback),
      tags: ['fallback'],
      updatedAt: new Date().toISOString(),
    };
    return customFallback;
  }

  throw new Error(`Prompt not found: ${name}. No Hub connection and no fallback configured.`);
}

/**
 * Push (create or update) a prompt on LangSmith Hub.
 *
 * @example
 * ```ts
 * await pushPrompt("panacea/agent/new-agent", promptTemplate, env, {
 *   commitMessage: "Initial version of new agent prompt",
 *   tags: ["agent", "clinical"],
 * });
 * ```
 */
export async function pushPrompt(
  name: string,
  template: string,
  env: AIEnvKeys,
  options: PushPromptOptions,
): Promise<HubPrompt> {
  const client = getHubClient(env);
  if (!client) {
    throw new Error('Cannot push prompt: LANGSMITH_API_KEY not configured');
  }

  const inputVariables = extractVariables(template);

  const result = await client.pushPrompt(name, {
    template,
    inputVariables,
    description: options.commitMessage,
    tags: options.tags,
  });

  const prompt: HubPrompt = {
    name,
    description: options.commitMessage,
    version: (result as Record<string, unknown>).commit as string ?? 'latest',
    template,
    inputVariables,
    commitMessage: options.commitMessage,
    tags: options.tags ?? [],
    updatedAt: new Date().toISOString(),
  };

  // Update cache
  _promptCache.set(name, { prompt, cachedAt: Date.now() });

  return prompt;
}

/**
 * Format a prompt template with variable values.
 *
 * Uses simple `{variable}` substitution compatible with LangSmith Hub format.
 *
 * @example
 * ```ts
 * const prompt = await pullPrompt("panacea/agent/ddx-generator", env);
 * const formatted = formatPrompt(prompt, { patientPresentation: "45M with chest pain..." });
 * ```
 */
export function formatPrompt(
  prompt: HubPrompt,
  variables: Record<string, string>,
): string {
  let result = prompt.template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

/**
 * List all available prompts (from cache + fallbacks).
 */
export function listPrompts(): HubPrompt[] {
  const prompts = new Map<string, HubPrompt>();

  // Add fallbacks
  for (const [name, prompt] of Object.entries(FALLBACK_PROMPTS)) {
    prompts.set(name, prompt);
  }

  // Add cached (may override fallbacks with newer versions)
  for (const [name, { prompt }] of _promptCache) {
    prompts.set(name, prompt);
  }

  return Array.from(prompts.values());
}

/**
 * Get a prompt directly from fallbacks (no Hub call, no cache).
 * Useful for Edge runtime where Hub client may not be available.
 */
export function getFallbackPrompt(name: string): HubPrompt | undefined {
  return FALLBACK_PROMPTS[name];
}

/**
 * Clear the prompt cache (useful for testing).
 */
export function clearPromptCache(): void {
  _promptCache.clear();
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function extractVariables(template: string): string[] {
  const matches = template.match(/\{(\w+)\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1, -1)))];
}

// ─── Convenience: System Prompt Builders ───────────────────────────────────

/**
 * Build a system prompt for an agent using Hub prompts.
 * Falls back gracefully if Hub is unavailable.
 *
 * @example
 * ```ts
 * const systemPrompt = await buildAgentSystemPrompt('ddx-generator', env, {
 *   patientPresentation: '45M with chest pain...',
 * });
 * ```
 */
export async function buildAgentSystemPrompt(
  agentType: string,
  env: AIEnvKeys,
  variables: Record<string, string>,
): Promise<string> {
  const promptName = `panacea/agent/${agentType}`;
  try {
    const prompt = await pullPrompt(promptName, env);
    return formatPrompt(prompt, variables);
  } catch {
    // Ultimate fallback: use hardcoded
    const fallback = FALLBACK_PROMPTS[promptName];
    if (fallback) {
      return formatPrompt(fallback, variables);
    }
    // Last resort: generic medical prompt
    return `You are a medical education AI assistant specializing in ${agentType}. Provide accurate, helpful responses.`;
  }
}

/**
 * Synchronous version for Edge runtime where async Hub calls aren't feasible.
 * Uses only cached or fallback prompts.
 */
export function buildAgentSystemPromptSync(
  agentType: string,
  variables: Record<string, string>,
): string {
  const promptName = `panacea/agent/${agentType}`;

  // Check cache first
  const cached = _promptCache.get(promptName);
  if (cached) {
    return formatPrompt(cached.prompt, variables);
  }

  // Fallback
  const fallback = FALLBACK_PROMPTS[promptName];
  if (fallback) {
    return formatPrompt(fallback, variables);
  }

  return `You are a medical education AI assistant specializing in ${agentType}.`;
}
