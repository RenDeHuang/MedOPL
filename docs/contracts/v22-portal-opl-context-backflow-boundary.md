# v22 Portal-OPL Context Backflow Boundary Contract

本合同定义 MedOPL v22 中 Portal 与 clean upstream OPL WebUI 之间的 context/backflow 闭环。它回答三件事：

1. Portal 怎么打通 OPL。
2. OPL 怎么拿到 Portal / MedOPL 上下文。
3. OPL 产生的 session、message 和能力状态怎么反馈给 Portal。

本合同不实现真实云 runtime，不部署 Langfuse，不修改 one-person-lab upstream，不 import upstream 内部模块，不读取 secret，不调用真实云 API，不运行 build/push/kubectl/live-test，不修改 deploy、`.sentrux` 或 `adapters`。

## Contract Level

合同分级如下：

- Level 1: [v22-mvp-managed-opl-loop.md](./v22-mvp-managed-opl-loop.md)。一级主合同，定义 MedOPL 托管 OPL SaaS 用户主闭环。
- Level 2: [v22-portal-opl-connection-boundary.md](./v22-portal-opl-connection-boundary.md) 和 [v22-upstream-opl-boundary.md](./v22-upstream-opl-boundary.md)。二级段合同，定义 Portal-OPL 连接和 upstream clean 边界。
- Level 3: 本合同。Portal-OPL context/backflow execution contract，细化 launch、Gateway、bootstrap、session bind、message backflow、capability registry、Portal projection、下游 runtime gate 和下游 Langfuse session trace boundary。

本合同是三级执行合同，不替代一级主合同和二级段合同。

## Subscription Package

本合同订阅以下合同包：

- [v22-mvp-managed-opl-loop.md](./v22-mvp-managed-opl-loop.md)
- [v22-portal-opl-connection-boundary.md](./v22-portal-opl-connection-boundary.md)
- [v22-upstream-opl-boundary.md](./v22-upstream-opl-boundary.md)
- [v22-opl-work-message-file-run-boundary.md](./v22-opl-work-message-file-run-boundary.md)
- [v22-runtime-bridge-session-run-file-provider-keyref-boundary.md](./v22-runtime-bridge-session-run-file-provider-keyref-boundary.md)
- [v22-portal-files-billing-trace-boundary.md](./v22-portal-files-billing-trace-boundary.md)
- [v22-token-provider-boundary.md](./v22-token-provider-boundary.md)
- [v22-langfuse-observability-metadata-boundary.md](./v22-langfuse-observability-metadata-boundary.md)
- [../recovery/status-matrix.md](../recovery/status-matrix.md)
- [../recovery/mvp-contract-acceptance.md](../recovery/mvp-contract-acceptance.md)

规范路径为：

- `docs/recovery/status-matrix.md`
- `docs/recovery/mvp-contract-acceptance.md`

## Product Truth

当前分支的 Primary Scope 是：

```text
Portal
  -> Gateway
  -> clean OPL WebUI
  -> Runtime Bridge bootstrap/session/message backflow
  -> Portal projection
```

产品真相：

```text
Portal 是 SaaS control plane。
Gateway 是 clean OPL WebUI entry/proxy。
Runtime Bridge 是 OPL context/backflow anti-corruption layer。
Runtime Bridge / Runtime Agent is the downstream canonical source for run, artifact, ledger, trace, and billing metadata.
Langfuse is not the canonical source; it is an optional sanitized session trace attachment.
one-person-lab upstream remains clean.
```

Portal 不理解 OPL 内部协议。Gateway 不成为业务真相源。Runtime Bridge 只负责上下文、能力注册、事件归一和 Portal projection，不伪造业务成功。Runtime Bridge / Runtime Agent 是下游 runtime 事实源；This contract does not implement cloud runtime。Langfuse 只接收清洗后的 session/trace metadata；This contract does not deploy Langfuse。

## Complete Portal-OPL Link Validation Path

完整开发验收必须沿着 [portal-opl-context-backflow-validation-path.md](../recovery/portal-opl-context-backflow-validation-path.md) 执行。该链路从 discovery baseline 开始，依次验证 Portal launch、Gateway proxy、OPL context bootstrap、session binding、message backflow、Portal projection、下游 runtime gate、下游 Langfuse session trace boundary 和性能对比。

任何实现分支如果只通过本地 fake Product API 或只返回 200/201/202，不能宣称完成真实 Portal-OPL context/backflow 闭环。

## Stable API Surface

