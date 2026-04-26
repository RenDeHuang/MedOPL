# Portal + OPL 按需算力商业化 AI 开发方案 v1

日期：2026-04-27

## 0. 先判断：方向是否符合，运行是否闭环

结论：方向符合，而且是 Portal + OPL 从“能跑”走向“能卖”的正确主线；但当前系统还没有完全闭环。正确商业表达不是“用户租一台服务器”，而是“用户为一个 workspace/run 购买一次透明的科研运行能力：平台先报价和冻结预算，按选择的 CPU/GPU/存储开通运行，任务结束后释放计算资源，保留或清理 workspace 数据，最终按腾讯云真实账单对账，多退少补”。

必须坚持一个硬边界：运行中可以做准实时 pending cost，不能把本地估算冒充最终账单。最终 exact cost 只能来自腾讯云账单明细或腾讯云账单 COS 文件回补。

| 判断项 | 是否符合 | 当前结论 |
| --- | --- | --- |
| 用户根据需求选择服务器 | 符合 | Portal 已有“服务器与费用”入口、server plan API、选择保存链路；下一步要把它升级成 resource order，而不是只保存偏好。 |
| 用户选择 workspace 存储大小并承担存储成本 | 部分符合 | Runner 已有 workspace 目录、storage request/limit、PVC/对象存储方向；但还缺“存储订单、存储计量、保留/归档/删除生命周期”。 |
| 分发 Docker/Runner 后产生运行成本 | 部分符合 | Runner 已能按 server plan 把 CPU/GPU/内存/ephemeral storage、runtimeClass、nodeSelector、tolerations 写入 Job；但还缺运行前冻结、运行中计量、结束后释放与对账的一体状态机。 |
| 腾讯云账单抓回核对扣费 | 部分符合 | billing-aggregator 已有腾讯云 TC3 签名、账单明细、询价、server-plans、reconcile 骨架；但生产可用还需要资源归因表、unattributed 队列、账本幂等和差额结算。 |
| 实时扣费 | 不能按字面承诺 | 应改成“运行前预扣/冻结 + 运行中准实时估算 + 账单回补后最终结算”。腾讯云账单有同步与分页/数据量约束，不能承诺每秒 exact 扣费。 |
| 项目运行前预扣费 | 符合 | 这是商业化最安全路径。预扣金额来自 quoted server plan、计划时长、存储保底、镜像分发/网络保底、风险系数。 |
| 价格完全透明 | 符合 | 用户需要看到规格、地域、GPU/CPU/内存/存储、小时价、最小计费单元、冻结金额、价格来源、最终账单来源和退款/补扣规则。 |
| 整个运行闭环 | 目标闭环，当前未完全闭环 | 缺 resource order 状态机、wallet freeze ledger、storage lifecycle、资源归因、自动停止/释放、最终结算 UI、失败补偿流程。 |

目标闭环状态机：

```mermaid
flowchart LR
  A["选择 workspace + CPU/GPU + 存储"] --> B["询价 quote"]
  B --> C["冻结/预扣 freeze"]
  C --> D["开通/调度 provision"]
  D --> E["运行 running"]
  E --> F["停止/释放 compute release"]
  F --> G["腾讯云账单回补 reconcile"]
  G --> H["多退少补 settle"]
  H --> I["保留/归档/删除 storage lifecycle"]
```

当前最重要的判断：这条路线是对的，但不能把“选服务器”做成一个孤立 UI。它必须成为订单、冻结、调度、账单、存储生命周期的共同入口。

## 1. 顶层原则

顶层原则必须固定为：模块间低耦合，模块内高聚合，各司其职。

- 模块内高聚合：一个模块把自己的业务规则、状态机、数据模型、错误处理、审计事件收在自己内部。
- 模块间低耦合：模块之间只通过明确 API、ID、短期 token、账本事件、资源标签、只读投影通信。
- 不共享隐式上下文：OPL 不读 Portal DB，Runner 不直接扣费，Billing 不登录用户，Portal 不直接调用腾讯云 SecretKey。
- 不用估算冒充真实：pending cost、freeze amount、exact bill 必须是不同状态和不同字段。
- 不把腾讯云复杂控制台暴露给用户：用户选择平台产品化规格，平台在后台映射腾讯云/TKE/COS 资源。

