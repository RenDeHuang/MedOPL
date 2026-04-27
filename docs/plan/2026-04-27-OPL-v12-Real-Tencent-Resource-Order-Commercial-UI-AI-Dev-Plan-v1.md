# OPL v12 真实腾讯云资源订单与商业化 UI AI 开发文档 v1

日期：2026-04-27  
目标版本：`opl-v12`  
基线版本：`opl-v11`

## 目标

v12 的目标是把 v11 的“云状态可见”推进成“客户可选择服务器、可看到真实腾讯云报价、可创建订单独立 TKE 节点池、可追踪真实资源与账单”的商业化内测版。

本版本不做支付网关。充值仍由线下转账和管理员入账完成。系统必须真实展示云接入状态，不能在缺少 Secret、TKE 权限、镜像 ID 或账单明细时伪造成已开通、已报价或已结算。

## 顶层原则

模块内高聚合，模块间低耦合：

- Portal 是 SaaS 控制面：用户、钱包、Resource Order、商业 UI、工作台入口。
- Billing Aggregator 是账单聚合面：腾讯云报价、真实账单、COS 日对账、账单归因。
- Resource Provisioner / Cloud Inventory 是资源开通面：TKE/CVM 查询、节点池创建、缩容、删除、状态回填。
- Runner / Orchestrator 是执行面：只创建 Job、打资源标签、传递 `resource_order_id`。
- Gateway 是身份桥接面：只负责 Portal 身份到 OPL Web 的登录桥接。

明确禁止：

- Portal 不直连腾讯云 Secret。
- Billing 不登录用户、不改订单状态。
- Resource Provisioner 不扣费。
- Runner 不扣费。
- Gateway 不读 Portal DB。

## 固定云参数

本版本按用户提供的硅谷环境定制：

- Region：`na-siliconvalley`
- Zone：`na-siliconvalley-1`
- TKE Cluster：`cls-ngiq693i`
- Namespace：`opl-system`
- VPC：`vpc-ahl6epyx`
- Subnet：`subnet-mbehh5wi`、`subnet-r8mzuptu`
- Security Group：`sg-6671l5we`
- COS 账单 bucket：`opl-1410708315`
- COS 账单 prefix：`daily/`
- 分摊标签：`resource_order_id`、`run_id`、`server_plan_id`、`tenant_id`、`workspace_id`

不写入文档、代码、YAML、镜像、日志摘要的内容：

- 腾讯云账号密码
- `SecretId`
- `SecretKey`
- 可复用登录链接

## 商业化行为

客户在 Portal 的“服务器与费用”页选择规格。初版可售规格：

- `cpu-2c4g`
- `cpu-4c8g`
- `cpu-8c16g`
- `cpu-16c32g`

价格来自腾讯云实时询价或明确的腾讯云错误状态。冻结金额按“小时价 × 最小计费小时 × 风险系数”和平台保底金额计算。最终 exact cost 只能来自腾讯云 `DescribeBillDetail` 或 COS 账单文件。

每个订单独立 TKE 节点池：

- 默认 `minNodes=0`
- 默认 `maxNodes=2`
- 允许缩容到 0
- 允许删除节点池
- 删除时必须让用户选择是否同时销毁 CVM，并明确说明后果

删除节点池提示标准：

- 选择销毁 CVM：节点池内实例会被释放，运行环境和节点本地数据不可恢复。
- 选择保留 CVM：节点池删除后实例仍可能继续产生云资源费用。

## 需要实现

### Billing Aggregator

- 完善 `GET /cloud/status`。
- 完善 `GET /server-plans`，默认提供硅谷四档 CPU 白名单。
- 新增 `GET /billing/cos/status`，展示 COS 账单投递配置状态。
- 新增 `GET /billing/attribution?resourceOrderId=...`，返回账单归因、缺标签资源和 required tags。
- 无腾讯云 Secret 时返回明确 not configured 状态，不伪造价格和账单。

### Resource Provisioner / Cloud Inventory

- 新增 `GET /cloud/resources`，聚合 TKE 节点池、CVM 实例、标签完整度。
- 新增 `GET /cloud/node-pools`。
- 新增 `GET /cloud/instances`。
- 完善 `POST /resource-orders/ensure-capacity`，支持订单独立节点池。
- 新增 `POST /resource-orders/scale-to-zero`。
- 新增 `POST /resource-orders/delete-node-pool`，必须要求确认字段。

### Portal

- 新增 `GET /portal/api/cloud/resources`，只透传 Resource Provisioner 的脱敏结果。
- 新增 `POST /portal/api/resource-orders/provision`。
- 新增 `POST /portal/api/resource-orders/release`。
- 新增 `POST /portal/api/resource-orders/delete-node-pool`。
- 总览页保留商业指标，不做说明书式文案。
- 服务器页改成“选规格 + 看价格 + 下订单 + 看资源状态”的操作台。

### Runtime Chain

- Run 前通过 Portal 创建/冻结 Resource Order。
- Portal 调 Resource Provisioner 准备资源。
- Runner 创建 Job 时继续带标签：
  - `tenant_id`
  - `workspace_id`
  - `run_id`
  - `resource_order_id`
  - `server_plan_id`

## 测试标准

后端：

- `node --check` 覆盖 Portal、Billing、Resource Provisioner、Gateway、Runtime Bridge。
- `smoke-test-billing-v12-cos-attribution.mjs`
- `smoke-test-resource-provisioner-v12-contract.mjs`
- 继续通过 v10/v11 的 Resource Order、冻结账本、exact-only settlement、Gateway login smoke。

前端：

- `npm --prefix services/portal run frontend:typecheck`
- `npm --prefix services/portal run frontend:build`
- 浏览器验证总览、服务器与费用、订单创建、节点池删除确认弹窗、工作台入口。

真实腾讯云联调：

- 无 Secret：必须显示未接入。
- 有 Secret：能读 TKE 节点池、CVM 实例、COS 账单状态。
- `RESOURCE_PROVISIONING_ENABLED=0`：只能只读，不能创建或删除节点池。
- `RESOURCE_PROVISIONING_ENABLED=1`：才允许真实节点池生命周期操作。

## 交付标准

v12 达标条件：

- Portal UI 像商业控制台，不像说明文档。
- 客户能看到四档 CPU 规格、价格来源、冻结金额、账单来源。
- 客户能看到真实云资源状态和标签完整度。
- Resource Order 能走到 `quoted -> frozen -> provisioning`。
- 开通成功后能回填 `nodePoolId` 或腾讯云 request id。
- 没有真实腾讯云账单时不做 exact 扣费。
- Secret 不进入 git、文档、YAML、镜像、日志摘要。

## 仍未完成的正式商业化缺口

- 真实支付充值入口。
- 一等租户/组织/角色隔离。
- Postgres/Redis/COS/CFS 生产迁移。
- 大规模节点池策略和配额治理。
- 完整失败回滚和人工处理队列。
- CloudAudit 审计闭环。
- 生产 OIDC、KMS、Secret Manager 完整治理。
