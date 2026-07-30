/**
 * LLM client factory.
 *
 * Picks the LangChain chat model based on which API key is configured.
 * Defaults to Gemini (PANaCEa already uses Gemini for content generation),
 * falls back to OpenAI, then Anthropic.
 *
 * All agents call `getLLM()` — they never import a provider directly, so
 * swapping the default provider is a one-line change here.
 *
 * Doc reference: @langchain/google-genai ChatGoogleGenerativeAI,
 *                @langchain/openai ChatOpenAI, @langchain/anthropic ChatAnthropic
 *
 * @module packages/agent-orchestrator/src/clients/llm
 */

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { getEnv, getCapabilities, optionalEnv, getAnthropicKey } from '../config/env.js';

let _cached: BaseChatModel | null = null;

export async function getLLM(modelOverride?: string): Promise<BaseChatModel> {
  if (_cached && !modelOverride) return _cached;

  const env = getEnv();
  const caps = getCapabilities();
  const model = modelOverride ?? optionalEnv('ORCHESTRATOR_MODEL', 'gemini-2.5-flash');

  if (env.GEMINI_API_KEY || caps.composio === false) {
    // Primary path: Gemini (matches PANaCEa content-generation stack)
    const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai');
    const llm = new ChatGoogleGenerativeAI({
      model,
      apiKey: env.GEMINI_API_KEY,
      temperature: 0.2,
    });
    if (!modelOverride) _cached = llm;
    return llm;
  }

  if (env.OPENAI_API_KEY) {
    const { ChatOpenAI } = await import('@langchain/openai');
    const llm = new ChatOpenAI({ model, apiKey: env.OPENAI_API_KEY, temperature: 0.2 });
    if (!modelOverride) _cached = llm;
    return llm;
  }

  if (env.ANTHROPIC_API_KEY) {
    const { ChatAnthropic } = await import('@langchain/anthropic');
    const llm = new ChatAnthropic({ model, apiKey: env.ANTHROPIC_API_KEY, temperature: 0.2 });
    if (!modelOverride) _cached = llm;
    return llm;
  }

  const anthropicAlt = getAnthropicKey();
  if (anthropicAlt) {
    const { ChatAnthropic } = await import('@langchain/anthropic');
    const llm = new ChatAnthropic({ model, apiKey: anthropicAlt, temperature: 0.2 });
    if (!modelOverride) _cached = llm;
    return llm;
  }

  throw new Error(
    '[agent-orchestrator] No LLM provider configured. Set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY.',
  );
}