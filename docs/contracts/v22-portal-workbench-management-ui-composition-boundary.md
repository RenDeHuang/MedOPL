# v22 Portal Workbench Management UI Composition Boundary

本合同固定 Portal UI 的产品边界、分层规则、禁词、evalset 入口和统一验证入口。它不替代 role surface 合同和结构治理合同，也不继续承载每个页面、组件和 API shape 的细节。

本合同 v8 的核心变化是继续瘦身：页面任务、组件锚点、组件状态、组件 fixture、组件可视化工作台、截图回归、route、API shape、禁词、设计 token 和展示规则进入可执行 evalset，由 smoke 读取 evalset 执行检查。合同只作为边界和入口索引。

`leaf-portal-ui-design-quality-implementation` 已把 overview 首屏的可执行 UI truth 写回 evalset：`overview.hero` 的 page task 现在要求回答“用户买了什么托管科研工作台服务、当前能不能进入 OPL、环境套餐算力存储释放状态、文件任务结果在哪里以及下一步点哪里”。对应 fixture、surface invariants、copy registry 和 screenshot baseline 均由 `services/portal/frontend/src/harness/portal-ui-evalset.json` 与 visual workbench 承接。

## 合同职责

本合同只负责：

- 产品边界：Portal 是工作台和管理台，不是云资源控制台。
- UI 分层规则：route entry、page shell、layout、common、feature component、view orchestration、composable、API module、harness eval。
- 禁词和主叙事：工作台、管理台、账单、余额、冻结金额、累计消费、今日消费、计算资源、文件空间、任务执行、运行轨迹。
- evalset 路径：`services/portal/frontend/src/harness/portal-ui-evalset.json`。
- 统一验证入口：`node scripts/smoke-test-v22-portal-runtime-suite.mjs --group all`。

本合同不再负责：

- 逐条列出所有 surface 组件。
- 逐条列出所有 API response key。
- 逐条列出所有 DOM selector。
- 用长篇执行矩阵替代可执行测试。

上述细节必须进入 evalset 和 smoke。

## 设计参考和工程框架

Portal UI 的工程框架以本仓库 Vue、Tailwind、composition API、Portal API module、composable、component 和 smoke harness 为准。

Sub2API 只作为工程化验证模式参考：顶层 route、账号密码登录、role-based surface、token/primitive、layout、common、业务组件、view 组装、store/composable 和 build/test/browser 校验。不得复制 Sub2API 代码、路由、鉴权、存储结构或产品名词。

`nextlevelbuilder/ui-ux-pro-max-skill` 只作为设计 pattern 参考，用于信息层级、card/list/table 选择、配色字体气质和 anti-pattern 检查。它不引入外部框架，不替代本合同的 Portal 架构，不改变工作台/管理台主叙事。

## UI 分层规则

Portal UI 必须按以下层级落到代码和 eval：

- route entry：公开首页、登录页、注册页由后端渲染；登录后工作台和管理台由 SPA route 承接；旧 `/portal/app/*` 只能兼容重定向。
- page shell：`AppLayout`、`AppHeader`、`AppSidebar` 只负责应用壳、导航、顶部栏、移动端展开和滚动边界。
- page layout：`DashboardPageLayout`、`TablePageLayout`、`DetailPageLayout` 固定页面骨架和 slot 顺序。
- common component：跨页面复用原语放在 `src/components/common/*`。
- feature component：业务组件按域放在 `src/components/overview`、`billing`、`resources`、`workspace`、`trace`、`admin`。
- page orchestration：`src/views/*` 只负责 route 参数、composable 调用和组件装配，不沉淀大段重复 UI。
- state/composable：`src/composables/*` 承担 loader、query、formatter、pagination、action handler 和局部错误态。
- API module：`src/api/portal/*` 只承担 HTTP 和类型映射。
- harness eval：`portal-ui-evalset.json` 固定 route、layout、surface、API shape、禁词、DOM 锚点和页面任务。

## 可执行 Evalset

Portal UI 的可执行事实源是：

```text
services/portal/frontend/src/harness/portal-ui-evalset.json
```

evalset 当前 schema 是 `2026-05-harness-native`。它必须作为机器可执行事实源，而不是新的长篇合同正文。

evalset 必须包含：

- `routes`
- `surfaces`
- `layouts`
- `apiShapes`
- `forbiddenCopy`
- `requiredDomAnchors`
- `pageTasks`
- `primitives`
- `copyRegistry`
- `fixtures`
- `visualRoutes`
- `pageComposition`
- `surfaceStates`
- `componentFixtures`
- `designTokens`
- `presentationRules`
- `visualWorkbench`
- `screenshotRegression`
- `owners`
- `acceptance`
- `artifactPolicy`
- `coverage`

