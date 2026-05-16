# v22 Portal-OPL Connection Boundary Contract

本合同定义 MedOPL v22 中 Portal 与 clean upstream OPL Web 的连接闭环。它只定义 Portal、OPL Web Gateway、Portal OPL Adapter / Runtime Agent 之间的边界，不修改 one-person-lab upstream，不 import upstream 内部模块，不读取 secret，不调用真实云 API，不运行 build/push/kubectl/live-test。

## Product Truth

MedOPL 的 OPL 连接闭环不是“能打开 OPL 页面”就完成。闭环必须是：

1. Portal 发起进入 OPL。
2. Gateway 打开 clean upstream OPL。
3. OPL 获取 MedOPL 公开上下文。
4. OPL session 绑定到 Portal 用户、tenant、workspace 和 runtime session。
5. OPL 发消息、上传文件或发起 run。
6. Runtime Agent 生成 run record、artifact reference、trace metadata 和 billing metadata。
7. Portal 按 workspace/session/run 展示文件、账单和运行轨迹。

one-person-lab upstream 只能作为 clean upstream 工作台。Portal 账号、密钥、资源绑定、计费、审计、trace 和腾讯云逻辑不得写进 upstream。

## Required Interfaces

Portal-OPL 连接闭环至少需要以下接口。路径名称表达合同角色；实现可以保留内部旧路径，但用户入口、合同入口和后续新实现必须收敛到这些边界。

```text
POST /portal/api/opl/launch
GET /portal-adapter/api/opl/bootstrap
POST /portal-adapter/api/opl/sessions/bind
POST /portal-adapter/api/opl/messages
GET /portal-adapter/api/opl/messages/{messageId}/status
POST /portal-adapter/api/opl/files
POST /portal-adapter/api/opl/runs
GET /portal-adapter/api/opl/runs/{runId}/status
GET /portal-adapter/api/opl/runs/{runId}/artifacts
GET /portal-adapter/api/opl/artifacts/{artifactRef}
```

Portal 对 OPL Adapter 的代理面必须与 Adapter 稳定接口对齐，至少包含：

```text
GET /portal/api/opl/bootstrap
POST /portal/api/opl/sessions/bind
POST /portal/api/opl/messages
GET /portal/api/opl/messages/{messageId}/status
POST /portal/api/opl/files
POST /portal/api/opl/runs
GET /portal/api/opl/runs/{runId}/status
GET /portal/api/opl/runs/{runId}/artifacts
GET /portal/api/opl/artifacts/{artifactRef}
```

现有 Runtime Bridge `/api/opl-launch/*` 可以作为当前实现路径，但它必须语义映射到 Portal OPL Adapter / Runtime Agent 边界。旧 `/api/runtime-sessions` 和 `/api/runtime-sessions/{id}/runs` 不得成为 v22 新主路径。

## Identity And Ownership Fields

Portal-OPL 连接闭环中的公开或后端归属对象必须能表达：

- `portalUserId`
- `tenantId`
- `workspaceId`
- `workspaceSessionId`
- `oplSessionId`
- `runtimeSessionId`
- `resourceBindingId`
- `runId`
- `traceId`
- `providerKeyRef`
- `providerBound`
- `artifactRef`

这些字段的用户可见性不同：普通用户界面可以讲“工作空间、任务、文件、运行轨迹”，但 `tenantId`、`resourceBindingId`、内部 trace / billing tags 只属于后台隔离、计费、审计和运维边界。

## Workspace Binding Is Required

workspace 绑定是必需项，不是可选装饰字段。原因是：

- 文件归属：输入文件、输出文件、artifact reference 必须归属到 workspace。
- 运行归属：runId 必须归属到 workspace、runtimeSession 和 resourceBinding。
- 计费归属：usage、preauth、freeze、cost summary 必须挂到 billing account 和 workspace。
- 审计归属：trace、release、T+1 audit 必须能回到 tenant、workspace 和 resourceBinding。
- 隔离归属：不同用户、tenant 和 workspace 的 OPL session、文件和 run 不得串读。

没有 workspaceId 的 OPL session 或 run 必须失败，不能隐式落到 default workspace 或 legacy task-space。缺少 workspaceId 时应返回稳定错误，例如 `workspace_required`；缺少 active resource binding 时 run 必须失败。

