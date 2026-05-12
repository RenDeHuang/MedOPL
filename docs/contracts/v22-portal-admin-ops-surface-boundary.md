# v22 Portal Admin / Ops Surface Boundary

这是 Portal 管理员/运维 role surface 合同，不实现新 UI。

本合同定义 MedOPL v22 同一个 Portal 应用里的管理员/运维页面边界。管理员/运维 surface 属于同一套登录、同一套 UI shell 下的 role-based surface，不是第二个产品，也不是普通用户工作台。

## 定位

管理员入口是同一个 Portal 应用里的 `/admin/*` role surface，只能 admin role 访问。普通用户导航和路由不能出现 admin 入口，普通用户不能看到 admin/ops 入口和全局数据。

管理员页面/API 独立分区。普通用户 surface 和管理员/运维 surface 严格分离。借鉴 Sub2API 的 role-based Web app 模式：同一个 Web 产品中按角色隔离页面、API、导航和操作权限，不复制外部代码。

角色真相由 `v22-portal-user-surface-boundary.md` 和 `v22-portal-admin-ops-surface-boundary.md` 共同定义。`v22-saas-portal-opl-ops-surface-boundary.md` 是更宽的 Portal、OPL 和管理台共享界面总述，不替代这两份 role surface 合同。

账号 / 工作空间 是 UI 主语言。租户 / 运行环境 不是 UI 主叙事；`tenantId`、`environmentId`、`resourceBindingId` 只能作为内部标签、对账标签或审计字段。

## 管理员/运维可见内容

管理员/运维可见：

- 账号列表和状态
- 工作空间列表和归属账号
- 工作台资源套餐、CPU、内存、文件空间、并发、队列
- 当前运行中的 session/run/task
- 文件空间用量和 7 天保护期占用
- 费用估算、冻结金额、T+1 对账状态
- 分账标签：resourceOrderId、runId、serverPlanId、tenantId、workspaceId、resourceBindingId、environmentId
- 审计事件、异常、释放失败、账单异常
- 公告管理入口

这些能力用于只读查看、归因、排障、审计和运营。当前 admin/ops surface 当前是 readonly MVP 边界。

## 管理员/运维也不能看到/不能操作

管理员/运维也不能看到或操作：

- SecretId / SecretKey / token / raw API Key / kubeconfig
- objectKey / storageKey / cosPrefix / storageBackend / signedUrl
- 未授权真实云创建/释放/修改
- 未授权真实扣费

真实腾讯云控制台式操作、真实资源创建/释放/修改、真实扣费路径不属于当前合同授权。

## 当前 MVP 与后续真实资源边界

当前 MVP 阶段：

- 不创建真实资源。
- 不真实扣费。
- 不调用真实腾讯云/COS/Langfuse/one-person-lab。
- 不读取 secret。
- 不改 deploy / .sentrux / adapters / upstream。
- 不改 Gateway / Runtime Bridge，除非后续合同明确授权。

后续真实资源接入必须另开 `feat/*` 和 authorized implementation 合同，并单独授权 secret、真实云 API、真实资源创建/释放、真实扣费路径、deploy 和 live-test。

## Cleanup / 防污染规则

repo-tracked contracts/docs/scripts/tests 是 truth。tmux session、agent 对话、本地状态、临时日志不进仓库。

并行写任务必须用独立 worktree。根工作区只用于规划、审查、吸收、push、清理。

one-person-lab 防污染边界继续生效：

- 不把 upstream 内部逻辑写进 Portal。
- 不 import upstream 内部模块。
- 不让历史 v19/v20/v21 路线不得重新成为 v22 主线。
- 旧入口、旧云控制台叙事、旧资源管理路线不得重新成为 v22 主线。

Cleanup 要清掉旧入口、旧文案、旧 API 暴露和权限绕过。清理动作必须有对应合同或 smoke 守住，不靠本地对话、tmux session 或临时日志作为真相。

## Contract Data

<!-- v22-portal-admin-ops-surface-contract:start -->
```json
{
  "contract": "v22_portal_admin_ops_surface_boundary",
  "version": 1,
  "samePortalApp": true,
  "sameLoginAndShell": true,
  "roleSurface": "admin_ops",
  "adminRoutePrefix": "/admin/*",
  "adminRoleOnly": true,
  "userNavigationShowsAdminEntry": false,
  "readonlyMvp": true,
  "visibleContent": [
    "账号列表和状态",
    "工作空间列表和归属账号",
    "工作台资源套餐",
    "CPU",
    "内存",
    "文件空间",
    "并发",
    "队列",
    "当前运行中的 session/run/task",
    "文件空间用量",
    "7 天保护期占用",
    "费用估算",
    "冻结金额",
    "T+1 对账状态",
    "分账标签",
    "审计事件",
    "异常",
    "释放失败",
    "账单异常",
    "公告管理入口"
  ],
  "costAllocationTags": [
    "resourceOrderId",
    "runId",
    "serverPlanId",
    "tenantId",
    "workspaceId",
    "resourceBindingId",
    "environmentId"
  ],
  "forbiddenVisibilityAndActions": [
    "SecretId",
    "SecretKey",
    "token",
    "raw API Key",
    "kubeconfig",
    "objectKey",
    "storageKey",
    "cosPrefix",
    "storageBackend",
    "signedUrl",
    "未授权真实云创建/释放/修改",
    "未授权真实扣费"
  ],
  "currentMvp": {
    "callsRealTencentCloud": false,
    "callsRealCos": false,
    "callsRealLangfuse": false,
    "callsRealOnePersonLab": false,
    "createsRealResources": false,
    "realBillingMutation": false
  },
  "futureAuthorizationRequired": [
    "feat/*",
    "authorized implementation 合同",
    "secret",
    "真实云 API",
    "真实资源创建/释放",
    "真实扣费路径"
  ],
  "forbiddenPaths": [
    "deploy",
    ".sentrux",
    "adapters",
    "upstream"
  ],
  "uiPrimaryLanguage": [
    "账号",
    "工作空间"
  ],
  "notUiPrimaryNarrative": [
    "租户",
    "运行环境"
  ],
  "cleanupAndPollutionGuard": {
    "repoTrackedTruth": [
      "contracts",
      "docs",
      "scripts",
      "tests"
    ],
    "localStateNotTruth": [
      "tmux session",
      "agent 对话",
      "本地状态",
      "临时日志"
    ],
    "parallelWriteTasksUseIndependentWorktree": true,
    "rootWorkspaceUse": [
      "规划",
      "审查",
      "吸收",
      "push",
      "清理"
    ],
    "doNotWriteUpstreamInternalLogicIntoPortal": true,
    "legacyRoutesMustNotBecomeV22Mainline": [
      "旧入口",
      "旧云控制台叙事",
      "旧资源管理路线",
      "历史 v19/v20/v21 路线"
    ]
  }
}
```
<!-- v22-portal-admin-ops-surface-contract:end -->

## Non-goals

- 不实现新 UI。
- 不改 Portal 代码。
- 不读取 secret。
- 不调用真实云。
- 不创建、绑定、释放或修改真实资源。
- 不真实扣费。
- 不改 deploy / .sentrux / adapters / upstream。
- 不运行 build/push/kubectl/live-test。
