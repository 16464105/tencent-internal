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
  CodeBuddySection, type CodeBuddySettingsInjected,
} from './CodeBuddySection.tsx'
import { en, zh, type CodeBuddySettingsKey } from './locales.ts'

export type { CodeBuddySettingsInjected, CodeBuddySettingsProps } from './CodeBuddySection.tsx'
export { CODEBUDDY_API_KEY_REF } from './CodeBuddySection.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** CodeBuddy Settings copy. */
    'settings.codebuddy': CodeBuddySettingsKey
  }
}

const NS = 'settings.codebuddy'

/**
 * Required services before the section can register.
 */
export const inject = ['slots', 'locale', 'remote', 'remote.credentials']

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
