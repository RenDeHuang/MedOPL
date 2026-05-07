# v22 Langfuse Observability Metadata Boundary Contract

本合同定义 MedOPL v22 中 Langfuse 作为可选观测层时的 metadata 边界，只约束合同和静态 smoke，不接真实 Langfuse，不改 runtime 实现。

## Product Boundary

Runtime Bridge session/run metadata 是 MedOPL 业务事实，负责 `workspace`、`run`、`artifact`、`resourceBinding`、`providerKeyRef`、`billing/cost summary`、`release/audit` 关联，是 Portal / Billing / Audit 的 canonical source。

Runtime Bridge metadata 责任字段按合同表达为：workspace、run、artifact、resourceBinding、providerKeyRef、billing/cost summary、release/audit。

Langfuse session/trace 是观测附件，负责 trace/session 可视化、模型调用耗时、usage、debug、错误链路，不是 Portal canonical source，不是 billing truth，不决定余额、扣费、资源状态、文件归属、释放状态。

trace.medopl.cn 是 Langfuse 管理员/运维原生观测台入口。

客户侧 trace 浏览仍在 Portal 的“会话轨迹”页面。

trace.medopl.cn 不是 Portal canonical source，不是 billing truth，不是客户默认 trace 页面。

Runtime Bridge 先清洗，再投递 Langfuse。Langfuse 只接收 sanitized trace/session metadata。Portal 只读取 sanitized projection。

sanitized projection adapter 的输入为 Runtime Bridge 已清洗 metadata + Langfuse trace/session 摘要。

Portal “会话轨迹”展示合并后的业务化摘要，不能把 Langfuse 原始 trace 当成客户默认页面。

Portal 可展示的 Langfuse projection 只能是：

- `traceId`
- `sessionId`
- `runId`
- `status`
- `latencyMs`
- `usage summary`
- `cost estimate`
- `traceUrl`
- `tags`

换成字段摘要即：traceId、sessionId、runId、status、latencyMs、usage summary、cost estimate、traceUrl、tags。

Langfuse 不能保存 raw prompt / raw completion / raw API key / bearer token / launchToken / runtimeToken / objectKey / storageKey / localPath / signedUrl。

Langfuse 部署、ClickHouse、真实 API key、真实 trace source 后续单独授权；当前分支不改 runtime 实现，不接真实 Langfuse。

trace.medopl.cn 的真实部署、Ingress/TLS、Langfuse secret、ClickHouse 等仍需后续单独授权。

## Canonical Metadata

Runtime Bridge canonical metadata 必须保持业务事实闭环：

- `workspace`
- `run`
- `artifact`
- `resourceBinding`
- `providerKeyRef`
- `billing/cost summary`
- `release/audit`

Langfuse 只接收清洗后的 trace/session metadata，不得把用户、账单、文件、资源、审计变成它的真相源。

Langfuse 不能成为用户、账单、文件、资源、审计的真相源。

## Sanitized Projection

Portal 的 sanitized projection 允许保留的字段仅限：

- `traceId`
- `sessionId`
- `runId`
- `status`
- `latencyMs`
- `usageSummary`
- `costEstimate`
- `traceUrl`
- `tags`

projection 中不得出现 raw prompt、raw completion、raw API key、bearer token、launchToken、runtimeToken、objectKey、storageKey、localPath 或 signedUrl。

## Deferred Authorization

以下能力后续单独授权：

- Langfuse 部署
- ClickHouse
- 真实 API key
- 真实 trace source

## Non-goals

- 不改业务代码。
- 不改 Portal UI。
- 不改 Runtime Bridge 实现。
- 不改 Gateway / deploy / `.sentrux` / adapters / one-person-lab upstream。
- 不读取 secret。
- 不调用真实 Langfuse / 真实云 API。
- 不运行 build/push/kubectl/live-test。

<!-- v22-langfuse-observability-metadata-contract:start -->
```json
{
  "contract": "v22_langfuse_observability_metadata_boundary",
  "version": 1,
  "runtimeBridgeCanonicalSource": {
    "canonicalFor": [
      "Portal",
      "Billing",
      "Audit"
    ],
    "metadataResponsibilities": [
      "workspace",
      "run",
      "artifact",
      "resourceBinding",
      "providerKeyRef",
      "billing/cost summary",
      "release/audit"
    ]
  },
  "langfuseObservabilityAttachment": {
    "sourceOfTruth": false,
    "adminConsoleUrl": "https://trace.medopl.cn",
    "customerTraceSurface": "Portal 会话轨迹",
    "customerDefaultLangfuseUi": false,
    "portalCanonicalSource": false,
    "billingTruth": false,
    "responsibleFor": [
      "trace/session 可视化",
      "模型调用耗时",
      "usage",
      "debug",
      "错误链路"
    ],
    "notCanonicalFor": [
      "用户",
      "账单",
      "文件",
      "资源",
      "审计",
      "余额",
      "扣费",
      "资源状态",
      "文件归属",
      "释放状态"
    ]
  },
  "langfuseConsole": {
    "adminConsoleUrl": "https://trace.medopl.cn",
    "customerTraceSurface": "Portal 会话轨迹",
    "customerDefaultLangfuseUi": false,
    "portalCanonicalSource": false,
    "billingTruth": false
  },
  "sanitizationPipeline": {
    "runtimeBridgeSanitizesBeforeLangfuse": true,
    "langfuseReceives": "sanitized trace/session metadata",
    "portalReads": "sanitized projection",
    "adapter": "sanitized projection adapter",
    "adapterInput": "Runtime Bridge 已清洗 metadata + Langfuse trace/session 摘要",
    "portalBusinessSummarySurface": "Portal 会话轨迹"
  },
  "portalSanitizedProjection": {
    "allowedFields": [
      "traceId",
      "sessionId",
      "runId",
      "status",
      "latencyMs",
      "usageSummary",
      "costEstimate",
      "traceUrl",
      "tags"
    ]
  },
  "forbiddenData": [
    "raw prompt",
    "raw completion",
    "raw API key",
    "bearer token",
    "launchToken",
    "runtimeToken",
    "objectKey",
    "storageKey",
    "localPath",
    "signedUrl"
  ],
  "langfusePersistenceForbidden": [
    "raw prompt",
    "raw completion",
    "raw API key",
    "bearer token",
    "launchToken",
    "runtimeToken",
    "objectKey",
    "storageKey",
    "localPath",
    "signedUrl"
  ],
  "deferredAuthorization": [
    "trace.medopl.cn 真实部署",
    "Ingress/TLS",
    "Langfuse secret",
    "Langfuse 部署",
    "ClickHouse",
    "真实 API key",
    "真实 trace source"
  ],
  "nonGoals": [
    "不改业务代码",
    "不改 Portal UI",
    "不改 Runtime Bridge 实现",
    "不改 Gateway / deploy / .sentrux / adapters / one-person-lab upstream",
    "不读取 secret",
    "不调用真实 Langfuse / 真实云 API",
    "不运行 build/push/kubectl/live-test"
  ]
}
```
<!-- v22-langfuse-observability-metadata-contract:end -->
