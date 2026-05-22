# Runtime Truth

Owner: `MedOPL`
Purpose: `runtime_truth_view`
State: `hard_compacted_view`
Machine boundary: 本文是 runtime 视角入口，不是第二份 current truth。当前唯一人读 current truth 是 `docs/active/README.md`；Runtime Bridge / Gateway 行为由 source、contracts、local eval 和授权 canary evidence 裁定。

## Runtime View

Runtime 主链路是：

```text
Portal -> OPL Web Gateway -> clean One Person Lab upstream
  -> Runtime Bridge / Runtime Agent
  -> platform-managed TKE/storage resource pools
  -> Billing/Quota/Audit/Admin
```

One Person Lab upstream 必须保持 clean。Portal/Gateway/Runtime Bridge 不修改 upstream、不 import upstream 内部模块、不依赖 upstream DOM/store/database schema/internal session model。

Runtime Bridge 负责 session/message/run/file/artifact/provider route/providerKeyRef/trace projection，不是 cloud inventory truth，也不是 billing ledger truth。Real OPL canary 是验证链路，不是 production completion claim。OPL workbench entry 与 managed run 是两道 gate；entry 负责账号、工作空间、Gateway/upstream entry 和用户自己的 gflabtoken provider binding，managed run 再检查托管 runtime、文件空间、余额、`providerKeyRef` 和 Runtime Bridge。

## Runtime Contract Groups

| Runtime question | Spec anchors |
| --- | --- |
| Portal 到 OPL 工作台入口、preflight、launch 和 Gateway 反腐层 | [spec:v22-portal-opl-connection-boundary](../specs/README.md#spec-v22-portal-opl-connection-boundary), [spec:v22-opl-entry-preflight-auth-boundary](../specs/README.md#spec-v22-opl-entry-preflight-auth-boundary), [spec:v22-saas-portal-opl-ops-surface-boundary](../specs/README.md#spec-v22-saas-portal-opl-ops-surface-boundary) |
| clean upstream OPL 边界，不修改 upstream，不 import 内部模块 | [spec:v22-upstream-opl-boundary](../specs/README.md#spec-v22-upstream-opl-boundary) |
| message/file/run/artifact/provider route/providerKeyRef/session trace 集成边界 | [spec:v22-opl-work-message-file-run-boundary](../specs/README.md#spec-v22-opl-work-message-file-run-boundary), [spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary](../specs/README.md#spec-v22-runtime-bridge-session-run-file-provider-keyref-boundary), [spec:v22-portal-opl-context-backflow-boundary](../specs/README.md#spec-v22-portal-opl-context-backflow-boundary) |
| token、raw key、launch/runtime token 和浏览器存储禁区 | [spec:v22-token-provider-boundary](../specs/README.md#spec-v22-token-provider-boundary), [spec:v22-user-credit-provider-key-boundary](../specs/README.md#spec-v22-user-credit-provider-key-boundary) |
| Portal canonical data truth、文件/账单/trace projection | [spec:v22-portal-files-billing-trace-boundary](../specs/README.md#spec-v22-portal-files-billing-trace-boundary), [spec:v22-trace-metadata-boundary](../specs/README.md#spec-v22-trace-metadata-boundary) |
| 真实 OPL canary 只证明能力发现，不等于 production completion | [spec:v22-real-opl-capability-canary-boundary](../specs/README.md#spec-v22-real-opl-capability-canary-boundary), [spec:v22-real-opl-provider-message-canary-boundary](../specs/README.md#spec-v22-real-opl-provider-message-canary-boundary), [spec:v22-real-opl-file-run-artifact-canary-boundary](../specs/README.md#spec-v22-real-opl-file-run-artifact-canary-boundary) |
| cloud/deploy/runtime release 的授权顺序 | [spec:v22-cloud-onboarding-workflow-boundary](../specs/README.md#spec-v22-cloud-onboarding-workflow-boundary), [spec:v22-production-cloud-topology-boundary](../specs/README.md#spec-v22-production-cloud-topology-boundary), [spec:v22-authorized-tencent-deploy-execution-boundary](../specs/README.md#spec-v22-authorized-tencent-deploy-execution-boundary) |

## Current Truth Pointer

Runtime 当前事实、Portal canonical data truth、PostgreSQL/Redis 方向、object/blob plane、clean upstream 和 no-fake-success 边界统一见 `docs/active/README.md`。旧分散 architecture truth 不得恢复为当前架构真相入口。
