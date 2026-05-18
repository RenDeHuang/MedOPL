# v22 Portal Figma Make UI Implementation Boundary

本合同是 Portal 前端技术栈与 Figma Make UI 吸收的 L4 实现叶子合同。它只授权 Portal frontend 层的技术栈与 UI 实现收敛，不改变 v22 主产品真相，不授权真实云、secret、upstream、deploy、build/push、kubectl 或 live-test。

模型记录：`gpt-5.4`

## 合同目的

本轮不新开 v26。v22 Portal 继续是 MedOPL 的 SaaS 控制面：用户购买托管 OPL 科研工作台、计算能力、文件空间和运行环境，平台负责开通、隔离、计费、审计和释放。

本合同授权把 Portal 全体前端技术栈从历史 Vue / Pinia 方向收敛为 React + Vite + TypeScript + react-router + shadcn/Radix + lucide。这里的“Portal 全体前端技术栈”包括普通用户 Portal 和后续 Admin / Ops Portal UI；只是当前 Figma Make ZIP 只覆盖普通用户端 active route。

## Figma Make 吸收边界

当前可吸收 Figma Make 文件：

- fileKey: `pjLYKml89XFsf8BMNOJ3CV`
- title: MedOPL Portal UI Design
- implementation source: Figma Make ZIP
- zip path: `/mnt/c/Users/Administrator/Downloads/MedOPL+Portal+UI+Design.zip`
- extracted path: `/tmp/medopl-figma-make-source`

本轮的唯一 Portal UI source-of-truth 是上述 Figma Make ZIP，不再按上一轮“合同重组后自行实现的 React shell”作为 UI 事实源继续补丁式吸收。验收以 ZIP 文件树、active route、API adapter、typecheck/build 和本地预览为准。

当前可吸收的普通用户路由：

- `/overview`
- `/resources`
- `/workspace`
- `/trace`
- `/billing`
- `/opl-launch`

当前 Figma Make 源码中存在未被 route 引用的 `AdminConsole.tsx`。为了保持 ZIP 源码物理一致性，本文件复制为 ZIP 源文件残留；但它不是可吸收 admin UI，不得挂载 active route，不得进入导航，不得作为 Admin / Ops 已完成证据。Admin / Ops UI 仍由 `v22-portal-admin-ops-surface-boundary.md` 固定角色边界，后续必须以同一 React 技术栈单独设计、单独合同 leaf、单独验收。

## 清退边界

本轮不是只做故事线清退，而是同时做合同 current-truth 清退、Portal frontend 旧代码清退和物理清退。合同层要把旧 Vue/Pinia 目标栈、旧 visual workbench/screenshot baseline 当前完成证据、旧 route/admin 完成声明、上一轮非 ZIP 1:1 的 React shell 从当前事实源移除；代码层要把旧 Vue SPA 文件、旧 Vue 组件、旧 composable、旧 visual harness、旧 snapshot 和旧根级 React shell 从 `services/portal/frontend/**` 清退，并用 Figma Make ZIP React/Vite UI 接替普通用户 Portal。

本轮清退的旧 frontend surface：

- 历史 Vue SPA 实现。
- `/packages` 普通用户路由。
- `/advanced/servers` 旧高级服务器路由。
- `/admin/*` 当前前端 Vue 页面。
- 历史 `/runtime`、`/tasks`、`/opl` 兼容入口。
- Vue/Pinia 作为 Portal frontend 目标技术栈的合同文案。
- Figma 只能回写历史前端框架或不得引入 React/shadcn 的历史文案。

这些清退不代表 Admin / Ops 产品边界消失，只代表当前 admin UI 没有 Figma Make 完成版，不能被伪装成已完成。

## API 接入边界

Figma Make UI 不能停留在静态 mock。普通用户 6 个页面必须接现有 Portal API adapter：

- `/overview`: `fetchOverview()` 与 `fetchMyResources()`，对应 `/portal/api/overview` 和 `/portal/api/platform-provisioned-resources`。
- `/resources`: `fetchMyResources()`，对应 `/portal/api/platform-provisioned-resources`。
- `/workspace`: `fetchWorkspacePage()`，对应 `/portal/api/workspace`。
- `/trace`: `fetchSessionTraces()`，对应 `/portal/api/session-traces`。
- `/billing`: `fetchBillingSummary()` 与 `fetchBillingDetails()`，对应 `/portal/api/billing/summary` 和 `/portal/api/billing/details`。
- `/opl-launch`: `fetchOplLaunchStatus()`、`fetchOplBootstrap()`、`bindOplSession()`，对应 `/portal/api/opl/launch-status/{launchId}`、`/portal/api/opl/bootstrap` 和 `/portal/api/opl/sessions/bind`。

API 接入只允许走 `services/portal/frontend/src/api/portal/*.ts` 和 `apiClient` 的 `/portal/api` baseURL；本轮不改 Portal 后端服务语义，不伪造成功态，不把 raw key、runtime token、objectKey、localPath 或 signedUrl 渲染到页面。

## 生命周期与文案边界

普通用户主语言继续使用：

- 托管科研工作台
- 运行环境
- 计算资源
- 文件空间
- 工作空间
- 任务与结果
- 账单与审计
- 余额
- 冻结金额
- 进入 OPL

存储生命周期固定为：

- 释放计算资源：停止计费并中断任务，文件空间继续保留，不触发保护期。
- 删除存储资源 / 文件空间：触发 7 天保护期，之后删除所有文件且无法恢复。
- 文件保留：随文件空间保留。

账单页可使用“核对已接入”“已核对”“实时同步”表达当前账单核对状态，但不得把 OpenCost、Langfuse、云账单原始字段或 trace metadata 写成普通用户的账单真相源。

