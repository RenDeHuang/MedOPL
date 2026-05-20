# v22 Real OPL File Run Artifact Canary Workflow And Validation Path

本文定义真实 OPL file/run/artifact canary 的完整工作流和验证顺序。它是 [spec:v22-real-opl-file-run-artifact-canary-boundary](../specs/README.md) 的执行路径，不替代一级主合同、二级 Portal-OPL 连接合同、[real-opl-capability-canary-validation-path.md](./real-opl-capability-canary-validation-path.md) 或 [real-opl-provider-message-canary-validation-path.md](./real-opl-provider-message-canary-validation-path.md)。

## Complete Workflow

真实 file/run/artifact canary 的目标链路是：

```text
Portal launch -> Gateway -> clean OPL WebUI -> Runtime Bridge -> file intent -> workspace-scoped fileRef -> run intent -> Runtime Agent gate -> runId/status/traceId -> artifactRef or outputFileRef -> Portal projection
```

完整业务闭环必须证明：

```text
Portal user enters OPL
  -> OPL receives MedOPL public context
  -> real OPL session/conversation is bound
  -> provider message baseline is already proven or gated separately
  -> file upload or file intent is accepted or explicitly gated
  -> workspace-scoped fileRef is observed or explicit file gate is returned
  -> run intent enters Runtime Bridge / Runtime Agent boundary or explicit runtime gate is returned
  -> runId/status/traceId is observed or explicit run gate is returned
  -> artifact/output creates artifactRef or outputFileRef or explicit artifact gate is returned
  -> Portal queries file/run/artifact/trace/billing metadata by workspace/session/run
```

闭环不是只返回 HTTP 200。闭环必须有 workspace-scoped `fileRef`、`runId/status/traceId`、`artifactRef` 或 `outputFileRef`，以及 Portal 可查询 projection。失败必须 no fake 200。

本分支的可吸收目标不是 gate-only。gate smoke 只证明失败不会伪成功；可吸收目标必须跑通本地 Runtime Agent HTTP API relay full-loop：

```text
Portal HTTP API
  -> Gateway clean OPL Web entry
  -> Runtime Bridge launch/bootstrap/session bind
  -> Runtime Agent HTTP file intake
  -> workspace-scoped fileRef
  -> Runtime Agent HTTP run dispatch
  -> runId/status/traceId + billing/usage metadata ref
  -> artifactRef/outputFileRef
  -> Portal /portal/api/session-traces projection
```

该 full-loop 使用本地独立 Runtime Agent canary server，不使用 `local-fake-runtime-agent-relay`，不调用真实云，不部署 Langfuse，不修改 one-person-lab upstream。真实云 runtime、COS 账单和 `trace.medopl.cn` 仍是单独授权链路。

## Validation Order

### Stage 0: Branch contract declaration

目标：

- 声明本分支是 `contract/v22-real-opl-file-run-artifact-canary-boundary`。
- 声明模型记录为 `gpt-5.3-codex`。
- 声明合同订阅包。
- 声明授权边界和非目标。

验收：

- 分支从 `recovery/platform-v22-trunk` 新开。
- 本分支只触碰 active surface。
- 不修改 upstream、deploy、`.sentrux` 或 adapters。
- 不读取 secret。
- 不调用真实云。
- 不调用 COS mutation。
- 不部署 Langfuse。
- 不 build/push/kubectl/live-test。

### Stage 1: Reuse proven Portal launch and provider message baseline

目标：

- 复用已吸收的 Portal launch、Gateway、clean OPL WebUI、Runtime Bridge session bind 和授权 provider message reply canary 事实。
- 不在 file/run/artifact 分支重新定义 provider message 成功标准。

验证命令：

```text
node tests/regression/opl/regression-test-v22-real-opl-provider-message-contract-gate.mjs
node tests/regression/opl/regression-test-v22-portal-opl-context-backflow-contract.mjs
```

验收：

- provider message baseline 仍只证明真实 message/reply。
- provider message baseline 不代表真实 file/run/artifact。
- file/run/artifact 分支不得读取 raw provider key。
- `mapped_to_webui_bridge` 只用于已验证的 message reply，不自动推导 file/run/artifact。

### Stage 2: File upload or file intent gate

目标：

- 验证真实 OPL WebUI、ACP 或 Runtime Bridge/Runtime Agent boundary 是否存在可接入的 file upload 或 file intent。
- 如果没有真实文件能力，返回明确 gate。

预期链路：

```text
OPL file upload or file intent
  -> Runtime Bridge normalized file intent
  -> workspace file boundary or Runtime Agent boundary
```

