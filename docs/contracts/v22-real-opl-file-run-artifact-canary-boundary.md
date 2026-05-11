# v22 Real OPL File Run Artifact Canary Boundary Contract

本合同定义 MedOPL v22 中真实 OPL file/run/artifact canary 的边界。它回答一件事：

```text
Portal 已能进入 clean OPL WebUI、绑定 session，并已通过授权 provider message reply canary 后，如何继续验证文件上传或文件 intent 是否形成 workspace-scoped fileRef、run 是否进入 Runtime Agent boundary、artifact/output 是否回流 Portal。
```

本合同不替代 [v22-real-opl-capability-canary-boundary.md](./v22-real-opl-capability-canary-boundary.md)。前者定义真实 OPL capability canary 总链路，本合同只细化 file、run、artifact、trace projection 和 billing metadata handoff 的执行边界。

## Contract Level

合同分级如下：

- Level 1: [v22-mvp-managed-opl-loop.md](./v22-mvp-managed-opl-loop.md)。一级主合同，定义 MedOPL 托管 OPL SaaS 用户主闭环。
- Level 2: [v22-portal-opl-connection-boundary.md](./v22-portal-opl-connection-boundary.md)、[v22-upstream-opl-boundary.md](./v22-upstream-opl-boundary.md) 和 [v22-opl-work-message-file-run-boundary.md](./v22-opl-work-message-file-run-boundary.md)。二级段合同，定义 Portal-OPL 连接、clean upstream 和 OPL 工作流业务边界。
- Level 3: [v22-real-opl-capability-canary-boundary.md](./v22-real-opl-capability-canary-boundary.md) 和本合同。`v22-real-opl-capability-canary-boundary.md` 是真实 OPL 能力 canary 总合同；本合同是 file/run/artifact 三级执行合同，细化每个 step gate、真实证据、Portal projection 和吸收标准。

本合同是三级执行合同，不改一级主线叙事，不扩大二级 Portal-OPL 边界授权，也不把未验证能力标记为已上线。

## Subscription Package

本合同订阅以下合同包：

- [v22-mvp-managed-opl-loop.md](./v22-mvp-managed-opl-loop.md)
- [v22-portal-opl-connection-boundary.md](./v22-portal-opl-connection-boundary.md)
- [v22-portal-opl-context-backflow-boundary.md](./v22-portal-opl-context-backflow-boundary.md)
- [v22-real-opl-capability-canary-boundary.md](./v22-real-opl-capability-canary-boundary.md)
- [v22-real-opl-provider-message-canary-boundary.md](./v22-real-opl-provider-message-canary-boundary.md)
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
- `docs/recovery/real-opl-capability-canary-validation-path.md`
- `docs/recovery/real-opl-provider-message-canary-validation-path.md`
- `docs/recovery/real-opl-file-run-artifact-validation-path.md`

## Product Truth

产品真相：

```text
Portal is the SaaS control plane.
Gateway is the clean OPL WebUI entry/proxy.
Adapter is the anti-corruption layer for file intent, run intent, artifact backflow, gate errors, and Portal projection.
Runtime Bridge / Runtime Agent is the downstream canonical source for run, artifact, ledger, trace, and billing metadata.
云服务/COS 是真实账单与存储事实源。
Langfuse is an optional sanitized observability attachment.
one-person-lab upstream remains clean.
```

本合同只定义 canary 和后续 productionization handoff。真实 file/run/artifact 只有在可观测到对应事实时才能标记为成功：

- file 成功必须有 workspace-scoped `fileRef`。
- run 成功必须进入 Runtime Bridge / Runtime Agent boundary，并返回 `runId/status/traceId`。
- artifact 成功必须有 `artifactRef` 或 `outputFileRef` 回流 Portal。
- trace 成功必须是 sanitized Portal projection；Langfuse 只是可选附件。
- billing 成功只能表达 `billingMetadataRef`、`usageMetadataRef` 或 `resourceBindingId` 等可对账 metadata；不能声称真实 billing/cost 已闭环。

任何步骤没有真实证据时，必须返回明确 gate。不得使用 fake Product API、fixture Runtime Agent relay、placeholder 200、前端 DOM 变化或本地假 run 伪装真实成功。

## Primary Scope

本合同 Primary Scope 是：

```text
Portal launch
  -> Gateway clean OPL WebUI
  -> Adapter bootstrap/session bind
  -> real OPL file upload or file intent
  -> workspace-scoped fileRef
  -> run intent
  -> Runtime Bridge / Runtime Agent gate
  -> runId/status/traceId
  -> artifactRef or outputFileRef
  -> Portal projection by workspace/session/run
```

