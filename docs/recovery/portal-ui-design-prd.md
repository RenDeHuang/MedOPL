# MedOPL v22 Portal UI Design PRD

> Current status: historical PRD draft, superseded for implementation by the Figma Make ZIP contract.
>
> 当前 Portal UI 的唯一实现 source-of-truth 是 `/mnt/c/Users/Administrator/Downloads/MedOPL+Portal+UI+Design+(1).zip`、`docs/contracts/v22-portal-figma-make-ui-implementation-boundary.md`、`docs/contracts/v22-portal-workbench-management-ui-composition-boundary.md`、`services/portal/frontend/src/app/**` 和 `services/portal/frontend/src/app/data/portalAdapters.ts`。本 PRD 只保留用户、人群、主流程和语义背景，不再作为前端文件结构、route、组件、harness、visual workbench、screenshot regression 或 API shape 的 current truth。

本文档把 MedOPL v22 Portal 的 UI 需求背景整理为历史 PRD。它描述 Portal 产品定位、目标人群、信息架构、状态模型、数据边界和文案规范，可作为理解需求的背景材料；实际开发、设计吸收和验收必须以 Figma Make ZIP、当前合同和 smoke 为准。

本文档不新增产品方向，不替代 v22 合同、`DESIGN.md`、Figma Make ZIP、`services/portal/frontend/src/app/**`、`services/portal/frontend/src/app/data/portalAdapters.ts` 或 smoke。任何实现仍必须以当前合同、ZIP surface gate、typecheck、build 和本地验证为准。

模型记录：

- 主任务：Codex 当前会话。
- 只读 subagent 1：`gpt-5.4-mini`，梳理 `services/portal/frontend` 路由、页面、组件、API 和状态。
- 只读 subagent 2：`gpt-5.4-mini`，梳理 UI 合同、`DESIGN.md`、历史 evalset、产品和架构约束。

## 1. 背景

MedOPL v22 是 One Person Lab 的 SaaS 托管科研工作台，采用 `platform-provisioned / customer-dedicated` 产品语义。用户购买的是托管 OPL 工作台服务、计算能力、文件空间和运行环境；平台负责开通、隔离、计费、审计和释放。

Portal 是这个产品的 SaaS 控制面。它不是云资源控制台，不是营销站，不是 OPL chatbot，也不是普通云资源管理台。Portal 的核心职责是让用户进入后快速理解：

- 我买的是什么托管科研工作台服务。
- 我的 OPL 工作台现在能不能用。
- 如果不能用，还缺哪一步。
- 下一步应该点哪里。
- 我的文件、任务、结果在哪里。
- 我的余额、预扣费、冻结金额和停止计费状态是否正常。
- 我什么时候应该释放计算资源但保留文件空间。

OPL 继续负责科研执行、chatbot、agent、文件理解和结果生成。Portal 不复制 OPL 的聊天和科研任务执行体验。

## 2. 合同订阅包

本 PRD 订阅以下合同和 recovery 约束：

- `docs/recovery/mvp-contract-acceptance.md`
- `docs/recovery/status-matrix.md`
- `docs/recovery/active-surface.md`
- `docs/contracts/README.md`
- `docs/contracts/v22-mvp-managed-opl-loop.md`
- `docs/contracts/v22-saas-control-plane-user-experience-boundary.md`
- `docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md`
- `docs/contracts/v22-portal-user-surface-boundary.md`
- `docs/contracts/v22-portal-admin-ops-surface-boundary.md`
- `docs/contracts/v22-portal-files-billing-trace-boundary.md`
- `docs/contracts/v22-portal-structure-failure-isolation-boundary.md`
- `docs/contracts/v22-portal-workbench-management-ui-composition-boundary.md`
- `docs/contracts/v22-portal-ui-design-quality-audit-boundary.md`
- `docs/contracts/v22-portal-opl-connection-boundary.md`
- `docs/contracts/v22-portal-opl-context-backflow-boundary.md`
- `DESIGN.md`
- `docs/product.md`
- `docs/architecture.md`
- `docs/contracts/v22-portal-figma-make-ui-implementation-boundary.md`
- `/mnt/c/Users/Administrator/Downloads/MedOPL+Portal+UI+Design+(1).zip`
- `/tmp/medopl-figma-make-source-admin`
- `services/portal/frontend/src/app/**`
- `services/portal/frontend/src/app/data/portalAdapters.ts`

授权边界：

