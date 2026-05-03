# OPL v20 商业化产品套餐开发方案

## 1. 这个文档在做什么

这份文档是 v20 的开发路线图。它回答四个问题：

- v19 当前能不能商业化发布；
- v19 距离商业 GA 还差什么；
- v20 应该如何把 Portal 从“云资源控制台”改成“小白客户可用的实验室产品”；
- v20 如何测试、验收和交付。

一句话：**v20 是在 v19 的云上主链路能力上，加产品套餐、周预冻结、套餐日扣款、余额宽限期、后台成本审计和更清晰的 Portal 用户入口。**

## 2. v19 当前发布判断

v19 可以推云上灰度/RC，但不应直接按“真实云账单 exact 扣用户钱包”的商业 GA 口径发布。

当前 v19 已经具备这些灰度条件：

- 新用户注册/登录；
- 钱包充值；
- Portal/OPL 登录；
- 创建节点和存储；
- 资源预扣费；
- OPL 消息、上传、任务、下载；
- Portal 文件、账单、trace 可见；
- 删除服务器；
- 删除后停止扣费链路；
- 资源唯一归因能力已有证据。

但 v19 还不能说“真实云厂商成本 exact 结算闭环已商业完成”。

原因是：腾讯 L3 目标资源虽然能唯一归因到 `ins-cq3svd4q`，但账单金额为 0，还没有证明真实非零云账单进入 `exact_resource_charge`、`refund`、`makeup_charge` 的完整入账链路。进入 v20 套餐模式后，这条链路不再是用户扣款主链路，但仍然是后台成本审计、毛利核算和异常成本发现能力。

建议发布口径：

> v19 可以推云上灰度/RC。L3 exact settlement 暂不作为本次上线阻断项，改为 GA 前 P0；当前以上线主链路、预扣费、资源唯一归因、删除停止计费、账单/trace 可见作为云上灰度验收标准。

不要删除 L3 代码。L3 应从“用户扣款主链路/上线 gate”调整为“后台审计、毛利和异常成本增强项”。

## 3. v19 到 v20 还要补什么

v20 不再要求用 L3 作为普通用户扣款依据。商业主链路改成“套餐价格 + 周冻结 + 日扣款 + 余额宽限期”。仍需补齐这些能力：

| 缺口 | 为什么重要 | v20 处理方式 |
| --- | --- | --- |
| 套餐日扣款 | 用户扣款不再依赖云账单返回，体验更稳定 | v20 按套餐日价从钱包扣款 |
| 周预冻结策略 | 防止用户余额见底但资源和存储继续产生成本 | v20 默认按 7 天预计费用冻结 |
| 余额不足宽限期 | 不能余额不足就瞬间删数据 | v20 增加通知、7 天宽限、下载保留、清理队列 |
| 小白产品入口 | 当前 Portal 像云资源控制台，不像客户产品 | v20 改成“入门/进阶实验室套餐” |
| 存储价格/权益清晰 | 当前存储是单独开通，价格表达不清晰 | v20 把存储纳入套餐，额外存储放高级自定义 |
| CVM TagResources 完整证据 | 证明每台云资源都能按 tenant/workspace/run/order 归因 | v20 保留为后台审计和异常成本归因能力 |
| L3 exact bill 审计 | 不作为用户扣款主链路，但要知道平台真实成本和毛利 | v20 保留 L3，作为财务审计和异常成本报警 |
| COS T+1 audit replay | 存储是日结账单，用户侧按套餐扣款，平台侧仍要核算成本 | v20 做 T+1 回放，用于成本审计、毛利和超额异常检测 |

## 4. v20 产品目标

v20 面向“愿意付费但不懂云资源”的客户。他们不想理解腾讯云 SKU、TKE 节点池、COS prefix、L3 账单和分账报表。他们只关心四件事：

- 我充值以后，能不能马上开始试用；
- 现在的计算节点够不够，不够怎么一键升级；
- 现在的存储够不够，不够怎么一键扩容；
- 平台扣了多少钱、冻结了多少钱、余额还能用多久。

所以 v20 不再默认让普通用户选云服务器、地域、节点池、COS 容量。Portal 要从“云资源控制台”改成“实验室产品控制台”。

用户默认路径应该是：

1. 注册账户；
2. 充值；
3. 默认进入推荐套餐；
4. 上传文件；
5. 进入 OPL 开工；
6. 不够用时在原页面一键升级计算或扩容存储。

普通客户只看到两个套餐：

| 套餐 | 包含存储 | 计算配置 | 展示价格 | 冻结方式 |
| --- | ---: | --- | --- | --- |
| 入门 | 10GB | 2 核 | 小时价 + 周预冻结金额 | 预冻结 7 天预计费用 |
| 进阶 | 100GB | 8 核 | 小时价 + 周预冻结金额 | 预冻结 7 天预计费用 |

高级自定义保留给懂的人和运营：

- 自选存储；
- 自选计算 SKU；
- GPU；
- 地域/可用区；
- 节点池；
- 资源标签和云账单诊断。

### 4.1 v19 当前代码暴露出的产品问题

当前 v19 的 Portal 已经具备商业化底座，但普通用户路径仍然偏云控制台：