成功验收：

- file intent 有稳定 `workspaceId`、`workspaceSessionId`、`runtimeSessionId` 和 source。
- public response 不包含 `objectKey`、`storageKey`、`localPath`、`signedUrl` 或 `presignedUrl`。

失败验收：

- upstream 不支持文件上传时返回 `file_upload_capability_not_supported` 或 `capability_not_supported`。
- 需要存储授权时返回 `storage_authorization_required`。
- 需要 Runtime Agent 时返回 `requires_runtime_agent`。
- 需要外部授权时返回 `deferred_authorization`。

### Stage 3: Workspace-scoped fileRef projection

目标：

- 证明 file upload 或 file intent 形成 workspace-scoped `fileRef`。
- 证明 Portal 能查询 file projection。
- 在 Runtime Agent API relay full-loop 中，fileRef 必须来自 Runtime Agent HTTP file intake response，Runtime Bridge 只做归一化和 Portal projection，不得本地伪造。

成功验收：

- 返回 `fileRef`。
- `fileRef` 绑定 `workspaceId + workspaceSessionId + runtimeSessionId`。
- Portal 能按 workspace/session 查询该 fileRef。

失败验收：

- 已提交 file intent 但未观测到 `fileRef` 时返回 `file_ref_not_observed`。
- `fileRef` 未绑定 workspace/session 时返回 `workspace_file_scope_missing`。
- Runtime Bridge 映射失败时返回 `runtime_bridge_mapping_failed`。
- Portal 无法查询时返回 `portal_projection_missing`。

### Stage 4: Run intent and Runtime Agent gate

目标：

- 验证 run intent 是否能进入真实 Runtime Bridge / Runtime Agent boundary。
- 如果没有真实 Runtime Agent 或真实 runtime 授权，返回明确 gate。
- 在本地 full-loop canary 中，Runtime Agent boundary 是独立 HTTP canary server；该 server 必须收到 sanitized run dispatch payload。

预期链路：

```text
OPL run intent
  -> Runtime Bridge normalized run intent
  -> Runtime Bridge / Runtime Agent boundary
```

成功验收：

- run intent 绑定 `workspaceId`、`runtimeSessionId`、`resourceBindingId`、`providerKeyRef` 和输入 `fileRef`。
- Runtime Agent boundary 返回 accepted、queued、running、succeeded 或 failed 的真实状态。

失败验收：

- 未开通托管运行环境时返回 `managed_environment_required`。
- 未配置 Runtime Agent 时返回 `requires_runtime_agent`。
- 需要真实 runtime 授权时返回 `runtime_authorization_required`。
- intent 未进入 Runtime Agent boundary 时返回 `run_not_observed`。
- upstream 不可用时返回 `upstream_unavailable`。

### Stage 5: Run state projection

目标：

- 验证 run 状态能形成 stable Runtime Bridge state 和 Portal projection。

成功验收：

- 返回 `runId`、`status`、`traceId`。
- 返回 `billingMetadataRef` 或 `usageMetadataRef`，但只作为可对账 metadata reference。
- Portal 能按 workspace/session/run 查询 run 状态。

失败验收：

- run state ID 绑定缺失时返回 `runtime_bridge_mapping_failed`。
- Portal 无法查询时返回 `portal_projection_missing`。
- pending 状态必须保留 `queued` 或 `running`，不得伪装成 `succeeded`。

### Stage 6: Artifact/output backflow gate

目标：

- 验证 run 输出是否形成 `artifactRef` 或 `outputFileRef`。
- 验证 output 能回到 Portal projection。

预期链路：

```text
Runtime Agent output
  -> Runtime Bridge artifact normalization
  -> artifactRef or outputFileRef
  -> Portal files / session / run projection
```

成功验收：

- 返回 `artifactRef` 或 `outputFileRef`。
- output 绑定 `workspaceId + workspaceSessionId + runId`。
- Portal 能按 workspace/session/run 查询 output。

失败验收：

- run 已完成但没有 artifact 时返回 `artifact_not_observed`。
- output file reference 未观测到时返回 `output_file_ref_not_observed`。
- output 未绑定 workspace/session/run 时返回 `runtime_bridge_mapping_failed`。
- Portal 无法查询时返回 `portal_projection_missing`。

### Stage 7: Runtime Agent API relay full-loop

目标：

