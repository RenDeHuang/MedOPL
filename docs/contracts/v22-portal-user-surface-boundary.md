# v22 Portal User Surface Boundary

这是 Portal 普通用户 role surface 合同，不实现新 UI。

本合同定义 MedOPL v22 Portal 普通用户页面边界。它不推翻既有 Portal UI MVP，也不是重新冻结 UI；`docs/recovery/mvp-contract-acceptance.md` 仍只是阶段快照，是否修改 UI 由当前分支意图和订阅合同决定。

## 定位

MedOPL 是同一个 Portal 应用、同一套登录、同一套 UI shell。普通用户 surface 和管理员/运维 surface 严格分离，管理员页面/API 独立分区。普通用户不能看到 admin/ops 入口、全局数据或管理操作。
普通用户不能看到全局数据。

本合同只整理普通用户 role-based surface 边界，不复制外部代码。借鉴 Sub2API 的 role-based Web app 模式：同一个 Web 产品内按角色拆分 surface，而不是拆成两个产品。

角色真相由 `v22-portal-user-surface-boundary.md` 和 `v22-portal-admin-ops-surface-boundary.md` 共同定义。`v22-saas-portal-opl-ops-surface-boundary.md` 是更宽的 Portal、OPL 和管理台共享界面总述，不替代这两份 role surface 合同。

## 普通用户入口

普通用户入口包括：

- Portal 总览
- 工作空间
- 工作台资源/套餐
- 文件空间
- 运行轨迹
- 账单/余额/充值
- 进入 OPL 工作台

这些入口只面向用户自己的科研工作台闭环，不提供管理员/运维入口。

## 普通用户可见内容

普通用户可见：

- 自己的账号状态
- 自己的工作空间
- 自己的套餐、CPU/内存/文件空间、并发/队列
- 自己的任务、输出文件、运行轨迹
- 自己的费用估算、余额、充值状态
- gflabtoken 模型调用密钥已绑定/未绑定状态，但 Portal 不提供 raw API Key 输入

账号 / 工作空间 是 UI 主语言。租户 / 运行环境 不是 UI 主叙事；`tenantId`、`environmentId`、`resourceBindingId` 只能作为内部标签、对账标签或审计字段。

## 普通用户不可见内容

普通用户不可见：

- 管理员/运维入口
- 全局账号列表
- 其他账号/其他工作空间
- 全局运行任务
- 全局费用、冻结、T+1 对账
- 审计异常、释放失败、账单异常总览
- 公告管理
- CVM / COS / K8s / TKE / 节点池 / 服务器编号 / 云资源清单
- tenantId / resourceBindingId / cloudOperationId / billingAttributionId / accountId / retired resource-order identifiers / serverPlanId / runId 等后台归因标签
- SecretId / SecretKey / token / raw API Key / kubeconfig / objectKey / storageKey / cosPrefix / storageBackend / signedUrl

Portal 普通用户不能有运维视角，也不能通过旧入口、旧 API 暴露或权限绕过看到 admin/ops 数据。

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

<!-- v22-portal-user-surface-contract:start -->
```json
{
  "contract": "v22_portal_user_surface_boundary",
  "version": 1,
  "samePortalApp": true,
  "sameLoginAndShell": true,
  "roleSurface": "user",
  "implementsUi": false,
  "portalProvidesRawApiKeyInput": false,
  "entryPoints": [
    "Portal 总览",
    "工作空间",
    "工作台资源/套餐",
    "文件空间",
    "运行轨迹",
    "账单/余额/充值",
    "进入 OPL 工作台"
  ],
  "visibleContent": [
    "自己的账号状态",
    "自己的工作空间",
    "自己的套餐",
    "CPU/内存/文件空间",
    "并发/队列",
    "自己的任务",
    "输出文件",
    "运行轨迹",
    "费用估算",
    "余额",
    "充值状态",
    "gflabtoken 模型调用密钥已绑定/未绑定状态"
  ],
  "invisibleContent": [
    "管理员/运维入口",
    "全局账号列表",
    "其他账号/其他工作空间",
    "全局运行任务",
    "全局费用、冻结、T+1 对账",
    "审计异常、释放失败、账单异常总览",
    "公告管理",
    "CVM",
    "COS",
    "K8s",
    "TKE",
    "节点池",
    "服务器编号",
    "云资源清单",
    "tenantId",
    "resourceBindingId",
    "cloudOperationId",
    "billingAttributionId",
    "accountId",
    "retired resource-order identifiers",
    "serverPlanId",
    "runId",
    "SecretId",
    "SecretKey",
    "token",
    "raw API Key",
    "kubeconfig",
    "objectKey",
    "storageKey",
    "cosPrefix",
    "storageBackend",
    "signedUrl"
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
<!-- v22-portal-user-surface-contract:end -->

## Non-goals

- 不实现新 UI。
- 不改 Portal 代码。
- 不读取 secret。
- 不调用真实云。
- 不改 deploy / .sentrux / adapters / upstream。
- 不运行 build/push/kubectl/live-test。