| 位置 | 当前表现 | 对小白客户的问题 | v20 调整 |
| --- | --- | --- | --- |
| `OverviewView.vue` | 展示腾讯云报价、Pending/Exact、资源订单、服务器价格 | 用户一进来看到的是平台运营指标，不知道下一步如何开工 | 改成“当前套餐、余额、预计可用天数、进入实验室、升级入口” |
| `ServersView.vue` | 展示腾讯云真实 SKU、地域、集群、节点池、CVM、标签完整度、冻结/下单/删除节点池 | 决策成本过高，像让用户自己运维云资源 | 普通路径改成“实验室套餐”；SKU catalog 移到高级/管理员 |
| `WorkspaceView.vue` | 存储单独开通，展示 COS、最小 10GB、多档容量按钮 | 用户会疑惑为什么充值后还不能上传，为什么还要单独买 COS | 套餐自带存储；只展示已用/总量/升级按钮 |
| `BillingView.vue` | 展示 CPU/GPU/存储真实云成本、Pending、Exact、计价来源 | 用户不关心云账单细节，只关心余额和套餐扣费 | 普通账单展示套餐日扣款、周冻结、余额、宽限期；云成本进入高级账单 |
| `resource-orders.mjs` | 资源订单按 server plan 报价、冻结、开通 | 适合平台运营，不适合作为用户第一路径 | v20 用 lab subscription 包装 resource order |
| `workspace-storage.mjs` | entitlement 来自 storage order，未购买存储不能上传 | 与“充值即可开工”的目标冲突 | entitlement 优先来自 lab package，额外扩容才创建 storage add-on |

结论：v20 不需要推翻 v19，而是要在 v19 外层新增产品化套餐层，把复杂资源能力隐藏到高级路径和后台运营路径。

### 4.2 v20 的体验目标

v20 的首屏目标不是“展示平台能力”，而是让用户立刻完成三件事：

- 看见自己当前套餐；
- 看见余额还能支撑多久；
- 点一次进入 OPL。

推荐体验：

```text
注册/登录
-> 充值
-> 自动激活推荐套餐或提示选择入门/进阶
-> 周冻结成功
-> 默认任务空间和存储权益就绪
-> 进入 OPL
-> 上传/运行/下载
-> 存储 80% 提醒升级
-> 计算排队或运行慢时提示升级
```

这条路径不出现腾讯云、TKE、CVM、COS、L3、SKU、region、zone、node pool 等词。

### 4.3 性能和丝滑体验目标

v20 要避免用户点击“开工”后等待 TKE 现建节点池。套餐应映射到预置或预热运行池：

| 场景 | v20 目标 | 设计要求 |
| --- | --- | --- |
| 首次进入 Portal | 页面正常加载，不把账单/L3 同步阻塞在首屏 | 总览接口不等待腾讯云账单接口 |
| 点击进入 OPL | warm 状态下应接近直接打开工作台 | 不在点击路径同步创建 node pool |
| 启动一次普通运行 | 使用已有套餐池调度 | resource order 记录归因，不把云资源创建作为用户同步等待 |
| 上传文件 | 套餐存储权益默认存在 | 不要求用户先单独购买 COS |
| 升级套餐 | 立即更新权益和冻结，后台扩容 | 前台展示“升级已生效/容量扩容中”的明确状态 |

如果后台容量不足，普通用户不看云资源错误。用户侧只看到“当前套餐容量紧张，已进入扩容队列”或“请联系运营处理”。管理员侧必须看到具体 TKE/CVM/COS 原因。

## 5. Portal 怎么改

v20 主要改 Portal 的产品表达，不推翻 v19 底层逻辑。

保留 v19 底层能力：

- wallet/ledger；
- resource order；
- storage entitlement；
- pending usage；
- exact bill reconcile；
- refund/makeup；
- TKE provisioner；
- COS cleanup；
- OPL runtime bridge。

新增 v20 产品层：

- `lab-packages`：定义入门/进阶套餐；
- `lab-subscriptions`：记录用户当前套餐；
- 套餐激活/升级接口；
- 周预冻结策略；
- 余额不足状态；
- 7 天宽限期；
- 清理队列状态；
- Portal 小白路径 UI。

Portal 页面调整：

| 页面 | v19 现状 | v20 改法 |
| --- | --- | --- |
| 总览 | 展示服务器报价、订单、成本等平台信息 | 改成当前套餐、余额、冻结、存储用量、进入实验室 |
| 服务器与费用 | 默认展示腾讯云 SKU catalog | 改成“实验室套餐”，只展示入门/进阶 |
| 任务空间 | 单独开通存储，展示 COS 能力 | 展示套餐包含容量和用量，默认不要求单独买存储 |
| 账单 | 展示云成本分项和流水 | 先展示套餐、冻结、余额、宽限期，再展示高级账单明细 |
| 高级/管理员 | 部分能力混在普通路径 | 放 SKU、自定义存储、云资源诊断、L3 对账 |

### 5.1 普通用户主路径

普通用户只需要以下导航：

```text
总览
实验室套餐
任务空间
账单
会话轨迹
```

总览页应成为工作台入口页：

- 当前套餐：入门或进阶；
- 计算能力：2 核或 8 核；
- 存储容量：10GB 或 100GB；
- 已用存储和剩余存储；
- 钱包余额；
- 已冻结金额；
- 预计还能使用多少天；
- 宽限期状态；
- 进入 OPL；
- 升级套餐；
- 扩容存储。

### 5.2 高级/运营路径

这些能力不能消失，但不能放在普通用户第一路径：

