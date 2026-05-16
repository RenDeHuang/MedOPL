# v22 Real OPL Provider Message Canary Workflow And Validation Path

本文定义真实 OPL provider message reply canary 的完整工作流和验证顺序。它是 [v22-real-opl-provider-message-canary-boundary.md](../contracts/v22-real-opl-provider-message-canary-boundary.md) 的执行路径，不替代 [real-opl-capability-canary-validation-path.md](./real-opl-capability-canary-validation-path.md)。

## Complete Workflow

真实 provider message canary 的目标链路是：

```text
Portal launch -> Gateway -> clean OPL WebUI -> session bind -> send message -> observe reply -> Adapter normalize -> Portal message status -> Portal session trace
```

完整业务闭环必须证明：

```text
Portal user enters OPL
  -> OPL receives MedOPL public context
  -> real OPL session/conversation is bound
  -> provider key gate is evaluated
  -> message intent is accepted with clientMessageId
  -> message enters real OPL/agent/provider boundary or returns explicit gate
  -> providerInvocationRef is observed or explicit gate is returned
  -> assistant reply is observed with replyMessageId or timeout/not-supported gate is returned
  -> Adapter creates normalized message state
  -> Portal queries message status
  -> Portal queries session trace by workspace/session/message
```

闭环不是只返回 HTTP 200。闭环必须有明确的 `messageId/status/replyMessageId`、`providerInvocationRef`、`messageTraceId` 和 Portal 可查询的 session trace。失败必须 no fake 200。

## Current Live Canary Result

在用户授权 `REAL_OPL_PROVIDER_MESSAGE_CANARY=1`、`OPL_PROVIDER_SECRET_FILE` 和 `OPL_REAL_WEBUI_DIR` 后，真实 provider message live canary 已通过：

```text
node scripts/smoke-test-v22-real-opl-provider-message-live-canary.mjs
```

脱敏结果：

- `message.status=succeeded`
- `capabilitySource=mapped_to_webui_bridge`
- Portal message status projection 与直接 message response 的 `replyMessageId/providerInvocationRef/messageTraceId` 一致
- Portal session trace projection 能按 `workspaceId + messageId` 查到同一 trace
- evidence path: `.runtime/real-opl-provider-message-live-canary/evidence.json`

本结果只证明真实 provider message/reply 和 Portal trace 回流；不证明 file、run、artifact、真实云 runtime、生产部署或 Langfuse 已上线。

## Validation Order

### Stage 0: Branch contract declaration

目标：

- 声明本分支是 `feat/v22-real-opl-provider-message-canary-contract`。
- 声明模型记录为 `gpt-5.4`。
- 声明合同订阅包。
- 声明授权边界和非目标。

验收：

- 分支从 `recovery/platform-v22-trunk` 新开。
- 本分支只触碰 active surface。
- 不修改 upstream、deploy、`.sentrux` 或 adapters。
- 不读取 secret。
- 不调用真实云。
- 不调用真实 provider。
- 不 build/push/kubectl/live-test。

### Stage 1: Provider readiness discovery without secret access

目标：

- 识别真实 OPL WebUI/ACP 是否存在可公开观测的 message/reply/provider 边界。
- 确认没有授权 raw provider key 时只能验证 gate。
- 记录可用的 non-secret capability source。

验证命令：

```text
node scripts/smoke-test-v22-real-opl-provider-message-contract-gate.mjs
```

后续真实 canary 命令必须由用户单独授权，并显式提供 canary 来源：

```text
OPL_REAL_WEBUI_DIR=.runtime/opl-aion-shell node scripts/smoke-test-v22-real-opl-webui-canary.mjs
OPL_REAL_WEBUI_DIR=.runtime/opl-aion-shell node scripts/smoke-test-v22-real-opl-webui-adapter-flow.mjs
```

验收：