## 2. 当前架构适配性

当前架构基本符合这个方向，因为已经有控制面、工作台、运行面、账单聚合的分层雏形。

| 模块 | 当前职责 | 与目标方向的关系 |
| --- | --- | --- |
| Portal | 用户、登录、workspace、server plan 展示、余额/试用状态、进入 OPL | 应升级为商业控制面和订单入口。 |
| OPL Web/Gateway | 工作台入口、Portal launch/session 投影 | 应继续只做工作台和会话投影，不承担钱包和云资源决策。 |
| Runner | 动态 Job、workspace 文件、运行标签、资源请求 | 应继续只负责运行调度和状态回写，不做扣费决策。 |
| Billing Aggregator | 腾讯云价格/账单、OpenCost、本地估算、reconcile | 应成为唯一云账单连接器和成本归集模块。 |
| Storage | 当前散落在 workspace 目录/PVC/MinIO 同步 | 需要独立成 storage lifecycle 能力，但不一定第一阶段新增服务。 |

已有代码证据：

- Portal 已配置 `BILLING_SERVICE_URL` 与 `TENCENT_BILLING_ENABLED`，并在商业 profile 中写明“服务器价格来自腾讯云 CVM 实时报价；最终扣费以腾讯云账单明细回补为准”：`services/portal/src/server.mjs:57`、`services/portal/src/server.mjs:58`、`services/portal/src/server.mjs:405`。
- Portal 已有 server plan 选择与查询接口：`services/portal/src/server.mjs:4646`、`services/portal/src/server.mjs:4691`。
- Portal 前端已有“服务器与费用”页面，展示 CPU/GPU、地域、价格、冻结金额和价格状态：`services/portal/frontend/src/views/servers/ServersView.vue:2`、`services/portal/frontend/src/views/servers/ServersView.vue:20`、`services/portal/frontend/src/views/servers/ServersView.vue:67`。
- billing-aggregator 已有腾讯云账单与询价骨架：`adapters/billing-aggregator/src/server.mjs:28` 到 `adapters/billing-aggregator/src/server.mjs:46`、`adapters/billing-aggregator/src/server.mjs:837`、`adapters/billing-aggregator/src/server.mjs:970`、`adapters/billing-aggregator/src/server.mjs:1017`。
- Runner 已能接收 `tenantId/workspaceId/workspaceSessionId/serverPlanId/runtimeClass/nodeSelector/tolerations/storageRequest/storageLimit` 并写入动态 Job：`adapters/med-autoscience-runner/src/server.mjs:155` 到 `adapters/med-autoscience-runner/src/server.mjs:179`、`adapters/med-autoscience-runner/src/server.mjs:665` 到 `adapters/med-autoscience-runner/src/server.mjs:708`。
- smoke test 已验证 server plan 到 runtime manifest 的链路：`scripts/smoke-test-server-plan-runtime-chain.mjs:244`、`scripts/smoke-test-server-plan-runtime-chain.mjs:266` 到 `scripts/smoke-test-server-plan-runtime-chain.mjs:276`。

## 3. 距离真正商业化还差什么

这不是“只差用户选择服务器”这一件事。服务器选择是商业化入口，但商业化还差完整闭环。

P0 缺口：

- Resource Order：缺一个订单状态机，把 quote、freeze、provision、run、release、reconcile、settle 串起来。
- Wallet Freeze Ledger：现在有 wallet/ledger 基础，但缺冻结、占用、释放、退款、补扣、幂等键和审计原因。
- Resource Attribution：腾讯云账单行要能归因到 tenant/workspace/run/server_plan/resource_id；找不到归因时必须进 unattributed，不可直接扣用户。
- Provisioner 边界：如果要“用户点了就自动开通腾讯云资源”，需要独立 resource-provisioner；第一阶段可以先使用预置 TKE CPU/GPU 节点池，第二阶段再自动扩缩容/购买/释放。
- Storage Lifecycle：workspace 存储要有规格、保留天数、超额计费、归档/删除策略，而不是只有目录。
- UI 结算闭环：用户需要看到预估、冻结、运行中、最终结算、退款/补扣、账单来源，不只是看到一张 server plan 表。
- 生产运维：需要账单同步任务、失败重试、告警、对账报告、管理员处理未归因账单。
- 安全合规：腾讯云 SecretKey、tenant API key、workspace 文件、账单数据都要有最小权限和审计。

