# v22 Real OPL Provider Message Canary Boundary Contract

本合同定义 MedOPL v22 中真实 OPL provider message reply canary 的边界。它只回答一件事：

```text
Portal 已能进入 clean OPL WebUI 并绑定 session 后，如何验证一条真实 message 是否进入 OPL/agent/provider 边界、是否产生 assistant reply，并以可查询状态和 session trace 回流 Portal。
```

本合同是 [v22-real-opl-capability-canary-boundary.md](./v22-real-opl-capability-canary-boundary.md) 的 message reply 细分合同，不替代一级主合同、二级 Portal-OPL 连接合同或三级真实 OPL capability canary 合同。

## Contract Level

合同分级如下：

- Level 1: [v22-mvp-managed-opl-loop.md](./v22-mvp-managed-opl-loop.md)。一级主合同，定义 MedOPL 托管 OPL SaaS 用户主闭环。
- Level 2: [v22-portal-opl-connection-boundary.md](./v22-portal-opl-connection-boundary.md)、[v22-upstream-opl-boundary.md](./v22-upstream-opl-boundary.md) 和 [v22-opl-work-message-file-run-boundary.md](./v22-opl-work-message-file-run-boundary.md)。二级段合同，定义 Portal-OPL 连接、clean upstream 和 OPL 工作流业务边界。
- Level 3: [v22-portal-opl-context-backflow-boundary.md](./v22-portal-opl-context-backflow-boundary.md) 和 [v22-real-opl-capability-canary-boundary.md](./v22-real-opl-capability-canary-boundary.md)。三级执行合同，定义 Portal-OPL context/backflow 骨架和真实 OPL capability canary 总链路。
- Level 4: 本合同。Real OPL provider message canary execution contract，细化 provider key gate、真实 message send、reply observation、Runtime Bridge normalization、Portal projection、session trace、Langfuse attachment boundary、错误 gate 和吸收标准。

本合同是四级细分执行合同。它只能向上服从一级、二级、三级合同，不能扩大授权或把未验证能力标记为已上线。

## Subscription Package

本合同订阅以下合同包：

- [v22-mvp-managed-opl-loop.md](./v22-mvp-managed-opl-loop.md)
- [v22-portal-opl-connection-boundary.md](./v22-portal-opl-connection-boundary.md)
- [v22-portal-opl-context-backflow-boundary.md](./v22-portal-opl-context-backflow-boundary.md)
- [v22-real-opl-capability-canary-boundary.md](./v22-real-opl-capability-canary-boundary.md)
- [v22-upstream-opl-boundary.md](./v22-upstream-opl-boundary.md)
- [v22-opl-work-message-file-run-boundary.md](./v22-opl-work-message-file-run-boundary.md)
- [v22-runtime-bridge-session-run-file-provider-keyref-boundary.md](./v22-runtime-bridge-session-run-file-provider-keyref-boundary.md)
- [v22-portal-files-billing-trace-boundary.md](./v22-portal-files-billing-trace-boundary.md)
- [v22-token-provider-boundary.md](./v22-token-provider-boundary.md)
- [v22-trace-metadata-boundary.md](./v22-trace-metadata-boundary.md)
- [v22-langfuse-observability-metadata-boundary.md](./v22-langfuse-observability-metadata-boundary.md)
- [../recovery/status-matrix.md](../recovery/status-matrix.md)
- [../recovery/mvp-contract-acceptance.md](../recovery/mvp-contract-acceptance.md)
- [../recovery/portal-opl-context-backflow-validation-path.md](../recovery/portal-opl-context-backflow-validation-path.md)
- [../recovery/real-opl-capability-canary-validation-path.md](../recovery/real-opl-capability-canary-validation-path.md)
- [../recovery/real-opl-provider-message-canary-validation-path.md](../recovery/real-opl-provider-message-canary-validation-path.md)

规范路径为：

- `docs/recovery/status-matrix.md`
- `docs/recovery/mvp-contract-acceptance.md`
- `docs/recovery/portal-opl-context-backflow-validation-path.md`
- `docs/recovery/real-opl-capability-canary-validation-path.md`
- `docs/recovery/real-opl-provider-message-canary-validation-path.md`

