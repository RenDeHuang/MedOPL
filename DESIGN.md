# MedOPL v22 Portal Design Source

模型记录：`gpt-5.4`

本文件是 MedOPL v22 Portal UI 重构的设计执行源。它把 v22 合同中的产品真相转成可执行的视觉、信息架构、组件、文案、Figma Make 吸收和重构分片规则。

本文件不替代 v22 合同、Figma Make ZIP source-of-truth、`services/portal/frontend/src/app/**` 的 React/Vite 实现，也不替代 smoke。产品语义、角色边界、secret 边界、OPL 边界、云资源授权边界和验收入口仍以 `docs/specs/*`、`docs/recovery/*`、Figma Make ZIP、React app root 和 smoke 为准；历史 UI evidence 不再是当前 UI 完成证据，旧路径防回归统一由 retired frontend surface gate 承接。

## 订阅合同包

本设计源订阅以下 v22 合同和 recovery 状态：

- `docs/recovery/mvp-contract-acceptance.md`
- `docs/recovery/status-matrix.md`
- `docs/specs/README.md`
- `docs/specs/README.md`
- `docs/specs/README.md`
- `docs/specs/README.md`
- `docs/specs/README.md`
- `docs/specs/README.md`
- `docs/specs/README.md`
- `docs/specs/README.md`
- `docs/specs/README.md`

## 产品气质

MedOPL Portal 是平台托管的 OPL 科研工作台控制面。它不是云资源控制台，不是营销站，不是 OPL chatbot，也不是普通云资源管理台。

用户购买的是托管科研工作台、计算能力、文件空间和运行环境。用户需要理解服务是否准备好、能不能进入 OPL、任务和结果在哪里、费用是否正常、什么时候释放计算资源但保留文件空间。

Portal 负责准备、管理、进入、回流、账单、审计和释放：

- 准备：账号、套餐、余额、模型调用密钥绑定状态、工作空间和托管运行环境条件。
- 管理：托管运行环境、计算能力、文件空间、工作空间和状态回流。
- 进入：从 Portal 进入 OPL 工作台，或引导用户完成 OPL preflight。
- 回流：展示 OPL session、run、artifact、trace、输入文件和输出文件状态。
- 账单：展示余额、预扣费、冻结金额、累计消费、今日消费、停止计费和 T+1 审计状态。
- 审计：把释放、账单核对、任务失败、结果回流和管理台排障变成可查事实。
- 释放：释放计算资源，保留文件空间，并让用户看到停止计费确认。

OPL 负责科研执行、chatbot、agent、文件理解和结果生成。Portal 不把科研聊天搬进自己的页面，不复制 OPL 的交互，也不把 OPL 内部实现写成 Portal 主叙事。

## UI 重构目标

当前 Portal UI 的主要问题是说明书式、文字过多、组件表达弱、信息层级不够像 SaaS 科研工作台。重构目标是把页面从说明文档变成状态驱动的工作台。

目标状态：

- 页面用状态、行动、风险、结果和费用组织，而不是用长段说明组织。
- 首屏优先回答用户现在能做什么，而不是解释平台是什么。
- 组件承载事实：状态条、行动区、能力卡、任务卡、费用卡、释放审计卡。
- 文案变短，动作变明确，状态变可扫。
- 普通用户不用理解 CVM、COS、K8s、TKE、节点池、分账标签或内部归因字段。
- 管理台可以展示排障和归因，但必须与普通用户主线隔离。

普通用户首屏必须回答：

- 我买了什么？
- 现在能不能用？
- 下一步点哪里？
- 文件、任务、结果在哪里？
- 费用是否正常？
- 是否正在扣费？
- 什么时候释放计算资源但保留文件空间？

## 信息架构

Portal 信息架构按用户主线组织：服务状态 -> 下一步动作 -> 文件/任务/结果 -> 账单/释放/审计。

### Overview

Overview 是服务状态控制台，不是产品介绍页。

必须包含：