P1 缺口：

- 租户/组织/RBAC：个人用户可以先跑通，但商业客户需要 org、成员、角色、项目预算。
- 配额与预算：需要 workspace budget、daily cap、concurrent runs、GPU hour limit。
- SLA 与支持：运行失败是否退款、任务超时如何计费、账单争议如何处理。
- 发票/合同/税务/充值支付：代码外的商业化能力，但会反向影响 ledger 字段设计。
- 成本毛利分析：平台要知道腾讯云成本、用户扣费、折扣、补贴、毛利，不只是把云账单转给用户。

## 4. 推荐商业化方案

推荐方案：按 workspace/run 的“资源订单”商业化，而不是长期租服务器。

用户看到的是：

- 我要跑什么 workspace。
- 我需要 CPU 还是 GPU。
- 我需要多大内存和存储。
- 我预计跑多久，是否允许超时自动停止。
- 平台预估冻结多少钱。
- 运行中已消耗多少。
- 任务结束后最终按腾讯云账单多退少补。

平台内部做的是：

- 用 server plan 把产品化规格映射到腾讯云/TKE 可售资源。
- 用 resource order 记录一次运行的商业状态。
- 用 runner 创建动态 Job 或触发 provisioner 开通节点。
- 用 billing-aggregator 拉回账单并对账。
- 用 storage lifecycle 管理 workspace 数据继续收费还是删除。

为什么这比“租服务器”更好：

- 用户往往不知道自己要 CPU 还是 GPU，按任务推荐比让用户理解云服务器实例族更好。
- 用户可能 1 天跑完就不用服务器，按 run 自动释放计算资源可以降低用户成本，也降低平台闲置成本。
- 存储和计算生命周期不同：计算应该任务结束就释放，workspace 数据可以按保留策略继续计费。
- 商业信任来自透明和可对账，不来自用户直接面对腾讯云复杂控制台。

## 5. 模块边界设计

### 5.1 Portal：商业控制面

Portal 负责：

- 用户、tenant、workspace、membership、RBAC。
- Resource Order UI：选规格、选存储、看报价、确认冻结、查看运行状态。
- Wallet / Ledger 展示：余额、冻结、退款、补扣、账单来源。
- 业务状态投影：用户看到 order/run/storage/billing 的合成状态。
- Launch OPL：只签发短期 launch token，不把钱包和云 Secret 暴露给 OPL。

Portal 不负责：

- 不直接调用腾讯云账单/询价 API。
- 不直接创建 Kubernetes Job。
- 不保存腾讯云 SecretKey 明文。
- 不解析 OpenCost 或 COS 原始账单文件。

### 5.2 Resource Order 模块：订单状态机

第一阶段可以放在 Portal 内部实现，但必须作为独立 module/namespace，避免和页面代码混在一起。

负责：

- 创建订单：`draft -> quoted -> frozen -> provisioning -> running -> stopping -> released -> reconciling -> settled`。
- 管理订单幂等：每个 quote/freeze/provision/reconcile 都有 idempotency key。
- 编排模块调用：向 Billing 要 quote，向 Wallet 要 freeze，向 Runner/Provisioner 要 run，向 Billing 要 reconcile。
- 记录订单事件：给客服、审计、用户账单解释使用。

不负责：

- 不生成具体 Job manifest。
- 不解析腾讯云账单。
- 不读写 workspace 文件。

### 5.3 Billing Aggregator：价格、账单、对账

负责：

- 腾讯云 CVM 询价：刷新可售规格的价格。
- 腾讯云账单明细/COS 文件：拉回真实账单。
- OpenCost/pending：运行中准实时展示。
- 归因：把云账单行映射到 tenant/workspace/run/resource_id。
- 输出统一成本结果：`quoted`、`pending`、`exact`、`unattributed`、`adjusted`。

