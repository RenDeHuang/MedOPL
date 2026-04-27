# OPL 正式商业化生产缺口与开发计划 v1

日期：2026-04-27  
当前版本基线：`opl-v10`  
当前判断：`opl-v10` 已具备商业化内测能力，但还不是正式生产级多租户 SaaS。

## 顶层原则

系统继续坚持“模块内高聚合、模块间低耦合”：

- Portal 是 SaaS 控制面：用户、租户、组织、角色、钱包、订单、商业化 UI。
- Billing Aggregator 是计费归因面：腾讯云报价、真实账单、COS 日账单、pending/exact/unattributed。
- Resource Provisioner 是资源开通面：TKE 节点池/容量开通、异步状态、失败回滚。
- Runtime Bridge 是运行上下文桥：run 前准备订单，透传 `resourceOrderId`。
- Runner / Orchestrator 是执行面：只创建 Job、挂载存储、打标签，不扣费。
- Gateway 是入口面：Portal 身份到 OPL Web 的桥接，不读 Portal DB。
- OPL Web 是工作台：任务空间、session、trace、文件操作入口，不成为身份源和账务源。

任何后续开发都不能破坏这些边界：Portal 不直连腾讯云 Secret；Runner 不扣费；Billing 不登录用户；Gateway 不读 Portal DB。

## 当前已经具备的能力

- Portal 注册/登录、本地账号进入 Portal。
- OPL Gateway 支持 Portal launch token SSO 和 OPL 原生登录桥接。
- Resource Order 初版状态机：`quoted -> frozen -> provisioning -> running -> released -> reconciling -> settled`，失败进入 `failed`，取消进入 `cancelled`。
- Wallet / Ledger 初版：`freeze_hold`、`freeze_release`、`resource_charge`、`refund`、`makeup_charge`。
- Billing Aggregator 已区分 `pending`、`exact`、`unattributed`。
- OpenCost 只作为 pending，不作为最终真实扣费。
- Runner/Job 已透传 `resource_order_id`。
- Portal 已有“服务器与费用”页面，能展示服务器规格、报价来源、冻结金额和订单状态。
- Resource Provisioner 已有 TKE 调用边界，但默认不会在没有真实凭证/开通 payload 时伪造成功。

## 正式商业化还缺什么

### 1. 真实支付充值入口

现状：

- Portal 有钱包、充值记录、管理员手工充值/调整。
- 还没有面向客户的真实支付链路。

缺口：

- 支付渠道：微信支付、支付宝、Stripe、银行转账或对公充值。
- 支付订单状态机：`created -> pending_payment -> paid -> credited -> failed -> refunded`。
- 支付回调验签。
- 充值到账后自动写入不可变 ledger。
- 发票/收据/企业抬头。
- 退款流程和审计。

为什么必须做：

- 正式 SaaS 不能依赖管理员手工充值。
- 预扣费和余额不足拦截必须有自动补款入口。

开发方向：

- Portal 内新增 `payments` 模块。
- Payment Provider 只通过 provider adapter 接入，不把支付细节散落在 Portal 路由里。
- Ledger 只接受已验签的支付结果。
- 支付失败不影响 Portal 登录和工作台进入，只影响收费 run。

验收标准：

- 用户可创建充值订单。
- 支付回调验签成功后钱包自动入账。
- 重复回调不重复入账。
- 退款/撤销能留下完整 ledger 和 audit trail。

### 2. 生产级租户 / 组织 / 角色隔离

现状：

- 当前更像“一个用户默认一个 tenant”的内测模型。
- 角色主要是 admin/user。
- 已有一些 group/policy，但还不是完整 B2B 多租户。

缺口：

- Tenant：租户主体、租户钱包、租户账单、租户资源边界。
- Organization：企业/团队。
- Membership：用户加入组织和租户。
- Role：owner、admin、billing_admin、workspace_admin、member、viewer。
- Workspace 隔离：每个 workspace 必须属于 tenant。
- Run 隔离：每个 run 必须带 `tenant_id`、`workspace_id`、`resource_order_id`。
- 存储隔离：目录、对象存储 bucket/prefix、CFS 目录权限。
- 管理隔离：管理员只能看自己租户，平台超级管理员另设。

为什么必须做：

- 正式 SaaS 不是个人 demo。企业客户需要团队协作、账单管理员、只读审计、成员权限。
- 没有一等 tenant，会导致账单、存储、运行资源归因混乱。

开发方向：

