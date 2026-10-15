/**
 * Signed model catalog the tt-switch binary itself reads.
 *
 * tt-switch hardcodes one URL as the single source for the Tencent model list:
 * a release file carrying a signed envelope — `schemaVersion`, `algorithm`
 * (`HMAC-SHA256+BASE64-PAYLOAD`), a Base64 `payload` and its `signature`. The
 * payload is the catalogue proper: `revision`, `updatedAt`, `models` (each with
 * `displayName`, `maxInputTokens`, `maxOutputTokens`, `supportsReasoning`,
 * `supportsImages`, `supportsTools`, `temperature`, `costMultiplier`, …), plus
 * `managedModelIds` and `modelFallbacks`.
 *
 * Unlike `/v3/config` — which answers with `data.models: null` until a
 * credential is stored — and unlike the desktop client's cache, which needs the
 * client installed, this read needs nothing from this machine. It is the list
 * the machine starts out with, so it outranks both and sits directly beneath a
 * catalog the user edited by hand.
 *
 * `managedModelIds` and `modelFallbacks` travel with the result for
 * diagnostics only. A curated whitelist and a retirement map are decisions for
 * the deployment: a route has to keep serving whatever id the gateway still
 * answers, and silently rewriting a model the user picked is worse than letting
 * a retired id fail where the user can see it.
 *
 * The signature is checked only when a key is configured. The envelope says
 * HMAC-SHA256 but the signing key is deployment-owned and this package ships
 * none: with no key the read is trusted on the strength of HTTPS alone and
 * {@link TtSwitchCatalog.signatureVerified} stays `undefined`, which the caller
 * reports. With a key, a mismatch rejects the whole catalogue instead of
 * serving a list that may have been altered. The signed bytes are taken to be
 * the Base64 payload text — the only input both sides hold verbatim.
 *
 * Read failures never throw: an unreachable host, an unrecognized envelope, a
 * bad signature or an empty list yields `{ ok: false }` with the reason, and
 * the caller keeps its previous catalog.
 *
 * @module dsh-llm-tencent-codebuddy/tt-switch-catalog
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { PiAiModelProfile } from '@deepseek-ai/dsh-llm-pi-ai'

/** The single catalogue URL tt-switch hardcodes. */
export const TT_SWITCH_CATALOG_URL =
  'https://cnb.woa.com/tt-switch/tt-switch/-/git/raw/master/releases/tencent_models.json'

/** How long one read is reused before asking again. */
export const TT_SWITCH_REFRESH_MS = 600_000

/** How long one read may take before it is abandoned. */
export const TT_SWITCH_TIMEOUT_MS = 15_000

/** The envelope algorithm this module can read. */
export const TT_SWITCH_ALGORITHM = 'HMAC-SHA256+BASE64-PAYLOAD'

/** Output capability the gateway reports for provider-internal reasons beyond any chat ceiling. */
const MAX_OUTPUT_TOKENS = 128_000

/** Output capability assumed when the catalogue names none. */
const DEFAULT_OUTPUT_TOKENS = 32_768

/** The reasoning ladder a reasoning-capable route advertises. */
const REASONING_EFFORTS = {
  reasoningEfforts: {
    low: 'low',
    medium: 'medium',
    high: 'high',
    xhigh: 'xhigh',
    max: 'max',
  },
  compat: { thinkingFormat: 'openai' as const, supportsReasoningEffort: true },
}

/** One catalogue read: the projected models plus everything worth reporting. */
export interface TtSwitchCatalog {
  /** Models this route can serve, in catalogue order. */
  readonly models: readonly PiAiModelProfile[]
  /** Monotonic catalogue revision, when the payload named one. */
  readonly revision: number | undefined
  /** Catalogue build time, when the payload named one. */
  readonly updatedAt: string | undefined
  /** The deployment's managed-model whitelist. Diagnostics only: never filters. */
  readonly managedModelIds: readonly string[]
  /** Retired id → replacement id. Diagnostics only: never rewrites. */
  readonly modelFallbacks: Readonly<Record<string, string>>
  /**
   * `true` when a configured key matched the signature, `false` when it did
   * not (the read is rejected in that case, so a `false` never escapes
   * {@link fetchTtSwitchCatalog}), and `undefined` when no key is configured
   * and the signature was left unchecked.
   */
  readonly signatureVerified: boolean | undefined
}

/** The signed envelope. The release file owns this shape. */
interface Envelope {
  readonly schemaVersion?: unknown
  readonly algorithm?: unknown
  readonly payload?: unknown
  readonly signature?: unknown
}

/** One model as the catalogue records it. The release file owns this shape. */
interface TtSwitchModel {
  readonly id?: unknown
  readonly displayName?: unknown
  readonly maxInputTokens?: unknown
  readonly maxOutputTokens?: unknown
  readonly supportsReasoning?: unknown
  readonly supportsImages?: unknown
  readonly supportsTools?: unknown
  readonly costMultiplier?: unknown
}

/**
 * Check the envelope signature.
 * @param payload - the Base64 payload text, byte for byte as published.
 * @param signature - the signature the envelope carries.
 * @param key - HMAC key. `undefined`/empty means "no key": nothing is checked.
 * @returns whether the signature matched, or `undefined` when nothing was checked.
 */
export function verifySignature(
  payload: string,
  signature: string,
  key: string | undefined,
): boolean | undefined {
  if (key === undefined || key === '' || signature === '') return undefined
  const expected = Buffer.from(signature, 'base64')
  const actual = createHmac('sha256', key).update(payload).digest()
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/** @param value - candidate JSON value. @returns the positive integer it holds, or undefined. */
function numberOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined
}

