/** Tencent provider registration through a real Loader and Include composition. */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import * as TencentCodeBuddy from '../src/index.ts'
import { TENCENT_CODEBUDDY_MODELS } from '../src/catalog.ts'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

describe('Tencent CodeBuddy real Loader composition', () => {
  it('boots from cordis.yml and exposes the fixed route and settings namespace', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-tencent-codebuddy-loader-'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      "- name: '@deepseek-ai/dsh-llm'",
      "- name: '@deepseek-ai/dsh-llm-tencent-codebuddy'",
      '',
    ].join('\n'))

    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@deepseek-ai/dsh-llm', LlmRuntime],
      ['@deepseek-ai/dsh-llm-tencent-codebuddy', TencentCodeBuddy],
    ])
    context.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof context.loader.internal>
    await context.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
    await context.loader.await()

    expect(context.llm.listProviders()).toContainEqual({
      id: 'tencent-internal',
      name: 'Tencent CodeBuddy',
    })
    expect(context.llm.listConfigurableProviders()).toEqual([{
      provider: 'tencent-internal',
      displayName: 'Tencent CodeBuddy',
      settingsNs: 'llm-tencent-codebuddy',
      settingsPath: [],
    }])
    // The fixed catalog serves with no configuration at all.
    const models = await context.llm.listModels('tencent-internal')
    expect(models.length).toBe(TENCENT_CODEBUDDY_MODELS.length)
    expect(models).toContainEqual({
      provider: 'tencent-internal',
      id: 'gpt-5.6-sol',
      name: 'GPT-5.6-Sol',
      inputModalities: ['text', 'image'],
    })
  })
})
