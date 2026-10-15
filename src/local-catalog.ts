/**
 * Live model catalog for the Tencent CodeBuddy route, read from the CodeBuddy
 * desktop client on this machine.
 *
 * The gateway exposes no OpenAI-compatible `/models` listing, and the model
 * deployment moves without this package: `catalog.ts` is a checked-in
 * projection that goes stale as soon as the client's own list changes. The
 * client keeps that list in the VS Code-style global state database it ships
 * (`User/globalStorage/state.vscdb`), so this module projects the same facts
 * from the file the user's client already keeps current, and leaves
 * {@link TENCENT_CODEBUDDY_MODELS} as the fallback for a machine that has no
 * such client.
 *
 * The projection drops what a chat route cannot use: `supportsExtra` helper
 * models (inline completion, `codewise-*`), the text-to-image entry, and any
 * model the client does not offer tool calls for — the Harness drives an agent
 * turn through tools, so such an entry can only fail. Each surviving entry's
 * display name carries the client's credit multiplier (`x0.67`), because a
 * Harness selector renders the display name and nothing else, and what a model
 * costs belongs where it is chosen. Read failures never
 * throw: a missing, unreadable, or unrecognized database yields `undefined`
 * and the caller keeps the checked-in catalog.
 *
 * @module dsh-llm-tencent-codebuddy/local-catalog
 */

import { readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { PiAiModelProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import { NON_CHAT_TAGS } from './upstream-catalog.ts'

/** Environment variable naming a state database (or a JSON file) to read instead of the defaults. */
export const TENCENT_CODEBUDDY_MODELS_DB = 'TENCENT_CODEBUDDY_MODELS_DB'

/** State key the CodeBuddy extension keeps its product facts under. */
const STATE_KEY = 'Tencent-Cloud.coding-copilot'

/**
 * Routes every account can see but not every account may call. `hy-hr` serves
 * L4 HR data and the gateway refuses it without that clearance, so listing it
 * only offers a model whose every request fails; an explicit `models`
 * configuration still overrides this list.
 */
const EXCLUDED_MODEL_IDS: readonly string[] = ['hy-hr']

/** Output capability the client reports for provider-internal reasons beyond any chat ceiling. */
const MAX_OUTPUT_TOKENS = 128_000

/** Output capability assumed when the client names none. */
const DEFAULT_OUTPUT_TOKENS = 32_768

/** How long one read is reused before the database is looked at again. */
const REFRESH_INTERVAL_MS = 60_000

/** State database locations the CodeBuddy desktop client uses, most specific first. */
function candidatePaths(): readonly string[] {
  const home = homedir()
  const override = process.env[TENCENT_CODEBUDDY_MODELS_DB]
  const database = 'User/globalStorage/state.vscdb'
  const appData = process.env.APPDATA ?? join(home, 'AppData/Roaming')
  return [
    ...override === undefined || override === '' ? [] : [override],
    ...process.platform === 'darwin'
      ? [
          join(home, 'Library/Application Support/CodeBuddy CN', database),
          join(home, 'Library/Application Support/CodeBuddy', database),
        ]
      : [],
    ...process.platform === 'win32'
      ? [join(appData, 'CodeBuddy CN', database), join(appData, 'CodeBuddy', database)]
      : [],
    ...process.platform === 'linux'
      ? [
          join(home, '.config/CodeBuddy CN', database),
          join(home, '.config/CodeBuddy', database),
        ]
      : [],
  ]
}

/** One model as the desktop client records it. Every field is optional: the client owns this shape. */
interface ClientModel {
  readonly id?: unknown
  readonly name?: unknown
  /** Credit multiplier as the client spells it, e.g. `x0.67`. */
  readonly credits?: unknown
  readonly maxInputTokens?: unknown
  readonly maxOutputTokens?: unknown
  readonly supportsImages?: unknown
  readonly supportsReasoning?: unknown
  readonly supportsToolCall?: unknown
  readonly supportsExtra?: unknown
  readonly contextWindow?: { readonly defaultLength?: unknown } | null
  readonly tags?: readonly unknown[] | null
}

/** @param value - candidate JSON value. @returns the positive integer it holds, or undefined. */
function numberOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined
}

/**
 * Project one client entry onto this adapter's catalog.
 * @param model - entry as the client records it.
 * @returns the chat-route profile, or undefined when the entry is not a chat route.
 */
function profileOf(model: ClientModel): PiAiModelProfile | undefined {
  const id = typeof model.id === 'string' ? model.id : undefined
  if (id === undefined || id === '') return undefined
  if (EXCLUDED_MODEL_IDS.includes(id)) return undefined
  // Helper and image routes are not chat routes the Harness can drive.
  if (model.supportsExtra === true) return undefined
  if ((model.tags ?? []).some(tag => typeof tag === 'string' && NON_CHAT_TAGS.test(tag))) return undefined
  // An agent turn runs on tool calls; a model without them cannot serve this route.
  if (model.supportsToolCall === false) return undefined
  const contextWindow = numberOf(model.maxInputTokens) ?? numberOf(model.contextWindow?.defaultLength)
  if (contextWindow === undefined) return undefined
  const maxTokens = Math.min(numberOf(model.maxOutputTokens) ?? DEFAULT_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS)
  const label = typeof model.name === 'string' && model.name !== '' ? model.name : id
  // The Harness selector renders a model's display name and nothing else, so the
  // gateway's credit multiplier rides in it — the one place a chooser can read
  // what a model costs. The client spells it `x0.67`; a model without one keeps
  // its bare name.
  const credits = typeof model.credits === 'string' && model.credits !== '' ? model.credits : undefined
  return {
    id,
    name: credits === undefined ? label : `${label} (${credits})`,
    contextWindow,
    maxTokens,
    input: model.supportsImages === true ? ['text', 'image'] : ['text'],
    ...model.supportsReasoning === true
      ? {
          reasoningEfforts: { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
          compat: { thinkingFormat: 'openai' as const, supportsReasoningEffort: true },
        }
      : { reasoningEfforts: false as const },
  }
}

/** @param entries - candidate model list. @returns the projected chat catalog, or undefined when it names none. */
function catalogOf(entries: readonly unknown[]): readonly PiAiModelProfile[] | undefined {
  const models: PiAiModelProfile[] = []
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue
    const profile = profileOf(entry as ClientModel)
    if (profile !== undefined) models.push(profile)
  }
  return models.length > 0 ? models : undefined
}

/** @param entries - candidate array. @returns whether it holds model objects rather than bare ids. */
function namesModels(entries: readonly unknown[]): boolean {
  const first = entries[0]
  return typeof first === 'object' && first !== null && typeof (first as { id?: unknown }).id === 'string'
}

/**
 * Read the `"models"` array the client stores beside its other product facts.
 * The state names several arrays `models` (mode rosters of bare ids, gate
 * rules), so a candidate holding model objects outranks a longer one holding
 * ids, and only the longest of a kind is kept.
 * @param text - state text decoded as UTF-8.
 * @returns the model array the text carries, or undefined.
 */
function arrayIn(text: string): readonly unknown[] | undefined {
  const marker = '"models":['
  let best: readonly unknown[] | undefined
  for (let at = text.indexOf(marker); at >= 0; at = text.indexOf(marker, at + 1)) {
    const start = at + marker.length - 1
    let depth = 0
    let end = -1
    for (let index = start; index < text.length; index += 1) {
      const character = text[index]
      if (character === '[') depth += 1
      else if (character === ']') {
        depth -= 1
        if (depth === 0) { end = index + 1; break }
      }
    }
    if (end < 0) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(text.slice(start, end))
    } catch {
      continue
    }
    if (!Array.isArray(parsed)) continue
    if (best === undefined) { best = parsed; continue }
    const better = namesModels(parsed) === namesModels(best)
      ? parsed.length > best.length
      : namesModels(parsed)
    if (better) best = parsed
  }
  return best
}

