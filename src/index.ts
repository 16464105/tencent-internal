/**
 * Tencent CodeBuddy provider for the Harness LLM seam. The package owns one
 * fixed route, `tencent-internal`, with a fixed OpenAI Chat Completions
 * endpoint, the request normalization observed from the CodeBuddy client, and
 * a package-owned fixed model catalog. Configuration layers a `models` list
 * over that catalog; the Settings → CodeBuddy page stores the key and the catalog override.
 */

import type { Context, Fiber } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
// Type-only: pulls the settings Context merge (ctx.settings) into this program.
import type {} from '@deepseek-ai/dsh-settings'
import {
  assertUsableApiKey,
  LlmError,
  RetryPolicySchema,
  type RetryPolicyConfig,
} from '@deepseek-ai/dsh-llm'
import {
  PiAiAdapter,
  authContextFrom,
  credentialStoreFrom,
  resolveProfiles,
  type PiAiModelProfile,
  type ResolvedPiAiProviderProfile,
} from '@deepseek-ai/dsh-llm-pi-ai'
// The harness pi-ai plugin exports its auth factories and profile resolver from
// the package root. Reaching into `@deepseek-ai/dsh-llm-pi-ai/src/*.ts` only
// works inside the originating monorepo: a packaged Harness ships `lib/` alone,
// so those subpath imports fail to resolve in an installed app.
import { deepEqualJson } from '@deepseek-ai/dsh-util-values'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import { TENCENT_CODEBUDDY_MODELS } from './catalog.ts'
import { readLocalCatalog } from './local-catalog.ts'
import { ROUTE_HEADERS, TENCENT_CODEBUDDY_BASE_URL } from './tencent-request.ts'
import { fetchUpstreamCatalog, TENCENT_CODEBUDDY_REFRESH_MS } from './upstream-catalog.ts'

export const name = 'llm-tencent-codebuddy'
export const inject = ['llm']

/** Provider route exposed to Harness model selectors. */
export const TENCENT_CODEBUDDY_PROVIDER = 'tencent-internal'
/** Default Tencent internal model selected by this bundle's profile patch. */
export const TENCENT_CODEBUDDY_MODEL = 'hy3-ioa'
/** Credential reference written by the Settings → CodeBuddy page for this route. */
export const TENCENT_CODEBUDDY_API_KEY = 'TENCENT_CODEBUDDY_API_KEY'

const NS = 'llm-tencent-codebuddy'
const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000

/** Provider configuration. Endpoint, protocol, headers, and catalog stay package-owned. */
export interface Config {
  /** Credential reference resolved per request. */
  apiKeyEnv?: string
  /**
   * Model catalog served by this route. Omission serves the package's fixed
   * catalog unchanged; an explicit list replaces it. Catalog edits stay in
   * `settings.yaml` or Cordis config; the Settings page stores the key and the catalog.
   */
  models?: PiAiModelProfile[]
  /** HTTP/provider SDK timeout in milliseconds. */
  timeoutMs?: number
  /** Maximum provider idle time while one stream read is outstanding. */
  streamIdleTimeoutMs?: number
  /** Provider-owned model-request retry policy. */
  retryPolicy?: RetryPolicyConfig
}

/** The reasoning-effort dict schema, mirroring pi-ai's own profile schema. */
const reasoningEfforts = z.dict(
  z.union([z.string(), z.const(null)]),
  z.union(['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']),
) as unknown as z<NonNullable<PiAiModelProfile['reasoningEfforts']>>

/** One catalog entry's schema, typed like the DeepSeek adapter's `catalogModel`. */
const modelProfile = z.object({
  id: z.string().required(),
  name: z.string(),
  contextWindow: z.number().step(1).min(1),
  maxTokens: z.number().step(1).min(1),
  input: z.array(z.union(['text', 'image'])),
  reasoningEfforts: z.union([z.const(false), reasoningEfforts]),
  compat: z.object({
    thinkingFormat: z.union(['openai', 'deepseek', 'openrouter', 'together', 'zai', 'qwen', 'string-thinking', 'ant-ling']),
    supportsReasoningEffort: z.boolean(),
  }),
}) as z<PiAiModelProfile>

/** Runtime schema for {@link Config}. */
export const Config: z<Config> = z.object({
  // dsh ≥ 0.1.7 projects a plugin's Config into the Settings service from its
  // volatile fields alone. A non-volatile field is invisible to the forms API:
  // the `llm-tencent-codebuddy` namespace would never be described (the page
  // then reports a missing section) and writes to it would be refused. These
  // two fields are the ones the Settings → CodeBuddy page edits live.
  apiKeyEnv: z.string().role('credential-ref').default(TENCENT_CODEBUDDY_API_KEY).volatile(),
  // The fixed catalog is the schema default: an absent field materializes
  // the whole directory, an explicit empty list clears it (same contract as
  // the direct DeepSeek adapter's advisory catalog), and a list replaces it.
  models: z.array(modelProfile).default([...TENCENT_CODEBUDDY_MODELS]).volatile(),
  timeoutMs: z.natural(),
  streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS)
    .default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
  retryPolicy: RetryPolicySchema,
})

