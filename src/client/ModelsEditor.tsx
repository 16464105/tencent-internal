/**
 * Catalog table on Settings → CodeBuddy: id, name, and capacities on each row.
 * @module @deepseek-ai/dsh-llm-tencent-codebuddy/client/ModelsEditor
 */

import { useState, type ReactNode } from 'react'
import {
  IconPlusOutlineRegular, IconTrashOutlineRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { CodeBuddySettingsKey } from './locales.ts'
import { formatCapacity, parseCapacity, type ModelDraft } from './models.ts'
import styles from './CodeBuddySection.module.css'

const CAPACITY_FIELDS = ['contextWindow', 'maxTokens'] as const
type CapacityField = (typeof CAPACITY_FIELDS)[number]

/** Props of {@link ModelsEditor}. */
export interface ModelsEditorProps {
  /** Effective rows: inherited until the parent materializes an override. */
  models: readonly ModelDraft[]
  /** Whether the user layer currently owns the whole array. */
  overridden: boolean
  /** Section copy. */
  t: (key: CodeBuddySettingsKey) => string
  /** Disable every mutation. */
  disabled: boolean
  /** Replace the user-owned array after one visible edit. */
  onChange: (models: ModelDraft[]) => void
  /** Remove the user-owned array and return to inheritance. */
  onReset: () => void
}

function bufferKey(field: CapacityField, index: number): string {
  return `${field}#${String(index)}`
}

function parseBufferKey(key: string): { field: string; index: number } {
  const split = key.lastIndexOf('#')
  return { field: key.slice(0, split), index: Number(key.slice(split + 1)) }
}

function patchRow(
  models: readonly ModelDraft[],
  index: number,
  field: string,
  value: unknown,
): ModelDraft[] {
  return models.map((model, at) => {
    if (at !== index) return { ...model }
    const copy = { ...model }
    if (value === undefined) Reflect.deleteProperty(copy, field)
    else copy[field] = value
    return copy
  })
}

/**
 * Render the CodeBuddy model catalog as a table under the API key field.
 * @param props - effective rows plus the array-level override actions.
 * @returns the catalog editor.
 */
export function ModelsEditor(props: ModelsEditorProps): ReactNode {
  const [buffers, setBuffers] = useState<ReadonlyMap<string, string>>(() => new Map())

  const commit = (next: ModelDraft[]): void => {
    props.onChange(next)
  }

  const dropRow = (removed: number): void => {
    setBuffers((current) => {
      const next = new Map<string, string>()
      for (const [key, text] of current) {
        const parsed = parseBufferKey(key)
        if (parsed.index === removed) continue
        const index = parsed.index > removed ? parsed.index - 1 : parsed.index
        next.set(bufferKey(parsed.field as CapacityField, index), text)
      }
      return next
    })
    commit(props.models.flatMap((model, at) => at === removed ? [] : [{ ...model }]))
  }

  const shownCapacity = (model: ModelDraft, index: number, field: CapacityField): string => {
    const typed = buffers.get(bufferKey(field, index))
    if (typed !== undefined) return typed
    const stored = model[field]
    return typeof stored === 'number' ? formatCapacity(stored) : ''
  }

  const finishCapacity = (index: number, field: CapacityField): void => {
    const key = bufferKey(field, index)
    const typed = buffers.get(key)
    if (typed === undefined) return
    const parsed = parseCapacity(typed)
    if (parsed !== undefined && Number.isNaN(parsed)) return
    setBuffers((current) => {
      const next = new Map(current)
      next.delete(key)
      return next
    })
  }

  const captions = [props.t('modelId'), props.t('modelName'), props.t('contextWindow'), props.t('maxTokens')]

  const restoreDefaults = (): void => {
    setBuffers(new Map())
    props.onReset()
  }
  const appendBlank = (): void => {
    commit([...props.models.map(row => ({ ...row })), { id: '' }])
  }
  const status = props.overridden ? props.t('modelsCustomized') : props.t('modelsInherited')

  return (
    <section className={styles['modelCatalog']} aria-label={props.t('models')}>
      <header className={styles['modelListHead']}>
        <p className={styles['modelCatalogHeading']}>
          <strong className={styles['modelCatalogTitle']}>{props.t('models')}</strong>
          <span className={styles['modelCatalogMeta']}>{status}</span>
        </p>
        {props.overridden
          ? (
            <button type="button" className={styles['linkButton']} disabled={props.disabled} onClick={restoreDefaults}>
              {props.t('resetModels')}
            </button>
          )
          : null}
      </header>
      {props.models.length === 0
        ? <p className={styles['modelEmpty']}>{props.t('modelsEmpty')}</p>
        : (
          <div className={styles['modelList']}>
            <div className={styles['modelHeader']} aria-hidden="true">
              {captions.map(caption => <span key={caption}>{caption}</span>)}
              <span />
            </div>
            {props.models.map((model, index) => {
              const idText = typeof model['id'] === 'string' ? model['id'] : ''
              const nameText = typeof model['name'] === 'string' ? model['name'] : ''
              const n = String(index + 1)
              return (
                <div className={styles['modelRow']} key={index}>
                  <input
                    className={styles['input']}
                    type="text"
                    value={idText}
                    placeholder={props.t('modelId')}
                    aria-label={`${props.t('modelId')} ${n}`}
                    disabled={props.disabled}
                    onChange={(event) => { commit(patchRow(props.models, index, 'id', event.target.value)) }}
                    onBlur={(event) => {
                      const trimmed = event.target.value.trim()
                      if (trimmed !== event.target.value) commit(patchRow(props.models, index, 'id', trimmed))
                    }}
                  />
                  <input
                    className={styles['input']}
                    type="text"
                    value={nameText}
                    placeholder={props.t('modelNamePlaceholder')}
                    aria-label={`${props.t('modelName')} ${n}`}
                    disabled={props.disabled}
                    onChange={(event) => {
                      commit(patchRow(props.models, index, 'name', event.target.value === '' ? undefined : event.target.value))
                    }}
                  />
                  {CAPACITY_FIELDS.map((field) => (
                    <input
                      key={field}
                      className={styles['input']}
                      type="text"
                      inputMode="numeric"
                      value={shownCapacity(model, index, field)}
                      placeholder={props.t(field === 'contextWindow' ? 'contextWindowPlaceholder' : 'maxTokensPlaceholder')}
                      aria-label={`${props.t(field)} ${n}`}
                      disabled={props.disabled}
                      onChange={(event) => {
                        const text = event.target.value
                        setBuffers(current => new Map(current).set(bufferKey(field, index), text))
                        commit(patchRow(props.models, index, field, parseCapacity(text)))
                      }}
                      onBlur={() => { finishCapacity(index, field) }}
                    />
                  ))}
                  <button
                    type="button"
                    className={`${styles['iconButton']} ${styles['iconButtonDanger']}`}
                    aria-label={`${props.t('removeModel')} ${n}`}
                    title={props.t('removeModel')}
                    disabled={props.disabled}
                    onClick={() => { dropRow(index) }}
                  >
                    <IconTrashOutlineRegular size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      <button type="button" className={styles['addModelButton']} disabled={props.disabled} onClick={appendBlank}>
        {props.t('addModel')}
        <IconPlusOutlineRegular size={14} />
      </button>
    </section>
  )
}
