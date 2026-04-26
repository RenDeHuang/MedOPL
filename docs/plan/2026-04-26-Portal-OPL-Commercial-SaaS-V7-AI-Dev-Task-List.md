# Portal + OPL 商业化 SaaS V7 AI 开发任务清单

## 目标

把当前 Portal + One Person Lab 的联调能力，推进成可持续交付的商业化 SaaS 方案。这个阶段的重点不是“再做一个工作台”，而是把身份、工作区、任务空间、运行会话、存储、计费、服务器选择和错误反馈拆成边界清晰的模块，让每个模块都能独立演进、独立失效、独立替换。

## 顶层原则

- 模块内高聚合：身份、launch、工作区、账单、运行、存储各自收敛在自己的模块里。
- 模块间低耦合：模块之间只通过 ID、短期 token、账本事件、只读状态接口连接，不共享密码、不共享数据库表、不共享隐式上下文。
- 互不影响：Portal、Gateway、Billing、Runner、Storage 任一模块故障时，其他模块继续按自己的职责工作，最多降级自己的那一段，不把故障扩散到整个平台。
- 容易维护：模块职责、目录合同、状态字段、错误页和健康检查都要可读、可追踪、可替换。

## 当前判断

当前版本还没有达到正式多租户 SaaS 的交付标准，已经具备一部分链路基础，但还缺少身份打通、任务空间绑定、真实账单闭环、服务器选择透明化、状态模型拆分和产品化体验收口。

---

## 1. Portal 注册账号进入 OPL

### What

Portal 注册出来的账号，必须可以通过 Portal 的正式入口进入 OPL 工作台，而不是要求用户去 OPL 原生登录页再注册一套新身份。

### Purpose

把“注册成功”直接变成“可进入工作台”，减少用户在身份系统上的困惑，降低转化流失和支持成本。

### Commercial logic

商业化产品的入口必须统一。用户感知的是“进入实验室”，不是“先猜哪个系统能登录”。Portal 负责身份和入口，OPL 负责工作台体验，用户不应被迫理解内部系统拆分。

### How

- Portal 作为身份源和入口源。
- Portal 登录后生成短期 launch token。
- OPL 只接受来自 Gateway 的 launch 上下文，不接受 Portal 邮箱密码直登。
- 入口链路固定为：Portal 登录 -> Portal 生成 launch token -> Gateway 绑定用户 -> OPL 进入工作台。

### Test

- Portal 注册后，点击工作台入口可以进入 OPL。
- 直接访问 OPL 原生登录页时，不会误导用户去输入 Portal 密码。
- launch token 过期、缺失、篡改时，入口必须失败且失败原因明确。

### Delivery standard

- Portal 注册用户可从 Portal 正式入口进入 OPL。
- 不新增 Portal 密码到 OPL 原生账号体系。
- 入口失败时有明确产品化提示，不是技术错误页。

### Done now?

否。

---

## 2. OPL 任务空间、session、trace、storage 与 Portal user/workspace/session 打通

### What

OPL 的任务空间、运行 session、trace、artifact 和存储对象，都要能回指到 Portal 的 user、workspace 和 session。

### Purpose

把运行行为、可观测数据和计费对象统一到同一套业务主键上，避免“任务跑了但找不到归属”“trace 有了但无法计费”“artifact 有了但无法回溯”。

### Commercial logic

商业化 SaaS 不是把任务跑起来就结束，而是要能回答三件事：谁发起的、属于哪个 workspace、产生了什么成本。没有这个绑定，后续账单、审计、权限和客服都无法闭环。

### How

- Portal 维护 `tenant_id / portal_user_id / workspace_id / workspace_session_id` 作为控制面主键。
- OPL 侧运行对象维护 `runtime_session_id / run_id / trace_id / artifact_id` 作为运行面主键。
- Gateway/Adapter 负责把 Portal 上下文投影到 OPL 运行上下文。
- 所有 trace、run、artifact、storage 元数据都要带回指针，不允许只保留匿名运行记录。

### Test

- 从 Portal 发起一次任务后，可以从 run 追溯到 workspace，再追溯到 Portal user。
- trace 和 artifact 的详情页能定位到对应的 workspace/session/run。
- 任一运行对象都不会脱离 tenant 归属。

### Delivery standard

- 任务空间、session、trace、storage 均有稳定 ID 和回指链路。
- OPL 运行对象能被 Portal 控制面查询到。
- 元数据与实际存储目录一致。

### Done now?

否。

---

## 3. 工作台入口 UI

### What

Portal 中的“进入工作台”入口必须是清晰、稳定、可解释的产品入口，而不是一个临时跳转按钮。

