# v22 Portal Workbench Management UI Composition Boundary

本合同固定 Portal UI 的产品边界、分层规则、禁词、Figma Make ZIP surface gate 和统一验证入口。它不替代 role surface 合同和结构治理合同，也不继续承载每个页面、组件和 API shape 的细节。

本合同 v11 的核心变化是继续瘦身并收敛到当前 Figma Make ZIP 普通用户和管理员 Portal：页面结构和组件实现以 ZIP 源码为准，API shape 由 `src/app/data/portalAdapters.ts` 和 `src/api/portal/*` 承接，surface smoke 读取 ZIP 文件树、active routes、layout、API adapter 和旧文件物理删除状态执行检查。旧 visual workbench、截图 baseline、Vue harness/evalset 和旧 `AdminConsole.tsx` residue 不再是当前完成证据。

`leaf-portal-figma-make-react-ui-implementation` 把当前普通用户和管理员 Portal 的可执行 UI truth 收敛到 Figma Make ZIP：6 个用户路由必须回答“用户买了什么托管科研工作台服务、当前能不能进入 OPL、环境套餐算力存储释放状态、文件任务结果在哪里以及下一步点哪里”；7 个管理员路由必须展示管理总览、用户管理、公告与待处理事项、账单处理、审计记录、站点设置和服务状态。对应 route、surface、页面结构和 primitive 由 `services/portal/frontend/src/app/**` 承接；API 接入由 `services/portal/frontend/src/app/data/portalAdapters.ts` 和 `services/portal/frontend/src/api/portal/*` 承接。`/admin/users` 和 `/admin/alerts` 允许接入现有本地 Portal 管理动作；`/admin/ops` 是已挂载服务状态页面，但后端默认可返回 `404 ops_surface_disabled`；前端必须展示明确 disabled 产品态，不能渲染 generic error 或伪成功。

## 合同职责

本合同只负责：

- 产品边界：Portal 是工作台和管理台，不是云资源控制台。
- UI 分层规则：route entry、page shell、layout、ZIP page component、Portal API adapter、API module、ZIP surface smoke。
- 禁词和主叙事：工作台、管理台、账单、余额、冻结金额、累计消费、今日消费、计算资源、文件空间、任务执行、运行轨迹。
- Figma Make ZIP app root：`services/portal/frontend/src/app`。
- 统一验证入口：`node scripts/smoke-test-v22-portal-runtime-suite.mjs --group all`。
- ZIP surface gate 入口：`node scripts/smoke-test-v22-portal-frontend-surface-eval.mjs`。

本合同不再负责：

- 逐条列出所有 surface 组件。
- 逐条列出所有 API response key。
- 逐条列出所有 DOM selector。
- 用长篇执行矩阵替代可执行测试。

上述细节必须进入 ZIP source、Portal API adapter 和 smoke。

## 设计参考和工程框架

Portal UI 的工程框架由本合同和 `v22-portal-figma-make-ui-implementation-boundary.md` 分层固定：本合同继续负责 UI composition 和 smoke 入口；当前实现 leaf 授权 Portal 全体前端技术栈收敛为 React + Vite + TypeScript + react-router + shadcn/Radix + lucide。历史 Vue / Pinia 代码只作为待清退实现，不再是目标技术栈。

`DESIGN.md` 是 Portal UI 重构的设计执行源，用于把本合同、role surface 合同、SaaS control-plane UX 合同和 Figma Make implementation leaf 转成产品气质、信息架构、组件系统、文案规则、视觉规则、Figma Make ZIP 吸收流程和重构 slice。`DESIGN.md` 不替代本合同，不替代 Figma Make ZIP source-of-truth，不替代 smoke，也不授权修改 Portal 后端、Gateway、Runtime Bridge、deploy、`.sentrux`、adapters、upstream、secret、真实云、build/push/kubectl 或 live-test。

Sub2API 只作为工程化验证模式参考：顶层 route、账号密码登录、role-based surface、token/primitive、layout、common、业务组件、view 组装、store/composable 和 build/test/browser 校验。不得复制 Sub2API 代码、路由、鉴权、存储结构或产品名词。

