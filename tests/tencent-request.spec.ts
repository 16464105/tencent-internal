import { describe, expect, it } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import {
  normalizeTencentPayload,
  tencentRequestHeaders,
} from '../src/tencent-request.ts'

describe('Tencent CodeBuddy request normalization', () => {
  it('adds stable conversation and fresh request identities', () => {
    const options = {
      provider: 'tencent-internal',
      model: 'gpt-5.6-sol',
      messages: [],
      sessionId: SessionId('session-a'),
    }
    const first = tencentRequestHeaders(options)
    const second = tencentRequestHeaders(options)

    expect(first).toMatchObject({
      'user-agent': 'CLI/2.113.0 CodeBuddy/2.113.0 CLI/2.113.0 CodeBuddy/2.113.0',
      'x-codebuddy-request': '1',
      'x-agent-intent': 'craft',
      'x-agent-purpose': 'conversation',
      'x-private-data': 'false',
      'x-ide-type': 'CLI',
      'x-ide-name': 'CLI',
      'x-ide-version': '2.113.0',
      'x-conversation-id': 'session-a',
    })
    expect(second['x-conversation-id']).toBe(first['x-conversation-id'])
    expect(second['x-request-id']).not.toBe(first['x-request-id'])
    expect(second['x-conversation-request-id']).not.toBe(first['x-conversation-request-id'])
    expect(first['x-conversation-message-id']).not.toBe(first['x-request-id'])
  })

  it('normalizes messages, streaming, tokens, cache markers, and named tool choice', () => {
    const payload = normalizeTencentPayload({
      model: 'gpt-5.6-sol',
      messages: [
        { role: 'assistant', content: 'prior' },
        { role: 'developer', content: 'Follow policy.' },
      ],
      max_completion_tokens: 20,
      tools: [
        { type: 'function', function: { name: 'read', parameters: {} } },
        { type: 'function', function: { name: 'write', parameters: {} }, cache_control: { type: 'ephemeral' } },
      ],
      tool_choice: { type: 'function', function: { name: 'write' } },
    }) as Record<string, unknown>

    expect(payload).toMatchObject({
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 100,
      tool_choice: 'required',
      messages: [
        { role: 'system', content: 'Follow policy.' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'prior' },
      ],
      tools: [{ type: 'function', function: { name: 'write', parameters: {} } }],
    })
    expect(payload).not.toHaveProperty('max_completion_tokens')
    expect(JSON.stringify(payload)).not.toContain('cache_control')
  })

  it('keeps an existing leading user and maps any tool choice to required', () => {
    expect(normalizeTencentPayload({
      messages: [{ role: 'system', content: 'System' }, { role: 'user', content: 'Question' }],
      tool_choice: 'any',
      max_tokens: 256,
    })).toMatchObject({
      messages: [{ role: 'system', content: 'System' }, { role: 'user', content: 'Question' }],
      tool_choice: 'required',
      max_tokens: 256,
    })
  })

  it('keeps images in Tencent current-user input when context follows the prompt', () => {
    const image = {
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,AAAA' },
    }
    expect(normalizeTencentPayload({
      messages: [
        { role: 'system', content: 'System' },
        { role: 'user', content: [image, { type: 'text', text: 'Read this image.' }] },
        { role: 'user', content: '<system-reminder>Workspace context.</system-reminder>' },
      ],
    })).toMatchObject({
      messages: [
        { role: 'system', content: 'System' },
        {
          role: 'user',
          content: [
            image,
            { type: 'text', text: 'Read this image.' },
            { type: 'text', text: '<system-reminder>Workspace context.</system-reminder>' },
          ],
        },
      ],
    })
  })

  it('does not merge text-only or role-separated user messages', () => {
    const textOnly = normalizeTencentPayload({
      messages: [
        { role: 'user', content: 'First' },
        { role: 'user', content: 'Second' },
      ],
    }) as { messages: unknown[] }
    expect(textOnly.messages).toEqual([
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'First' },
      { role: 'user', content: 'Second' },
    ])

    const separated = normalizeTencentPayload({
      messages: [
        {
          role: 'user',
          content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } }],
        },
        { role: 'assistant', content: 'Seen.' },
        { role: 'user', content: 'Continue.' },
      ],
    }) as { messages: unknown[] }
    expect(separated.messages).toHaveLength(4)
  })

  it('rejects a named tool choice that cannot resolve exactly one tool', () => {
    expect(() => normalizeTencentPayload({
      messages: [],
      tools: [],
      tool_choice: { type: 'function', function: { name: 'missing' } },
    })).toThrow('forces unknown tool "missing"')
  })
})