## Launch And Bootstrap

`POST /portal/api/opl/launch` 由 Portal 发起。它必须检查 Portal session、workspace、provider binding、managed environment / resource binding 状态，并创建服务端 launch session。

Portal launch response 可以返回：

- `ok`
- `launchId`
- `openUrl`
- `launchStatus`
- `workspaceId`
- `providerBound`
- `providerKeyRef`

Portal launch response 不得返回 raw API key、bearer token、launchToken、runtimeToken、objectKey、localPath、signedUrl 或 provider secret。

`GET /portal-adapter/api/opl/bootstrap` 由 Gateway / OPL 通过 httpOnly cookie 或服务端 launch session 获取公开上下文。bootstrap 只允许包含公开上下文：

- `portalUserId`
- `tenantId`
- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `oplSessionId`
- `providerBound`
- `providerKeyRef`
- `canStartRun`
- `launchStatus`
- Portal return URL

bootstrap 不含 raw key、token 或内部存储路径。

## Token And Secret Boundary

launchToken/runtimeToken 只能保存在 httpOnly cookie 或服务端 launch session，不得暴露给 OPL/browser public state。

必须满足：

- launchToken/runtimeToken 不得进入 URL query。
- launchToken/runtimeToken 不得进入 localStorage/sessionStorage。
- raw gflabtoken API key 不得进入 upstream、browser public state、response、log、evidence 或 git。
- OPL/browser public state 不得持有 raw API key、bearer token、objectKey、localPath、signedUrl。
- Gateway 必须拒绝 URL query 中的 apiKey、providerApiKey、launchToken、runtimeToken 或 bearer token 类字段。
- Runtime Agent 只能接收 `providerKeyRef`，不得接收 raw API key。

## Session Binding

`POST /portal-adapter/api/opl/sessions/bind` 用于把 upstream OPL 的 session 与 MedOPL launch context 绑定。

请求可以包含：

- `oplSessionId`
- `clientSessionState`
- message / run capability hints

请求不得要求 OPL 回传 raw API key。直接访问 `opl.medopl.cn` 时，账号密码和 gflabtoken API Key 只在 entry/preflight 边界处理；Portal 发起进入 OPL 时复用 Portal session / launch session。

session bind 成功后，平台必须能得到以下关系：

```text
portalUserId + tenantId + workspaceId + workspaceSessionId + runtimeSessionId + resourceBindingId + oplSessionId
```

## Adapter Decoupling And Anti-Corruption Boundary

Portal 只依赖 MedOPL 稳定接口，不得依赖 one-person-lab upstream 内部 API、DOM、store、数据库 schema 或内部 session model。

Gateway / Portal OPL Adapter 是 anti-corruption layer。它负责把 upstream OPL 的页面、路由、事件或接口变化翻译成 MedOPL 稳定合同。upstream OPL 更新只允许改 Gateway/Adapter 映射层，不能改 Portal billing、workspace、resourceBinding、provider secret 或 audit 的核心合同。

不同 API 必须低耦合演进：

- Portal launch API 只创建 MedOPL launch session，不调用 upstream 内部 API。
- Gateway bootstrap API 只暴露 MedOPL public context，不透传 upstream private state。
- session bind API 只接受 normalized OPL session identity，不要求 Portal 理解 upstream session model。
- OPL message/file/run 事件必须先归一化为 MedOPL canonical event，再进入 Runtime Agent、文件空间、trace 或 billing 边界。
- artifact projection API 只返回 MedOPL artifact/output file reference，不透传 upstream 或存储后端路径。

bootstrap 和 Adapter status 必须能表达：

- `adapterContractVersion`
- `capabilities`
- `supportedEvents`

`capabilities` 至少区分 message、file upload、run start、run status、artifact list、artifact download。`supportedEvents` 至少区分 session bound、message created、file referenced、run started、run updated、artifact created。

如果 upstream OPL 缺少某个能力、能力版本不兼容或映射层尚未实现，Adapter 必须显式返回 `capability_not_supported`，不能隐式兜底、伪装成功或把未知 upstream shape 直接写入 Portal 状态。

真实 upstream 能力必须先由 canary 分类，不能从 fake Product API fixture 推断：