不负责：

- 不决定用户能不能登录。
- 不创建或停止云资源。
- 不直接修改用户余额；只返回对账建议和成本事实。

### 5.4 Wallet / Ledger：钱的唯一事实

负责：

- 充值、试用额度、冻结、释放、扣费、退款、补扣。
- 所有账本条目不可变，使用 reversal/adjustment 而不是原地修改。
- 防止重复扣费：每个账单行和结算事件都有唯一幂等键。

不负责：

- 不计算云价格。
- 不决定 Job 调度。
- 不保存云账单原始大文件。

### 5.5 Runner：运行调度

负责：

- 根据 order/run payload 创建动态 Job。
- 写入 tenant/workspace/run/server_plan/resource labels。
- 应用 CPU/GPU/内存/存储请求、runtimeClass、nodeSelector、tolerations。
- 回写运行状态、开始/结束时间、resource_id 映射。

不负责：

- 不冻结余额。
- 不调用腾讯云账单。
- 不决定退款/补扣。

### 5.6 Resource Provisioner：云资源开通与释放

是否第一阶段新增服务，取决于上线策略。

第一阶段建议不自动购买 CVM，先预置 CPU/GPU 节点池：

- 好处：风险低、上线快、Job 调度链路更稳定。
- 代价：GPU 节点闲置成本要由平台承担，需要预算上限和告警。

第二阶段新增独立 resource-provisioner：

- 负责 TKE 节点池扩缩容、CVM/CBS/COS 资源创建释放、资源 ID 回填。
- 与腾讯云 API 和 Kubernetes 扩缩容交互。
- 只接受 Resource Order 的明确请求，不由 UI 或 Runner 直接调用。

### 5.7 Storage Manager：workspace 数据生命周期

第一阶段可以作为 Portal + Runner 的 storage module，不急着拆独立服务；但边界必须先定。

负责：

- workspace 存储规格：20Gi/100Gi/500Gi/1Ti。
- 存储位置：PVC/CBS/COS/MinIO。
- 保留策略：任务结束后保留、归档、下载后删除。
- 存储计量：容量、对象数、保留天数。
- 删除/归档审计：谁删的、何时删、是否可恢复。

不负责：

- 不跑 AI 任务。
- 不扣钱，只产生成本计量事实给 Billing/Wallet。

### 5.8 OPL Web / Gateway：工作台投影

负责：

- 接收 Portal launch token。
- 把 Portal user/workspace/session 投影到 OPL 会话。
- 展示当前 workspace 与运行入口。

不负责：

- 不让用户在 OPL 里绕过 Portal 购买资源。
- 不保存 Portal 密码。
- 不处理钱包和腾讯云 Secret。

## 6. UI 展示方案：展示什么，为什么展示

### 6.1 Portal 首页

展示：

- 当前余额、冻结金额、可用额度。
- 最近 workspace/run 状态。
- 今日/本月预估费用与最终已结算费用。
- 进入工作台、创建运行、查看账单的主操作。

目的：

- 让用户打开后知道“还能不能跑、跑了多少钱、下一步做什么”。
- 减少工程术语，把 Portal 变成商业控制台。

### 6.2 创建运行 / 选择资源页

展示：

- 任务类型：CPU 普通任务、GPU 加速任务、内存型任务。
- 推荐规格：根据 workspace 历史、任务模板或用户选择给出推荐。
- 手动规格：CPU 核数、内存、GPU 型号/数量、地域。
- 存储规格：workspace 容量、保留天数、是否归档。
- 预计运行时长和自动停止。
- 价格：小时价、最小计费单元、存储保底、镜像/网络保底、风险冻结系数。
- 冻结金额：明确“冻结不是最终扣费，最终以腾讯云账单回补为准”。

目的：

- 用户不需要懂腾讯云实例族，也能做出可控选择。
- 用户在确认前知道最坏情况下会冻结多少钱。
- 平台在开通前拿到可审计授权。

### 6.3 运行详情页

展示：

