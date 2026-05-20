# v22 Portal-OPL Context Backflow Complete Link And Validation Path

本文定义 Portal-OPL context/backflow 的完整链路和后续开发验证验收顺序。它是 [v22-portal-opl-context-backflow-boundary.md](../contracts/v22-portal-opl-context-backflow-boundary.md) 的执行路径，不替代一级主合同和二级段合同。

## Complete Portal-OPL Link

当前分支的完整 Portal-OPL 链路如下：

```text
Portal SaaS control plane
  -> POST /portal/api/opl/launch
  -> Gateway entry/proxy
  -> clean OPL WebUI
  -> OPL requests context through Gateway
  -> Runtime Bridge bootstrap/status/capability registry
  -> Runtime Bridge session bind
  -> Runtime Bridge message backflow
  -> Runtime Bridge projection state
  -> Portal query /portal/api/opl/* projection
```

下游边界只作为 gate 和字段规范出现：

```text
OPL run/file intent
  -> Runtime Bridge downstream runtime gate
  -> Runtime Bridge / Runtime Agent boundary

OPL session/message trace metadata
  -> Runtime Bridge sanitized session trace metadata
  -> optional downstream Langfuse attachment at trace.medopl.cn
```

职责归属：

- Portal：SaaS 用户、租户、workspace、套餐、余额、托管环境、资源绑定、账单和用户入口。
- Gateway：clean OPL WebUI 入口、反代、httpOnly cookie / launch session、安全注入和 secret query 拒绝。
- Runtime Bridge：context bootstrap、capability registry、协议翻译、session binding、message backflow、缺能力 gate 和 Portal projection。
- Downstream Runtime Boundary：run、artifact、ledger、trace 和 billing metadata 的下游 canonical source；当前链路只定义 gate，不实现云 runtime。
- Downstream Langfuse Session Trace Boundary：清洗后的 session/trace attachment；`trace.medopl.cn` 是 admin/ops console 目标域，当前链路不部署 Langfuse。

## Development Verification Order

开发必须按以下阶段推进。前一阶段没有真实证据时，后一阶段不能用 fake success 代替。

### Stage 0: Discovery baseline

目标：

- 识别真实 upstream OPL 的能力边界。
- 区分 real HTTP Product API、WebUI bridge、ACP/CLI runtime、unsupported capability。

验证：

```text
future-authorized upstream/WebUI capability runner only
```

验收：

- one-person-lab upstream clean。
- `/api/opl/*` placeholder 必须分类为 `capability_not_supported`。
- WebUI bridge session create 和 DB readback 有证据。
- 证据只写 `.runtime`，不进 git。

### Stage 1: Gateway launch and bootstrap

目标：

- Portal 通过 Gateway 打开 clean OPL WebUI。
- OPL 通过 Gateway/Runtime Bridge 获取 MedOPL public context。

验证：

```text
node tests/regression/opl/regression-test-v22-opl-gateway-upstream-proxy-local.mjs
node tests/smoke/smoke-test-v22-portal-opl-connection-contract.mjs
```

验收：

- `POST /portal/api/opl/launch` 创建服务端 launch session。
- Gateway 拒绝 URL query 中的 raw key、bearer token、`launchToken`、`runtimeToken`。
- `GET /runtime-bridge/api/opl/bootstrap` 返回 public context。
- bootstrap 不含 raw key、token、objectKey、localPath、signedUrl。
- Gateway 不生成业务成功状态。

### Stage 2: Session binding

目标：

- Runtime Bridge 通过真实 WebUI bridge 或 ACP/CLI runtime 创建/读取 OPL session。
- 把 `oplSessionId` 绑定到 MedOPL workspace/runtime/resource binding。

验证：

```text
OPL_REAL_WEBUI_DIR=<authorized-webui-dir> node tests/future-authorized/cloud/future-authorized-test-v22-real-opl-webui-runtime-bridge-flow.mjs
node tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-state-store-atomic-flow.mjs
```

验收：

