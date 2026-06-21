# MedOPL 资源控制台设计源

模型记录：`gpt-5.4`

归属：`MedOPL Portal`
用途：`portal_ui_grammar_and_bias_gates`
状态：`active_design_source`
机器边界：本文件是人读设计源，不是机器接口。机器真相由 `contracts/`、Portal 源码、tests、fixtures、runner、CLI/API 行为和 runtime evidence 持有。

本文件把 MedOPL 当前产品真相转成可执行的 UI 语法、Figma 约束、代码组件映射和验证边界。它不替代 `docs/product/README.md`、`contracts/medopl-product-profile.json`、`contracts/medopl-portal-page-state-matrix.json` 或前端实现。

## 设计原则

MedOPL Portal 是资源购买与计算资源管理 Portal。用户在这里购买和管理 OPL 需要的计算资源、存储空间、套餐、费用与释放能力，然后回到 OPL 做科研。

设计系统的任务不是让页面更“像大厂后台”，而是让用户一眼知道：买了什么资源、资源能不能用、存储空间里有什么、费用是多少、哪里购买 / 升级 / 释放、是否可以进入 OPL。

one-person-lab-app 的做法对 MedOPL 的启发是：App 仓库拥有用户界面真相，framework / runtime 只提供背后能力；外部 shell 和专业 agent 不抢 App 的用户界面真相。MedOPL 也一样：Portal 拥有资源控制台界面真相；OPL-Webui 拥有 chat-first 项目 / session / skill / 文件工作台；OPL 拥有 framework 和科研执行语义。MedOPL 不把 OPL-Webui 或 OPL 的主体验搬进 Portal。

## 产品真相门

MedOPL 是资源购买与计算资源管理 Portal，不是 chat，不是科研工作台，不是云控制台，不是 Trace 控制台。

普通用户进入 MedOPL 时，首屏只应该回答资源问题。所有页面都必须能回到这条主线：

```text
账号 / 余额
-> 套餐选择
-> 开通计算资源
-> 存储空间可用
-> 绑定工作空间
-> 查看存储清单和用量
-> 查看费用与账单
-> 释放计算资源并停止计费
-> 保留或销毁存储空间
-> 进入 OPL
```

不能把 local RC、设计稿、测试绿或浏览器截图写成 production complete。真实云、deploy、kubectl、build/push、live-test 和 owner receipt 仍走独立授权与 release gate。

## 产品对象语法

用户主界面只允许这些对象成为主面：

- 计算资源
- 存储空间
- 套餐
- 费用与用量
- 资源生命周期
- 进入 OPL

禁止成为用户主面的对象：

- chat
- session 主工作台
- skill 上传主界面
- raw trace
- raw log
- 云控制台字段
- secret / token / signed URL
- CVM / COS / K8s / TKE / kubeconfig / SecretId

允许作为资源视角投影的对象：

- 工作空间绑定状态
- 输入文件 / 输出文件资源清单
- 运行引用，只作为用量和计费引用
- artifact 引用，只作为存储清单引用
- audit receipt，只作为账单、释放和存储生命周期证据

## 用户任务流

用户侧任务流固定为八类：

1. 买资源：选择套餐，确认计算规格、存储容量、任务并发和价格。
2. 开通计算资源：查看开通条件、余额 / 冻结金额、provider key gate 和预计开通状态。
3. 查看存储：查看容量、已用空间、输入文件、输出文件、保留期和保护期。
4. 查看费用：查看余额、冻结金额、计算用量、存储用量、账单明细和审计状态。
5. 扩容：从套餐与购买或资源详情进入升级 / 扩容路径。
6. 释放：释放计算资源，明确释放不删除存储空间。
7. 停止计费确认：展示 120 分钟核对和 T+1 审计状态。
8. 进入 OPL：只展示是否满足进入条件和缺失步骤，不复制 OPL 工作台。

## 信息架构

用户侧固定为六个面：