## Product Truth

产品真相：

```text
Portal is the SaaS control plane.
Gateway is the clean OPL WebUI entry/proxy.
Runtime Bridge is the anti-corruption layer for message intent, provider/reply evidence, normalized status, and Portal projection.
Runtime Bridge / Runtime Agent remains the downstream canonical source for run, artifact, ledger, trace, and billing metadata.
Langfuse is an optional sanitized observability attachment.
one-person-lab upstream remains clean.
```

真实 provider message canary 只证明 message/reply 这一段。它不证明 file、run、artifact、真实云 runtime、生产部署或 Langfuse 已上线。

当前授权 live canary 事实：

- 用户授权 `REAL_OPL_PROVIDER_MESSAGE_CANARY=1`、`OPL_PROVIDER_SECRET_FILE` 和 `OPL_REAL_WEBUI_DIR` 后，Portal -> Gateway -> Runtime Bridge -> clean OPL WebUI bridge -> gflab provider message 链路已观测到真实 assistant reply。
- 当前 message reply capability 状态为 `mapped_to_webui_bridge`。
- Portal message status 和 Portal session trace 已能回流同一组 `messageId`、`replyMessageId`、`messageTraceId`、`providerInvocationRef` 和 `capabilitySource=mapped_to_webui_bridge`。
- 脱敏 evidence 只写 `.runtime/real-opl-provider-message-live-canary/evidence.json`，不得进入 git。
- 该事实仍不代表真实 file upload、workspace-scoped fileRef、run、artifact/output、真实云 runtime、生产部署或 Langfuse 已上线。

一条 message 只有满足以下条件，才能标记为真实 reply 闭环：

- message intent 绑定同一个 `tenantId + portalUserId + workspaceId + workspaceSessionId + runtimeSessionId`。
- message intent 进入真实 OPL WebUI bridge、ACP runtime 或公开 provider/agent 边界。
- canary 观测到 provider invocation evidence 或明确 gate。
- canary 观测到同一 conversation/message 的 assistant reply，或明确 timeout/not-supported gate。
- Runtime Bridge 生成稳定 `messageId/status/replyMessageId/messageTraceId`。
- Portal 可以通过 `/portal/api/opl/messages/{messageId}/status` 和 `/portal/api/session-traces` 查询。

任何无法证明真实 provider/reply 的情况，必须返回明确 gate，不得使用 fake Product API、fixture reply、placeholder 200 或本地假 message 当成真实 provider 成功。

## Primary Scope

本合同 Primary Scope 是：

```text
Portal launch
  -> Gateway clean OPL WebUI
  -> Runtime Bridge bootstrap/session bind
  -> real OPL session/conversation
  -> provider key gate
  -> message intent
  -> real OPL/agent/provider boundary
  -> assistant reply observation
  -> Runtime Bridge normalized message state
  -> Portal message status
  -> Portal session trace
```

本合同覆盖：

- provider readiness discovery，但默认不读取 raw provider key。
- `providerKeyRef` 绑定状态检查。
- message request identity map。
- OPL WebUI bridge / ACP runtime / provider boundary 观测点。
- assistant reply 与 `clientMessageId`、`oplConversationId`、`messageId` 的关联。
- Runtime Bridge message state normalization。
- Portal message status projection。
- Portal canonical session trace projection。
- Langfuse sanitized attachment 的边界。
- 不支持、缺 provider、缺授权、upstream 不可达、reply timeout、映射失败时的明确 gate。

## Non-goals

本合同不做以下事项：