- 服务状态：托管 OPL 工作台是否可用。
- 下一步动作：进入 OPL、开通运行环境、处理密钥绑定、查看结果或查看账单。
- 运行环境摘要：套餐、计算能力、文件空间、释放状态。
- 账单摘要：余额、预扣费、冻结金额、今日消费、停止计费状态。
- 文件和任务摘要：输入文件、输出文件、最近 run、artifact、trace。
- 职责边界：Portal 负责准备和回流，OPL 负责科研执行。

避免：

- 大段介绍 MedOPL。
- 把 Overview 做成云资源仪表盘。
- 同时放多个同等突出的主按钮。
- 用内部枚举或 raw status 做主语言。

### Resources

Resources 表达托管运行环境、计算能力、文件空间、套餐、释放和审计。

必须包含：

- 当前套餐和可用计算能力。
- 文件空间额度和保留状态。
- 托管运行环境是否可用、受限、释放中或已停止计费。
- 释放计算资源和保留文件空间的差异。
- 审计和停止计费确认状态。

避免：

- 使用 CVM、COS、K8s、TKE、节点池、云资源控制台作为普通用户主语言。
- 把平台内部资源池当作用户要管理的对象。

### Workspace

Workspace 表达工作空间、输入文件、输出文件和保留状态。

必须包含：

- 当前工作空间。
- 输入文件列表和上传/准备状态。
- 输出文件列表和结果来源。
- 文件空间是否保留、是否受限、是否需要扩容。
- 文件与任务、结果、账单的关联提示。

避免：

- 把文件空间写成对象存储控制台。
- 暴露 objectKey、localPath、signedUrl、storageKey 或内部路径。

### Billing

Billing 表达余额、预扣费、冻结金额、累计消费、今日消费和账单记录。

必须包含：

- 当前余额和是否足够继续运行。
- 预扣费、冻结金额、运行中扣费。
- 累计消费和今日消费。
- 停止计费确认。
- T+1 审计状态。
- 账单记录和与 run/workspace 的关联。

避免：

- 把账单写成观测数据或 trace metadata。
- 用 Langfuse、OpenCost 或云账单原始字段作为普通用户主语言。

### Trace

Trace 表达运行轨迹、session、run、artifact 和审计 metadata。

必须包含：

- session 和 run 的状态。
- 输入文件、运行状态、输出结果之间的链路。
- artifact 是否已回流到工作空间。
- 失败、等待、运行中、完成、审计中等状态。
- trace metadata 的排障作用。

避免：

- 把 trace 做成日志控制台。
- 暴露 raw prompt、token、内部存储路径或 signed URL。

### Admin

Admin 只服务管理员和运维，不影响普通用户主线。

必须包含：

- 用户管理、工作空间、资源管理、任务记录、账单管理、审计记录、站点设置和服务状态。
- 全局状态、异常账单、释放失败、任务失败和审计查询。
- 后台归因字段可以在排障详情中出现，但不能成为普通用户主语言。

避免：

- 在普通用户导航暴露 admin 入口。
- 让普通用户看到全局账号、全局费用、全局任务或运维操作。

## 组件系统

组件系统的原则是：组件先表达状态和行动，再表达装饰。

### 页面骨架

#### DashboardPageLayout

用于总览型页面，例如 Overview、Resources、Billing 摘要。

承载：

- 页面级服务状态。
- 关键指标。
- 主行动区。
- 主要信息流。
- 次要详情区。

避免：

- 把所有区域都包成大卡片。
- 页面顶部放营销 hero。
- 页面 slot 内重复造布局。

#### TablePageLayout

用于多对象比较，例如账单记录、任务记录、审计记录、管理台列表。

承载：

- 标题和简短说明。
- 筛选和排序。
- 表格或移动端卡片列表。
- 分页。
- 批量或单行操作。

避免：

- 用卡片网格展示大量可比较对象。
- 没有空态、加载态或错误态。

#### DetailPageLayout

用于对象详情，例如 workspace、run、account、audit item。

承载：

- 主信息。
- 侧边状态。
- 关联文件、任务、账单和审计。

避免：

- 主次信息混在一列。
- 没有明确返回和下一步。

### 原语组件

#### PageSection

用于真实信息区块。标题要短，副标题只解释当前区块的用途。

承载：

- 一个清晰主题。
- 一组相关状态或列表。
- 可选行动。

避免：

- 作为装饰容器嵌套卡片。
- 承载跨域混杂信息。

