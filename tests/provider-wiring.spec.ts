import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { PiAiAdapterOptions, ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import type { Config } from '../src/index.ts'

interface SettingsHooks {
  setSource(source: () => Config): void
  onChange(): void
  validate?: (value: Config) => void
}

const state = vi.hoisted(() => ({
  adapterOptions: [] as PiAiAdapterOptions[],
  launchEnvironment: {
    getFrom: vi.fn(),
    get: vi.fn(),
  },
  services: new Map<string, unknown>(),
  settingsHooks: [] as SettingsHooks[],
  fetchTtSwitchCatalog: vi.fn(),
}))
// The tt-switch read is the machine's initial catalog and would otherwise hit
// the network the moment a profile is asked for, racing the assertions below.
vi.mock('../src/tt-switch-catalog.ts', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/tt-switch-catalog.ts')>(),
  fetchTtSwitchCatalog: state.fetchTtSwitchCatalog,
}))
const settingsInstall = ((_owner: unknown, _ns: string, _schema: unknown, _config: unknown, hooks: SettingsHooks) => {
  state.settingsHooks.push(hooks)
})

vi.mock('@deepseek-ai/dsh-launch-environment', () => ({
  launchEnvironmentOf: () => state.launchEnvironment,
}))

vi.mock('@deepseek-ai/dsh-llm-pi-ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deepseek-ai/dsh-llm-pi-ai')>()
  function CapturingPiAiAdapter(options: PiAiAdapterOptions): void {
    state.adapterOptions.push(options)
  }
  return {
    ...actual,
    PiAiAdapter: CapturingPiAiAdapter,
  }
})


import { apply, TENCENT_CODEBUDDY_PROVIDER } from '../src/index.ts'

function providerContext(options: { legacy?: boolean } = {}): {
  ctx: Context
  info: ReturnType<typeof vi.fn>
  replace: ReturnType<typeof vi.fn>
  configure: ReturnType<typeof vi.fn>
} {
  const info = vi.fn()
  const replace = vi.fn()
  const configure = vi.fn(() => () => {})
  // dsh ≤ 0.1.6 exposes `installSection`; 0.1.7 dropped it and derives the
  // section from this entry's Config, leaving `configure` to suppress the
  // generated page beside the one this package ships.
  const settings = options.legacy === false
    ? { configure }
    : { installSection: settingsInstall, configure }
  const ctx = {
    fiber: { uid: 0 },
    get: (name: string) => name === 'settings' ? settings : state.services.get(name),
    settings,
    // Faithful to cordis: the callback runs only when every dependency is
    // present, so an optional service — the Web carrier — is simply absent in
    // a headless composition instead of being handed an undefined service.
    inject: (dependencies: readonly string[], callback: (injected: Context) => void) => {
      const missing = dependencies
        .filter(name => name === 'settings' ? settings === undefined : !state.services.has(name))
      if (missing.length > 0) return () => {}
      callback(ctx)
      return () => {}
    },
    effect: (callback: () => () => void) => callback(),
    logger: { info },
    llm: {
      registerAdapter: vi.fn(() => ({ replace })),
      registerConfigurableProviders: vi.fn(),
      registerModelDiscovery: vi.fn(),
    },
  } as unknown as Context
  return { ctx, info, replace, configure }
}

function profile(options: PiAiAdapterOptions): ResolvedPiAiProviderProfile {
  const value = options.profiles().get(TENCENT_CODEBUDDY_PROVIDER)
  if (value === undefined) throw new Error('expected Tencent profile')
  return value
}

beforeEach(() => {
  state.adapterOptions.length = 0
  state.services.clear()
  state.settingsHooks.length = 0
  state.launchEnvironment.getFrom.mockReset()
  state.launchEnvironment.get.mockReset()
  state.fetchTtSwitchCatalog.mockReset()
})