- 不修改 one-person-lab upstream。
- 不 import upstream 内部模块。
- 不在 upstream 目录写 Portal、Gateway、Runtime Bridge、Runtime 或 Langfuse 代码。
- 不读取 raw API key、`.env`、kubeconfig、SecretId、SecretKey、SSH private key 或外部生产 token。
- 不把 raw provider key 写入 sessionStorage、localStorage、全局 JS state、日志、evidence 或 git。
- 不调用真实腾讯云、COS、TKE、K8s 或真实云 runtime。
- 不 build/push/kubectl/live-test。
- 不修改 `deploy/*`、`.sentrux/*` 或 `adapters/*`。
- 不部署 `trace.medopl.cn`。
- 不部署 Langfuse、ClickHouse、DNS、TLS 或 Ingress。
- 不证明 file upload、workspace-scoped fileRef、run、artifact/output、billing truth 或真实 Runtime Agent 已上线。
- 不把 fake Product API、本地 fake Runtime Agent relay、placeholder 200、fixture reply 或前端 DOM 变化当成真实 provider reply 证据。

## Authorization Boundary

默认授权只允许：

- 读取 v22 active surface。
- 更新合同、recovery 文档和 v22 smoke。
- 启动或连接用户明确授权的本地真实 OPL WebUI canary 来源。
- 通过公开 HTTP/WebSocket/ACP/CLI 边界读取脱敏非 secret 元数据。
- 把 canary evidence 写入 `.runtime`。
- 在缺少 provider key 或真实授权时验证 gate，而不是触发真实模型调用。

需要用户单独授权后才能做：

- 读取或输入真实 provider raw API key。
- 使用真实 `providerKeyRef` 触发模型调用。
- 调用真实外部 provider、真实 OPL provider、真实云 runtime 或真实 Runtime Agent endpoint。
- 读取 secret 文件、`.env`、kubeconfig、SecretId、SecretKey 或外部生产 token。
- 部署 Langfuse 或 `trace.medopl.cn`。
- 运行 build/push/kubectl/live-test。
- 修改 one-person-lab upstream、deploy、`.sentrux` 或 adapters。

## Provider Key Boundary

provider key 的 canonical 形态是 `providerKeyRef`。它是后端密钥边界中的引用，不是 raw API key。

允许出现在 public response、Portal projection 和 evidence 中的 provider 字段：

- `providerBound`
- `providerKeyRef`
- `providerStatus`
- `providerInvocationRef`
- `providerModelRef`
- `providerAuthorizationStatus`

禁止出现：

- raw API key。
- bearer token。
- provider request authorization header。
- raw prompt。
- raw completion。
- launchToken。
- runtimeToken。
- secret store path。
- `.env` 内容。

没有 `providerKeyRef` 时，message canary 必须返回 `provider_key_required`。有 `providerKeyRef` 但未授权真实调用时，必须返回 `provider_authorization_required` 或 `deferred_authorization`。不得因为有 `providerKeyRef` 就伪造 provider invocation。

## Canonical Message Identity Map

真实 provider message canary 必须固定以下 ID 归属：

| 字段 | Canonical owner | 说明 |
| --- | --- | --- |
| `tenantId` | Portal | 租户边界 |
| `portalUserId` | Portal | 用户边界 |
| `workspaceId` | Portal | workspace 边界 |
| `launchId` | Portal / Gateway | 一次进入 OPL 的 launch 关联，不进入 URL query |
| `workspaceSessionId` | Portal / Runtime Bridge | Portal workspace session projection |
| `runtimeSessionId` | Runtime Bridge | runtime session 归一化 ID |
| `resourceBindingId` | Portal / Runtime Bridge | 托管运行环境绑定 ID，可为空但必须显式表达 |
| `providerKeyRef` | Portal / Runtime Bridge secret boundary | provider 绑定引用 |
| `oplSessionId` | OPL WebUI / ACP / Runtime Bridge | OPL session 归一化 ID |
| `oplConversationId` | OPL WebUI bridge | WebUI conversation ID |
| `clientMessageId` | Portal / OPL client | 幂等 message intent ID |
| `messageId` | Runtime Bridge | Runtime Bridge message projection ID |
| `replyMessageId` | OPL / Runtime Bridge | assistant reply projection ID |
| `traceId` | Runtime Bridge | sanitized trace metadata ID |
| `messageTraceId` | Runtime Bridge / Portal trace | message 级 trace projection ID |
| `providerInvocationRef` | Runtime Bridge / provider boundary | 脱敏 provider invocation evidence reference |