- 本 PRD 只整理 Portal UI 设计，不执行真实云、deploy、build/push、kubectl 或 live-test。
- 不读取 secret、kubeconfig、token、SecretId、SecretKey、SSH private key 或 `.env`。
- 不修改 `deploy/*`、`.sentrux/*`、`adapters/*` 或 one-person-lab upstream。
- 不声明真实云资源、真实账单核对、真实 Langfuse trace source、真实生产部署或完整 OPL production E2E 已上线。

## 3. 产品目标

Portal UI 的目标是把 MedOPL 表达成一个状态驱动、可扫描、可操作的托管科研工作台控制面。

用户进入 Portal 后，应优先看到服务状态、下一步行动、文件/任务/结果链路、账单风险和释放审计，而不是阅读长段说明。页面用状态、行动、风险、结果和费用组织；组件承载事实，文案保持短句。

成功标准：

- 普通用户不用理解 CVM、COS、K8s、TKE、节点池、云资源清单或内部归因字段。
- 用户能从首屏判断是否可以进入 OPL，不能进入时知道缺哪一步。
- 用户能区分计算资源和文件空间，理解释放计算资源不等于删除文件空间。
- 用户能看到余额、可用余额、冻结金额、累计消费、今日消费、预扣费和停止计费状态。
- 用户能沿着输入文件、任务运行、输出文件和运行轨迹找到科研结果。
- 管理员能在独立管理台查看用户管理、服务状态、任务记录、账单处理和审计记录，但普通用户 surface 不串台。

## 4. 用户与角色

### 4.1 普通用户

普通用户是 AI 小白科研用户。主要任务是登录 Portal、确认服务状态、查看余额和套餐、进入 OPL、管理工作空间文件、查看任务结果、确认费用和释放计算资源。

普通用户可见主语言：

- 工作台
- 工作空间
- 运行环境
- 计算资源
- 文件空间
- 套餐
- 任务执行
- 输入文件
- 输出文件
- 运行轨迹
- 账单
- 余额
- 冻结金额
- 累计消费
- 今日消费
- 停止计费
- 审计

普通用户不可见：

- 管理员入口和全局数据。
- raw API key、token、launchToken、runtimeToken、objectKey、localPath、signedUrl、storageKey。
- CVM、COS、K8s、TKE、节点池、kubeconfig、SecretId、SecretKey 作为主语言。
- `tenantId`、`resourceBindingId`、`cloudOperationId`、`billingAttributionId` 等后台归因字段作为主叙事。

### 4.2 管理员

管理员负责用户管理、资源管理、任务记录、账单管理、审计记录、站点设置和服务状态。管理员页面可以展示更专业的运营和排障信息，但必须与普通用户主线隔离。

管理员可见主语言：

- 管理台
- 平台总览
- 用户管理
- 资源管理
- 任务记录
- 账单管理
- 审计记录
- 站点设置
- 服务状态

### 4.3 运维 surface

运维 surface 只对管理员可见，不进入普通用户导航。`/admin/ops` 可以作为服务状态页面入口保留；当后端返回 `ops_surface_disabled` 时，页面必须展示“平台托管运维入口未启用”的明确产品态。只有 `opsSurfaceEnabled` 为真时，页面才展示底层服务探针、运行环境管理、费用估算、账单核对、文件空间状态和审计事项排障详情。

## 5. 范围

### 5.1 本 PRD 覆盖

- Portal SPA 应用壳、顶栏、侧边栏和 role-based 导航。
- 普通用户页面：总览、套餐、运行环境、工作空间、OPL 进入、账单与审计、任务与结果。
- 管理台页面：管理总览、用户管理、站点设置、服务状态、账单处理、任务记录、审计记录，以及现有 portrait / ops 类页面。
- 通用 UI 原语、业务组件、状态模型、空态、错误态和响应式规则。
- 前端 API 模块和页面数据来源。
- ZIP surface gate、组件状态、响应式规则和 smoke 验收方式。

### 5.2 本 PRD 不覆盖

- 不定义真实云资源创建、释放、扩缩容或真实扣费流程。
- 不定义 build/push、kubectl、deploy、live-test 或生产发布流程。
- 不修改 one-person-lab upstream，不 import upstream 内部模块。
- 不把 Portal 改成 OPL chatbot，也不在 Portal 内重做科研聊天。
- 不引入新的前端框架、组件库或依赖升级。
- 不把历史 v19/v20/v21 入口、`user_owned`、`resource-order`、旧 runner/provisioner、OpenCost 主叙事或 Langfuse 主产品叙事恢复为 v22 主线。

## 6. 信息架构

Portal 信息架构按用户主线组织：