- order 状态：已报价、已冻结、正在开通、运行中、停止中、待对账、已结算。
- 运行资源：server plan、CPU/GPU/内存、存储、地域。
- 费用状态：冻结金额、运行中 pending、最终 exact、退款/补扣。
- 账单来源：腾讯云询价、OpenCost pending、腾讯云账单明细。
- 自动停止倒计时和手动停止按钮。

目的：

- 让用户理解为什么扣、什么时候退、任务结束后是否还会产生存储费。
- 降低账单争议和客服成本。

### 6.4 账单详情页

展示：

- 每个 run/workspace 的账单条目。
- 冻结、扣费、释放、退款、补扣的 ledger timeline。
- 价格来源和账单来源。
- 未完成对账提示。

目的：

- 建立商业信任。
- 给管理员和用户提供同一套可解释账单。

### 6.5 管理员成本页

展示：

- 未归因账单。
- 腾讯云账单同步状态、失败原因、最后同步时间。
- 预置 CPU/GPU 节点池闲置成本。
- 用户扣费 vs 腾讯云成本 vs 毛利。

目的：

- 平台要能发现亏损、归因失败、GPU 闲置、账单同步异常。

## 7. 核心数据模型

### 7.1 resource_orders

建议字段：

```text
id
tenant_id
portal_user_id
workspace_id
workspace_session_id
run_id
status
server_plan_id
region
zone
cpu
memory_gb
gpu_type
gpu_count
storage_plan_id
storage_size_gb
retention_policy
estimated_hours
auto_stop_at
quote_id
freeze_id
provision_request_id
cloud_resource_ids_json
created_at
updated_at
settled_at
```

### 7.2 resource_order_events

```text
id
order_id
event_type
event_payload_json
actor_type
actor_id
idempotency_key
created_at
```

### 7.3 ledger_entries

现有 ledger 要升级为不可变账本：

```text
id
tenant_id
user_id
workspace_id
run_id
order_id
type                 // topup, freeze, capture, release, refund, makeup_charge, adjustment
amount
currency
source_type          // quote, pending, tencent_bill, admin_adjustment
source_id
idempotency_key
reason
created_at
```

### 7.4 billing_attributions

```text
id
provider
bill_id
bill_month
resource_id
tenant_id
workspace_id
run_id
order_id
server_plan_id
amount
currency
pricing_source       // tencent_cloud_bill, opencost_pending, metering_pending
attribution_status   // exact, partial, unattributed
raw_ref
created_at
```

### 7.5 storage_allocations

```text
id
tenant_id
workspace_id
order_id
storage_plan_id
size_gb
backend              // pvc, cbs, cos, minio
retention_policy
status               // active, archived, deleting, deleted
metered_bytes
last_metered_at
created_at
deleted_at
```

## 8. API 合同

### 8.1 Portal -> Billing

```text
GET /server-plans
POST /quotes
POST /cost/pending
POST /reconcile
GET /billing-attributions?workspaceId=&runId=
```

约束：

- `/server-plans` 返回可售白名单 + 腾讯云询价状态。
- `/quotes` 返回 quote，不修改钱包。
- `/reconcile` 返回对账事实和建议 adjustment，不直接扣余额。

### 8.2 Portal -> Runner / Provisioner

```text
POST /runs
POST /runs/:id/stop
GET /runs/:id
```

payload 必须带：

```text
tenantId
portalUserId
workspaceId
workspaceSessionId
orderId
serverPlanId
region
cpu/memory/gpu/storage
labels
autoStopAt
```

### 8.3 OPL/Gateway -> Portal

```text
POST /launch
GET /session
GET /workspace/:id
```

约束：

- Gateway 只拿工作台所需的 session projection。
- OPL 不拿 wallet、ledger、腾讯云 Secret、完整用户表。

## 9. 腾讯云资源与账单闭环

腾讯云官方接口可支撑该方案：