- Portal 内新增一等 `tenants`、`organizations`、`memberships`、`roles`。
- 所有用户请求从 session 解析出 activeTenantId。
- 所有 workspace、resourceOrder、ledger、run、storage 记录强制带 tenantId。
- Billing Aggregator 只按标签/账单明细归因，不猜测 tenant。
- Runner Job 标签必须固定包含 `tenant_id`、`workspace_id`、`run_id`、`resource_order_id`。

验收标准：

- A 租户看不到 B 租户用户、workspace、账单、run、trace、文件。
- billing_admin 能充值/看账单，但不能管理工作区代码。
- viewer 只能看，不可启动 run。
- 平台管理员操作有审计记录。

### 3. Postgres / Redis / COS / CFS 生产存储迁移

现状：

- 本地和快速上线阶段仍大量使用 `.runtime` JSON 文件和一个 PVC。
- 这适合内测和上线简化，不适合生产长期运行。

缺口：

- Postgres：用户、租户、组织、workspace、orders、ledger、audit、billing cursor。
- Redis：session、launch token、短期 state、幂等锁。
- COS：用户输入、输出、artifact、trace 附件、账单文件归档。
- CFS：运行时共享工作目录、需要 POSIX 语义的 workspace 文件。
- 数据迁移脚本：从 `.runtime` JSON/PVC 迁移到正式存储。
- 备份恢复策略：Postgres 备份、COS 版本控制、CFS 快照。

为什么必须做：

- 一个 PVC 包所有内容无法支撑租户隔离、迁移、备份、恢复、合规审计。
- JSON 文件不适合并发写入和生产一致性。

开发方向：

- Portal Store 抽象正式拆成 `json-store` 和 `postgres-store`。
- Runtime state 从文件迁到 Redis/Postgres。
- 文件类内容按 `tenant_id/workspace_id/run_id` 目录合同写入 COS/CFS。
- 写清楚目录合同：
  - `portal/`：Portal 临时本地状态，仅开发/迁移期使用。
  - `workspaces/{tenant_id}/{workspace_id}/inputs`
  - `workspaces/{tenant_id}/{workspace_id}/outputs`
  - `runs/{tenant_id}/{workspace_id}/{run_id}`
  - `billing/raw/tencent/{yyyy-mm-dd}`
  - `audit/{tenant_id}/{yyyy-mm}`

验收标准：

- 关闭 JSON store 后 Portal 正常运行。
- 重启服务 session 不丢失。
- 同租户 workspace 文件可访问，跨租户不可访问。
- COS/CFS 路径带 tenant/workspace/run 维度。

### 4. TKE 开通后的异步状态回填和失败回滚

现状：

- Resource Provisioner 已有 TKE 调用边界。
- 本地没有真实 `TENCENT_TKE_CLUSTER_ID`、`nodePoolCreatePayload` 和权限，所以不能实际创建节点池。

缺口：

- Resource Provisioner 需要异步 worker。
- 开通任务状态：`accepted -> creating -> ready -> failed -> rollback_started -> rolled_back`。
- TKE `CreateClusterNodePool` / `ModifyClusterNodePool` 返回后要轮询真实状态。
- 开通失败要释放 freeze 或进入人工处理队列。
- 创建成功要回填 nodePoolId、clusterId、resourceIds。
- 超时策略、重试策略、幂等 key。

为什么必须做：

- 云资源开通不是同步动作，不能点击后假装成功。
- 失败不回滚会冻结用户余额、浪费平台资源、造成客服问题。

开发方向：

- Resource Provisioner 内新增 async provisioning worker。
- Portal Resource Order 只存订单状态，不直接调用腾讯云。
- Provisioner 回调 Portal internal API：
  - `mark-provisioning`
  - `mark-ready`
  - `mark-failed`
  - `rollback-started`
  - `rollback-completed`
- Runner 只有在 order ready 或可调度策略满足后才创建 Job。

验收标准：

- 缺少 `nodePoolCreatePayload` 时返回明确不可开通，不创建 run。
- TKE 创建成功后订单进入 ready/running。
- TKE 创建失败后订单进入 failed，冻结金额释放或转人工处理。
- 重复提交不会创建多个节点池。

### 5. 账单 COS 日对账

现状：

- Billing Aggregator 可以查询 Tencent `DescribeBillDetail`。
- 已实现 exact-only 原则：没有真实账单不 exact 扣费。

缺口：

- COS 日账单文件拉取/解析。
- 对账 cursor。
- 未归因账单 `unattributed` 队列。
- 日终对账报表。
- 账单和 ledger 差异处理。
- 退款/补扣审核流。

为什么必须做：

- API 查询适合近实时补账，但正式财务对账要依赖每日账单文件。
- 腾讯云账单有延迟，必须支持 T+1 对账。

开发方向：