1. 服务状态：当前托管 OPL 工作台是否可用。
2. 下一步动作：进入 OPL、开通运行环境、处理密钥绑定、上传文件、查看结果或查看账单。
3. 文件 / 任务 / 结果：工作空间、输入文件、输出文件、session、run、artifact 和 trace。
4. 费用 / 释放 / 审计：余额、预扣费、冻结金额、运行中扣费、停止计费、T+1 审计。
5. 管理与排障：用户管理、任务记录、账单处理、服务状态、审计记录。

页面分层：

- `src/app/components/Layout.tsx`：应用壳，承载侧边栏、顶栏和主内容区。
- `src/app/routes.tsx`：普通用户 active routes。
- `src/app/pages/*`：Figma Make ZIP 页面结构，只增加必要的 Portal API query wiring。
- `src/app/components/ui/*`：Figma Make / shadcn-Radix UI primitives。
- `src/app/data/portalAdapters.ts`：承载 loader、query、formatter、action handler 和 `/portal/api/*` 到页面 model 的映射。
- `src/api/portal/*`：承载 HTTP 请求和类型映射。
- Figma Make ZIP surface gate：承载可执行 UI truth。

## 7. 导航与应用壳需求

### 7.1 侧边栏

侧边栏必须清楚分隔普通用户和管理台。

普通用户导航：

- 总览：`/overview`
- 运行环境：`/resources`
- 工作空间：`/workspace`
- 任务与结果：`/trace`
- 账单与审计：`/billing`
- 进入 OPL：`/opl-launch`

管理台导航仅管理员可见。服务状态页面可以在管理员导航中出现；当 `opsSurfaceEnabled` 未启用时必须展示 disabled 产品态，不得显示 generic error。运行环境管理等更深 ops surface 仅在 `opsSurfaceEnabled` 为真时展示详情。

侧边栏底部必须保留 Portal/OPL 职责边界表达：平台托管开通、计费、审计和释放；科研执行进入 OPL。

### 7.2 顶栏

顶栏承担页面定位和全局辅助交互：

- 页面标题和副标题。
- 移动端导航开关。
- 服务可用状态。
- 帮助弹窗。
- 公告弹窗。
- 主题切换。
- 用户菜单和退出登录。

帮助内容必须围绕账户、工作空间、托管运行环境、费用和账单，不得引导用户去云控制台处理资源。

### 7.3 权限与路由保护

管理员路由必须通过 `requiresAdmin` 校验。运维 surface 必须通过 `requiresOpsSurface` 校验。普通用户访问管理台时应回到 `/overview`；管理员缺少 ops surface 权限时应回到 `/admin/system`。

## 8. 页面需求

### 8.1 总览 `/overview`

定位：服务状态控制台，不是产品介绍页。

必须回答：

- 用户买了什么托管科研工作台服务。
- 当前是否可以进入 OPL。
- 如果不能进入，还缺哪一步。
- 下一步应该点哪里。
- 文件、任务、结果在哪里。
- 费用是否正常。
- 什么时候释放计算资源但保留文件空间。

关键 surface：

- `overview.hero`
- `overview.financial_metrics`
- `overview.managed_environment`
- `overview.recent_runs`
- `overview.plans`
- `overview.workspace`

需求：

- 首屏必须有状态驱动的唯一主行动。
- 展示托管服务摘要、运行环境、套餐、计算能力、文件空间、释放状态和职责边界。
- 展示余额、冻结金额、累计消费、今日消费和账单风险。
- 展示最近任务、输入文件、输出结果和 trace 链路。
- 不使用营销 hero，不把页面做成云资源仪表盘。

### 8.2 套餐 `/packages`

定位：套餐目录和升级/扩容操作页。

必须回答：

- 当前可选套餐是什么。
- 基础套餐、Pro 套餐和自定义规格有什么差异。
- 计算资源、文件空间和任务并发如何组合。
- 调整计划是否只是一份计划，不代表真实开通已执行。

需求：

- 展示基础套餐 `2c / 4GB + 10GB 文件空间 + 1 个任务并发`。
- 展示 Pro 套餐 `8c / 16GB + 100GB 文件空间 + 2 个任务并发`。
- 展示叠加计算、叠加存储和自定义规格入口。
- 计划生成必须明确为 dry-run / 计划摘要，不表达真实云资源已创建。
- 不把套餐选择写成用户配置 CVM、COS 或 K8s。

### 8.3 运行环境 `/resources`

定位：托管运行环境、计算资源、文件空间、冻结金额和释放审计状态页。

