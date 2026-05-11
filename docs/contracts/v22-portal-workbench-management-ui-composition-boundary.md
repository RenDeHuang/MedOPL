# v22 Portal Workbench Management UI Composition Boundary

本合同固定 Portal 可见界面的页面任务、组件边界、数据来源和验收方式。它不替代 role surface 合同和结构治理合同；它把这些合同落实到可运行的 Portal UI、API 和 smoke。

本合同使用 Sub2API 的产品工程模式作为参考：公共首页可以由管理台配置，登录页保持账号密码入口，业务页面由固定组件组合，静态合同检查和运行时验收必须同时存在。

## 分支意图

本分支只处理 Portal 工作台和管理台的 UI 组合、站点设置、公用首页、登录注册、页面命名、组件落点和测试入口统一。

本分支不处理 Go 后端迁移，不接真实云，不读取 secret，不修改 upstream，不修改 deploy，不执行 build/push、kubectl 或 live-test。

## 入口命名

- 用户进入应用后的主区域叫工作台。
- 管理员进入应用后的主区域叫管理台。
- UI 不使用“客户工作台”“平台管理台”“商业化”“商业”“SaaS 总览”“运维面”“运营总台”“告警中心”。
- UI 不使用斜杠组合词表达一个字段；需要两个含义时拆成两个字段。
- 管理台可以展示后台排查信息，但页面名和按钮名必须面向管理动作，不使用云控制台叙事。

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
- 账务：余额、可用余额、冻结金额、累计消费、今日消费、账户流水、充值记录、退款记录。

工作台不得展示 `tenantId`、`resourceOrderId`、`resourceBindingId`、`serverPlanId`、`runId`、`CVM`、`COS`、`K8s`、`TKE`、`SecretId`、`SecretKey`、`raw API Key`、`objectKey`、`storageKey`、`signedUrl`。

## 管理台页面任务

管理台固定页面：

- 平台总览：账号数、工作空间数、今日任务、平均响应、今日消费、累计消费、最近任务、待处理事项。
- 客户账户：账号开通、状态、余额、手动充值、退款、注册设置。
- 资源管理：计算资源、文件空间、套餐、并发、释放状态。
- 任务记录：用户、工作空间、任务、状态、成本、详情。
- 账务管理：待处理账单、最近调整、成本构成、对账状态。
- 审计记录：事件、来源、账号、操作人、工作空间、时间、详情。
- 站点设置：站点名称、站点 logo、站点副标题、首页内容、注册开关。
- 服务状态：服务数量、异常服务、响应状态、安全配置健康。

## 组件注册表

固定业务组件类型：

- `MetricCard`：关键指标卡，必须用于金额、数量和状态指标。
- `DataTable` 或现有表格壳：列表展示，必须有空状态。
- `DateRangeFilter` 或日期筛选区域：账务页面使用。
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
- 账务摘要：`GET /portal/api/billing/summary`
- 账务明细：`GET /portal/api/billing/details`
- 管理台总览：`GET /portal/api/admin/overview`
- 客户账户：`GET /portal/api/admin/users`
- 账务管理：`GET /portal/api/admin/billing-ops`
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

## Contract Data

<!-- v22-portal-workbench-management-ui-composition-contract:start -->
```json
{
  "contract": "v22_portal_workbench_management_ui_composition_boundary",
  "version": 1,
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
      "告警中心"
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
    "oidcPrimaryButtonAllowed": false,
    "usesPublicSettingsBrand": true
  },
  "workbenchPages": [
    "总览",
    "计算资源",
    "任务执行",
    "文件空间",
    "账务"
  ],
  "managementPages": [
    "平台总览",
    "客户账户",
    "资源管理",
    "任务记录",
    "账务管理",
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
    "api",
    "browser",
    "build"
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