#### MetricCard

用于关键数值，不用于长文案。

承载：

- 余额、今日消费、冻结金额、文件空间、任务数、会话数。
- 一条短 hint。

避免：

- 说明书段落。
- 多个同等颜色的指标导致主次不清。

#### StatusBadge

用于稳定状态映射。

承载：

- 可用、受限、等待、运行中、完成、失败、审计中、已停止计费。

避免：

- raw status。
- 内部枚举。
- 无解释的颜色。

#### DataTable

用于多对象比较。

承载：

- 账单记录。
- run 记录。
- 文件列表。
- 管理台记录。

避免：

- 单个对象详情。
- 文本过长导致横向溢出。

#### EmptyState

用于说明当前为什么没有数据，并给出下一步。

承载：

- 空文件、空任务、空账单、未开通环境、未绑定密钥。

避免：

- 只写“暂无数据”。
- 没有行动路径。

#### ActionToolbar

用于同一上下文下的动作集合。

承载：

- 主行动。
- 次行动。
- 危险操作。

避免：

- 多个主按钮并列。
- 危险操作和普通操作视觉同权。

#### FilterToolbar

用于列表筛选。

承载：

- 时间范围。
- 状态筛选。
- 工作空间筛选。
- 搜索。

避免：

- 把筛选散落在表格列头、卡片和页面顶部。

#### PaginationBar

用于列表分页。

承载：

- 当前页、总数、上一页、下一页。

避免：

- 让用户在长列表中迷失。

### 业务组件

#### 服务状态摘要

用于 Overview 首屏和 Resources 顶部。

承载：

- 工作台可用性。
- 托管运行环境状态。
- 文件空间状态。
- 计费状态。
- 释放状态。

避免：

- 长篇解释平台职责。
- 把云资源状态当作用户任务。

#### 下一步行动区

用于把当前状态转成唯一主行动。

承载：

- 进入 OPL。
- 开通运行环境。
- 处理密钥绑定。
- 上传文件。
- 查看结果。
- 查看账单。

避免：

- 多个主 CTA。
- 无状态依据的按钮。

#### 资源能力卡

用于 Resources 和 Overview 摘要。

承载：

- 套餐。
- 计算能力。
- 文件空间。
- 并发/队列。
- 释放策略。

避免：

- CVM、COS、K8s、TKE 主语言。

#### 文件链路卡

用于 Workspace 和 Overview 摘要。

承载：

- 输入文件。
- 输出文件。
- 文件空间保留。
- 与任务和结果的关系。

避免：

- 存储内部字段。

#### 任务运行卡

用于 Trace 和 Overview 摘要。

承载：

- session。
- run。
- artifact。
- 状态。
- 下一步。

避免：

- 日志化堆叠。
- raw trace metadata 作为主内容。

#### 账单风险卡

用于 Billing 和 Overview 摘要。

承载：

- 余额不足。
- 冻结金额。
- 预扣费。
- 运行中扣费。
- 异常账单。

避免：

- 把观测系统或云账单当作唯一真相。

#### 释放审计卡

用于 Resources、Billing 和 Admin。

承载：

- 释放计算资源。
- 保留文件空间。
- 停止计费确认。
- T+1 审计。

避免：

- 让用户误以为释放会删除文件。
- 让用户误以为停止计费立即等于审计完成。

## 文案规则

文案必须短句、状态优先、动作优先。

推荐模式：

- 状态：工作台可用。
- 原因：运行环境和文件空间已就绪。
- 动作：进入 OPL。

不要写成：

- “本平台为您提供一个集成了多种云资源能力的综合管理系统……”
- “当前 resourceBinding 状态为 active。”
- “请前往 CVM/COS/K8s 相关页面处理资源。”

规则：

- 每个区块标题不超过 12 个汉字，除非是业务专名。
- 每个说明句优先控制在一行到两行。
- 空态必须给下一步。
- 错误态必须说明用户能做什么，不能只显示失败。
- 主按钮使用动词：进入、开通、上传、查看、释放、处理。
- 状态用用户语言：可用、受限、等待、运行中、已完成、需处理、审计中、已停止计费。

避免：

