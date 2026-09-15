/**
 * Settings → CodeBuddy page: write-only API key storage for the Tencent route.
 * @module @deepseek-ai/dsh-llm-tencent-codebuddy/client/CodeBuddySection
 */
import { useEffect, useState, type ReactNode } from 'react'
import type { CredentialInfo } from '@deepseek-ai/dsh-api-remotes/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { apiKeyFailure } from './apiKey.ts'
import styles from './CodeBuddySection.module.css'

/** Credential reference this page stores. */
export const CODEBUDDY_API_KEY_REF = 'TENCENT_CODEBUDDY_API_KEY'

/** Host operations supplied by the registration. */
export interface CodeBuddySettingsInjected {
  readonly describeCredential: (ref: string) => Promise<CredentialInfo | undefined>
  readonly storeCredential: (ref: string, value: string) => Promise<string | undefined>
}

export type CodeBuddySettingsProps = PropsRuntime<'settings.section'>
  & PropsLocale<'settings.codebuddy'>
  & InjectFace<CodeBuddySettingsInjected>

/**
 * Settings → CodeBuddy page: write-only API key storage for the Tencent route.
 * @param props - slot runtime plus credential operations and copy.
 * @returns the section.
 */
export function CodeBuddySection(props: CodeBuddySettingsProps): ReactNode {
  const { t, describeCredential, storeCredential } = props
  const [keyDraft, setKeyDraft] = useState('')
  const [keyState, setKeyState] = useState<CredentialInfo | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let stale = false
    void describeCredential(CODEBUDDY_API_KEY_REF).then((described) => {
      if (stale) return
      setKeyState(described)
    })
    return () => { stale = true }
  }, [describeCredential])

  const keyLocked = keyState?.writable === false
  const keyFailure = apiKeyFailure(keyDraft)
  const placeholder = keyLocked
    ? t('keyEnvLocked')
    : keyState?.configured === true ? t('keyStored') : t('keyPlaceholder')
  const status = keyState?.configured === true ? t('keyStored') : t('keyMissing')
  const shownFailure = keyFailure === undefined ? failure : t(keyFailure)

  const save = async (): Promise<void> => {
    const value = keyDraft.trim()
    setBusy(true)
    setFailure(undefined)
    setSaved(false)
    try {
      const refused = await storeCredential(CODEBUDDY_API_KEY_REF, value)
      if (refused !== undefined) {
        setFailure(refused)
        return
      }
      setKeyDraft('')
      setKeyState({ configured: true, writable: true, source: 'file' })
      setSaved(true)
    } finally {
      setBusy(false)
    }
  }

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
          aria-invalid={shownFailure !== undefined}
          disabled={busy || keyLocked}
          onChange={(event) => {
            setKeyDraft(event.target.value)
            setSaved(false)
            setFailure(undefined)
          }}
        />
      </label>
      <p className={styles['status']} role="status">{status}</p>
      {shownFailure === undefined
        ? null
        : <p className={styles['failure']} role="alert">{shownFailure}</p>}
      {saved ? <p className={styles['saved']} role="status">{t('saved')}</p> : null}
      <div className={styles['actions']}>
        <button
          type="button"
          className={styles['primary']}
          disabled={busy || keyLocked || keyFailure !== undefined || keyDraft.trim().length === 0}
          onClick={() => { void save() }}
        >
          {t('apply')}
        </button>
      </div>
    </section>
  )
}
