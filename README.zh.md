# DeepSeek Harness 的腾讯 CodeBuddy 插件

可安装的 dsh profile 组合包：注册 `tencent-internal` 路由、随包模型目录，并把默认模型设为 `tencent-internal/hy3-ioa`。

在 **设置 → CodeBuddy** 保存 CodeBuddy Key（`TENCENT_CODEBUDDY_API_KEY`）并编辑模型目录，或通过凭据服务存储该 Key。首次进入不会弹出填 Key 对话框。本包自带 `dsh.client` 设置页，因此 git 安装不依赖 Models 页面的布局。

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
| 默认模型 | `hy3-ioa` |
| 默认凭据 | `TENCENT_CODEBUDDY_API_KEY` |

官方 DeepSeek 仍然保留。接口地址、协议、请求头和模型目录由本包固定；不能通过设置把受信任 Key 指到别的地址。

## 模型目录

未配置 `models` 时，路由按以下顺序取第一个有结果的来源：

| 顺序 | 来源 | 前提 |
|---|---|---|
| 1 | Cordis 行里的 `models`（设置 → CodeBuddy） | — |
| 2 | tt-switch 签名发布文件（`releases/tencent_models.json`） | 本机什么都不需要 |
| 3 | 上游 `/v3/config` | 已保存凭据 |
| 4 | 本地 CodeBuddy 桌面端的缓存 | 装了桌面端 |
| 5 | 随包内置的目录 | — |

tt-switch 发布文件是本机一开始就有的那份目录：它与 tt-switch 二进制读的是同一个文件，带签名（对 Base64 payload 做 HMAC-SHA256），既不需要 Key 也不需要桌面端。每 10 分钟后台刷新一次；读取失败时继续沿用上一次的目录。

在 Cordis 行上配置 `catalogSignatureKey` 才会校验签名。该字段刻意设为**非** volatile，因此设置页不会承载签名密钥；未配置时仅凭 HTTPS 信任该次读取，路由每次都会打印 `signature unchecked`。密钥不匹配则整份目录作废。

发布文件里还带 `managedModelIds` 与 `modelFallbacks`（旧模型名 → 新模型名）。两者仅作为诊断信息上报：本路由照旧提供网关仍在应答的那个 id，白名单与静默重写该由部署方决定，而不是插件。

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

## 宿主版本兼容

| dsh | 「设置 → CodeBuddy」分区是怎么注册的 |
|---|---|
| ≥ 0.1.7 | 设置服务直接由本条目的 Config 推导出分区。本包把 `apiKeyEnv` 与 `models` 声明为 **volatile**（表单接口只投影 volatile 字段），并关掉自动生成的插件页，因此自带的设置页仍是编辑 Key 与模型目录的唯一入口。 |
| ≤ 0.1.6 | 仍走 `settings.installSection()`，并通过 `setSource` 接收配置回推。 |

在 ≥ 0.1.7 上如果把 `models` 写成非 volatile，表单接口就投影不出 `llm-tencent-codebuddy` 命名空间——页面会显示「Host 尚未注册该适配器的 settings 分区」，且目录写入会被拒绝。
