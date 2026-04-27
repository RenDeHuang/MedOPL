# OPL v11 真实腾讯云状态与商业化工作台 AI 开发文档 v1

日期：2026-04-27
目标版本：`opl-v11`
当前基线：`opl-v10`

## 1. 开发目的

`opl-v11` 的目标不是继续堆说明页，而是把现有能力收束成更像正式商用 SaaS 的第一层体验：

- 用户在 Portal 内能看到真实腾讯云接入状态，而不是只看到本地 fixture。
- 用户在 Portal 内能透明选择服务器规格、看到价格来源、理解是否可开通。
- 用户点击“进入工作台”时走统一入口，不暴露内部系统边界。
- OPL 原生登录框使用 Portal 账号体系完成认证，不再形成双账号心智。
- 资源订单链路从“展示能力”走向“可感知、可验证、可追踪”的商业化链路。

本轮不做支付网关。充值继续保留“管理员入账/线下转账后手工充值”的模式，不在 v11 混入支付通道开发。

## 2. 顶层原则

系统继续坚持：模块内高聚合，模块间低耦合。

- Portal：SaaS 控制面。负责用户、租户、钱包、资源订单、商业化 UI、进入工作台入口。
- Billing Aggregator：计费与报价聚合面。负责腾讯云报价、真实账单、云接入状态、pending/exact 账务事实。
- Resource Provisioner：资源开通面。负责 TKE 节点池/容量开通与状态回填。
- Gateway：身份桥接面。负责 Portal 身份到 OPL Web 的映射与登录桥接。
- OPL Web：工作台面。负责任务空间、session、trace、文件视图与实验室操作。
- Runtime Bridge / Runner / Orchestrator：执行面。负责 run 前准备、Job 创建、运行元数据，不负责扣费。

边界约束：

- Portal 不直连腾讯云 Secret。
- Billing 不登录用户，不持有 Portal session。
- Resource Provisioner 不做账务结算。
- Gateway 不读 Portal DB，只走内部认证/launch 合同。
- Runner 不扣费，只执行。
- OPL Web 不是身份源，也不是账务源。

## 3. v11 范围

### 3.1 真实腾讯云状态 UI

目的：

- 把“是否已接入真实腾讯云能力”明确展示给客户和管理员。
- 区分“系统支持”和“当前环境已配置可用”。

实现范围：

- Billing Aggregator 暴露不泄密的云状态接口。
- Portal 透传并展示云状态，不保存腾讯云密钥。
- UI 展示以下状态：
  - 是否已配置腾讯云凭据
  - 是否启用真实报价
  - 是否启用真实账单
  - 是否已配置镜像 ID
  - 是否已配置可售规格目录
  - 最近一次报价时间和最近一次失败原因
  - 最近一次账单查询时间和最近一次失败原因

不做：

- 不在 Portal 展示 SecretId、SecretKey。
- 不在前端直接请求腾讯云 API。

### 3.2 服务器选择与订单链路

目的：

- 让客户能看懂“能选什么服务器、价格来自哪里、下单后系统会做什么”。
- 让资源订单成为真正的商业动作入口，而不是静态说明。

实现范围：

- 服务器与费用页面展示可售规格、地域、CPU/GPU/内存、冻结金额、价格来源、是否可开通。
- Portal 继续使用 Resource Order 状态机：
  - `quoted -> frozen -> provisioning -> running -> released -> reconciling -> settled`
- Portal 发起报价、冻结、查看订单。
- 订单链路与云状态联动：
  - 没有真实报价配置时，明确标记为“未接入真实腾讯云报价”
  - 没有真实 TKE 开通配置时，明确标记为“可报价，不可自动开通”

不做：

- 不在 v11 内新增支付冻结来源。
- 不在 v11 内伪造“已自动开通 TKE”。

### 3.3 Portal 商业化 UI 收敛

目的：

- 把当前“说明书式后台”收敛成更像产品控制台的界面。
- 保留信息密度，但减少大段解释性文案。

实现范围：

- 总览页只保留关键经营信息：
  - 钱包余额
  - 冻结金额
  - 可用额度
  - 今日/月度 pending 与 exact
  - 最近资源订单
  - 最近运行
  - 云接入状态摘要
- 服务器与费用页改成“选规格 + 看价格 + 看订单 + 看可开通状态”。
- 进入工作台按钮统一收口为单一主行动。

不做：

- 不做新设计系统重构。
- 不做营销落地页。

### 3.4 工作台入口与 OPL 原生登录

目的：

- 保证 Portal 到 OPL 的路径单一、稳定、可验证。
- 保证 OPL 原生登录框使用 Portal 账号认证，不再割裂。

实现范围：

- 核查并修正所有“进入工作台/实验室”的链接，统一走 `/portal/opl`。
- 核查 Gateway 的 OPL native login bridge，确保登录提交走 Portal 内部认证接口。
- 核查 launch token 跳转逻辑，避免落回旧 upstream 或旧 UI。
- 必要时优化错误文案：
  - 未登录
  - launch token 无效
  - Portal 内部认证失败

不做：

- 不做 Portal 密码同步写入 OPL 用户表。
- 不做第二套身份系统。

## 4. 模块划分与交付边界

### 模块 A：Billing Cloud Status

责任：

- 聚合腾讯云报价/账单接入状态。
- 输出可供 Portal 展示的非敏感 readiness 结果。

输入：

- `TENCENT_CLOUD_SECRET_ID`
- `TENCENT_CLOUD_SECRET_KEY`
- `TENCENT_CLOUD_TOKEN`
- `TENCENT_CLOUD_REGION`
- `TENCENT_PRICE_ENABLED`
- `TENCENT_BILLING_ENABLED`
- `TENCENT_PRICE_IMAGE_ID`
- `SERVER_PLAN_CATALOG_JSON`