本合同覆盖：

- 复用已证明的 Portal launch、Gateway、clean OPL WebUI、session bind 和 provider message baseline。
- file upload 或 file intent 是否能形成 workspace-scoped `fileRef`。
- Adapter 是否能把真实 OPL/WebUI/ACP file shape 映射成稳定 file projection。
- run intent 是否进入 Runtime Bridge / Runtime Agent boundary。
- run 是否返回 `runId/status/traceId/billingMetadataRef/usageMetadataRef` 或明确 gate。
- artifact/output 是否形成 `artifactRef` 或 `outputFileRef`。
- Portal 是否能按 `workspaceId + workspaceSessionId + runId` 查询 file、run、artifact、trace 和 billing metadata reference。
- Langfuse / `trace.medopl.cn` 是否仅作为 sanitized observability attachment 处理。

## Non-goals

本合同不做以下事项：

- 不修改 one-person-lab upstream。
- 不 import upstream 内部模块。
- 不在 upstream 目录写 Portal、Gateway、Adapter、Runtime 或 Langfuse 代码。
- 不读取 raw API key、`.env`、kubeconfig、SecretId、SecretKey、SSH private key 或外部生产 token。
- 不调用真实云 mutation，不创建、删除、释放、扩缩容或改标签真实云资源。
- 不调用 COS mutation，不清空 bucket，不读取对象正文，不暴露 object key。
- 不 build/push/kubectl/live-test。
- 不修改 `deploy/*`、`.sentrux/*` 或 `adapters/*`。
- 不部署 Langfuse。
- 不部署 `trace.medopl.cn`、ClickHouse、DNS、TLS 或 Ingress。
- 不实现 COS 真实账单结算。
- 不把 `/api/opl/*` placeholder 当 Product API。
- 不把 Langfuse 当成 file、run、artifact、billing 或 Portal session 的 canonical source。
- 不把 fake Product API、本地 fake Runtime Agent relay、placeholder 200、fixture artifact 或 local-only output 当成真实 OPL file/run/artifact 成功证据。

## Authorization Boundary

默认授权只允许：

- 读取和修改 v22 active surface 中的合同、recovery 文档和 v22 smoke。
- 复用已经证明的真实 OPL WebUI session / provider message canary 事实。
- 启动或连接用户明确授权的本地真实 OPL WebUI canary 来源。
- 通过公开 HTTP/WebSocket/ACP/CLI 边界读取脱敏非 secret 元数据。
- 把 canary evidence 写入 `.runtime`。
- 在缺少 file、Runtime Agent、cloud、storage 或 Langfuse 授权时验证 gate。

需要用户单独授权后才能做：

- 读取或输入真实 provider raw API key。
- 使用真实 Runtime Agent endpoint。
- 使用真实云 runtime、腾讯云资源、COS、TKE、K8s 或 kubectl。
- 调用真实云 mutation 或 COS mutation。
- 部署 Langfuse 或 `trace.medopl.cn`。
- 读取 secret 文件、`.env`、kubeconfig、SecretId、SecretKey 或外部生产 token。
- 运行 build/push/kubectl/live-test。
- 修改 one-person-lab upstream、deploy、`.sentrux` 或 adapters。

## Canonical Identity Map

真实 file/run/artifact canary 必须固定以下 ID 归属：

| 字段 | Canonical owner | 说明 |
| --- | --- | --- |
| `tenantId` | Portal | 租户边界 |
| `portalUserId` | Portal | 用户边界 |
| `workspaceId` | Portal | workspace 边界 |
| `launchId` | Portal / Gateway | 一次进入 OPL 的 launch 关联，不进入 URL query |
| `workspaceSessionId` | Portal / Adapter | Portal workspace session projection |
| `runtimeSessionId` | Adapter / Runtime Bridge | runtime session 归一化 ID |
| `resourceBindingId` | Portal / Runtime Bridge | 托管运行环境绑定 ID |
| `providerKeyRef` | Portal / Runtime Bridge secret boundary | provider 绑定引用，不是 raw API key |
| `oplSessionId` | OPL WebUI / ACP / Adapter | OPL session 归一化 ID |
| `oplConversationId` | OPL WebUI bridge | WebUI conversation ID |
| `fileRef` | Portal / Runtime Bridge | workspace-scoped file reference |
| `runId` | Runtime Bridge / Runtime Agent | run canonical ID |
| `traceId` | Adapter / Runtime Bridge / Portal | sanitized trace metadata ID |
| `artifactRef` | Runtime Bridge / Runtime Agent | 输出 artifact public reference |
| `outputFileRef` | Portal / Runtime Bridge | 输出文件 public reference |
| `billingMetadataRef` | Runtime Bridge / Portal billing projection | 账单元数据引用，不是账单事实本身 |
| `usageMetadataRef` | Runtime Bridge / Portal billing projection | 用量元数据引用，不是云账单本身 |
| `ownerRef` | Package D / deploy lane | Kubernetes/deploy owner reference，不由 OPL lane 生成或解释 |
| `operationId` | Package D / cloud operation lane | 部署或云操作执行 ID，不由 OPL lane 生成或解释 |
| K8s labels | Package D / deploy lane | deploy owner labels，不由 OPL lane 生成或解释 |