- CVM 创建实例询价 `InquiryPriceRunInstances` 用于购买前报价，接口域名为 `cvm.tencentcloudapi.com`，腾讯云文档说明它用于创建实例询价，并支持按小时后付费等计费类型。
- 账单明细 `DescribeBillDetail` 用于拉取真实账单明细，接口域名为 `billing.tencentcloudapi.com`；腾讯云文档也提示大客户账单明细量很大时，建议开通账单数据存储并从 COS 桶获取账单文件。
- CVM API 概览中包含 `RunInstances`、`TerminateInstances`、`InquiryPriceRunInstances`、`DescribeZoneInstanceConfigInfos` 等接口，第二阶段自动开通/释放资源可围绕这些能力做 provisioner。

实现原则：

- 价格展示：CVM 询价 + 平台白名单。
- 运行前：按 quote 冻结，不直接扣最终费用。
- 运行中：OpenCost 或本地 metering 只作为 pending 展示。
- 运行结束：释放计算资源，保留 storage allocation。
- 账单回补：按 resource_id / tag / order_id 归因腾讯云 bill detail。
- 结算：exact cost 与冻结金额比对，多退少补。
- 未归因：进入管理员队列，不从用户余额扣除。

## 10. CPU/GPU 是否需要预置

第一阶段建议预置少量 CPU/GPU 节点池，而不是立刻让用户点击后自动买 CVM。

原因：

- 商业闭环还没有完全跑通，自动购买会放大成本和失败风险。
- GPU 资源调度、镜像拉取、驱动/runtimeClass、节点标签都需要稳定验证。
- 预置节点池可以先验证“用户选择 -> Job 调度 -> 账单回补 -> 多退少补”。

建议配置：

- CPU small：低成本常驻，用于普通任务和系统冒烟。
- CPU large/memory：按需扩容，先手动或半自动。
- GPU single：少量预置，设置最大并发和预算告警。
- GPU burst：第二阶段接入 provisioner 后再开放。

第二阶段再做：

- TKE 节点池自动扩缩容。
- CVM/CBS 按 order 自动创建与释放。
- GPU 节点空闲自动回收。
- 资源不足时用户可见排队/等待开通状态。

## 11. 存储生命周期

存储要从“workspace 文件目录”升级为“可计费资源”。

产品规则：

- 创建 workspace 时选择存储规格。
- 运行结束后计算资源释放，但 workspace 存储继续保留。
- 用户可选择：保留、归档、下载后删除。
- 超过免费/试用存储额度后按天计费。
- 删除必须有冷静期或明确不可恢复提示。

技术规则：

- 每个 workspace 有 storage allocation。
- 每次 run 产物归属到 workspace/session/run。
- 存储计量异步进行，产生 storage metering facts。
- Billing 根据 storage facts 生成 pending/exact storage cost。
- Wallet 最终按账单或计量规则结算。

## 12. AI 开发任务拆分

### Phase 1：闭环合同先落地

目标：不急着自动买云主机，先把状态、字段、API、UI 讲清楚并跑通本地闭环。

任务：

- 新增 resource order 数据模型和状态机。
- 扩展 ledger 支持 freeze/capture/release/refund/makeup_charge。
- 扩展 Portal 创建运行 UI：选择 server plan、storage plan、预计时长、自动停止。
- 扩展 Runner payload：orderId、resource labels、autoStopAt。
- 扩展 Billing quote API：返回冻结依据，不修改钱包。
- 新增 order timeline UI。

验收：

- 用户能创建 resource order。
- 余额不足时不能启动收费运行。
- 冻结金额可复算。
- Runner 创建的 Job 带完整标签。
- 任务结束后 order 进入待对账状态。

### Phase 2：腾讯云真实账单回补

目标：把最终费用从 pending 变成 exact。

任务：

- 完善 Tencent bill detail/COS import。
- 新增 billing_attributions。
- 新增 unattributed queue。
- 实现 reconcile -> ledger adjustment 幂等写入。
- Portal 账单页展示 exact/pending/unattributed。
- 管理员可查看同步状态和失败原因。

验收：

- 账单行能按 resource_id/tag/order_id 归因。
- 找不到归因时不扣用户。
- 多退少补只执行一次。
- 腾讯云不可用时不会把估算标记为 exact。

### Phase 3：存储商业化

目标：计算释放后，workspace 存储成本继续可解释。

任务：