evalset 中 `status` 只能是 `done`、`partial` 或 `missing`。`partial` 和 `missing` 必须写明 `nextRequiredChange`，不得伪装成完成。

DOM 锚点规则：

- layout 使用 `data-layout-id`。
- feature surface 使用 `data-route-id` 和 `data-component-id`。
- 已标记 `done` 的 surface 必须真实埋锚点，并进入 `portal-ui-surfaces.ts`。
- 管理台尚未组件化页面必须在 evalset 中标为 `partial`，不能在合同中写成已完成。

下一层 UI gate 仍由 evalset 承接：

- 页面组合 gate 固定在 `pageComposition`，用于检查每页是否按指标区、筛选区、主列表或主表格、操作区和详情区组织。
- 组件状态 gate 固定在 `surfaceStates`，用于检查每个 done surface 是否声明稳定问题、状态和不变量，并与 `portal-ui-surfaces.ts` 对齐。
- 组件 fixture gate 固定在 `componentFixtures`，用于检查每个 done surface 是否至少有可执行状态样例。
- 设计 token gate 固定在 `designTokens`，用于检查 Tailwind token 和共享样式原语仍在代码中承接。
- 展示规则 gate 固定在 `presentationRules`，用于检查指标优先、筛选先于表格、动作明确、表格只用于多对象比较和禁词边界。
- 通用组件 gate 固定在 `primitives`，用于检查 DataTable、Pagination、EmptyState、StatusBadge、MetricCard、FormField、FilterToolbar、ActionToolbar 和 PageSection 等可复用组件是否有稳定锚点和状态声明。
- 文案 gate 固定在 `copyRegistry`，用于阻止内部治理词、斜杠组合字段、英文散落和 raw status 成为可见主语言。
- 数据样例 gate 固定在 `fixtures`，用于保证页面至少覆盖 ready 和 empty 数据态。
- 视觉 gate 固定在 `visualRoutes`，用于浏览器打开关键页面并检查关键 selector 与横向溢出。
- 组件可视化工作台 gate 固定在 `visualWorkbench`，用于检查 `/__portal-harness/components` 和每个 fixture state 独立 URL；页面从 evalset、fixtures 和真实组件 registry 生成，不新增 Storybook stories 第二事实源。`done` 必须代表 fixture state 页面真实渲染对应业务组件，JSON payload 只能作为辅助检查信息。
- 截图回归 gate 固定在 `screenshotRegression`，用于检查 Playwright `toHaveScreenshot()` 视觉测试入口、关键页面和真实组件 fixture URL、以及提交到 git 的 baseline 目录。

## 文案边界

用户侧主语言是：

- 工作台
- 计算资源
- 任务执行
- 文件空间
- 账单
- 余额
- 冻结金额
- 累计消费
- 今日消费
- 输入文件
- 输出文件
- 运行轨迹

管理侧主语言是：

- 管理台
- 平台总览
- 客户账户
- 资源管理
- 任务记录
- 账单管理
- 审计记录
- 站点设置
- 服务状态

UI 不使用：

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

UI 不使用斜杠组合词表达一个字段；需要两个含义时拆成两个字段。状态展示必须映射成用户可理解文案，不能把 raw status、内部枚举或后台字段直接作为可见主语言。

## 合同降权规则

为避免合同继续膨胀，UI 相关合同分工如下：

- role surface 合同只管普通用户和管理台的角色边界。
- structure/failure isolation 合同只管 Portal 模块边界和 failure isolation。
- shared surface 合同只管 Portal、OPL 和管理台共享产品语义。
- 本 composition 合同只管 Portal UI 执行入口、分层规则和 evalset 入口。
- 具体页面、组件、API shape、DOM selector 和 partial 缺口必须进入 evalset，不再散落在合同正文。

## 验收方式

正式验收入口统一为：

```bash
node scripts/smoke-test-v22-portal-runtime-suite.mjs --group all
```

关键分组：

```bash
node scripts/smoke-test-v22-portal-runtime-suite.mjs --group surface
node scripts/smoke-test-v22-portal-runtime-suite.mjs --group api
node scripts/smoke-test-v22-portal-runtime-suite.mjs --group browser
```

`surface` 分组必须读取 evalset 并检查：

- route 是否存在。
- DOM 锚点是否存在。
- surface registry 是否和 done surface 对齐。
- 禁词是否出现在可见文案中。
- API shape 是否有 required keys、required paths 和 forbidden keys。
- frontend test 入口是否存在。
- admin 页面 partial 缺口是否明确。
- 浏览器能真实打开首页、登录页、工作台、管理台站点设置和 evalset visual routes，并能看到关键 DOM 锚点。
- page composition、surface states、component fixtures、design tokens 和 presentation rules 全部由 surface smoke 静态检查。
- `.runtime/portal-surface-eval/report.json` 能生成结构化报告；该报告不进 git。