describe('Tencent provider wiring', () => {
  it('imports the adapter from the package root and auth helpers from their modules', () => {
    // The pi-ai plugin exports only the adapter and its option types from the
    // package root; the auth factories and the profile resolver stay on their
    // own modules, so this adapter names those submodules directly.
    const source = readFileSync(fileURLToPath(new URL('../src/index.ts', import.meta.url)), 'utf8')
    expect(source).toMatch(/import \{[^}]*PiAiAdapter[^}]*\} from '@deepseek-ai\/dsh-llm-pi-ai'/)
    expect(source).toMatch(/from '@deepseek-ai\/dsh-llm-pi-ai\/src\/auth\.ts'/)
    expect(source).toMatch(/from '@deepseek-ai\/dsh-llm-pi-ai\/src\/config\.ts'/)
  })

  it('resolves the fixed catalog and refreshes dynamic provider facts without re-registering', async () => {
    const { ctx, replace } = providerContext()
    const initial: Config = {
      apiKeyEnv: 'CUSTOM_KEY',
      timeoutMs: 123,
      streamIdleTimeoutMs: 456,
      retryPolicy: { mode: 'always' },
    }

    apply(ctx, initial)

    const options = state.adapterOptions[0]
    if (options === undefined) throw new Error('expected adapter options')
    const initialProfile = profile(options)
    expect(initialProfile).toMatchObject({
      apiKeyEnv: 'CUSTOM_KEY',
      timeoutMs: 123,
      streamIdleTimeoutMs: 456,
    })
    expect(options.profiles()).toBe(options.profiles())

    // The fixed catalog is served unchanged when no model list is configured.
    const piModels = initialProfile.piProvider!.getModels()
    expect(piModels.length).toBeGreaterThan(1)
    expect(piModels.some(model => model.id === 'gpt-5.6-sol')).toBe(true)

    const attachments = { marker: 'attachments' }
    state.services.set('attachments', attachments)
    expect(options.resolveAttachments?.()).toBe(attachments)
    const request = {
      options: {
        provider: TENCENT_CODEBUDDY_PROVIDER,
        model: 'gpt-5.6-sol',
        messages: [],
      },
    } as unknown as Parameters<NonNullable<PiAiAdapterOptions['prepareRequest']>>[0]
    const prepared = options.prepareRequest?.(request)
    expect(prepared?.headers).toMatchObject({
      'x-agent-intent': 'craft',
      'x-ide-type': 'CLI',
    })
    // The payload hook receives pi-ai's model descriptor; the adapter forwards
    // it unchanged, so the normalization is asserted against the raw payload.
    expect(await prepared?.onPayload?.({ messages: [] }, undefined))
      .toMatchObject({ stream: true })

    state.launchEnvironment.get.mockReturnValue({ value: ' launch-key ' })
    await expect(options.resolveApiKey(TENCENT_CODEBUDDY_PROVIDER, initialProfile))
      .resolves.toBe('launch-key')
    const resolve = vi.fn().mockResolvedValue({ value: 'stored-key' })
    state.services.set('credentials', { resolve })
    await expect(options.resolveApiKey(TENCENT_CODEBUDDY_PROVIDER, initialProfile))
      .resolves.toBe('stored-key')
    expect(resolve).toHaveBeenCalledWith('CUSTOM_KEY')

    const updated: Config = {
      apiKeyEnv: 'CUSTOM_KEY',
      timeoutMs: 123,
      streamIdleTimeoutMs: 456,
      retryPolicy: { mode: 'normal', maxRetries: 0 },
    }
    const hooks = state.settingsHooks[0]
    if (hooks === undefined) throw new Error('expected settings hooks')
    hooks.setSource(() => updated)
    hooks.onChange()
    expect(replace).toHaveBeenCalledWith([TENCENT_CODEBUDDY_PROVIDER])
    hooks.onChange()
    expect(replace).toHaveBeenCalledTimes(1)
  })

  it('serves a configured model list instead of the fixed catalog', async () => {
    const { ctx } = providerContext()

    apply(ctx, { models: [{ id: 'gateway-extra', name: 'Gateway Extra' }] })

    const options = state.adapterOptions[0]
    if (options === undefined) throw new Error('expected adapter options')
    const merged = profile(options)
    const piModels = merged.piProvider!.getModels()
    expect(piModels.map(model => model.id)).toEqual(['gateway-extra'])
  })

  it('serves the signed tt-switch catalog as the list the machine starts out with', async () => {
    const { ctx } = providerContext()
    state.fetchTtSwitchCatalog.mockResolvedValue({ ok: true, catalog: {
      models: [
        { id: 'tt-one', name: 'TT One', contextWindow: 200_000, maxTokens: 128_000, input: ['text'] },
        { id: 'tt-two', name: 'TT Two', contextWindow: 200_000, maxTokens: 128_000, input: ['text'] },
      ],
      revision: 8,
      updatedAt: '2026-10-07T13:31:40.820Z',
      managedModelIds: ['tt-one', 'tt-two'],
      modelFallbacks: { 'tt-old': 'tt-two' },
      signatureVerified: undefined,
    } })

    apply(ctx, {})

    const options = state.adapterOptions[0]
    if (options === undefined) throw new Error('expected adapter options')
    options.profiles()
    // It needs no credential, so it is read on the first ask rather than waiting
    // for one.
    await vi.waitFor(() => {
      expect(profile(options).piProvider!.getModels().map(model => model.id)).toEqual(['tt-one', 'tt-two'])
    })
  })

  it('lets a configured model list outrank the signed tt-switch catalog', async () => {
    const { ctx } = providerContext()
    state.fetchTtSwitchCatalog.mockResolvedValue({ ok: true, catalog: {
      models: [{ id: 'tt-one', name: 'TT One', contextWindow: 200_000, maxTokens: 128_000, input: ['text'] }],
      revision: 8,
      updatedAt: '2026-10-07T13:31:40.820Z',
      managedModelIds: [],
      modelFallbacks: {},
      signatureVerified: undefined,
    } })

    apply(ctx, { models: [{ id: 'gateway-extra', name: 'Gateway Extra' }] })

    const options = state.adapterOptions[0]
    if (options === undefined) throw new Error('expected adapter options')
    options.profiles()
    await vi.waitFor(() => expect(state.fetchTtSwitchCatalog).toHaveBeenCalledTimes(1))
    expect(profile(options).piProvider!.getModels().map(model => model.id)).toEqual(['gateway-extra'])
  })

  it('reports the tt-switch revision and deployment maps without filtering by them', async () => {
    const { ctx, info } = providerContext()
    state.fetchTtSwitchCatalog.mockResolvedValue({ ok: true, catalog: {
      models: [{ id: 'tt-retired', name: 'TT Retired', contextWindow: 200_000, maxTokens: 128_000, input: ['text'] }],
      revision: 8,
      updatedAt: '2026-10-07T13:31:40.820Z',
      managedModelIds: ['tt-one'],
      modelFallbacks: { 'tt-retired': 'tt-current' },
      signatureVerified: undefined,
    } })

    apply(ctx, {})

    const options = state.adapterOptions[0]
    if (options === undefined) throw new Error('expected adapter options')
    options.profiles()
    await vi.waitFor(() => {
      expect(info).toHaveBeenCalledWith(expect.stringContaining(
        'tt-switch catalog revision 8 (2026-10-07T13:31:40.820Z), 1 models, 1 managed, 1 fallbacks',
      ))
    })
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining('signature unchecked: no catalogSignatureKey configured'),
    )
    // Not managed and retired, and still served as-is: whitelisting and
    // rewriting are the deployment's to apply, not this route's.
    expect(profile(options).piProvider!.getModels().map(model => model.id)).toEqual(['tt-retired'])
  })

  it('registers through the Host Config projection once installSection is gone', () => {
    // dsh 0.1.7 removed `installSection`: the section is derived from this
    // entry's Config, so the package only turns the generated page off because
    // it ships its own Settings → CodeBuddy page.
    const { ctx, configure } = providerContext({ legacy: false })

    apply(ctx, {})

    expect(configure).toHaveBeenCalledWith({ auto: false }, (ctx as { fiber: unknown }).fiber)
    expect(state.settingsHooks).toHaveLength(0)
  })

  it('follows a volatile models reference without a plugin restart', () => {
    const { ctx } = providerContext({ legacy: false })
    let models: Config['models'] = [{ id: 'gateway-extra', name: 'Gateway Extra' }]
    const volatileModels = { get: (): Config['models'] => models }

    apply(ctx, { models: volatileModels as unknown as Config['models'] })

    const options = state.adapterOptions[0]
    if (options === undefined) throw new Error('expected adapter options')
    expect(profile(options).piProvider!.getModels().map(model => model.id)).toEqual(['gateway-extra'])
    // A live catalog edit replaces the reference the volatile field wraps.
    models = [{ id: 'gateway-new', name: 'Gateway New' }]
    expect(profile(options).piProvider!.getModels().map(model => model.id)).toEqual(['gateway-new'])
  })

  it('uses credential defaults when optional config and services are absent', async () => {
    const { ctx } = providerContext()

    apply(ctx, {})

    const options = state.adapterOptions[0]
    if (options === undefined) throw new Error('expected adapter options')
    const defaultProfile = profile(options)
    expect(defaultProfile).toMatchObject({
      apiKeyEnv: 'TENCENT_CODEBUDDY_API_KEY',
      streamIdleTimeoutMs: 300_000,
      retryPolicy: { mode: 'normal' },
    })
    expect(defaultProfile).not.toHaveProperty('timeoutMs')

    const profileWithoutReference = {
      ...defaultProfile,
      apiKeyEnv: undefined,
    } as unknown as ResolvedPiAiProviderProfile
    state.launchEnvironment.get.mockReturnValue({ value: '' })
    await expect(options.resolveApiKey(TENCENT_CODEBUDDY_PROVIDER, profileWithoutReference))
      .rejects.toMatchObject({ code: 'MISSING_CREDENTIAL' })
    state.launchEnvironment.get.mockReturnValue(undefined)
    await expect(options.resolveApiKey(TENCENT_CODEBUDDY_PROVIDER, profileWithoutReference))
      .rejects.toMatchObject({ code: 'MISSING_CREDENTIAL' })
  })
})