- 资源总览
- 套餐与购买
- 计算资源
- 存储空间
- 费用与用量
- 进入 OPL

运维侧固定为八个面：

- 开通队列
- 用户账户
- 资源运维
- 存储运维
- 计费对账
- 审计
- 系统状态
- 套餐配置

用户侧不出现观测性或调试主导航。用量明细归费用与用量；文件归存储空间；审计只作为账单、释放和存储生命周期 receipt 支撑。运维侧可以展示内部 ID 和排障归因，但不能泄露 secret，也不能让普通用户看到云控制台字段。

## 视觉语法

用户侧视觉语法：

- 最大内容宽度优先使用 `1120px` 到 `1200px`。
- 首屏只保留一个主 CTA。
- 首屏核心资源卡不超过三张：计算资源、存储空间、费用与用量。
- 费用与用量首屏固定为一个 `BillingSummary`、一条资金状态带、下方账单表 / 分组明细；不恢复 6 张 KPI 卡墙。
- 不使用深色 admin sidebar 统治用户侧。
- 不做营销 hero，不做大面积渐变，不做装饰性背景。
- 表格只用于可比较集合；用户侧详情优先使用状态、摘要和短列表。
- 页面文案短句化，不能靠长段说明替代交互状态。
- 卡片只承载真实对象或重复项，不把每个 section 都包成卡片。
- 卡片圆角上限为 `8px`；默认组件不得恢复大圆角卡片墙。
- Logo 不拥有页面语义 `h1`；当前页面内容标题拥有唯一 `h1`。
- 导航、顶栏按钮和主动作的移动触控目标不得小于 `44px`。
- 移动端不能横向溢出；表格必须折叠为卡片列表或横向安全容器。
- 品牌主色冻结为 Teal `#0F766E`。用户侧主视觉不得使用默认科技蓝或默认紫作为主色。
- 基础交互必须覆盖 hover、active、focus-visible、disabled 和 cursor；可点击控件默认不是 `cursor: default`。
- motion 只允许颜色、背景、边框、阴影、transform 和 opacity 这类轻属性；不得使用 `transition-all`，并必须尊重 reduced motion。
- A+/S 级 UI 冻结原则，不冻结像素；冻结组件状态一致性、状态反馈、响应式表格、管理台标题层级和空错态恢复底线。
- 用户可见文案使用中文资源控制面叙事；不得泄漏 `workspace`、`Runtime`、`not_activated`、`funded`、`MedOPL plan catalog`、`mutation`、`runner phase`、`claim`、`future-authorized`、`ops_surface_disabled` 这类工程或后端状态词。

运维侧视觉语法：

- 运维首页优先展示待处理队列，而不是 KPI 墙。
- 表格允许更高密度，但必须保留筛选、空态、失败态和行级动作。
- 高风险动作必须放入确认弹窗或 drawer，不允许裸按钮直接执行。

## 语义令牌

语义令牌不是颜色表，而是产品状态语言。Figma variables 和 CSS variables 必须同名，或在 contract 中有明确映射。

当前基础令牌：

- `resource.active`：计算资源可用。
- `resource.blocked`：计算资源不可用或条件未满足。
- `billing.warning`：余额、冻结金额、扣费或审计需要注意。
- `release.pending`：释放或停止计费处于等待确认。
- `storage.protected`：存储空间进入保留 / 保护期。

CSS 变量名使用短横线映射：

- `--resource-active`
- `--resource-blocked`
- `--billing-warning`
- `--release-pending`
- `--storage-protected`

语义令牌必须优先服务状态和可读性，不允许为了“清爽风”降低对比度或隐藏失败状态。

## 组件语法

组件先表达任务和状态，再表达装饰。AI、Figma 和代码都必须从这些组件语法组装页面，不允许临时拼出新主面。

核心组件：

