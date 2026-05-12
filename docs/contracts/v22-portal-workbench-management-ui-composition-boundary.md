# v22 Portal Workbench Management UI Composition Boundary

本合同固定 Portal 可见界面的页面任务、组件边界、数据来源和验收方式。它不替代 role surface 合同和结构治理合同；它把这些合同落实到可运行的 Portal UI、API 和 smoke。

本合同使用 Sub2API 的产品工程模式作为参考：公共首页可以由管理台配置，登录页保持账号密码入口，业务页面由固定组件组合，静态合同检查和运行时验收必须同时存在。

本合同 v2 不新增独立 UI 架构合同文件。Portal UI 架构治理、页面职责、组件边界、文案边界、API 来源和验证入口统一收敛在本合同内，避免合同数量继续膨胀。

## UI 工程结构

Portal UI 必须把约束落在代码结构中，而不是只写在文档中。结构分层固定为：

- token：`tailwind.config.ts` 和 `src/style.css` 中的颜色、字号、间距、圆角和阴影。
- primitive：`src/style.css` 中的 `.btn`、`.input`、`.card`、`.badge`、`.table-shell`、`.empty-state` 等共享原语。
- layout：`src/layouts/AppLayout.vue`、`AppHeader.vue`、`AppSidebar.vue` 只负责页面壳、导航和滚动边界。
- feature component：`src/components/overview/*`、`src/components/admin/*` 等业务组件回答稳定页面问题，必须有 `data-route-id` 和 `data-component-id`。
- page orchestration：`src/views/*` 只负责拉取 composable、组合组件和接路由，不沉淀大段业务 UI。
- harness validation：`src/harness/portal-ui-surfaces.ts` 固定 route、component、question、states、selector 和 invariants，smoke 必须读取该注册表并验证真实 DOM 锚点。

组件化规则：

- Portal UI 按 Sub2API 式顺序治理：先建立全站视觉原语，再建立页面骨架，再把高频重复模式抽到 common，再按业务域收拢复杂 UI，最后让 view 只做装配。
- common 组件只收跨页面复用的 UI 原语，不收业务专属块。
- feature 组件按业务域建目录，由页面组合使用。
- 一个块只有满足独立职责、独立状态、独立验收价值时才进入 feature component。
- 页面不得绕过注册表新增核心 UI 区块。

## UI 架构层级

Portal UI 代码必须按以下层级归位：

- 路由入口层：`src/router/index.ts` 固定可见路由和 admin guard；`/portal/app/*` 只能兼容跳转。
- 页面壳层：`src/layouts/*` 只负责应用壳、导航、顶部栏、移动端展开和滚动边界，不承载业务判断。
- 页面编排层：`src/views/*` 只负责 route 参数、composable 调用和组件装配，不沉淀大段表格、卡片和状态转换。
- 业务组件层：`src/components/overview/*`、`src/components/billing/*`、`src/components/resources/*`、`src/components/workspace/*`、`src/components/trace/*`、`src/components/admin/*` 按页面职责收拢复杂 UI。
- 通用组件层：`src/components/common/*` 只放跨页面复用原语，例如指标卡、表格、日期筛选、状态徽标、空态、分页和操作区。
- 视觉基础层：`tailwind.config.ts` 和 `src/style.css` 提供 token、primitive、表格、卡片、按钮、输入框、空态、分页和移动端表格原语。
- 状态和行为层：`src/composables/*` 承担 loader、query、formatter、pagination、action handler 和局部错误态；API module 只承担 HTTP 和类型映射。
- 验证边界层：`src/harness/portal-ui-surfaces.ts` 固定关键 surface 的 route、component、question、states、selector 和 invariants。

已有 `AppLayout`、`AppHeader`、`AppSidebar` 是页面壳层。后续页面治理应优先补齐 `DashboardPageLayout`、`TablePageLayout`、`DetailPageLayout` 等页面骨架协议，再抽业务组件；不得先为指标拆分而绕过页面骨架。

## 页面职责反推 UI

每个页面必须先回答稳定产品问题，再选择组件类型：

- 总览回答：用户现在能不能工作、余额是否足够、任务和托管环境是否正常、从哪里进入 OPL 工作台。
- 计算资源回答：用户当前租用什么套餐、计算规格、文件空间、并发数、预计费用和冻结金额状态。
- 任务执行回答：最近任务处于什么状态、输出在哪里、资源用量和费用估算是多少。
- 文件空间回答：工作空间文件夹、输入文件、输出文件、保护期和下载入口在哪里。
- 账单回答：余额、可用余额、冻结金额、累计消费、今日消费、账户流水、充值记录和退款记录是什么。
- 管理台回答：账号、资源、任务、账单、审计、站点设置和服务状态当前是什么状态。