- 未授权 provider key 时，message reply 不得标记为 `supported`。
- 无 provider 时返回 `provider_key_required`。
- 有 `providerKeyRef` 但真实调用未授权时返回 `provider_authorization_required` 或 `deferred_authorization`。
- 不能把 `/api/opl/*` placeholder 200 当成 Product API。
- canary evidence 只写 `.runtime`。

### Stage 2: Portal launch and OPL public context

目标：

- Portal 通过 Gateway 打开 clean OPL WebUI。
- OPL 通过 Adapter bootstrap 获取 MedOPL public context。
- public context 中只包含 `providerKeyRef` 和 provider bound status，不包含 raw key。

验证命令：

```text
node scripts/smoke-test-v22-portal-opl-connection-contract.mjs
node scripts/smoke-test-v22-portal-opl-context-backflow-contract.mjs
```

验收：

- `workspaceId`、`launchId`、`workspaceSessionId`、`runtimeSessionId`、`providerBound`、`providerKeyRef` 和 Portal return URL 可被 OPL public context 获取。
- raw API key、bearer token、`launchToken`、`runtimeToken` 不进入 URL、sessionStorage、localStorage、日志、evidence 或 git。
- Gateway 不生成 message reply 成功状态。

### Stage 3: Real OPL session and conversation binding

目标：

- OPL WebUI 创建或恢复真实 session/conversation。
- Adapter 把 `oplSessionId` 或 `oplConversationId` 绑定到 MedOPL workspace/runtime session。

验证命令：

```text
OPL_REAL_WEBUI_DIR=.runtime/opl-aion-shell node scripts/smoke-test-v22-real-opl-webui-adapter-flow.mjs
node scripts/smoke-test-v22-opl-adapter-state-store-atomic-flow.mjs
```

验收：

- `tenantId + portalUserId + workspaceId + workspaceSessionId + runtimeSessionId + oplSessionId + oplConversationId` 能稳定绑定。
- session backflow 的 capability source 明确是 `mapped_to_webui_bridge` 或 `mapped_to_acp_runtime`。
- Adapter state 写入不覆盖 context/session/message 归属。

### Stage 4: Provider key gate and authorization gate

目标：

- 在发送真实 message 前先验证 provider gate。
- 确保没有 provider 或没有授权时不触发真实模型调用。

预期响应：

```json
{
  "ok": false,
  "error": "provider_key_required",
  "status": "gated",
  "providerKeyRef": ""
}
```

或：

```json
{
  "ok": false,
  "error": "provider_authorization_required",
  "status": "gated",
  "providerKeyRef": "provider_key_ref_xxx"
}
```

验收：

- 无 `providerKeyRef` 返回 `provider_key_required`。
- 未授权真实 provider 调用返回 `provider_authorization_required` 或 `deferred_authorization`。
- public response 不包含 raw API key。
- 不向真实 provider 发请求。

### Stage 5: Send real message intent

目标：

- 在用户授权真实 provider canary 后，发送一条真实 message intent。
- 只通过 Adapter/Portal 稳定入口发送，不依赖 upstream 内部 route、DOM 或 database schema。

预期链路：

```text
POST /portal/api/opl/messages
  -> /portal-adapter/api/opl/messages
  -> WebUI bridge chat.send.message or ACP prompt
  -> OPL/agent/provider boundary
```

请求必须携带或从 launch/session 解析：

- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `oplSessionId` 或 `oplConversationId`
- `clientMessageId`
- `providerKeyRef`

验收：

- accepted response 返回 `messageId`、`status=queued|running`、`clientMessageId`、`statusUrl` 和 `messageTraceId`。
- 如果直接完成，必须返回 `status=succeeded` 和 `replyMessageId`。
- raw prompt 不进入 public response、日志、evidence 或 git。
- pending 状态不能伪装成 succeeded。

### Stage 6: Observe provider boundary and assistant reply

目标：

- 证明 message intent 进入真实 OPL/agent/provider 边界。
- 证明 assistant reply 属于同一 conversation/message。

允许观测来源：

