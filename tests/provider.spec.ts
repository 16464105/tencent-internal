import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import * as TencentCodeBuddy from '../src/index.ts'
import { TENCENT_CODEBUDDY_MODELS } from '../src/catalog.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

describe('Tencent CodeBuddy provider', () => {
  it('registers the fixed provider with the package-owned fixed catalog', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(TencentCodeBuddy, {})

    expect(ctx.llm.listProviders()).toContainEqual({
      id: 'tencent-internal',
      name: 'Tencent CodeBuddy',
    })
    const models = await ctx.llm.listModels('tencent-internal')
    expect(models.length).toBe(TENCENT_CODEBUDDY_MODELS.length)
    expect(models[0]).toMatchObject({
      provider: 'tencent-internal',
      id: 'auto',
      name: 'Auto',
      inputModalities: ['text', 'image'],
    })
    // The desktop-composition default is part of the fixed catalog.
    expect(models.some(model => model.id === 'gpt-5.6-sol')).toBe(true)
    // A fixed-catalog id resolves as an exact route with its capacities.
    await expect(ctx.llm.resolveModelInfo('tencent-internal', 'gpt-5.6-sol')).resolves.toMatchObject({
      id: 'gpt-5.6-sol',
      context: { contextWindow: 1_000_000 },
    })
    expect(ctx.llm.listConfigurableProviders()).toEqual([{
      provider: 'tencent-internal',
      displayName: 'Tencent CodeBuddy',
      settingsNs: 'llm-tencent-codebuddy',
      settingsPath: [],
    }])
  })

  it('serves a configured model list instead of the fixed catalog', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(TencentCodeBuddy, {
      models: [{ id: 'gateway-extra', name: 'Gateway Extra', contextWindow: 32_000 }],
    })

    await expect(ctx.llm.listModels('tencent-internal')).resolves.toMatchObject([
      { id: 'gateway-extra' },
    ])
    await expect(ctx.llm.resolveModelInfo('tencent-internal', 'gateway-extra')).resolves.toMatchObject({
      id: 'gateway-extra',
      context: { contextWindow: 32_000 },
    })
    // The fixed catalog is fully replaced, not merged.
    await expect(ctx.llm.resolveModelInfo('tencent-internal', 'auto')).rejects.toMatchObject({
      code: 'UNKNOWN_MODEL',
    })
  })

  it('refuses a duplicate model id in the configured list', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(LlmRuntime)
    await expect(ctx.plugin(TencentCodeBuddy, {
      models: [{ id: 'same' }, { id: 'same' }],
    })).rejects.toThrow(/listed more than once|"same"/)
  })
})