### Purpose

让用户知道下一步该做什么，减少跳转失败、页面空转和错误归因。

### Commercial logic

商业化入口要承担转化责任。入口页面不是展示工程内部结构，而是把用户推向第一次成功运行、第一次充值、第一次创建 workspace。

### How

- 入口区分“进入工作台”“创建 workspace”“充值”“查看账单”“查看运行历史”。
- 入口状态跟随 `accountStatus / billingStatus / entitlementStatus`。
- 入口按钮只暴露用户能继续的动作，不把 Gateway、Adapter、OPL Web 的内部细节直接暴露给用户。

### Test

- 不同账户状态下，入口展示的 CTA 正确。
- 无 entitlement 时，用户看到的是引导，不是死路。
- 入口文案与目标动作一致，不出现技术术语误导用户。

### Delivery standard

- Portal 首页可以作为统一工作台入口。
- 用户能在 Portal 中完成“进工作台前”的所有关键动作。

### Done now?

否。

---

## 4. 单 PVC 目录合同与未来迁移

### What

当前为了简化上线，可以先使用一个 PVC 承载多个模块的数据，但必须定义严格的目录合同，为未来拆分成多个 PVC 或对象存储迁移预留边界。

### Purpose

先保证上线速度，再保证后续可迁移、可拆分、可审计，而不是把所有文件混在一个扁平目录里。

### Commercial logic

商业化平台早期允许“一个卷多目录”，但必须让每个模块只拥有自己的目录和生命周期。这样以后拆分存储、做备份、做清理、做迁移时，成本才可控。

### How

- 单 PVC 下按模块分目录，不跨模块写文件。
- 目录示例：
  - `/data/portal/`
  - `/data/portal/workspaces/<workspace_id>/`
  - `/data/portal/sessions/<workspace_session_id>/`
  - `/data/opl/runs/<run_id>/`
  - `/data/opl/traces/<trace_id>/`
  - `/data/opl/artifacts/<run_id>/`
  - `/data/billing/`
  - `/data/runtime/`
- 目录所有权写入文档，未来迁移时按目录切分，不按业务“猜文件用途”。

### Test

- 各模块只写自己的目录。
- 迁移脚本可以按目录边界独立搬运。
- 删除某个模块数据时，不影响其他目录。

### Delivery standard

- 目录合同固定、可读、可迁移。
- 任一模块的存储都能独立备份和恢复。

### Done now?

否。

---

## 5. 腾讯云真实账单与服务器选择模块

### What

平台的服务器规格、单价、冻结金额、运行中的 pending cost 和最终 exact cost，都必须以腾讯云真实数据为主，不以本地估算冒充最终账单。

### Purpose

把“用多少、扣多少、为什么扣”变成可解释、可对账、可回放的财务链路。

### Commercial logic

老板要的是透明定价和真实扣费。用户可以按自己的需求选择服务器，平台只负责展示腾讯云价格、冻结预计费用、回补真实账单，不替用户编造价格。

### How

- 拆成至少三个职责：
  - 价格目录模块：维护可售 server plans，展示腾讯云报价。
  - 账单采集模块：拉取腾讯云账单明细或 COS 账单文件。
  - 账本模块：记录冻结、占用、释放、回补、对账结果。
- `server_plans` 不是静态硬编码，而是腾讯云价格 + 平台可售白名单的组合。
- 运行前按规格和最小计费单元冻结余额。
- 运行中只记 pending cost。
- 最终 exact cost 由腾讯云账单回补，不由 OpenCost 直接决定。

### Test

- server plan 列表能显示来源和价格。
- 冻结金额按规格、时长、风险系数计算且可复算。
- 腾讯云账单到账后能回补到 run/tenant/workspace。
- 账单缺失时不会把估算值伪装成 exact cost。

### Delivery standard

- 价格透明、可追溯、可回补。
- 用户能在下单前看到明确规格与价格。
- 所有扣费都能落到账本条目。

### Done now?

否。

---

## 6. accountStatus / billingStatus / entitlementStatus 拆分

### What

把账号状态、计费状态和可用权益状态拆成三个独立维度，不再用一个 `active` 去同时承载身份、钱包和权限。

### Purpose

避免“账号是 active，但实际上不能跑”的混乱状态。

### Commercial logic

商业化系统里，身份可用不等于可以启动，钱包有钱不等于有权限，权限足够也不等于账号正常。拆开后，产品提示、风控、充值和客服都会更清楚。

### How

