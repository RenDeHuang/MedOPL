# v22 Real OPL Capability Canary Complete Workflow And Validation Path

本文定义真实 OPL 能力 canary 的完整工作流和验证顺序。它是 [spec:v22-real-opl-capability-canary-boundary](../specs/README.md) 的执行路径，不替代一级主合同、二级 Portal-OPL 连接合同或 [portal-opl-context-backflow-validation-path.md](./portal-opl-context-backflow-validation-path.md)。provider message reply 的细分验证路径是 [real-opl-provider-message-canary-validation-path.md](./real-opl-provider-message-canary-validation-path.md)。file/run/artifact 的细分验证路径是 [real-opl-file-run-artifact-validation-path.md](./real-opl-file-run-artifact-validation-path.md)。

## Complete Workflow

真实 OPL capability canary 的目标链路是：

```text
Portal -> Gateway -> clean OPL WebUI -> Runtime Bridge / Runtime Agent -> Portal projection
```

完整业务闭环必须证明：

```text
Portal launch
  -> OPL receives public context
  -> OPL creates or resumes session
  -> Runtime Bridge binds workspace/session/runtime identity
  -> message enters real OPL/agent/provider or returns explicit gate
  -> file intent produces workspace-scoped fileRef or returns explicit gate
  -> run enters real Runtime Bridge / Runtime Agent or returns explicit gate
  -> artifact/output produces artifactRef or outputFileRef or returns explicit gate
  -> sanitized trace and billing metadata are projected
  -> Portal queries by workspace/session/run
```

闭环不是只返回 HTTP 200。闭环必须有明确的 `messageId/status/replyMessageId`、workspace-scoped fileRef、`runId/status/traceId/billingMetadataRef`、artifactRef or outputFileRef，以及 Portal 按 workspace/session/run 查询的 projection。失败必须 no fake 200。

## Validation Order

### Stage 0: Branch contract declaration

目标：

- 声明本分支是 `feat/v22-real-opl-capability-canary`。
- 声明模型记录为 `gpt-5.4`。
- 声明合同订阅包。
- 声明授权边界和非目标。

验收：

- 分支从 `recovery/platform-v22-trunk` 新开。
- 本分支只触碰 active surface。
- 不修改 upstream、deploy、`.sentrux` 或 adapters。
- 不读取 secret。
- 不调用真实云。
- 不 build/push/kubectl/live-test。

### Stage 1: Real OPL WebUI capability discovery

目标：

- 启动或连接真实 OPL WebUI canary 来源。
- 识别真实 HTTP Product API、WebUI bridge、ACP runtime 和 unsupported capability。
- 生成 capability registry snapshot。

验证命令：

```text
future-authorized upstream/WebUI capability runner only
```

验收：

- `/api/opl/*` placeholder 必须分类为 `capability_not_supported`。
- WebUI bridge session create / DB readback 必须分类为 `mapped_to_webui_bridge`。
- ACP runtime 可用能力必须分类为 `mapped_to_acp_runtime`。
- 未验证能力不得标记为 `supported`。
- canary evidence 只写 `.runtime`。

### Stage 2: Portal launch and OPL context canary

目标：

- Portal 通过 Gateway 打开 clean OPL WebUI。
- OPL 通过 Runtime Bridge bootstrap 获取 MedOPL public context。

验证命令：

```text
node tests/smoke/smoke-test-v22-portal-opl-connection-contract.mjs
node tests/regression/opl/regression-test-v22-portal-opl-context-backflow-contract.mjs
```

验收：

- `workspaceId`、`launchId`、`workspaceSessionId`、`runtimeSessionId`、`providerBound`、`providerKeyRef`、Portal return URL 可被 OPL public context 获取。
- raw API key、bearer token、`launchToken`、`runtimeToken` 不进入 URL、浏览器持久化状态、日志、evidence 或 git。
- Gateway 不生成 message/file/run/artifact 业务成功状态。

### Stage 3: Real session backflow canary

目标：