`fileRef`、`runId`、`artifactRef`、`outputFileRef`、`traceId`、`billingMetadataRef` 和 `usageMetadataRef` 必须绑定同一组 `tenantId + portalUserId + workspaceId + workspaceSessionId + runtimeSessionId`。run 与 artifact 还必须绑定 `resourceBindingId`。无法绑定时返回 `adapter_mapping_failed`。

## Step Gates

每个 step 必须有 gate。gate 的作用不是兜底，而是把真实状态裁定清楚，避免 HTTP 200 假成功。

通用 gate：

- `capability_not_supported`: 真实 upstream、WebUI bridge、ACP runtime 或 Runtime Agent 未提供该能力。
- `adapter_mapping_failed`: 真实返回 shape 变化、ID 绑定缺失或 projection 无法归一化。
- `upstream_unavailable`: 真实 OPL WebUI/ACP/API/CLI 来源不可达。
- `deferred_authorization`: 能力需要用户、运维或真实外部系统单独授权。
- `managed_environment_required`: 需要已开通托管运行环境。
- `requires_runtime_agent`: 需要 Runtime Agent 才能完成。
- `runtime_authorization_required`: 需要真实 Runtime Agent endpoint 或真实云 runtime 授权。
- `trace_sink_not_configured`: trace sink 或 Langfuse attachment 未配置。

业务 gate：

- `file_upload_capability_not_supported`
- `file_ref_not_observed`
- `workspace_file_scope_missing`
- `storage_authorization_required`
- `run_not_observed`
- `artifact_not_observed`
- `output_file_ref_not_observed`
- `portal_projection_missing`

no fake 200 规则：

- 同步失败必须返回失败 HTTP status 和明确 `error`。
- 异步 accepted 可以返回 202，但 response 必须包含 `status=queued|running`、`runId` 或后续查询 ID/URL。
- `queued`、`running`、`gated` 或 `unsupported` 不得伪装成 `succeeded`。
- Adapter 不得生成伪 `fileRef`、伪 `runId`、伪 `artifactRef`、伪 `outputFileRef`、伪 `billingMetadataRef` 或伪 `usageMetadataRef`。

## File Upload Gate

file upload gate 的目标是证明真实 OPL file upload 或 file intent 是否能形成 workspace-scoped `fileRef`。

成功必须返回：

- `fileRef`
- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `source`
- `status`
- sanitized file metadata，例如 file name、size、content type、hash reference

失败必须返回：

- upstream 不支持文件上传时返回 `file_upload_capability_not_supported` 或 `capability_not_supported`。
- 已提交文件 intent 但未观测到 `fileRef` 时返回 `file_ref_not_observed`。
- `fileRef` 未绑定 workspace/session 时返回 `workspace_file_scope_missing`。
- 需要存储授权时返回 `storage_authorization_required`。
- 需要 Runtime Agent 时返回 `requires_runtime_agent`。
- 需要外部授权时返回 `deferred_authorization`。

公开 response 禁止包含 `objectKey`、`storageKey`、`localPath`、`signedUrl`、`presignedUrl`、内部 bucket/path 或对象正文。

## Run Gate

run gate 的目标是证明 run intent 是否进入真实 Runtime Bridge / Runtime Agent boundary。

成功必须返回：

- `runId`
- `status=queued|running|succeeded|failed`
- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `resourceBindingId`
- `providerKeyRef`
- `traceId`
- `billingMetadataRef` 或 `usageMetadataRef`
- sanitized runtime metadata

失败必须返回：

- 未开通托管运行环境时返回 `managed_environment_required`。
- 未配置 Runtime Agent 时返回 `requires_runtime_agent`。
- 需要真实 runtime 授权时返回 `runtime_authorization_required`。
- intent 未进入 Runtime Agent boundary 时返回 `run_not_observed`。
- upstream 不可达时返回 `upstream_unavailable`。
- 映射失败时返回 `adapter_mapping_failed`。