## Secret 和浏览器边界

Portal frontend 不得把以下字段写入 localStorage、sessionStorage、URL query、全局 JS state、日志、evidence 或 git：

- raw API key
- bearer token
- launchToken
- runtimeToken
- provider secret
- SecretId
- SecretKey
- kubeconfig
- objectKey
- localPath
- signedUrl
- presignedUrl

Portal 普通用户页面最多展示 `providerKeyRef`、绑定状态和一次性输入态。raw key 输入和后端密钥边界继续由 token/provider key 合同和 OPL entry/preflight 合同约束。

## 部署边界

本轮默认部署模式是本地可预览部署：

- 安装 Portal frontend 依赖。
- 执行 typecheck/build。
- 启动 Vite dev 或 preview server。
- 提供本地 URL 给用户验收。

真实线上部署、build/push、kubectl、live-test、真实云资源操作和 secret-backed release 均必须另行取得明确授权，不得因本合同自动放行。

## Contract Data

<!-- v22-portal-figma-make-ui-implementation-contract:start -->
```json
{
  "contract": "v22_portal_figma_make_ui_implementation_boundary",
  "version": 1,
  "model": "gpt-5.4",
  "contractRole": "portal_frontend_stack_and_figma_make_implementation_leaf",
  "scope": {
    "portalFrontendOnly": true,
    "changesProductTruth": false,
    "callsRealCloud": false,
    "readsSecrets": false,
    "modifiesUpstream": false,
    "modifiesDeploy": false,
    "allowsPortalFrontendDependencyChange": true
  },
  "figmaMake": {
    "fileKey": "pjLYKml89XFsf8BMNOJ3CV",
    "currentCoverage": "user_portal_only",
    "singleUiSourceOfTruth": "figma_make_zip",
    "implementationSource": "figma_make_react_vite_zip_source",
    "sourceArtifact": {
      "zipPath": "/mnt/c/Users/Administrator/Downloads/MedOPL+Portal+UI+Design.zip",
      "extractedPath": "/tmp/medopl-figma-make-source"
    },
    "adminConsoleCopiedAsUnroutedResidue": true,
    "activeAdminRouteMounted": false
  },
  "portalFrontendStack": {
    "appliesToWholePortalFrontend": true,
    "required": [
      "React",
      "Vite",
      "TypeScript",
      "react-router",
      "shadcn/Radix",
      "lucide-react"
    ],
    "retiredTargetStack": [
      "Vue",
      "Pinia"
    ]
  },
  "userRoutes": [
    "/overview",
    "/resources",
    "/workspace",
    "/trace",
    "/billing",
    "/opl-launch"
  ],
  "retiredFrontendRoutes": [
    "/packages",
    "/advanced/servers",
    "/admin/*",
    "/runtime",
    "/tasks",
    "/opl"
  ],
  "physicalRetirement": {
    "contractCurrentTruthRetired": true,
    "oldVueSpaFilesRemoved": true,
    "oldVisualWorkbenchRemoved": true,
    "oldScreenshotBaselinesRemoved": true,
    "oldContractReorganizedReactUiRemoved": true,
    "replacementUi": "figma_make_zip_physical_source_absorption"
  },
  "apiIntegration": {
    "staticMockOnlyUiAllowed": false,
    "baseUrl": "/portal/api",
    "adapterDirectory": "services/portal/frontend/src/api/portal",
    "requiredAdapters": [
      "overview",
      "resources",
      "workspace",
      "traces",
      "billing",
      "opl"
    ],
    "userRouteApiCoverage": {
      "/overview": [
        "/portal/api/overview",
        "/portal/api/platform-provisioned-resources"
      ],
      "/resources": [
        "/portal/api/platform-provisioned-resources"
      ],
      "/workspace": [
        "/portal/api/workspace"
      ],
      "/trace": [
        "/portal/api/session-traces"
      ],
      "/billing": [
        "/portal/api/billing/summary",
        "/portal/api/billing/details"
      ],
      "/opl-launch": [
        "/portal/api/opl/launch-status/{launchId}",
        "/portal/api/opl/bootstrap",
        "/portal/api/opl/sessions/bind"
      ]
    }
  },
  "adminOpsUi": {
    "currentFigmaCoverage": false,
    "futureSameStack": true,
    "requiresSeparateDesignAndContractLeaf": true,
    "roleBoundaryStillApplies": true
  },
  "lifecycle": {
    "storageDeletionProtectionDays": 7,
    "releaseComputeTriggersStorageProtection": false,
    "fileRetentionCopy": "随文件空间保留"
  },
  "browserSecretHygiene": {
    "rawApiKeyInPublicState": false,
    "launchOrRuntimeTokenInPublicState": false,
    "storagePathOrSignedUrlInPublicState": false
  },
  "deployment": {
    "defaultMode": "local_preview_only",
    "trueProductionDeployRequiresSeparateAuthorization": true
  },
  "verificationCommands": [
    "node scripts/smoke-test-v22-portal-figma-make-ui-implementation-contract.mjs",
    "git diff --check",
    "npm --prefix services/portal/frontend run typecheck",
    "npm --prefix services/portal/frontend run build"
  ]
}
```
<!-- v22-portal-figma-make-ui-implementation-contract:end -->

## 非目标

- 不修改 Portal 后端业务语义。
- 不实现当前 Figma 文件没有覆盖的 Admin / Ops UI。
- 不读取 secret。
- 不调用真实腾讯云、COS、Langfuse、one-person-lab 或外部生产 API。
- 不修改 one-person-lab upstream。
- 不修改 deploy、`.sentrux` 或 `adapters`。
- 不执行真实线上部署、build/push、kubectl 或 live-test。
