/** Tencent CodeBuddy request headers and Chat Completions normalization. */

import { createHash, randomUUID } from 'node:crypto'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'

/** Tencent CodeBuddy API base used by the verified TT Switch integration. */
export const TENCENT_CODEBUDDY_BASE_URL = 'https://copilot.tencent.com/v2'

/** Minimum output limit accepted by the CodeBuddy Chat Completions endpoint. */
const MIN_MAX_TOKENS = 100

/** Stable request headers required by the CodeBuddy CLI route. */
const ROUTE_HEADERS: Readonly<Record<string, string>> = {
  'user-agent': 'CLI/2.113.0 CodeBuddy/2.113.0 CLI/2.113.0 CodeBuddy/2.113.0',
  'x-codebuddy-request': '1',
  'x-agent-intent': 'craft',
  'x-agent-purpose': 'conversation',
  'x-private-data': 'false',
  'x-ide-type': 'CLI',
  'x-ide-name': 'CLI',
  'x-ide-version': '2.113.0',
}

function compactUuid(): string {
  return randomUUID().replaceAll('-', '')
}

/** Header-safe stable identity for one Harness Session. */
function conversationId(sessionId: GenerateOptions['sessionId']): string {
  const value = sessionId === undefined ? compactUuid() : String(sessionId)
  if (/^[\x21-\x7E]+$/.test(value)) return value
  return createHash('sha256').update(value).digest('hex').slice(0, 32)
}

/**
 * Build one request's fixed and dynamic CodeBuddy headers.
 * @param options - frozen Harness request facts.
 * @returns headers whose conversation id is stable per Session and whose request ids are fresh per call.
 */
export function tencentRequestHeaders(options: Readonly<GenerateOptions>): Record<string, string> {
  return {
    ...ROUTE_HEADERS,
    'x-conversation-id': conversationId(options.sessionId),
    'x-conversation-request-id': compactUuid(),
    'x-request-id': compactUuid(),
    'x-conversation-message-id': compactUuid(),
  }
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.flatMap((part) => {
    if (typeof part !== 'object' || part === null) return []
    const text = (part as { text?: unknown }).text
    return typeof text === 'string' ? [text] : []
  }).join('\n')
}

function userContentParts(message: unknown): unknown[] | undefined {
  if (typeof message !== 'object' || message === null || Array.isArray(message)) return undefined
  const row = message as { role?: unknown; content?: unknown }
  if (row.role !== 'user') return undefined
  if (typeof row.content === 'string') return [{ type: 'text', text: row.content }]
  return Array.isArray(row.content) ? row.content : undefined
}

function hasImagePart(parts: readonly unknown[]): boolean {
  return parts.some((part) => {
    if (typeof part !== 'object' || part === null || Array.isArray(part)) return false
    return (part as { type?: unknown }).type === 'image_url'
  })
}

function mergeAdjacentImageUsers(messages: readonly unknown[]): unknown[] {
  const output: unknown[] = []
  for (let index = 0; index < messages.length;) {
    const first = messages[index]
    const firstParts = userContentParts(first)
    if (firstParts === undefined) {
      output.push(first)
      index += 1
      continue
    }

    let end = index + 1
    const parts = [...firstParts]
    let containsImage = hasImagePart(firstParts)
    while (end < messages.length) {
      const nextParts = userContentParts(messages[end])
      if (nextParts === undefined) break
      parts.push(...nextParts)
      containsImage ||= hasImagePart(nextParts)
      end += 1
    }

    if (containsImage && end > index + 1) {
      output.push({ ...(first as Record<string, unknown>), content: parts })
    } else {
      output.push(...messages.slice(index, end))
    }
    index = end
  }
  return output
}

function stripCacheControl(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripCacheControl)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== 'cache_control')
    .map(([key, child]) => [key, stripCacheControl(child)]))
}

function toolName(tool: unknown): string | undefined {
  if (typeof tool !== 'object' || tool === null) return undefined
  const row = tool as { name?: unknown; function?: { name?: unknown } }
  const candidate = row.function?.name ?? row.name
  return typeof candidate === 'string' ? candidate : undefined
}

function forcedToolName(choice: unknown): string | undefined {
  if (typeof choice !== 'object' || choice === null) return undefined
  const row = choice as { type?: unknown; name?: unknown; function?: { name?: unknown } }
  if (row.type !== 'function' && row.type !== 'tool') return undefined
  const candidate = row.type === 'function' ? row.function?.name : row.name
  if (typeof candidate !== 'string' || candidate.trim() === '') {
    throw new Error('tencent-codebuddy: named tool_choice is missing a tool name')
  }
  return candidate
}

function normalizeToolChoice(body: Record<string, unknown>): void {
  const choice = body.tool_choice
  if (choice === undefined) return
  const forced = forcedToolName(choice)
  if (forced !== undefined) {
    if (!Array.isArray(body.tools)) {
      throw new Error(`tencent-codebuddy: tool_choice forces "${forced}", but the request has no tools`)
    }
    const matches = body.tools.filter(tool => toolName(tool) === forced)
    if (matches.length !== 1) {
      throw new Error(
        `tencent-codebuddy: tool_choice forces ${matches.length === 0 ? 'unknown' : 'ambiguous'} tool "${forced}"`,
      )
    }
    body.tools = matches
  }
  if (typeof choice === 'string') {
    if (choice === 'any') body.tool_choice = 'required'
    return
  }
  if (typeof choice !== 'object' || choice === null) {
    body.tool_choice = 'auto'
    return
  }
  const kind = (choice as { type?: unknown }).type
  body.tool_choice = kind === 'auto' || kind === 'none' ? kind : 'required'
}

/**
 * Normalize a pi-ai Chat Completions payload for Tencent CodeBuddy.
 * @param payload - provider payload produced by pi-ai.
 * @returns a detached payload with the CodeBuddy message and option requirements applied.
 */
export function normalizeTencentPayload(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error('tencent-codebuddy: pi-ai produced a non-object request payload')
  }
  const cleaned = stripCacheControl(payload) as Record<string, unknown>
  const input = Array.isArray(cleaned.messages) ? cleaned.messages : []
  const systemParts: string[] = []
  const messages: unknown[] = []
  for (const message of input) {
    if (typeof message !== 'object' || message === null) {
      messages.push(message)
      continue
    }
    const role = (message as { role?: unknown }).role
    if (role === 'system' || role === 'developer') {
      const text = textOf((message as { content?: unknown }).content).trim()
      if (text !== '') systemParts.push(text)
      continue
    }
    messages.push(message)
  }
  const system = systemParts.length === 0 ? 'You are a helpful assistant.' : systemParts.join('\n\n')
  messages.unshift({ role: 'system', content: system })
  const firstRole = (messages[1] as { role?: unknown } | undefined)?.role
  if (firstRole !== 'user') messages.splice(1, 0, { role: 'user', content: 'Hello' })
  cleaned.messages = mergeAdjacentImageUsers(messages)
  cleaned.stream = true
  cleaned.stream_options = { include_usage: true }

  const requested = typeof cleaned.max_tokens === 'number'
    ? cleaned.max_tokens
    : typeof cleaned.max_completion_tokens === 'number'
      ? cleaned.max_completion_tokens
      : undefined
  if (requested !== undefined) cleaned.max_tokens = Math.max(MIN_MAX_TOKENS, requested)
  delete cleaned.max_completion_tokens
  normalizeToolChoice(cleaned)
  return cleaned
}
