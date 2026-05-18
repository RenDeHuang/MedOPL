# MedOPL v22 Portal UI Design Generation Brief

本文档面向 Google Stitch、Figma Make、Figma 设计师和前端 UI 实现者。它不是合同，不替代 `docs/recovery/portal-ui-design-prd.md`、`DESIGN.md`、v22 contracts 或 Figma Make ZIP surface gate；它把 Portal UI 需求转成可直接生成设计稿的 brief。

用途：

- 给 Google Stitch / Figma Make 生成 Portal UI 设计稿。
- 给设计师理解目标人群、页面任务、视觉方向和禁区。
- 给前端工程师把设计稿落回 React/Vite Portal 时检查是否偏离 v22 主线。

## 1. 一句话产品定义

MedOPL Portal 是面向 AI 小白科研用户的托管 OPL 科研工作台控制面。用户在这里看服务是否可用、进入 OPL、管理工作空间文件、查看任务结果、理解余额/冻结金额/停止计费状态，并在需要时释放计算资源但保留文件空间。

Portal 不是云资源控制台，不是营销官网，不是 OPL chatbot，也不是管理员运维后台的普通用户版本。

## 2. 目标人群

### 2.1 主要用户：AI 小白科研用户

画像：

- 有科研任务、论文实验、数据处理或文档分析需求。
- 会用网页产品，但不理解 CVM、COS、K8s、TKE、节点池或云资源配置。
- 关心“我能不能开始任务”“文件在哪里”“结果在哪里”“余额够不够”“会不会继续扣费”。
- 不希望看到复杂云资源术语，也不想配置基础设施。

核心焦虑：

- 不知道自己买的是什么服务。
- 不知道现在能不能进入 OPL。
- 不知道不能用时缺哪一步。
- 不知道上传的文件和生成的结果在哪里。
- 不知道费用是否正常、是否还在扣费。
- 不知道释放计算资源会不会删掉文件。

设计目标：

- 让用户一眼看到当前服务状态和下一步。
- 用“工作台、工作空间、文件空间、计算资源、余额、冻结金额、任务与结果”这些用户语言表达。
- 避免让用户做云资源管理员才懂的判断。

### 2.2 次要用户：管理员 / 运营

画像：

- 管理用户管理、余额、工作空间、任务记录、账单处理和审计记录。
- 需要高密度列表、筛选、搜索、状态标签和操作确认。
- 可以理解更专业的运营信息，但不应把普通用户页面变成后台。

设计目标：

- 管理台与普通用户工作台在同一产品壳内，但导航、权限和视觉层级清晰隔离。
- 管理页更高密度、更偏列表和表格。
- 普通用户不应看到管理入口或全局数据。

## 3. 设计北极星

让用户进入 Portal 后 30 秒内能回答：

1. 我买了什么托管科研工作台服务？
2. 我的 OPL 工作台现在能不能用？
3. 如果不能用，还缺哪一步？
4. 下一步应该点哪里？
5. 我的文件、任务、结果在哪里？
6. 我的余额、预扣费、冻结金额和停止计费状态是否正常？
7. 我什么时候应该释放计算资源但保留文件空间？

所有页面和组件都要服务这些问题。

## 4. 产品主线流程

### 4.1 普通用户主流程

1. 用户登录 Portal。
2. 进入总览，看到服务状态和下一步。
3. 如果运行环境未准备好，去运行环境页选择套餐或查看开通状态。
4. 如果需要科研执行，点击进入 OPL。
5. 在 OPL 完成模型调用密钥确认、发送消息、上传文件、跑任务。
6. 回到 Portal 查看工作空间里的输入文件、输出文件和结果。
7. 查看任务与结果页，确认 session、run、artifact、费用估算和状态。
8. 查看账单与审计页，确认余额、冻结金额、今日消费、累计消费和停止计费状态。
9. 不再需要计算时释放计算资源，同时确认文件空间仍保留。

### 4.2 管理员主流程

1. 管理员登录 Portal。
2. 进入管理总览，查看今日用户、工作空间、任务、消费和待处理事项。
3. 在用户管理页搜索用户，处理充值、退款、禁用、恢复或删除。
4. 在账单处理页查看待处理记录、成本构成和最近调整。
5. 在任务记录页查看运行状态和成本线索。
6. 在审计记录页查看事件来源、操作人、工作空间归属和时间线。
7. 在站点设置页维护站点名称、首页内容、注册开关和服务状态。