关键 surface：

- `resources.hero`
- `resources.plan_selection`
- `resources.adjustment`
- `resources.current`
- `resources.release_audit`

必须回答：

- 当前套餐、计算规格、文件空间和并发数。
- 运行环境是否可用、受限、释放中或已停止计费。
- 预计费用、预扣费、冻结金额和审计状态。
- 释放计算资源与保留文件空间的差异。

需求：

- 计算资源生命周期和文件空间生命周期必须分开表达。
- 释放计算资源必须表达为停止计算计费和任务续用，不得暗示文件空间会被删除。
- 文件空间保护期只在删除存储资源 / 文件空间或独立欠费保留策略下出现。
- 操作区必须区分普通操作和危险操作。
- 不把平台后台资源池当成用户要管理的云对象。

### 8.4 工作空间 `/workspace`

定位：用户日常文件、任务和结果入口。

关键 surface：

- `workspace.hero`
- `workspace.file_space`
- `workspace.managed_plan`
- `workspace.list`
- `workspace.files`

必须回答：

- 当前工作空间是什么。
- 输入文件在哪里，状态如何。
- 输出文件在哪里，来自哪个任务。
- 文件空间是否保留、受限、需要扩容或处于保护期。
- 如何进入 OPL 开始科研任务。

需求：

- 输入文件和输出文件必须分区展示。
- 文件空间额度、已用量、保留状态和保护期必须明确。
- 下载入口必须只暴露业务文件引用，不展示 `objectKey`、`localPath`、`signedUrl` 或内部路径。
- 空文件、空输出、文件空间未开通等状态必须分别给出下一步。
- 批量下载、批量删除和危险操作必须有明确确认。

### 8.5 OPL 进入 `/opl-launch`

定位：Portal 到 OPL 工作台的启动中间态。

必须回答：

- 当前 OPL 启动处于哪个阶段。
- 是否已具备 provider key bound status。
- 工作空间、session bind、launch status 是否准备好。
- 准备完成后将进入哪个 OPL URL。
- 失败时用户能做什么。

需求：

- 轮询启动状态并展示阶段进度。
- 准备完成后自动进入 OPL 工作台。
- 失败时显示明确原因，不以成功页面掩盖未完成状态。
- 不在 URL、浏览器持久化状态、日志或 evidence 中写入 raw API key、launchToken、runtimeToken 或 bearer token。
- 仅展示 `providerKeyRef`、bound status 和一次性输入态相关状态。

### 8.6 账单与审计 `/billing`

定位：余额、冻结金额、预扣费、今日消费、累计消费、费用构成、流水和审计状态页。

关键 surface：

- `billing.hero`
- `billing.cost_breakdown`
- `billing.trend_filter`
- `billing.workspace_costs`
- `billing.run_costs`
- `billing.ledger`

必须回答：

- 当前余额和可用余额是否足够继续运行。
- 冻结金额、预扣费、运行中扣费分别是什么。
- 今日消费和累计消费是多少。
- 工作空间和任务的费用如何关联。
- 停止计费确认和 T+1 审计状态如何。
- 账户流水、充值记录、退款记录在哪里。

需求：

- 余额、可用余额、冻结金额、预扣费、累计消费、今日消费必须分开表达。
- 账单明细必须支持日期筛选。
- 工作空间费用和 run 费用应支持比较和下钻。
- 账单记录必须使用表格或可比较列表。
- 不把 Langfuse、OpenCost 或云账单原始字段作为普通用户主语言。

### 8.7 任务与结果 `/trace`

定位：session、run、artifact、输出文件和审计 metadata 的运行轨迹页。

关键 surface：

- `trace.hero`
- `trace.filter`
- `trace.session_table`

必须回答：

- 最近任务状态是什么。
- 输出结果在哪里。
- 输入文件、任务运行和输出文件之间的链路是什么。
- 资源用量和费用估算如何。
- 失败、等待、运行中、完成、审计中等状态如何处理。

需求：

- Trace 是运行轨迹和排障 metadata，不是日志控制台。
- 列表必须支持筛选、分页和状态比较。
- artifact 回流到工作空间时必须清楚展示。
- 不展示 raw prompt、raw API key、token、内部存储路径或 signed URL。

### 8.8 公共页 `/home`、`/login`、`/register`

定位：公共入口、登录和注册。

需求：

- 公共页主语言是 OPL 托管科研工作台。
- 登录 `portal.medopl.cn` 不需要 gflabtoken API Key。
- Portal 只展示 gflabtoken 模型调用密钥已绑定/未绑定状态，不提供普通登录或普通入口输入框。
- 注册开关和站点内容由管理员站点设置控制。