Portal 与 Runtime Bridge 的核心稳定接口固定为：

```text
POST /portal/api/opl/launch
GET /runtime-bridge/api/opl/bootstrap
GET /runtime-bridge/api/opl/status
POST /runtime-bridge/api/opl/sessions/bind
POST /runtime-bridge/api/opl/messages
GET /runtime-bridge/api/opl/messages/{messageId}/status
```

以下接口属于下游 intent / projection 边界，可以在本合同中声明 gate，但不要求当前分支实现真实 runtime：

```text
POST /runtime-bridge/api/opl/files
POST /runtime-bridge/api/opl/runs
GET /runtime-bridge/api/opl/runs/{runId}/status
GET /runtime-bridge/api/opl/runs/{runId}/artifacts
GET /runtime-bridge/api/opl/artifacts/{artifactRef}
```

Portal 代理接口必须只映射到 Runtime Bridge 稳定边界。Portal 不能直接依赖 one-person-lab route、WebSocket event shape、DOM、frontend store、database schema 或 internal session model。

## Module Boundaries

### Portal SaaS Control Plane

Portal 负责 SaaS 产品控制面：

- 用户、租户、workspace、套餐、余额、托管环境、资源绑定和账单状态。
- OPL launch 入口。
- 当前用户与 `launchId`、workspace、resource binding 的授权校验。
- OPL context/backflow projection 展示。

Portal 输入：

- Portal session。
- `workspaceId`。
- `providerKeyRef` bound status。
- runtime/resource binding 状态。

Portal 输出：

- `launchId`。
- `openUrl`。
- public launch status。
- 通过 `/portal/api/opl/*` 代理返回的 Runtime Bridge projection。

Portal 禁止：

- 保存或透出 raw API key、bearer token、`launchToken`、`runtimeToken`。
- 依赖 OPL WebUI 内部 state 或 DB schema。
- 用本地 fake state 代替 Runtime Bridge 回流。

### Gateway Entry And Secret Boundary

Gateway 负责 clean OPL WebUI 入口和安全反代：

- 通过 `OPL_UPSTREAM_URL` 指向真实 clean OPL WebUI。
- 代理 HTML、静态资源和 WebSocket bridge。
- 使用 httpOnly cookie 或服务端 launch session 关联 MedOPL context。
- 注入最小公开上下文：`workspaceId`、`runtimeSessionId`、`providerBound`、`providerKeyRef`、Portal return URL。
- 拒绝 URL query 中的 `apiKey`、`providerApiKey`、`launchToken`、`runtimeToken` 或 bearer token 类字段。

Gateway 不负责：

- run 成功与否。
- artifact 归属。
- billing truth。
- Langfuse trace truth。
- upstream protocol interpretation。

### OPL Context Bootstrap

OPL Context Bootstrap 负责让 clean OPL WebUI 获取 MedOPL public context。

输入：

- httpOnly cookie 或服务端 launch session。
- Gateway 转发的 bootstrap 请求。

输出：

- `portalUserId`
- `tenantId`
- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- optional `oplSessionId`
- `providerBound`
- `providerKeyRef`
- `canStartRun`
- `launchStatus`
- Portal return URL
- `runtimeBridgeContractVersion`
- capability registry

禁止：

- 不返回 raw API key。
- 不返回 bearer token。
- 不返回 `launchToken` 或 `runtimeToken`。
- 不返回 `objectKey`、`storageKey`、`localPath`、`signedUrl` 或 `presignedUrl`。
- 不把 OPL private state 透传给 Portal。

### Runtime Bridge Capability Registry

Runtime Bridge 必须暴露 capability registry，并在 bootstrap/status 中返回：

```json
{
  "runtimeBridgeContractVersion": "v22.portal-opl-context-backflow.v1",
  "upstreamProfile": "webui_bridge",
  "capabilities": {
    "contextBootstrap": { "status": "supported", "source": "gateway_runtime_bridge" },
    "session": { "status": "supported", "source": "webui_bridge" },
    "messageBackflow": { "status": "capability_not_supported", "source": "webui_bridge", "reason": "reply_not_verified" },
    "fileIntent": { "status": "requires_downstream_runtime_boundary", "source": "portal_workspace_file_store" },
    "runIntent": { "status": "requires_runtime_agent", "source": "runtime_bridge" },
    "langfuseSessionTrace": { "status": "deferred_authorization", "source": "trace.medopl.cn" }
  },
  "supportedEvents": [
    "context_bootstrapped",
    "session_bound",
    "message_created",
    "message_reply_observed",
    "downstream_runtime_gate_evaluated",
    "session_trace_metadata_projected"
  ]
}
```

