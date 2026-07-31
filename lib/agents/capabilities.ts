/**
 * Agent Capability Registry
 *
 * Centralized catalog of every agent in the PANaCEa ecosystem — what it does,
 * what tools it has, what inputs it accepts, what outputs it produces, and how
 * to invoke it. This is the single source of truth for agent discovery.
 *
 * Inspired by the Agent Protocol's capability discovery pattern
 * (github.com/langchain-ai/agent-protocol) but adapted for PANaCEa's
 * existing AgentDefinition + InvokeResult types.
 *
 * @module lib/agents/capabilities
 */

import type { AgentTier } from './shared/types';

// ─── Capability Types ──────────────────────────────────────────────────────

export type AgentCapability =
  | 'clinical-reasoning'
  | 'diagnostic-workup'
  | 'patient-simulation'
  | 'grading-assessment'
  | 'feedback-generation'
  | 'content-audit'
  | 'content-generation'
  | 'content-enrichment'
  | 'code-review'
  | 'incident-response'
  | 'schema-validation'
  | 'env-audit'
  | 'prompt-validation'
  | 'gemini-audit'
  | 'literature-search'
  | 'guideline-synthesis'
  | 'evidence-grading'
  | 'research-synthesis'
  | 'blueprint-coverage'
  | 'fsrs-analytics'
  | 'database-integrity'
  | 'question-quality';

export type AgentStrategy =
  | 'single-invoke'
  | 'sequential-pipeline'
  | 'parallel-broadcast'
  | 'supervisor-routed'
  | 'supervisor-researcher'
  | 'plan-execute';

export interface AgentCapabilityEntry {
  /** Stable unique name — kebab-case, matches registry key */
  name: string;
  /** Human-readable one-liner */
  description: string;
  /** Agent tier (encounter | ops | orchestrator) */
  tier: AgentTier | 'orchestrator';
  /** What this agent can do */
  capabilities: AgentCapability[];
  /** Execution strategy */
  strategy: AgentStrategy;
  /** Tools this agent has access to */
  tools: string[];
  /** Input shape description */
  inputShape: string;
  /** Output shape description */
  outputShape: string;
  /** Example invocation */
  example: string;
  /** Source module path */
  source: string;
  /** Whether this agent is production-ready */
  productionReady: boolean;
  /** Dependencies (other agents, services, MCP servers) */
  dependencies: string[];
}

// ─── Capability Registry ────────────────────────────────────────────────────

const capabilityRegistry = new Map<string, AgentCapabilityEntry>();

export function registerCapability(entry: AgentCapabilityEntry): void {
  if (capabilityRegistry.has(entry.name)) {
    throw new Error(`Capability already registered: ${entry.name}`);
  }
  capabilityRegistry.set(entry.name, entry);
}

export function getCapability(name: string): AgentCapabilityEntry | undefined {
  return capabilityRegistry.get(name);
}

export function listCapabilities(): AgentCapabilityEntry[] {
  return Array.from(capabilityRegistry.values());
}

export function findAgentsByCapability(
  capability: AgentCapability,
): AgentCapabilityEntry[] {
  return listCapabilities().filter((a) => a.capabilities.includes(capability));
}

export function findAgentsByTier(
  tier: AgentTier | 'orchestrator',
): AgentCapabilityEntry[] {
  return listCapabilities().filter((a) => a.tier === tier);
}

// ─── Built-in Capability Catalog ────────────────────────────────────────────

