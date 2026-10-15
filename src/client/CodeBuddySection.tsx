/**
 * Settings → CodeBuddy page: API key storage and catalog editor for the Tencent route.
 * @module @deepseek-ai/dsh-llm-tencent-codebuddy/client/CodeBuddySection
 */
import { useEffect, useState, type ReactNode } from 'react'
import type {
  CredentialInfo, SettingsNamespaceView, SettingsPathOpView,
} from '@deepseek-ai/dsh-api-remotes/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { apiKeyFailure } from './apiKey.ts'
import { ModelsEditor } from './ModelsEditor.tsx'
import {
  catalogPayload, modelDrafts, objectField, userOwnsModels, validateModels,
  type ModelDraft,
} from './models.ts'
import styles from './CodeBuddySection.module.css'

/** Credential reference this page stores. */
export const CODEBUDDY_API_KEY_REF = 'TENCENT_CODEBUDDY_API_KEY'
/** Settings namespace this page reads and writes. */
export const CODEBUDDY_SETTINGS_NS = 'llm-tencent-codebuddy'

/** Host snapshot of the CodeBuddy settings namespace. */
export interface CodeBuddySettingsSnapshot {
  /** Whether the settings provider accepts writes. */
  readonly writable: boolean
  /** The CodeBuddy namespace, or undefined when the Host has not registered it. */
  readonly namespace: SettingsNamespaceView | undefined
}

/** Outcome of one settings mutate. */
export type CodeBuddySettingsWrite =
  | { readonly kind: 'written'; readonly view: SettingsNamespaceView }
  | { readonly kind: 'refused'; readonly error: string }

/** Where the catalog this route serves came from, as the Host reports it. */
export interface CatalogStatusView {
  readonly source?: 'tt-switch' | 'configured' | 'shipped' | 'failed' | 'pending'
  readonly models?: number
  readonly revision?: number
  readonly updatedAt?: string
  readonly managed?: number
  readonly fallbacks?: number
  readonly signature?: 'verified' | 'unchecked'
  readonly readAt?: number
  readonly error?: string
}

/** Host operations supplied by the registration. */
export interface CodeBuddySettingsInjected {
  readonly describeCredential: (ref: string) => Promise<CredentialInfo | undefined>
  readonly storeCredential: (ref: string, value: string) => Promise<string | undefined>
  readonly describeSettings: () => Promise<CodeBuddySettingsSnapshot | undefined>
  readonly writeSettings: (
    ops: SettingsPathOpView[],
    expectedRevision: number | undefined,
  ) => Promise<CodeBuddySettingsWrite>
  readonly describeCatalog: () => Promise<CatalogStatusView | undefined>
  readonly syncCatalog: () => Promise<CatalogStatusView | undefined>
}

export type CodeBuddySettingsProps = PropsRuntime<'settings.section'>
  & PropsLocale<'settings.codebuddy'>
  & InjectFace<CodeBuddySettingsInjected>

/**
 * Fill `{name}` placeholders. The Host translator may not interpolate, so the
 * page does its own substitution over whatever string it was handed.
 * @param text - translated copy.
 * @param values - placeholder values.
 * @returns the copy with every placeholder replaced.
 */
function fill(text: string, values: Readonly<Record<string, string>>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole)
}

function modelsOp(overridden: boolean, models: readonly ModelDraft[]): SettingsPathOpView {
  if (!overridden) return { op: 'unset', path: ['models'] }
  return {
    op: 'set',
    path: ['models'],
    value: catalogPayload(models) as Extract<SettingsPathOpView, { op: 'set' }>['value'],
  }
}

/**
 * Settings → CodeBuddy page: API key storage and catalog editor for the Tencent route.
 * @param props - slot runtime plus Host operations and copy.
 * @returns the section.
 */