- `real_http_product_api`: 真实 upstream HTTP Product API endpoint 存在，可直接由 Gateway/Adapter 访问。
- `mapped_to_acp_runtime`: 真实 upstream 没有对应 HTTP endpoint，但存在公开 ACP/CLI runtime 边界，可由 Adapter 映射。
- `capability_not_supported`: 真实 upstream 不存在、返回不兼容，或映射层尚未完成；Adapter 必须显式返回该状态。

2026-05-10 的 `/home/dev/projects/one-person-lab` 主仓 canary 结论是：`opl web` 已 retired，主仓没有 `/api/opl/system`、`/api/opl/messages`、`/api/opl/sessions` HTTP Product API；`opl session runtime --acp` 可作为 bootstrap/session bind 的公开映射面；`workspace_list`、无 secret 的真实 message prompt 和 WebUI 文件上传暂不支持或未验证。

2026-05-10 的真实 WebUI canary 结论是：独立 OPL/AionUI WebUI 可作为真实浏览器工作台进程启动，`GET /`、`GET /api/auth/status`、`GET /api/auth/user` 可真实访问；Gateway 指向该 WebUI 后可代理页面、注入 launch script、拒绝 secret query，并代理 WebSocket bridge。该 WebUI 的真实 session 协议是 WebSocket bridge，`create-conversation`、`database.get-user-conversations`、`database.get-conversation-messages` 已完成真实 session 创建和数据库回读。`/api/opl/system`、`/api/opl/sessions`、`/api/opl/messages` 在该 WebUI 上只是通用 `/api` catch-all 的 200 placeholder，不是 Product API；discovery 当时只能证明 `chat.send.message` 进入 WebUI/ACP 启动路径，不能证明 AI reply，因此必须标为 `capability_not_supported`。

后续授权 provider message live canary 结论是：在用户显式授权 `REAL_OPL_PROVIDER_MESSAGE_CANARY=1`、`OPL_PROVIDER_SECRET_FILE` 和真实 WebUI 来源后，Portal -> Gateway -> Adapter -> clean OPL WebUI bridge -> provider message 可观测到真实 assistant reply，并以 `capabilitySource=mapped_to_webui_bridge` 回流 Portal message status 与 Portal session trace。该事实只证明真实 provider message/reply，不证明 `/api/opl/*` HTTP Product API、真实 WebUI file upload、run/artifact、真实云 runtime 或 Langfuse 已上线。

2026-05-10 的真实 WebUI Adapter flow 结论是：Portal OPL Adapter 可以在 `OPL_RUNTIME_MODE=webui` 下通过 `OPL_WEBUI_BRIDGE_URL`/`OPL_WEB_URL` 连接真实 OPL/AionUI WebUI WebSocket bridge；launch 阶段创建真实 WebUI conversation，bootstrap 从 WebUI database 回读 session，并在 Adapter state 写入 `opl_webui_bridge_session_created` 和 `opl_session_bound`。该模式仍必须把 `/api/opl/*` HTTP Product API 分类为 `capability_not_supported`；message reply 在未授权真实 provider canary 时返回 `provider_authorization_required`、`deferred_authorization` 或 `capability_not_supported`，run 在没有真实 Runtime Agent relay 时返回明确失败，不能生成伪 run/artifact 成功。

每个 API 的验收不得只检查 HTTP 200/201/202。必须同时证明真实访问和真实回流：

