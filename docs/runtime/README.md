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

Portal canonical truth 是 control-plane store，生产方向是 PostgreSQL。Redis 不是事实源，只能用于 session、cache、queue、lock 或短期协调。Portal 保存账号、用户、工作空间、钱包、冻结金额、账本、审计、resource binding、fileRef/logical index、session/run/artifact/trace metadata 的业务事实。

Runtime / data readiness 必须 fail closed：缺 PostgreSQL/Redis production-mode 连接、schema、Gateway upstream URL、provider binding、Runtime Bridge capability 或明确授权时，返回稳定 gate，不允许 JSON fallback、fake 200 或隐式旧路径。

数据与云控制面真相采用 Portal 内部 operation/job/projection/reconciliation 模型：

- desired state：Portal 中形成的资源、文件空间、计费和释放意图。
- actual state：云资源、runtime、文件空间、账单和审计的实际观测事实。
- reconciled state：Portal 对 desired state 和 actual state 的核对结果、异常、补偿和审计记录。

Object/blob plane 当前仍属本地/过渡实现；后续对象存储只承载文件正文和私有 locator，不成为账本、资源或审计事实源。secret plane、object/blob plane、runtime state plane 仍属本地/过渡实现，不能写成 productionized truth。

OPL Web 用户可见入口必须是 Portal “进入 OPL 工作台”或 `/opl/entry/preflight`。`/internal/opl/auth/login` 只能作为 internal implementation path。旧 v19/v20/v21 OPL direct path、direct upstream path、internal path 不能成为 v22 产品入口。

One Person Lab upstream 只作为 clean upstream reference：

```text
https://github.com/gaofeng21cn/one-person-lab
```

v22 不修改 upstream 源码，不在 upstream 目录写 Portal、Gateway 或 Runtime Bridge 代码，不 import upstream 内部模块。upstream 更新后，平台拉取更新，并通过 OPL Web Gateway、Runtime Bridge / Runtime Agent、公开 API/CLI 和必要的 anti-corruption mapping 适配。

## Backend Convergence Target View

后端收敛目标链路是：

```text
Portal Control Plane
  -> Workflow Boundary
  -> Runtime Broker / OPL Bridge
  -> Agent Runtime
  -> Cloud / Billing / Audit Workers
```

这是一条目标结构边界，不是 production completion claim。当前 local control-plane implementation is Go-owned for lab typed APIs, while OPL Web Gateway 和 Runtime Bridge 仍是 active integration/runtime boundary；`services/portal/src` 只保留尚未迁移的 shell / relay / local eval dependency，不再作为当前 control-plane business truth、长期 backend 或兼容控制面。

当前本地 program 已切到 Go control-plane MVP takeover：`services/medopl-go-backend` 是本地控制面接管目标，`services/portal/src` 是业务 truth 清退对象。这个切换不是 real-cloud readiness 或 production completion claim；它只表示本地 golden path 和 control-plane truth 必须先由 Go 证明，再进入真实云准备。

分层规则：

- Portal Control Plane 只承接用户、workspace、套餐、文件列表、run request、账单/审计查询和状态展示。
- Workflow Boundary 承接长任务 command、state transition、idempotency 和后续 durable engine 替换点。
- Runtime Broker / OPL Bridge 只做 clean upstream OPL、Runtime Bridge / Runtime Agent 和 anti-corruption mapping。
- Agent Runtime 只执行科研任务，不拥有 SaaS product truth、billing ledger、cloud inventory 或 resource lifecycle。
- Cloud / Billing / Audit Workers 只作为内部 worker 边界承接资源计划、计费事件、审计事件和 reconciliation，不暴露为普通用户云控制台。

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

Runtime、Gateway、Portal canonical data truth、PostgreSQL/Redis 方向、object/blob plane、clean upstream 和 no-fake-success 边界由本文、`docs/specs/README.md` 和 source/eval 持有。当前阶段、cursor、blocker 和 verification entry 才看 `docs/active/README.md`。旧分散 architecture truth 不得恢复为当前架构真相入口。
