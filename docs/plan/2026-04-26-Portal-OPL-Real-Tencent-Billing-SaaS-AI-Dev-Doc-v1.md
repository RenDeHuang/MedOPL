# Portal + OPL 正式多租户 SaaS 真实账单开发文档 v1

## 目的

把当前 Portal + OPL 从“多用户工作台”推进到可正式售卖的 SaaS 控制面。核心目标不是让 OPL 自己变成身份系统，而是让 Portal 成为商业控制面，OPL Web 继续作为工作台，billing-aggregator 成为云账单和预扣费的独立账务模块。

顶层原则：

- 模块内高聚合：Portal 聚合账号、租户、余额、权限、workspace、launch；billing-aggregator 聚合腾讯云价格、真实账单、预扣和对账；runner 聚合运行时调度和 Kubernetes Job 标签；Gateway 聚合 OPL 浏览器接入。
- 模块间低耦合：模块之间只通过 API、短期 launch token、账单 JSON、资源标签通信，不共享密码、不共享用户表、不让 OPL Web 读 Portal DB。
- 单模块故障不拖垮整体：腾讯云账单不可用时不能影响 Portal 登录和已有 OPL 会话；OpenCost 不可用时不能产生最终账单；billing-aggregator 不可用时禁止新收费运行或进入只读/待对账状态，而不是静默扣错钱。

## 业务判断

老板说“用户根据自己的需求选服务器，完全透明”，工程含义是：用户在 Portal 选择地域和算力档位，平台把它映射为腾讯云/TKE 的可售资源。

不要把腾讯云复杂实例族直接暴露给用户。Portal 展示应是平台产品化规格：

```text
CPU 标准型 / CPU 大内存型 / GPU 入门型 / GPU 标准型
地域：广州 / 上海 / 新加坡
价格来源：腾讯云实时询价 / 腾讯云账单回补
冻结金额：按规格单价和最小计费单元计算
```

`server_plans` 可以接腾讯云，但不应该完全“无筛选抓全量”。正确模式是：

1. 平台维护一份可售 SKU 白名单：region、zone、instanceType、cpu、memory、gpu、systemDisk、dataDisk、nodePool/runtimeClass。
2. billing-aggregator 定时或按需调用腾讯云 CVM 询价接口刷新这些 SKU 的价格。
3. Portal 只展示白名单内、询价成功、容量可售的规格。
4. 用户开机/运行前按刷新后的价格冻结余额。
5. 最终费用以腾讯云账单明细或 COS 账单文件回补为准。

OpenCost 的定位：

- 可以做运行中近实时 pending cost 和租户内部 Kubernetes 分摊。
- 不能作为最终真实账单。
- 冻结账本的依据不是 OpenCost 预测，而是 `server_plan` 单价、最小计费单元、计划运行上限、存储/流量预估和平台风险系数。
- 最终 exact cost 必须来自腾讯云账单明细或腾讯云账单 COS 文件。

## 当前部署形态

当前 TKE 包是 6 个固定 Deployment：

1. `portal`
2. `portal-opl-adapter`
3. `opl-web-upstream`
4. `opl-web-gateway`
5. `billing-aggregator`
6. `med-autoscience-runner`

包内没有固定 Kubernetes Job。运行时 Job 是 `med-autoscience-runner` 根据用户 run 动态创建的业务工作负载。

结论：继续保持 6 个 Deployment。真实账单第一阶段不新增 Deployment，把腾讯云价格/账单能力聚合进 `billing-aggregator`；runner 继续负责给动态 Job 打标签；Portal 只消费 billing API。

## 需求

### P0：真实账单来源

- billing-aggregator 必须支持腾讯云账单明细接口。
- billing-aggregator 必须支持腾讯云账单 COS 文件作为日级对账入口。
- API 返回必须区分：
  - `tencent_cloud_bill`：腾讯云真实账单。
  - `opencost_pending`：OpenCost 运行中分摊。
  - `metering_pending`：平台本地估算。
  - `adjusted`：真实账单回补后的多退少补。
- Portal 展示必须说明本平台资源费用来自腾讯云账单或腾讯云询价，不展示“模型 key 成本由用户承担”的额外提示。

### P0：资源标签

所有动态运行资源必须带标签：

```text
tenant_id
portal_user_id
customer_id
workspace_id
workspace_session_id
runtime_session_id
run_id
server_plan_id
region
cost_center
```

当前已有 `customer_id/workspace_id/run_id`，下一步要补 `tenant_id/server_plan_id/region`。

### P0：预扣费/冻结账本

运行前必须冻结余额，不允许先跑后发现没钱。

冻结金额计算：