- 腾讯云 SKU catalog；
- region/zone/instanceType；
- TKE cluster/node pool；
- CVM 实例和标签完整度；
- resource mapping；
- L3 exact bill；
- COS T+1 replay；
- unattributed cost queue；
- refund/makeup 审计；
- 清理队列和资源残留。

推荐路径：

```text
/advanced/servers
/advanced/storage
/admin/billing-ops
/admin/sandboxes
/admin/audit
```

普通用户可以看账单，但账单语言必须是套餐语言；高级账单才显示云资源语言。

## 6. 存储怎么改

存储不再作为普通用户的独立购买步骤。

入门套餐包含 10GB，进阶套餐包含 100GB。

Workspace 页面展示：

- 已用多少 GB；
- 套餐包含多少 GB；
- 是否接近上限；
- 是否需要升级。

规则：

- 用量达到 80%，提示升级；
- 用量达到 100%，阻止新上传和新输出保存；
- 余额不足进入宽限期后，允许下载，不允许新上传；
- 宽限期过后进入清理队列；
- 普通 UI 不展示 COS、prefix、entitlement；
- 额外存储价格只放高级自定义。

### 6.1 存储实现原则

当前 `workspace-storage.mjs` 的 entitlement 主要来自 `storageOrders`。v20 应改成：

```text
lab subscription
-> package included storage entitlement
-> workspace storage entitlement
-> upload/output gate
```

也就是说，普通套餐激活后自动拥有对应存储权益：

- 入门套餐自动拥有 10GB；
- 进阶套餐自动拥有 100GB；
- 额外存储作为 add-on，不再是开工前必选项。

### 6.2 存储扩容体验

存储不足时，用户不应看到 COS 购买页，而应看到明确动作：

| 状态 | 用户看到 | 系统动作 |
| --- | --- | --- |
| 小于 80% | 正常显示剩余容量 | 无动作 |
| 80%-99% | 提示“存储快满，可升级到进阶或购买额外容量” | 记录提醒事件 |
| 达到 100% | 阻止新上传和新输出保存 | 允许下载，提示扩容 |
| 宽限期内 | 允许下载，不允许新上传 | 保留数据 7 天 |
| 宽限期结束 | 进入清理队列 | 管理员可审计清理状态 |

额外存储可以做成固定加购包：

```text
+100GB
+500GB
+1TB
```

普通用户不按 GB 单价做复杂选择；价格可以在套餐卡上展示为“额外存储包价格”。

## 7. 计算节点怎么改

计算节点不再让普通用户选腾讯云 SKU。

套餐背后由运营配置固定映射：

```text
starter -> 2 核 backing server plan
pro     -> 8 核 backing server plan
```

用户看到的是：

- 入门：标准速度；
- 进阶：更快运行。

用户不看：

- 实例类型；
- region；
- zone；
- node pool；
- TKE cluster；
- CVM 库存状态。

如果 backing server plan 不可用，Portal 应显示“套餐暂不可用，请联系运营/稍后重试”，并在管理员侧暴露具体云资源原因。

### 7.1 计算升级体验

计算不足对小白用户不应表达为“请选择更大 CVM SKU”，而应表达为：

```text
当前是入门套餐，适合轻量任务。
如果任务排队、运行慢或需要同时处理更多文件，升级到进阶套餐。
```

触发升级提示的来源可以是确定性指标：

- 最近 N 次运行平均耗时超过套餐阈值；
- 最近 N 次运行排队时间超过套餐阈值；
- 当前 workspace 同时运行数达到套餐限制；
- 用户手动点击“更快运行”。

不使用模糊启发式做自动扣费升级。升级必须由用户确认或管理员代操作，并写入 `labPackageEvents`。

### 7.2 不要把 TKE 冷启动放在用户点击路径

v20 应优先采用预置/预热资源池：

```text
starter package -> starter runtime pool -> 2 核运行配额
pro package     -> pro runtime pool     -> 8 核运行配额
```

用户点击“进入 OPL”时只做：

- 校验登录；
- 校验套餐；
- 校验余额/冻结/宽限期；
- 创建或复用 workspace session；
- 生成 OPL launch；
- 跳转工作台。

不要在这个路径里同步执行：

- 创建 TKE node pool；
- 等待 CVM 创建完成；
- 等待 L3 或 COS 账单；
- 等待云资源标签回填。

这些必须进入后台容量管理或管理员路径。

## 8. 冻结和余额规则

v20 默认采用周预冻结：

- 激活套餐时冻结 7 天预计费用；
- 用户侧每天按套餐日价正常扣款；
- 冻结金额不是扣款，只用于确保未来 7 天有钱可用；
- 已发生的日扣款从钱包余额入账，冻结额度按余额和套餐周期续冻；
- 余额不足时提前提醒；
- 未充值进入 7 天宽限期；
- 宽限期内允许下载，不允许新上传和新收费运行；
- 7 天后进入清理队列。

这解决老板提出的核心问题：平台不能等余额见底后才发现存储和服务器仍在产生成本，也不能一瞬间删除用户数据。

### 8.1 用户账单语言

普通用户账单只展示四类流水：

| 流水 | 含义 |
| --- | --- |
| 充值 | 用户余额增加 |
| 周冻结 | 预留未来 7 天套餐费用，不是实际扣款 |
| 套餐日扣款 | 每天按当前套餐扣费 |
| 解冻/释放 | 套餐取消、降配或清理完成后的冻结释放 |

L3、COS T+1、refund、makeup、unattributed 不出现在普通账单主视图。它们进入高级账单或管理员审计。