`nextlevelbuilder/ui-ux-pro-max-skill` 只作为设计 pattern 参考，用于信息层级、card/list/table 选择、配色字体气质和 anti-pattern 检查。它不引入外部框架，不替代本合同的 Portal 架构，不改变工作台/管理台主叙事。

## UI 分层规则

Portal UI 必须按以下层级落到代码和 eval：

- route entry：公开首页、登录页、注册页由后端渲染；登录后工作台和管理台由 SPA route 承接；旧 `/portal/app/*` 已删除且不得恢复为兼容入口。
- page shell：`src/app/components/Layout.tsx` 只负责应用壳、导航、顶部栏和滚动边界。
- ZIP page component：`src/app/pages/*` 保持 Figma Make 页面结构，并只增加必要的 Portal API query wiring。
- shared UI component：`src/app/components/ui/*` 保持 Figma Make / shadcn-Radix primitives。
- Portal API adapter：`src/app/data/portalAdapters.ts` 承担 loader、query、formatter 和 API payload 到页面 model 的映射。
- API module：`src/api/portal/*` 只承担 HTTP 和类型映射。
- ZIP surface smoke：`scripts/smoke-test-v22-portal-frontend-surface-eval.mjs` 固定 ZIP 文件树、route、layout、API adapter、禁词、secret hygiene 和旧文件清退。

## 可执行 Surface Gate

Portal UI 的可执行事实源是 Figma Make ZIP 与复制后的 app root：

```text
/mnt/c/Users/Administrator/Downloads/MedOPL+Portal+UI+Design+(1).zip
/tmp/medopl-figma-make-source-admin
services/portal/frontend/src/app
services/portal/frontend/src/app/data/portalAdapters.ts
```

surface smoke 必须检查：

- `src/app` 文件树与 ZIP `src/app` 一致，只允许额外存在 `data/portalAdapters.ts`，并排除旧 `pages/AdminConsole.tsx`。
- `src/styles` 文件树与 ZIP `src/styles` 一致。
- active routes 包含 `/overview`、`/resources`、`/workspace`、`/trace`、`/billing`、`/opl-launch` 和 `/admin/dashboard`、`/admin/users`、`/admin/alerts`、`/admin/billing-ops`、`/admin/audit`、`/admin/system`、`/admin/ops`。
- 旧 `AdminConsole.tsx` 不得存在于 active frontend。
- 每个 active page 通过 `usePortalQuery` 调用对应 `load*Model`。
- `portalAdapters.ts` 调用现有 `/portal/api/*` adapter。
- `/admin/ops` 对 `ops_surface_disabled` 有明确产品态映射。
- 旧 Vue SPA、旧 harness、旧 screenshot baseline 和上一轮根级 React shell 物理不存在。
- 当前实现 leaf 的视觉验收由 React route DOM 锚点、typecheck、build 和本地预览承接；旧 `/__portal-harness/components` visual workbench 与 Playwright screenshot baseline 已从本轮必过面降级为后续可选 leaf。

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
- 用户管理
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
- 本 composition 合同只管 Portal UI 执行入口、分层规则和 ZIP surface gate 入口。
- 具体页面、组件、API shape 和缺口必须进入 ZIP source、Portal adapter 或后续专门 UI leaf，不再散落在合同正文。

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

`surface` 分组必须读取 ZIP source、React app 和 Portal adapter 并检查：

- route 是否存在。
- ZIP 文件树是否一致。
- 禁词是否出现在可见文案中。
- API adapter 是否调用现有 `/portal/api/*`。
- 管理员 route 存在且导航展示由 `/portal/api/me` 角色投影控制；RoleContext 不是安全边界。
- `/admin/ops` route 存在，但默认后端 `404 ops_surface_disabled` 必须显示为“平台托管运维入口未启用”产品态。
- 浏览器能真实打开首页、登录页、当前 6 个普通用户 Portal 路由和当前 7 个管理员 Portal 路由，并能看到关键 DOM 锚点。
- `.runtime/portal-surface-eval/report.json` 能生成结构化报告；该报告不进 git。

## Product Goal Characterization

