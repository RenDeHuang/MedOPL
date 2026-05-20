# v22 Real OPL Capability Canary Boundary Contract

本合同定义 MedOPL v22 中真实 OPL 能力 canary 的边界。它回答一件事：

```text
Portal 和 OPL 已经打通 context/backflow 骨架后，如何逐项验证真实 message、file、run、artifact、runtime 和 observability 能力是否能进入真实 OPL/agent/provider/runtime 边界并回流 Portal。
```

本合同不替代 [v22-portal-opl-context-backflow-boundary.md](./v22-portal-opl-context-backflow-boundary.md)。前者定义 Portal-OPL 连接骨架，本合同定义剩余真实 OPL 能力 canary 和后续 productionization handoff。message reply 的 provider 细分执行合同是 [v22-real-opl-provider-message-canary-boundary.md](./v22-real-opl-provider-message-canary-boundary.md)。file/run/artifact 的细分执行合同是 [v22-real-opl-file-run-artifact-canary-boundary.md](./v22-real-opl-file-run-artifact-canary-boundary.md)。

## Contract Level

合同分级如下：

- Level 1: [v22-mvp-managed-opl-loop.md](./v22-mvp-managed-opl-loop.md)。一级主合同，定义 MedOPL 托管 OPL SaaS 用户主闭环。
- Level 2: [v22-portal-opl-connection-boundary.md](./v22-portal-opl-connection-boundary.md)、[v22-upstream-opl-boundary.md](./v22-upstream-opl-boundary.md) 和 [v22-opl-work-message-file-run-boundary.md](./v22-opl-work-message-file-run-boundary.md)。二级段合同，定义 Portal-OPL 连接、clean upstream 和 OPL 工作流业务边界。
- Level 3: 本合同。Real OPL capability canary execution contract，细化真实 WebUI/ACP/Runtime 能力发现、message reply、file、run、artifact、observability、Portal projection、错误 gate 和吸收标准。

本合同是三级执行合同，不替代一级主合同和二级段合同。

## Subscription Package

本合同订阅以下合同包：

- [v22-mvp-managed-opl-loop.md](./v22-mvp-managed-opl-loop.md)
- [v22-portal-opl-connection-boundary.md](./v22-portal-opl-connection-boundary.md)
- [v22-portal-opl-context-backflow-boundary.md](./v22-portal-opl-context-backflow-boundary.md)
- [v22-real-opl-provider-message-canary-boundary.md](./v22-real-opl-provider-message-canary-boundary.md)
- [v22-real-opl-file-run-artifact-canary-boundary.md](./v22-real-opl-file-run-artifact-canary-boundary.md)
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
- [../recovery/real-opl-file-run-artifact-validation-path.md](../recovery/real-opl-file-run-artifact-validation-path.md)

规范路径为：

- `docs/recovery/status-matrix.md`
- `docs/recovery/mvp-contract-acceptance.md`
- `docs/recovery/portal-opl-context-backflow-validation-path.md`
- `docs/recovery/real-opl-capability-canary-validation-path.md`
- `docs/recovery/real-opl-provider-message-canary-validation-path.md`
- `docs/recovery/real-opl-file-run-artifact-validation-path.md`

## Product Truth

产品真相：

```text
Portal is the SaaS control plane.
Gateway is the clean OPL WebUI entry/proxy.
Runtime Bridge is the anti-corruption layer for OPL context, capability discovery, event mapping, and Portal projection.
Runtime Bridge / Runtime Agent is the downstream canonical source for run, artifact, ledger, trace, and billing metadata.
Langfuse is an optional sanitized observability attachment.
one-person-lab upstream remains clean.
```

真实 OPL 能力 canary 的目标不是证明所有能力已上线，而是把每项真实能力裁定清楚：

- 真实存在并可回流 Portal。
- 可通过 WebUI bridge 映射。
- 可通过 ACP runtime 映射。
- 需要 Runtime Agent。
- 需要 provider 授权。
- 需要真实云/runtime 授权。
- 当前 upstream 不支持。

任何能力没有真实证据时，必须显式 gate，不得用 fake Product API、placeholder 200、fixture reply 或本地假 run 代替真实结论。

## Primary Scope

本合同 Primary Scope 是：

```text
Portal
  -> Gateway
  -> clean OPL WebUI
  -> Runtime Bridge capability discovery
  -> real OPL WebUI bridge / ACP runtime / Runtime Agent boundary
  -> Runtime Bridge normalized state
  -> Portal projection
```

本合同覆盖：