`messageId`、`replyMessageId`、`messageTraceId` 和 `providerInvocationRef` 必须绑定同一组 `tenantId + portalUserId + workspaceId + workspaceSessionId + runtimeSessionId + oplConversationId + clientMessageId`。无法绑定时返回 `runtime_bridge_mapping_failed`。

## Message Send Contract

message send canary 的入口必须是稳定 Runtime Bridge/Portal projection，而不是 Portal 直接依赖 upstream 内部 route、DOM、frontend store 或 database schema。

请求必须携带或可从 launch/session 绑定中解析：

- `tenantId`
- `portalUserId`
- `workspaceId`
- `launchId`
- `workspaceSessionId`
- `runtimeSessionId`
- `oplSessionId` 或 `oplConversationId`
- `clientMessageId`
- `providerKeyRef`

请求可以包含 prompt intent，但 raw prompt 不得写入公开 response、日志、evidence 或 git。canary evidence 只能记录脱敏 prompt metadata，例如 length、hash prefix、content type、message role 和 timing。

成功的 send accepted response 必须包含：

- `messageId`
- `status=queued|running|succeeded`
- `clientMessageId`
- `oplConversationId` 或 `oplSessionId`
- `statusUrl`
- `providerKeyRef`
- `messageTraceId` 或 pending trace reference

如果使用 202 表达异步 accepted，必须返回后续查询 ID/URL，且不能把 `queued` 或 `running` 伪装成 `succeeded`。

## Reply Observation Contract

reply observation 必须证明以下至少一种真实来源：

- OPL WebUI bridge 观测到同一 `oplConversationId` 的 assistant reply event。
- ACP runtime 观测到同一 `clientMessageId` 或 conversation 的 assistant reply。
- 公开 provider/agent boundary 返回脱敏 invocation evidence，并可映射到 assistant reply。

成功返回必须包含：

- `messageId`
- `status=succeeded`
- `replyMessageId`
- `clientMessageId`
- `oplConversationId` 或 `oplSessionId`
- `providerInvocationRef`
- `messageTraceId`
- sanitized reply metadata，例如 role、token usage summary、latencyMs、modelRef、finish status

reply metadata 禁止包含 raw completion。若只能看到 provider invocation 但没有 reply，必须返回 `provider_invocation_not_observed` 或 `upstream_reply_timeout`，不能标记为 `succeeded`。

## Runtime Bridge Normalization Contract

Runtime Bridge 必须把 upstream/WebUI/ACP/provider 的 shape 归一化成稳定 message state。Portal 不得依赖真实 upstream shape。

稳定 message state 至少包含：

- `messageId`
- `status`
- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `oplSessionId`
- `oplConversationId`
- `clientMessageId`
- `replyMessageId`
- `providerKeyRef`
- `providerInvocationRef`
- `messageTraceId`
- `capabilitySource`
- `error` 或 `gate`
- `createdAt`
- `updatedAt`

`capabilitySource` 允许值：

- `mapped_to_webui_bridge`
- `mapped_to_acp_runtime`
- `supported_provider_boundary`

如果 upstream shape 变化导致无法稳定映射，必须返回 `runtime_bridge_mapping_failed`，并只记录脱敏 shape summary，不记录 raw payload。

## Portal Projection And Session Trace

Portal projection 必须通过以下稳定入口查询：

- `POST /portal/api/opl/messages`
- `GET /portal/api/opl/messages/{messageId}/status`
- `GET /portal/api/session-traces?workspaceId=...&sessionId=...`
- `GET /portal/api/session-traces?workspaceId=...&messageId=...`
- `GET /portal/api/session-traces/{traceId}`

Portal message status 必须能表达：

- accepted/queued。
- running。
- succeeded with `replyMessageId`。
- failed/gated with explicit error code。
- timing metadata。
- `messageTraceId`。

Portal session trace 必须能按 workspace/session/message 查询到：

- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `oplSessionId` 或 `oplConversationId`
- `messageId`
- `replyMessageId`
- `providerKeyRef`
- `providerInvocationRef`
- `messageTraceId`
- status。
- sanitized latency/usage/cost metadata。