- `accountStatus`：账号是否正常、冻结、禁用、待审核。
- `billingStatus`：是否有余额、是否欠费、是否可冻结、是否需要充值。
- `entitlementStatus`：是否有试用额度、套餐权益、可启动能力、并发额度。
- UI 和 API 都必须分别展示和判断，不允许再只看一个布尔字段。

### Test

- 同一个账号在三种状态下的 CTA 不同。
- 余额不足时不等于账号禁用。
- 权益不足时不等于账务失败。

### Delivery standard

- 三个状态字段在控制面和工作台都可见。
- 所有启动、充值、封禁和引导逻辑都按三状态分流。

### Done now?

否。

---

## 7. Onboarding

### What

注册完成后，用户不能只看到一个“空账号”，必须被引导完成第一次成功使用：创建 workspace、选择服务器、进入工作台、发起一次 demo run。

### Purpose

缩短从注册到第一次价值的路径，减少“注册完不知道干嘛”的流失。

### Commercial logic

SaaS 的转化不是注册，而是第一次成功结果。onboarding 的目标是让用户尽快建立使用习惯，并形成充值和复用。

### How

- 注册后自动进入 onboarding 流程。
- 第一屏明确下一步：创建 workspace / 选择服务器 / 充值 / 启动 demo。
- 不要让用户自己猜 Portal、OPL、Gateway 的关系。
- 对新用户给出明确试用权益或可用起点。

### Test

- 新注册用户能在最短路径内完成第一次 run。
- onboarding 的每一步都有明确完成态。
- 失败时给出下一步，而不是让用户返回首页重试。

### Delivery standard

- 注册后至少有一条可完成的默认路径。
- 用户不需要理解内部架构，也能完成首次使用。

### Done now?

否。

---

## 8. 产品化错误页

### What

余额不足、权限不足、入口失效、launch 过期、服务器未配置、账单同步失败等情况，都必须变成产品化错误页，而不是技术异常页。

### Purpose

让错误可理解、可转化、可修复，减少客服和排障成本。

### Commercial logic

商业化产品的错误页也是销售和支持的一部分。错误页要告诉用户“现在发生了什么、为什么、下一步怎么做”，而不是只吐堆栈。

### How

- 错误页按场景分类。
- 每个错误页只暴露一个主动作：充值、重试、返回工作台、联系管理员、重新登录。
- 错误页展示业务原因，不展示内部实现细节。

### Test

- 常见失败路径都有独立页面。
- 页面上的 CTA 能把用户带回可行动状态。
- 不出现裸技术错误、空白页、未处理异常页。

### Delivery standard

- 错误页可解释、可操作、可统计。
- 每个错误码都有产品文案。

### Done now?

否。

---

## 9. 健康检查与版本可见性

### What

`/healthz` 不能只证明进程活着，还必须能暴露构建版本、部署时间、身份模式和关键运行态。

### Purpose

让排障、回滚和版本确认变得可验证，而不是靠猜当前跑的是哪个进程。

### Commercial logic

上线后最怕“页面能开但实际上还是旧代码”。健康检查和版本信息是商业化运维的最小可信底座。

### How

- 健康检查返回构建信息、git sha、build time、身份模式、关键依赖状态。
- Portal、Gateway、Adapter、Billing 各自返回自己的健康信息。
- 不同模块的健康状态互不污染。

### Test

- 健康检查能区分“进程活着”和“关键功能可用”。
- 版本号和提交信息与实际镜像一致。
- 旧进程和新进程能被快速识别。

### Delivery standard

- 每个模块都能说明自己是谁、哪个版本、处于什么模式。
- 健康检查可用于定位故障，不只是探活。

### Done now?

否。

---

## 10. 权限模型

### What

权限不能只停留在 admin/user，必须能支撑多租户 SaaS 的组织、团队和财务管理。

### Purpose

让企业客户能够自主管理 workspace、账单、运行和成员，而不是把所有权都压到一个人头上。

### Commercial logic

B2B SaaS 的采购、账务和运行权限通常分离。没有清晰权限模型，客户一上来就会卡在谁能充值、谁能看账单、谁能开机、谁能看 trace。

### How

- 至少拆出这些角色：
  - tenant owner
  - billing admin
  - workspace admin
  - workspace member
  - viewer
- 所有敏感动作都按角色授权，不按页面入口碰运气。

### Test

- 不同角色看到的菜单、按钮和 API 返回不同。
- 财务动作和运行动作可以独立授权。
- 只读用户不能触发写操作。

### Delivery standard

- 权限与业务动作一一对应。
- 角色可扩展，不依赖单点硬编码。

### Done now?

否。

---

## 11. 开发 / 生产身份模式

### What

本地开发模式和生产身份模式必须显式区分，不能让同一个入口同时混淆本地账号、Portal 账号和正式身份源。