- Billing Aggregator 新增 `cos-bill-importer`。
- 每日 CronJob 拉取 COS 账单文件。
- 账单行按标签归因：`tenant_id`、`workspace_id`、`run_id`、`resource_order_id`。
- 没有完整标签的账单进入 unattributed，不进入自动扣费。
- exact bill 进入 Portal ledger 的唯一入口是 settlement API。

验收标准：

- 同一天账单重复导入不重复扣费。
- 无标签账单进入 unattributed。
- 有标签账单能结算到正确 tenant/workspace/run/order。
- 日终报表显示云成本、用户扣费、平台毛利/差额。

### 6. 资源回收 / 停机策略

现状：

- Runner 能创建 Job。
- Resource Order 有 release 概念。
- 但还没有完整资源生命周期治理。

缺口：

- 空闲 workspace 自动休眠。
- run 完成后释放临时资源。
- 节点池缩容/删除策略。
- 余额不足运行中提醒/停止策略。
- 最大运行时长。
- GPU 资源回收。
- 租户级并发上限。

为什么必须做：

- 老板最担心的是钱。没有自动回收，云成本会失控。

开发方向：

- Resource Provisioner 增加 recycler worker。
- Portal 增加策略配置：
  - idleTimeoutMinutes
  - maxRunHours
  - lowBalanceStopThreshold
  - maxConcurrentRuns
  - autoReleaseNodePool
- Runner 上报 run 状态。
- Billing Aggregator pending 成本接近 freeze 时触发告警或停止。

验收标准：

- run 完成后资源订单进入 released/reconciling。
- 空闲超过策略自动回收。
- 余额不足不能启动新 run。
- 运行中余额逼近阈值能停止或提醒。

### 7. 生产 OIDC / 密钥管理 / 审计

现状：

- 本地默认 local identity。
- Gateway 已支持 Portal 身份桥接。
- 有基本 audit event。

缺口：

- 生产 OIDC IdP：Zitadel/Auth0/Keycloak/企业微信/飞书等。
- OIDC client secret 管理。
- 腾讯云 Secret 管理。
- 支付渠道 secret 管理。
- K8s Secret / Tencent Secret Manager / Vault。
- 管理员操作审计。
- 登录审计、支付审计、账单审计、资源开通审计。
- 密钥轮换。

为什么必须做：

- 正式 SaaS 不能把默认 secret、云密钥、支付密钥散落在 env 示例或日志里。
- 多租户产品必须能追踪“谁在什么时候做了什么”。

开发方向：

- 生产使用 OIDC，local auth 只作为开发/紧急模式。
- Secret 只进 K8s Secret 或 Secret Manager。
- 日志脱敏。
- Audit Event 标准化：
  - actorTenantId
  - actorUserId
  - action
  - targetType
  - targetId
  - requestId
  - ip
  - userAgent
  - result
- 高风险操作二次确认。

验收标准：

- 生产环境默认拒绝弱 secret。
- 密钥不出现在镜像、git、日志、前端 payload。
- 所有充值、扣费、开通、删除、角色变更有审计。

## 你需要准备什么

### 腾讯云真实报价与账单

必须准备：

- `TENCENT_CLOUD_SECRET_ID`
- `TENCENT_CLOUD_SECRET_KEY`
- 如使用临时凭证，还需要 `TENCENT_CLOUD_TOKEN`
- `TENCENT_CLOUD_REGION`，例如 `ap-guangzhou`
- CVM 询价用镜像 ID：`TENCENT_PRICE_IMAGE_ID`
- 可售规格目录：
  - region
  - zone
  - instanceType
  - CPU/GPU/内存
  - systemDisk/dataDisks
  - minBillableHours
  - riskFactor
  - reservationFloor
  - provisioningMode
- Billing 权限：
  - `DescribeBillDetail`
  - 账单 COS 文件读取权限
- 标签规范：
  - `tenant_id`
  - `workspace_id`
  - `run_id`
  - `resource_order_id`
  - `server_plan_id`

### TKE 节点池开通

必须准备：

- `TENCENT_TKE_CLUSTER_ID`
- TKE API 权限：
  - `CreateClusterNodePool`
  - `ModifyClusterNodePool`
  - `DescribeClusterNodePools`
  - `DeleteClusterNodePool` 或缩容权限
- 每个可售规格的 `nodePoolCreatePayload`
- 每个可售规格的 `nodePoolScalePayload`
- 节点池命名规则。
- 是否允许每个 tenant 独立节点池，还是共享可售节点池。
- 节点池回收策略。

### 支付

必须准备：

