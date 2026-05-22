# Product Truth

Owner: `MedOPL`
Purpose: `product_truth_view`
State: `hard_compacted_view`
Machine boundary: 本文是产品视角入口，不是第二份 current truth。当前唯一人读 current truth 是 `docs/active/README.md`；本文件只保产品语言、用户体验和合同分组索引。

## Product View

MedOPL v22 是 One Person Lab 的 SaaS 控制面和托管交付平台：用户购买托管 OPL 科研工作台服务、计算能力、文件空间、任务并发和运行环境。Portal 解释服务、状态、余额、文件、账单和轨迹；OPL 继续负责科研执行和工作台内交互。

MedOPL 不是云资源控制台。普通用户产品语言不展示 CVM、COS、K8s、节点池或云控制台配置。管理员 / ops 是后台视角，不进入普通用户产品主叙事。

## Commercial Package Model

商业化主链路的客户视角是：谁都可以进入 OPL；需要平台托管计算、文件空间、隔离环境、计费和审计时，必须进入 MedOPL。MedOPL 销售的是托管 OPL 科研工作台服务和平台代管的运行能力，不销售云控制台配置权。

当前收敛后的三层商业模型：

- `api_only`: 账号、工作空间、OPL 入口、用户自己的 gflabtoken providerKeyRef、文件/任务/结果索引；不购买平台托管算力。
- `full_runtime`: 在 `api_only` 之上购买平台托管计算、文件空间、任务并发、余额/冻结金额、run/artifact/trace 回流和释放停止计费。
- `customer_dedicated`: 在 `full_runtime` 之上购买更强隔离、专属运行边界、专属审计标签和人工审批/变更窗口。

客户判断标准：

- 只需要进入 OPL 和保留工作空间上下文：`api_only`。
- 需要上云计算、托管文件空间、平台计费审计和释放：`full_runtime`。
- 需要客户级隔离、合规审计、专属资源边界和变更审批：`customer_dedicated`。

## Product Contract Groups

| Product question | Spec anchors |
| --- | --- |
| MVP 用户闭环、开户、充值、进入 Portal/OPL、释放和审计 | [spec:v22-mvp-managed-opl-loop](../specs/README.md#spec-v22-mvp-managed-opl-loop), [spec:v22-user-credit-provider-key-boundary](../specs/README.md#spec-v22-user-credit-provider-key-boundary) |
| Portal 是 SaaS 控制面，不是科研 chatbot 或云控制台 | [spec:v22-saas-control-plane-user-experience-boundary](../specs/README.md#spec-v22-saas-control-plane-user-experience-boundary), [spec:v22-saas-portal-opl-ops-surface-boundary](../specs/README.md#spec-v22-saas-portal-opl-ops-surface-boundary) |
| 套餐、计算资源、文件空间、任务并发和用户可见语言 | [spec:v22-resource-plan-boundary](../specs/README.md#spec-v22-resource-plan-boundary), [spec:v22-managed-environment-open-boundary](../specs/README.md#spec-v22-managed-environment-open-boundary), [spec:v22-tenant-resource-binding-boundary](../specs/README.md#spec-v22-tenant-resource-binding-boundary) |
| 商业化套餐分层、OPL 入口和 MedOPL 托管算力 gate | [spec:v22-commercial-package-model](../specs/README.md#spec-v22-commercial-package-model), [spec:v22-saas-control-plane-user-experience-boundary](../specs/README.md#spec-v22-saas-control-plane-user-experience-boundary) |
| 余额、冻结金额、停止计费、`120min` 核对和 `T+1` 审计 | [spec:v22-billing-freeze-boundary](../specs/README.md#spec-v22-billing-freeze-boundary), [spec:v22-release-stop-billing-audit-boundary](../specs/README.md#spec-v22-release-stop-billing-audit-boundary), [spec:v22-pricing-snapshot-boundary](../specs/README.md#spec-v22-pricing-snapshot-boundary) |
| OPL 入口、用户自带 gflabtoken provider key、providerKeyRef 和 raw key 禁泄露 | [spec:v22-token-provider-boundary](../specs/README.md#spec-v22-token-provider-boundary), [spec:v22-opl-entry-preflight-auth-boundary](../specs/README.md#spec-v22-opl-entry-preflight-auth-boundary), [spec:v22-portal-opl-connection-boundary](../specs/README.md#spec-v22-portal-opl-connection-boundary) |
| 文件、账单、session trace metadata、run/artifact 回流 | [spec:v22-portal-files-billing-trace-boundary](../specs/README.md#spec-v22-portal-files-billing-trace-boundary), [spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary](../specs/README.md#spec-v22-runtime-bridge-session-run-file-provider-keyref-boundary), [spec:v22-trace-metadata-boundary](../specs/README.md#spec-v22-trace-metadata-boundary) |
| 管理台和普通用户边界 | [spec:v22-portal-user-surface-boundary](../specs/README.md#spec-v22-portal-user-surface-boundary), [spec:v22-portal-admin-ops-surface-boundary](../specs/README.md#spec-v22-portal-admin-ops-surface-boundary), [spec:v22-admin-ops-console-boundary](../specs/README.md#spec-v22-admin-ops-console-boundary) |

## Current Truth Pointer

产品当前事实、资源生命周期、套餐、用户自带 gflabtoken provider key、7 天保护期、`120min` 和 `T+1` 审计口径统一见 `docs/active/README.md`。旧分散 product truth 不得恢复为当前产品真相入口。