- `GET /portal-adapter/api/opl/bootstrap` 必须访问 upstream/Product API 的 health、system、engines、modules、agents、workspaces、sessions、progress 和 artifacts 边界；返回值必须来自这些访问结果和 Adapter state projection，不能只本地构造。
- 当真实 upstream 没有 HTTP Product API 而只有 ACP/CLI 边界时，bootstrap 必须证明 `initialize`、`session_list`、`session_ledger` 等公开 ACP 命令被真实访问，并对缺失或不兼容能力返回 `capability_not_supported`。
- `POST /portal-adapter/api/opl/sessions/bind` 必须更新 runtime session 的 `oplSessionId`、workspace、tenant、resourceBinding 和 provider binding 关系，并写入 `opl_session_bound` 事件。
- `POST /portal-adapter/api/opl/messages` 必须把 normalized message 发到 OPL Product API 或公开 ACP/runtime 边界，并把 message request、reply、message artifact 和 trace 写回 Adapter state。
- `GET /portal-adapter/api/opl/messages/{messageId}/status` 必须读取前序 message 写入的 request/reply/trace 状态，不能返回静态成功。
- `POST /portal-adapter/api/opl/files` 必须新增 workspace-scoped input artifact record，并返回该 record 的 public `fileRef`。
- `POST /portal-adapter/api/opl/runs` 必须调用 Runtime Agent relay/API 边界，并把 run record、runtime artifact、session ledger entry 和 trace 写回 Adapter state。
- `GET /portal-adapter/api/opl/runs/{runId}/status`、`GET /portal-adapter/api/opl/runs/{runId}/artifacts` 和 `GET /portal-adapter/api/opl/artifacts/{artifactRef}` 必须读取前序 run/file 产生的 state record，且按 launch/session/workspace 鉴权。
- Portal `/portal/api/opl/*` 代理必须用当前用户的 `launchId` 换取后端 launch token，跨用户 `launchId` 必须拒绝，成功响应必须来自 Adapter 回流而不是 Portal 本地伪造。
- Adapter state 写入必须能保留并发 message/file/run 回流，不得因为异步写入互相覆盖、读到半写 JSON 或用最后写入覆盖前序状态。

禁止事项：

- 禁止 Portal 直接追踪 upstream route、DOM selector、frontend store、database schema 或 internal session model。
- 禁止 Runtime Agent 直接依赖 upstream UI 事件原始 shape。
- 禁止把 upstream raw event、raw prompt、raw file path 或 raw response 原样写入 Portal trace / billing / audit。
- 禁止为适配 upstream 更新而修改 one-person-lab upstream 源码。

## Messages, Files, Runs

OPL 工作流通过 Portal OPL Adapter / Runtime Agent 边界接入：

- `POST /portal-adapter/api/opl/messages` 记录 OPL message metadata，不保存 raw prompt 到公开 trace。
- `GET /portal-adapter/api/opl/messages/{messageId}/status` 返回 message 的 sanitized 进度，不暴露 launch token、raw prompt 或 provider secret。
- `POST /portal-adapter/api/opl/files` 生成 workspace file reference，不返回 objectKey、localPath、signedUrl。
- `POST /portal-adapter/api/opl/runs` 使用 workspace file reference 发起 run。
- `GET /portal-adapter/api/opl/runs/{runId}/status` 和 `GET /portal-adapter/api/opl/runs/{runId}/artifacts` 必须按 launch/session/workspace 鉴权后返回。
- `GET /portal-adapter/api/opl/artifacts/{artifactRef}` 只返回当前 launch/session/workspace 可见的 artifact projection。

run 必须执行以下 gate：

- 未绑定 gflabtoken provider key 时，run 返回 `provider_key_required`。
- 未开通托管运行环境或缺少 active `resourceBindingId` 时，run 返回 `managed_environment_required`。
- 缺少 Runtime Agent identity 或 endpoint 时，run 返回 `platform_isolated_runtime_agent_required`。
- Runtime Agent 只能接收 `providerKeyRef`，不得接收 raw API key。

run 成功后必须生成 `runId`，并把 `traceId`、`workspaceId`、`runtimeSessionId`、`resourceBindingId`、`providerKeyRef`、artifact refs 和 sanitized usage/cost summary 写回 Portal 可投影状态。

## Current Productionization Boundary Status

- productionization_status: contract_refresh_only
- absorbed_canary_fact: local Runtime Agent HTTP API relay full-loop
- absorbed_canary_fact: WebUI bridge negative no-fake-success gates
- absorbed_canary_fact: provider message reply is message-only
- not_production_truth: real cloud runtime is not上线
- not_production_truth: COS billing reconciliation is not上线
- not_production_truth: Langfuse / trace.medopl.cn is not deployed
- not_production_truth: one-person-lab upstream HTTP Product API is not available
- production implementation must not treat local canary evidence as deployment evidence

当前可吸收事实只说明 Portal / Gateway / Adapter / Runtime Agent HTTP API 本地 relay 的接口形状、workspace-scoped fileRef、run/artifact projection、no-fake-success gate 和 message reply canary 边界已被本地或授权 canary 证明。它不说明真实云 runtime、真实 COS 账单、生产部署、Langfuse 或 `trace.medopl.cn` 已上线。后续 production implementation 必须继续把这些事实作为输入边界，而不是把 canary evidence 当作生产部署证据。