export function CodeBuddySection(props: CodeBuddySettingsProps): ReactNode {
  const {
    t, describeCredential, storeCredential, describeSettings, writeSettings, describeCatalog, syncCatalog,
  } = props
  const [keyDraft, setKeyDraft] = useState('')
  const [keyState, setKeyState] = useState<CredentialInfo | undefined>(undefined)
  const [namespace, setNamespace] = useState<SettingsNamespaceView | undefined>(undefined)
  const [settingsWritable, setSettingsWritable] = useState(true)
  const [settingsReady, setSettingsReady] = useState(false)
  const [settingsLoadFailed, setSettingsLoadFailed] = useState(false)
  const [inherited, setInherited] = useState<ModelDraft[]>([])
  const [models, setModels] = useState<ModelDraft[]>([])
  const [overridden, setOverridden] = useState(false)
  const [storedOverridden, setStoredOverridden] = useState(false)
  const [modelsDirty, setModelsDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const [saved, setSaved] = useState(false)
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatusView | undefined>(undefined)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    let stale = false
    let retry: ReturnType<typeof setTimeout> | undefined
    void describeCatalog().then((status) => {
      if (stale) return
      setCatalogStatus(status)
      // The page can open while the first read is still in flight; ask once
      // more rather than leaving the page on "reading…" forever.
      if (status?.source === 'pending') {
        retry = setTimeout(() => {
          void describeCatalog().then((next) => { if (!stale) setCatalogStatus(next) })
        }, 2000)
      }
    })
    return () => {
      stale = true
      if (retry !== undefined) clearTimeout(retry)
    }
  }, [describeCatalog])

  const syncModels = async (): Promise<void> => {
    setSyncing(true)
    setFailure(undefined)
    try {
      setCatalogStatus(await syncCatalog())
    } catch (error) {
      setFailure(String((error as Error)?.message ?? error))
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    let stale = false
    void Promise.all([describeCredential(CODEBUDDY_API_KEY_REF), describeSettings()])
      .then(([described, settings]) => {
        if (stale) return
        setKeyState(described)
        if (settings === undefined) {
          setSettingsLoadFailed(true)
          setSettingsReady(true)
          return
        }
        setSettingsWritable(settings.writable)
        setNamespace(settings.namespace)
        if (settings.namespace !== undefined) {
          const owned = userOwnsModels(settings.namespace.user)
          const effective = modelDrafts(objectField(settings.namespace.value, 'models'))
          const fromBase = modelDrafts(objectField(settings.namespace.base, 'models'))
          const fallback = fromBase.length > 0 ? fromBase : owned ? [] : effective
          setInherited(fallback.map(model => ({ ...model })))
          setModels(effective.map(model => ({ ...model })))
          setOverridden(owned)
          setStoredOverridden(owned)
        }
        setSettingsReady(true)
      })
    return () => { stale = true }
  }, [describeCredential, describeSettings])

  const keyLocked = keyState?.writable === false
  const keyFailure = apiKeyFailure(keyDraft)
  const modelFailure = overridden ? validateModels(models) : undefined
  const placeholder = keyLocked
    ? t('keyEnvLocked')
    : keyState?.configured === true ? t('keyStored') : t('keyPlaceholder')
  const status = keyState?.configured === true ? t('keyStored') : t('keyMissing')
  const shownFailure = keyFailure === undefined
    ? modelFailure === undefined
      ? failure
      : `${t('model')} ${String(modelFailure.index + 1)}: ${t(modelFailure.key)}`
    : t(keyFailure)
  const canSaveKey = !keyLocked && keyFailure === undefined && keyDraft.trim().length > 0
  const canSaveModels = settingsWritable && modelsDirty && modelFailure === undefined
  const catalogDisabled = busy || !settingsWritable
  const catalogOrigin = ((): string | undefined => {
    const status = catalogStatus
    if (status === undefined) return undefined
    const models = String(status.models ?? 0)
    const body = status.source === 'tt-switch'
      ? status.revision === undefined
        ? fill(t('catalogFromReleaseUndated'), { models })
        : fill(t('catalogFromRelease'), { revision: String(status.revision), models })
      : status.source === 'configured'
        ? fill(t('catalogFromConfigured'), { models })
        : status.source === 'shipped'
          ? fill(t('catalogFromShipped'), { models })
          : status.source === 'pending' ? t('catalogPending') : t('catalogFailed')
    const signature = status.source === 'tt-switch' && status.signature === 'unchecked'
      ? ` ${t('catalogSignatureUnchecked')}`
      : ''
    return `${body}${signature}`
  })()
  // The reason a read failed is the whole answer to "where are my models"; it
  // gets its own line rather than trailing the status sentence.
  const catalogError = catalogStatus?.error

  const save = async (): Promise<void> => {
    const value = keyDraft.trim()
    setBusy(true)
    setFailure(undefined)
    setSaved(false)
    try {
      if (canSaveModels) {
        const written = await writeSettings([modelsOp(overridden, models)], namespace?.revision)
        if (written.kind === 'refused') {
          setFailure(written.error)
          return
        }
        setNamespace(written.view)
        setModelsDirty(false)
        setStoredOverridden(overridden)
      }
      if (canSaveKey) {
        const refused = await storeCredential(CODEBUDDY_API_KEY_REF, value)
        if (refused !== undefined) {
          setFailure(refused)
          return
        }
        setKeyDraft('')
        setKeyState({ configured: true, writable: true, source: 'file' })
      }
      setSaved(true)
    } finally {
      setBusy(false)
    }
  }

  const catalog = !settingsReady
    ? null
    : settingsLoadFailed
      ? <p className={styles['status']} role="status">{t('catalogLoadFailed')}</p>
      : namespace === undefined
        ? <p className={styles['status']} role="status">{t('catalogMissing')}</p>
        : (
          <ModelsEditor
            models={models}
            overridden={overridden}
            t={t}
            disabled={catalogDisabled}
            onChange={(next) => {
              setOverridden(true)
              setModels(next)
              setModelsDirty(true)
              setSaved(false)
            }}
            onReset={() => {
              setOverridden(false)
              setModels(inherited.map(model => ({ ...model })))
              setModelsDirty(storedOverridden)
              setSaved(false)
            }}
          />
        )

  return (
    <section className={styles['section']}>
      <div className={styles['heading']}>
        <h2>{t('title')}</h2>
        <p>{t('intro')}</p>
      </div>
      <label className={styles['field']}>
        <span>{t('keyInput')}</span>
        <input
          type="password"
          autoComplete="off"
          value={keyDraft}
          placeholder={placeholder}
          aria-label={t('keyInput')}
          aria-invalid={keyFailure !== undefined}
          disabled={busy || keyLocked}
          onChange={(event) => {
            setKeyDraft(event.target.value)
            setSaved(false)
            setFailure(undefined)
          }}
        />
      </label>
      <p className={styles['status']} role="status">{status}</p>
      {catalogOrigin === undefined
        ? null
        : <p className={styles['status']} role="status">{catalogOrigin}</p>}
      {catalogError === undefined
        ? null
        : <p className={styles['failure']} role="alert">{catalogError}</p>}
      {catalog}
      {shownFailure === undefined
        ? null
        : <p className={styles['failure']} role="alert">{shownFailure}</p>}
      {saved ? <p className={styles['saved']} role="status">{t('saved')}</p> : null}
      <div className={styles['actions']}>
        <button
          type="button"
          className={styles['primary']}
          disabled={busy || modelFailure !== undefined || (!canSaveKey && !canSaveModels)}
          onClick={() => { void save() }}
        >
          {t('apply')}
        </button>
        <button
          type="button"
          disabled={syncing}
          onClick={() => { void syncModels() }}
        >
          {syncing ? t('syncingModels') : t('syncModels')}
        </button>
      </div>
    </section>
  )
}