### 8.2 余额提醒和宽限期

余额状态分成四档：

| 状态 | 条件 | 用户能力 |
| --- | --- | --- |
| 正常 | 可用余额足够覆盖下一次周冻结 | 可上传、可运行、可下载 |
| 余额偏低 | 可用余额不足以覆盖下一周期，但当前仍未欠费 | 可上传、可运行、可下载，持续提醒充值 |
| 宽限期 | 日扣款失败或续冻失败 | 可下载，不允许新上传和新收费运行 |
| 清理排队 | 宽限期满 7 天仍未充值 | 不允许使用，进入后台清理队列 |

这套状态应由后端统一计算，前端只消费状态，不在页面里重复推导。

## 9. 后端实现切分

建议新增模块：

```text
services/portal/src/domain/lab-packages.mjs
services/portal/src/domain/lab-subscriptions.mjs
services/portal/src/domain/lab-entitlements.mjs
services/portal/src/domain/lab-billing-policy.mjs
services/portal/src/routes/lab-package.routes.mjs
```

建议新增接口：

```text
GET  /portal/api/lab-packages
POST /portal/api/lab-packages/activate
POST /portal/api/lab-packages/upgrade
GET  /portal/api/lab-subscription
GET  /portal/api/lab-entitlement
POST /portal/api/lab-storage/addons
```

建议新增状态：

```text
labSubscriptions
labPackageEvents
labStorageAddons
labDailyCharges
```

不要把 v20 套餐逻辑塞回 `portal-runtime.mjs`。

### 9.1 后端职责边界

| 模块 | 职责 | 不应该做什么 |
| --- | --- | --- |
| `lab-packages.mjs` | 定义入门/进阶套餐、价格、存储、计算映射 | 不访问钱包和云资源 |
| `lab-subscriptions.mjs` | 激活、升级、取消套餐，记录事件 | 不直接调用 TKE |
| `lab-entitlements.mjs` | 把套餐转换成 storage/compute/workspace 权益 | 不读取腾讯云账单 |
| `lab-billing-policy.mjs` | 计算周冻结、日扣款、宽限期状态 | 不做 L3 exact 结算 |
| `resource-orders.mjs` | 保留资源归因、冻结、provisioning 生命周期 | 不作为普通用户套餐选择入口 |
| `workspace-storage.mjs` | 执行上传/下载/输出 gate | 不要求普通用户先单独买存储 |
| `billing-aggregator` | 后台成本审计、L3/COS replay、未归因成本 | 不决定普通用户日扣款 |

### 9.2 数据模型建议

```text
labSubscriptions:
  id
  tenantId
  userId
  workspaceId
  packageId
  status
  computeTier
  includedStorageGb
  dailyPrice
  weeklyFreezeAmount
  currentFreezeId
  graceStartedAt
  cleanupAfterAt
  createdAt
  updatedAt

labPackageEvents:
  id
  subscriptionId
  eventType
  eventPayload
  actorType
  actorId
  idempotencyKey
  createdAt

labStorageAddons:
  id
  subscriptionId
  storageGb
  dailyPrice
  status
  createdAt
  updatedAt

labDailyCharges:
  id
  subscriptionId
  chargeDate
  amount
  ledgerEntryId
  idempotencyKey
  createdAt
```

### 9.3 和 v19 能力的对接方式

v20 不删除 v19 的 resource order 和 storage order。对接方式是：

```text
lab subscription
-> 选择 backing server plan
-> 必要时创建/复用 resource order
-> 写 resource mapping 供后台审计
-> lab entitlement 覆盖普通 workspace storage entitlement
-> billing policy 写套餐日扣款 ledger
-> billing aggregator 写后台 cost audit
```

用户扣款链路和云成本审计链路必须分开，但两边都要能通过 `tenantId/workspaceId/resourceOrderId/runId` 对齐。

## 10. 前端实现切分

建议新增：

```text
services/portal/frontend/src/views/packages/PackagesView.vue
```

建议调整：

```text
services/portal/frontend/src/views/overview/OverviewView.vue
services/portal/frontend/src/views/workspace/WorkspaceView.vue
services/portal/frontend/src/views/billing/BillingView.vue
services/portal/frontend/src/views/servers/ServersView.vue
services/portal/frontend/src/router/index.ts
services/portal/frontend/src/layouts/AppSidebar.vue
services/portal/frontend/src/api/portal.ts
```

导航改成：

```text
总览
实验室套餐
任务空间
账单
会话轨迹
```

服务器 SKU catalog 移到：

```text
/advanced/servers
```

### 10.1 页面改造目标

| 页面 | v20 普通用户应该看到 |
| --- | --- |
| 总览 | 当前套餐、余额、冻结、预计可用天数、进入 OPL、升级套餐 |
| 实验室套餐 | 入门/进阶两张套餐卡，价格、周冻结、包含存储、计算能力 |
| 任务空间 | 文件、输出、存储用量、扩容入口，不展示 COS |
| 账单 | 充值、周冻结、套餐日扣款、解冻、宽限期 |
| 会话轨迹 | 保留运行记录、输出、trace |

### 10.2 文案原则

普通页面不出现这些词：

```text
腾讯云 SKU
TKE
CVM
COS prefix
L3
DescribeBillDetail
node pool
region
zone
exact bill
unattributed
```

普通页面使用这些词：

```text
入门套餐
进阶套餐
计算能力
存储容量
余额
冻结
每日扣款
宽限期
升级
扩容
进入实验室
```