- 说明书段落。
- raw status。
- 内部枚举。
- 斜杠组合词。
- 英文散落。
- “云资源控制台”“节点池”“CVM”“COS”“K8s”“TKE”作为普通用户主语言。
- “客户工作台”“平台管理台”“商业化”“SaaS 总览”“运维面”“运营总台”“告警中心”“账务”等禁用主语言。

中文主语言必须面向 AI 小白科研用户。管理员页面可以更专业，但默认摘要仍应优先使用用户管理、工作空间、任务记录、账单管理、审计记录和服务状态。

## 视觉规则

Portal 是高可扫描、高信息密度但不拥挤的 SaaS 科研工作台。

### 布局

- 页面第一屏优先放服务状态、下一步和关键摘要。
- 详情下沉，避免首屏变说明页。
- 桌面端使用稳定 grid、table 和 list。
- 移动端使用单列和可读卡片，禁止横向溢出。
- 管理台密度可以高于普通用户页。

### 卡片

卡片只用于真实信息单元，不做装饰堆叠。

使用卡片时：

- 一个卡片只承载一个主题。
- 卡片内有明确标题、状态、数据或行动。
- 卡片之间间距稳定。

避免：

- 卡片套卡片。
- 大面积空白卡片。
- 每个小字段都做成卡片。

### 圆角、阴影和边框

- 常规圆角建议不超过 8px。
- 表格、列表、状态条优先使用轻边框和稳定间距。
- 阴影只用于浮层、菜单和 modal。
- 不用大圆角、大阴影制造“高级感”。

### 色彩

状态色克制：

- 成功：可用、已完成、已停止计费。
- 警告：等待、冻结、审计中、余额不足前兆。
- 危险：失败、不可用、余额不足、释放失败。
- 主色：唯一主行动和当前选中状态。

避免：

- 单一蓝紫渐变支配全站。
- 装饰性渐变。
- 仅靠颜色表达状态。

### 字体和密度

- 页面标题服务于定位，不做营销式大标题。
- 组件标题短而明确。
- 数值使用稳定宽度和清晰单位。
- 表格和列表保持可比较。
- 避免负 letter spacing。

### 响应式

- 所有页面在移动端不得横向溢出。
- 长词、长 ID、金额、状态组合必须换行或截断。
- 表格在移动端必须有可读替代形态。
- 按钮文本不得挤压或覆盖。

## Figma Make 吸收流程

Figma Make 是当前 Portal 普通用户和管理员 UI 的实现源，不是 v22 产品真相源。DESIGN.md、v22 合同、`spec:v22-portal-figma-make-ui-implementation-boundary`、`services/portal/frontend/src/app/**`、`services/portal/frontend/src/app/data/portalAdapters.ts` 和 smoke 共同构成代码侧执行真相；历史 UI evidence 不再承载 current truth，旧路径防回归统一由 retired frontend surface gate 承接。

当前吸收基准已经固定。后续产品系统重构必须保持 Figma 页面视觉、布局、信息架构和主路径不变，只允许改变工程结构、组件复用、状态处理和 API adapter 连接；任何视觉或信息架构变更必须回到 Figma 侧重新确认。

推荐流程：

1. 先按合同确认 Figma Make 页面没有改变 v22 产品语义。
2. 清退历史 Vue / Pinia frontend surface 和旧路由。
3. 将 Figma Make 普通用户和管理员 React UI 纳入 `services/portal/frontend`。
4. 物理清退旧管理员 console residue，管理员 UI 改以新 ZIP 的 `src/app/pages/admin/*` 为准。
5. 用现有 `/portal/api/*` adapter 替换 mock-only 数据。
6. Codex 运行合同 smoke、surface suite、typecheck、build 和本地预览。
7. 只有通过验证且用户认可的分支，才交给 B ff-only 吸收。

Figma Make 吸收规则：

- Figma 可以调整视觉表达，不能改变产品语义。
- Portal 全体前端技术栈为 React + Vite + TypeScript + shadcn/Radix + lucide。
- 当前 Figma Make 覆盖普通用户端和管理员端；管理员导航显示依赖 `/portal/api/me` 角色投影，真实权限仍由 `/portal/api/admin/*` 后端校验。
- Figma 不得把 Portal 改成营销页、云控制台或 OPL chatbot。
- Figma 版本评审应并排比较完整页面，不只比较单个 hero。
- Figma 批注必须说明影响的页面、组件、状态和验收点。

