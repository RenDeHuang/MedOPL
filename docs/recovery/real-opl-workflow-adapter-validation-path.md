# v22 Real OPL Workflow Adapter Complete Link And Validation Path

本文定义 real OPL workflow adapter 的完整链路和后续开发验证验收顺序。它是 [v22-real-opl-workflow-adapter-boundary.md](../contracts/v22-real-opl-workflow-adapter-boundary.md) 的执行路径，不替代主合同和阶段状态。

## Complete Link

完整链路如下：

```text
Portal SaaS control plane
  -> POST /portal/api/opl/launch
  -> Gateway entry/proxy
  -> clean OPL WebUI
  -> Adapter bootstrap/session bind
  -> Adapter capability registry
  -> Adapter message/file mapping
  -> Runtime Bridge run relay
  -> Runtime Agent execution
  -> Runtime Bridge artifact/ledger/trace/billing canonical state
  -> Portal workspace/session/run/file/trace/billing projection
  -> optional Langfuse sanitized observability at trace.medopl.cn
```

职责归属：

- Portal：SaaS 用户、租户、workspace、套餐、余额、托管环境、资源绑定、账单和用户入口。
- Gateway：clean OPL WebUI 入口、反代、httpOnly cookie / launch session、安全注入和 secret query 拒绝。
- Adapter：capability registry、协议翻译、session binding、message/file event normalization、缺能力 gate 和 Portal projection。
- Runtime Bridge：run record、Runtime Agent relay、artifact reference、ledger、trace 和 billing metadata canonical state。
- Runtime Agent：真实任务执行和 output metadata 回流。
- Langfuse：optional sanitized observability attachment；`trace.medopl.cn` 是 admin/ops console，客户默认 trace 仍在 Portal。

## Development Verification Order

开发必须按以下阶段推进。前一阶段没有真实证据时，后一阶段不能用 fake success 代替。

### Stage 0: Discovery baseline

目标：

- 识别真实 upstream OPL 的能力边界。
- 区分 real HTTP Product API、WebUI bridge、ACP/CLI runtime、unsupported capability。

验证：

```text
node scripts/smoke-test-v22-real-opl-canary.mjs
OPL_REAL_WEBUI_DIR=.runtime/opl-aion-shell node scripts/smoke-test-v22-real-opl-webui-canary.mjs
```

验收：

- one-person-lab upstream clean。
- `/api/opl/*` placeholder 必须分类为 `capability_not_supported`。
- WebUI bridge session create 和 DB readback 有证据。
- 证据只写 `.runtime`，不进 git。

### Stage 1: Gateway launch and bootstrap

目标：

- Portal 通过 Gateway 打开 clean OPL WebUI。
- bootstrap 只暴露 public context。

验证：

```text
node scripts/smoke-test-v22-opl-gateway-upstream-proxy-local.mjs
node scripts/smoke-test-v22-portal-opl-connection-contract.mjs
```

验收：

- `POST /portal/api/opl/launch` 创建服务端 launch session。
- Gateway 拒绝 URL query 中的 raw key、bearer token、`launchToken`、`runtimeToken`。
- bootstrap 不含 raw key、token、objectKey、localPath、signedUrl。
- Gateway 不生成业务成功状态。

### Stage 2: Session binding

目标：

- Adapter 通过真实 WebUI bridge 或 ACP/CLI runtime 创建/读取 OPL session。
- 把 `oplSessionId` 绑定到 MedOPL workspace/runtime/resource binding。

验证：

```text
OPL_REAL_WEBUI_DIR=.runtime/opl-aion-shell node scripts/smoke-test-v22-real-opl-webui-adapter-flow.mjs
node scripts/smoke-test-v22-opl-adapter-state-store-atomic-flow.mjs
```

验收：

- `GET /portal-adapter/api/opl/bootstrap` 来自真实 upstream health/capability 访问和 Adapter state projection。
- `POST /portal-adapter/api/opl/sessions/bind` 写入 `opl_session_bound`。
- Adapter state 保留 `portalUserId + tenantId + workspaceId + workspaceSessionId + runtimeSessionId + resourceBindingId + oplSessionId`。
- 并发 message/file/run state 写入不互相覆盖。

### Stage 3: Message reply canary

目标：

- 证明 message 真正进入 OPL/agent/provider。
- 证明 AI reply 有明确回流，不靠猜测。

预期链路：

```text
POST /portal-adapter/api/opl/messages
  -> WebUI bridge chat.send.message or ACP prompt
  -> OPL/agent/provider
  -> reply event or same-conversation assistant reply evidence
  -> Adapter message state
  -> GET /portal-adapter/api/opl/messages/{messageId}/status
```

验收：

- 请求带 `workspaceId`、`runtimeSessionId`、`oplSessionId`、`clientMessageId` 和 `providerKeyRef`。
- Adapter 访问真实 OPL/agent/provider 边界。
- reply 必须能关联到同一 conversation/message。
- `completed` 必须包含 sanitized reply metadata 和 `traceId`。
- 无 provider 时返回 `provider_key_required`。
- 无 reply event 或超时时返回 `upstream_reply_timeout` 或 `capability_not_supported`。
- raw prompt、raw completion 和 raw key 不进 public response、trace、evidence 或 git。

### Stage 4: File reference canary

目标：

- 证明文件引用进入 workspace canonical file state。
- 证明后续 run 能消费 `fileRef`。

预期链路：

```text
POST /portal-adapter/api/opl/files
  -> Portal workspace file store or verified OPL file bridge
  -> workspace-scoped fileRef
  -> Runtime Bridge run input
```