### 10.3 交互原则

- 用户充值后，如果没有套餐，默认推荐入门套餐，并清楚显示“可升级到进阶”；
- 用户余额足够时，激活套餐应一步完成：创建 subscription、周冻结、创建默认 workspace entitlement；
- 用户不够钱时，不显示云资源错误，只显示需要充值多少才能开通；
- 用户存储不足时，优先提示升级进阶，其次提示购买额外存储包；
- 用户计算不足时，提示升级进阶，不提示选择 CPU/内存/SKU；
- 管理员仍可从后台看到具体资源和成本。

## 11. 测试计划

新增 v20 合同测试：

```bash
node scripts/smoke-test-v20-lab-packages-contract.mjs
node scripts/smoke-test-v20-lab-subscriptions-contract.mjs
node scripts/smoke-test-v20-lab-package-routes-contract.mjs
node scripts/smoke-test-v20-lab-subscription-persistence-contract.mjs
node scripts/smoke-test-v20-grace-period-gates.mjs
node scripts/smoke-test-v20-lab-entitlements-contract.mjs
node scripts/smoke-test-v20-package-daily-charge-contract.mjs
node scripts/smoke-test-v20-storage-addons-contract.mjs
node scripts/smoke-test-v20-portal-copy-contract.mjs
node scripts/smoke-test-v20-advanced-routes-hidden-contract.mjs
```

复用 v19 关键测试：

```bash
node scripts/smoke-test-portal-resource-orders.mjs
node scripts/smoke-test-resource-order-freeze-run.mjs
node scripts/smoke-test-workspace-storage-routes-contract.mjs
node scripts/smoke-test-v19-runtime-output-storage-gate.mjs
node scripts/smoke-test-v19-billing-reconcile-cli.mjs
```

前端测试：

```bash
npm --prefix services/portal/frontend run typecheck
npm --prefix services/portal/frontend run build
```

前端体验测试：

```bash
node scripts/smoke-test-v20-packages-view-contract.mjs
node scripts/smoke-test-v20-overview-productized-contract.mjs
node scripts/smoke-test-v20-workspace-storage-usage-contract.mjs
node scripts/smoke-test-v20-billing-package-ledger-contract.mjs
```

性能和冷启动测试：

```bash
node scripts/check-production-entry-performance.mjs --json
node scripts/smoke-test-v20-opl-launch-without-nodepool-create-contract.mjs
node scripts/smoke-test-v20-runtime-pool-selection-contract.mjs
```

性能验收不要求 v20 比个人本地版更快，但要求普通用户点击路径不被后台云资源创建阻塞。测试应断言：

```text
进入 OPL 的 API 路径不调用 CreateClusterNodePool
套餐激活路径不等待 L3/COS T+1
总览 payload 不依赖腾讯云账单实时返回
workspace 上传 gate 使用 lab entitlement
```

GA 前 live 证据分两类。用户计费主链路必须通过：

```bash
node scripts/check-one-person-lab-upstream-clean.mjs
node scripts/live-test-v19-user-e2e.mjs
node scripts/live-test-v19-tke-create-delete-cleanup.mjs
```

后台成本审计链路建议继续验证，但不作为用户扣款主链路阻断：

```bash
node scripts/live-test-v19-cos-exact-bill-reconcile.mjs
```

v20 后台审计应能最终补齐非零成本证据，但该证据用于毛利、异常成本和资源归因，不用于普通用户日扣款：

```text
真实云账单金额 > 0
-> 能归因到 tenant/workspace/run/resourceOrder
-> 能进入后台 cost audit record
-> 能标记异常成本、未归因成本或毛利风险
-> 幂等重复执行不会重复记审计记录
```

## 12. 交付标准

v20 可交付条件：

- `/home/dev/projects/platform-v20` 是独立版本目录；
- v20 不修改 one-person-lab 上游；
- 普通用户默认看到入门/进阶套餐；
- 入门套餐能开 10GB 存储和 2 核计算；
- 进阶套餐能开 100GB 存储和 8 核计算；
- 周预冻结可见且执行；
- 余额不足进入提醒/宽限，而不是立即删除数据；
- 宽限期内允许下载，阻止上传和新收费运行；
- SKU catalog 和云资源细节只在高级/管理员路径；
- v19 主链路测试通过；
- v20 套餐测试通过；
- 套餐日扣款、周冻结、余额宽限期和清理队列通过后，可以作为套餐商业 beta/GA 候选；
- L3/COS T+1 审计继续作为后台成本审计增强项，不阻断普通用户套餐扣款主链路。

### 12.1 交付边界

v20 本次交付包含：

- 普通用户套餐化体验；
- 入门/进阶套餐定义；
- 周冻结；
- 套餐日扣款；
- 余额提醒；
- 7 天宽限期；
- 套餐存储权益；
- 存储用量展示；
- 存储扩容入口；
- 计算升级入口；
- OPL 入口不被 TKE 冷启动阻塞；
- 高级云资源路径迁移；
- 后台成本审计保留。

v20 本次不包含：

- 修改上游 `one-person-lab` 源码；
- 让普通用户选择腾讯云 SKU；
- 把 L3/COS T+1 作为普通用户日扣款依据；
- 承诺 exact 云账单秒级返回；
- 自动无确认升级用户套餐；
- 余额不足后立即删除数据；
- 把云资源错误直接暴露给普通用户。

### 12.2 商业体验验收