/**
 * Read one config field, resolving the live reference a volatile schema field
 * wraps. Programmatic configs (tests, direct installs) pass plain values.
 * @param value - configured value, volatile or plain.
 * @returns the underlying value.
 */
function valueOf<T>(value: T | { readonly get: () => T }): T {
  const reference = value as { readonly get?: () => T } | null
  return typeof reference === 'object' && reference !== null && typeof reference.get === 'function'
    ? reference.get()
    : value as T
}

/**
 * Detach every field of a config so a live edit is observable by identity.
 * @param config - plugin config, volatile fields included.
 * @returns one plain config.
 */
function snapshotOf(config: Config): Config {
  return {
    apiKeyEnv: valueOf(config.apiKeyEnv),
    models: valueOf(config.models),
    timeoutMs: valueOf(config.timeoutMs),
    streamIdleTimeoutMs: valueOf(config.streamIdleTimeoutMs),
    retryPolicy: valueOf(config.retryPolicy),
  }
}

/**
 * The catalog this route serves. An explicit configured list wins outright; a
 * configuration that still carries the shipped default is served the
 * deployment's own list — upstream `/v3/config` when this machine holds a
 * credential for it, else the local CodeBuddy client's cache, else the shipped
 * projection — so a model the gateway starts serving needs no edit here, and a
 * machine with neither source keeps a checked-in answer.
 * @param configured - `models` from the current config snapshot.
 * @param upstream - the last successful `/v3/config` read, when there is one.
 * @returns the models to register.
 */
function effectiveCatalog(
  configured: readonly PiAiModelProfile[] | undefined,
  upstream: readonly PiAiModelProfile[] | undefined,
): readonly PiAiModelProfile[] {
  if (configured !== undefined && !deepEqualJson(configured, TENCENT_CODEBUDDY_MODELS)) return configured
  return upstream ?? readLocalCatalog() ?? TENCENT_CODEBUDDY_MODELS
}

function profileFrom(
  config: Config,
  models: readonly PiAiModelProfile[],
): ReadonlyMap<string, ResolvedPiAiProviderProfile> {
  return resolveProfiles({
    [TENCENT_CODEBUDDY_PROVIDER]: {
      apiKeyEnv: config.apiKeyEnv ?? TENCENT_CODEBUDDY_API_KEY,
      displayName: 'Tencent CodeBuddy',
      api: 'openai-completions',
      baseURL: TENCENT_CODEBUDDY_BASE_URL,
      models: [...models],
      // The Harness sends a route's configured headers on every request; this
      // is the only place this version carries the CodeBuddy fingerprint, the
      // option an older adapter exposed for it having been removed. The
      // per-request ids the CLI also sends cannot be expressed here and the
      // gateway serves requests without them.
      headers: { ...ROUTE_HEADERS },
      ...config.timeoutMs === undefined ? {} : { timeoutMs: config.timeoutMs },
      streamIdleTimeoutMs: config.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS,
      ...config.retryPolicy === undefined ? {} : { retryPolicy: config.retryPolicy },
    },
  })
}

/**
 * The Settings seam across Host versions. dsh 0.1.7 removed `installSection`
 * and derives a section from the plugin entry's Config instead, leaving
 * `configure` to turn the generated page off for a package that ships its own.
 */
interface SettingsSeam {
  installSection?: (
    owner: Context,
    ns: string,
    schema: z<Config>,
    config: Config,
    hooks: { setSource(source: () => Config): void; onChange(): void },
  ) => void
  configure(presentation: { auto?: boolean }, owner: Fiber): () => void
}

/**
 * Register the Tencent route with its fixed catalog and key-only settings namespace.
 * @param ctx - Cordis context carrying `llm` and optional `settings`/`credentials`.
 * @param config - schema-normalized plugin config.
 * @returns nothing; registration lives on the fiber.
 */