export function registerAllCapabilities(): void {
  // ── Encounter Agents ──────────────────────────────────────────────────

  registerCapability({
    name: 'ddx-generator',
    description: 'Generates differential diagnoses from clinical presentations',
    tier: 'encounter',
    capabilities: ['clinical-reasoning', 'diagnostic-workup'],
    strategy: 'single-invoke',
    tools: ['clinical_library_search', 'condition_verify'],
    inputShape: '{ condition: string, patientAge?: number, findings?: string[] }',
    outputShape: '{ diagnoses: Array<{ name: string, probability: string, rationale: string }> }',
    example: 'invokeAgent("ddx-generator", { condition: "chest pain" }, ctx)',
    source: 'lib/agents/encounter/ddxGenerator.ts',
    productionReady: true,
    dependencies: ['clinical_library_search', 'condition_verify'],
  });

  registerCapability({
    name: 'soap-note-grader',
    description: 'Grades SOAP notes against clinical standards using SPBench rubric',
    tier: 'encounter',
    capabilities: ['grading-assessment'],
    strategy: 'single-invoke',
    tools: [],
    inputShape: '{ soapNote: string, rubric: string }',
    outputShape: '{ scores: Record<string, number>, feedback: string }',
    example: 'invokeAgent("soap-note-grader", { soapNote: "...", rubric: "..." }, ctx)',
    source: 'lib/agents/encounter/soapNoteGrader.ts',
    productionReady: true,
    dependencies: [],
  });

  registerCapability({
    name: 'feedback-summarizer',
    description: 'Summarizes clinical encounter feedback into actionable insights',
    tier: 'encounter',
    capabilities: ['feedback-generation'],
    strategy: 'single-invoke',
    tools: [],
    inputShape: '{ scores: Record<string, number>, transcript: TranscriptMessage[] }',
    outputShape: '{ summary: string, strengths: string[], improvements: string[] }',
    example: 'invokeAgent("feedback-summarizer", { scores, transcript }, ctx)',
    source: 'lib/agents/encounter/feedbackSummarizer.ts',
    productionReady: true,
    dependencies: [],
  });

  registerCapability({
    name: 'diagnostic-workup-advisor',
    description: 'Recommends diagnostic tests and workup based on clinical presentation',
    tier: 'encounter',
    capabilities: ['diagnostic-workup'],
    strategy: 'single-invoke',
    tools: ['clinical_library_search'],
    inputShape: '{ condition: string, findings: string[] }',
    outputShape: '{ recommendedTests: string[], rationale: string }',
    example: 'invokeAgent("diagnostic-workup-advisor", { condition: "chest pain" }, ctx)',
    source: 'lib/agents/encounter/diagnosticWorkupAdvisor.ts',
    productionReady: true,
    dependencies: ['clinical_library_search'],
  });

  registerCapability({
    name: 'standardized-patient',
    description: 'Simulates a standardized patient for OSCE encounters',
    tier: 'encounter',
    capabilities: ['patient-simulation'],
    strategy: 'single-invoke',
    tools: [],
    inputShape: '{ caseDetails: object, studentUtterance: string }',
    outputShape: '{ patientResponse: string, vitals?: PatientVitals }',
    example: 'invokeAgent("standardized-patient", { caseDetails, studentUtterance }, ctx)',
    source: 'lib/agents/encounter/standardizedPatient.ts',
    productionReady: true,
    dependencies: [],
  });

  registerCapability({
    name: 'intent-router',
    description: 'Classifies student intent during OSCE encounters',
    tier: 'encounter',
    capabilities: ['clinical-reasoning'],
    strategy: 'single-invoke',
    tools: [],
    inputShape: '{ studentText: string }',
    outputShape: '{ intent: StudentIntent, confidence: number }',
    example: 'invokeAgent("intent-router", { studentText: "..." }, ctx)',
    source: 'lib/agents/encounter/intentRouter.ts',
    productionReady: true,
    dependencies: [],
  });

  registerCapability({
    name: 'spbench-grader',
    description: 'Grades OSCE encounters using the SPBench 8-domain rubric',
    tier: 'encounter',
    capabilities: ['grading-assessment'],
    strategy: 'single-invoke',
    tools: [],
    inputShape: '{ transcript: unknown, intentLog: unknown[], studentDiagnosis: string, correctDiagnosis: string }',
    outputShape: '{ QC, CC, CD, RC, LC, LN, CS, PD, overallScore: number }',
    example: 'invokeAgent("spbench-grader", spbenchInput, ctx)',
    source: 'lib/agents/encounter/spbenchGrader.ts',
    productionReady: true,
    dependencies: [],
  });

  // ── Ops Agents ────────────────────────────────────────────────────────

  registerCapability({
    name: 'call-gemini-auditor',
    description: 'Audits Gemini API call sites for correctness, error handling, and cost efficiency',
    tier: 'ops',
    capabilities: ['gemini-audit', 'code-review'],
    strategy: 'single-invoke',
    tools: [],
    inputShape: '{ rootDir: string }',
    outputShape: '{ summary: object, callSites: Array<{ file, line, issues }> }',
    example: 'invokeAgent("call-gemini-auditor", { rootDir: "." }, ctx)',
    source: 'lib/agents/ops/callGeminiAuditor.ts',
    productionReady: true,
    dependencies: [],
  });

  registerCapability({
    name: 'prompt-contract-validator',
    description: 'Validates AI prompt contracts against expected schemas and safety rules',
    tier: 'ops',
    capabilities: ['prompt-validation'],
    strategy: 'single-invoke',
    tools: [],
    inputShape: '{ prompts: Array<{ name: string, template: string }> }',
    outputShape: '{ valid: boolean, issues: Array<{ prompt, rule, message }> }',
    example: 'invokeAgent("prompt-contract-validator", { prompts }, ctx)',
    source: 'lib/agents/ops/promptContractValidator.ts',
    productionReady: true,
    dependencies: [],
  });

  registerCapability({
    name: 'schema-drift-detector',
    description: 'Detects drift between Prisma schema and actual database state',
    tier: 'ops',
    capabilities: ['schema-validation', 'database-integrity'],
    strategy: 'single-invoke',
    tools: ['database_integrity_check'],
    inputShape: '{ schemaPath: string }',
    outputShape: '{ driftDetected: boolean, diffs: Array<{ table, column, issue }> }',
    example: 'invokeAgent("schema-drift-detector", { schemaPath: "prisma/schema.prisma" }, ctx)',
    source: 'lib/agents/ops/schemaDriftDetector.ts',
    productionReady: true,
    dependencies: ['database_integrity_check'],
  });

  registerCapability({
    name: 'env-var-auditor',
    description: 'Audits environment variables for missing, unused, or insecure configurations',
    tier: 'ops',
    capabilities: ['env-audit'],
    strategy: 'single-invoke',
    tools: [],
    inputShape: '{ envKeys: string[], requiredKeys: string[] }',
    outputShape: '{ missing: string[], unused: string[], insecure: string[] }',
    example: 'invokeAgent("env-var-auditor", { envKeys, requiredKeys }, ctx)',
    source: 'lib/agents/ops/envVarAuditor.ts',
    productionReady: true,
    dependencies: [],
  });

  // ── Orchestrator Agents (packages/agent-orchestrator) ─────────────────

  registerCapability({
    name: 'content-audit',
    description: 'Audits clinical content for accuracy, completeness, and blueprint alignment',
    tier: 'orchestrator',
    capabilities: ['content-audit', 'blueprint-coverage'],
    strategy: 'single-invoke',
    tools: ['remember', 'recall', 'linear_create_issue', 'linear_search_issues', 'n8n_trigger'],
    inputShape: '{ condition?: string, organSystem?: string, auditType: "full" | "condition" | "blueprint" }',
    outputShape: '{ findings: Array<{ severity, category, description, recommendation }>, linearIssueIds: string[] }',
    example: 'POST /agents/content-audit/invoke { "auditType": "full" }',
    source: 'packages/agent-orchestrator/src/agents/',
    productionReady: true,
    dependencies: ['Qdrant', 'Linear', 'n8n'],
  });

  registerCapability({
    name: 'pr-triage',
    description: 'Triages GitHub PRs with automated code review and Linear issue filing',
    tier: 'orchestrator',
    capabilities: ['code-review'],
    strategy: 'single-invoke',
    tools: ['github_get_pr_info', 'github_post_pr_review', 'linear_create_issue', 'remember', 'recall'],
    inputShape: '{ prNumber: number }',
    outputShape: '{ review: "COMMENT" | "APPROVE" | "REQUEST_CHANGES", issues: string[] }',
    example: 'POST /agents/pr-triage/invoke { "prNumber": 123 }',
    source: 'packages/agent-orchestrator/src/agents/',
    productionReady: true,
    dependencies: ['GitHub', 'Linear', 'Qdrant'],
  });

  registerCapability({
    name: 'incident-responder',
    description: 'Responds to Sentry incidents with severity-based triage and Linear issue creation',
    tier: 'orchestrator',
    capabilities: ['incident-response'],
    strategy: 'single-invoke',
    tools: ['sentry_list_issues', 'linear_create_issue', 'remember', 'recall', 'n8n_trigger'],
    inputShape: '{ sentryIssueId?: string, timeRange?: string }',
    outputShape: '{ incidents: Array<{ id, severity, title, linearIssueId }>, summary: string }',
    example: 'POST /agents/incident-responder/invoke { "timeRange": "24h" }',
    source: 'packages/agent-orchestrator/src/agents/',
    productionReady: true,
    dependencies: ['Sentry', 'Linear', 'Qdrant', 'n8n'],
  });

  registerCapability({
    name: 'content-enrichment',
    description: 'Enriches clinical content with citations, guidelines, and related conditions',
    tier: 'orchestrator',
    capabilities: ['content-enrichment', 'guideline-synthesis'],
    strategy: 'single-invoke',
    tools: ['remember', 'recall', 'linear_create_issue'],
    inputShape: '{ query: string, conditionId?: string }',
    outputShape: '{ candidates: Array<{ condition, enrichment, confidence, citations }> }',
    example: 'POST /agents/content-enrichment/invoke { "query": "Atrial fibrillation + 2023 ACC/AHA guideline" }',
    source: 'packages/agent-orchestrator/src/agents/',
    productionReady: true,
    dependencies: ['Qdrant', 'Linear'],
  });

  registerCapability({
    name: 'weekly-report',
    description: 'Generates weekly development digest from agent activity, Sentry, and Linear',
    tier: 'orchestrator',
    capabilities: ['content-audit', 'incident-response'],
    strategy: 'supervisor-routed',
    tools: ['remember', 'recall', 'linear_search_issues', 'sentry_list_issues'],
    inputShape: '{ weekStart?: string }',
    outputShape: '{ digest: string, metrics: object, issues: string[] }',
    example: 'POST /agents/weekly-report/invoke {}',
    source: 'packages/agent-orchestrator/src/agents/',
    productionReady: true,
    dependencies: ['Qdrant', 'Linear', 'Sentry'],
  });

  // ── Orchestrator Workflows ────────────────────────────────────────────

  registerCapability({
    name: 'clinical-encounter',
    description: 'Full clinical encounter workflow: DDx → SOAP grading → feedback',
    tier: 'orchestrator',
    capabilities: ['clinical-reasoning', 'diagnostic-workup', 'grading-assessment', 'feedback-generation'],
    strategy: 'sequential-pipeline',
    tools: [],
    inputShape: '{ condition: string, soapNote?: string, transcript?: TranscriptMessage[] }',
    outputShape: '{ diagnoses, grading, feedback }',
    example: 'runOrchestrator("clinical-encounter", input, ctx)',
    source: 'lib/agents/orchestrator.ts',
    productionReady: true,
    dependencies: ['ddx-generator', 'soap-note-grader', 'feedback-summarizer'],
  });

  registerCapability({
    name: 'diagnostic-workup',
    description: 'Parallel diagnostic workup: DDx + recommended tests',
    tier: 'orchestrator',
    capabilities: ['diagnostic-workup', 'clinical-reasoning'],
    strategy: 'parallel-broadcast',
    tools: [],
    inputShape: '{ condition: string, findings: string[] }',
    outputShape: '{ differentialDiagnosis, recommendedWorkup }',
    example: 'runOrchestrator("diagnostic-workup", input, ctx)',
    source: 'lib/agents/orchestrator.ts',
    productionReady: true,
    dependencies: ['ddx-generator', 'diagnostic-workup-advisor'],
  });

  registerCapability({
    name: 'ops-supervised',
    description: 'Supervisor-routed operational tasks: Gemini audit, prompt validation, schema drift, env audit',
    tier: 'orchestrator',
    capabilities: ['gemini-audit', 'prompt-validation', 'schema-validation', 'env-audit'],
    strategy: 'supervisor-routed',
    tools: [],
    inputShape: '{ task: string, context?: object }',
    outputShape: '{ result: unknown, routedTo: string }',
    example: 'runOrchestrator("ops-supervised", input, ctx)',
    source: 'lib/agents/orchestrator.ts',
    productionReady: true,
    dependencies: ['call-gemini-auditor', 'prompt-contract-validator', 'schema-drift-detector', 'env-var-auditor'],
  });

  // ── LangChain Agents ──────────────────────────────────────────────────

  registerCapability({
    name: 'question-generator',
    description: 'Generates PANCE/PANRE practice questions with clinical accuracy',
    tier: 'encounter',
    capabilities: ['content-generation', 'question-quality'],
    strategy: 'single-invoke',
    tools: [],
    inputShape: '{ messages: BaseMessage[] }',
    outputShape: '{ question, choices, correctAnswer, explanation, organSystem, taskCategory }',
    example: 'createQuestionGeneratorAgent().invoke({ messages: [...] })',
    source: 'lib/langchain/agent.ts',
    productionReady: true,
    dependencies: ['Gemini API'],
  });

  registerCapability({
    name: 'clinical-tutor',
    description: 'Socratic tutoring agent for PA students preparing for PANCE/PANRE',
    tier: 'encounter',
    capabilities: ['clinical-reasoning', 'feedback-generation'],
    strategy: 'single-invoke',
    tools: [],
    inputShape: '{ messages: BaseMessage[] }',
    outputShape: '{ messages: BaseMessage[] }',
    example: 'createTutorAgent().invoke({ messages: [...] })',
    source: 'lib/langchain/agent.ts',
    productionReady: true,
    dependencies: ['Gemini API'],
  });

  registerCapability({
    name: 'osce-encounter',
    description: 'Full OSCE encounter simulation with 6-phase graph and SPBench grading',
    tier: 'encounter',
    capabilities: ['patient-simulation', 'grading-assessment', 'clinical-reasoning'],
    strategy: 'sequential-pipeline',
    tools: [],
    inputShape: '{ env: AIEnvKeys, sessionId: string, clerkUserId: string, correctDiagnosis: string }',
    outputShape: '{ phase, transcript, scores, studentDiagnosis }',
    example: 'compiledOsceGraph.invoke(initialState, config)',
    source: 'lib/langchain/graphs/osceEncounter.ts',
    productionReady: true,
    dependencies: ['Gemini API', 'LangSmith'],
  });

  registerCapability({
    name: 'question-pipeline',
    description: 'Multi-step question generation pipeline: generate → critique → refine',
    tier: 'encounter',
    capabilities: ['content-generation', 'question-quality'],
    strategy: 'sequential-pipeline',
    tools: [],
    inputShape: '{ env: AIEnvKeys, request: string, organSystem: string, taskCategory: string }',
    outputShape: '{ question: string, critique: string, iterations: number, phase: "complete" | "failed" }',
    example: 'runQuestionPipeline({ env, request, organSystem, taskCategory })',
    source: 'lib/langchain/graphs/questionPipeline.ts',
    productionReady: true,
    dependencies: ['Gemini API', 'LangSmith'],
  });
}

// ─── Summary Helpers ────────────────────────────────────────────────────────

export interface CapabilitySummary {
  totalAgents: number;
  byTier: Record<string, number>;
  byCapability: Record<string, number>;
  byStrategy: Record<string, number>;
  productionReady: number;
  totalTools: number;
}

export function getCapabilitySummary(): CapabilitySummary {
  const agents = listCapabilities();
  const byTier: Record<string, number> = {};
  const byCapability: Record<string, number> = {};
  const byStrategy: Record<string, number> = {};
  let productionReady = 0;
  const allTools = new Set<string>();

  for (const agent of agents) {
    byTier[agent.tier] = (byTier[agent.tier] ?? 0) + 1;
    for (const cap of agent.capabilities) {
      byCapability[cap] = (byCapability[cap] ?? 0) + 1;
    }
    byStrategy[agent.strategy] = (byStrategy[agent.strategy] ?? 0) + 1;
    if (agent.productionReady) productionReady++;
    for (const tool of agent.tools) allTools.add(tool);
  }

  return {
    totalAgents: agents.length,
    byTier,
    byCapability,
    byStrategy,
    productionReady,
    totalTools: allTools.size,
  };
}