以一个新用户为验收对象：

```text
新用户注册
-> 管理员入账 1000 元
-> 用户看到推荐套餐
-> 激活入门套餐
-> 看到 7 天冻结金额
-> 进入 OPL
-> 上传文件
-> 产生输出
-> 下载输出
-> 升级进阶套餐
-> 看到 100GB 存储和 8 核计算
-> 账单页出现套餐日扣款
-> 余额不足时进入提醒和宽限期
```

这条链路通过后，v20 才能称为套餐商业 beta。

### 12.3 管理员验收

管理员必须能看到普通用户看不到的细节：

- subscription 对应的 tenant/workspace/user；
- packageId 和 backing server plan；
- resource order；
- resource mapping；
- node pool / CVM / COS object key；
- L3/COS T+1 审计状态；
- 未归因成本队列；
- 清理队列；
- 日扣款、周冻结、解冻、宽限期事件。

管理员验收通过后，才能进入商业 GA 候选。

## 13. 推荐发布路线

### v19 发布级别

```text
v19 cloud gray / RC
```

可以推云灰度，但不要标商业 GA。

### v20 发布级别

```text
v20 commercial package beta
```

目标是让客户使用套餐，不再直接面对云 SKU。

### 商业 GA 条件

```text
v20 commercial GA = v20 套餐体验 + v19 云主链路 + 周冻结 + 套餐日扣款 + 余额宽限期
```

L3 exact bill 和 COS T+1 replay 是后台成本审计、毛利核算和异常成本发现能力，不再作为普通用户扣款主链路。

## 14. 当前结论

v19 不是不能上线，而是不能以“商业 GA 完成”口径上线。

v19 可以作为云上灰度/RC，验证真实用户主链路和资源运营链路。

v20 要补的是商业产品层和用户计费主链路：

- 对小白客户：套餐化、简单入口、默认可开工；
- 对平台运营：周预冻结、套餐日扣款、宽限期、清理队列；
- 对财务/审计：L3 exact bill、CVM 标签证据、COS T+1 replay 作为后台成本审计增强项。

## 15. 小白商业化体验与工程执行清单

### 15.1 为什么要这样开发

v20 的商业化目标不是把腾讯云控制台换一层皮，而是把 OPL 变成客户能直接购买和使用的实验室产品。

目标客户分三类：

| 人群 | 需求 | v20 体验 |
| --- | --- | --- |
| 普通小白客户 | 充值后马上能用，不理解云资源 | 只看套餐、余额、存储、进入实验室、升级/扩容 |
| 高消费进阶客户 | 有更大任务、更高并发、更大存储 | 支持自定义模式，但仍用产品语言表达 |
| 运营/管理员 | 控成本、控资源、查账、清理、审计 | 保留真实云资源、L3、COS T+1、resource mapping |

因此 v20 的产品模型固定为：

```text
一个账号
-> 一个当前套餐
   -> 一个主存储池
   -> 一个当前计算权益
   -> 多个项目
   -> 可选存储加购
   -> 可选计算加购
   -> 可选自定义套餐
```

任务空间不再是购买单位。它应改名或表达成“项目”，只负责组织文件、运行记录、输出和 trace。套餐才是购买单位。

这套模型对客户简单，对运维可控，对商业计费闭环清晰。

### 15.2 商业模型定义

普通用户默认只看到两个固定套餐：

| 套餐 | 计算权益 | 主存储池 | 适合用户 | 用户动作 |
| --- | --- | ---: | --- | --- |
| 入门 | 2 核计算能力 | 10GB | 轻量试用、小任务 | 开通、进入实验室、升级进阶 |
| 进阶 | 8 核计算能力 | 100GB | 更大数据、更快运行 | 开通、进入实验室、扩容存储 |

支持三类增量能力：

| 能力 | 普通表达 | 后台含义 |
| --- | --- | --- |
| 存储加购 | 增加 100GB / 500GB / 1TB 存储空间 | 增加账号主存储池额度 |
| 计算加购 | 更快运行 / 更多同时运行 | 提升 compute entitlement 或绑定更高运行池 |
| 自定义套餐 | 联系运营配置专属实验室 | 生成 custom package 和 backing server plan |

普通用户不购买“某个任务空间的存储”，也不购买“某台服务器”。用户购买的是一个当前实验室能力。

### 15.3 用户可见语言边界

普通用户页面禁止出现以下专业词：

```text
TKE
CVM
COS
COS prefix
SKU
节点池
实例
region
zone
L3
DescribeBillDetail
exact bill
pending bill
unattributed
resource mapping
```

普通用户页面使用以下产品词：

```text
实验室
套餐
项目
计算能力
存储空间
余额
冻结
每日费用
预计可用天数
准备中
已就绪
升级
扩容
进入实验室
宽限期
```

等待状态也必须用产品语言：

| 后台动作 | 用户文案 |
| --- | --- |
| 创建或绑定运行资源 | 正在准备实验室计算能力 |
| 准备存储 entitlement | 正在准备存储空间 |
| 生成 OPL launch | 正在连接实验室 |
| 后台容量不足 | 当前计算资源紧张，已进入准备队列 |
| 资源就绪 | 实验室已就绪，可以开始使用 |

### 15.4 丝滑流程设计

普通用户每个状态只给一个主动作：