页面职责决定 API 来源、组件类型和文案，不得由后端 DTO 或历史字段名反推页面叙事。

## 文案和 i18n 边界

Portal 已接入 `vue-i18n`。后续 UI 治理必须逐步把页面标题、按钮、状态、空态、错误态和操作反馈迁入 i18n 或职责词表。

文案规则：

- 用户侧主语言是工作台、计算资源、任务执行、文件空间、账单、余额、冻结金额、累计消费、今日消费、输入文件、输出文件、运行轨迹。
- 管理侧主语言是管理台、平台总览、客户账户、资源管理、任务记录、账单管理、审计记录、站点设置、服务状态。
- 状态展示必须映射成用户可理解文案，不能把 raw status、内部枚举或后台字段直接显示。
- UI 不使用斜杠组合词表达一个字段；需要两个含义时拆成两个字段。
- UI 不使用“账务”，统一使用“账单”。

## 分支意图

本分支只处理 Portal 工作台和管理台的 UI 组合、站点设置、公用首页、登录注册、页面命名、组件落点、架构边界和测试入口统一。

本分支不处理 Go 后端迁移，不接真实云，不读取 secret，不修改 upstream，不修改 deploy，不执行 build/push、kubectl 或 live-test。

模型记录：`gpt-5.4`。

## 入口命名

- 用户进入应用后的主区域叫工作台。
- 管理员进入应用后的主区域叫管理台。
- UI 不使用“客户工作台”“平台管理台”“商业化”“商业”“SaaS 总览”“运维面”“运营总台”“告警中心”。
- UI 不使用斜杠组合词表达一个字段；需要两个含义时拆成两个字段。
- UI 不使用“账务”，统一使用“账单”。
- 管理台可以展示后台排查信息，但页面名和按钮名必须面向管理动作，不使用云控制台叙事。

## 可见路由

Portal 可见路由必须采用 Sub2API 式顶层路径，不把用户暴露到内部 `/portal/app/*` 前缀。

- 公开首页：`/` 和 `/home`
- 登录页：`/login`
- 注册页：`/register`
- 工作台总览：`/overview`
- 管理台站点设置：`/admin/system`
- 管理台总览：`/admin/dashboard`

登录成功必须跳转 `/overview`。首页“进入工作台”必须链接 `/overview`。旧 `/portal/app/*` 只能作为兼容入口，必须重定向到对应顶层路径。

## 公共首页

Portal 必须有公共首页，未登录用户访问根路径时先看到首页，而不是直接跳转登录。

首页数据来自公开站点设置：

- `siteName`
- `siteLogo`
- `siteSubtitle`
- `homeContent`

首页行为：

- `homeContent` 为空时显示默认 OPL 介绍页。
- `homeContent` 是 URL 时使用全页 iframe。
- `homeContent` 是 HTML 时使用整页 HTML 展示。
- 页头使用站点 logo 和站点名称。
- 首页只有清晰入口：登录、注册、进入工作台。

## 登录注册

登录页必须是账号密码表单。它可以展示站点 logo 和站点名称，但不得把“使用统一账号登录”作为主按钮，不得让登录流程跳到不可用 OIDC。

注册页必须是账号、邮箱、密码表单。注册开关由管理台控制。

## 工作台页面任务

工作台固定页面：

- 总览：余额、可用余额、冻结金额、累计消费、今日消费、会话数、任务数、任务进度、计算资源状态、文件空间状态、进入 OPL 工作台。
- 计算资源：当前套餐、计算规格、文件空间、并发数、预计费用、冻结金额状态、调整计划。
- 任务执行：会话、任务、输出文件、资源用量、费用估算、状态、时间。
- 文件空间：工作空间文件夹、输入文件、输出文件、文件空间状态、保护期、下载入口。
- 账单：余额、可用余额、冻结金额、累计消费、今日消费、账户流水、充值记录、退款记录。

工作台不得展示 `tenantId`、`resourceOrderId`、`resourceBindingId`、`serverPlanId`、`runId`、`CVM`、`COS`、`K8s`、`TKE`、`SecretId`、`SecretKey`、`raw API Key`、`objectKey`、`storageKey`、`signedUrl`。

## 管理台页面任务

管理台固定页面：

- 平台总览：账号数、工作空间数、今日任务、平均响应、今日消费、累计消费、最近任务、待处理事项。
- 客户账户：账号开通、状态、余额、手动充值、退款、注册设置。
- 资源管理：计算资源、文件空间、套餐、并发、释放状态。
- 任务记录：用户、工作空间、任务、状态、成本、详情。
- 账单管理：待处理账单、最近调整、成本构成、对账状态。
- 审计记录：事件、来源、账号、操作人、工作空间、时间、详情。
- 站点设置：站点名称、站点 logo、站点副标题、首页内容、注册开关。
- 服务状态：服务数量、异常服务、响应状态、安全配置健康。