## Product Goal Characterization

`leaf-frontend-product-evalset-gap` has characterized the Portal UI evalset as the current executable frontend product truth source. The absorbed local gates are:

- `node scripts/smoke-test-v22-portal-frontend-surface-composables.mjs`
- `node scripts/smoke-test-v22-portal-frontend-surface-eval.mjs`
- `node scripts/smoke-test-v22-portal-runtime-suite.mjs --group surface`

The evalset currently proves 14 routes, 3 layouts, 32 done surfaces, 8 API shapes, 9 primitives, 26 copy registry entries, 11 fixtures, 13 visual routes, page composition, surface states, component fixtures, visual workbench, screenshot regression metadata, design tokens, presentation rules, browser DOM anchors, and runtime report generation. The surface runtime suite also runs 8 Playwright visual tests through component fixture pages. Runtime evidence remains under `.runtime/portal-surface-eval/report.json` and is not committed.

This characterization does not change Portal UI implementation, does not upgrade dependencies, does not run deploy/live/cloud/build/push/kubectl, does not read secrets, and does not modify upstream one-person-lab.

## 分支边界

本分支只处理 Portal 工作台和管理台的 UI composition、evalset、surface harness、站点设置、公用首页、登录注册、页面命名、组件落点、架构边界和测试入口统一。

本分支不处理 Go 后端迁移，不接真实云，不读取 secret，不修改 upstream，不修改 deploy，不执行 build/push、kubectl 或 live-test。

模型记录：`gpt-5.4`。

## Contract Data

<!-- v22-portal-workbench-management-ui-composition-contract:start -->
```json
{
  "contract": "v22_portal_workbench_management_ui_composition_boundary",
  "version": 8,
  "model": "gpt-5.4",
  "scope": {
    "portalOnly": true,
    "implementsUi": true,
    "callsRealCloud": false,
    "readsSecrets": false,
    "modifiesUpstream": false,
    "modifiesDeploy": false
  },
  "contractRole": "ui_boundary_and_eval_entrypoint_only",
  "evalset": {
    "path": "services/portal/frontend/src/harness/portal-ui-evalset.json",
    "schemaVersion": "2026-05-harness-native",
    "owns": [
      "routes",
      "surfaces",
      "layouts",
      "apiShapes",
      "forbiddenCopy",
      "requiredDomAnchors",
      "pageTasks",
      "primitives",
      "copyRegistry",
      "fixtures",
      "visualRoutes",
      "pageComposition",
      "surfaceStates",
      "componentFixtures",
      "designTokens",
      "presentationRules",
      "visualWorkbench",
      "screenshotRegression",
      "owners",
      "acceptance",
      "artifactPolicy",
      "coverage"
    ],
    "smoke": "scripts/smoke-test-v22-portal-frontend-surface-eval.mjs",
    "runtimeReportPath": ".runtime/portal-surface-eval/report.json",
    "runtimeReportCommitted": false
  },
  "uiArchitecture": {
    "method": "sub2api_style_layout_first_with_executable_evalset",
    "layers": [
      "route_entry",
      "page_shell",
      "page_layout",
      "common_component",
      "feature_component",
      "page_orchestration",
      "state_composable",
      "api_module",
      "harness_eval"
    ],
    "pageRole": "orchestration_only",
    "surfaceFactsLiveInEvalset": true,
    "apiShapeFactsLiveInEvalset": true,
    "productizedUiSystemFactsLiveInEvalset": true,
    "pageCompositionFactsLiveInEvalset": true,
    "surfaceStateFactsLiveInEvalset": true,
    "componentFixtureFactsLiveInEvalset": true,
    "designTokenFactsLiveInEvalset": true,
    "presentationRuleFactsLiveInEvalset": true,
    "visualWorkbenchFactsLiveInEvalset": true,
    "screenshotRegressionFactsLiveInEvalset": true
  },
  "copyArchitecture": {
    "rawStatusVisible": false,
    "slashSeparatedUiCopyAllowed": false,
    "forbiddenUiTerms": [
      "客户工作台",
      "平台管理台",
      "商业化",
      "商业",
      "SaaS 总览",
      "运维面",
      "运营总台",
      "告警中心",
      "账务",
      "使用统一账号登录"
    ]
  },
  "contractDemotion": {
    "roleSurfaceContractsOwn": "role_boundary_only",
    "structureContractOwns": "module_boundary_and_failure_isolation_only",
    "sharedSurfaceContractOwns": "shared_product_semantics_only",
    "compositionContractOwns": "ui_boundary_and_eval_entrypoint_only",
    "surfaceAndApiDetailsOwn": "portal_ui_evalset"
  },
  "runtimeSmokeEntrypoint": "scripts/smoke-test-v22-portal-runtime-suite.mjs",
  "validationGroups": [
    "contract",
    "surface",
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