| 组件 | 用途 | 主要属性 |
| --- | --- | --- |
| `ResourceStatusCard` | 展示计算资源是否可用、规格、释放状态和下一步动作 | `status`, `title`, `spec`, `primaryAction`, `receiptState` |
| `PlanCard` | 展示套餐、价格、计算规格、存储容量和购买动作 | `planId`, `priceState`, `computeSpec`, `storageSize`, `purchaseState` |
| `StorageInventoryPanel` | 展示容量、已用空间、输入 / 输出文件和保留期 | `status`, `capacity`, `used`, `files`, `retentionState` |
| `BillingSummary` | 展示余额、冻结金额、计算用量、存储用量和账单状态 | `status`, `balance`, `freeze`, `usage`, `auditState` |
| `ReadinessChecklist` | 展示进入 OPL 或开通资源还缺什么 | `status`, `items`, `primaryAction` |
| `ReleaseConfirmDialog` | 释放计算资源和停止计费确认 | `status`, `resourceName`, `billingStopState`, `storageRetention` |
| `OpsQueueTable` | 运维侧处理开通、释放、账单、存储和审计队列 | `queueType`, `rows`, `filters`, `rowActions` |

当前 `ReleaseConfirmDialog` 只能标记为 `partial_fail_closed_pending_release_mutation`。真实 release mutation 未接入前，UI 只能展示“释放交互接入中”、停止计费和存储保留规则，不能 claim 释放确认交互已完成。

组件禁止承担的职责：

- `ResourceStatusCard` 不展示云控制台字段。
- `StorageInventoryPanel` 不展示 signed URL、object key 或本地路径。
- `BillingSummary` 不展示 raw trace metadata。
- `ReadinessChecklist` 不复制 OPL-Webui 的 chat/session/skill 工作台。
- `OpsQueueTable` 不成为普通用户组件。

## 状态 / 变体矩阵

核心组件必须覆盖这些状态：

- `loading`
- `empty`
- `ready`
- `blocked`
- `failed`
- `pending`
- `released`
- `protected`

状态含义：

- `loading`：数据读取中，必须有稳定高度或骨架，不能造成布局跳动。
- `empty`：用户尚未购买 / 尚未开通 / 尚无文件。
- `ready`：对象可用。
- `blocked`：缺余额、缺 provider key、缺存储、缺计算资源或权限不足。
- `failed`：开通、释放、对账或读取失败，需要恢复路径。
- `pending`：开通中、释放中、计费核对中或审计中。
- `released`：计算资源已释放，停止计费状态必须可见。
- `protected`：存储空间处于保护期，必须提示保留到期和限制。

每个状态都必须在 Figma variant、代码 props 和测试 fixture 中有同名或映射。缺状态不能通过高保真视觉稿补救。

## Figma 与代码映射

Figma 的组件、变体、变量、样式和 Code Connect 必须映射到代码组件 props。命名不一致时，contract 必须写明映射，不能靠人工记忆。

示例：

```text
Figma: ResourceStatusCard / status=active
Code:  ResourceStatusCard.status = "ready"
映射: resource.active -> --resource-active
```

如果 Figma 状态名和代码状态名不同，必须在 `contracts/medopl-portal-page-state-matrix.json` 的 `figma_code_mapping` 中声明。优先使用相同命名，减少映射层。

Figma 文件只能作为设计输入和审查面；repo 里的长期机器真相仍归 contracts、source、tests 和 runtime evidence。不要把 Figma 导出图、raw 截图、调试 payload 或临时视觉产物提交进 git。

## 页面模板

用户页使用清爽资源控制台模板：

- 顶部状态句：当前资源是否可用、存储是否正常、费用是否需要注意。
- 一个主 CTA：购买 / 升级 / 释放 / 进入 OPL 只能有一个最高优先级。
- 三个核心资源块：计算资源、存储空间、费用与用量。
- 次级详情使用短列表、drawer 或详情页，不在首屏铺满表格。
- 费用与用量页不使用 KPI 墙；首屏只放一个账务摘要、一条资金状态带，明细进入下方表格和分组列表。