- 新增 storage_allocations。
- 新增 storage plans。
- 新增 storage metering job。
- UI 支持保留/归档/删除。
- Billing 支持 storage pending/exact。

验收：

- workspace 容量可计量。
- 删除一个 workspace 不影响其他 tenant/workspace。
- 用户能看到计算费和存储费分开列示。

### Phase 4：自动开通资源

目标：从预置节点池升级到按订单自动开通/释放。

任务：

- 新增 resource-provisioner 服务或独立模块。
- 接入 TKE 节点池/CVM/CBS 创建、扩缩容、释放。
- 回填 cloud_resource_ids。
- 支持资源不足、开通失败、超时回滚。
- 增加预算上限、并发上限、GPU 空闲回收。

验收：

- 用户下单后可以自动开通资源。
- 开通失败自动释放冻结。
- 任务结束释放计算资源。
- 云资源 ID 能被账单归因。

### Phase 5：商业运营能力

目标：从可用变成可运营。

任务：

- org/tenant/RBAC。
- 预算、配额、审批。
- 发票/合同/充值支付接口预留。
- 成本毛利报表。
- SLA/退款规则。
- 安全审计与导出。

验收：

- 商业客户能按组织管理成员和预算。
- 管理员能看毛利和异常账单。
- 支持账单争议追踪。

## 13. 测试方案

### 单元测试

- resource order 状态机合法迁移。
- freeze amount 计算。
- ledger 幂等键去重。
- quote/pending/exact 字段不可混淆。
- Tencent bill row normalize 和 attribution。

### 集成测试

- `server plan -> quote -> freeze -> runner payload -> Job manifest`。
- `run completed -> reconcile -> ledger adjustment -> bill page`。
- `storage allocation -> metering -> storage bill item`。
- 腾讯云凭据缺失时，server plan 不返回伪价格。

### E2E 测试

- 新用户注册，领取试用额度，选择 CPU run，成功运行并待对账。
- GPU 规格余额不足，无法启动并展示充值/降低规格。
- 运行中手动停止，计算资源释放，存储保留。
- 账单回补后，多退少补可见。

### 运维测试

- billing-aggregator 宕机：不允许新收费运行，已有 OPL 会话不被踢。
- 腾讯云账单 API 限流：重试并保留待对账状态。
- 未归因账单：进入管理员队列。
- provisioner 开通失败：释放冻结并记录失败原因。

## 14. 交付标准

第一阶段可交付标准：

- 用户能透明选择服务器规格、存储规格和预计运行时长。
- 运行前必须冻结余额或试用额度。
- Runner 动态 Job 带完整资源标签。
- 运行结束后计算资源可释放，workspace 存储状态可见。
- Portal 能展示冻结、pending、待对账、已结算的不同状态。
- Billing 不把 pending cost 冒充 exact cost。

正式商业化标准：

- 腾讯云账单能稳定回补到 tenant/workspace/run/order。
- 所有扣费都在不可变 ledger 中有证据。
- 未归因账单不会扣到用户。
- 用户能下载或查看可解释账单。
- 管理员能看账单同步状态、异常、毛利和预置资源闲置成本。
- CPU/GPU 资源有预算、并发、自动停止和释放策略。

## 15. 不做事项

第一阶段不做：

- 不把腾讯云所有实例族原样暴露给用户。
- 不承诺秒级真实扣费。
- 不让 OPL 直接处理钱包和购买资源。
- 不让 Runner 直接扣费。
- 不在账单不可归因时自动扣用户。
- 不急着自动购买 GPU 主机，先用预置节点池跑通闭环。

## 16. 参考资料

- 腾讯云 CVM 创建实例询价 `InquiryPriceRunInstances`：https://cloud.tencent.com/document/api/213/15726
- 腾讯云费用中心获取账单明细 `DescribeBillDetail`：https://cloud.tencent.com.cn/document/product/555/19182
- 腾讯云 CVM API 概览：`RunInstances`、`TerminateInstances`、`InquiryPriceRunInstances`、`DescribeZoneInstanceConfigInfos` 等接口：https://cloud.tencent.com/document/api/213/15689

