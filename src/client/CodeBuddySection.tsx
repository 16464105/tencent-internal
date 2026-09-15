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

/** Host operations supplied by the registration. */
export interface CodeBuddySettingsInjected {
  readonly describeCredential: (ref: string) => Promise<CredentialInfo | undefined>
  readonly storeCredential: (ref: string, value: string) => Promise<string | undefined>
  readonly describeSettings: () => Promise<CodeBuddySettingsSnapshot | undefined>
  readonly writeSettings: (
    ops: SettingsPathOpView[],
    expectedRevision: number | undefined,
  ) => Promise<CodeBuddySettingsWrite>
}

export type CodeBuddySettingsProps = PropsRuntime<'settings.section'>
  & PropsLocale<'settings.codebuddy'>
  & InjectFace<CodeBuddySettingsInjected>

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
  const { t, describeCredential, storeCredential, describeSettings, writeSettings } = props
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
      </div>
    </section>
  )
}
