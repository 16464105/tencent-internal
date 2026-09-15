/**
 * The Tencent CodeBuddy fixed model catalog. The provider endpoint does not
 * expose an OpenAI-compatible `/models` listing, so this package owns the
 * deployment's official model facts instead of reading the local CodeBuddy
 * desktop cache. The entries are the models the Tencent internal gateway
 * serves, projected from a captured desktop-client cache: every `craft`,
 * `ask`, and `plan` chat-model id with its display name, context window,
 * output cap, image support, and reasoning capability.
 *
 * Configuration layers over it: a `models` list in the plugin config or the
 * `llm-tencent-codebuddy` settings section replaces this catalog wholesale,
 * which is how the Models page edits the directory.
 *
 * @module dsh-llm-tencent-codebuddy/catalog
 */

import type { PiAiModelProfile } from '@deepseek-ai/dsh-llm-pi-ai'

/** Reasoning levels and OpenAI dispatch shared by the catalog's thinking models. */
const REASONING = {
  reasoningEfforts: { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
  compat: { thinkingFormat: 'openai', supportsReasoningEffort: true },
} as const

/** The fixed official model catalog, in desktop-client order. */
export const TENCENT_CODEBUDDY_MODELS: readonly PiAiModelProfile[] = [
  { id: 'auto', name: 'Auto', contextWindow: 168_000, maxTokens: 32_000, input: ['text', 'image'], ...REASONING },
  { id: 'hy3-ioa', name: 'Hy3', contextWindow: 192_000, maxTokens: 64_000, input: ['text', 'image'], ...REASONING },
  { id: 'hy3-preview-hr', name: 'HR敏感数据（L4）专用模型', contextWindow: 192_000, maxTokens: 64_000, input: ['text', 'image'], ...REASONING },
  { id: 'echo', name: 'Echo', contextWindow: 238_000, maxTokens: 24_000, reasoningEfforts: false },
  { id: 'glm-5.2-ioa', name: 'GLM-5.2', contextWindow: 1_000_000, maxTokens: 48_000, input: ['text', 'image'], ...REASONING },
  { id: 'glm-5v-turbo-ioa', name: 'GLM-5v-Turbo', contextWindow: 200_000, maxTokens: 64_000, input: ['text', 'image'], ...REASONING },
  { id: 'kimi-k3-ioa', name: 'Kimi-K3', contextWindow: 1_000_000, maxTokens: 32_000, input: ['text', 'image'], ...REASONING },
  { id: 'kimi-k2.7-ioa', name: 'Kimi-K2.7-Code', contextWindow: 256_000, maxTokens: 32_000, input: ['text', 'image'], ...REASONING },
  { id: 'kimi-k2.6-ioa', name: 'Kimi-K2.6', contextWindow: 256_000, maxTokens: 32_000, input: ['text', 'image'], ...REASONING },
  { id: 'minimax-m3-ioa', name: 'MiniMax-M3', contextWindow: 512_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'claude-opus-5', name: 'Claude-Opus-5', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'claude-sonnet-5', name: 'Claude-Sonnet-5', contextWindow: 200_000, maxTokens: 64_000, input: ['text', 'image'], ...REASONING },
  { id: 'claude-sonnet-5-1m', name: 'Claude-Sonnet-5-1M', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'claude-opus-4.8-1m', name: 'Claude-Opus-4.8 (1M context)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'claude-opus-4.8', name: 'Claude-Opus-4.8', contextWindow: 200_000, maxTokens: 64_000, input: ['text', 'image'], ...REASONING },
  { id: 'claude-opus-4.7-1m', name: 'Claude-Opus-4.7 (1M context)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'claude-opus-4.7', name: 'Claude-Opus-4.7', contextWindow: 176_000, maxTokens: 64_000, input: ['text', 'image'], ...REASONING },
  { id: 'claude-opus-4.6-1m', name: 'Claude-Opus-4.6 (1M context)', contextWindow: 1_000_000, maxTokens: 64_000, input: ['text', 'image'], reasoningEfforts: false },
  { id: 'claude-sonnet-4.6-1m', name: 'Claude-Sonnet-4.6 (1M context)', contextWindow: 1_000_000, maxTokens: 64_000, input: ['text', 'image'], reasoningEfforts: false },
  { id: 'claude-opus-4.6', name: 'Claude-Opus-4.6', contextWindow: 176_000, maxTokens: 24_000, input: ['text', 'image'], ...REASONING },
  { id: 'gpt-5.6-sol', name: 'GPT-5.6-Sol', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'gpt-5.6-terra', name: 'GPT-5.6-Terra', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'gpt-5.6-luna', name: 'GPT-5.6-Luna', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'gpt-5.5', name: 'GPT-5.5', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'gpt-5.4', name: 'GPT-5.4', contextWindow: 272_000, maxTokens: 72_000, input: ['text', 'image'], ...REASONING },
  { id: 'gpt-5.3-codex', name: 'GPT-5.3-Codex', contextWindow: 272_000, maxTokens: 72_000, input: ['text', 'image'], ...REASONING },
  { id: 'gemini-3.5-flash', name: 'Gemini-3.5-Flash', contextWindow: 1_000_000, maxTokens: 65_536, input: ['text', 'image'], ...REASONING },
  { id: 'deepseek-v4-flash-ioa', name: 'Deepseek-V4-Flash', contextWindow: 1_000_000, maxTokens: 50_000, input: ['text', 'image'], ...REASONING },
  { id: 'deepseek-v4-pro-ioa', name: 'Deepseek-V4-Pro-0813', contextWindow: 1_000_000, maxTokens: 50_000, input: ['text', 'image'], ...REASONING },
]