## 5. 信息架构

### 普通用户导航

- 总览
- 运行环境
- 工作空间
- 任务与结果
- 账单与审计
- 进入 OPL

### 管理台导航

- 管理总览
- 用户管理
- 运行环境管理
- 任务记录
- 账单处理
- 审计记录
- 站点设置
- 服务状态，仅 ops 权限可见

### 应用壳

- 左侧固定导航，移动端变抽屉。
- 顶部栏展示当前页面标题、服务可用状态、帮助、公告、主题切换、用户菜单。
- 普通用户和管理台要在导航分组、颜色权重和页面标题上明确区分。

## 6. 需要生成的核心屏幕

设计工具优先生成以下 8 个屏幕。前 5 个是普通用户主线，后 3 个是管理台主线。

### 6.1 总览

页面目标：

- 做成服务状态控制台，不是介绍页。
- 首屏回答“现在能不能用”和“下一步点哪里”。

首屏必须包含：

- 服务摘要：托管 OPL 科研工作台。
- 当前状态：可进入 OPL / 需处理 / 准备中 / 受限。
- 唯一主行动：进入 OPL、开通运行环境、查看结果或处理余额。
- 环境摘要：套餐、计算资源、文件空间、释放状态。
- 费用摘要：余额、冻结金额、今日消费、累计消费。
- 文件/任务/结果摘要：最近任务、输入文件、输出文件、运行轨迹。
- 职责边界：Portal 负责状态、文件、账单、审计和释放；OPL 负责科研执行。

视觉建议：

- 顶部用一条横向状态区，包含状态、原因和主按钮。
- 下方用 2 到 3 列信息区组织费用、运行环境、任务结果。
- 不要做营销 hero，不要大面积空洞插画。

### 6.2 运行环境

页面目标：

- 解释计算资源、文件空间、套餐、冻结金额、释放和审计状态。

必须包含：

- 当前套餐和规格。
- 计算资源状态。
- 文件空间状态。
- 任务并发。
- 预计费用 / 预扣费 / 冻结金额。
- 释放计算资源操作。
- 停止计费确认。
- T+1 审计状态。

关键表达：

- 释放计算资源只停止计算计费和任务续用。
- 释放计算资源不会删除文件空间。
- 文件空间保护期和计算资源释放是两个不同概念。

视觉建议：

- 使用状态条、能力卡和释放审计卡。
- 危险操作放在清晰分区里，不与普通操作同权。

### 6.3 工作空间

页面目标：

- 让用户管理输入文件、输出文件、工作空间和 OPL 入口。

必须包含：

- 当前工作空间摘要。
- 文件空间容量和保留状态。
- 输入文件列表。
- 输出文件列表。
- 最近任务或结果回流。
- 进入 OPL 的入口。
- 空态：没有输入文件、没有输出文件、文件空间未开通。

视觉建议：

- 输入文件和输出文件分区展示。
- 文件列表适合表格或紧凑列表，移动端转卡片。
- 文件状态用清楚标签：已上传、处理中、已生成、已保留、受限。

### 6.4 任务与结果

页面目标：

- 展示 session、run、artifact、输出文件、资源用量和费用估算。

必须包含：

- 状态摘要：运行中、完成、失败、等待、审计中。
- 筛选器：时间、状态、工作空间。
- 任务列表：任务名称、工作空间、状态、输出文件、费用估算、更新时间。
- 详情入口：查看轨迹、查看输出文件。
- 空态：暂无任务，并提示从 OPL 开始任务。

视觉建议：

- 以表格为主，顶部有摘要和筛选。
- 不做日志控制台，不展示 raw prompt 或内部路径。

### 6.5 账单与审计

页面目标：

- 让用户理解余额是否正常、是否仍在扣费，以及流水和审计状态。

必须包含：

- 余额。
- 可用余额。
- 冻结金额。
- 今日消费。
- 累计消费。
- 预扣费 / 运行中扣费。
- 停止计费状态。
- T+1 审计状态。
- 工作空间费用。
- 任务费用。
- 流水列表。

视觉建议：

- 顶部指标卡，下面是趋势/筛选，再下面是流水表。
- 金额和状态必须可扫，不要只靠颜色。
- 账单和审计要放在一起，但字段要分开。

### 6.6 OPL 进入页

页面目标：

- 展示从 Portal 进入 OPL 的启动过程。

必须包含：