## 后续重构分片

每个 slice 必须单独分支、单独验收、单独 commit。不得把多页重构、后端改动、依赖升级、真实云或 deploy 混进一个 UI slice。

### Slice 1: Overview dashboard redesign

目标：

- 把 Overview 从说明书式首页改成服务状态控制台。
- 首屏回答买了什么、能不能用、下一步点哪里、文件/任务/结果在哪里、费用是否正常。

范围：

- Overview view。
- Overview components。
- Overview fixtures。
- Overview evalset page task / surface invariants / React route anchors。

验收：

- 七个主线问题在首屏可回答。
- 有唯一主 CTA。
- 无云控制台语言。

### Slice 2: Resources redesign

目标：

- 把 Resources 改成托管运行环境和文件空间状态页。
- 清楚表达计算资源释放和文件空间保留。

范围：

- Resources view。
- Resources components。
- Resources fixtures。
- Resources evalset / React route anchors。

验收：

- 用户理解当前运行环境状态、套餐、算力、文件空间和释放审计。
- 不出现 CVM/COS/K8s/TKE 主语言。

### Slice 3: Workspace redesign

目标：

- 把 Workspace 改成输入文件、输出文件和文件空间保留状态页。

范围：

- Workspace view。
- Workspace components。
- Workspace fixtures。
- Workspace evalset / React route anchors。

验收：

- 输入文件和输出结果路径清楚。
- 释放后文件空间保留状态清楚。
- 不泄露 objectKey、localPath、signedUrl 或内部存储字段。

### Slice 4: Billing redesign

目标：

- 把 Billing 改成费用信任页。
- 清楚表达余额、预扣费、冻结金额、累计消费、今日消费、停止计费和 T+1 审计。

范围：

- Billing view。
- Billing components。
- Billing fixtures。
- Billing evalset / React route anchors。

验收：

- 用户能判断费用是否正常。
- 用户能理解释放后的停止计费和审计状态。
- 账单不依赖观测系统作为真相。

### Slice 5: Trace redesign

目标：

- 把 Trace 改成任务、run、artifact 和审计 metadata 的状态回流页。

范围：

- Trace view。
- Trace components。
- Trace fixtures。
- Trace evalset / React route anchors。

验收：

- session、run、artifact 链路清楚。
- 失败、等待、运行中、完成和审计中状态清楚。
- 不变成日志控制台。

### Slice 6: Admin redesign

目标：

- 把 Admin 改成管理员/运维排障与审计后台。
- 保持普通用户主线不受影响。

范围：

- Admin views。
- Admin components。
- Admin fixtures。
- Admin evalset / route anchors in a future same-stack leaf。

验收：

- admin role surface 与普通用户 surface 隔离。
- 管理员能查用户管理、工作空间、任务记录、账单管理、审计记录和服务状态。
- 不展示 secret，不执行真实云操作，不真实扣费。

## 验收命令

设计源分支必须通过：

```bash
node tests/regression/portal/regression-test-v22-portal-ui-design-quality-audit.mjs
node tests/regression/portal/regression-test-v22-portal-runtime-suite.mjs --group surface
git diff --check -- DESIGN.md docs scripts services/portal/frontend
```

后续 UI implementation slice 还应按对应 leaf 增加：

```bash
npm --prefix services/portal/frontend run typecheck
npm --prefix services/portal/frontend run build
node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk
```

## 非目标

本设计源分支不做以下事情：

- 不修改 Portal 后端业务语义。
- 不修改 Portal 后端、Gateway、Runtime Bridge 或 Runtime Agent。
- 不修改 deploy、`.sentrux`、adapters 或 one-person-lab upstream。
- 不读取 secret。
- 不调用真实云。
- 不执行 build/push/kubectl/live-test。
- 不新增与 Portal frontend React/Vite/Figma Make 吸收无关的依赖。
- 不把 Portal 改成云控制台、营销页、OPL chatbot 或普通云资源管理台。