- 真实 OPL WebUI / ACP capability discovery。
- Portal launch 后 OPL 获取 MedOPL public context。
- 真实 OPL session / conversation 创建和回流。
- message intent 是否进入真实 OPL/agent/provider，并是否产生 assistant reply。
- file upload / file reference 是否能形成 workspace-scoped fileRef。
- run intent 是否进入真实 Runtime Bridge / Runtime Agent boundary。
- artifact / output file 是否形成 artifactRef 或 outputFileRef 并回流 Portal。
- sanitized trace / billing metadata 是否可形成 Portal projection。
- 不支持、缺授权、缺 runtime、缺 provider、upstream 变化时的明确 gate error。

## Non-goals

本合同不做以下事项：

- 不修改 one-person-lab upstream。
- 不 import upstream 内部模块。
- 不在 upstream 目录写 Portal、Gateway、Runtime Bridge、Runtime 或 Langfuse 代码。
- 不读取 raw secret、kubeconfig、SecretId、SecretKey、SSH private key 或 `.env`。
- 不调用真实腾讯云、COS、TKE、K8s 或其他真实云 mutation API。
- 不 build/push/kubectl/live-test。
- 不修改 `deploy/*`、`.sentrux/*` 或 `adapters/*`。
- 不部署 `trace.medopl.cn`。
- 不部署 Langfuse、ClickHouse、Ingress、DNS 或 TLS。
- 不把 Langfuse 当成 Portal、run、artifact、billing 或 file 的 canonical source。
- 不把 fake Product API、fixture Runtime Agent relay 或 placeholder 200 当成真实 OPL 能力上线证据。

## Authorization Boundary

默认授权只允许：

- 本地读取 v22 active surface。
- 启动本地真实 OPL WebUI canary 进程。
- 使用 `OPL_REAL_WEBUI_DIR` 或 `OPL_REAL_WEBUI_URL` 指向用户授权的真实 WebUI canary 来源。
- 使用本地 canary evidence 写入 `.runtime`。
- 读取公开 WebUI/ACP/API/CLI 边界返回的非 secret 元数据。
- 更新合同、recovery 状态、smoke 和 active surface 中的 Runtime Bridge/Gateway/Portal productionized 映射代码。

需要用户单独授权后才能做：

- 使用真实 provider key 或 raw API key 触发真实模型调用。
- 使用真实 Runtime Agent endpoint。
- 使用真实云 runtime、腾讯云资源、COS、TKE、K8s、kubectl 或 live-test。
- 部署 Langfuse 或 `trace.medopl.cn`。
- 读取 secret 文件、`.env`、kubeconfig 或任何外部生产 token。
- 修改 upstream、deploy、`.sentrux` 或 adapters。

## Canonical Identity Map

真实 OPL 能力 canary 必须固定 ID 归属。以下字段必须显式生成、绑定或 gate：

| 字段 | Canonical owner | 说明 |
| --- | --- | --- |
| `tenantId` | Portal | 租户边界，Portal canonical |
| `portalUserId` | Portal | 用户边界，Portal canonical |
| `workspaceId` | Portal | workspace 边界，Portal canonical |
| `launchId` | Portal / Gateway | 进入 OPL 的一次性 launch 关联，不进入 URL query |
| `workspaceSessionId` | Portal / Runtime Bridge | Portal workspace session projection |
| `runtimeSessionId` | Runtime Bridge | runtime session 归一化 ID |
| `resourceBindingId` | Portal / Runtime Bridge | 托管运行环境资源绑定 ID |
| `providerKeyRef` | Portal / Runtime Bridge secret boundary | provider 绑定引用，不是 raw API key |
| `oplSessionId` | OPL WebUI / ACP / Runtime Bridge | OPL session 归一化 ID |
| `oplConversationId` | OPL WebUI bridge | WebUI conversation ID |
| `clientMessageId` | OPL WebUI / Portal client | 幂等 message intent ID |
| `messageId` | Runtime Bridge | Runtime Bridge message projection ID |
| `replyMessageId` | OPL / Runtime Bridge | assistant reply projection ID |
| `fileRef` | Portal / Runtime Bridge | workspace-scoped file reference |
| `runId` | Runtime Bridge / Runtime Agent | run canonical ID |
| `artifactRef` | Runtime Bridge / Runtime Agent | 输出 artifact public reference |
| `outputFileRef` | Portal / Runtime Bridge | 输出文件 public reference |
| `traceId` | Runtime Bridge | sanitized trace metadata ID |
| `billingMetadataRef` | Runtime Bridge / Portal billing projection | 账单元数据引用，不是账单真相外泄 |

所有 projection 必须绑定 `tenantId + portalUserId + workspaceId`。message、file、run、artifact 和 trace 还必须绑定 session 或 run 维度，避免跨 workspace、跨 session 或跨用户串读。

## Capability Registry