验收：

- `POST /portal-adapter/api/opl/files` 返回 public `fileRef`。
- file record 绑定 `workspaceId`、`runtimeSessionId` 和 `oplSessionId`。
- public response 不含 objectKey、storageKey、localPath、signedUrl、presignedUrl。
- 如果 OPL WebUI upload API/bridge 未验证，Adapter 必须声明 `capability_not_supported` 或使用 Portal workspace file store canonical path。

### Stage 5: Runtime run and artifact canary

目标：

- 证明 run 由 Runtime Bridge 调 Runtime Agent relay/API。
- 证明 artifact 来自 Runtime Agent output 或正式 workspace output projection。

预期链路：

```text
POST /portal-adapter/api/opl/runs
  -> Runtime Bridge gate: workspace/resourceBinding/providerKeyRef/fileRefs
  -> Runtime Agent relay/API
  -> Runtime Agent execution
  -> Runtime Bridge run record
  -> artifactRef/outputFileRef
  -> GET run status/artifacts/artifact
```

验收：

- 缺 provider key 返回 `provider_key_required`。
- 缺 runtime/resource binding 返回 `managed_environment_required`。
- 缺 Runtime Agent endpoint 返回 `platform_isolated_runtime_agent_required`。
- 成功 run 生成 `runId` 和 `traceId`。
- artifact projection 只包含 public `artifactRef` / `outputFileRef`。
- public response 不含 objectKey、storageKey、localPath、signedUrl、presignedUrl。
- run status/artifacts/artifact 查询必须按 launch/session/workspace 鉴权。

### Stage 6: Trace, billing, and Langfuse projection

目标：

- Runtime Bridge 生成 canonical trace/billing metadata。
- Langfuse 只接收 sanitized observability projection。
- `trace.medopl.cn` 作为 admin/ops console 目标域纳入合同。

预期链路：

```text
Runtime Bridge ledger
  -> sanitized trace/billing metadata
  -> Portal session trace projection
  -> optional Langfuse projection
  -> trace.medopl.cn admin/ops console
```

验收：

- Runtime Bridge state 有 `traceId`、`runId`、`workspaceId`、`runtimeSessionId`、`resourceBindingId`、`providerKeyRef`。
- billing summary 来自 Runtime Bridge ledger / billing projection，不来自 Langfuse 原始 trace。
- Langfuse projection 只含 `traceId`、`sessionId`、`runId`、`status`、`latencyMs`、usage summary、cost estimate、tags 和严格校验 origin 的 trace URL。
- `trace.medopl.cn` 的真实部署、DNS、TLS、Ingress、Langfuse secret、ClickHouse 和真实 trace source 需要单独授权。

### Stage 7: Performance comparison

目标：

- 量化 Adapter/Gateway/Runtime 引入的额外开销。
- 避免用未测数字宣称性能可接受。

比较对象：

- direct OPL WebUI baseline。
- Gateway + Adapter。
- Gateway + Adapter + Runtime Agent。

必须记录：

- launch 到 bootstrap p50/p95。
- session create 到 DB readback p50/p95。
- message accepted -> reply observed p50/p95。
- run accepted -> artifact visible p50/p95。
- Adapter state write p50/p95。
- Gateway proxy overhead p50/p95。
- WebSocket bridge reconnect/error overhead。

初始目标：

- session class extra p95 target <= 300ms。
- long task extra overhead target <= 5%。
- Gateway/Adapter 错误率不得高于 direct OPL WebUI baseline。

这些目标是性能预算，不代表当前已经完成真实 benchmark。

## Absorption Gate

实现分支进入 B 窗口前必须满足：

1. 订阅 [v22-real-opl-workflow-adapter-boundary.md](../contracts/v22-real-opl-workflow-adapter-boundary.md) 和其合同包。
2. `node scripts/smoke-test-v22-real-opl-workflow-adapter-contract.mjs` 通过。
3. `node scripts/smoke-test-v22-portal-opl-connection-contract.mjs` 通过。
4. `node scripts/smoke-test-v22-portal-opl-adapter-api-local-flow.mjs` 通过。
5. `OPL_REAL_WEBUI_DIR=... node scripts/smoke-test-v22-real-opl-webui-adapter-flow.mjs` 通过。
6. message/file/run/artifact 未完成真实 canary 时必须明确写入状态矩阵和合同，不得宣称完整真实上线。
7. 真实 evidence 只进入 `.runtime`，不进 git。
8. one-person-lab upstream 保持 clean。
9. secret hygiene 检查没有 raw prompt、raw completion、raw API key、bearer token、`launchToken`、`runtimeToken`、objectKey、storageKey、localPath、signedUrl、presignedUrl 泄露。
10. `trace.medopl.cn` 只作为 Langfuse admin/ops console 目标域；未授权前不部署、不读 secret、不接真实 Langfuse。

## Current Status

截至 2026-05-10：

- 已完成真实 OPL WebUI session bridge canary。
- 已完成 Gateway proxy、Adapter launch、session create、database readback 和 state backflow。
- 已完成 `/api/opl/*` placeholder 的 `capability_not_supported` 分类。
- 尚未完成真实 provider key message reply canary。
- 尚未完成 WebUI file upload canary。
- 尚未完成真实 Runtime Agent relay run/artifact canary。
- 尚未完成真实 Langfuse trace source 和 `trace.medopl.cn` 部署。
- 尚未完成性能 benchmark canary。
