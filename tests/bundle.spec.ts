/** The Tencent bundle patch must insert the route and select the key-only default. */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { composeEntries, loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'

const packageDir = fileURLToPath(new URL('..', import.meta.url))
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  dsh?: { bundle?: { patch?: string } }
}
const bundlePatch = manifest.dsh?.bundle?.patch
if (bundlePatch === undefined) throw new Error('Tencent package must declare a bundle patch')
const patchPath = fileURLToPath(new URL(`../${bundlePatch}`, import.meta.url))

describe('Tencent CodeBuddy profile bundle', () => {
  it('selects the Tencent default and inserts the adapter over a base-backed tree', () => {
    const rows = composedRows([
      'agent-default-model',
      'ui-settings-models',
      'llm-deepseek',
    ])
    expect(rows.get('agent-default-model')?.config).toEqual({
      provider: 'tencent-internal',
      model: 'gpt-5.6-sol',
    })
    expect(rows.get('ui-settings-models')?.config).toBeUndefined()
    expect(rows.get('llm-tencent-codebuddy')?.name).toBe('@deepseek-ai/dsh-llm-tencent-codebuddy')
    expect(rows.get('llm-deepseek')?.disabled).not.toBe(true)
  })

  it('still mounts the adapter when the default-model row is absent', () => {
    const warnings: string[] = []
    const rows = composedRows([], warnings)
    expect(rows.get('llm-tencent-codebuddy')?.name).toBe('@deepseek-ai/dsh-llm-tencent-codebuddy')
    expect(rows.has('agent-default-model')).toBe(false)
    expect(warnings.join('\n')).toContain('agent-default-model')
  })

  it('duplicates the adapter row when the tree already inserted it', () => {
    const composed = composeEntries([
      [{ insert: [
        { id: 'agent-default-model', name: 'test-agent-default-model' },
        { id: 'llm-tencent-codebuddy', name: '@deepseek-ai/dsh-llm-tencent-codebuddy' },
      ] }],
      loadOverlayPatches(`${packageDir}-stack`, patchPath),
    ])
    expect(composed.filter(row => row.id === 'llm-tencent-codebuddy')).toHaveLength(2)
  })
})

function composedRows(
  baseIds: readonly string[],
  warnings: string[] = [],
): Map<string, { id?: string; name?: string; config?: unknown; disabled?: boolean }> {
  return new Map(composeEntries([
    [{ insert: baseIds.map(id => ({ id, name: `test-${id}` })) }],
    loadOverlayPatches(`${packageDir}-test`, patchPath),
  ], message => warnings.push(message))
    .filter(row => typeof row.id === 'string')
    .map(row => [row.id, row]))
}