- 用同一条本地 HTTP 链路证明 file/run/artifact 不是 gate-only，也不是 fake Runtime Agent relay。
- 验证 Production Runtime Agent binding 只产出 OPL lane 的运行身份和 projection，不产出 Package D deploy owner 字段。
- Runtime Agent canary server 通过公开 HTTP API 返回 workspace-scoped `fileRef`、`runId/status/traceId`、`artifactRef`、`outputFileRef`、`billingMetadataRef` 和 `usageMetadataRef`。
- Portal 通过 `/portal/api/opl/*` 和 `/portal/api/session-traces` 查询同一组 workspace/session/run projection。

历史 proof：

```text
Runtime Agent HTTP API proof is not production deploy evidence
```

成功验收：

- Portal 登录、launch、bootstrap、session bind、file、run、artifact 和 trace 查询都走真实 HTTP。
- Runtime Agent canary server 至少收到一次 file intake 请求和一次 run dispatch 请求。
- file response 包含 workspace-scoped `fileRef`，并绑定 `workspaceId + workspaceSessionId + runtimeSessionId`。
- run response 包含 `runId/status/traceId/billingMetadataRef/usageMetadataRef`，并绑定 `workspaceId + workspaceSessionId + runtimeSessionId + resourceBindingId + providerKeyRef + fileRef`。
- artifact response 包含 `artifactRef` 或 `outputFileRef`，并绑定 `workspaceId + workspaceSessionId + runId`。
- Portal session trace 能按 `workspaceId + runId` 查到该 run，并能看到 output artifact reference、`billingMetadataRef` 和 `usageMetadataRef`。
- OPL lane 不决定 `ownerRef`、`operationId` 或 K8s labels；Runtime Agent request、Portal response、trace projection 和 evidence 都不得包含这些 Package D owner 字段。
- public response、trace、Runtime Agent request body 和 evidence 都不包含 raw provider key、bearer token、`launchToken`、`runtimeToken`、`objectKey`、`storageKey`、`localPath`、`signedUrl` 或 `presignedUrl`。

失败验收：

- 未配置 Runtime Agent API endpoint 时，必须保留 Stage 10 的 negative gate。
- Runtime Agent API 返回缺少 file/run/artifact 必要 ID 时，Runtime Bridge 必须返回 `runtime_bridge_mapping_failed` 或对应业务 gate，不能返回 200 假成功。
- Runtime Agent API 不可达时返回 `upstream_unavailable` 或 runtime dispatch error，不得生成伪 `runId`、伪 `fileRef` 或伪 artifact。

### Stage 8: Portal workspace/session/run query

目标：

- 验证 Portal 只通过稳定 projection 查询，不依赖 upstream 内部 shape。

验收：

- Portal 能按 workspace/session/run 查询 context、session、file、run、artifact、trace 和 billing metadata reference。
- 跨用户、跨 workspace、跨 launch 不能串读。
- Portal 不读取 WebSocket event shape、DOM、frontend store、upstream database schema 或 upstream internal session model。
- 无 projection 时返回 `portal_projection_missing`。

### Stage 9: Trace and Langfuse attachment boundary

目标：

- 验证 session/file/run/artifact 的 sanitized trace metadata projection。
- 明确 Langfuse 只是 optional attachment。

预期链路：

```text
Runtime Bridge sanitized metadata
  -> Portal trace projection
  -> optional Langfuse attachment
  -> trace.medopl.cn when separately authorized
```

验收：

- Portal trace 返回 `traceId`、`workspaceSessionId`、`runId` 或 `fileRef`、status、latency metadata。
- Langfuse 未配置时返回 `trace_sink_not_configured` 或 `deferred_authorization`。
- `trace.medopl.cn` 未部署时不得标记为上线。
- 不代表 Langfuse 已部署。

### Stage 10: Billing metadata handoff boundary

目标：

- 验证 file/run/artifact 链路只传可对账 billing metadata reference。
- 明确 COS/云账单链路才是真实 billing source。

验收：

- 允许返回 `billingMetadataRef`、`usageMetadataRef`、`resourceBindingId`、run duration summary、storage/file size summary。
- 不返回云账号 secret、bucket 私有路径、object key、signed URL、SecretId 或 SecretKey。
- 不用本地估算替代 COS 或云账单事实。
- 不代表真实云 runtime 已接入。
- 不代表 COS 账单或云账单已核对。

### Stage 11: Negative gates and evidence hygiene

目标：

- 验证所有失败都明确 gate。
- 验证 evidence 只写 `.runtime` 且脱敏。
- 验证 `OPL_RUNTIME_MODE=webui` 下 Runtime Bridge 不把未验证 file/run/artifact 能力伪造成成功。

验证命令：

```text
node tests/regression/opl/regression-test-v22-real-opl-file-run-artifact-gates.mjs
```

必须覆盖的 gate：