## 组件注册表

固定业务组件类型：

- `MetricCard`：关键指标卡，必须用于金额、数量和状态指标。
- `DataTable` 或现有表格壳：列表展示，必须有空状态。
- `DateRangeFilter` 或日期筛选区域：账单页面使用。
- `SiteLogoField`：管理台站点 logo 编辑，必须支持预览、粘贴 URL、清除。
- `HomeContentEditor`：管理台首页内容编辑，必须使用等宽代码框。
- `StatusBadge` 或现有 badge：状态只显示业务词，不显示 raw status。
- `ActionPanel` 或现有操作区：充值、退款、调整计划和危险操作使用。

## DTO 和 API 来源

- 公开站点设置：`GET /portal/api/public/settings`
- 管理台站点设置保存：`POST /portal/admin/settings`
- 当前用户：`GET /portal/api/me`
- 工作台总览：`GET /portal/api/overview`
- 计算资源：`GET /portal/api/resources`
- 文件空间：`GET /portal/api/workspace`
- 任务执行：`GET /portal/api/session-traces`
- 账单摘要：`GET /portal/api/billing/summary`
- 账单明细：`GET /portal/api/billing/details`
- 管理台总览：`GET /portal/api/admin/overview`
- 客户账户：`GET /portal/api/admin/users`
- 账单管理：`GET /portal/api/admin/billing-ops`
- 任务记录：`GET /portal/api/admin/usage`
- 审计记录：`GET /portal/api/admin/audit`
- 服务状态：`GET /portal/api/admin/system`

## 验收方式

验收必须动静态结合：

- 静态 smoke 检查合同 JSON、禁词、路由、前后端 API、组件落点和 Vue 文案。
- API smoke 启动本地 Portal，用真实 HTTP 验证公开站点设置、登录、管理台保存和回读。
- 浏览器 smoke 打开首页、登录页、工作台和管理台页面，确认页面不是空白、没有不可用 OIDC 主按钮、核心文案存在。
- `npm --prefix services/portal run check` 必须通过。
- 前端 typecheck 和 build 在依赖安装后必须通过。

Portal UI 正式验证入口统一为：

```bash
node scripts/smoke-test-v22-portal-runtime-suite.mjs --group all
```

允许保留叶子 smoke 作为调试入口，但新增 Portal UI 验收不得继续散落成无入口的单脚本；必须先挂入 `scripts/smoke-test-v22-portal-runtime-suite.mjs` 的 group。

## Contract Data