输出：

- `cloudStatus`
- `serverPlans`
- `billingSummary`

禁止：

- 不返回密钥明文。
- 不返回可复用凭证。

### 模块 B：Portal Resource Commerce

责任：

- 展示服务器、费用、订单、钱包、云状态。
- 发起资源订单报价与冻结。
- 提供统一工作台入口。

输入：

- Billing Aggregator 的 server plans / cloud status
- Resource Order / Wallet / Recent Runs

输出：

- 商业化总览页
- 商业化服务器与费用页
- `/portal/opl` 入口

禁止：

- 不直接请求腾讯云 API。
- 不持有腾讯云 Secret。

### 模块 C：Gateway Identity Bridge

责任：

- 把 Portal 账号体系桥接到 OPL Web。
- 支持 launch token SSO 与 OPL 原生登录。

输入：

- Portal internal auth
- Portal launch token

输出：

- OPL session / 当前用户映射

禁止：

- 不读 Portal 数据库。
- 不维护独立密码体系。

### 模块 D：Resource Provisioner

责任：

- 根据服务器规格和订单请求执行 TKE 开通。
- 回填开通状态。

输入：

- `TENCENT_TKE_CLUSTER_ID`
- 可售规格对应的 node pool payload

输出：

- provision readiness
- 开通状态

禁止：

- 不做扣费。
- 不替 Portal 决定订单状态机策略。

## 5. 本地真实腾讯云验证所需环境变量

以下仅列变量名，不写入任何具体值：

- `TENCENT_CLOUD_SECRET_ID`
- `TENCENT_CLOUD_SECRET_KEY`
- `TENCENT_CLOUD_TOKEN`
- `TENCENT_CLOUD_REGION`
- `TENCENT_PRICE_ENABLED`
- `TENCENT_BILLING_ENABLED`
- `TENCENT_PRICE_IMAGE_ID`
- `SERVER_PLAN_CATALOG_JSON`
- `TENCENT_TKE_CLUSTER_ID`
- `RESOURCE_PROVISIONING_ENABLED`
- 可售规格对应的 `nodePoolCreatePayload` / `nodePoolScalePayload`

说明：

- 没有以上配置时，v11 也必须正确显示“未配置/不可开通”，不能伪造成功。
- 本地验证允许使用当前 shell 的临时环境变量，但不得写入 git、`.env`、镜像、YAML、日志文档。

## 6. 交付标准

v11 达标的条件：

- Portal 总览页已经收敛，不再是说明书式堆文案。
- Portal 服务器与费用页能展示真实腾讯云接入状态与服务器价格来源。
- Portal 内所有主入口都统一跳转 `/portal/opl`。
- OPL 原生登录框可以使用 Portal 账号认证。
- 云状态接口不泄露密钥，但能明确显示“已配置 / 未配置 / 最近失败原因”。
- 订单页或服务器页能看到报价、冻结、最近订单状态。
- 没有真实报价/真实账单/真实 TKE 配置时，系统明确显示边界，不伪造开通能力。

## 7. 测试标准

### 后端验证

- `node --check` 覆盖新增或修改的 Portal / Billing / Gateway 模块。
- 资源订单 smoke 通过：
  - `smoke-test-portal-resource-orders.mjs`
  - `smoke-test-resource-order-freeze-run.mjs`
- Billing smoke 通过：
  - `smoke-test-billing-exact-only-settlement.mjs`
  - `smoke-test-no-legacy-billing-paths.mjs`
- Gateway smoke 通过：
  - `smoke-test-opl-web-gateway-native-login.mjs`
  - `smoke-test-opl-web-gateway-launch.mjs`

### 前端验证

- `npm --prefix services/portal run frontend:typecheck`
- `npm --prefix services/portal run frontend:build`
- 手工浏览器验证以下页面：
  - Portal 总览
  - 服务器与费用
  - 进入工作台跳转
  - OPL 原生登录

### 真实腾讯云联调验证

- 有真实腾讯云凭据时：
  - 云状态显示为已配置
  - server plans 可返回真实报价或明确腾讯云错误
  - billing 状态可返回真实账单接口状态或明确腾讯云错误
- 无真实腾讯云凭据时：
  - 云状态明确为未配置
  - 不出现伪造价格和伪造账单

## 8. 本轮不做的事情

- 不做在线支付网关。
- 不做自动退款链路。
- 不做一等组织/角色模型扩展实现。
- 不做 Postgres/Redis/COS/CFS 全量生产迁移。
- 不做完整的 TKE 异步状态回填与失败回滚闭环。
- 不做 COS 日账单导入。

这些能力仍属于正式商业化生产版缺口，不在 v11 收口范围内。

## 9. 预期交付物

- 一份 v11 AI 开发文档。
- Billing Aggregator 的云状态可见性增强。
- Portal 的商业化 UI 收敛和服务器商品化展示。
- Portal 到 OPL 的统一入口修正。
- OPL 原生登录使用 Portal 账号的联调修正。

## 10. 版本结论

`opl-v11` 的定位是“更接近正式商用的内测版”：

- 它应该让客户看见真实腾讯云接入状态。
- 它应该让服务器选择与价格展示更透明。
- 它应该让 Portal 和 OPL 更像一个产品，而不是两个系统拼接。

但它仍不是正式生产终态。正式商业化生产版还需要继续补齐支付、强多租户、生产存储迁移、真实 TKE 开通闭环、COS 日对账与审计安全能力。
