import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchTtSwitchCatalog,
  projectTtSwitchCatalog,
  TT_SWITCH_ALGORITHM,
  TT_SWITCH_CATALOG_URL,
  verifySignature,
} from '../src/tt-switch-catalog.ts'

const KEY = 'deployment-signing-key'

/**
 * Build the envelope the release file carries.
 * @param payload - the decoded catalogue.
 * @param key - signing key; omitted leaves `signature` empty.
 * @returns the parsed response body.
 */
function envelope(payload: unknown, key?: string): unknown {
  const text = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
  const signature = key === undefined
    ? ''
    : createHmac('sha256', key).update(text).digest('base64')
  return { schemaVersion: 1, algorithm: TT_SWITCH_ALGORITHM, payload: text, signature }
}

/** One catalogue entry, trimmed to the fields this module reads. */
function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'claude-sonnet-5',
    displayName: 'Claude-Sonnet-5',
    maxInputTokens: 200_000,
    maxOutputTokens: 128_000,
    supportsReasoning: true,
    supportsImages: true,
    supportsTools: true,
    temperature: 1,
    costMultiplier: 1.33,
    ...overrides,
  }
}

describe('tt-switch signature', () => {
  it('reads the URL tt-switch itself hardcodes', () => {
    expect(TT_SWITCH_CATALOG_URL)
      .toBe('https://cnb.woa.com/tt-switch/tt-switch/-/git/raw/master/releases/tencent_models.json')
    expect(TT_SWITCH_ALGORITHM).toBe('HMAC-SHA256+BASE64-PAYLOAD')
  })

  it('signs the Base64 payload text, the bytes both sides hold verbatim', () => {
    const text = Buffer.from('{"revision":8}', 'utf8').toString('base64')
    const signature = createHmac('sha256', KEY).update(text).digest('base64')

    expect(verifySignature(text, signature, KEY)).toBe(true)
    expect(verifySignature(text, signature, 'another-key')).toBe(false)
  })

  it('leaves the signature unchecked when no key is configured', () => {
    const text = Buffer.from('{"revision":8}', 'utf8').toString('base64')

    expect(verifySignature(text, 'whatever', undefined)).toBeUndefined()
    expect(verifySignature(text, 'whatever', '')).toBeUndefined()
    expect(verifySignature(text, '', KEY)).toBeUndefined()
  })
})