capability 状态允许：

- `supported`
- `mapped_to_webui_bridge`
- `mapped_to_acp_runtime`
- `requires_downstream_runtime_boundary`
- `requires_runtime_agent`
- `deferred_authorization`
- `capability_not_supported`
- `provider_key_required`
- `managed_environment_required`
- `platform_isolated_runtime_agent_required`

Runtime Bridge 必须按能力独立失败。message 不支持不能影响 session bind；run intent 缺 Runtime Agent 不能让 bootstrap 失败；Langfuse 未部署不能让 Portal-OPL context/backflow 失败；upstream route 变化只能影响对应 capability mapping。

### Runtime Bridge Session Binding

Session binding 把 upstream OPL session 归一化到 MedOPL runtime session：

输入：

- `oplSessionId`
- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `resourceBindingId`
- `providerKeyRef`
- capability hints

允许 upstream 边界：

- WebUI WebSocket bridge `create-conversation`
- WebUI database readback through bridge event
- ACP/CLI public runtime session command
- future real HTTP Product API

输出：

- normalized `oplSessionId`
- `opl_session_bound` event
- session capability snapshot
- launch/bootstrap projection

验收：

- conversation/session 必须来自真实 upstream 或公开 runtime 边界。
- Runtime Bridge state 必须写入 `portalUserId + tenantId + workspaceId + workspaceSessionId + runtimeSessionId + resourceBindingId + oplSessionId`。
- 没有 workspace 或 runtime session 时返回稳定 gate error。

### Runtime Bridge Message Relay

Message Relay 在本合同里只负责 Portal-OPL message backflow：把 OPL message intent 送入真实 OPL/agent/provider 边界，并把明确 message 状态回流写入 Runtime Bridge state。

输入：

- `workspaceId`
- `runtimeSessionId`
- `oplSessionId`
- `clientMessageId`
- sanitized message metadata
- `providerKeyRef`

允许 upstream 边界：

- WebUI WebSocket bridge
- ACP/CLI public command
- future real HTTP Product API

输出：

- `messageId`
- `status`: `accepted`、`running`、`completed`、`failed`、`capability_not_supported`
- reply metadata when verified
- optional `traceId`
- sanitized usage summary when available

禁止：

- 不保存 raw prompt 到公开 trace。
- 不从任意 DB message 猜 reply。
- 不把 HTTP 200 当 reply 成功。
- 不暴露 raw provider key、bearer token、`launchToken` 或 `runtimeToken`。

验收：

- `POST /runtime-bridge/api/opl/messages` 后，真实 OPL/agent/provider 边界被访问，或明确返回 gate error。
- `GET /runtime-bridge/api/opl/messages/{messageId}/status` 读取同一 message 的 state。
- `completed` 必须有明确 reply event、reply payload 或同 conversation 的可验证 assistant reply 回流。
- 无 provider、无 reply event 或超时时返回 `provider_key_required`、`capability_not_supported` 或 `upstream_reply_timeout`。

### Runtime Bridge Backflow Projection

Runtime Bridge Backflow Projection 负责把 OPL 事件归一成 Portal 可读状态：

- `context_bootstrapped`
- `opl_session_created`
- `opl_session_bound`
- `message_created`
- `message_reply_observed`
- `capability_not_supported`
- `downstream_runtime_gate_evaluated`
- `session_trace_metadata_projected`

Projection 必须绑定：

- `portalUserId`
- `tenantId`
- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `resourceBindingId`
- `oplSessionId`
- `providerKeyRef`

Projection 禁止包含：

- raw prompt
- raw completion
- raw API key
- bearer token
- `launchToken`
- `runtimeToken`
- `objectKey`
- `storageKey`
- `localPath`
- `signedUrl`
- `presignedUrl`

### Downstream Runtime Boundary

Runtime 源是需要管理的下游边界，但不是本合同的当前实现主体。

OPL 产生 run/file intent 时，Runtime Bridge 可以归一化 intent，但真实 run、artifact、ledger、trace 和 billing metadata 必须进入 Runtime Bridge / Runtime Agent。Runtime Bridge / Runtime Agent is the downstream canonical source。

本合同要求：