- `file_upload_capability_not_supported`
- `file_ref_not_observed`
- `workspace_file_scope_missing`
- `storage_authorization_required`
- `requires_runtime_agent`
- `runtime_authorization_required`
- `managed_environment_required`
- `run_not_observed`
- `artifact_not_observed`
- `output_file_ref_not_observed`
- `portal_projection_missing`
- `trace_sink_not_configured`
- `capability_not_supported`
- `runtime_bridge_mapping_failed`
- `upstream_unavailable`
- `deferred_authorization`

验收：

- no fake 200。
- `GET /api/opl/status` 在真实 WebUI bridge profile 下把 file intent 标为 `capability_not_supported`，run intent 标为 `requires_runtime_agent`。
- `POST /api/opl/files` 在未证明真实 WebUI file upload/fileRef 前返回 409 `file_upload_capability_not_supported` + `file_ref_not_observed`，不得返回 `fileRef`。
- `POST /api/opl/runs` 在未配置真实 Runtime Agent relay 前返回 409 `requires_runtime_agent` + queryable `gated` run，不得返回 `succeeded`。
- `GET /api/opl/runs/{runId}/artifacts` 在未观测真实 output 前返回 409 `artifact_not_observed` + `output_file_ref_not_observed`。
- `GET /api/opl/artifacts/{artifactRef}` 在未观测真实 output 前返回 404 `artifact_not_observed` + `output_file_ref_not_observed`。
- `.runtime` evidence 不进入 git。
- response、trace、evidence 和 git 不包含 raw API key、bearer token、`launchToken`、`runtimeToken`、`objectKey`、`storageKey`、`localPath`、`signedUrl`、`presignedUrl`、SecretId、SecretKey、kubeconfig 或 `.env` 内容。

### Stage 12: Productionization handoff

目标：

- 把 canary 事实回写合同、status 和 validation path。
- 把已验证能力交给后续 production implementation 分支。

Leaf 6: OPL productionization contract refresh

- This leaf is contract/status refresh only.
- local Runtime Agent HTTP API relay full-loop is absorbed as canary evidence.
- WebUI bridge negative no-fake-success gates are absorbed as canary evidence.
- provider message live canary remains message/reply only.
- production implementation remains separate.
- no secret, live provider, real cloud, build/push, kubectl, deploy, upstream modification, or live-test ran in this leaf.

Leaf 7: OPL productionization eval shell

- This leaf is eval-shell only.
- `node tests/regression/opl/regression-test-v22-opl-productionization-eval-shell.mjs` is the local gate before any production implementation.
- The eval shell reads only repo-tracked contracts, recovery truth, and existing smoke scripts.
- It proves the next production branch must keep canary facts out of production truth, keep upstream clean, and keep unverified file/run/artifact capabilities gated.
- It allows only OPL-lane projection fields: `resourceBindingId`, `billingMetadataRef`, `usageMetadataRef`, `fileRef`, `runId`, `artifactRef`, and `outputFileRef`.
- It fail-closes on `ownerRef`, `operationId`, K8s labels, deploy owner labels, raw provider key, provider API key, launchToken, runtimeToken, bearer token, objectKey, storageKey, localPath, signedUrl, and presignedUrl.
- It does not modify services, upstream, deploy, adapters, `.sentrux`, `.env.demo.template`, package/dependency files, or secret-like paths.
- no secret, live provider, real cloud, build/push, kubectl, deploy, upstream modification, or live-test ran in this leaf.

Leaf 8: OPL productionization local implementation

- This leaf is local implementation hardening only.
- Runtime Agent HTTP relay request and response validation rejects Package D owner fields: `ownerRef`, `operationId`, K8s labels, and deploy owner labels.
- The same relay boundary continues to reject raw provider key, provider API key, launchToken, runtimeToken, bearer token, objectKey, storageKey, localPath, signedUrl, and presignedUrl.
- The local eval shell proves the owner-field rejection with an in-process mocked `fetch` response; it does not call live provider, true cloud, deploy, build/push, kubectl, live-test, or upstream.
- This leaf does not claim real cloud runtime, COS billing reconciliation, Langfuse deployment, deploy evidence, or one-person-lab HTTP Product API production availability.

验收：

- file 成功后，production 分支才能实现稳定 file projection。
- run 成功后，production 分支才能接真实 Runtime Agent relay/API。
- artifact 成功后，production 分支才能实现 artifact/output projection。
- Langfuse 部署后，production 分支才能接 `trace.medopl.cn`。
- 云服务/COS 账单链路验证后，billing metadata reference 才能进入真实账单核对。
- 未验证能力必须保留 gate。