运维页使用工作队列模板：

- 顶部展示待处理事项。
- 主体是开通、释放、账单、存储或审计队列。
- 行级动作必须有权限、禁用原因和审计结果。

购买页使用套餐对比和确认模板：

- 当前套餐、推荐套餐、价格、计算规格、存储容量、任务并发和预计开通时间。
- 购买 / 升级前必须展示费用边界和不能 claim 的能力。

详情页使用状态 + 用量 + 动作 + receipt 模板：

- 当前状态。
- 用量摘要。
- 可执行动作。
- receipt / 审计状态。
- 错误恢复路径。

## 交互和可访问性

交互必须先满足可达性，再谈视觉精致：

- 所有主动作必须能键盘访问。
- 焦点状态必须可见。
- 禁用按钮必须说明原因。
- 危险动作必须确认：释放计算资源、删除存储空间、退款、重试高风险开通。
- 释放计算资源必须提示“不删除存储空间”。
- 进入 OPL 必须展示 readiness checklist，不能只给一个失败 toast。
- 表格在移动端必须可读，不能靠缩小字体硬塞。
- 颜色不能是唯一状态表达；状态必须有文本或图标辅助。
- loading、empty、blocked、failed 必须有可理解文案和下一步。
- 关键状态摘要必须可被浏览器回归识别为状态反馈，并提供 live region；存在表格的页面必须使用响应式安全容器。

可访问性审计不能只靠截图；后续可引入更完整的 keyboard、aria、contrast 和 screen-reader 检查。当前 slice 只能 claim 基础可访问性语法已固定，不能 claim 完整审计完成。

Production ready 声明不能来自 UI 绿灯、合同绿灯、本地截图或 local RC。必须另有 staging / prod-like canary、角色边界浏览器 gate、release owner receipt、安全依赖 gate 和可观测 receipt；Release 仍处于 partial fail-closed 时不能声明 production complete。

## 验证 / 回归

UI 验证分四层：

1. `contract test`：验证产品对象和禁区。用户侧不得出现 chat、session 主工作台、skill 上传、raw trace、云控制台字段。
2. `component state test`：验证组件状态矩阵、语义令牌和 Figma 与代码映射存在。
3. `interaction test`：验证开通、释放、进入 OPL、账单查看、禁用态原因和恢复路径。
4. `visual test`：验证关键页面截图、移动端、无横向溢出、主 CTA 可见和关键视觉锚点。

视觉测试不能单独证明 UI 合格。截图可能因为环境变化产生噪声，也可能让糟糕页面稳定地通过。视觉测试只锁关键锚点，产品对象、状态、交互和可访问性仍由 contract、component state 和 browser interaction gate 共同判断。

## 防偏门

本仓 UI 自动化开发必须防三类偏倚：

- 风格偏倚：不能滑向通用 shadcn / Tailwind / Vercel 默认味，也不能滑回深色企业后台。
- 组件偏倚：不能因为组件库里有 card/table/sidebar，就把所有页面都堆成卡片、表格和侧栏。
- 验证偏倚：不能只测文字存在、路由能开或截图稳定；必须验证任务流、状态和禁区。

每次 UI 变更都要回答：是否复用现有组件语法、是否没有新增顶层入口、是否没有新增无 owner 的 contract、是否没有新增治理型 health test、是否没有把 Figma/raw evidence 提交进 git。

## 当前交付边界

本 slice 只固定 UI 语法和防偏 gate。它可以 claim：

- 资源控制台设计源已对齐当前产品真相。
- 用户侧对象、信息架构、视觉语法、语义令牌、组件语法和状态矩阵已进入合同 / 测试约束。
- 后续 Figma 和代码实现有共同语法，不再靠 prompt 自由生成。

本 slice 不能 claim：

- 最终高保真 UI 已完成。
- 完整可访问性审计已完成。
- Storybook / Figma Code Connect 已接入完成。
- 真实云执行、deploy、live-test 或 production complete。