### 8.9 管理总览 `/admin/dashboard`

定位：管理员进入后的平台摘要。

必须回答：

- 今日用户、工作空间、任务、消费和待处理事项是否正常。
- 哪些管理入口需要关注。

需求：

- 展示平台 KPI、最近使用记录、待处理事项。
- 提供用户管理、任务记录、账单处理、审计记录和站点设置入口。
- 不把管理总览暴露给普通用户。

### 8.10 用户管理 `/admin/users`

定位：用户管理管理和资金操作页。

必须回答：

- 用户管理数量、注册状态、余额和账户状态。
- 哪些账户需要充值、退款、禁用、恢复或删除。

需求：

- 支持搜索、筛选、创建、编辑、禁用、恢复、充值、退款、删除。
- 资金操作必须有清晰的 modal、确认和错误提示。
- 账户状态使用用户可理解文案，不直接暴露内部 raw status。
- 管理台写操作错误必须在当前操作上下文中清楚呈现。

### 8.11 站点设置 `/admin/system`

定位：站点信息、首页内容、注册开关、服务状态和系统指标页。

关键 surface：

- `admin.system.site_settings`
- `admin.system.service_status`

需求：

- 支持编辑站点名称、Logo、首页内容和注册开关。
- 展示服务状态、产品 profile 和系统指标。
- 保存、错误、空内容和不可编辑状态必须明确。

### 8.12 服务状态 `/admin/ops`

定位：具备运维权限管理员的只读运营视图。

需求：

- 展示账号、工作空间、运行中任务、费用估算、账单核对、文件空间状态、审计事项和公告。
- route 可以挂载；默认后端返回 `404 ops_surface_disabled` 时，页面展示“平台托管运维入口未启用”。
- 只有在 `opsSurfaceEnabled` 为真时展示底层服务探针和运行环境详情。
- 用于排障，不改变普通用户主线。

### 8.13 账单处理 `/admin/billing-ops`

定位：账单对账、待补记录、成本构成和调整记录页。

关键 surface：

- `admin.billing_ops.summary`

需求：

- 展示对账状态、待处理记录、成本构成和最近调整。
- 可以出现更专业的运营字段，但不能把普通用户账单页改成云账单控制台。
- raw secret、kubeconfig、signed URL 和云凭证不得出现在 UI 或 evidence。

### 8.14 任务记录 `/admin/usage`

定位：运行记录、成本线索和下钻入口。

关键 surface：

- `admin.usage.table`

需求：

- 展示任务记录、运行状态、费用估算、工作空间和用户归属。
- 支持筛选、分页和下钻。
- 不把 trace metadata 当成账单 truth。

### 8.15 审计记录 `/admin/audit`

定位：事件来源、操作人、工作空间归属和时间线审计页。

关键 surface：

- `admin.audit.table`

需求：

- 展示事件类型、来源、操作人、关联用户、工作空间和时间。
- 支持筛选、分页和详情查看。
- 审计记录用于排障和确认，不替代账单或资源事实源。

## 9. 组件系统需求

### 9.1 通用原语

通用原语必须稳定、可复用，并在 ZIP surface gate 或页面代码中有可验证状态。

- `MetricCard`：用于余额、今日消费、冻结金额、文件空间、任务数、会话数等关键数值。
- `StatusBadge`：用于可用、受限、等待、运行中、完成、失败、审计中、已停止计费等稳定状态。
- `EmptyState`：用于空文件、空任务、空账单、未开通环境、未绑定密钥等状态，并给出下一步。
- `DataTable`：用于账单记录、run 记录、文件列表和管理台记录。
- `FilterToolbar`：用于时间范围、状态筛选、工作空间筛选和搜索。
- `ActionToolbar`：用于同一上下文下的主行动、次行动和危险操作。
- `PageSection`：用于真实信息区块，不作为装饰容器。
- `PaginationBar`：用于列表分页。
- `FormField`：用于表单字段、提示和错误。
- `BaseDialog` / `AnnouncementDialog`：用于确认、公告、帮助和表单弹窗。

### 9.2 业务组件

业务组件必须服务于页面问题，不只呈现装饰。