describe('tt-switch projection', () => {
  it('projects a signed release into chat-route profiles', () => {
    const catalog = projectTtSwitchCatalog(
      envelope({
        revision: 8,
        updatedAt: '2026-10-07T13:31:40.820Z',
        models: [entry()],
        managedModelIds: ['claude-sonnet-5'],
        modelFallbacks: { 'claude-opus-4.6': 'claude-opus-5.5' },
      }, KEY),
      KEY,
    )

    expect(catalog?.signatureVerified).toBe(true)
    expect(catalog?.revision).toBe(8)
    expect(catalog?.updatedAt).toBe('2026-10-07T13:31:40.820Z')
    expect(catalog?.managedModelIds).toEqual(['claude-sonnet-5'])
    expect(catalog?.modelFallbacks).toEqual({ 'claude-opus-4.6': 'claude-opus-5.5' })
    expect(catalog?.models).toEqual([{
      id: 'claude-sonnet-5',
      // A Harness selector renders the display name and nothing else, so the
      // cost multiplier has to travel there to be visible where the model is chosen.
      name: 'Claude-Sonnet-5 (x1.33)',
      contextWindow: 200_000,
      maxTokens: 128_000,
      input: ['text', 'image'],
      reasoningEfforts: { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
      compat: { thinkingFormat: 'openai', supportsReasoningEffort: true },
    }])
  })

  it('reads the catalogue with the signature unchecked when no key is configured', () => {
    const catalog = projectTtSwitchCatalog(envelope({ revision: 8, models: [entry()] }, KEY))

    expect(catalog?.signatureVerified).toBeUndefined()
    expect(catalog?.models).toHaveLength(1)
  })

  it('rejects the whole catalogue when a configured key does not match', () => {
    // A list that may have been altered is worse than the previous one.
    expect(projectTtSwitchCatalog(envelope({ models: [entry()] }, KEY), 'another-key')).toBeUndefined()
  })

  it('rejects a body that is not a signed envelope', () => {
    expect(projectTtSwitchCatalog(null)).toBeUndefined()
    expect(projectTtSwitchCatalog({})).toBeUndefined()
    expect(projectTtSwitchCatalog({ payload: 'not-base64-json', signature: '' })).toBeUndefined()
    expect(projectTtSwitchCatalog(envelope({ models: 'not-an-array' }))).toBeUndefined()
    expect(projectTtSwitchCatalog(envelope({ models: [] }))).toBeUndefined()
  })

  it('drops entries this route cannot drive an agent turn through', () => {
    const catalog = projectTtSwitchCatalog(envelope({
      models: [
        entry({ id: 'no-tools', supportsTools: false }),
        entry({ id: 'no-window', maxInputTokens: undefined }),
        entry({ id: 'bare', displayName: undefined, costMultiplier: undefined, maxOutputTokens: undefined, supportsImages: false }),
        entry({ id: 'kept', displayName: 'Named', costMultiplier: undefined }),
        entry({ id: 'kept' }),
        'not-an-object',
      ],
    }))

    expect(catalog?.models.map(model => model.id)).toEqual(['bare', 'kept'])
    // A route that names no output ceiling is assumed to carry the common one.
    expect(catalog?.models[0]).toMatchObject({ name: 'bare', maxTokens: 32_768, input: ['text'] })
    expect(catalog?.models[1]).toMatchObject({ name: 'Named' })
  })

  it('caps the output ceiling and carries image support only where it is declared', () => {
    const catalog = projectTtSwitchCatalog(envelope({
      models: [
        entry({ id: 'uncapped', maxOutputTokens: 1_000_000 }),
        // The multiplier is published as text; a number still has to be visible.
        entry({ id: 'text-only', supportsImages: false, supportsReasoning: false, costMultiplier: 1 }),
      ],
    }))

    expect(catalog?.models[0]).toMatchObject({ maxTokens: 128_000 })
    expect(catalog?.models[1]).toMatchObject({
      name: 'Claude-Sonnet-5 (x1)',
      input: ['text'],
      reasoningEfforts: false,
    })
  })

  it('carries the deployment maps as diagnostics without applying them', () => {
    const catalog = projectTtSwitchCatalog(envelope({
      models: [entry({ id: 'claude-opus-4.6' })],
      managedModelIds: ['only-this-one'],
      modelFallbacks: { 'claude-opus-4.6': 'claude-opus-5.5', 'broken': null },
    }))

    // The retired id is served as-is: a rewrite the user did not ask for is
    // worse than a failure the user can see.
    expect(catalog?.models.map(model => model.id)).toEqual(['claude-opus-4.6'])
    expect(catalog?.managedModelIds).toEqual(['only-this-one'])
    expect(catalog?.modelFallbacks).toEqual({ 'claude-opus-4.6': 'claude-opus-5.5' })
  })
})

describe('tt-switch read', () => {
  it('projects the response it gets', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(envelope({ models: [entry()] }, KEY)), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))

    await expect(fetchTtSwitchCatalog({ key: KEY, fetchImpl: fetchImpl as unknown as typeof fetch }))
      .resolves.toMatchObject({ signatureVerified: true })
    expect(fetchImpl).toHaveBeenCalledWith(TT_SWITCH_CATALOG_URL, expect.objectContaining({ method: 'GET' }))
  })

  it('yields nothing instead of throwing when the read fails', async () => {
    const notOk = vi.fn(async () => new Response('nope', { status: 404 }))
    const throws = vi.fn(async () => { throw new Error('offline') })

    await expect(fetchTtSwitchCatalog({ fetchImpl: notOk as unknown as typeof fetch })).resolves.toBeUndefined()
    await expect(fetchTtSwitchCatalog({ fetchImpl: throws as unknown as typeof fetch })).resolves.toBeUndefined()
  })
})
