# v22 Runtime Bridge Session Run File ProviderKeyRef Boundary Contract

本合同定义 OPL 工作台到 Runtime Bridge 的最小本地合同：session 绑定、run 提交、文件引用、artifact 引用和 `providerKeyRef` 透传。它只覆盖 `platform-provisioned / customer-dedicated` 托管工作台边界，不接真实云，不修改 one-person-lab upstream。

## Product Boundary

用户主路径是：

- 用户从 `opl.medopl.cn` 进入 OPL 科研工作台。
- OPL Web 通过 httpOnly cookie 或服务端 launch session 拉取 bootstrap；launch token 不得进入 URL query、localStorage、sessionStorage 或 browser public state。
- OPL Web 绑定工作台 session，并只把 provider 绑定结果传成 `providerKeyRef`。
- OPL Web 用 workspace file reference 发起 Runtime Bridge run。
- Runtime Bridge 返回 run record 和公开 artifact reference。

不得把 CVM、COS、K8s、TKE 或云资源控制台作为用户主语言。

## Runtime Bridge Endpoints

公开入口保持在 Runtime Bridge 边界：

```text
POST /api/opl-launch/tokens
GET  /api/opl-launch/bootstrap
POST /api/opl-launch/sessions/bind
POST /api/opl-launch/runs
GET  /api/opl-launch/runs/{runId}/status
GET  /api/opl-launch/runs/{runId}/artifacts
POST /api/opl-launch/messages
GET  /api/opl-launch/messages/{messageId}/status
```

旧入口 `/api/runtime-sessions` 和 `/api/runtime-sessions/{id}/runs` 保持 retired，不得作为 v22 新主路径。

以下 token 在 active surface 视为 retired/forbidden：

- retired resource-order identifier family（包括 snake/camel/kebab 旧字段族）
- `opencost-pending`
- `launch_token` URL query 语义
- 未脱敏 `promptPreview`

## Session Contract

OPL session 绑定必须满足：

- 输入可包含 `oplSessionId`、`provider=gflabtoken`、`source=user_input` 和一次性 raw API key。
- raw API key 只能进入 Runtime Bridge 后端 provider secret store。
- Runtime Bridge 对外只返回 `providerKeyRef`、`providerConfigured`、`providerConfigStatus` 和普通 session identity。
- session 必须绑定 `tenantId`、`portalUserId`、`workspaceId`、`workspaceSessionId`、`runtimeSessionId` 和 `resourceBindingId`。
- response、trace、evidence 和 git 不得包含 raw API key、bearer token、`launchToken` 或 `runtimeToken`。

## Run Contract

`POST /api/opl-launch/runs` 必须满足：

- 请求必须通过 httpOnly cookie 或服务端 launch session 完成授权，并命中同一个 `runtimeSessionId`；launch token 不得通过 URL query 传递。
- run 只接受 `mode=full_runtime`。
- 缺少 `resourceBindingId`、`computeInstanceId` 或 `storageBucketId` 时返回 `RESOURCE_BINDING_REQUIRED`。
- 缺少 Runtime Agent identity/endpoint 时返回 `PLATFORM_PROVISIONED_RUNTIME_AGENT_REQUIRED`。
- Runtime Bridge 传给 Runtime Agent 的 provider 信息只能是 `providerKeyRef`，不得传 raw API key。
- Runtime Bridge 持久化 run 时必须保留 `traceId`、`workspaceId`、`runtimeSessionId`、`resourceBindingId` 和 `providerKeyRef`。
- Runtime Agent 返回的 ledger entry 必须经过 Runtime Bridge 白名单净化，不得把 `ledgerEntries[].rawPayload` 原样保存。

当前分支只定义本地合同和 mock Runtime Agent relay 小闭包；不接真实云、不创建真实运行节点、不调用真实 Runtime Agent。

## File And Artifact Contract

输入文件和输出文件必须使用公开引用：

- OPL Web 传入 workspace file reference，例如 `fileRefs=["workspace-file-ref-..."]`。
- Runtime Bridge response 只能返回公开 artifact reference。
- 公开 artifact shape 只允许包含 `artifactId`、`artifactRef`、`runId`、`workspaceId`、`resourceBindingId`、`providerKeyRef`、`kind`、`name`、`relativePath`、`sizeBytes` 和 `contentType`。
- `storageKey`、`objectKey`、`localPath`、`signedUrl`、`presignedUrl` 和 runtime 私有路径只能留在后端状态边界，不得进入公开 response。
- session ledger 可以记录公开 `artifactRef`，不得记录 raw key 或 token。
- session ledger 不得保存 Runtime Agent 的 `rawPayload` 原文或基于原文的 `payloadHash`；只能保存白名单后的安全 ledger metadata。

## Trace And Ledger Boundary

trace / ledger metadata 允许包含：

- `ledgerEntryId`
- `tenantId`
- `portalUserId`
- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `sessionId`
- `resourceBindingId`
- `runId`
- `traceId`
- `providerKeyRef`
- artifact reference list
- usage / cost summary
- status / event type / timestamps
- sanitized metadata

trace / ledger metadata 不得包含 raw prompt、raw API key、`launchToken`、`runtimeToken`、bearer token、internal storage key、local path 或 signed URL。

Runtime Bridge ledger 净化规则是白名单规则：

- `ledgerEntryId` 由 Runtime Bridge 本地生成；`sessionId`、`runId`、`traceId`、`workspaceId`、`resourceBindingId`、`providerKeyRef` 来自已验证的 runtime/session/run context 或公开 id。
- `artifactRefs` 只能来自 Runtime Bridge 生成的公开 artifact reference。
- `usage` 只保留非负数值摘要，例如 input/output/total token count。
- `costSummary` 只保留三位货币代码和非负数值摘要。
- `status` 和 `eventType` 只保留 Runtime Bridge 允许集合中的枚举值。
- `metadata` 只保留 Runtime Bridge 明确允许的安全字段，例如 `publicStatus`。
- `rawPayload`、raw prompt、raw API key、`providerApiKey`、`apiKey`、`launchToken`、`runtimeToken`、bearer token、`objectKey`、`storageKey`、`localPath`、`signedUrl`、`presignedUrl` 和 internal storage key 必须被丢弃。

## Upstream Boundary

one-person-lab upstream 必须保持 clean：

- 不修改 upstream 源码。
- 不 import upstream 内部模块。
- 不在 upstream 目录写 Portal、Gateway、Runtime Bridge 或 Runtime Agent 代码。
- 通过 Gateway、Runtime Bridge、Runtime Agent、API/CLI 等公开边界适配。

## Non-goals

- 不实现真实云资源开通。
- 不调用真实云 API。
- 不读取 secret。
- 不运行 build/push/kubectl/live-test。
- 不改 deploy、`.sentrux`、`adapters` 或 upstream。
- 不改 UI 文案。
- 不把全局 Sentrux 阈值作为本合同目标。

## Smoke

本合同由本地 smoke 固化：

```text
node tests/smoke/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs
```

该 smoke 只使用本地 mock `runtimeAgentRelay` 和内存 state，不读取 `/home/dev/.secrets/medopl/secrets.env.txt`，不调用真实云 API，不启动真实 Runtime Agent。
