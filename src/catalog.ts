/**
 * The Tencent CodeBuddy fixed model catalog. The provider endpoint does not
 * expose an OpenAI-compatible `/models` listing, so this package owns the
 * deployment's official model facts instead of reading the local CodeBuddy
 * desktop cache. The entries are the chat models the Tencent internal gateway
 * serves, projected from a captured desktop-client cache: every `craft`,
 * `ask`, and `plan` chat-model id with its display name, context window,
 * output cap, and image support. The projection reads the cache's
 * `maxInputTokens` as the context window, caps its `maxOutputTokens` at
 * 128000 (the client also reports provider-internal ceilings up to 1M), and
 * drops the `supportsExtra` helper models (`completion-gf`,
 * `codewise-rewrite`, `codewise-jump`) and the text-to-image entry, which are
 * not chat routes, and the gated `hy-hr` route, whose L4 HR data the gateway
 * refuses without that clearance — listing it would only offer a model whose
 * every request fails. The `glm-5.3-flash`, `gpt-6-sol`, and `gpt-6-luna`
 * routes were also verified against the chat gateway. The two GPT-6 routes
 * have no available capability metadata, so their advertised limits and
 * modalities are deliberately conservative.
 *
 * Names carry the client's credit multiplier (`x0.67`) when known: a Harness
 * selector renders the display name and nothing else, so what a model costs
 * has to travel there to be visible where the model is chosen.
 *
 * Configuration layers over it: a `models` list in the plugin config or the
 * `llm-tencent-codebuddy` settings section replaces this catalog wholesale.
 * Catalog edits stay in `settings.yaml` or Cordis config; the Settings page
 * stores the key and the catalog override.
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
  { id: 'auto', name: 'Auto', contextWindow: 256_000, maxTokens: 32_000, input: ['text', 'image'], ...REASONING },
  { id: 'hy4-preview-ioa', name: 'Hy4 preview (x0.29)', contextWindow: 1_000_000, maxTokens: 64_000, input: ['text', 'image'], ...REASONING },
  { id: 'hy3-ioa', name: 'Hy3 (x0.00)', contextWindow: 192_000, maxTokens: 64_000, input: ['text', 'image'], ...REASONING },
  { id: 'deepseek-v4.1-flash-ioa', name: 'Deepseek-V4.1-Flash (x0.11)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'deepseek-v4-pro-ioa', name: 'Deepseek-V4-Pro (x0.51)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'echo', name: 'Echo (x0.00)', contextWindow: 238_000, maxTokens: 24_000, input: ['text'], ...REASONING },
  { id: 'glm-5.3-ioa', name: 'GLM-5.3 (x0.79)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'glm-5.3-flash', name: 'GLM-5.3-Flash (glm-5.3-flash)', contextWindow: 1_000_000, maxTokens: 48_000, input: ['text', 'image'], ...REASONING },
  { id: 'glm-5.3-flash-ioa', name: 'GLM-5.3-Flash (x0.06)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'glm-5.3-flashx-ioa', name: 'GLM-5.3-FlashX (x0.14)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'glm-5.2-ioa', name: 'GLM-5.2 (x0.79)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'glm-5v-turbo-ioa', name: 'GLM-5v-Turbo (x0.71)', contextWindow: 200_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'kimi-k3-ioa', name: 'Kimi-K3 (x1.62)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'kimi-k2.8-preview', name: 'Kimi-K2.8-Preview (x0.77)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'kimi-k2.7-ioa', name: 'Kimi-K2.7-Code (x0.65)', contextWindow: 256_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'kimi-k2.6-ioa', name: 'Kimi-K2.6 (x0.59)', contextWindow: 256_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'minimax-m3-ioa', name: 'MiniMax-M3 (x0.25)', contextWindow: 512_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'claude-opus-5.5', name: 'Claude-Opus-5.5 (x2.17)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'claude-opus-5', name: 'Claude-Opus-5 (x3.33)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'claude-sonnet-5', name: 'Claude-Sonnet-5 (x1.33)', contextWindow: 200_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'claude-sonnet-5-1m', name: 'Claude-Sonnet-5-1M (x1.33)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'claude-opus-4.8-1m', name: 'Claude-Opus-4.8 (1M context) (x3.33)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'claude-opus-4.8', name: 'Claude-Opus-4.8 (x3.33)', contextWindow: 400_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'claude-opus-4.7-1m', name: 'Claude-Opus-4.7 (1M context) (x3.33)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'claude-opus-4.7', name: 'Claude-Opus-4.7 (x3.33)', contextWindow: 400_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'claude-opus-4.6-1m', name: 'Claude-Opus-4.6 (1M context) (x3.33)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], reasoningEfforts: false },
  { id: 'claude-sonnet-4.6-1m', name: 'Claude-Sonnet-4.6 (1M context) (x2.00)', contextWindow: 1_000_000, maxTokens: 65_536, input: ['text', 'image'], reasoningEfforts: false },
  { id: 'claude-opus-4.6', name: 'Claude-Opus-4.6 (x3.33)', contextWindow: 176_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'gpt-6-astra', name: 'GPT-6-Astra (x6.67)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'gpt-6-sol', name: 'GPT-6-Sol (x1.33)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'gpt-6-luna', name: 'GPT-6-Luna (x0.07)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'gpt-5.6-sol', name: 'GPT-5.6-Sol (x3.47)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'gpt-5.6-terra', name: 'GPT-5.6-Terra (x1.39)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'gpt-5.6-luna', name: 'GPT-5.6-Luna (x0.14)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'gpt-5.5', name: 'GPT-5.5 (x3.31)', contextWindow: 1_000_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'gpt-5.4', name: 'GPT-5.4 (x1.65)', contextWindow: 272_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'gpt-5.3-codex', name: 'GPT-5.3-Codex (x1.25)', contextWindow: 272_000, maxTokens: 128_000, input: ['text', 'image'], ...REASONING },
  { id: 'gemini-3.5-flash', name: 'Gemini-3.5-Flash (x0.99)', contextWindow: 1_000_000, maxTokens: 65_536, input: ['text', 'image'], ...REASONING },
  { id: 'claude-haiku-4.5', name: 'Claude-Haiku-4.5 (x0.67)', contextWindow: 176_000, maxTokens: 24_000, input: ['text', 'image'], ...REASONING },
]
