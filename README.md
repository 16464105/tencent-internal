# Tencent CodeBuddy for DeepSeek Harness

Installable dsh profile bundle: the `tencent-internal` route, a package-owned model catalog, and `tencent-internal/hy3-ioa` as the default model.

Store the CodeBuddy key on **Settings → CodeBuddy** or through the credentials service (`TENCENT_CODEBUDDY_API_KEY`). First-run does not prompt for it. The package ships a `dsh.client` settings page, so a git install does not need a Models-page layout.

English | [中文](README.zh.md)

## Install

Requires an initialized dsh profile that already includes `@deepseek-ai/dsh-base`.

```sh
dsh plugin --profile web add github:16464105/tencent-internal
```

pnpm ≥10 blocks a git dependency's `prepare` build until you allow it. The first `add` fails with an `allowBuilds` hint; copy the printed key into the profile's `pnpm-workspace.yaml` and re-run:

```sh
# ~/.dsh/profiles/web/pnpm-workspace.yaml
allowBuilds:
  "@deepseek-ai/dsh-llm-tencent-codebuddy": true

dsh plugin --profile web add github:16464105/tencent-internal
dsh --profile web
```

The same `add` / `remove` pair works for `headless`, `sdk`, and `acp`. Pin a commit if you want a frozen source:

```sh
dsh plugin --profile web add github:16464105/tencent-internal#<sha>
dsh plugin --profile web remove @deepseek-ai/dsh-llm-tencent-codebuddy
```

From a local checkout:

```sh
dsh plugin --profile web add file:/absolute/path/to/tencent-internal
```

Do not add this bundle to a profile that already inserts `llm-tencent-codebuddy`. The shipped desktop profile already mounts the same adapter through `dsh-desktop-app`; a second insert duplicates the row.

## What you get

| Fact | Value |
|---|---|
| Provider route | `tencent-internal` |
| Display name | `Tencent CodeBuddy` |
| Endpoint | `https://copilot.tencent.com/v2` |
| Protocol | OpenAI Chat Completions |
| Default model | `hy3-ioa` |
| Default credential | `TENCENT_CODEBUDDY_API_KEY` |

Official DeepSeek stays mounted. The endpoint, protocol, headers, and catalog stay package-owned; callers cannot redirect the trusted key to another endpoint through settings.

## Configuration

```yaml
- id: llm-tencent-codebuddy
  name: '@deepseek-ai/dsh-llm-tencent-codebuddy'
  config:
    apiKeyEnv: TENCENT_CODEBUDDY_API_KEY
    models:                          # optional; omission serves the fixed catalog
      - id: gateway-new-model
        name: Gateway New Model
        contextWindow: 262144
    timeoutMs: 300000
    streamIdleTimeoutMs: 300000
    retryPolicy:
      mode: normal
```