- `GET /runtime-bridge/api/opl/bootstrap` 来自真实 upstream health/capability 访问和 Runtime Bridge state projection。
- `POST /runtime-bridge/api/opl/sessions/bind` 写入 `opl_session_bound`。
- Runtime Bridge state 保留 `portalUserId + tenantId + workspaceId + workspaceSessionId + runtimeSessionId + resourceBindingId + oplSessionId`。
- 并发 context/message/backflow state 写入不互相覆盖。

### Stage 3: OPL message backflow canary

目标：

- 证明 OPL message intent 能进入真实 OPL/agent/provider 边界，或明确 gate failure。
- 证明 Portal 查询的是 Runtime Bridge state projection，不是 Portal 本地伪造。

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

- 请求带 `workspaceId`、`runtimeSessionId`、`oplSessionId`、`clientMessageId` 和 `providerKeyRef`。
- Runtime Bridge 访问真实 OPL/agent/provider 边界，或返回明确 gate error。
- reply 必须能关联到同一 conversation/message。
- `completed` 必须包含 sanitized reply metadata 和 optional `traceId`。
- 无 provider 时返回 `provider_key_required`。
- 无 reply event 或超时时返回 `upstream_reply_timeout` 或 `capability_not_supported`。
- raw prompt、raw completion 和 raw key 不进 public response、trace、evidence 或 git。

### Stage 4: Downstream runtime boundary gate

目标：

- 证明 OPL file/run intent 不由 Runtime Bridge 伪造成成功。
- 证明缺少真实 Runtime Agent 时能稳定 gate。

预期链路：

```text
OPL file/run intent
  -> Runtime Bridge normalized intent
  -> Runtime Bridge / Runtime Agent boundary gate
  -> platform_isolated_runtime_agent_required or downstream runtime handoff
```

验收：

- 缺 provider key 返回 `provider_key_required`。
- 缺 runtime/resource binding 返回 `managed_environment_required`。
- 缺 Runtime Agent endpoint 返回 `platform_isolated_runtime_agent_required`。
- Runtime Bridge 不生成伪 `runId`、伪 artifact 或伪 billing success。
- 真实云 runtime、真实 Runtime Agent endpoint、真实计算/存储资源、真实部署和真实云 API 调用必须另开授权分支。

### Stage 5: Downstream Langfuse session trace boundary

目标：

- 定义 Portal-OPL session/message trace 字段。
- 证明 Langfuse 不成为业务真相源。
- 固定 `trace.medopl.cn` 作为后续 admin/ops console 目标域。

预期链路：

```text
Runtime Bridge session/message metadata
  -> sanitized session trace metadata
  -> Portal session trace projection
  -> optional downstream Langfuse projection
  -> trace.medopl.cn admin/ops console
```

验收：

- Runtime Bridge projection 有 `traceId`、`sessionId`、`oplSessionId`、`workspaceSessionId`、`messageId`、status、latency metadata。
- Portal session trace projection 不依赖 Langfuse 原始 trace 反推业务成功。
- Langfuse projection 只含 `traceId`、`sessionId`、`runId`、`messageId`、`status`、`latencyMs`、usage summary、cost estimate、tags 和严格校验 origin 的 trace URL。
- `trace.medopl.cn` 的真实部署、DNS、TLS、Ingress、Langfuse secret、ClickHouse 和真实 trace source 需要单独授权。

### Stage 6: Portal projection

目标：

- 证明 Portal 只通过稳定 `/portal/api/opl/*` 查询 Runtime Bridge projection。
- 证明跨用户、跨 workspace、跨 launch 的数据不可串读。

验收：

- Portal launch 只能访问当前用户拥有的 `launchId`。
- Portal projection 包含 context、session、message status、capability registry 和 downstream gate status。
- Portal projection 不含 raw prompt、raw completion、raw API key、bearer token、`launchToken`、`runtimeToken`、objectKey、storageKey、localPath、signedUrl、presignedUrl。
- OPL event -> Runtime Bridge projection -> Portal query 形成可验证回流。