```text
reservation = server_plan.hourly_price * min_billable_hours * risk_factor
            + storage_floor
            + image_distribution_floor
            + network_floor
```

其中：

- `server_plan.hourly_price` 来自腾讯云询价刷新。
- `min_billable_hours` 第一阶段建议 1 小时。
- `risk_factor` 第一阶段建议 1.15 到 1.30，用于覆盖账单延迟和规格误差。
- OpenCost 不能作为冻结依据，只能用于运行中 pending。

### P0：中转站 API key 安全

- API key 属于 tenant secret。
- Portal 只保存加密后的 key。
- runner 运行时只拿到当前 tenant/workspace 所需 key。
- key 不进入日志、trace、artifact、workspace 文件。
- key 泄漏、轮换、禁用必须可审计。

### P1：server plans

- billing-aggregator 提供 `/server-plans`。
- 返回平台白名单规格和腾讯云询价状态。
- 询价失败时规格不可售，不能用本地猜价伪装真实价格。
- Portal 选择规格后，launch payload 带 `serverPlanId/region`。

### P1：真实账单回补

- billing-aggregator 拉取腾讯云账单明细或读取 COS 账单文件。
- 按 `tenant_id/workspace_id/run_id` 标签或资源绑定表归集。
- 找不到 run 标签的账单进入 `unattributed` 队列，不能直接扣用户。
- 对账结果写 ledger：
  - 已冻结 > 真实费用：释放/退款差额。
  - 已冻结 < 真实费用：补扣差额。
  - 无法归因：进入管理员待处理。

## 需要修改哪些模块

### billing-aggregator

负责：

- 腾讯云 API TC3 签名。
- CVM 询价。
- 账单明细查询。
- 账单 COS 文件归集接口。
- 真实账单优先、OpenCost 次级、本地估算最低级的成本状态。

不负责：

- 用户登录。
- OPL launch。
- OPL Web 身份。
- 直接创建 Kubernetes Job。

### portal

负责：

- 展示云账单来源状态。
- 展示腾讯云价格/账单来源。
- 后续接入 tenant wallet、server plan 选择、冻结余额。

不负责：

- 直接调用腾讯云账单 API。
- 保存腾讯云 SecretKey 明文。
- 直接解析 OpenCost 或 COS 账单文件。

### med-autoscience-runner

负责：

- 动态 Job 打全量资源标签。
- 把 `tenantId/serverPlanId/region` 传入 Job labels/env。
- 按 server plan 设置 CPU/GPU/内存/节点选择。

不负责：

- 账单扣费。
- 腾讯云 API。

### TKE manifests

负责：

- 给 billing-aggregator 注入腾讯云账单环境变量。
- 给 secrets.example 提供占位符。
- 保持 billing 独立 Deployment，故障边界清晰。

## 交付边界

本阶段交付：

- 真实账单接入文档。
- billing-aggregator 腾讯云账单/询价连接器。
- TKE 配置项和 secret 占位符。
- Portal 中账单来源文案从 OpenCost 改为腾讯云账单优先。
- 构建并推送变更镜像。

本阶段不交付：

- 完整 tenant 表迁移。
- 组织/团队租户 UI。
- 自动购买/释放腾讯云 CVM。
- 发票、合同、税务。
- 生产 kubeconfig 直接部署。

## 验收标准

本地：

```powershell
npm --prefix adapters/billing-aggregator run check
npm --prefix services/portal run check
npm --prefix services/portal run frontend:typecheck
```

接口：

- `/status` 返回腾讯云账单配置状态。
- `/server-plans` 在无腾讯云凭据时返回明确的未配置状态，不返回伪价格。
- `/billing` 能标注 `pricingSource=tencent_cloud_bill` 或明确 `metering_pending`。
- `/reconcile` 不因 OpenCost 不可用而把估算成本标记成真实账单。

部署：

- 仍保持 6 个固定 Deployment。
- `billing-aggregator` 可独立重启，不影响 Portal 登录。
- TKE manifest 无未替换占位符。
- 镜像推送到 TCR 后可查询 digest。

## worktree 并行推进

```text
real-billing-docs       -> docs/plan/**
real-billing-aggregator -> adapters/billing-aggregator/**
real-billing-deploy     -> deploy/tke-package/** + Portal 文案/状态轻改
```

汇总顺序：

```text
real-billing-docs
real-billing-aggregator
real-billing-deploy
```

## 设计口径

最重要的产品口径：

```text
平台资源费用来自腾讯云真实账单。
运行前冻结用于防止透支。
运行中 pending 是临时计量。
最终扣费以腾讯云账单回补为准。
```