本合同默认不调用真实云 runtime。真实云 runtime、真实 Runtime Agent endpoint、真实计算/存储资源和真实部署必须单独授权。

## Artifact Output Gate

artifact output gate 的目标是证明 run 输出能形成 Portal 可查询的 public reference。

成功必须返回：

- `artifactRef` 或 `outputFileRef`
- `runId`
- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `resourceBindingId`
- `status`
- sanitized artifact metadata

失败必须返回：

- run 已完成但未观测到 artifact 时返回 `artifact_not_observed`。
- output file reference 未观测到时返回 `output_file_ref_not_observed`。
- output 未绑定 workspace/session/run 时返回 `adapter_mapping_failed`。
- 需要 Runtime Agent 时返回 `requires_runtime_agent`。
- 需要真实 runtime 授权时返回 `runtime_authorization_required`。

公开 response 禁止包含 `objectKey`、`storageKey`、`localPath`、`signedUrl`、`presignedUrl`、runtime 私有路径、storage secret 或对象正文。

## Trace Projection Gate

trace projection gate 的目标是证明 session/file/run/artifact metadata 能形成 sanitized Portal projection。

成功必须返回：

- `traceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `runId` 或 `fileRef`
- `status`
- `latencyMs`
- sanitized event names
- sanitized usage summary reference

Langfuse 未配置时必须返回 `trace_sink_not_configured` 或 `deferred_authorization`，不得影响 file、run、artifact 的独立业务 gate。

## Portal Projection Gate

Portal projection gate 的目标是证明 Portal 能按 workspace/session/run 查询状态、文件、trace 和 billing metadata。

Portal 只能通过稳定 `/portal/api/opl/*` 或已定义 Portal API 查询 Adapter/Runtime projection。Portal 禁止直接依赖：

- one-person-lab route。
- WebSocket event shape。
- DOM。
- frontend store。
- upstream database schema。
- upstream internal session model。

成功必须覆盖：

- fileRef status。
- run status。
- artifact/output reference。
- trace metadata。
- billing metadata reference。
- workspace/session/run 归属。

若 Adapter 已观测到 file/run/artifact 但 Portal 不能按 `workspaceId + workspaceSessionId + runId` 查询，必须返回 `portal_projection_missing`，不得只把 Adapter 内部状态当成用户闭环。

## Billing Metadata Boundary

云服务/COS 是真实账单与存储事实源。OPL file/run/artifact 分支只负责把 runtime 侧可对账元数据安全传回 Portal。

OPL 分支只传 `billingMetadataRef`、`usageMetadataRef` 或 `resourceBindingId`。允许的 public metadata 包括：

- resource binding reference。
- usage summary reference。
- billing metadata reference。
- run duration summary。
- storage/file size summary。
- cost allocation tag reference。

禁止：

- 声称真实 billing/cost 已闭环。
- 声称 COS 账单已核对。
- 返回云账号、bucket 私有路径、object key、signed URL、SecretId、SecretKey 或 token。
- 用本地估算替代云账单事实。

真实 COS 账单、云账单、T+1 对账、冻结/扣费和成本核对由云服务链路负责，不由本 OPL 适配分支伪造。

## Production Runtime Agent Binding

Production Runtime Agent binding 是 OPL lane 对 Package D 和云服务 lane 的上游输入，不是 deploy 实现。OPL lane 只产出运行身份与 run/artifact projection：

- workspace identity: `workspaceId`、`workspaceSessionId`、`runtimeSessionId`。
- runtime identity: `resourceBindingId`、`providerKeyRef`、Runtime Agent endpoint binding status。
- file projection: workspace-scoped `fileRef`。
- run projection: `runId`、`status`、`traceId`、`billingMetadataRef`、`usageMetadataRef`。
- artifact projection: `artifactRef` 或 `outputFileRef`。

`resourceBindingId/workspace runtime identity` 是 OPL lane 交给下游 lane 的唯一资源绑定上下文。OPL lane 不提供 `ownerRef`、`operationId` 或 K8s labels，不决定 namespace、workload、container、rollout、digest verify、owner labels 或 rollback evidence。这些属于 Package D / deploy lane 和云服务 lane 的合同。

Production Runtime Agent binding 允许 config-only / fake Runtime Agent endpoint binding 来验证公开 HTTP API relay；默认不读取 secret、不调用真实云、不 build/push/deploy、不 kubectl、不修改 one-person-lab upstream。未配置 Runtime Agent endpoint 时必须返回 `requires_runtime_agent`。Runtime Agent 未返回 artifact 时必须返回 `artifact_not_observed` 或 `output_file_ref_not_observed`。Adapter 不得伪造 `fileRef`、`runId`、`artifactRef`、`outputFileRef`、`billingMetadataRef` 或 `usageMetadataRef`。

## Langfuse Attachment Boundary

Langfuse is an optional sanitized observability attachment。`trace.medopl.cn` 是后续 Langfuse admin/ops console 目标域，不是本合同默认部署目标。

允许发送到 Langfuse 的内容只包括 sanitized metadata：

- `tenantId` / `workspaceId` / session/run/message/file public reference。
- status。
- gate code。
- latency metadata。
- capability source。
- usage metadata reference。

禁止发送：

- raw API key。
- bearer token。
- raw prompt。
- raw completion。
- object key。
- signed URL。
- local path。
- upstream database row。
- secret file path。

Langfuse 未部署时，Portal session trace 仍以 Portal canonical projection 为准。

## Canary Evidence Boundary

canary evidence 只允许写入 `.runtime`，不得进入 git。evidence 允许包含：

- canary command 名称和脱敏 exit status。
- capability registry snapshot。
- sanitized endpoint path。
- sanitized WebSocket event type。
- sanitized timing metadata。
- sanitized gate code。
- sanitized file/run/artifact public reference。

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

## Productionization Handoff

canary 发现的事实必须回写合同、status 和 validation path。后续 production implementation 只能基于已验证事实推进：

- 真实 fileRef 已观测到，才能实现 productionized file projection。
- 真实 Runtime Agent run 已观测到，才能实现 productionized run relay。
- 真实 artifact/output 已观测到，才能实现 productionized artifact projection。
- 真实 Langfuse 或 `trace.medopl.cn` 已授权部署后，才能实现 productionized observability attachment。
- 真实云账单/COS 账单已进入云服务合同后，才能把 billing metadata ref 接到真实账单核对。

未验证能力必须保留 gate，不得转成隐式成功。

## Absorption Gate

本合同对应分支进入 B 窗口前必须满足：

1. 明确声明订阅本合同包和模型记录。当前开发分支为 `feat/v22-real-opl-file-run-artifact-canary`，模型记录为 `gpt-5.3-codex`。
2. `node scripts/smoke-test-v22-real-opl-file-run-artifact-canary-contract.mjs` 通过。
3. `node scripts/smoke-test-v22-real-opl-file-run-artifact-runtime-agent-api-loop.mjs` 通过，证明 Portal -> Gateway -> Adapter -> Runtime Agent HTTP API -> workspace-scoped `fileRef` -> `runId/status/traceId` -> `artifactRef` / `outputFileRef` -> Portal workspace/session/run trace projection 的完整本地 canary 闭环。
4. `node scripts/smoke-test-v22-real-opl-file-run-artifact-gates.mjs` 通过，证明 `OPL_RUNTIME_MODE=webui` 且未配置 Runtime Agent API 时 file/run/artifact 不会伪成功：file 返回 `file_upload_capability_not_supported`，run 返回 queryable `requires_runtime_agent` gated run，artifact 返回 `artifact_not_observed` / `output_file_ref_not_observed`。该 smoke 只是负向保护，不满足完整闭环吸收标准。
5. Runtime Agent API relay full-loop smoke 必须证明 Runtime Agent canary server 实际收到 file upload/intake 和 run dispatch HTTP 请求；Adapter/Portal public response、Portal trace、canary evidence 和 git 不包含 raw API key、bearer token、`launchToken`、`runtimeToken`、`objectKey`、`storageKey`、`localPath`、`signedUrl` 或 `presignedUrl`。
6. `node scripts/smoke-test-v22-real-opl-capability-canary-contract.mjs` 通过。
7. `node scripts/smoke-test-v22-real-opl-provider-message-canary-contract.mjs` 通过。
8. `node scripts/smoke-test-v22-mvp-contract-suite.mjs` 通过，或明确记录未运行原因。
9. file/run/artifact/trace/billing metadata 未完成 Runtime Agent API full-loop canary 时，不可吸收；真实云 runtime、COS 账单、Langfuse / `trace.medopl.cn` 未完成时，必须在状态矩阵标记为未上线或需单独授权。
10. 没有修改 one-person-lab upstream。
11. 没有读取 secret，没有调用真实云，没有 build/push/kubectl/live-test，没有修改 deploy、`.sentrux` 或 adapters。
12. `git diff --check -- docs/contracts docs/recovery scripts services/opl-runtime-bridge services/portal` 通过。
13. secret/path scan 不发现 raw key、token、本机 secret path、object key、signed URL 或 `.env` 内容。