- 启动阶段：准备工作空间、确认密钥绑定、绑定 session、进入 OPL。
- 当前状态：准备中、可进入、失败。
- 失败原因和下一步。
- 自动跳转提示。

视觉建议：

- 用 stepper 或阶段列表。
- 不展示 raw key、token 或 launch URL 敏感参数。
- 页面要轻，不做复杂 dashboard。

### 6.7 管理总览

页面目标：

- 给管理员快速看平台状态和待处理事项。

必须包含：

- 今日用户。
- 工作空间数量。
- 今日任务。
- 今日消费。
- 待处理账单。
- 释放/审计异常。
- 管理入口列表。

视觉建议：

- 高密度 KPI + 待处理列表。
- 管理台颜色可以略微区别普通用户区，但仍属于同一产品体系。

### 6.8 用户管理

页面目标：

- 管理用户管理、余额和账户状态。

必须包含：

- 搜索和筛选。
- 用户列表。
- 余额。
- 注册状态。
- 账户状态。
- 操作：创建、编辑、禁用、恢复、充值、退款、删除。
- 操作 modal：确认、错误、保存中。

视觉建议：

- 桌面表格，移动端卡片。
- 危险操作需要二次确认。
- 资金操作和账户删除不能视觉同权。

## 7. 组件清单

设计稿应包含这些组件及状态：

- App sidebar：普通用户组、管理台组、移动端展开态。
- App header：标题、状态、帮助、公告、主题、用户菜单。
- Service status strip：可用、需处理、准备中、受限。
- Next action panel：唯一主行动 + 次级链接。
- Metric card：余额、冻结金额、今日消费、文件空间、任务数。
- Status badge：可用、受限、等待、运行中、完成、失败、审计中、已停止计费。
- Data table：ready、empty、loading、error。
- Mobile list card：移动端表格替代形态。
- Filter toolbar：时间、状态、工作空间、搜索。
- Empty state：空文件、空任务、空账单、未开通环境、未绑定密钥。
- Action toolbar：主行动、次行动、危险操作。
- Modal / dialog：确认、表单、公告、帮助、错误。
- Release audit card：释放中、停止计费确认中、审计中、完成。
- File link card：输入文件、输出文件、保留状态。
- Task run card：session、run、artifact、费用估算。

## 8. 状态覆盖

每个核心页面至少要有这些状态设计：

- 加载中。
- 正常可用。
- 空态。
- 受限态。
- 部分能力不可用。
- 保存中或处理中。
- 成功完成。
- 失败或错误。
- 禁用操作。

关键业务状态：

- 工作台可进入。
- 工作台需处理。
- 运行环境未开通。
- 运行环境准备中。
- 运行环境可用。
- 运行环境释放中。
- 已停止计费。
- 文件空间可用。
- 文件空间受限。
- 文件空间保护期。
- 余额充足。
- 余额偏低。
- 冻结金额消耗中。
- 审计中。
- 审计完成。

## 9. 视觉方向

关键词：

- 科研工作台。
- SaaS 控制面。
- 状态驱动。
- 高可扫描。
- 克制、专业、可信。
- 信息密度高但不拥挤。
- 中文清晰。

建议视觉：

- 浅色为主，支持深色模式。
- 使用中性背景、轻边框、明确状态色。
- 主色只用于主行动和当前导航。
- 卡片圆角不超过 8px。
- 表格、列表、指标卡和状态条比大插画更重要。
- 管理台密度高于普通用户页。

避免：

- 营销首页风格。
- 大 hero + 大插画。
- 云控制台风格。
- 单一蓝紫渐变铺满全站。
- 装饰性渐变球、玻璃拟态、过度阴影。
- 卡片套卡片。
- 超大标题占满首屏。

## 10. 文案规则

文案必须短、直接、动作明确。

推荐写法：

- 工作台可用。
- 运行环境和文件空间已就绪。
- 进入 OPL。
- 文件空间已保留。
- 计算资源释放后将停止计算计费。
- 余额不足时将消耗冻结金额。
- 输出文件已回到工作空间。

避免写法：

- 本平台为您提供综合云资源管理能力。
- 请前往 CVM / COS / K8s 处理资源。
- 当前 resourceBinding 状态为 active。
- 任务 trace metadata 已同步至外部观测系统。

普通用户禁用主语言：

- 云资源控制台
- CVM
- COS
- K8s
- TKE
- 节点池
- 对象存储
- raw status
- internal id
- resourceBindingId
- objectKey
- signedUrl
- kubeconfig
- SecretId
- SecretKey