- OPL WebUI 创建或恢复真实 session/conversation。
- Runtime Bridge 把 `oplSessionId` 或 `oplConversationId` 绑定到 MedOPL workspace/runtime session。
- Portal 能查询 session projection。

验证命令：

```text
OPL_REAL_WEBUI_DIR=<authorized-webui-dir> node tests/future-authorized/cloud/future-authorized-test-v22-real-opl-webui-runtime-bridge-flow.mjs
node tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-state-store-atomic-flow.mjs
```

验收：

- `tenantId + portalUserId + workspaceId + workspaceSessionId + runtimeSessionId + resourceBindingId + oplSessionId` 全部绑定。
- `mapped_to_webui_bridge` 或 `mapped_to_acp_runtime` 明确写入 capability registry。
- 并发 state 写入不覆盖 context/session/message 归属。

### Stage 4: Real message reply canary

目标：

- 证明 message intent 进入真实 OPL/agent/provider 边界。
- 证明 AI reply 有明确回流，或返回明确 gate。
- provider 级字段、gate、evidence 和 Portal trace 验收见 [real-opl-provider-message-canary-validation-path.md](./real-opl-provider-message-canary-validation-path.md)。

预期链路：

```text
POST /runtime-bridge/api/opl/messages
  -> WebUI bridge chat.send.message or ACP prompt
  -> OPL/agent/provider boundary
  -> reply event or same-conversation assistant reply evidence
  -> Runtime Bridge message state
  -> GET /runtime-bridge/api/opl/messages/{messageId}/status
  -> Portal /portal/api/opl/messages/{messageId}/status projection
```

验收：

- 请求包含 `workspaceId`、`runtimeSessionId`、`oplSessionId` 或 `oplConversationId`、`clientMessageId` 和 `providerKeyRef`。
- 成功返回 `messageId/status/replyMessageId`。
- reply 必须关联同一 conversation/message。
- 无 provider 时返回 `provider_key_required`。
- 无 reply event 或超时时返回 `upstream_reply_timeout` 或 `capability_not_supported`。
- raw prompt、raw completion、raw API key 不进 public response、trace、evidence 或 git。

### Stage 5: File capability canary

目标：

- 验证真实 OPL 或 Runtime Bridge/Runtime Agent 边界是否能形成 workspace-scoped fileRef。

预期链路：

```text
OPL file upload or file intent
  -> Runtime Bridge normalized file intent
  -> workspace file boundary or Runtime Agent boundary
  -> workspace-scoped fileRef
  -> Portal file projection
```

验收：

- 成功返回 workspace-scoped fileRef。
- `fileRef` 绑定 `workspaceId` 和 session。
- 不支持上传时返回 `capability_not_supported`。
- 需要 Runtime Agent 时返回 `requires_runtime_agent`。
- response 不包含 `objectKey`、`storageKey`、`localPath`、`signedUrl` 或 `presignedUrl`。

### Stage 6: Runtime Agent and run canary

目标：

- 验证 run intent 是否能进入真实 Runtime Bridge / Runtime Agent boundary。
- 如果没有授权真实 runtime，则证明 gate 正确。

预期链路：

```text
OPL run intent
  -> Runtime Bridge normalized run intent
  -> Runtime Bridge / Runtime Agent boundary
  -> runId/status/traceId/billingMetadataRef or explicit gate
```

验收：

- 成功返回 `runId/status/traceId/billingMetadataRef`。
- run 绑定 `workspaceId`、`runtimeSessionId`、`resourceBindingId` 和 `providerKeyRef`。
- 无 provider 时返回 `provider_key_required`。
- 未开通托管运行环境时返回 `managed_environment_required`。
- 未配置 Runtime Agent 时返回 `requires_runtime_agent`。
- 需要真实云 runtime 时返回 `runtime_authorization_required`。
- Runtime Bridge 不生成伪 `runId` 或伪 billing metadata。

### Stage 7: Artifact/output backflow canary

目标：

- 验证 output 能从 Runtime Bridge / Runtime Agent 回到 Portal projection。

预期链路：