`leaf-frontend-product-evalset-gap` 曾把 Vue 时代的 Portal UI evalset characterization 写成前端产品事实源；本轮 `leaf-portal-figma-make-react-ui-implementation` 将当前可执行事实源收敛为 React/Figma Make ZIP 普通用户和管理员 Portal。

- `node scripts/smoke-test-v22-portal-frontend-surface-eval.mjs`
- `node scripts/smoke-test-v22-portal-runtime-suite.mjs --group surface`

The current surface smoke proves 6 ordinary user routes, 7 admin routes, ZIP file-tree parity, layout navigation, Portal API adapter ownership, forbidden copy, browser secret hygiene, old file physical retirement and runtime report generation. Old AdminConsole residue, visual workbench and screenshot regression are no longer current Portal completion evidence.

This characterization does not change Portal UI implementation, does not upgrade dependencies, does not run deploy/live/cloud/build/push/kubectl, does not read secrets, and does not modify upstream one-person-lab.

## 分支边界

本分支只处理 Portal 工作台和管理台的 Figma Make ZIP absorption、UI composition、surface smoke、页面命名、API adapter wiring、架构边界和测试入口统一。

本分支不处理 Go 后端迁移，不接真实云，不读取 secret，不修改 upstream，不修改 deploy，不执行 build/push、kubectl 或 live-test。

模型记录：`gpt-5.4`。

## Contract Data

<!-- v22-portal-workbench-management-ui-composition-contract:start -->
```json
{
  "contract": "v22_portal_workbench_management_ui_composition_boundary",
  "version": 11,
  "model": "gpt-5.4",
  "scope": {
    "portalOnly": true,
    "implementsUi": true,
    "callsRealCloud": false,
    "readsSecrets": false,
    "modifiesUpstream": false,
    "modifiesDeploy": false
  },
  "contractRole": "ui_boundary_and_zip_surface_eval_entrypoint",
  "uiImplementationSource": {
    "kind": "figma_make_zip",
    "contract": "docs/contracts/v22-portal-figma-make-ui-implementation-boundary.md",
    "zipPath": "/mnt/c/Users/Administrator/Downloads/MedOPL+Portal+UI+Design+(1).zip",
    "extractedPath": "/tmp/medopl-figma-make-source-admin",
    "appRoot": "services/portal/frontend/src/app",
    "userRoutes": [
      "/overview",
      "/resources",
      "/workspace",
      "/trace",
      "/billing",
      "/opl-launch"
    ],
    "adminRoutes": [
      "/admin/dashboard",
      "/admin/users",
      "/admin/alerts",
      "/admin/billing-ops",
      "/admin/audit",
      "/admin/system",
      "/admin/ops"
    ],
    "adminConsoleCopiedAsUnroutedResidue": false,
    "activeAdminRouteMounted": true,
    "adminOpsDefaultProductState": {
      "routeMounted": true,
      "backendDisabledStatus": 404,
      "backendDisabledError": "ops_surface_disabled",
      "frontendDisabledCopy": "平台托管运维入口未启用"
    }
  },
  "surfaceSmoke": {
    "smoke": "scripts/smoke-test-v22-portal-frontend-surface-eval.mjs",
    "runtimeReportPath": ".runtime/portal-surface-eval/report.json",
    "runtimeReportCommitted": false
  },
  "uiArchitecture": {
    "method": "figma_make_zip_routes_with_portal_api_adapter",
    "layers": [
      "route_entry",
      "page_shell",
      "page_layout",
      "zip_page_component",
      "portal_api_adapter",
      "api_module",
      "zip_surface_smoke"
    ],
    "pageRole": "zip_page_with_portal_api_wiring",
    "surfaceFactsLiveInZipSource": true,
    "apiShapeFactsLiveInPortalApiAdapter": true,
    "visualWorkbenchFactsLiveInCurrentGate": false,
    "screenshotRegressionFactsLiveInCurrentGate": false
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
    "compositionContractOwns": "ui_boundary_and_zip_surface_eval_entrypoint",
    "surfaceAndApiDetailsOwn": "figma_make_zip_and_portal_api_adapter"
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
