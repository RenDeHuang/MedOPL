# v22 Admin / Ops Console Boundary

这是 admin/ops console 合同，不实现 UI。

本合同定义 MedOPL v22 管理员/运维界面与普通用户工作台的边界。普通用户资源页不得恢复云控制台或运维语义。管理员/运维视角可以查看后台归因和异常，也可以执行已接入的本地 Portal 管理动作，但不能执行真实云控制台式操作。

## 定位

Admin / Ops Console 面向平台运维人员，用于查看租户、账号、工作空间、托管运行环境、运行任务、文件空间、费用估算、分账标签、审计事件和异常状态。

它不是普通用户工作台，也不是真实腾讯云控制台。普通用户继续只看到工作台资源、套餐、文件空间、费用估算、释放策略和审计状态。

## 管理员/运维可见能力

管理员/运维可见：

- 租户列表、账号状态、开通/禁用状态
- workspace 列表和归属
- 托管运行环境列表
- 每个租户/环境的套餐、CPU、内存、文件空间、并发、队列
- 当前运行中的 session/run/task
- 文件空间用量、7 天保护期占用
- 资源状态：计划中、准备中、可用、释放中、已释放、异常
- 费用估算、冻结金额、T+1 对账状态
- 分账标签：resourceBindingId、cloudOperationId、billingAttributionId、workspaceId、accountId、serverPlanId、tenantId、environmentId、runId；旧 resource-order 标识不得作为 tag 或兼容归属 alias
- 审计事件、异常、释放失败、账单异常
- 公告管理入口

这些能力用于隔离、归因、排障、对账、审计和运营。当前已接入的本地 Portal 管理动作只覆盖用户查看、Portal 本地账户充值、Portal 本地账本退款、用户启用/禁用、用户软删除和公告管理；它们不是真实云资源变更，也不是真实支付或真实扣费通道，不能替代真实扣费链路。

## 普通用户不可见能力

普通用户界面不可见：

- CVM / COS / K8s / TKE / 节点池 / kubeconfig
- 真实云资源 ID
- objectKey / storageKey / cosPrefix / storageBackend / signedUrl
- SecretId / SecretKey / token / raw API Key
- 真实腾讯云控制台式操作
- 直接删除节点池、直接释放云资源、直接改真实资源

普通用户界面必须继续使用产品语言：工作台资源、套餐、文件空间、费用估算、释放策略、审计状态。
普通用户界面不得展示 tenantId、resourceBindingId、retired resource-order identifiers、serverPlanId、runId、CVM、COS、K8s、TKE、节点池或真实云资源 ID。

## 分账标签边界

Admin / Ops Console 可以查看分账标签归因和异常：

- resourceBindingId
- cloudOperationId
- billingAttributionId
- accountId
- runId
- serverPlanId
- tenantId
- workspaceId
- environmentId
- retired resource-order identifiers forbidden

这些标签只属于后台、运维、计费和审计边界。普通用户不能被要求理解或配置这些标签。

## 操作边界

- 不读取 secret。
- 不调用真实云。
- 不做真实扣费。
- 不创建、绑定或释放真实资源。
- 不修改 deploy / .sentrux / adapters / upstream。
- 不改 Gateway / Runtime Bridge，除非后续分支明确授权。
- 不恢复 CVM / COS / K8s / TKE / 节点池等普通用户语义。
- raw API Key 只能进入后端密钥边界，不能作为 Portal 普通登录字段。
- launchToken/runtimeToken 不进入 URL、localStorage 或 sessionStorage。
- one-person-lab upstream 保持 clean，不修改源码，不 import 内部模块。