Portal session trace 是 MedOPL canonical projection。Langfuse 不是 Portal、billing、message、file、run 或 artifact 的 canonical source。

## Langfuse Attachment Boundary

Langfuse is an optional sanitized observability attachment。

当 Langfuse 或 `trace.medopl.cn` 未部署、未配置或未授权时，message canary 必须仍然能返回 Portal canonical session trace，或返回 `trace_sink_not_configured` 表示外部 trace sink 不可用。不得因为 Langfuse 未部署而伪造 message 成功或失败。

允许发送到 Langfuse 的字段仅限脱敏 metadata：

- `tenantId`
- `workspaceId`
- `workspaceSessionId`
- `messageId`
- `replyMessageId`
- `providerKeyRef`
- `providerInvocationRef`
- `messageTraceId`
- status。
- latency。
- usage summary。
- cost estimate。
- capability source。
- sanitized tags。

禁止发送 raw prompt、raw completion、raw API key、bearer token、launchToken、runtimeToken、objectKey、storageKey、localPath、signedUrl、presignedUrl、secret path 或 `.env` 内容。

## Authorized Provider Message Boundary

默认合同 smoke 只验证合同、gate 和本地 projection，不读取 secret、不调用真实 provider。历史授权 provider message live evidence 只作为 `.runtime/real-opl-provider-message-live-canary/evidence.json` 脱敏记录存在；对应 live runner 已退出 active repo executable surface。后续真实 provider message reply canary 必须重新开 future-authorized boundary，不能从默认 suite、合同 gate 或 README 直接运行历史 runner。

授权变量含义：

- `REAL_OPL_PROVIDER_MESSAGE_CANARY=1`: 允许本次 canary 读取指定 provider secret，并触发真实 OPL/WebUI/provider message 调用。
- `OPL_PROVIDER_SECRET_FILE`: 只允许读取用户明确授权的 provider secret 文件。脚本只能解析 allowlist key，不能打印路径内容或 raw key。
- `OPL_REAL_WEBUI_DIR`: 启动本地真实 OPL WebUI dist-server 来源。
- `OPL_REAL_WEBUI_URL`: 使用已启动的真实 OPL WebUI URL；与 `OPL_REAL_WEBUI_DIR` 二选一。

live canary 必须走真实 Portal -> Gateway -> Runtime Bridge -> WebUI bridge 路径：

```text
Portal /portal/api/opl/launch
  -> Portal backend secret store writes raw key and exposes providerKeyRef only
  -> Gateway opens clean WebUI
  -> Runtime Bridge creates/binds OPL conversation
  -> POST /portal/api/opl/messages
  -> Runtime Bridge maps to WebUI bridge chat.send.message
  -> Runtime Bridge observes assistant reply by same conversation readback/event
  -> GET /portal/api/opl/messages/{messageId}/status
  -> GET /portal/api/session-traces?workspaceId=...&messageId=...
```

live canary success evidence 必须包含 `messageId`、`replyMessageId`、`messageTraceId`、`providerInvocationRef`、`capabilitySource=mapped_to_webui_bridge` 和 Portal session trace projection。evidence 只写 `.runtime/real-opl-provider-message-live-canary/evidence.json`，只允许记录 key fingerprint、prompt/reply 长度、hash prefix、ID、状态和 timing metadata。

live canary 不进入默认 `scripts/smoke-test-v22-mvp-contract-suite.mjs`，因为它需要真实 provider key、真实 provider 调用授权和真实 WebUI canary 来源。

最近一次授权 live canary 脱敏结果：

```json
{
  "status": "succeeded",
  "capabilitySource": "mapped_to_webui_bridge",
  "replyLength": 25,
  "streamEventCount": 16
}
```

## Error Gates And No-Fake-Success

本合同禁止 fake success。以下情况必须返回明确 gate，不得返回 200 假成功；本合同的验收关键词是 no fake 200：