- Runtime Bridge 不能直接生成伪 run 成功。
- Runtime Bridge 不能直接生成伪 artifact 成功。
- 没有 Runtime Agent identity/endpoint 时返回 `platform_isolated_runtime_agent_required`。
- 未绑定 provider key 时返回 `provider_key_required`。
- 未开通 runtime/resource binding 时返回 `managed_environment_required`。
- This contract does not implement cloud runtime。

真实云 runtime、真实 Runtime Agent endpoint、真实计算/存储资源、真实部署和真实云 API 调用必须另开授权分支。

### Downstream Langfuse Session Trace Boundary

Langfuse 的 session/trace 字段规范归入本 Portal-OPL 链路管理，但 Langfuse 基础设施部署不属于本合同当前实现。

`trace.medopl.cn` 是后续 Langfuse admin/ops console 目标域。客户默认 trace 页面仍在 Portal 会话轨迹。

Langfuse 可以接收清洗后的：

- `traceId`
- `sessionId`
- `oplSessionId`
- `workspaceSessionId`
- `runId`
- `messageId`
- `status`
- `latencyMs`
- usage summary
- cost estimate
- tags
- strict-origin-validated trace URL

Langfuse 不能用于：

- message 成功的唯一依据。
- run 成功的唯一依据。
- artifact 真相源。
- billing 真相源。
- raw prompt、raw completion、raw key 或 token 存储点。

This contract does not deploy Langfuse。`trace.medopl.cn` 的真实部署、Ingress/TLS、LB、DNS、Langfuse secret、ClickHouse、真实 API key 和真实 trace source 需要后续单独授权。

### Error Gates And No-Fake-Success

所有 API 必须用稳定 gate error 表达缺失条件：

- `workspace_required`
- `provider_key_required`
- `managed_environment_required`
- `platform_isolated_runtime_agent_required`
- `capability_not_supported`
- `upstream_reply_timeout`
- `upstream_capability_incompatible`
- `runtime_bridge_state_conflict`

禁止用以下方式掩盖未闭环能力：

- HTTP 200/201/202 但没有真实访问证据。
- 本地生成 reply 冒充 OPL/agent/provider reply。
- 本地生成 run/artifact 冒充 Runtime Agent output。
- 从任意 DB message 猜 assistant reply。
- 从 Langfuse trace 反推业务成功。
- 用默认 workspace、默认 provider、默认 runtime、隐式 resource binding 兜底。

### Performance Canary

性能验收必须比较三类链路：

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

这些目标是后续 canary 验收预算，不代表当前已实测完成。

## Absorption Gate

B 窗口吸收实现分支前必须确认：

1. 合同订阅包完整，且本合同被识别为 Level 3 执行合同。
2. one-person-lab upstream remains clean。
3. Portal、Gateway、Runtime Bridge、downstream Runtime boundary 和 downstream Langfuse boundary 的职责没有互相污染。
4. capability registry 能表达每个 API 的真实支持状态。
5. Portal launch、OPL context bootstrap、session bind、message backflow 和 Portal projection 有真实访问和真实回流证据，或明确 gate error。
6. Runtime 只作为下游 canonical boundary；没有授权时不实现云 runtime，不伪造 run/artifact。
7. Langfuse 只作为 `trace.medopl.cn` session trace attachment；没有授权时不部署、不读 secret、不接真实 Langfuse。
8. raw prompt、raw completion、raw API key、bearer token、`launchToken`、`runtimeToken`、`objectKey`、`storageKey`、`localPath`、`signedUrl`、`presignedUrl` 未进入 public response、browser state、log、evidence 或 git。
9. 完整链路按 [portal-opl-context-backflow-validation-path.md](../recovery/portal-opl-context-backflow-validation-path.md) 验证。

## Non-goals

- 不修改 one-person-lab upstream。
- 不 import upstream 内部模块。
- 不往 upstream 目录写 Portal、Gateway、Runtime Bridge 或 Runtime Agent 代码。
- 不实现真实云 runtime。
- 不部署 Langfuse 或 `trace.medopl.cn`。
- 不接真实云资源开通。
- 不读取 secret、kubeconfig、SecretId、SecretKey、SSH private key 或 `.env`。
- 不调用真实腾讯云、COS、Langfuse 或外部生产 API。
- 不运行 build/push/kubectl/live-test。
- 不修改 deploy、`.sentrux` 或 `adapters`。
- 不恢复 `user_owned`、旧 resource-order、旧 runner/provisioner、OpenCost 或 Langfuse 主叙事。

## Smoke

本合同由以下 smoke 固化：

```text
node scripts/smoke-test-v22-portal-opl-context-backflow-contract.mjs
```
