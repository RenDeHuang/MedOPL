# v22 Real OPL Workflow Adapter Boundary Contract

本合同定义 MedOPL v22 将 clean upstream OPL WebUI 接入完整工作流时的模块化边界。它把 Portal、Gateway、Adapter、Runtime Bridge、Runtime Agent 和 Langfuse 的职责拆开，防止 Portal 绑定 upstream 内部实现，也防止 Adapter 用 200/202 或本地状态伪造真实业务闭环。

本合同不修改 one-person-lab upstream，不 import upstream 内部模块，不读取 secret，不调用真实云 API，不运行 build/push/kubectl/live-test，不修改 deploy、`.sentrux` 或 `adapters`。

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

完整链路的产品真相是：

```text
Portal 是 SaaS control plane。
Gateway 是 clean OPL WebUI entry/proxy。
Adapter 是 OPL capability anti-corruption layer。
Runtime Bridge / Runtime Agent is the canonical source for run, artifact, ledger, trace, and billing metadata.
Langfuse is not the canonical source; it is an optional sanitized observability attachment.
one-person-lab upstream remains clean.
```

Portal 不理解 OPL 内部协议。Gateway 不成为业务真相源。Adapter 不伪造业务成功。Runtime Bridge / Runtime Agent 产生真实 run、artifact、ledger、trace 和 billing metadata。Langfuse 只展示清洗后的观测信息，不能决定 message、run、artifact 或 billing 是否成功。

## Complete Workflow Validation Path

完整开发验收必须沿着 [real-opl-workflow-adapter-validation-path.md](../recovery/real-opl-workflow-adapter-validation-path.md) 执行。该链路从 discovery baseline 开始，依次验证 Gateway、bootstrap、session binding、message reply、file reference、Runtime Agent run/artifact、trace/billing projection、Langfuse projection 和性能对比。

任何实现分支如果只通过本地 fake Product API 或只返回 200/201/202，不能宣称完成真实 OPL 工作流闭环。

## Stable API Surface

Portal 与 Adapter 的稳定接口固定为：

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

Portal 代理接口必须只映射到上述 Adapter 稳定边界。Portal 不能直接依赖 one-person-lab route、WebSocket event shape、DOM、frontend store、database schema 或 internal session model。

## Module Boundaries

### Portal SaaS Control Plane

Portal 负责 SaaS 产品控制面：

- 用户、租户、workspace、套餐、余额、托管环境、资源绑定和账单状态。
- OPL launch 入口。
- 文件空间、输出文件、会话轨迹和账单摘要展示。
- 当前用户与 `launchId`、workspace、resource binding 的授权校验。

Portal 输入：

- Portal session。
- `workspaceId`。
- `providerKeyRef` bound status。
- runtime/resource binding 状态。

Portal 输出：

- `launchId`。
- `openUrl`。
- public launch status。
- 通过 `/portal/api/opl/*` 代理返回的 Adapter projection。

Portal 禁止：

- 保存或透出 raw API key、bearer token、`launchToken`、`runtimeToken`。
- 依赖 OPL WebUI 内部 state 或 DB schema。
- 用本地 fake state 代替 Adapter 回流。

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

### Adapter Capability Registry

Adapter 必须暴露 capability registry，并在 bootstrap/status 中返回：

```json
{
  "adapterContractVersion": "v22.real-opl-workflow-adapter.v1",
  "upstreamProfile": "webui_bridge",
  "capabilities": {
    "session": { "status": "supported", "source": "webui_bridge" },
    "message": { "status": "capability_not_supported", "source": "webui_bridge", "reason": "reply_not_verified" },
    "fileUpload": { "status": "capability_not_supported", "reason": "upstream_file_protocol_not_verified" },
    "run": { "status": "requires_runtime_agent", "source": "runtime_bridge" },
    "artifact": { "status": "requires_runtime_agent", "source": "runtime_bridge" }
  },
  "supportedEvents": [
    "session_bound",
    "message_created",
    "message_reply_observed",
    "file_referenced",
    "run_started",
    "run_updated",
    "artifact_created"
  ]
}
```

capability 状态允许：

- `supported`
- `mapped_to_webui_bridge`
- `mapped_to_acp_runtime`
- `requires_runtime_agent`
- `capability_not_supported`
- `provider_key_required`
- `managed_environment_required`
- `platform_isolated_runtime_agent_required`

