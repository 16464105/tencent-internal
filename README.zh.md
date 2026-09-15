# DeepSeek Harness 的腾讯 CodeBuddy 插件

可安装的 dsh profile 组合包：注册 `tencent-internal` 路由、随包模型目录，并把默认模型设为 `tencent-internal/gpt-5.6-sol`。

在 Models 页面或凭据服务中填写 CodeBuddy Key（`TENCENT_CODEBUDDY_API_KEY`）。首次进入不会弹出填 Key 对话框。

[English](README.md) | 中文

## 安装

目标 profile 需要已经包含 `@deepseek-ai/dsh-base`。

```sh
dsh plugin --profile web add github:16464105/tencent-internal
```

pnpm ≥10 会拦截 git 依赖的 `prepare` 构建，直到你显式允许。第一次 `add` 会失败并打印 `allowBuilds` 提示；把打印出的包名写进该 profile 的 `pnpm-workspace.yaml` 后再执行一次：

```sh
# ~/.dsh/profiles/web/pnpm-workspace.yaml
allowBuilds:
  "@deepseek-ai/dsh-llm-tencent-codebuddy": true

dsh plugin --profile web add github:16464105/tencent-internal
dsh --profile web
```

`headless`、`sdk`、`acp` 同样用 `add` / `remove`。需要冻结源码时请钉 commit：

```sh
dsh plugin --profile web add github:16464105/tencent-internal#<sha>
dsh plugin --profile web remove @deepseek-ai/dsh-llm-tencent-codebuddy
```

从本地目录安装：

```sh
dsh plugin --profile web add file:/absolute/path/to/tencent-internal
```

不要把本组合包加到已经插入 `llm-tencent-codebuddy` 的 profile。随附的 desktop profile 已经通过 `dsh-desktop-app` 挂载同一适配器；再插入一次会得到重复行。

## 安装后得到什么

| 事实 | 值 |
|---|---|
| 提供商路由 | `tencent-internal` |
| 显示名 | `Tencent CodeBuddy` |
| 接口 | `https://copilot.tencent.com/v2` |
| 协议 | OpenAI Chat Completions |
| 默认模型 | `gpt-5.6-sol` |
| 默认凭据 | `TENCENT_CODEBUDDY_API_KEY` |

官方 DeepSeek 仍然保留。接口地址、协议、请求头和模型目录由本包固定；不能通过设置把受信任 Key 指到别的地址。

## 配置

```yaml
- id: llm-tencent-codebuddy
  name: '@deepseek-ai/dsh-llm-tencent-codebuddy'
  config:
    apiKeyEnv: TENCENT_CODEBUDDY_API_KEY
    models:                          # 可选；省略则使用随包目录
      - id: gateway-new-model
        name: Gateway New Model
        contextWindow: 262144
    timeoutMs: 300000
    streamIdleTimeoutMs: 300000
    retryPolicy:
      mode: normal
```
