# OPL v12 真实腾讯云资源订单顺序与商业化 UI AI 开发文档 v1

日期：2026-04-27
目标版本：`opl-v12`
当前基线：`opl-v11`

## 1. 目标

`opl-v12` 的目标不是再补一层说明页，而是把“真实腾讯云接入”“资源订单状态机”“商业化控制台 UI”“工作台启动路径”收束成一条可执行、可验证、可交付给 AI 开发代理直接落地的主链路。

本轮核心目标只有四个：

- 把用户动作从“看服务器”升级为“创建资源订单并进入运行链路”。
- 把 Portal 的商业化 UI 从状态展示升级为下单、冻结、开通、运行、结算的一体入口。
- 把真实腾讯云配置只放在后端受控边界内，不把 Secret 和云厂商控制台心智暴露给前端。
- 把 Portal、Billing、Resource Provisioner、Gateway、Runner 的职责彻底切清，避免继续互相越权。

## 2. 商业化目的

`opl-v12` 服务的是“按次使用 AI 工作台算力”的商业化，而不是“长期租一台服务器”。

用户真正购买的是一次可审计的资源订单：

1. 在 Portal 选择规格、地域、存储、预计时长。
2. 平台给出基于腾讯云可售目录和真实报价的 quote。
3. 平台冻结余额。
4. 平台开通或调度资源。
5. 用户通过统一 Gateway 进入工作台。
6. Runner 执行实际 run。
7. 任务结束后释放计算资源。
8. Billing 按腾讯云真实账单回补，多退少补。

商业化上的意义是：

- 让价格来源透明，用户知道钱为何冻结、何时结算、为何退款或补扣。
- 让“服务器选择”变成订单事实，而不是一页静态介绍。
- 让工作台入口和账务入口统一，不再出现“能进工作台但无法对账”的断裂体验。
- 让后续充值、预算、组织租户、发票、客服审计有稳定账务基础。

## 3. v12 主链路

`opl-v12` 必须把资源订单顺序固定下来，后续实现和测试都围绕这条顺序展开：

`draft -> quoted -> frozen -> provisioning -> launch_ready -> running -> released -> reconciling -> settled`

含义如下：

- `draft`：用户完成规格选择，但尚未报价。
- `quoted`：Billing 已根据腾讯云价格目录返回报价和冻结建议。
- `frozen`：Wallet/Ledger 已冻结金额，订单具备开通资格。
- `provisioning`：Resource Provisioner 正在映射或开通 TKE 节点池/资源。
- `launch_ready`：Gateway 已可签发 launch token，允许进入工作台。
- `running`：Runner 已提交并运行真实任务。
- `released`：计算资源已释放，等待最终账单回补。
- `reconciling`：Billing 正在按腾讯云账单明细或账单文件归因与对账。
- `settled`：完成多退少补，订单闭环。

任何模块都不允许跳过冻结直接进入运行，也不允许把本地估算直接当作最终账单。

## 4. 模块边界

### 4.1 Portal

Portal 是商业控制面，负责：

- 用户、租户、workspace、会员关系、钱包展示、订单列表。
- 商业化 UI：规格选择、价格来源展示、冻结确认、订单状态、退款/补扣结果。
- 订单编排入口：发起 quote、freeze、launch。
- 工作台统一入口，只展示业务投影，不直连腾讯云。

Portal 不负责：

- 不直接调用腾讯云报价、账单、TKE API。
- 不保存或展示腾讯云 Secret。
- 不创建 Kubernetes Job。
- 不决定最终账单事实。

### 4.2 Billing

Billing 是报价与账单事实面，负责：

- 维护腾讯云可售规格与价格来源。
- 输出 `quoted`、`pending`、`exact`、`adjusted` 成本语义。
- 读取腾讯云真实账单明细或账单文件，完成对账和归因。
- 输出订单冻结建议、最终结算建议、未归因账单告警。

Billing 不负责：