Adapter 必须按能力独立失败。message 不支持不能影响 session bind；run relay 缺 Runtime Agent 不能让 bootstrap 失败；upstream route 变化只能影响对应 capability mapping。

### Adapter Session Binding

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
- Adapter state 必须写入 `portalUserId + tenantId + workspaceId + workspaceSessionId + runtimeSessionId + resourceBindingId + oplSessionId`。
- 没有 workspace 或 runtime session 时返回稳定 gate error。

### Adapter Message Relay

Message Relay 负责把 message 送入真实 OPL/agent/provider，并把明确 reply 回流写入 Adapter state。

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
- reply metadata
- `traceId`
- sanitized usage summary

禁止：

- 不保存 raw prompt 到公开 trace。
- 不从任意 DB message 猜 reply。
- 不把 HTTP 200 当 reply 成功。
- 不暴露 raw provider key、bearer token、`launchToken` 或 `runtimeToken`。

验收：

- `POST /portal-adapter/api/opl/messages` 后，真实 OPL/agent/provider 边界被访问。
- `GET /portal-adapter/api/opl/messages/{messageId}/status` 读取同一 message 的 state。
- `completed` 必须有明确 reply event、reply payload 或同 conversation 的可验证 assistant reply 回流。
- 无 provider、无 reply event 或超时时返回 `provider_key_required`、`capability_not_supported` 或 `upstream_reply_timeout`。

### Adapter File Reference Mapping

File Reference Mapping 负责把 OPL 文件动作归一到 MedOPL workspace file reference。

输入：

- `workspaceId`
- `runtimeSessionId`
- `oplSessionId`
- file metadata
- optional upstream file identity

允许边界：

- Portal workspace file store。
- OPL public upload API 或 bridge event，如果真实 canary 已证明存在。
- Runtime Agent 可消费的 `fileRef`。

输出：

- `fileRef`
- workspace-scoped file record
- sanitized file metadata

禁止：

- 不返回 `objectKey`、`storageKey`、`localPath`、`signedUrl`、`presignedUrl`。
- 不依赖 upstream 内部文件路径。
- 不把未验证 WebUI upload 行为当作支持。

验收：

- `POST /portal-adapter/api/opl/files` 生成 workspace-scoped `fileRef`。
- 后续 run 能引用该 `fileRef`。
- 如果真实 OPL 文件协议未验证，Adapter 返回 `capability_not_supported` 或只声明 Portal workspace file store canonical path。

### Runtime Bridge Run Relay

Run Relay 负责把工作流 run 送入 Runtime Bridge / Runtime Agent。

输入：

- `workspaceId`
- `runtimeSessionId`
- `resourceBindingId`
- `providerKeyRef`
- `fileRefs`
- run intent

允许依赖：

- Runtime Agent relay/API。
- Runtime Bridge state store。
- Runtime Bridge provider secret boundary，仅通过 `providerKeyRef`。

输出：

- `runId`
- `traceId`
- run status
- artifact refs
- sanitized usage/cost summary

禁止：

- Adapter 不能直接生成伪 run 成功。
- Runtime Agent 不能接收 raw API key。
- 不绕过 `workspaceId`、`resourceBindingId`、runtime availability 或 provider binding gate。

验收：

- `POST /portal-adapter/api/opl/runs` 必须调用 Runtime Agent relay/API 边界。
- 缺少 provider key 返回 `provider_key_required`。
- 缺少托管运行环境或 active resource binding 返回 `managed_environment_required`。
- 缺少 Runtime Agent identity/endpoint 返回 `platform_isolated_runtime_agent_required`。
- run status 必须来自 Runtime Bridge state，不是静态成功。

### Runtime Agent Artifact Backflow

Runtime Agent Artifact Backflow 负责把真实输出转成 Portal 可见 artifact projection。

输入：

- Runtime Agent output metadata。
- `runId`。
- `workspaceId`。
- `resourceBindingId`。
- `providerKeyRef`。

输出：

- `artifactRef`
- optional `outputFileRef`
- artifact status
- sanitized artifact metadata

公开 artifact projection 只允许包含：

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
- sanitized status/timestamps

禁止：

- 不返回 `objectKey`、`storageKey`、`localPath`、`signedUrl`、`presignedUrl`。
- 不保存 Runtime Agent `rawPayload` 原文到公开 ledger。
- 不把 artifact 创建成与 run/session/workspace 无关的全局对象。