| 用户状态 | 主动作 | 说明 |
| --- | --- | --- |
| 未登录 | 登录/注册 | 不展示套餐复杂信息 |
| 未充值 | 立即充值 | 告诉用户开通推荐套餐需要多少余额 |
| 已充值未开通套餐 | 开通推荐套餐 | 默认推荐入门，允许切换进阶 |
| 套餐开通中 | 查看准备进度 | 允许上传文件和创建项目 |
| 套餐可用 | 进入实验室 | 主按钮固定为进入 OPL |
| 存储 80% 以上 | 扩容存储 | 同时提示升级进阶 |
| 计算排队或慢 | 升级计算能力 | 先建议进阶，再给自定义入口 |
| 余额不足 | 充值续用 | 说明宽限期和数据保留时间 |

首次使用流程必须是：

```text
注册
-> 充值
-> 开通推荐套餐
-> 自动创建默认项目
-> 自动准备主存储池
-> 自动准备计算权益
-> 进入实验室
-> 上传文件
-> 发送消息
-> 看到输出和 trace
```

如果首次开通需要准备时间，页面必须显示：

```text
当前步骤
预计时间
已完成步骤
下一步
可以先做什么
```

不允许空白等待或只显示转圈。

### 15.5 工程阶段顺序

v20 应按以下阶段推进，每阶段都有明确验收：

| 阶段 | 目标 | 主要文件 | 验收 |
| --- | --- | --- | --- |
| Phase 0 | 锁定上游不可改和结构基线 | `.sentrux/rules.toml`、`scripts/check-one-person-lab-upstream-clean.mjs` | upstream clean，Sentrux 记录当前 baseline |
| Phase 1 | 定义套餐和订阅模型 | `lab-packages.mjs`、`lab-subscriptions.mjs` | 入门/进阶/custom 可创建、升级、幂等 |
| Phase 2 | 定义主存储池和计算权益 | `lab-entitlements.mjs` | 多项目共享账号存储池和计算权益 |
| Phase 3 | 实现周冻结和日扣款 | `lab-billing-policy.mjs`、`wallet-ledger.mjs` | 冻结不是扣款，日扣款幂等，宽限期正确 |
| Phase 4 | 改 Portal 普通用户路径 | `OverviewView.vue`、`PackagesView.vue`、`WorkspaceView.vue`、`BillingView.vue` | 页面不出现专业词，主动作清晰 |
| Phase 5 | 隐藏高级云资源路径 | `ServersView.vue`、router、sidebar | SKU/TKE/CVM/COS 只在高级/管理员路径 |
| Phase 6 | 优化 OPL 进入和等待体验 | runtime bridge、gateway、Portal launch | 进入 OPL 不同步创建 node pool |
| Phase 7 | 打通 live E2E | Portal、OPL、trace、billing | 能发送 OPL 消息，trace 可见，账单可见 |
| Phase 8 | 性能和结构 gate | Sentrux、performance scripts | Portal 快，OPL 可用，Sentrux 不退化 |

### 15.6 模块验收断言

每个模块必须有合同测试，不能只靠页面手测。

`lab-packages.mjs`：

```text
assert packages contains starter and pro
assert starter.storageGb == 10
assert starter.computeCores == 2
assert pro.storageGb == 100
assert pro.computeCores == 8
assert custom package is hidden from default public list unless explicitly enabled
```

`lab-subscriptions.mjs`：

```text
assert one user has at most one active subscription
assert activating the same package twice is idempotent
assert upgrade starter -> pro writes labPackageEvents
assert downgrade or cancel does not delete data immediately
```

`lab-entitlements.mjs`：

```text
assert account storage pool equals package storage + addons
assert multiple projects share one storage pool
assert storage usage is summed across projects
assert upload is blocked when total usage reaches entitlement
assert downloads remain allowed during grace period
```

`lab-billing-policy.mjs`：

```text
assert weekly freeze amount equals 7 days of package price
assert freeze does not reduce wallet balance as actual spend
assert daily charge is written once per subscription per date
assert insufficient balance enters grace period
assert grace period cleanupAfterAt is 7 days after graceStartedAt
```

`runtime launch`：

```text
assert launch requires active package or valid grace download-only state
assert normal launch path does not call CreateClusterNodePool
assert launch produces portal session id and OPL launch token
assert OPL message can be sent after launch
assert trace receives corresponding session/run event
```

`advanced/admin`：

```text
assert normal user cannot access advanced server catalog
assert admin can see backing server plan, resource order, resource mapping
assert L3/COS audit state is visible to admin
assert unattributed costs do not appear as normal user charges
```

### 15.7 数据结构细化

建议把订阅从 workspace 维度提升到账号维度：

```text
labSubscriptions:
  id
  tenantId
  userId
  packageId
  status
  computeEntitlementId
  storagePoolId
  dailyPrice
  weeklyFreezeAmount
  currentFreezeId
  graceStartedAt
  cleanupAfterAt
  createdAt
  updatedAt
```

主存储池：

```text
labStoragePools:
  id
  tenantId
  userId
  includedStorageGb
  addonStorageGb
  totalStorageGb
  usedBytes
  status
  createdAt
  updatedAt
```

计算权益：

```text
labComputeEntitlements:
  id
  tenantId
  userId
  packageId
  computeTier
  cores
  concurrencyLimit
  runtimePoolId
  status
  createdAt
  updatedAt
```

项目仍保留，但只做组织和归因：

```text
projects:
  id
  tenantId
  userId
  slug
  title
  status
  storagePoolId
  createdAt
  updatedAt
```

存储文件记录必须保留 project 归属：

