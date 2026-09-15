/**
 * Tencent CodeBuddy provider for the Harness LLM seam. The package owns one
 * fixed route, `tencent-internal`, with a fixed OpenAI Chat Completions
 * endpoint, the request normalization observed from the CodeBuddy client, and
 * a package-owned fixed model catalog. Configuration layers a `models` list
 * over that catalog, which is how the Models page edits the directory.
 */

import type { Context } from '@deepseek-ai/cordis'
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
  type PiAiModelProfile,
  type ResolvedPiAiProviderProfile,
} from '@deepseek-ai/dsh-llm-pi-ai'
// The harness pi-ai plugin keeps its auth factories and profile resolver on
// their own modules; only the adapter and its option types are package-root
// exports, so this adapter imports the submodules directly.
import { authContextFrom, credentialStoreFrom } from '@deepseek-ai/dsh-llm-pi-ai/src/auth.ts'
import { resolveProfiles } from '@deepseek-ai/dsh-llm-pi-ai/src/config.ts'
import { deepEqualJson } from '@deepseek-ai/dsh-util-values'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import { TENCENT_CODEBUDDY_MODELS } from './catalog.ts'
import {
  normalizeTencentPayload,
  TENCENT_CODEBUDDY_BASE_URL,
  tencentRequestHeaders,
} from './tencent-request.ts'

export const name = 'llm-tencent-codebuddy'
export const inject = ['llm']

/** Provider route exposed to Harness model selectors. */
export const TENCENT_CODEBUDDY_PROVIDER = 'tencent-internal'
/** Default Tencent internal model selected by this bundle's profile patch. */
export const TENCENT_CODEBUDDY_MODEL = 'gpt-5.6-sol'
/** Credential reference written by the Models page for this route. */
export const TENCENT_CODEBUDDY_API_KEY = 'TENCENT_CODEBUDDY_API_KEY'

const NS = 'llm-tencent-codebuddy'
const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000

/** Provider configuration. Endpoint, protocol, headers, and catalog stay package-owned. */
export interface Config {
  /** Credential reference resolved per request. */
  apiKeyEnv?: string
  /**
   * Model catalog served by this route. Omission serves the package's fixed
   * catalog unchanged; an explicit list replaces it. The Models page writes
   * the full list when the user customizes the directory.
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
  apiKeyEnv: z.string().role('credential-ref').default(TENCENT_CODEBUDDY_API_KEY),
  // The fixed catalog is the schema default: an absent field materializes
  // the whole directory, an explicit empty list clears it (same contract as
  // the direct DeepSeek adapter's advisory catalog), and a list replaces it.
  models: z.array(modelProfile).default([...TENCENT_CODEBUDDY_MODELS]),
  timeoutMs: z.natural(),
  streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS)
    .default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
  retryPolicy: RetryPolicySchema,
})

function profileFrom(
  config: Config,
): ReadonlyMap<string, ResolvedPiAiProviderProfile> {
  return resolveProfiles({
    [TENCENT_CODEBUDDY_PROVIDER]: {
      apiKeyEnv: config.apiKeyEnv ?? TENCENT_CODEBUDDY_API_KEY,
      displayName: 'Tencent CodeBuddy',
      api: 'openai-completions',
      baseURL: TENCENT_CODEBUDDY_BASE_URL,
      // Schema-normalized configs always carry the materialized list (the
      // fixed catalog or an explicit replacement); the fallback covers a raw
      // programmatic config that bypassed the schema.
      models: config.models ?? [...TENCENT_CODEBUDDY_MODELS],
      ...config.timeoutMs === undefined ? {} : { timeoutMs: config.timeoutMs },
      streamIdleTimeoutMs: config.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS,
      ...config.retryPolicy === undefined ? {} : { retryPolicy: config.retryPolicy },
    },
  })
}

/** Register the Tencent route with its fixed catalog and key-only settings namespace. */
export function apply(ctx: Context, config: Config): void {
  let current: () => Config = () => config
  let lastRaw: Config | undefined
  let lastProfiles: ReadonlyMap<string, ResolvedPiAiProviderProfile> | undefined
  const profiles = (): ReadonlyMap<string, ResolvedPiAiProviderProfile> => {
    const raw = current()
    if (raw === lastRaw && lastProfiles !== undefined) return lastProfiles
    lastRaw = raw
    lastProfiles = profileFrom(raw)
    return lastProfiles
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
    prepareRequest: ({ options }) => ({
      headers: tencentRequestHeaders(options),
      onPayload: normalizeTencentPayload,
    }),
  })
  ctx.llm.registerConfigurableProviders([{
    provider: TENCENT_CODEBUDDY_PROVIDER,
    displayName: 'Tencent CodeBuddy',
    settingsNs: NS,
    settingsPath: [],
  }])
  const registration = ctx.llm.registerAdapter([TENCENT_CODEBUDDY_PROVIDER], adapter)
  let registeredPolicy = profiles().get(TENCENT_CODEBUDDY_PROVIDER)?.retryPolicy
  const ensureRegistrationFacts = (): void => {
    const next = profiles().get(TENCENT_CODEBUDDY_PROVIDER)?.retryPolicy
    if (deepEqualJson(next, registeredPolicy)) return
    registration.replace([TENCENT_CODEBUDDY_PROVIDER])
    registeredPolicy = next
  }
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, NS, Config, config, {
      setSource: (source) => { current = source },
      onChange: ensureRegistrationFacts,
    })
  })
}

export { normalizeTencentPayload, TENCENT_CODEBUDDY_BASE_URL, tencentRequestHeaders } from './tencent-request.ts'
