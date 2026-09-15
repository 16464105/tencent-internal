/**
 * Copy dictionaries for the CodeBuddy settings page.
 * @module @deepseek-ai/dsh-llm-tencent-codebuddy/client/locales
 */

export const zh = {
  nav: 'CodeBuddy',
  title: 'Tencent CodeBuddy',
  intro: '在此页保存 CodeBuddy API 密钥。模型目录由适配器持有；首次进入不会弹出填写框。',
  keyInput: 'API 密钥',
  keyPlaceholder: '输入 API 密钥',
  keyStored: '已配置——输入新值可替换',
  keyMissing: '尚未配置密钥',
  keyEnvLocked: '由启动环境提供（只读）',
  apply: '保存',
  saved: '已保存',
  keyBlank: '请输入 API 密钥；留空则保持已存储的密钥。',
  keyIllegalCharacters: '该 API 密钥格式错误，请检查。',
} as const

export const en = {
  nav: 'CodeBuddy',
  title: 'Tencent CodeBuddy',
  intro: 'Store the CodeBuddy API key on this page. The adapter owns the model catalog; first-run does not prompt for the key.',
  keyInput: 'API key',
  keyPlaceholder: 'Enter API key',
  keyStored: 'Configured — type a new value to replace it',
  keyMissing: 'No key configured',
  keyEnvLocked: 'Provided by the launch environment (read-only)',
  apply: 'Save',
  saved: 'Saved',
  keyBlank: 'Enter the API key, or leave the field empty to keep the stored one.',
  keyIllegalCharacters: 'This API key is not in a valid format. Please check it.',
} as const

export type CodeBuddySettingsKey = keyof typeof en