Runtime Bridge 必须以 capability registry 暴露真实能力裁定。允许状态如下：

- `supported`: 真实能力已验证并可通过稳定 projection 回流。
- `mapped_to_webui_bridge`: 真实能力通过 WebUI bridge 映射。
- `mapped_to_acp_runtime`: 真实能力通过公开 ACP runtime 映射。
- `requires_runtime_agent`: 需要 Runtime Agent 才能完成。
- `deferred_authorization`: 能力需要用户或运维单独授权。
- `capability_not_supported`: 当前真实 upstream 不支持或未验证。
- `provider_key_required`: 需要 `providerKeyRef` 或用户授权 provider key。
- `managed_environment_required`: 需要已开通托管运行环境。
- `runtime_authorization_required`: 需要真实 Runtime Agent / 真实云 runtime 授权。
- `upstream_unavailable`: 真实 upstream 不可访问。
- `upstream_reply_timeout`: message 已进入 upstream，但未观测到 reply。
- `runtime_bridge_mapping_failed`: upstream shape 变化或映射失败。
- `trace_sink_not_configured`: trace sink 未配置或未授权。

capability registry 至少覆盖：

```json
{
  "contextBootstrap": "supported",
  "sessionBackflow": "mapped_to_webui_bridge",
  "messageReply": "capability_not_supported",
  "fileUpload": "capability_not_supported",
  "runIntent": "requires_runtime_agent",
  "artifactBackflow": "requires_runtime_agent",
  "observabilityProjection": "trace_sink_not_configured"
}
```

真实 canary 发现新事实后，必须更新合同和 status，而不是让代码隐式兼容。

## Discovery And Canary Evidence Boundary

canary evidence 只允许写入 `.runtime`，不得进入 git。evidence 允许包含：

- upstream version / commit / package metadata。
- canary command 名称和脱敏 exit status。
- capability registry snapshot。
- sanitized endpoint path。
- sanitized WebSocket event type。
- sanitized timing metadata。
- sanitized status/error code。

evidence 禁止包含：

- raw prompt。
- raw completion。
- raw API key。
- bearer token。
- `launchToken`。
- `runtimeToken`。
- `objectKey`。
- `storageKey`。
- `localPath`。
- `signedUrl`。
- `presignedUrl`。
- kubeconfig、SecretId、SecretKey、SSH private key 或 `.env` 内容。

## Message Reply Canary

message reply canary 的目标是证明 message 真正进入 OPL/agent/provider，并形成可查询回流。

message reply 的 provider 级细分验收以 [v22-real-opl-provider-message-canary-boundary.md](./v22-real-opl-provider-message-canary-boundary.md) 和 `docs/recovery/real-opl-provider-message-canary-validation-path.md` 为准。该细分合同只证明真实 message/reply/provider 边界，不证明 file、run、artifact、真实云 runtime 或 Langfuse 已上线。

请求必须携带：

- `tenantId`
- `portalUserId`
- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `oplSessionId` 或 `oplConversationId`
- `clientMessageId`
- `providerKeyRef`

成功必须返回：

- `messageId`
- `status`
- `replyMessageId`
- sanitized reply metadata
- optional `traceId`
- capability source，例如 `mapped_to_webui_bridge`

失败必须返回明确 gate：

- 无 provider 时返回 `provider_key_required`。
- 未开通托管环境时返回 `managed_environment_required`。
- upstream 不可达时返回 `upstream_unavailable`。
- reply 未观测到时返回 `upstream_reply_timeout` 或 `capability_not_supported`。
- upstream shape 变化时返回 `runtime_bridge_mapping_failed`。

不得返回 raw prompt、raw completion、raw API key、bearer token、`launchToken` 或 `runtimeToken`。

## File Capability Canary

file capability canary 的目标是证明文件能力是否可形成 workspace-scoped fileRef。

成功必须返回：

- `fileRef`
- `workspaceId`
- `workspaceSessionId`
- `source`
- `status`
- sanitized file metadata，例如 file name、size、content type

失败必须返回明确 gate：

- upstream 不支持文件上传时返回 `capability_not_supported`。
- 需要 Runtime Agent 时返回 `requires_runtime_agent`。
- 需要托管环境时返回 `managed_environment_required`。
- storage boundary 未授权时返回 `deferred_authorization`。

公开 response 禁止包含 `objectKey`、`storageKey`、`localPath`、`signedUrl`、`presignedUrl` 或内部 bucket/path。

## Runtime Agent And Run Canary

Runtime Agent And Run Canary 的目标是证明 run intent 是否进入真实 Runtime Bridge / Runtime Agent boundary。Runtime Bridge / Runtime Agent is the downstream canonical source for run、artifact、ledger、trace 和 billing metadata。

