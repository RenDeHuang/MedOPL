# System Domain x Truth Layer Matrix

本矩阵是 v22 strict monolith 的当前 truth layer 索引。它不新增产品方向，只把 active repo 如何表达系统域和用户真相写清楚。

## Truth Layers

| Truth layer | Active repo 表达 |
| --- | --- |
| 用户真相 / UX truth | Portal 必须让小白用户看懂：买了什么、可以做什么、现在能不能用、如果不能用还缺哪一步、下一步点哪里，以及文件、任务、结果、费用在哪里。 |
| 服务商品真相 / product truth | 用户买的是托管 OPL 科研工作台服务、套餐、计算能力、存储容量和运行环境，不是 CVM、COS、K8s、TKE、节点、桶或云控制台权限。 |
| 交付真相 / delivery truth | 平台兑现服务的动作是开通、隔离、绑定 resourceBinding、计费、审计、释放和停止计费；这些状态必须回到 Portal。 |
| OPL 衔接真相 / OPL connection truth | Portal 不重做 OPL；Portal 与 OPL 的唯一主线衔接命名是 Gateway + Runtime Bridge。Gateway 管入口、preflight、proxy、context；Runtime Bridge 管 session、message、run、file、artifact、providerKeyRef 和 Runtime Agent relay。 |
| 云/资源真相 / cloud-resource truth | 云是平台托管资源池和授权边界；Portal 与云的衔接用 resource binding、billing ledger、readonly inventory、dry-run plan、authorized create-release control plane 表达。普通用户不直接配置云资源。 |
| 运营真相 / ops truth | 管理员和运维看服务状态、异常账单、失败任务、释放失败和审计查询；普通用户不可见全局运维对象。 |
| 风险授权真相 / risk-authorization truth | secret、真实云、deploy、build/push/kubectl、live-test、真实 DB migration 都必须单独授权；默认 active repo 只保留本地合同、smoke 和 future-authorized boundary。 |

## System Domain x Truth Layer

| 系统域 | 承载 truth layer | 当前 active 表达 | 非目标 |
| --- | --- | --- | --- |
| Portal | 用户真相 / UX truth；服务商品真相 / product truth；交付真相 / delivery truth；运营真相 / ops truth；风险授权真相 / risk-authorization truth | Portal 是 SaaS control plane。它表达用户买到的托管 OPL 科研工作台、套餐、计算能力、存储容量、运行环境、工作空间、文件、任务、结果、费用、余额、预扣费、冻结金额、释放、停止计费和审计状态。 | Portal 不是云资源控制台，不重做 OPL chatbot，不让普通用户配置 CVM/COS/K8s/TKE。 |
| Portal 与 OPL 的衔接 | OPL 衔接真相 / OPL connection truth；用户真相 / UX truth；风险授权真相 / risk-authorization truth | Gateway + Runtime Bridge 是唯一主线命名。Gateway 提供 OPL entry/preflight/proxy/context；Runtime Bridge 提供 session bind、message、run、file、artifact、providerKeyRef 和 Runtime Agent relay。 | 不保留 Portal OPL Adapter、OPL Adapter、legacy redirect、compat alias 或旧 `/portal-adapter` 解释。 |
| Portal 与云的衔接 | 交付真相 / delivery truth；云/资源真相 / cloud-resource truth；运营真相 / ops truth；风险授权真相 / risk-authorization truth | 使用 resourceBinding、billing ledger、readonly inventory、dry-run plan、authorized create-release control plane 表达平台如何开通、隔离、计费、审计、释放和停止计费。 | 不把 cloud console、resource-order、user-owned、old provisioner、OpenCost 默认叙事或 deploy/adapters/infra 当 active context。 |
| 云 | 云/资源真相 / cloud-resource truth；交付真相 / delivery truth；风险授权真相 / risk-authorization truth | 云是平台托管资源池和授权边界。真实云操作、真实部署、真实 DB migration 和 live-test 只在未来单独授权后执行并写入 evidence。 | 普通用户不直接操作云资源；默认 repo 不保留可执行 deploy/live/canary runner。 |
| OPL | OPL 衔接真相 / OPL connection truth；用户真相 / UX truth；风险授权真相 / risk-authorization truth | OPL 是 clean upstream One Person Lab，负责 chatbot、agent、科研执行、文件理解、结果生成和工作台内交互体验。Portal 只通过 Gateway + Runtime Bridge 带入上下文并接收 session/run/artifact/trace/billing metadata projection。 | 不修改 upstream，不 import upstream 内部模块，不把 Portal/Gateway/Runtime Bridge 代码写入 upstream。 |

## Ideal State

- Portal 对小白用户说清买了什么、可以做什么、现在能不能用、如果不能用还缺哪一步、下一步点哪里，文件、任务、结果、费用在哪里。
- Portal 同时表达交付真相：平台如何开通、隔离、绑定 resourceBinding、计费、审计、释放和停止计费。
- Gateway + Runtime Bridge 是 Portal 与 OPL 的唯一主线衔接命名。
- Portal 与云的衔接只用 resource binding、billing ledger、readonly inventory、dry-run plan、authorized create-release control plane。
- 云是平台托管资源池，不是普通用户入口。
- OPL 是 clean upstream 科研执行工作台。

## Current After Cleanup

- active code 已迁到 Runtime Bridge client、Runtime Bridge state root、Runtime Bridge contract field 和 `/runtime-bridge` proxy path。
- legacy redirect route 和 `/portal/tasks/*` 旧公开入口从 active route wiring 中清退；workspace 操作入口是 `/portal/workspaces/*`。
- Runtime Bridge 旧 `managed_runtime` mode、`runtime-bridge-managed-runs.mjs` 和 Adapter 命名已从 active Runtime Bridge / Portal-OPL 合同入口清退；普通 v22 smoke 变量名也使用 Runtime Bridge 语义。
- non-v22 OPL smoke 已删除或迁名为 `tests/**/*.mjs`，旧 `/portal/app/*` redirect、旧 `/portal/tasks/*` 入口和 `task-space.routes.mjs` 已从 active route wiring 清退。
- Adapter、legacy redirect、task-space、deploy/adapters/infra/live/canary 只能作为已删除、不得恢复或 future-authorized boundary 记录存在。