```text
Runtime Agent output
  -> Runtime Bridge artifact normalization
  -> artifactRef or outputFileRef
  -> Portal files / session / run projection
```

验收：

- 成功返回 artifactRef or outputFileRef。
- output 绑定 `workspaceId`、`sessionId`、`runId`。
- Portal 能按 workspace/session/run 查询。
- response 不包含 storage 私有字段或 signed URL。

### Stage 8: Observability metadata canary

目标：

- 验证 session/message/run 的 sanitized trace metadata projection。
- 明确 Langfuse 只是 optional attachment。

预期链路：

```text
Runtime Bridge sanitized metadata
  -> Portal trace projection
  -> optional Langfuse attachment
  -> trace.medopl.cn when separately authorized
```

验收：

- 成功返回 `traceId`、`sessionId` 或 `workspaceSessionId`、`messageId` 或 `runId`、status、latency metadata。
- usage summary 和 cost estimate 必须是 sanitized metadata。
- Langfuse 未配置时返回 `trace_sink_not_configured` 或 `deferred_authorization`。
- `trace.medopl.cn` 未部署时不得标记为上线。

### Stage 9: Portal projection and negative gates

目标：

- 验证 Portal 只通过稳定 projection 查询。
- 验证失败都明确 gate。

验收：

- Portal 能按 workspace/session/run 查询 context、session、message、file、run、artifact、trace 和 billing metadata。
- 跨用户、跨 workspace、跨 launch 不能串读。
- `capability_not_supported`、`provider_key_required`、`managed_environment_required`、`requires_runtime_agent`、`runtime_authorization_required`、`upstream_unavailable`、`upstream_reply_timeout`、`runtime_bridge_mapping_failed` 和 `trace_sink_not_configured` 都有明确 response。
- no fake 200。

### Stage 10: Performance canary

目标：

- 量化 Gateway/Runtime Bridge/capability registry 对真实 WebUI 的额外开销。
- 不用未测数字宣称性能可接受。

比较对象：

- direct OPL WebUI baseline。
- Gateway + Runtime Bridge。
- Gateway + Runtime Bridge + Runtime gate。

必须记录：

- Portal launch -> OPL bootstrap p50/p95。
- session create -> DB readback p50/p95。
- OPL event -> Runtime Bridge projection -> Portal query p50/p95。
- message send -> reply observed p50/p95，若 message supported。
- file intent -> fileRef p50/p95，若 file supported。
- run intent -> run accepted p50/p95，若 runtime supported。

初始预算：

- session class extra p95 target <= 300ms。
- Portal-OPL context/backflow extra overhead target <= 5% for non-runtime operations。
- Gateway/Runtime Bridge 错误率不得高于 direct OPL WebUI baseline。

这些是性能预算，不代表当前已完成 benchmark。

## Canary Evidence Rules

canary evidence 只进 `.runtime`，不得进入 git。

允许记录：

- sanitized command name。
- sanitized capability registry snapshot。
- sanitized endpoint path。
- sanitized WebSocket event type。
- sanitized status/error code。
- timing metadata。
- upstream version 或 commit。

禁止记录：

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
- `.env`、SecretId、SecretKey、kubeconfig 或 SSH private key。

## Productionization Handoff

canary 成功不自动等于 productionized Runtime Bridge。进入正式实现前必须：

1. 把真实能力发现回写 [spec:v22-real-opl-capability-canary-boundary](../specs/README.md)。
2. 更新 [status-matrix.md](./status-matrix.md) 和 [mvp-contract-acceptance.md](./mvp-contract-acceptance.md)。
3. 明确每个 capability 的状态：`supported`、`mapped_to_webui_bridge`、`mapped_to_acp_runtime`、`requires_runtime_agent`、`deferred_authorization` 或 `capability_not_supported`。
4. 新开 productionized Runtime Bridge 映射分支。
5. productionized 分支补正式 smoke，不依赖 `.runtime` 临时 evidence。
6. B 窗口只吸收清理后的正式分支，不吸收未清理 canary 临时代码。