- 服务状态摘要：工作台可用性、运行环境、文件空间、计费状态、释放状态。
- 下一步行动区：进入 OPL、开通运行环境、处理密钥绑定、上传文件、查看结果、查看账单。
- 资源能力卡：套餐、计算能力、文件空间、并发、释放策略。
- 文件链路卡：输入文件、输出文件、文件空间保留、任务和结果关系。
- 任务运行卡：session、run、artifact、状态和下一步。
- 账单风险卡：余额不足、冻结金额、预扣费、运行中扣费、异常账单。
- 释放审计卡：释放计算资源、保留文件空间、停止计费确认、T+1 审计。

## 10. 状态模型

所有页面和组件必须把状态映射成用户可理解文案，不直接展示内部枚举。

基础 UI 状态：

- `loading`：正在加载。
- `ready`：可用。
- `empty`：暂无数据，并给出下一步。
- `restricted`：受限，说明原因和可执行动作。
- `degraded`：部分能力不可用，说明影响范围。
- `saving`：正在保存。
- `pending`：等待处理。
- `success`：已完成。
- `failure` / `error`：失败，说明用户能做什么。
- `disabled`：不可操作，说明条件。

业务状态：

- 工作台：可进入、需处理、准备中、不可用。
- provider key：已绑定、未绑定、需在 OPL entry/preflight 处理。
- 运行环境：未开通、开通中、可用、受限、释放中、已停止计费。
- 计算资源：未开通、可用、扩容计划中、释放中、已释放。
- 文件空间：未开通、可用、接近上限、受限、保护期、保留中。
- 任务：等待、运行中、完成、失败、审计中。
- 输出文件：生成中、已回流、不可用、已保留。
- 账单：余额充足、余额偏低、消耗冻结金额、停止新任务、停止计费确认中、审计完成。

状态表达规则：

- 余额 / 可用余额 / 冻结金额必须分开。
- 计算资源 / 文件空间必须分开。
- 停止计费 / 审计状态必须分开。
- 输入文件 / 输出文件必须分开。
- 释放计算资源 / 删除文件空间必须分开。
- 状态色不能是唯一信息载体，必须配合文本。

## 11. 数据来源与 API 边界

前端请求统一通过 `services/portal/frontend/src/api/client.ts` 的 `apiClient`，基址为 `/portal/api`。401 响应进入登录处理。

主要 API 模块：

- `commercial.ts`：当前用户、权益、角色和 profile。
- `overview.ts`：总览聚合数据。
- `resources.ts`：托管运行环境、资源状态和 OPL 启动状态。
- `workspace.ts`：工作空间、文件空间、输入文件、输出文件和计划快照。
- `billing.ts`：账单摘要、明细、趋势、流水、run cost 和 workspace cost。
- `traces.ts`：session trace、run、artifact 和运行轨迹。
- `opl.ts`：launch、bootstrap、session bind、message、run、artifact projection。
- `admin.ts`：管理台数据和管理动作。
- `sessions.ts`：公告和会话辅助信息。
- `public.ts`：公共站点设置。
- `server-plans.ts`：套餐目录和规格辅助。

API shape 必须由 `services/portal/frontend/src/app/data/portalAdapters.ts`、`services/portal/frontend/src/api/portal/*` 和对应 smoke 固化。所有公开 response、Portal projection、日志、evidence 和 git 中不得包含 raw API key、SecretId、SecretKey、token、objectKey、storageKey、signedUrl、localPath 或 kubeconfig。

## 12. 文案规范

文案必须短句、状态优先、动作优先。

推荐模式：

- 状态：工作台可用。
- 原因：运行环境和文件空间已就绪。
- 动作：进入 OPL。

主按钮使用动词：

- 进入
- 开通
- 上传
- 查看
- 释放
- 处理
- 保存
- 导出

禁止在普通用户 UI 主语言中出现：

- 云资源控制台
- CVM
- COS
- K8s
- TKE
- 节点池
- 对象存储控制台
- raw status
- 内部枚举
- 斜杠组合字段
- secret、token、signed URL 类字段

合同禁用主语言还包括：

- 客户工作台
- 平台管理台
- 商业化
- 商业
- SaaS 总览
- 运维面
- 运营总台
- 告警中心
- 账务
- 使用统一账号登录

文案长度：

- 区块标题优先不超过 12 个汉字，业务专名除外。
- 说明句优先控制在一到两行。
- 空态必须给下一步。
- 错误态必须说明用户能做什么，不能只显示失败。

## 13. 视觉与响应式规范

视觉气质：高可扫描、高信息密度但不拥挤的 SaaS 科研工作台。

布局：

- 第一屏优先放服务状态、下一步和关键摘要。
- 详情下沉，避免首屏变说明页。
- 桌面端使用稳定 grid、table 和 list。
- 移动端使用单列和可读卡片。
- 管理台密度可以高于普通用户页面。