- 不登录用户。
- 不持有 Portal session。
- 不启动任务或资源。
- 不直接改写用户前端状态，只提供账务事实和对账结果。

### 4.3 Resource Provisioner

Resource Provisioner 是资源开通面，负责：

- 按 `server_plan` 映射 TKE 节点池规格。
- 使用给定的 `nodePoolCreatePayload` / `nodePoolScalePayload` 开通或扩缩容。
- 回填资源开通状态、节点池标识、失败原因。
- 明确区分“可报价”与“可自动开通”。

Resource Provisioner 不负责：

- 不报价。
- 不冻结和结算。
- 不做工作台登录桥接。
- 不直接承载业务运行。

### 4.4 Gateway

Gateway 是身份桥接面，负责：

- 接收 Portal 发放的 launch token。
- 把 Portal 用户态映射成 OPL Web 可识别的会话。
- 保证“进入工作台”只存在单一入口。
- 屏蔽内部 upstream、旧路径、旧登录口。

Gateway 不负责：

- 不读 Portal DB。
- 不管理钱包。
- 不读取腾讯云账单。
- 不触发资源开通。

### 4.5 Runner

Runner 是执行面，负责：

- 根据订单上下文创建真实任务运行负载。
- 写入 `tenant_id / workspace_id / run_id / resource_order_id / server_plan_id / region` 等关键标签。
- 回写运行状态、开始时间、结束时间、资源映射关系。
- 配合 Resource Provisioner 使用已准备好的节点池能力运行任务。

Runner 不负责：

- 不冻结余额。
- 不做腾讯云账单计算。
- 不管理用户会话。
- 不决定退款或补扣。

## 5. 给定腾讯云配置

本节只记录实现依赖的配置项和能力边界，不记录任何 Secret 值，也不把 Secret 明文写入文档。云凭据由受控环境单独注入。

对 AI 开发代理的强约束是：文档中出现的配置只能作为接口合同和部署前提，不得被实现成前端可见字段、调试日志或示例响应。

### 5.1 已知非 Secret 配置

- `TENCENT_CLOUD_REGION`
  - 例如 `ap-guangzhou`，作为默认地域。
- `TENCENT_PRICE_ENABLED`
  - 控制是否启用真实腾讯云询价。
- `TENCENT_BILLING_ENABLED`
  - 控制是否启用真实腾讯云账单链路。
- `TENCENT_PRICE_IMAGE_ID`
  - 用于 CVM 询价所需镜像标识。
- `SERVER_PLAN_CATALOG_JSON`
  - 可售规格白名单，至少包含：
  - `region`
  - `zone`
  - `instanceType`
  - `cpu`
  - `memory`
  - `gpu`
  - `systemDisk`
  - `dataDisks`
  - `minBillableHours`
  - `riskFactor`
  - `reservationFloor`
  - `provisioningMode`
- `TENCENT_TKE_CLUSTER_ID`
  - 目标 TKE 集群标识。
- 每个可售规格的 `nodePoolCreatePayload`
  - 用于首建节点池。
- 每个可售规格的 `nodePoolScalePayload`
  - 用于扩缩容。

### 5.2 权限与外部前提

- Billing 侧必须具备：
  - `DescribeBillDetail`
  - 账单 COS 文件读取权限
- Resource Provisioner 侧必须具备：
  - `CreateClusterNodePool`
  - `ModifyClusterNodePool`
  - `DescribeClusterNodePools`
  - `DeleteClusterNodePool` 或等效缩容权限

### 5.3 标签与归因前提

真实账单归因至少依赖以下标签：

- `tenant_id`
- `workspace_id`
- `run_id`
- `resource_order_id`
- `server_plan_id`
- `region`

没有这些标签，就不能承诺最终账单可归因，也不能承诺稳定结算。

## 6. 实现范围

### 6.1 本轮必须完成

- Portal 把“服务器与费用”升级为“资源订单与费用”主入口。
- Portal 明确展示：
  - 规格
  - 地域
  - 价格来源
  - 冻结金额
  - 是否可自动开通
  - 当前订单状态