/** @param value - candidate JSON value. @returns the non-empty string it holds, or undefined. */
function textOf(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/**
 * Read a field published as a number today but rendered as text, such as
 * `costMultiplier` (`"1.33"`).
 * @param value - candidate JSON value.
 * @returns its text, a finite number rendered as text, or undefined.
 */
function textish(value: unknown): string | undefined {
  const text = textOf(value)
  if (text !== undefined) return text
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : undefined
}

/**
 * Project one catalogue entry.
 * @param model - entry as the release file records it.
 * @returns the chat-route profile, or undefined when the entry is not one.
 */
function profileOf(model: TtSwitchModel): PiAiModelProfile | undefined {
  const id = textOf(model.id)
  if (id === undefined) return undefined
  // An agent turn is driven through tools, so a route without them can only fail.
  if (model.supportsTools === false) return undefined
  const contextWindow = numberOf(model.maxInputTokens)
  if (contextWindow === undefined) return undefined
  const maxTokens = Math.min(numberOf(model.maxOutputTokens) ?? DEFAULT_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS)
  const multiplier = textish(model.costMultiplier)
  // A Harness selector renders the display name and nothing else, so what a
  // model costs has to travel there to be visible where the model is chosen.
  const name = multiplier === undefined
    ? (textOf(model.displayName) ?? id)
    : `${textOf(model.displayName) ?? id} (x${multiplier})`
  return {
    id,
    name,
    contextWindow,
    maxTokens,
    input: model.supportsImages === true ? ['text', 'image'] : ['text'],
    ...model.supportsReasoning === true ? REASONING_EFFORTS : { reasoningEfforts: false as const },
  }
}

/**
 * Project one signed release file.
 * @param body - parsed response body.
 * @param key - HMAC key; empty leaves the signature unchecked.
 * @returns the projected catalogue, or undefined when nothing usable came down.
 */
export function projectTtSwitchCatalog(body: unknown, key = ''): TtSwitchCatalog | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const envelope = body as Envelope
  const payloadText = textOf(envelope.payload)
  if (payloadText === undefined) return undefined
  const signature = typeof envelope.signature === 'string' ? envelope.signature : ''
  const verified = verifySignature(payloadText, signature, key)
  // A configured key that does not match means the list may have been altered;
  // serve the previous one rather than the possible forgery.
  if (verified === false) return undefined
  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(payloadText, 'base64').toString('utf8'))
  } catch {
    return undefined
  }
  if (typeof payload !== 'object' || payload === null) return undefined
  const raw = (payload as { models?: unknown }).models
  if (!Array.isArray(raw)) return undefined
  const models: PiAiModelProfile[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const profile = profileOf(entry as TtSwitchModel)
    if (profile === undefined || seen.has(profile.id)) continue
    seen.add(profile.id)
    models.push(profile)
  }
  if (models.length === 0) return undefined
  const source = payload as {
    revision?: unknown
    updatedAt?: unknown
    managedModelIds?: unknown
    modelFallbacks?: unknown
  }
  const fallbacks: Record<string, string> = {}
  if (typeof source.modelFallbacks === 'object' && source.modelFallbacks !== null) {
    for (const [from, to] of Object.entries(source.modelFallbacks as Record<string, unknown>)) {
      if (typeof to === 'string' && to !== '') fallbacks[from] = to
    }
  }
  return {
    models,
    revision: numberOf(source.revision),
    updatedAt: textOf(source.updatedAt),
    managedModelIds: Array.isArray(source.managedModelIds)
      ? source.managedModelIds.filter((id): id is string => typeof id === 'string')
      : [],
    modelFallbacks: fallbacks,
    signatureVerified: verified,
  }
}

/** Outcome of one read: the catalogue, or why there is none. */
export type TtSwitchRead =
  | { readonly ok: true; readonly catalog: TtSwitchCatalog }
  | { readonly ok: false; readonly reason: string }

/**
 * Read the signed catalogue.
 * @param options.key - HMAC key; empty leaves the signature unchecked.
 * @param options.fetchImpl - fetch implementation, injectable for tests.
 * @returns the projected catalogue, or why the read yielded none. Never throws;
 * the reason travels with the result so the caller can report it instead of
 * silently serving a stale list.
 */
export async function fetchTtSwitchCatalog(
  options: { readonly key?: string; readonly fetchImpl?: typeof fetch } = {},
): Promise<TtSwitchRead> {
  let response: Response
  try {
    response = await (options.fetchImpl ?? fetch)(TT_SWITCH_CATALOG_URL, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TT_SWITCH_TIMEOUT_MS),
    })
  } catch (error) {
    return { ok: false, reason: `${TT_SWITCH_CATALOG_URL} unreachable: ${String((error as Error)?.message ?? error)}` }
  }
  if (!response.ok) return { ok: false, reason: `${TT_SWITCH_CATALOG_URL} answered HTTP ${String(response.status)}` }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { ok: false, reason: `${TT_SWITCH_CATALOG_URL} did not answer with JSON` }
  }
  const catalog = projectTtSwitchCatalog(body, options.key ?? '')
  // Empty, malformed, or carrying a signature the configured key does not match.
  if (catalog === undefined) return { ok: false, reason: `${TT_SWITCH_CATALOG_URL} carried no usable catalog` }
  return { ok: true, catalog }
}