卡片：

- 卡片只用于真实信息单元。
- 一个卡片只承载一个主题。
- 卡片内有明确标题、状态、数据或行动。
- 不使用卡片套卡片。

边框、圆角和阴影：

- 常规圆角不超过 8px。
- 表格、列表和状态条优先使用轻边框和稳定间距。
- 阴影只用于浮层、菜单和 modal。

色彩：

- 成功色用于可用、已完成、已停止计费。
- 警告色用于等待、冻结、审计中、余额不足前兆。
- 危险色用于失败、不可用、余额不足、释放失败。
- 主色只服务唯一主行动和当前选中状态。
- 不用装饰性渐变或单一蓝紫渐变支配全站。

响应式：

- 关键页面在移动和桌面视口都不能横向溢出。
- 长 ID、金额、状态组合必须换行或截断。
- 表格在移动端必须有可读替代形态。
- 按钮文本不能挤压或覆盖。

## 14. ZIP Surface Gate 与可执行事实源

Portal UI 的可执行事实源是：

```text
/mnt/c/Users/Administrator/Downloads/MedOPL+Portal+UI+Design+(1).zip
/tmp/medopl-figma-make-source-admin
services/portal/frontend/src/app
services/portal/frontend/src/app/data/portalAdapters.ts
```

ZIP surface gate 必须覆盖：

- `routes`
- `surfaces`
- `layouts`
- `apiShapes`
- `forbiddenCopy`
- `pageTasks`
- `primitives`
- `copyRegistry`
- `pageComposition`
- `surfaceStates`
- `componentFixtures`
- `designTokens`
- `presentationRules`
- `owners`
- `acceptance`
- `artifactPolicy`
- `coverage`

关键 DOM anchor：

- `data-layout-id`
- `data-route-id`
- `data-component-id`

运行证据：

- `.runtime/portal-surface-eval/report.json` 由 surface eval 生成，不进 git。
- `.runtime/portal-ui-design-quality/report.json` 是 design quality audit evidence，不进 git。
- 截图 baseline 不再是当前 Portal UI completion evidence；如后续重新启用，必须另开 leaf 并先写 design quality audit evidence。

## 15. 验收标准

### 15.1 PRD 文档验收

- 文档作为 historical PRD draft 保留，不作为 current implementation truth。
- 文档不改变合同、不新增产品语义、不声明未上线能力已经上线。
- 文档明确合同订阅包、范围、非目标、页面清单、状态模型、文案规范、数据边界和验证命令。
- 文档不包含 secret、token、kubeconfig 或真实云凭证。

### 15.2 UI 实现验收入口

后续任何 Portal UI 实现 slice 必须至少考虑以下命令：

```bash
node scripts/smoke-test-v22-portal-runtime-suite.mjs --group all
node scripts/smoke-test-v22-portal-runtime-suite.mjs --group surface
node scripts/smoke-test-v22-portal-runtime-suite.mjs --group api
node scripts/smoke-test-v22-portal-web-route-alignment.mjs
npm --prefix services/portal/frontend run typecheck
npm --prefix services/portal/frontend run build
```

相关合同级检查：

```bash
node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs
node scripts/smoke-test-v22-mvp-contract-suite.mjs
```

### 15.3 Design Quality Rubric

硬约束：

- 七个主线问题必须可回答。
- Portal / OPL 职责必须清晰。
- 普通用户页面不得恢复云资源控制台语言。
- 不得重做 OPL chatbot。
- 普通用户、管理员和运维 surface 不能越权串台。
- secret/browser hygiene 必须通过。
- 桌面和移动视口不能横向溢出。
- ready、empty、loading、error、disabled、pending、success、failure 必须有覆盖。
- runtime-only audit report 不进 git。

软评分：

- 现代 SaaS 工作台信息层级。
- 可扫描、可比较、可重复操作。
- 托管 OPL 工作台服务感知清晰。
- 下一步动作稳定、具体、可点击。
- 页面气质像科研工作台，不像营销页、云控制台或散装资源面板。
- 信息密度、留白、表格、卡片、列表、状态标签和操作区平衡。
- 中文文案直接、可信、面向 AI 小白科研用户。

## 16. 风险与防护

叙事污染：

- 不把 MedOPL 讲回云资源控制台。
- 不把用户购买对象讲成 CVM、COS、K8s、TKE、节点池或用户自配云资源。
- 不把 Langfuse、OpenCost 或 trace metadata 讲成当前账单/任务 canonical source。