```text
workspaceFiles:
  id
  tenantId
  userId
  projectId
  storagePoolId
  kind
  relativePath
  sizeBytes
  status
  createdAt
  updatedAt
```

### 15.8 API 和错误码

普通用户 API：

```text
GET  /portal/api/lab-packages
GET  /portal/api/lab-subscription
POST /portal/api/lab-packages/activate
POST /portal/api/lab-packages/upgrade
POST /portal/api/lab-storage/addons
GET  /portal/api/lab-storage/pool
GET  /portal/api/lab-compute/entitlement
```

高级/管理员 API：

```text
GET /portal/api/advanced/server-plans
GET /portal/api/admin/resource-mappings
GET /portal/api/admin/cost-audit
GET /portal/api/admin/unattributed-costs
```

错误码必须稳定：

| HTTP | code | 含义 |
| --- | --- | --- |
| 402 | `insufficient_balance_for_weekly_freeze` | 余额不足以完成周冻结 |
| 402 | `payment_required_for_package` | 未开通套餐且无可用试用 |
| 403 | `advanced_route_forbidden` | 普通用户访问高级路径 |
| 409 | `subscription_already_active` | 已有 active subscription |
| 409 | `package_unavailable` | 套餐后台资源不可用 |
| 409 | `storage_quota_exceeded` | 主存储池容量不足 |
| 409 | `grace_period_active` | 宽限期内禁止新上传或新收费运行 |
| 422 | `invalid_package_transition` | 不允许的套餐切换 |
| 503 | `runtime_pool_capacity_pending` | 计算资源准备中 |

前端不得把这些 code 原样展示给普通用户。普通用户看到产品文案，管理员看到技术详情。

### 15.9 v19 到 v20 迁移策略

迁移必须幂等，不删除 v19 数据。

迁移步骤：

```text
读取 v19 users/wallets
-> 为符合条件用户创建 lab subscription
-> 为 subscription 创建主存储池
-> 将现有 storageOrders 映射为 included storage 或 addon storage
-> 将 task spaces 映射为 projects
-> 保留 resourceOrders 作为后台 resource mapping 和审计依据
-> 写 labPackageEvents 记录 migration
```

迁移断言：

```text
重复运行迁移不会创建重复 subscription
钱包余额不变
ledger 不被重写
旧 workspace 文件仍可下载
旧 resourceOrders 仍可在 admin 审计中看到
普通用户不再需要为旧 workspace 单独购买存储
```

### 15.10 OPL、Portal、Trace、Billing 端到端验收

live E2E 必须验证真实用户路径：

```text
新用户注册
-> 管理员充值
-> 开通入门套餐
-> 周冻结成功
-> 默认项目创建成功
-> 主存储池可用
-> portal.medopl.cn 总览加载
-> opl.medopl.cn 可打开
-> OPL 可以发送消息
-> trace 可以收到对应 session/run
-> 上传文件成功
-> 输出文件可下载
-> 账单页出现套餐日扣款
-> 升级进阶套餐
-> 存储从 10GB 变为 100GB
-> 计算权益从 2 核变为 8 核
-> 余额不足进入宽限期
-> 宽限期内可下载，不可新上传和新收费运行
```

性能验收：

```text
portal.medopl.cn /healthz 正常
portal.medopl.cn 首屏加载有数据
opl.medopl.cn /healthz 正常
opl.medopl.cn 可以登录和发送消息
trace 页面能看到新消息对应记录
进入 OPL 不等待 L3/COS T+1
进入 OPL 不同步创建 TKE node pool
```

### 15.11 Sentrux 结构 gate

当前 v20 结构检查结果：

```text
sentrux check .
Quality: 0.6633 < 0.69
modularity: 0.6885 < 0.8000
equality: 0.3483 < 0.3500
```

v20 开发不能只追功能跑通。每个阶段结束必须跑：

```bash
sentrux check .
```

目标：

```text
quality >= 0.69
modularity >= 0.80
acyclicity == 1.00
max_cycles == 0
max_upward_violations == 0
```

模块边界要求：

- Portal 不直接导入腾讯云客户端；
- Billing 不导入 Portal 内部用户/钱包逻辑；
- Provisioner 不操作 wallet/ledger；
- Runtime Bridge 不操作套餐扣款；
- Gateway 不读 Portal 持久化；
- 上游 `one-person-lab` 源码不可改；
- v20 套餐逻辑不塞回 `portal-runtime.mjs`。

### 15.12 商业闭环判断

v20 的商业逻辑闭环成立条件：

```text
客户充值
-> 开通套餐
-> 周冻结
-> 每日套餐扣款
-> 存储和计算权益生效
-> OPL 可用
-> 运行和文件可归因
-> 余额不足提醒
-> 7 天宽限期
-> 清理队列
-> 后台云成本审计
```

这条链路完成后，普通用户商业闭环成立。

但完整商业 GA 还需要后台运营闭环：

```text
资源映射完整
-> L3/COS T+1 可审计
-> 未归因成本进入队列
-> 管理员可查 resource mapping
-> 删除/清理可验证
-> Sentrux gate 通过
-> live E2E 通过
```

因此 v20 的发布口径应分两级：

```text
v20 commercial package beta:
  套餐、周冻结、日扣款、余额宽限、OPL 主链路通过。

v20 commercial GA:
  beta 条件 + 后台成本审计 + 清理闭环 + Sentrux gate + live E2E 全通过。
```
