/**
 * Upstream model catalog for the Tencent CodeBuddy route: the list the official
 * client itself reads from the cloud product configuration.
 *
 * `GET /v3/config` answers 200 with `data.models: null` when it is called
 * without a credential; an account token makes the deployment's own list come
 * down, which is why a model that the gateway starts serving needs no release
 * of this package. The entries carry ids and capacities but none of the
 * per-model detail the desktop client's cache records (credit multipliers,
 * image and reasoning support), so a caller may enrich them from
 * {@link readLocalCatalog} — the ids are the upstream truth, the metadata is
 * whatever this machine already knows.
 *
 * Read failures never throw: an unreachable endpoint, a non-zero `code`, or an
 * unrecognized body yields `undefined` and the caller keeps its previous list.
 *
 * @module dsh-llm-tencent-codebuddy/upstream-catalog
 */

import type { PiAiModelProfile } from '@deepseek-ai/dsh-llm-pi-ai'

/** Cloud product configuration endpoint; the same one the official client reads. */
export const TENCENT_CODEBUDDY_CONFIG_URL = 'https://copilot.tencent.com/v3/config'

/** How long one upstream read is reused before asking again. */
export const TENCENT_CODEBUDDY_REFRESH_MS = 600_000

/** How long the product configuration may take before the read is abandoned. */
export const TENCENT_CODEBUDDY_CONFIG_TIMEOUT_MS = 15_000

/** Output capability the gateway reports for provider-internal reasons beyond any chat ceiling. */
const MAX_OUTPUT_TOKENS = 128_000

/** Output capability assumed when upstream names none. */
const DEFAULT_OUTPUT_TOKENS = 32_768

/**
 * Tags naming a route the chat endpoint cannot serve: image and video
 * generation are dispatched elsewhere, so listing them only offers a model
 * whose every request fails.
 */
export const NON_CHAT_TAGS = /text-to-image|image-to-image|text-to-video|image-to-video/i

/** One model as the product configuration records it. The endpoint owns this shape. */
interface UpstreamModel {
  readonly id?: unknown
  readonly maxInputTokens?: unknown
  readonly maxOutputTokens?: unknown
  readonly supportsImages?: unknown
  readonly supportsReasoning?: unknown
  readonly supportsToolCall?: unknown
  readonly supportsExtra?: unknown
  readonly tags?: readonly unknown[] | null
  readonly contextWindow?: { readonly defaultLength?: unknown } | null
}

/** Headers the official CLI sends to this gateway. */
export const TENCENT_CODEBUDDY_UPSTREAM_HEADERS: Readonly<Record<string, string>> = {
  'user-agent': 'CLI/2.113.0 CodeBuddy/2.113.0',
  'x-product': 'SaaS',
  'x-requested-with': 'XMLHttpRequest',
  'x-codebuddy-request': '1',
  'x-ide-type': 'CLI',
  'x-ide-name': 'CLI',
  'x-ide-version': '2.113.0',
  accept: 'application/json',
}

/** @param value - candidate JSON value. @returns the positive integer it holds, or undefined. */
function numberOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined
}

/**
 * Project one upstream entry, preferring what this machine already knows.
 * @param model - entry as the product configuration records it.
 * @param known - the same id from the desktop client's richer cache, when present.
 * @returns the chat-route profile, or undefined when the entry is not one.
 */
function profileOf(model: UpstreamModel, known: PiAiModelProfile | undefined): PiAiModelProfile | undefined {
  const id = typeof model.id === 'string' ? model.id : undefined
  if (id === undefined || id === '') return undefined
  if ((model.tags ?? []).some(tag => typeof tag === 'string' && NON_CHAT_TAGS.test(tag))) return undefined
  if (model.supportsExtra === true) return undefined
  if (model.supportsToolCall === false) return undefined
  // The client's cache carries the credit multiplier, the capability flags and
  // the output cap; upstream carries the context window and the id. Take what
  // matches and fill the rest from whichever side has it.
  const upstreamWindow = numberOf(model.maxInputTokens) ?? numberOf(model.contextWindow?.defaultLength)
  const contextWindow = upstreamWindow ?? known?.contextWindow
  if (contextWindow === undefined) return undefined
  const maxTokens = Math.min(
    numberOf(model.maxOutputTokens) ?? known?.maxTokens ?? DEFAULT_OUTPUT_TOKENS,
    MAX_OUTPUT_TOKENS,
  )
  // A known entry's display name already carries the client's credit multiplier
  // (`x0.67`), because a Harness selector renders the display name alone; an id
  // upstream serves without local detail keeps its bare id.
  return {
    id,
    name: known?.name ?? id,
    contextWindow,
    maxTokens,
    input: known?.input ?? (model.supportsImages === true ? ['text', 'image'] : ['text']),
    ...known?.reasoningEfforts !== undefined
      ? { reasoningEfforts: known.reasoningEfforts, ...known.compat === undefined ? {} : { compat: known.compat } }
      : model.supportsReasoning === true
        ? {
            reasoningEfforts: { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
            compat: { thinkingFormat: 'openai' as const, supportsReasoningEffort: true },
          }
        : { reasoningEfforts: false as const },
  }
}

/**
 * Project one `/v3/config` body.
 * @param payload - parsed response body.
 * @param known - this machine's catalog by id, for metadata upstream omits.
 * @returns the projected chat catalog, or undefined when upstream names none.
 */
export function projectUpstreamCatalog(
  payload: unknown,
  known: ReadonlyMap<string, PiAiModelProfile> = new Map(),
): readonly PiAiModelProfile[] | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  const body = payload as { code?: unknown; data?: { models?: unknown } }
  // A non-zero code means the gateway answered without the list this read wants.
  if (body.code !== undefined && body.code !== 0) return undefined
  const raw = body.data?.models
  if (!Array.isArray(raw)) return undefined
  const models: PiAiModelProfile[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const model = entry as UpstreamModel
    const id = typeof model.id === 'string' ? model.id : ''
    if (id === '' || seen.has(id)) continue
    const profile = profileOf(model, known.get(id))
    if (profile === undefined) continue
    seen.add(id)
    models.push(profile)
  }
  return models.length > 0 ? models : undefined
}

/**
 * Read the deployment's model list.
 * @param token - account credential sent as a bearer token; upstream omits the list without one.
 * @param known - this machine's catalog by id, for metadata upstream omits.
 * @param fetchImpl - fetch implementation, injectable for tests.
 * @returns the projected catalog, or undefined when upstream named none.
 */
export async function fetchUpstreamCatalog(
  token: string,
  known: ReadonlyMap<string, PiAiModelProfile> = new Map(),
  fetchImpl: typeof fetch = fetch,
): Promise<readonly PiAiModelProfile[] | undefined> {
  try {
    const response = await fetchImpl(TENCENT_CODEBUDDY_CONFIG_URL, {
      method: 'GET',
      headers: { ...TENCENT_CODEBUDDY_UPSTREAM_HEADERS, authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TENCENT_CODEBUDDY_CONFIG_TIMEOUT_MS),
    })
    if (!response.ok) return undefined
    return projectUpstreamCatalog(await response.json(), known)
  } catch {
    return undefined
  }
}