角色污染：

- 普通用户不能看到管理台入口、全局账户、全局费用、全局任务或运维操作。
- 管理台和 ops surface 必须继续受 role 和 profile gate 保护。

secret 污染：

- raw API key、bearer token、launchToken、runtimeToken、signedUrl、objectKey、storageKey、localPath、kubeconfig、SecretId、SecretKey 不进入前端持久化、日志、evidence 或 git。

合同污染：

- 不绕过 Figma Make ZIP surface gate、typecheck、build 和 smoke。
- 不用默认值、隐式成功或伪通过掩盖真实缺参。
- `partial` 和 `missing` surface 必须写明下一步要求。

trunk 污染：

- spike、未验证 UI、真实外部操作副作用和未清理旧入口不得进入 `recovery/platform-v22-trunk`。

## 17. 后续设计工作建议

后续 Portal UI 设计和实现可按 slice 推进：

1. Overview dashboard 继续作为主线样板，保持七个主线问题首屏可回答。
2. Resources 继续强化计算资源、文件空间、释放、停止计费和审计的分区表达。
3. Workspace 强化输入文件、输出文件、结果回流、保护期和 OPL 入口的日常操作效率。
4. Billing 强化余额、可用余额、冻结金额、预扣费、流水、工作空间费用和 run cost 的比较。
5. Trace 强化 session、run、artifact、输出文件、费用估算和状态筛选。
6. Admin 页面统一加载、空态、错误态、modal 和表格交互风格，保持普通用户 surface 隔离。

每个 slice 应单独分支、单独验收、单独提交；不得把多页重构、后端改动、依赖升级、真实云、deploy 或 upstream 修改混进一个 UI slice。

## 18. 关键文件索引

前端入口：

- `services/portal/frontend/src/app/routes.tsx`
- `services/portal/frontend/src/app/App.tsx`
- `services/portal/frontend/src/main.tsx`
- `services/portal/frontend/src/styles/index.css`

布局：

- `services/portal/frontend/src/app/components/Layout.tsx`
- `services/portal/frontend/src/app/components/ui/*`

普通用户页面：

- `services/portal/frontend/src/app/pages/Overview.tsx`
- `services/portal/frontend/src/app/pages/RuntimeEnvironment.tsx`
- `services/portal/frontend/src/app/pages/Workspace.tsx`
- `services/portal/frontend/src/app/pages/OPLEntry.tsx`
- `services/portal/frontend/src/app/pages/BillingAudit.tsx`
- `services/portal/frontend/src/app/pages/TasksResults.tsx`

管理台页面：

- 当前 Figma Make ZIP 已覆盖普通用户和管理员 Portal UI。
- Admin / Ops UI 位于同一 React 技术栈和同一 Portal shell 下，页面源位于 `services/portal/frontend/src/app/pages/admin/*`；普通用户导航不得显示 admin 入口，真实权限仍由后端 `/portal/api/admin/*` 校验。

组件与状态：

- `services/portal/frontend/src/app/components/ui/*`
- `services/portal/frontend/src/app/components/Layout.tsx`
- `services/portal/frontend/src/app/data/portalAdapters.ts`
- `services/portal/frontend/src/app/components/figma/*`

API：

- `services/portal/frontend/src/api/client.ts`
- `services/portal/frontend/src/api/portal/*.ts`

ZIP / surface gate：

- `/mnt/c/Users/Administrator/Downloads/MedOPL+Portal+UI+Design+(1).zip`
- `/tmp/medopl-figma-make-source-admin`
- `scripts/smoke-test-v22-portal-frontend-surface-eval.mjs`
- `scripts/smoke-test-v22-portal-figma-make-ui-implementation-contract.mjs`

合同与设计源：

- `DESIGN.md`
- `docs/product.md`
- `docs/architecture.md`
- `docs/contracts/README.md`
- `docs/contracts/v22-portal-workbench-management-ui-composition-boundary.md`
- `docs/contracts/v22-portal-ui-design-quality-audit-boundary.md`
- `docs/contracts/v22-saas-control-plane-user-experience-boundary.md`
- `docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md`
- `docs/contracts/v22-portal-user-surface-boundary.md`
- `docs/contracts/v22-portal-admin-ops-surface-boundary.md`
- `docs/contracts/v22-portal-files-billing-trace-boundary.md`
- `docs/recovery/mvp-contract-acceptance.md`
- `docs/recovery/status-matrix.md`
- `docs/recovery/active-surface.md`
