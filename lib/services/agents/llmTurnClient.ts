import { generateText } from 'ai';
import { createAIModel, type AIProviderEnv, type ModelName } from '../../../lib/ai-sdk/providers';
import type { ParsedTurn, AgentContent, AgentTurnContext } from './geminiAgentClient';

export type { ParsedTurn, AgentContent, AgentTurnContext };
export { buildFunctionResponseTurn } from './geminiAgentClient';

export interface LLMTurnRequest {
  systemInstruction: string;
  contents: Array<{
    role: 'user' | 'model';
    parts: Array<
      | { text: string }
      | { functionCall: { name: string; args: Record<string, unknown> } }
      | { functionResponse: { name: string; response: Record<string, unknown> } }
    >;
  }>;
  functionDeclarations: Array<{
    name?: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }>;
  model?: ModelName;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export interface LLMTurnContext {
  env: AIProviderEnv & { DATABASE_URL?: string };
  auth?: { userId?: string };
  waitUntil?: (p: Promise<unknown>) => void;
}

function contentsToMessages(
  contents: LLMTurnRequest['contents']
): any[] {
  const messages: any[] = [];

  for (const turn of contents) {
    const textParts = turn.parts
      .filter((p): p is { text: string } => 'text' in p)
      .map((p) => p.text)
      .join('');

    const toolCalls = turn.parts
      .filter((p): p is { functionCall: { name: string; args: Record<string, unknown> } } => 'functionCall' in p)
      .map((p) => ({
        type: 'tool-call' as const,
        toolName: p.functionCall.name,
        toolCallId: p.functionCall.name,
        args: p.functionCall.args,
      }));

    const toolResults = turn.parts
      .filter((p): p is { functionResponse: { name: string; response: Record<string, unknown> } } => 'functionResponse' in p)
      .map((p) => ({
        type: 'tool-result' as const,
        toolName: p.functionResponse.name,
        toolCallId: p.functionResponse.name,
        result: p.functionResponse.response,
      }));

    if (toolResults.length > 0) {
      for (const tr of toolResults) {
        messages.push({ role: 'tool' as const, content: [
          { type: 'tool-result', toolName: tr.toolName, toolCallId: tr.toolCallId, result: tr.result }
        ]});
      }
    } else if (toolCalls.length > 0) {
      messages.push({
        role: turn.role === 'model' ? 'assistant' : 'user',
        content: [
          ...(textParts ? [{ type: 'text' as const, text: textParts }] : []),
          ...toolCalls,
        ],
      } as any);
    } else if (textParts) {
      messages.push({
        role: turn.role === 'model' ? 'assistant' : 'user',
        content: textParts,
      } as any);
    }
  }

  return messages;
}

function declarationsToTools(
  declarations: LLMTurnRequest['functionDeclarations']
): Record<string, { description?: string; inputSchema: Record<string, unknown> }> {
  const tools: Record<string, { description?: string; inputSchema: Record<string, unknown> }> = {};
  for (const decl of declarations) {
    if (!decl.name) continue;
    tools[decl.name] = {
      description: decl.description,
      inputSchema: decl.parameters ?? { type: 'object', properties: {} },
    };
  }
  return tools;
}

export async function runLLMTurn(
  ctx: LLMTurnContext,
  req: LLMTurnRequest
): Promise<ParsedTurn> {
  const model = createAIModel(req.model ?? 'gpt-4o-mini', ctx.env);
  const messages = contentsToMessages(req.contents);
  const tools = declarationsToTools(req.functionDeclarations);

  const result = await generateText({
    model,
    system: req.systemInstruction,
    messages,
    temperature: req.temperature ?? 0.2,
    maxOutputTokens: req.maxOutputTokens ?? 2048,
    abortSignal: req.signal,
  } as any);

  const rawResult = result as any;
  const text = rawResult.text ?? '';
  const functionCalls = (rawResult.toolCalls ?? []).map((tc: any) => ({
    name: tc.toolName,
    args: typeof tc.args === 'string' ? JSON.parse(tc.args) : (tc.args ?? {}),
  }));

  const blocked = rawResult.finishReason === 'content-filter';
  const usage = rawResult.usage ?? {};

  return {
    text,
    functionCalls,
    blocked,
    blockReason: blocked ? 'content-filter' : undefined,
    usage: {
      input: usage.promptTokens ?? usage.inputTokens ?? 0,
      output: usage.completionTokens ?? usage.outputTokens ?? 0,
      total: usage.totalTokens ?? 0,
    },
  };
}