## Artifact And Portal Projection

输出文件只以 `artifactRef` 或 `outputFileRef` 回到 Portal。

公开 artifact / output file projection 只允许包含：

- `artifactRef`
- `outputFileRef`
- `runId`
- `sessionId`
- `workspaceId`
- `resourceBindingId`
- `providerKeyRef`
- `kind`
- `name`
- `relativePath`
- `sizeBytes`
- `contentType`
- sanitized status / timestamps

不得包含 objectKey、storageKey、localPath、signedUrl、presignedUrl、raw API key、launchToken、runtimeToken 或 bearer token。

## Acceptance

本合同的闭环验收点：

1. Portal 点击“进入 OPL 工作台”后打开 clean upstream OPL。
2. bootstrap 不含 raw key、token 或内部存储路径。
3. OPL session 绑定到 `portalUserId`、`tenantId`、`workspaceId`、`runtimeSessionId` 和 `resourceBindingId`。
4. bootstrap、message、file、run、status、artifact API 都有真实访问和真实状态回流证据，不接受只返回 200/201/202。
5. 未绑定 gflabtoken 时不能 start run，返回 `provider_key_required`。
6. 未开通 runtime / resourceBinding 时不能 start run，返回 `managed_environment_required`。
7. start run 后平台生成 `runId`。
8. 输出文件只以 `artifactRef` 或 `outputFileRef` 回到 Portal。
9. Portal 能按 workspace、session 和 run 看到任务、文件、trace 和账单状态。
10. 真实 OPL canary 必须输出接口事实：哪些 HTTP Product API 真实存在，哪些能力映射到 ACP/CLI，哪些能力暂不支持；fake upstream smoke 只能证明合同实现，不能证明 one-person-lab 主仓真实 API 存在。

## Non-goals

- 不修改 one-person-lab upstream。
- 不 import upstream 内部模块。
- 不接真实云资源开通。
- 不读取 secret、kubeconfig、SecretId、SecretKey、SSH private key 或 `.env`。
- 不调用真实腾讯云、COS、Langfuse、one-person-lab 或外部生产 API。
- 不运行 build/push/kubectl/live-test。
- 不修改 deploy、`.sentrux` 或 `adapters`。
- 不把 `user_owned`、旧 resource-order、旧 runner/provisioner、OpenCost 或 Langfuse 主叙事恢复成 v22 主路径。

## Smoke

本合同由本地 smoke 固化：

```text
node scripts/smoke-test-v22-portal-opl-connection-contract.mjs
node scripts/smoke-test-v22-opl-adapter-state-store-atomic-flow.mjs
node scripts/smoke-test-v22-portal-opl-adapter-api-local-flow.mjs
```

这些 smoke 只检查 repo-tracked 合同、索引、本地 Portal/Gateway/Adapter contract shape 和本地 MVP suite，不读取 secret，不调用真实云，不运行 live-test，不修改 upstream。

真实 upstream capability classification 的历史 evidence 只保留为 `.runtime/real-opl-canary/evidence.json` 脱敏记录和合同状态；对应真实 upstream runner 不属于 active repo executable surface。后续如果要重新验证 `/home/dev/projects/one-person-lab` 的公开 CLI/ACP 边界，必须单独开 future-authorized boundary，不修改 upstream，不读取 secret，不调用真实云，不把 fixture Product API 当真实接口结论。

真实 WebUI canary 的历史 evidence 只保留为 `.runtime/real-opl-webui-canary/evidence.json` 脱敏记录和合同状态；对应真实 WebUI runner 不属于 active repo executable surface。后续如果要重新启动或连接独立 OPL/AionUI WebUI，必须单独授权 WebUI 来源，不修改 WebUI/upstream，不读取 secret，不调用真实云，不把 HTTP 200 placeholder 当真实 Product API。

`scripts/smoke-test-v22-real-opl-webui-adapter-flow.mjs` 暂保留为显式 WebUI 来源下的 Adapter boundary proof；它不进入默认 MVP suite，不能作为默认产品入口、live-test 或 production deploy evidence。运行它必须有明确 `OPL_REAL_WEBUI_DIR` 或 `OPL_REAL_WEBUI_URL`，证据只保存在 `.runtime/real-opl-webui-adapter-flow`，不进 git。