/**
 * Read the model list out of one parsed state value. The value is the
 * extension's whole state, whose `models` field this reads when a shape
 * carries one; a value that is itself the list is accepted too.
 * @param parsed - parsed state value.
 * @returns the candidate entries, or undefined when the value names none.
 */
function modelsIn(parsed: unknown): readonly unknown[] | undefined {
  if (Array.isArray(parsed)) return parsed
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const field = (parsed as { models?: unknown }).models
  return Array.isArray(field) ? field : undefined
}

/** @param text - state text. @returns the projected catalog from the field it carries, or undefined. */
function catalogFromState(text: string): readonly PiAiModelProfile[] | undefined {
  try {
    const field = modelsIn(JSON.parse(text))
    const fromField = field === undefined ? undefined : catalogOf(field)
    if (fromField !== undefined) return fromField
  } catch {
    // A database file read as text is not JSON; the array scan below covers it.
  }
  const entries = arrayIn(text)
  return entries === undefined ? undefined : catalogOf(entries)
}

/** @param value - column value. @returns its text, or undefined for an unexpected encoding. */
function textOf(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  return value instanceof Uint8Array ? Buffer.from(value).toString('utf8') : undefined
}

/**
 * Read the state row through SQLite. A row's text is stored across the
 * database's pages, so only the database engine can reassemble it: scanning
 * the file's bytes instead yields the fragments page order happens to place
 * first, which is why this is the primary read and {@link fromRawFile} only
 * covers a runtime without `node:sqlite`.
 * @param path - state database.
 * @returns the projected catalog, or undefined when the row is absent or unusable.
 */
function fromStateDatabase(path: string): readonly PiAiModelProfile[] | undefined {
  let sqlite: typeof import('node:sqlite')
  try {
    sqlite = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
  } catch {
    return undefined
  }
  try {
    const database = new sqlite.DatabaseSync(path, { readOnly: true })
    try {
      const row = database.prepare('SELECT value FROM ItemTable WHERE key = ?').get(STATE_KEY) as { value?: unknown } | undefined
      const text = row === undefined ? undefined : textOf(row.value)
      return text === undefined ? undefined : catalogFromState(text)
    } finally {
      database.close()
    }
  } catch {
    return undefined
  }
}

/** @param path - JSON file carrying `models`. @returns the projected catalog, or undefined. */
function fromJsonFile(path: string): readonly PiAiModelProfile[] | undefined {
  try {
    return catalogFromState(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }
}

/** @param path - state database read as text. @returns the projected catalog from its cleanest copy, or undefined. */
function fromRawFile(path: string): readonly PiAiModelProfile[] | undefined {
  try {
    return catalogFromState(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }
}

/** Last read this process performed, whichever way it went. */
let last:
  | {
      readonly at: number
      readonly path?: string
      readonly stamp?: string
      readonly models?: readonly PiAiModelProfile[]
    }
  | undefined

/**
 * Read this machine's CodeBuddy client catalog. One read is reused for
 * {@link REFRESH_INTERVAL_MS}, and a file that did not change is not parsed
 * again, so calling this per resolution stays cheap while an updated client
 * list is picked up on the next call after the interval.
 * @param now - current epoch milliseconds, injectable for tests.
 * @returns the projected catalog, or undefined when this machine has no readable client list.
 */
export function readLocalCatalog(now = Date.now()): readonly PiAiModelProfile[] | undefined {
  if (last !== undefined && now - last.at < REFRESH_INTERVAL_MS) return last.models
  for (const path of candidatePaths()) {
    let stamp: string
    try {
      const stats = statSync(path)
      if (!stats.isFile()) continue
      stamp = `${String(stats.size)}:${String(stats.mtimeMs)}`
    } catch {
      continue
    }
    if (last?.models !== undefined && last.path === path && last.stamp === stamp) {
      last = { at: now, path, stamp, models: last.models }
      return last.models
    }
    const models = path.endsWith('.json')
      ? fromJsonFile(path)
      : (fromStateDatabase(path) ?? fromRawFile(path))
    if (models === undefined) continue
    last = { at: now, path, stamp, models }
    return models
  }
  last = { at: now }
  return undefined
}