## 11. 设计生成提示词

可直接给 Google Stitch / Figma Make 使用：

```text
Design a production SaaS web app UI for MedOPL Portal, a managed One Person Lab research workspace control plane for non-technical AI research users.

The app is not a cloud console and not a marketing site. Users buy a managed OPL research workspace service with compute resources, file space, billing, audit, and release controls. Portal helps users understand whether the OPL workspace is usable, what step is missing, where files/tasks/results are, whether balance/frozen amount/stop-billing status is normal, and when to release compute while keeping file space.

Target users are non-technical research users. They should not see CVM, COS, K8s, TKE, node pool, object storage, raw API keys, tokens, signed URLs, or internal IDs as primary UI language.

Create a desktop-first responsive dashboard with a left sidebar, top header, light theme, optional dark theme, dense but readable SaaS workbench style, restrained colors, 8px or smaller corner radius, clear status badges, metric cards, tables, filters, empty states, modals, and mobile card alternatives.

Screens to design:
1. Overview: service status, whether user can enter OPL, one primary next action, environment summary, plan/compute/file-space/release status, balance/frozen/today/total spend, recent tasks, input/output files, Portal vs OPL responsibility boundary.
2. Runtime Environment: current plan, compute, file space, concurrency, estimated cost, preauthorization, frozen amount, release compute action, stop billing confirmation, T+1 audit.
3. Workspace: current workspace, file space usage, input files, output files, latest results, OPL entry, empty states for no files and no output.
4. Tasks and Results: session/run/artifact table, filters, status summary, output file links, resource usage, estimated cost, empty state.
5. Billing and Audit: balance, available balance, frozen amount, today spend, total spend, preauthorization, running charges, stop billing, audit status, workspace costs, run costs, ledger table.
6. OPL Launch: startup stepper showing workspace preparation, provider key bound status, session bind, launch readiness, failure reason, auto redirect.
7. Admin Dashboard: platform KPIs, customer accounts, workspaces, tasks, spend, pending billing/audit items.
8. Admin Users: searchable user table with balance/status/actions and modals for create/edit/recharge/refund/disable/restore/delete.

Use Chinese UI copy. Keep copy short and action-oriented. Primary CTAs should use verbs like 进入, 开通, 上传, 查看, 释放, 处理, 保存, 导出.

Do not design a chatbot in Portal. Do not design a cloud resource console. Do not expose secrets, raw API keys, launch tokens, runtime tokens, object keys, local paths, signed URLs, kubeconfig, SecretId, or SecretKey.
```

## 12. Figma Make 输出要求

生成设计稿时，请至少输出：

- 桌面端 1440px 主流程页面。
- 移动端 390px 的总览、工作空间、账单页面。
- 组件页：状态标签、指标卡、数据表格、筛选栏、空态、错误态、弹窗、释放审计卡。
- 普通用户和管理台的导航对比。
- ready、empty、loading、error、restricted、degraded、saving 状态样例。

每个 frame 命名建议：

- `Portal / Overview / Ready`
- `Portal / Overview / Restricted`
- `Portal / Runtime / Release Audit`
- `Portal / Workspace / Files Ready`
- `Portal / Workspace / Empty`
- `Portal / Tasks Results / Ready`
- `Portal / Billing Audit / Ready`
- `Portal / OPL Launch / Loading`
- `Admin / Dashboard / Ready`
- `Admin / Users / Ready`
- `Components / Workbench Primitives`

## 13. 设计验收清单

设计稿交付后，用以下问题验收：

- 是否一眼看出这是托管科研工作台，而不是云控制台？
- 是否清楚区分 Portal 和 OPL 的职责？
- Overview 首屏是否有唯一主行动？
- 普通用户是否不用理解云资源术语？
- 计算资源和文件空间是否分开表达？
- 释放计算资源是否不会被误解为删除文件？
- 余额、可用余额、冻结金额、今日消费、累计消费是否分开？
- 输入文件和输出文件是否分开？
- 任务、结果和账单是否有清楚链路？
- 管理台是否与普通用户页面隔离？
- 移动端是否无横向溢出？
- 是否覆盖 loading、empty、error、restricted、degraded、success、failure？
- 是否没有 raw key、token、signed URL、object key、kubeconfig 或内部路径？

如果以上任一项不成立，设计稿不能直接进入前端实现。
