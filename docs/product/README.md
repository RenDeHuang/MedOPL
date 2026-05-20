# Product Truth

Owner: `MedOPL`
Purpose: `product_truth_view`
State: `hard_compacted_view`
Machine boundary: 本文是产品视角入口，不是第二份 current truth。当前唯一人读 current truth 是 `docs/active/README.md`；本文件只保产品语言、用户体验和合同分组索引。

## Product View

MedOPL v22 是 One Person Lab 的 SaaS 控制面和托管交付平台：用户购买托管 OPL 科研工作台服务、计算能力、文件空间、任务并发和运行环境。Portal 解释服务、状态、余额、文件、账单和轨迹；OPL 继续负责科研执行和工作台内交互。

MedOPL 不是云资源控制台。普通用户产品语言不展示 CVM、COS、K8s、节点池或云控制台配置。管理员 / ops 是后台视角，不进入普通用户产品主叙事。

## Product Contract Groups

- `docs/contracts/v22-mvp-managed-opl-loop.md`
- `docs/contracts/v22-saas-control-plane-user-experience-boundary.md`
- `docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md`
- `docs/contracts/v22-portal-user-surface-boundary.md`
- `docs/contracts/v22-portal-admin-ops-surface-boundary.md`
- `docs/contracts/v22-pricing-snapshot-boundary.md`
- `docs/contracts/v22-billing-freeze-boundary.md`

## Current Truth Pointer

产品当前事实、资源生命周期、套餐、gflabtoken、7 天保护期、`120min` 和 `T+1` 审计口径统一见 `docs/active/README.md`。旧 `docs/recovery/product-truth.md` 已被吸收到 current truth，不得恢复为当前产品真相入口。