export function apply(ctx: Context, config: Config): void {
  let current: () => Config = () => config
  let cached: {
    readonly key: readonly unknown[]
    readonly profiles: ReadonlyMap<string, ResolvedPiAiProviderProfile>
  } | undefined
  let syncRegistration: (() => void) | undefined
  let announced: readonly PiAiModelProfile[] | undefined
  // Resolution is synchronous and a refresh may take seconds, so the upstream
  // read runs in the background and the route keeps serving its last good list
  // while one is in flight. A read starts when the cached one is older than
  // TENCENT_CODEBUDDY_REFRESH_MS and a credential exists; without one the local
  // client's cache answers instead.
  let upstream: readonly PiAiModelProfile[] | undefined
  let upstreamAt = 0
  let upstreamPending = false
  const refreshUpstream = async (): Promise<void> => {
    if (upstreamPending || Date.now() - upstreamAt < TENCENT_CODEBUDDY_REFRESH_MS) return
    upstreamPending = true
    let attempted = false
    try {
      const ref = credentialRef(snapshotOf(current()).apiKeyEnv ?? TENCENT_CODEBUDDY_API_KEY)
      const credentials = ctx.get('credentials')
      const value = credentials === undefined
        ? launchEnvironmentOf(ctx).get(ref)?.value
        : (await credentials.resolve(ref))?.value
      if (value === undefined || value.length === 0) return
      attempted = true
      // Upstream carries the ids; this machine's cache carries the per-model
      // detail (credit multiplier, capabilities) the entries above it lack.
      const known = new Map((readLocalCatalog() ?? []).map(model => [model.id, model]))
      const models = await fetchUpstreamCatalog(value, known)
      if (models !== undefined) upstream = models
      // A refused or unreachable read keeps the previous list.
    } catch {
      // Idem: the route keeps serving what it already has.
    } finally {
      // Only a gateway request starts the cooldown; no credential must not
      // delay discovery after the user saves a key.
      if (attempted) upstreamAt = Date.now()
      upstreamPending = false
    }
  }
  const profiles = (): ReadonlyMap<string, ResolvedPiAiProviderProfile> => {
    void refreshUpstream()
    const snapshot = snapshotOf(current())
    const models = effectiveCatalog(snapshot.models, upstream)
    if (models !== announced) {
      announced = models
      const source = models === TENCENT_CODEBUDDY_MODELS
        ? 'the shipped catalog'
        : models === upstream ? 'upstream /v3/config' : 'the local CodeBuddy client'
      ctx.logger.info(`llm-tencent-codebuddy: ${String(models.length)} models from ${source}`)
    }
    const key = [
      snapshot.apiKeyEnv, models, snapshot.timeoutMs,
      snapshot.streamIdleTimeoutMs, snapshot.retryPolicy,
    ]
    const hit = cached
    if (hit !== undefined && hit.key.every((value, index) => value === key[index])) return hit.profiles
    const next = profileFrom(snapshot, models)
    cached = { key, profiles: next }
    // A volatile edit lands without restarting the plugin, so the registration
    // facts are refreshed whenever the resolved snapshot moved.
    syncRegistration?.()
    return next
  }
  profiles()

  const resolveApiKey = async (
    _provider: string,
    profile: ResolvedPiAiProviderProfile,
  ): Promise<string> => {
    const ref = profile.apiKeyEnv ?? credentialRef(TENCENT_CODEBUDDY_API_KEY)
    const credentials = ctx.get('credentials')
    const value = credentials === undefined
      ? launchEnvironmentOf(ctx).get(ref)?.value
      : (await credentials.resolve(ref))?.value
    if (value !== undefined && value.length > 0) {
      return assertUsableApiKey(value, 'llm-tencent-codebuddy', ref)
    }
    throw new LlmError(
      `llm-tencent-codebuddy: no API key for provider route "${TENCENT_CODEBUDDY_PROVIDER}"; store ${ref}`
      + ' through the credentials service or export it in the launching environment',
      'MISSING_CREDENTIAL',
    )
  }

  const adapter = new PiAiAdapter({
    profiles,
    resolveApiKey,
    auth: { credentials: credentialStoreFrom(ctx), authContext: authContextFrom(ctx) },
    resolveAttachments: () => ctx.get('attachments'),
  })
  // The Settings → CodeBuddy page owns the key and catalog; this route is not
  // a Models card. Out-of-tree installs cannot curate `ui-settings-models`.
  const registration = ctx.llm.registerAdapter([TENCENT_CODEBUDDY_PROVIDER], adapter)
  let registeredPolicy = profiles().get(TENCENT_CODEBUDDY_PROVIDER)?.retryPolicy
  syncRegistration = (): void => {
    const next = profiles().get(TENCENT_CODEBUDDY_PROVIDER)?.retryPolicy
    if (deepEqualJson(next, registeredPolicy)) return
    registration.replace([TENCENT_CODEBUDDY_PROVIDER])
    registeredPolicy = next
  }
  ctx.inject(['settings'], (settingsCtx) => {
    const settings = settingsCtx.settings as SettingsSeam
    // ≤ 0.1.6: the Host needs an explicit section and pushes config changes
    // back through `setSource`. ≥ 0.1.7: the section is derived from this
    // entry's Config, so all that is left is keeping the Host from rendering a
    // generated page beside the page this package ships.
    if (typeof settings.installSection === 'function') {
      settings.installSection(ctx, NS, Config, config, {
        setSource: (source) => { current = source },
        onChange: () => syncRegistration?.(),
      })
      return
    }
    settingsCtx.effect(() => settings.configure({ auto: false }, ctx.fiber))
  })
}

export { normalizeTencentPayload, TENCENT_CODEBUDDY_BASE_URL, tencentRequestHeaders } from './tencent-request.ts'