- 选择支付渠道。
- 商户号、AppId、API key、证书。
- 支付回调域名。
- 退款权限。
- 发票/税务规则。
- 平台服务费规则：
  - 云资源原价透传
  - 平台加价比例
  - 固定服务费
  - 免费试用额度

### 生产存储

必须准备：

- Postgres 地址、账号、数据库名、备份策略。
- Redis 地址、密码、TLS 策略。
- COS bucket、region、访问策略。
- CFS 文件系统、挂载点、目录权限。
- 数据迁移窗口。
- 备份恢复演练要求。

### 身份与安全

必须准备：

- 生产 OIDC IdP。
- OIDC issuer、client id、client secret、redirect URI。
- 管理员账号策略。
- 密码/登录策略。
- MFA 要求。
- 审计保留时间。
- 生产域名和 HTTPS 证书。

## 建议开发顺序

### Phase 1：生产数据底座

目标：

- 先把数据和租户边界打稳。

开发：

- Portal 一等 tenant/org/member/role。
- Portal Store 正式拆分 PostgreSQL/Redis。
- `.runtime` JSON 只保留开发模式。
- workspace/run/order/ledger 全部带 tenantId。

交付：

- 多租户隔离测试通过。
- Postgres/Redis 模式启动通过。

### Phase 2：真实资源商品化

目标：

- 客户能选择真实可售服务器规格。

开发：

- Billing Aggregator 接腾讯云 CVM 询价。
- Server Plan Catalog 管理后台。
- Resource Provisioner 支持 TKE ensure-capacity。
- Portal 服务器与费用页面只展示可售规格、真实来源、更新时间。

交付：

- 无腾讯云密钥时显示“未配置真实报价”，不伪造。
- 有腾讯云密钥时展示真实报价。
- 有 TKE payload 时可创建或扩容节点池。

### Phase 3：支付与冻结账本

目标：

- 用户能自己充值，run 前自动冻结。

开发：

- Payment module。
- 支付 provider adapter。
- Wallet ledger 幂等入账。
- Resource Order freeze 与 payment balance 联动。

交付：

- 支付成功自动入账。
- 订单冻结不重复。
- 余额不足不能启动收费 run。

### Phase 4：真实账单日终对账

目标：

- 腾讯云账单成为最终财务事实。

开发：

- `DescribeBillDetail` 近实时补账。
- COS 日账单 importer。
- unattributed 队列。
- settlement API。
- 管理员对账 UI。

交付：

- exact bill 才能 resource_charge。
- pending 不扣最终费用。
- 日账单重复导入不重复扣费。

### Phase 5：资源回收与成本控制

目标：

- 控制云成本。

开发：

- Provisioner recycler。
- run max duration。
- idle workspace stop。
- low balance alert/stop。
- node pool scale down/delete。

交付：

- run 完成自动释放。
- 空闲自动回收。
- 异常资源可在 admin UI 手动回收。

### Phase 6：生产安全与审计

目标：

- 达到可对外销售和可运维标准。

开发：

- 生产 OIDC。
- Secret Manager/K8s Secret。
- 审计事件标准化。
- 管理员高危操作审计。
- 日志脱敏。

交付：

- 密钥不入库、不入日志、不进前端。
- 管理操作可追踪。
- 生产环境默认拒绝弱配置。

## 本地能否看到腾讯云的东西

可以看到两种东西：

1. 本地 fixture 里的“腾讯云形态”数据。
   - 这能验证 UI、订单、冻结、选择服务器、账单展示。
   - 这不等于真实腾讯云报价。

2. 配好腾讯云 Secret 后的真实 API 返回。
   - `billing-aggregator /server-plans` 可请求 CVM 询价。
   - `billing-aggregator /billing` 可请求 `DescribeBillDetail`。
   - `resource-provisioner /provision` 可请求 TKE 节点池 API。

不能做的事：

- 没有腾讯云 Secret，不能验证真实报价和真实账单。
- 没有 `TENCENT_TKE_CLUSTER_ID` 和 `nodePoolCreatePayload`，不能实际创建节点池。
- 没有账单 COS 权限，不能验证日终账单文件对账。
- 没有支付渠道密钥，不能验证真实充值回调。

## 当前版本定位

`opl-v10` 是商业化内测版：

- 能展示商业化链路。
- 能验证 Resource Order、冻结账本、run 前订单准备。
- 能保证“无真实账单不 exact 扣费”。
- 能本地看到服务器费用模块。

但正式商业化生产版还必须补齐：

- 支付充值。
- 一等多租户隔离。
- 生产数据库/缓存/对象存储/共享文件系统。
- 真实 TKE 开通和回滚。
- COS 日账单对账。
- 资源回收策略。
- 生产 OIDC、密钥管理、审计。