- WebUI bridge assistant reply event。
- ACP runtime assistant reply event。
- 脱敏 provider invocation evidence。
- 同一 conversation 的 assistant message DB readback，只能作为 bridge evidence，不能暴露 upstream schema 给 Portal。

验收：

- 成功返回 `messageId/status/replyMessageId`。
- 成功返回 `providerInvocationRef`。
- 成功返回 `messageTraceId`。
- reply 绑定同一 `oplConversationId` 或 `oplSessionId`。
- provider invocation 可证明但未观测到 reply 时，返回 `provider_invocation_not_observed` 或 `upstream_reply_timeout`。
- 无 reply event 或超时时返回 `upstream_reply_timeout` 或 `capability_not_supported`。

### Stage 7: Adapter normalization

目标：

- 把真实 OPL/WebUI/ACP/provider 的 message/reply shape 映射成稳定 Adapter message state。

稳定 state 必须包含：

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

验收：

- Portal 不依赖 upstream route、WebSocket payload、DOM、frontend store 或 database schema。
- ID 绑定缺失返回 `adapter_mapping_failed`。
- upstream shape 变化只记录脱敏 summary，不记录 raw payload。

### Stage 8: Portal message status projection

目标：

- Portal 可以通过稳定 API 查询 message 状态。

验证入口：

```text
GET /portal/api/opl/messages/{messageId}/status
```

验收：

- 成功或 gate 都返回同一个 `messageId`。
- 成功包含 `replyMessageId`、`providerInvocationRef` 和 `messageTraceId`。
- 失败包含明确 error code。
- 跨 workspace、跨 user、跨 launch 查询不得串读。

### Stage 9: Portal session trace projection

目标：

- Portal 可以把 message/reply 投影到 canonical session trace。
- Langfuse 只是 optional attachment。

验证入口：

```text
GET /portal/api/session-traces?workspaceId=...&sessionId=...
GET /portal/api/session-traces?workspaceId=...&messageId=...
GET /portal/api/session-traces/{traceId}
```

验收：

- trace 中包含 `workspaceId`、`workspaceSessionId`、`runtimeSessionId`、`messageId`、`replyMessageId`、`providerKeyRef`、`providerInvocationRef`、`messageTraceId` 和 status。
- trace 只包含 sanitized latency/usage/cost metadata。
- Langfuse 未配置时返回 `trace_sink_not_configured` 或 `deferred_authorization`，但不影响 Portal canonical trace 的独立判断。
- `trace.medopl.cn` 未部署时不得标记为上线。

### Stage 10: Negative gates and evidence hygiene

目标：

- 验证每个失败路径都有明确 gate。
- 验证 evidence 不泄露 secret 或 raw payload。

必须覆盖：

- `provider_key_required`
- `provider_authorization_required`
- `provider_invocation_not_observed`
- `upstream_unavailable`
- `upstream_reply_timeout`
- `adapter_mapping_failed`
- `capability_not_supported`
- `trace_sink_not_configured`
- `deferred_authorization`

验收：

- no fake 200。
- evidence 只写 `.runtime`。
- evidence 不包含 raw prompt、raw completion、raw API key、bearer token、launchToken、runtimeToken、sessionStorage、localStorage、`.env`、kubeconfig、SecretId、SecretKey 或 SSH private key。

### Stage 11: Productionization handoff

目标：

- 把 canary 事实变成后续 productionized Adapter 开发输入，而不是把 canary 临时路径合入主干。

验收：

- 真实发现已回写 [v22-real-opl-provider-message-canary-boundary.md](../contracts/v22-real-opl-provider-message-canary-boundary.md)。
- 上层 [v22-real-opl-capability-canary-boundary.md](../contracts/v22-real-opl-capability-canary-boundary.md) 已引用本细分合同。
- [status-matrix.md](./status-matrix.md) 和 [mvp-contract-acceptance.md](./mvp-contract-acceptance.md) 已说明当前状态。
- productionized Adapter 映射另开分支，并补正式 smoke。
- B 窗口只吸收清理后的正式分支，不吸收 `.runtime` canary 临时代码。