### Purpose

避免开发态和生产态互相污染，减少“我到底登录的是哪套身份”的排障成本。

### Commercial logic

生产环境需要稳定身份源和审计链路，开发环境需要可快速联调。两者必须可切换，但不能默默切换。

### How

- 明确区分 dev / prod 身份模式。
- UI 上可见当前模式。
- 生产态只走正式登录和 launch 链路。
- 开发态可以保留本地登录，但必须和生产态分隔。

### Test

- dev 模式下可以本地联调。
- prod 模式下不会误走本地身份。
- 模式切换后，UI 和 API 的行为一致。

### Delivery standard

- 身份模式是显式配置，不是隐式猜测。
- 用户和运维都能看懂当前处于哪种模式。

### Done now?

否。

---

## 12. 交付顺序建议

1. 先打通 Portal 注册账号进入 OPL 的正式入口。
2. 再把任务空间、session、trace、storage 与 Portal 主键打通。
3. 同步整理工作台入口 UI 和产品化错误页。
4. 接着拆分状态模型、权限模型和 dev/prod 身份模式。
5. 同步落地单 PVC 目录合同，为未来迁移留接口。
6. 最后收口真实账单、服务器选择和健康检查版本可见性。

## 结论

v7 的重点不是“多做几个页面”，而是把商业化 SaaS 必须具备的责任边界补齐。只要身份、任务、存储、账单、权限和错误反馈都按模块边界做清楚，后续就能做到单模块故障不扩散、单模块替换不牵连、单模块迁移不崩盘。

---

## 本轮 v7 实施结果

### 已完成

- Portal 注册/登录用户可以通过 Portal launch token 进入 OPL，不同步密码到 OPL 原生账号体系。
- Gateway 直达 OPL 时展示“使用 Portal 继续”，无 launch 的 `/api/auth/user` 返回 401，不再泄露 upstream noauth/admin。
- Portal -> Adapter -> Gateway -> OPL bootstrap 显式贯通 `tenantId / portalUserId / workspaceId / workspaceSessionId / runtimeSessionId / oplSessionId`。
- Runtime bridge 的 workspace、session、run、trace、artifact、cost 都补齐 tenant/owner/storage owner 字段，并按 Portal user + workspace/session scope 过滤。
- 新注册和 OIDC 首次 provision 用户默认获得 trial entitlement，余额为 0 不再阻止进入工作台。
- Portal API 拆出 `accountStatus / billingStatus / entitlementStatus / commercial`，进入工作台和收费运行分层控制。
- 新增 Portal “服务器与费用”页面，展示腾讯云价格来源、冻结依据、最终账单来源和 OpenCost 的非最终扣费定位。
- Portal 新增 `/portal/api/server-plans`，只聚合 billing-aggregator 返回结果，不在 Portal 内部实现腾讯云签名细节。
- Runner 动态 Job 模板挂载 `/app/.runtime` 到 `portal-platform-runtime` PVC。
- 新增 PVC 目录合同，明确单 PVC 是上线简化方案，并写清未来按模块迁移边界。
- Portal、Gateway、Adapter、Runner orchestrator 的 `/healthz` 和 `/status` 返回 build、身份模式、计费模式、关键 URL 和存储摘要。

### 已验证

- `node scripts/smoke-test-portal-commercial-saas.mjs`
- `node scripts/smoke-test-opl-web-gateway-launch.mjs`
- `node scripts/smoke-test-opl-runtime-bridge-bootstrap.mjs`
- `node scripts/smoke-test-portal-opl-web-launch.mjs`
- `node scripts/smoke-test-portal-spa-access.mjs`
- `npm --prefix services/portal run check`
- `npm --prefix services/portal run frontend:typecheck`
- `npm --prefix services/portal run frontend:build`
- `powershell -ExecutionPolicy Bypass -File scripts/render-tke-manifests.ps1 -EnvFile env/tke.env.tcr-gaofenglab.example`
- gstack browse 手工打开本地 Portal，完成注册，总览页显示 trial/商业准入，服务器与费用页显示腾讯云报价、冻结依据、最终账单来源。

### 未在 v7 内完成

- 真正的一等组织租户、团队角色和跨成员 RBAC 仍是后续版本。
- 真实腾讯云账单扣费依赖生产环境配置 `TENCENT_CLOUD_SECRET_ID / TENCENT_CLOUD_SECRET_KEY / SERVER_PLAN_CATALOG_JSON`，本地验证使用 fixture 和接口合同。
- billing-aggregator v6 已具备真实账单和询价连接器，本轮没有改其业务代码，只通过 Portal 增加产品化入口。