真实腾讯云控制台式操作、直接删除节点池、直接释放云资源、直接改真实资源，不属于本合同授权范围。后续如需要真实资源运维能力，必须另开 feat/* 并单独授权 secret、云 API、deploy 和 live-test。

## Contract Data

<!-- v22-admin-ops-console-contract:start -->
```json
{
  "contract": "v22_admin_ops_console_boundary",
  "version": 1,
  "scope": {
    "implementsUi": false,
    "callsRealCloud": false,
    "readsSecret": false,
    "realBillingMutation": false,
    "realResourceMutation": false,
    "localPortalAdminActionsEnabled": true
  },
  "adminOpsVisibleCapabilities": [
    "租户列表",
    "账号状态",
    "开通/禁用状态",
    "workspace 列表和归属",
    "托管运行环境列表",
    "每个租户/环境的套餐",
    "CPU",
    "内存",
    "文件空间",
    "并发",
    "队列",
    "当前运行中的 session/run/task",
    "文件空间用量",
    "7 天保护期占用",
    "资源状态",
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
  "resourceStates": [
    "计划中",
    "准备中",
    "可用",
    "释放中",
    "已释放",
    "异常"
  ],
  "costAllocationTags": [
    "resourceBindingId",
    "cloudOperationId",
    "billingAttributionId",
    "accountId",
    "runId",
    "serverPlanId",
    "tenantId",
    "workspaceId",
    "environmentId",
    "retiredResourceOrderIdentifiersForbidden"
  ],
  "beginnerUserInvisibleCapabilities": [
    "CVM",
    "COS",
    "K8s",
    "TKE",
    "节点池",
    "kubeconfig",
    "真实云资源 ID",
    "objectKey",
    "storageKey",
    "cosPrefix",
    "storageBackend",
    "signedUrl",
    "SecretId",
    "SecretKey",
    "token",
    "raw API Key",
    "真实腾讯云控制台式操作",
    "直接删除节点池",
    "直接释放云资源",
    "直接改真实资源"
  ],
  "beginnerSurface": {
    "mustShowOnlyProductLanguage": [
      "工作台资源",
      "套餐",
      "文件空间",
      "费用估算",
      "释放策略",
      "审计状态"
    ],
    "mustNotShow": [
      "tenantId",
      "resourceBindingId",
      "retired resource-order identifiers",
      "serverPlanId",
      "runId",
      "CVM",
      "COS",
      "K8s",
      "TKE",
      "节点池",
      "真实云资源 ID"
    ]
  },
  "beginnerSurfaceMustRemainProductLanguage": true,
  "accountAndTokenBoundary": {
    "rawApiKeyBackendOnly": true,
    "apiKeyPortalLoginField": false,
    "launchTokenInUrlOrStorage": false,
    "runtimeTokenInUrlOrStorage": false
  },
  "upstreamBoundary": {
    "cleanUpstream": true,
    "modifySource": false,
    "importInternalModules": false
  },
  "adminOpsCanInspectAttribution": true,
  "localPortalAdminActions": [
    "查看用户详情",
    "Portal 本地账户充值",
    "Portal 本地账本退款",
    "启用用户",
    "禁用用户",
    "软删除用户",
    "新建公告",
    "编辑公告",
    "发布公告",
    "下线公告",
    "置顶公告",
    "删除公告"
  ],
  "readonlyOrDisabledProductStates": [
    "/admin/ops",
    "账单审批",
    "高风险站点设置",
    "待处理事项处理",
    "真实云资源操作",
    "真实扣费"
  ],
  "adminOpsCanExecuteRealCloudConsoleOperation": false,
  "forbiddenPaths": [
    "deploy",
    ".sentrux",
    "adapters",
    "one-person-lab upstream",
    "Gateway",
    "Runtime Bridge"
  ],
  "deferredAuthorization": [
    "真实腾讯云 API",
    "真实 SecretId/SecretKey",
    "真实资源创建/释放",
    "真实扣费",
    "deploy",
    "build/push",
    "kubectl",
    "live-test",
    "Gateway / Runtime Bridge 改动"
  ]
}
```
<!-- v22-admin-ops-console-contract:end -->

## Non-goals

- 不实现 UI。
- 不写业务代码。
- 不读取 secret。
- 不调用真实云。
- 不做真实扣费。
- 不创建、绑定或释放真实资源。
- 不修改 deploy / .sentrux / adapters / upstream。
- 不改 Gateway / Runtime Bridge，除非合同明确后续授权。
