# Product Truth

Owner: `MedOPL`
Purpose: `product_truth`
State: `taxonomy_skeleton`
Machine boundary: 本文是人读产品真相摘要。当前长期合同仍在 `docs/contracts/README.md` 和 `docs/contracts/v22-*`，旧产品真相入口 `docs/product.md` 在引用迁移前继续保留。

## Product

MedOPL v22 是 One Person Lab 的 SaaS 控制面和托管交付平台。用户购买的是托管 OPL 科研工作台服务、计算能力、存储容量、任务并发和运行环境，不是云资源控制台对象。

## User Experience Truth

Portal 必须让用户看懂：

- 买了什么托管服务。
- 当前能不能使用 OPL 工作台。
- 还缺哪一步：余额、套餐、文件空间、运行环境、provider key 或释放状态。
- 下一步点哪里。
- 文件、任务、结果、费用和 trace 在哪里。

OPL 继续负责 chatbot、agent、科研任务执行、文件理解、结果生成和工作台内交互体验。

## Surface Boundary

- 普通用户 Portal 登录不输入 gflabtoken API Key。
- 用户从 Portal “进入 OPL 工作台”或 `/opl/entry/preflight` 输入或确认 provider key。
- 管理员 / ops 是后台视角，不进入普通用户产品主叙事。
- 普通用户产品语言不展示 CVM、COS、K8s、节点池或云控制台配置。

## Current Source Files

- `docs/product.md`
- `docs/contracts/v22-mvp-managed-opl-loop.md`
- `docs/contracts/v22-saas-control-plane-user-experience-boundary.md`
- `docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md`
- `docs/contracts/v22-portal-user-surface-boundary.md`
- `docs/contracts/v22-portal-admin-ops-surface-boundary.md`

## Migration Status

本 README 是目标 product truth skeleton。旧 `docs/product.md` 和相关 contracts 本轮不删除；后续分支必须先改脚本和文档引用，再把正文吸收到本 README。