- `provider_key_required`: 没有 `providerKeyRef`。
- `provider_authorization_required`: 有 provider binding，但本次真实调用未授权。
- `provider_invocation_not_observed`: message intent 已进入 OPL 侧候选路径，但没有可证明的 provider invocation。
- `upstream_unavailable`: 真实 OPL WebUI/ACP/provider 边界不可达。
- `upstream_reply_timeout`: message 已进入上游边界，但未在预算时间内观测到 assistant reply。
- `runtime_bridge_mapping_failed`: upstream shape 变化或 ID 绑定不完整，无法生成稳定 projection。
- `capability_not_supported`: 当前真实 upstream 不支持或未验证 message reply。
- `trace_sink_not_configured`: Langfuse 或外部 trace sink 未配置。
- `deferred_authorization`: 需要用户或运维单独授权。

HTTP status 必须表达业务失败类别。若因异步处理返回 202，response 必须包含 `status=queued|running`、`messageId` 和 status URL；不得把 pending 状态写成 succeeded。

公开 response、日志、evidence 和 git 都不得包含 raw prompt、raw completion、raw API key、bearer token、launchToken、runtimeToken、sessionStorage、localStorage 或 secret 内容。

## Canary Evidence Boundary

canary evidence 只允许写入 `.runtime`，不得进入 git。

允许记录：

- sanitized command name。
- upstream version / commit / package metadata。
- capability source。
- sanitized endpoint path。
- sanitized WebSocket event type。
- `messageId`、`clientMessageId`、`replyMessageId`、`messageTraceId`。
- `providerInvocationRef`。
- timing metadata。
- status/error code。
- prompt length/hash prefix。
- reply length/hash prefix。

禁止记录：

- raw prompt。
- raw completion。
- raw API key。
- bearer token。
- provider authorization header。
- launchToken。
- runtimeToken。
- sessionStorage dump。
- localStorage dump。
- objectKey。
- storageKey。
- localPath。
- signedUrl。
- presignedUrl。
- `.env`、SecretId、SecretKey、kubeconfig 或 SSH private key。

## Productionization Handoff

canary 成功不自动等于 productionized Runtime Bridge。进入正式实现前必须：

1. 把真实 provider message reply 发现回写本合同、[v22-real-opl-capability-canary-boundary.md](./v22-real-opl-capability-canary-boundary.md)、[status-matrix.md](../recovery/status-matrix.md) 和 [mvp-contract-acceptance.md](../recovery/mvp-contract-acceptance.md)。
2. 明确 message reply capability 状态：`supported`、`mapped_to_webui_bridge`、`mapped_to_acp_runtime`、`supported_provider_boundary`、`provider_key_required`、`provider_authorization_required`、`deferred_authorization` 或 `capability_not_supported`。
3. 把 canary-only evidence、临时脚本输出和 `.runtime` 数据留在本地，不进入 git。
4. 如需 productionized Runtime Bridge 映射，另开实现分支，补正式 smoke，不依赖 `.runtime` 临时 evidence。
5. 如需真实 provider key、真实 Runtime Agent、真实云 runtime 或 Langfuse 部署，另行取得用户授权。

## Absorption Gate

本合同对应分支进入 B 窗口前必须满足：

1. 明确声明订阅本合同包和模型记录。当前 lane 分支名为 `feat/v22-real-opl-provider-message-canary-contract`，模型记录为 `gpt-5.4`。
2. `node scripts/smoke-test-v22-real-opl-provider-message-contract-gate.mjs` 通过。
3. `node scripts/smoke-test-v22-real-opl-capability-contract-gate.mjs` 通过。
4. `node scripts/smoke-test-v22-portal-opl-context-backflow-contract.mjs` 通过。
5. `node scripts/smoke-test-v22-mvp-contract-suite.mjs` 通过，或明确记录未运行原因。
6. 合同索引、阶段状态和验证链路已更新。
7. 默认合同 smoke 未使用 raw provider key，未调用真实 provider，未读取 secret，未调用真实云；授权 live canary 必须明确记录 `REAL_OPL_PROVIDER_MESSAGE_CANARY=1` 和脱敏 evidence path。
8. 未修改 one-person-lab upstream、deploy、`.sentrux` 或 adapters。
9. `git diff --check -- docs/contracts docs/recovery scripts` 通过。