成功必须返回：

- `runId`
- `status`
- `workspaceId`
- `runtimeSessionId`
- `resourceBindingId`
- `providerKeyRef`
- `traceId`
- `billingMetadataRef`
- sanitized runtime metadata

失败必须返回明确 gate：

- 无 provider 时返回 `provider_key_required`。
- 未开通托管环境时返回 `managed_environment_required`。
- 未配置 Runtime Agent 时返回 `requires_runtime_agent`。
- 需要真实 runtime 授权时返回 `runtime_authorization_required`。

本合同默认不调用真实云 runtime。真实云 runtime、真实 Runtime Agent endpoint、真实计算/存储资源和真实部署必须单独授权。

## Artifact Backflow Canary

artifact backflow canary 的目标是证明 run 输出能形成 Portal 可查询的 public reference。

成功必须返回：

- `artifactRef` 或 `outputFileRef`
- `runId`
- `workspaceId`
- `runtimeSessionId`
- `resourceBindingId`
- `providerKeyRef`
- `status`
- sanitized artifact metadata

公开 response 禁止包含 `objectKey`、`storageKey`、`localPath`、`signedUrl`、`presignedUrl`、runtime 私有路径或 storage secret。

artifact 必须能通过 Portal 按 `workspace/session/run` 查询，不能只存在于 Runtime Agent 私有状态里。

## Observability Canary

Observability Canary 的目标是证明 session/message/run metadata 能形成 sanitized projection。Langfuse is an optional sanitized observability attachment，不是 Portal、billing、file、artifact 或 run 的 canonical source。

成功必须返回：

- `traceId`
- `sessionId` 或 `workspaceSessionId`
- `oplSessionId`
- `messageId` 或 `runId`
- `status`
- `latencyMs`
- sanitized usage summary
- sanitized cost estimate
- tags

`trace.medopl.cn` 是后续 Langfuse admin/ops console 目标域。真实部署、DNS、TLS、Ingress、Langfuse secret、ClickHouse 和真实 trace source 必须单独授权。

Langfuse 未配置时必须返回 `trace_sink_not_configured` 或 `deferred_authorization`，不得影响 Portal-OPL context、session 或 message gate 的独立判断。

## Portal Projection Canary

Portal projection canary 的目标是证明 Portal 能按 workspace/session/run 查询状态、文件、trace 和 billing metadata。

Portal 只能通过稳定 `/portal/api/opl/*` 或已定义 Portal API 查询 Runtime Bridge projection。Portal 禁止直接依赖：

- one-person-lab route。
- WebSocket event shape。
- DOM。
- frontend store。
- upstream database schema。
- upstream internal session model。

Portal projection 必须覆盖：

- launch status。
- bootstrap context。
- capability registry。
- session binding。
- message status。
- fileRef status。
- run status。
- artifact/output reference。
- trace metadata。
- billing metadata reference。

## Error Gates And No-Fake-Success

本合同禁止 fake success。以下情况必须返回明确错误，不得返回 200 假成功：

- `provider_key_required`
- `managed_environment_required`
- `runtime_authorization_required`
- `requires_runtime_agent`
- `upstream_unavailable`
- `upstream_reply_timeout`
- `runtime_bridge_mapping_failed`
- `capability_not_supported`
- `trace_sink_not_configured`
- `deferred_authorization`

HTTP status 必须表达业务失败类别。若网关或 Runtime Bridge 使用 202 表达异步 accepted，response 必须包含 `status=queued|running` 和后续查询 URL/ID；不得把 `queued` 伪装成 `succeeded`。

## Absorption Gate

本合同对应分支进入 B 窗口前必须满足：

1. 明确声明订阅本合同包和模型记录。当前 lane 分支名为 `feat/v22-real-opl-capability-canary`，模型记录为 `gpt-5.4`。
2. `node tests/regression/opl/smoke-test-v22-real-opl-capability-contract-gate.mjs` 通过。
3. `node tests/regression/opl/smoke-test-v22-portal-opl-context-backflow-contract.mjs` 通过。
4. `node tests/smoke/smoke-test-v22-portal-opl-connection-contract.mjs` 通过。
5. `node tests/contract/smoke-test-v22-mvp-contract-suite.mjs` 通过，或明确记录未运行原因。
6. canary 事实已回写合同、status 和 validation path。
7. message/file/run/artifact/observability 未完成真实 canary 时，必须在状态矩阵标记为未完成或需授权。
8. 没有修改 one-person-lab upstream。
9. 没有读取 secret，没有调用真实云，没有 build/push/kubectl/live-test，没有修改 deploy、`.sentrux` 或 adapters。
10. `git diff --check -- docs/contracts docs/recovery scripts` 通过。
