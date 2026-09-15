/**
 * Catalog draft helpers for the CodeBuddy Settings page.
 * @module @deepseek-ai/dsh-llm-tencent-codebuddy/client/models
 */

/** One catalog entry kept structurally open so hidden fields survive an edit. */
export type ModelDraft = Record<string, unknown>

/** A localized validation failure for one user-owned model array. */
export interface ModelsValidationFailure {
  /** Zero-based model position. */
  index: number
  /** Message key owned by the CodeBuddy settings page. */
  key: 'modelIdRequired' | 'modelIdDuplicate' | 'modelNameInvalid' | 'modelContextInvalid'
  | 'modelMaxTokensInvalid'
}

/** Accepted capacity spellings: a decimal count with an optional K/M suffix. */
const CAPACITY_PATTERN = /^(\d+(?:\.\d+)?)([km])?$/i
const THOUSAND = 1_000
const MILLION = 1_000_000

/**
 * Read a typed capacity so a user can write `256K` or `1M`.
 * @param text - raw field text.
 * @returns the count; `undefined` when blank, `NaN` when unreadable.
 */
export function parseCapacity(text: string): number | undefined {
  const trimmed = text.trim()
  if (trimmed.length === 0) return undefined
  const match = CAPACITY_PATTERN.exec(trimmed)
  if (match === null) return Number.NaN
  const suffix = match[2]?.toLowerCase()
  const scale = suffix === 'm' ? MILLION : suffix === 'k' ? THOUSAND : 1
  const scaled = Number(match[1]) * scale
  const rounded = Math.round(scaled)
  return Math.abs(scaled - rounded) < 1e-6 ? rounded : scaled
}

/**
 * Spell a stored count in the shortest form that survives {@link parseCapacity}.
 * @param value - stored capacity.
 * @returns the field text.
 */
export function formatCapacity(value: number): string {
  if (!Number.isInteger(value) || value <= 0) return String(value)
  if (value % MILLION === 0) return `${String(value / MILLION)}M`
  if (value % THOUSAND === 0) return `${String(value / THOUSAND)}K`
  return String(value)
}

/**
 * Convert a schema-validated catalog value into records without dropping hidden fields.
 * @param value - effective or user-owned `models` value.
 * @returns one draft per array entry; non-objects become empty records.
 */
export function modelDrafts(value: unknown): ModelDraft[] {
  if (!Array.isArray(value)) return []
  return value.map(entry =>
    typeof entry === 'object' && entry !== null && !Array.isArray(entry)
      ? entry as ModelDraft
      : {})
}

/**
 * Read one object field from a JSON settings value.
 * @param value - namespace `value` or `user` subtree.
 * @param key - field name.
 * @returns the field, or `undefined` when `value` is not a plain object.
 */
export function objectField(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  return (value as Record<string, unknown>)[key]
}

/**
 * Whether the user layer currently owns the whole `models` array.
 * @param user - redacted user subtree.
 * @returns `true` when `models` is present on that subtree.
 */
export function userOwnsModels(user: unknown): boolean {
  return typeof user === 'object' && user !== null && !Array.isArray(user)
    && Object.hasOwn(user, 'models')
}

/**
 * JSON-safe catalog payload for a settings `set` op.
 * @param models - current drafts.
 * @returns a clone that drops `undefined` fields.
 */
export function catalogPayload(models: readonly ModelDraft[]): unknown {
  return JSON.parse(JSON.stringify(models))
}

/**
 * Validate adapter constraints that the serialized schema cannot express.
 * @param value - user-owned `models` value, or undefined while inherited.
 * @returns the first invalid row, or undefined when the adapter will accept it.
 */
export function validateModels(value: unknown): ModelsValidationFailure | undefined {
  if (value === undefined) return undefined
  const models = modelDrafts(value)
  const seen = new Set<string>()
  for (const [index, model] of models.entries()) {
    const id = model['id']
    const trimmed = typeof id === 'string' ? id.trim() : undefined
    if (trimmed === undefined || trimmed.length === 0) return { index, key: 'modelIdRequired' }
    if (seen.has(trimmed)) return { index, key: 'modelIdDuplicate' }
    seen.add(trimmed)
    const name = model['name']
    if (name !== undefined && (typeof name !== 'string' || name.length === 0)) {
      return { index, key: 'modelNameInvalid' }
    }
    const contextWindow = model['contextWindow']
    if (contextWindow !== undefined
      && (typeof contextWindow !== 'number' || !Number.isInteger(contextWindow) || contextWindow <= 0)) {
      return { index, key: 'modelContextInvalid' }
    }
    const maxTokens = model['maxTokens']
    if (maxTokens !== undefined
      && (typeof maxTokens !== 'number' || !Number.isInteger(maxTokens) || maxTokens <= 0)) {
      return { index, key: 'modelMaxTokensInvalid' }
    }
  }
  return undefined
}
