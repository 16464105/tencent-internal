/**
 * CodeBuddy Settings contribution: a page beside Models, not a Models card.
 * @module @deepseek-ai/dsh-llm-tencent-codebuddy/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import {
  CodeBuddySection, CODEBUDDY_SETTINGS_NS,
  type CatalogStatusView, type CodeBuddySettingsInjected,
} from './CodeBuddySection.tsx'
import { en, zh, type CodeBuddySettingsKey } from './locales.ts'

export type {
  CatalogStatusView, CodeBuddySettingsInjected, CodeBuddySettingsProps,
  CodeBuddySettingsSnapshot, CodeBuddySettingsWrite,
} from './CodeBuddySection.tsx'
export { CODEBUDDY_API_KEY_REF, CODEBUDDY_SETTINGS_NS } from './CodeBuddySection.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** CodeBuddy Settings copy. */
    'settings.codebuddy': CodeBuddySettingsKey
  }
}

const NS = 'settings.codebuddy'
/** Catalog endpoint the Host side of this package serves. */
const CATALOG_API = '/llm-tencent-codebuddy/api/catalog'

/**
 * Required services before the section can register.
 */
export const inject = ['slots', 'locale', 'remote', 'remote.credentials', 'remote.settings']

/**
 * Register the CodeBuddy settings page once `settings.section` is declared.
 * @param ctx - client root context.
 * @returns nothing; registration lives on the fiber through `ctx.effect`.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'llm-tencent-codebuddy: dictionaries')
  const t = ctx.locale.bind(NS)
  const injected = (): CodeBuddySettingsInjected => ({
    describeCredential: async (ref) => {
      const response = await ctx.remote.credentials.describe([ref])
      return response.ok ? response.value[ref] : undefined
    },
    storeCredential: async (ref, value) => {
      const response = await ctx.remote.credentials.set(ref, value)
      return response.ok ? undefined : response.error.message
    },
    describeSettings: async () => {
      const response = await ctx.remote.settings.describe()
      if (!response.ok) return undefined
      return {
        writable: response.value.writable,
        namespace: response.value.namespaces.find(item => item.ns === CODEBUDDY_SETTINGS_NS),
      }
    },
    writeSettings: async (ops, expectedRevision) => {
      const response = await ctx.remote.settings.mutate(CODEBUDDY_SETTINGS_NS, ops, expectedRevision)
      if (response.ok) return { kind: 'written', view: response.value }
      return { kind: 'refused', error: response.error.message }
    },
    // The catalog lives in the Host plugin, not in the settings namespace: the
    // settings view only ever shows the schema default. These two read and
    // re-trigger the actual source, straight from the Host's own endpoint.
    describeCatalog: async () => {
      try {
        const response = await fetch(CATALOG_API, { headers: { accept: 'application/json' } })
        return response.ok ? await response.json() as CatalogStatusView : undefined
      } catch {
        return undefined
      }
    },
    syncCatalog: async () => {
      const response = await fetch(`${CATALOG_API}/sync`, {
        method: 'POST',
        headers: { accept: 'application/json' },
      })
      const body = await response.json().catch(() => ({})) as CatalogStatusView & { error?: string }
      if (!response.ok) throw new Error(body.error ?? `HTTP ${String(response.status)}`)
      return body
    },
  })
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'codebuddy',
    order: 12,
    label: () => t('nav'),
    locale: NS,
    inject: injected,
  }, CodeBuddySection))
}