### Stage 7: Performance comparison

目标：

- 量化 Portal-OPL context/backflow 链路引入的额外开销。
- 避免用未测数字宣称性能可接受。

比较对象：

- direct OPL WebUI baseline。
- Gateway + Runtime Bridge。
- Gateway + Runtime Bridge + downstream runtime gate。

必须记录：

- Portal launch -> OPL bootstrap p50/p95。
- session create 到 DB readback p50/p95。
- OPL event -> Runtime Bridge projection -> Portal query p50/p95。
- Runtime Bridge state write p50/p95。
- Gateway proxy overhead p50/p95。
- WebSocket bridge reconnect/error overhead。

初始目标：

- session class extra p95 target <= 300ms。
- Portal-OPL context/backflow extra overhead target <= 5% for non-runtime operations。
- Gateway/Runtime Bridge 错误率不得高于 direct OPL WebUI baseline。

这些目标是性能预算，不代表当前已经完成真实 benchmark。

## Absorption Gate

实现分支进入 B 窗口前必须满足：

1. 订阅 [v22-portal-opl-context-backflow-boundary.md](../contracts/v22-portal-opl-context-backflow-boundary.md) 和其合同包。
2. `node tests/regression/opl/regression-test-v22-portal-opl-context-backflow-contract.mjs` 通过。
3. `node tests/smoke/smoke-test-v22-portal-opl-connection-contract.mjs` 通过。
4. `node tests/regression/runtime-bridge/regression-test-v22-portal-runtime-bridge-api-local-flow.mjs` 通过。
5. 如本分支明确授权真实 WebUI 来源，`OPL_REAL_WEBUI_DIR=... node tests/future-authorized/cloud/future-authorized-test-v22-real-opl-webui-runtime-bridge-flow.mjs` 通过；否则只保留合同 gate，不得把真实 WebUI 运行当默认入口。
6. message backflow 未完成真实 canary 时必须明确写入状态矩阵和合同，不得宣称完整真实上线。
7. downstream runtime 未授权时必须 gate，不得伪造 run/artifact。
8. downstream Langfuse 未授权时不得部署、不得读 secret、不得把 `trace.medopl.cn` 当已上线。
9. 真实 evidence 只进入 `.runtime`，不进 git。
10. one-person-lab upstream 保持 clean。
11. secret hygiene 检查没有 raw prompt、raw completion、raw API key、bearer token、`launchToken`、`runtimeToken`、objectKey、storageKey、localPath、signedUrl、presignedUrl 泄露。

## Current Status

截至 2026-05-12：

- 已完成真实 OPL WebUI session bridge canary。
- 已完成 Gateway proxy、Runtime Bridge launch、session create、database readback 和 state backflow。
- 已完成 `/api/opl/*` placeholder 的 `capability_not_supported` 分类。
- 已完成授权真实 provider key message reply canary：Portal -> Gateway -> Runtime Bridge -> clean OPL WebUI bridge -> provider message 已观测到 assistant reply，并以 `mapped_to_webui_bridge` 回流 Portal message status 与 Portal session trace。该结果只证明 message/reply，不证明 file/run/artifact、真实云 runtime 或 Langfuse 已上线。
- 已完成本地独立 Runtime Agent HTTP API relay file/run/artifact canary：Portal launch/bootstrap/session bind/file/run/artifact/session trace 可以形成 workspace-scoped `fileRef`、`runId/status/traceId`、`artifactRef/outputFileRef`、`billingMetadataRef/usageMetadataRef` 和 Portal projection。该结果只证明本地 Runtime Agent API relay，不代表真实云 runtime、COS 账单、Package D deploy 或生产 Runtime Agent 已上线。
- 尚未实现真实云 runtime，本合同只定义 downstream runtime gate 和 OPL lane projection handoff。
- 尚未部署真实 Langfuse 或 `trace.medopl.cn`，本合同只定义 downstream Langfuse session trace boundary 和 Portal canonical trace projection。
- 尚未完成性能 benchmark canary。