- Billing 输出真实可售规格和报价状态，不允许在询价失败时伪造价格。
- Billing 输出账单来源状态：
  - `tencent_cloud_bill`
  - `opencost_pending`
  - `metering_pending`
  - `adjusted`
- Resource Provisioner 接受订单开通请求，回填 `provisioning` 成败。
- Gateway 统一“进入工作台”入口，只接受 Portal 的 launch 合同。
- Runner 补全资源订单上下文标签，保证后续可对账。
- 文档与实现都明确：
  - 可以 `quoted` 但不能 `provisioning`
  - 可以 `provisioning` 但不能 `launch_ready`
  - 可以 `running` 但不能 `settled`
  - 各状态必须可解释

### 6.2 本轮明确不做

- 不接支付网关。
- 不做自动开票、税务、合同。
- 不做完整组织版 RBAC 重构。
- 不做新的身份系统。
- 不把 OPL Web 改造成商业控制台。
- 不在前端或文档中暴露 Secret。
- 不用本地假账单冒充腾讯云真实账单。

## 7. 测试与交付标准

### 7.1 接口与状态标准

- `server plans` 接口在腾讯云询价关闭或失败时，必须明确返回不可售或未配置状态。
- `cloud status` 接口必须区分：
  - 已配置但未启用
  - 已启用但最近失败
  - 已启用且最近成功
- 订单接口必须支持从 `draft` 到 `settled` 的显式状态推进，不允许隐式跳状态。
- Launch 接口必须依赖订单处于 `launch_ready` 或其等效可启动状态。
- 运行记录必须携带订单、规格、地域和租户标签。

### 7.2 UI 标准

- Portal 首页或资源订单页必须让用户看懂：
  - 我选了什么
  - 价格来自哪里
  - 冻结了多少钱
  - 现在能不能开通
  - 订单处于哪一步
  - 最终账单是否已回补
- 不允许继续用大段说明文替代真实状态。
- 不允许出现多个“进入工作台”入口指向不同链路。

### 7.3 交付标准

- 文档、接口、前端文案和状态机命名一致。
- 没有 Secret 明文进入仓库、日志、前端响应、示例文档。
- 对账前成本只能是 `pending` 类状态，不能显示为最终 `exact`。
- 订单失败、开通失败、归因失败都有面向运营和用户的明确状态语义。

## 8. 未完成商业化缺口

即使完成 `opl-v12`，距离正式商业化仍有明显缺口：

- 钱包账本仍缺完整冻结、释放、退款、补扣、审计幂等模型。
- 未归因账单处理仍需要管理员工作流和告警面板。
- 存储生命周期仍未形成独立订单和持续计费策略。
- 预算上限、配额、组织租户、项目预算尚未完整落地。
- Resource Provisioner 第一阶段大概率仍依赖预置节点池，不能视为完全自动化云资源供给。
- 充值、支付、发票、税务、合同并未进入本轮范围。
- 真实生产环境下的毛利分析、折扣策略、补贴策略尚未固化。

## 9. 面向 AI 开发的执行要求

AI 开发代理在实现 `opl-v12` 时，必须遵守以下约束：

- 只在各模块既定边界内修改，不通过跨模块偷写逻辑绕过状态机。
- 所有新增状态名、接口字段名、前端展示文案必须围绕资源订单主链路统一命名。
- 任何真实腾讯云依赖都必须先判断是否具备配置和权限，再决定返回“可售”“可开通”还是“仅展示”。
- 任何未对账成本都不能被写成最终账单。
- 任何需要凭据的动作都只能发生在后端受控模块，不允许下沉到 Portal 前端或 Gateway。

`opl-v12` 完成的判断标准不是“页面更像产品”，而是“真实腾讯云资源订单顺序、商业化 UI、工作台入口、运行归因、账单回补语义已经形成同一条闭环”。