<!-- v22-portal-workbench-management-ui-composition-contract:start -->
```json
{
  "contract": "v22_portal_workbench_management_ui_composition_boundary",
  "version": 2,
  "model": "gpt-5.4",
  "scope": {
    "portalOnly": true,
    "implementsUi": true,
    "callsRealCloud": false,
    "readsSecrets": false,
    "modifiesUpstream": false,
    "modifiesDeploy": false
  },
  "entryNaming": {
    "userSurface": "工作台",
    "adminSurface": "管理台",
    "forbiddenUiTerms": [
      "客户工作台",
      "平台管理台",
      "商业化",
      "商业",
      "SaaS 总览",
      "运维面",
      "运营总台",
      "告警中心",
      "账务"
    ],
    "slashSeparatedUiCopyAllowed": false
  },
  "publicHome": {
    "enabled": true,
    "settingsApi": "GET /portal/api/public/settings",
    "adminSaveRoute": "POST /portal/admin/settings",
    "fields": [
      "siteName",
      "siteLogo",
      "siteSubtitle",
      "homeContent"
    ],
    "homeContentModes": [
      "empty_default_opl_intro",
      "url_iframe",
      "html_full_page"
    ]
  },
  "loginRegister": {
    "loginPrimaryMode": "email_password",
    "registerPrimaryMode": "name_email_password",
    "loginSuccessLocation": "/overview",
    "oidcPrimaryButtonAllowed": false,
    "usesPublicSettingsBrand": true
  },
  "visibleRoutes": {
    "routerBase": "/",
    "publicHome": "/",
    "login": "/login",
    "register": "/register",
    "workbenchOverview": "/overview",
    "managementSystem": "/admin/system",
    "legacyPortalAppPrefix": "/portal/app",
    "legacyPortalAppPrimary": "compat_redirect_only"
  },
  "uiArchitecture": {
    "method": "sub2api_style_layout_first",
    "layers": [
      "route_entry",
      "token",
      "primitive",
      "layout",
      "domain_composable",
      "feature_component",
      "page_orchestration",
      "harness_validation"
    ],
    "sequence": [
      "visual_primitives",
      "page_layouts",
      "common_patterns",
      "domain_components",
      "view_orchestration",
      "state_composables",
      "contract_harness"
    ],
    "layoutProtocol": [
      "DashboardPageLayout",
      "TablePageLayout",
      "DetailPageLayout"
    ],
    "tokenSources": [
      "services/portal/frontend/tailwind.config.ts",
      "services/portal/frontend/src/style.css"
    ],
    "primitiveSources": [
      "services/portal/frontend/src/style.css",
      "services/portal/frontend/src/components/common"
    ],
    "layoutSources": [
      "services/portal/frontend/src/layouts"
    ],
    "currentFeatureComponentSources": [
      "services/portal/frontend/src/components/overview",
      "services/portal/frontend/src/components/billing",
      "services/portal/frontend/src/components/admin"
    ],
    "targetFeatureComponentSources": [
      "services/portal/frontend/src/components/overview",
      "services/portal/frontend/src/components/billing",
      "services/portal/frontend/src/components/resources",
      "services/portal/frontend/src/components/workspace",
      "services/portal/frontend/src/components/trace",
      "services/portal/frontend/src/components/admin"
    ],
    "pageRole": "orchestration_only",
    "viewForbiddenResponsibilities": [
      "large_repeated_table_markup",
      "raw_status_mapping",
      "cross_domain_api_loading",
      "business_dto_assembly"
    ],
    "surfaceRegistry": "services/portal/frontend/src/harness/portal-ui-surfaces.ts",
    "requiredDomAnchors": [
      "data-route-id",
      "data-component-id"
    ]
  },
  "copyArchitecture": {
    "i18nEntry": "services/portal/frontend/src/plugins/i18n.ts",
    "copySource": "i18n_or_responsibility_vocabulary",
    "rawStatusVisible": false,
    "forbiddenUiTerms": [
      "账务",
      "客户工作台",
      "平台管理台",
      "商业化",
      "商业",
      "SaaS 总览",
      "运维面",
      "运营总台",
      "告警中心"
    ]
  },
  "workbenchPages": [
    "总览",
    "计算资源",
    "任务执行",
    "文件空间",
    "账单"
  ],
  "managementPages": [
    "平台总览",
    "客户账户",
    "资源管理",
    "任务记录",
    "账单管理",
    "审计记录",
    "站点设置",
    "服务状态"
  ],
  "workbenchForbiddenTokens": [
    "tenantId",
    "resourceOrderId",
    "resourceBindingId",
    "serverPlanId",
    "runId",
    "CVM",
    "COS",
    "K8s",
    "TKE",
    "SecretId",
    "SecretKey",
    "raw API Key",
    "objectKey",
    "storageKey",
    "signedUrl"
  ],
  "componentRegistry": [
    "MetricCard",
    "DataTable",
    "DateRangeFilter",
    "SiteLogoField",
    "HomeContentEditor",
    "StatusBadge",
    "ActionPanel"
  ],
  "primitiveRegistry": [
    "empty-state",
    "pager-bar",
    "table-shell",
    "desktop-table-shell",
    "mobile-card-list",
    "input",
    "btn",
    "card",
    "badge"
  ],
  "dtoApiSources": {
    "publicSettings": "GET /portal/api/public/settings",
    "siteSettingsSave": "POST /portal/admin/settings",
    "currentUser": "GET /portal/api/me",
    "overview": "GET /portal/api/overview",
    "resources": "GET /portal/api/resources",
    "workspace": "GET /portal/api/workspace",
    "taskExecution": "GET /portal/api/session-traces",
    "billingSummary": "GET /portal/api/billing/summary",
    "billingDetails": "GET /portal/api/billing/details",
    "adminOverview": "GET /portal/api/admin/overview",
    "adminUsers": "GET /portal/api/admin/users",
    "adminBilling": "GET /portal/api/admin/billing-ops",
    "adminUsage": "GET /portal/api/admin/usage",
    "adminAudit": "GET /portal/api/admin/audit",
    "adminSystem": "GET /portal/api/admin/system"
  },
  "runtimeSmokeEntrypoint": "scripts/smoke-test-v22-portal-runtime-suite.mjs",
  "validationGroups": [
    "contract",
    "architecture",
    "api",
    "build",
    "browser"
  ]
}
```
<!-- v22-portal-workbench-management-ui-composition-contract:end -->

## Non-goals

- 不迁移 Portal 后端到 Go。
- 不调用真实云。
- 不读取 secret。
- 不创建、释放或修改真实资源。
- 不接真实支付。
- 不修改 one-person-lab upstream。
- 不修改 deploy、`.sentrux` 或 `adapters`。