## Canary Evidence Rules

canary evidence 只进 `.runtime`，不得进入 git。

允许记录：

- sanitized command name。
- upstream version 或 commit。
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
- `.env`、SecretId、SecretKey、kubeconfig 或 SSH private key。

## Default Local Verification

默认本地验证只验证合同和 gate，不触发真实 provider 调用：

```text
node scripts/smoke-test-v22-real-opl-provider-message-contract-gate.mjs
node scripts/smoke-test-v22-real-opl-capability-contract-gate.mjs
node scripts/smoke-test-v22-portal-opl-context-backflow-contract.mjs
node scripts/smoke-test-v22-mvp-contract-suite.mjs
git diff --check -- docs/contracts docs/recovery scripts
```

真实 provider message reply canary 必须由用户单独授权，并在授权时明确：

- canary 使用哪个真实 OPL WebUI 来源。
- 是否允许使用真实 `providerKeyRef`。
- 是否允许触发真实模型调用。
- evidence 写入哪个 `.runtime` 路径。
- 是否允许连接 Langfuse 或 `trace.medopl.cn`。

授权 live canary 命令：

```text
REAL_OPL_PROVIDER_MESSAGE_CANARY=1 \
OPL_PROVIDER_SECRET_FILE=<git-outside-provider-secret-file> \
OPL_REAL_WEBUI_DIR=/home/dev/projects/platform-v19/.runtime/opl-aion-shell-full \
node scripts/smoke-test-v22-real-opl-provider-message-live-canary.mjs
```

也可以用已启动 WebUI：

```text
REAL_OPL_PROVIDER_MESSAGE_CANARY=1 \
OPL_PROVIDER_SECRET_FILE=<git-outside-provider-secret-file> \
OPL_REAL_WEBUI_URL=http://127.0.0.1:PORT \
node scripts/smoke-test-v22-real-opl-provider-message-live-canary.mjs
```

### Stage 12: Authorized live provider canary

目标：

- 在用户显式授权后读取 `OPL_PROVIDER_SECRET_FILE`。
- 通过 Portal `/portal/api/opl/launch` 把 raw provider key 写入后端密钥边界，并只向 Adapter/Portal projection 暴露 `providerKeyRef`。
- 启动或连接真实 OPL WebUI。
- 走真实 Portal -> Gateway -> Adapter -> WebUI bridge message 路径。
- 观测真实 assistant reply，并把 `messageId/status/replyMessageId/providerInvocationRef/messageTraceId` 回流 Portal。
- 通过 `/portal/api/opl/messages/{messageId}/status` 和 `/portal/api/session-traces?workspaceId=...&messageId=...` 查询回流结果。

验收：

- 未设置 `REAL_OPL_PROVIDER_MESSAGE_CANARY=1` 时，脚本必须 fail-closed 为 `provider_authorization_required`，不得读取 secret。
- 缺 `OPL_PROVIDER_SECRET_FILE` 时返回 `provider_key_required`。
- 缺 `OPL_REAL_WEBUI_DIR` 和 `OPL_REAL_WEBUI_URL` 时返回 `upstream_unavailable` 或文件缺失错误，不能 fallback 到 fake OPL。
- 成功时 `message.status=succeeded`，并包含 `replyMessageId`、`providerInvocationRef`、`messageTraceId`、`capabilitySource=mapped_to_webui_bridge`。
- Portal message status projection 与直接 message response 的 `replyMessageId/providerInvocationRef/messageTraceId` 一致。
- Portal session trace projection 能按 `workspaceId + messageId` 查到同一 trace。
- `.runtime/real-opl-provider-message-live-canary/evidence.json` 不包含 raw prompt、raw completion、raw API key、bearer token、launchToken、runtimeToken、secret path 或本地文件路径。
- 该 live canary 不进入默认 `scripts/smoke-test-v22-mvp-contract-suite.mjs`。