验收：

- `GET /portal-adapter/api/opl/runs/{runId}/artifacts` 按 launch/session/workspace 鉴权。
- `GET /portal-adapter/api/opl/artifacts/{artifactRef}` 只返回当前 launch/session/workspace 可见 projection。
- artifact 必须来自 Runtime Agent output 或已定义 workspace output projection。

### Trace And Billing Canonical Projection

Trace 和 billing metadata 的 canonical source 是 Runtime Bridge / Runtime Agent ledger，不是 Langfuse。

必须写回：

- `traceId`
- `runId`
- `workspaceId`
- `runtimeSessionId`
- `resourceBindingId`
- `providerKeyRef`
- artifact refs
- sanitized usage summary
- sanitized cost summary
- status / event type / timestamps

禁止写入公开 trace、evidence、log 或 git 的数据：

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

Portal 只能展示 sanitized projection。billing summary 是业务账本或 Runtime Bridge ledger 的投影，不得由 Langfuse 原始 trace 反推。

### Langfuse Observability Attachment

Langfuse 是 optional observability attachment。`trace.medopl.cn` 是 Langfuse admin/ops console 目标域；客户默认 trace 页面仍在 Portal 会话轨迹。

Langfuse 可以接收：

- `traceId`
- `sessionId`
- `runId`
- `status`
- `latencyMs`
- usage summary
- cost estimate
- tags
- strict-origin-validated `traceUrl`

Langfuse 可以用于：

- trace 可视化。
- latency。
- usage summary。
- provider 调用链 debug。
- 错误链路。
- admin/ops 观察。

Langfuse 不能用于：

- message 成功的唯一依据。
- run 成功的唯一依据。
- artifact 真相源。
- billing 真相源。
- raw prompt、raw completion、raw key 或 token 存储点。

`trace.medopl.cn` 的真实部署、Ingress/TLS、LB、DNS、Langfuse secret、ClickHouse、真实 API key 和真实 trace source 需要后续单独授权。当前合同只定义边界和验收路径。

### Error Gates And No-Fake-Success

所有 API 必须用稳定 gate error 表达缺失条件：

- `workspace_required`
- `provider_key_required`
- `managed_environment_required`
- `platform_isolated_runtime_agent_required`
- `capability_not_supported`
- `upstream_reply_timeout`
- `upstream_capability_incompatible`
- `adapter_state_conflict`

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

这些目标是后续 canary 验收预算，不代表当前已实测完成。

## Absorption Gate

B 窗口吸收实现分支前必须确认：

1. 合同订阅包完整。
2. one-person-lab upstream remains clean。
3. Gateway、Adapter、Runtime Bridge、Runtime Agent、Langfuse 的职责没有互相污染。
4. capability registry 能表达每个 API 的真实支持状态。
5. message/file/run/artifact 都有真实访问和真实回流证据，或明确 gate error。
6. Langfuse 只作为 `trace.medopl.cn` observability attachment，不是 canonical source。
7. raw prompt、raw completion、raw API key、bearer token、`launchToken`、`runtimeToken`、`objectKey`、`storageKey`、`localPath`、`signedUrl`、`presignedUrl` 未进入 public response、browser state、log、evidence 或 git。
8. 完整链路按 [real-opl-workflow-adapter-validation-path.md](../recovery/real-opl-workflow-adapter-validation-path.md) 验证。

## Non-goals

- 不修改 one-person-lab upstream。
- 不 import upstream 内部模块。
- 不往 upstream 目录写 Portal、Gateway、Adapter 或 Runtime Agent 代码。
- 不接真实云资源开通。
- 不读取 secret、kubeconfig、SecretId、SecretKey、SSH private key 或 `.env`。
- 不调用真实腾讯云、COS、Langfuse 或外部生产 API。
- 不部署 `trace.medopl.cn`。
- 不运行 build/push/kubectl/live-test。
- 不修改 deploy、`.sentrux` 或 `adapters`。
- 不恢复 `user_owned`、旧 resource-order、旧 runner/provisioner、OpenCost 或 Langfuse 主叙事。

## Smoke

本合同由以下 smoke 固化：

```text
node scripts/smoke-test-v22-real-opl-workflow-adapter-contract.mjs
```
