# v22 SaaS Portal OPL Ops Surface Boundary Contract

本合同固定 MedOPL v22 的 Portal、OPL Web、Ops Surface 共享产品表面、用户角色、多租户后台边界和腾讯云分账标签边界。

本轮只落共享界面合同和 smoke，不写业务代码，不做 UI。

## Product Positioning

MedOPL 是面向 AI 小白科研用户的 OPL SaaS 科研托管平台。

它不是云资源控制台。

它包含：

- Portal SaaS 后台 / 科研托管平台控制台
- OPL Web 科研工作台
- Ops Surface 运维面
- 平台代开通计算和存储
- 账单 / 余额 / 审计 / 运维
- one-person-lab clean upstream

用户开通的是托管运行环境和文件空间；腾讯云资源池、资源标签和内部绑定只属于后台实现、计费、审计和运维边界。

## Personas

MVP 只定义两类使用人群：

- AI 小白科研用户
- 平台运维人员

不要把“租户/课题组管理员”作为 MVP 独立角色。多租户是后台边界，不是当前 MVP 用户角色。

## Beginner User Portal Surface

AI 小白科研用户在 Portal 必须能看到：

- 余额
- 钱花在哪里
- session 数
- task 数
- 科研任务进度
- 托管运行环境状态
- 文件空间状态
- input 文件
- output 文件
- workspace 文件夹
- 运行轨迹
- 账单摘要
- 停止计费 / 审计状态
- 进入 OPL 工作台的入口

Portal 面向 AI 小白科研用户时不得把腾讯云资源池、CVM、COS bucket、K8s、TKE 或原始分账标签作为主语言。

## Beginner User OPL Web Surface

AI 小白科研用户在 OPL Web 必须能做：

- 使用统一 MedOPL 账号登录
- 在 `opl.medopl.cn` entry / preflight 的账号密码输入区下面输入 / 绑定 gflabtoken API key
- 发消息
- 上传文件
- 用文件跑任务
- 下载输出文件

OPL Web 入口通过 MedOPL Gateway / SSO / Auth Bridge 完成统一身份。gflabtoken API key 不是 Portal 普通登录字段，raw API key 只进入后端密钥边界。

## Ops Surface

平台运维在 Portal / Ops Surface 必须能看到：

- tenant 状态
- workspace 状态
- resourceOrder / resourceBinding 状态
- serverPlan 状态
- run 状态
- COS bucket / prefix / object 状态
- 分账标签状态
- 任务失败
- 账单日内核对状态
- 120min 停止计费确认状态
- T+1 审计状态
- 异常账单 / 异常资源

Ops Surface 可以展示后台标识、腾讯云标签映射和异常归因；这些不进入 AI 小白科研用户主叙事。

## Backend Multi-Tenant Boundary

后台必须保持：

- `tenantId`
- `userId`
- `workspaceId`
- `resourceBindingId / resourceOrderId`
- `billingAccountId`
- `runId`
- `serverPlanId`

这些字段用于隔离、计费、审计、运维，不作为 AI 小白用户主语言。

## Tencent Cost Allocation Tags

当前腾讯云分账标签固定为：

- `resourceorderid`
- `runid`
- `serverplanid`
- `tenantid`
- `workspaceid`

这些标签用于腾讯云账单核对、COS 存储桶列表、成本归因和审计。普通用户不直接操作这些标签；运维可以在 Ops Surface 查看标签映射和异常。

## Tencent Cloud Resource Boundary

腾讯云是后台资源池，不是用户主界面。

用户开通的是：

- 托管运行环境
- 文件空间

后台代开通：

- CVM
- COS / 文件空间
- runtime

普通用户不能被引导去配置 CVM / COS / K8s / TKE。

## Account And API Key Boundary

MedOPL 账号密码与 OPL Web 账号密码统一。用户从 `opl.medopl.cn` 进入时，通过 MedOPL Gateway / SSO / Auth Bridge 完成统一身份。

gflabtoken API key 放在 `opl.medopl.cn` entry / preflight 的账号密码输入区下面。API key 不是 Portal 普通登录字段。raw API key 只进入后端密钥边界；前端只展示 `providerKeyRef` / bound status。

## Upstream Boundary

one-person-lab 是 clean upstream：

- 不得修改 upstream 源码。
- 不得 import upstream 内部模块。
- OPL entry / preflight 属于 MedOPL Gateway / SSO / Auth Bridge。

## Forbidden Beginner User Narrative

普通用户界面不得把以下作为主语言：

- CVM
- COS bucket
- K8s
- TKE
- resourceOrderId
- raw billing tags
- raw provider API key
- `launchToken`
- `runtimeToken`
- 内部存储密钥
- one-person-lab upstream 内部模块

## Product Effect

AI 小白用户进入 Portal 后能回答：

- 我还有多少钱？
- 我的钱花在哪里？
- 我有几个 session？
- 我有几个 task？
- 我的科研任务跑到哪一步？
- 我的托管运行环境是否可用？
- 我的文件空间是什么状态？
- 我的 input/output 文件在哪里？
- 我从哪里进入 OPL 工作台？
- 我的 API key 是否已绑定？
- 我释放环境后是否停止扣费？
- 账单核对和审计是否完成？

平台运维进入 Ops Surface 后能回答：

- 哪个 tenant / workspace / run / serverPlan / resourceOrder 产生了费用？
- 腾讯云账单标签是否完整？
- COS 对象是否有正确 tenantid / workspaceid / runid / serverplanid / resourceorderid 归因？
- 哪些任务失败？
- 哪些停止计费还在 120min 确认中？
- 哪些审计是 T+1 pending 或 ready？
- 哪些资源或账单异常？

## Contract Data

<!-- v22-saas-portal-opl-ops-surface-contract:start -->
```json
{
  "contract": "v22_saas_portal_opl_ops_surface_boundary",
  "version": 1,
  "productPositioning": {
    "statement": "MedOPL 是面向 AI 小白科研用户的 OPL SaaS 科研托管平台。",
    "notCloudConsole": true,
    "includes": [
      "Portal SaaS 后台 / 科研托管平台控制台",
      "OPL Web 科研工作台",
      "Ops Surface 运维面",
      "平台代开通计算和存储",
      "账单 / 余额 / 审计 / 运维",
      "one-person-lab clean upstream"
    ]
  },
  "personas": {
    "mvpRoles": [
      "AI 小白科研用户",
      "平台运维人员"
    ],
    "tenantAdminIndependentRole": false,
    "multiTenantIsBackendBoundary": true
  },
  "portalBeginnerSurface": {
    "mustShow": [
      "余额",
      "钱花在哪里",
      "session 数",
      "task 数",
      "科研任务进度",
      "托管运行环境状态",
      "文件空间状态",
      "input 文件",
      "output 文件",
      "workspace 文件夹",
      "运行轨迹",
      "账单摘要",
      "停止计费 / 审计状态",
      "进入 OPL 工作台的入口"
    ],
    "cloudConsoleShown": false
  },
  "oplWebBeginnerSurface": {
    "entrypoint": "opl.medopl.cn",
    "mustDo": [
      "使用统一 MedOPL 账号登录",
      "在 opl.medopl.cn entry / preflight 的账号密码输入区下面输入 / 绑定 gflabtoken API key",
      "发消息",
      "上传文件",
      "用文件跑任务",
      "下载输出文件"
    ]
  },
  "opsSurface": {
    "mustShow": [
      "tenant 状态",
      "workspace 状态",
      "resourceOrder / resourceBinding 状态",
      "serverPlan 状态",
      "run 状态",
      "COS bucket / prefix / object 状态",
      "分账标签状态",
      "任务失败",
      "账单日内核对状态",
      "120min 停止计费确认状态",
      "T+1 审计状态",
      "异常账单 / 异常资源"
    ]
  },
  "backendMultiTenantBoundary": {
    "fields": [
      "tenantId",
      "userId",
      "workspaceId",
      "resourceBindingId",
      "resourceOrderId",
      "billingAccountId",
      "runId",
      "serverPlanId"
    ],
    "usedFor": [
      "隔离",
      "计费",
      "审计",
      "运维"
    ],
    "beginnerUserPrimaryLanguage": false
  },
  "tencentCostAllocationTags": {
    "fixedKeys": [
      "resourceorderid",
      "runid",
      "serverplanid",
      "tenantid",
      "workspaceid"
    ],
    "usedFor": [
      "腾讯云账单核对",
      "COS 存储桶列表",
      "成本归因",
      "审计"
    ],
    "beginnerUserDirectOperation": false,
    "opsCanInspectMappingAndAnomalies": true
  },
  "cloudResourceBoundary": {
    "tencentCloudIsBackendPool": true,
    "userBuys": [
      "托管运行环境",
      "文件空间"
    ],
    "backendProvisioning": [
      "CVM",
      "COS / 文件空间",
      "runtime"
    ],
    "forbiddenBeginnerConfiguration": [
      "CVM",
      "COS",
      "K8s",
      "TKE"
    ]
  },
  "accountAndApiKeyBoundary": {
    "medoplAccountUnifiedWithOplWeb": true,
    "identityPath": "MedOPL Gateway / SSO / Auth Bridge",
    "gflabtokenInputLocation": "opl.medopl.cn entry / preflight 的账号密码输入区下面",
    "apiKeyIsPortalLoginField": false,
    "rawApiKeyBackendOnly": true,
    "frontendPublicFields": [
      "providerKeyRef",
      "bound status"
    ]
  },
  "upstreamBoundary": {
    "repository": "https://github.com/gaofeng21cn/one-person-lab",
    "cleanUpstream": true,
    "modifySource": false,
    "importInternalModules": false,
    "entryPreflightOwnedBy": "MedOPL Gateway / SSO / Auth Bridge"
  },
  "forbiddenBeginnerUserNarrative": [
    "CVM",
    "COS bucket",
    "K8s",
    "TKE",
    "resourceOrderId",
    "raw billing tags",
    "raw provider API key",
    "launchToken",
    "runtimeToken",
    "内部存储密钥",
    "one-person-lab upstream 内部模块"
  ],
  "productEffectQuestions": {
    "beginnerUserCanAnswer": [
      "我还有多少钱？",
      "我的钱花在哪里？",
      "我有几个 session？",
      "我有几个 task？",
      "我的科研任务跑到哪一步？",
      "我的托管运行环境是否可用？",
      "我的文件空间是什么状态？",
      "我的 input/output 文件在哪里？",
      "我从哪里进入 OPL 工作台？",
      "我的 API key 是否已绑定？",
      "我释放环境后是否停止扣费？",
      "账单核对和审计是否完成？"
    ],
    "opsCanAnswer": [
      "哪个 tenant / workspace / run / serverPlan / resourceOrder 产生了费用？",
      "腾讯云账单标签是否完整？",
      "COS 对象是否有正确 tenantid / workspaceid / runid / serverplanid / resourceorderid 归因？",
      "哪些任务失败？",
      "哪些停止计费还在 120min 确认中？",
      "哪些审计是 T+1 pending 或 ready？",
      "哪些资源或账单异常？"
    ]
  },
  "nonGoals": [
    "不写业务代码",
    "不做 UI",
    "不读取 /home/dev/.secrets/medopl/secrets.env.txt",
    "不调用真实云 API",
    "不运行 build/push/kubectl/live-test"
  ]
}
```
<!-- v22-saas-portal-opl-ops-surface-contract:end -->

## Non-goals

- 不写业务代码。
- 不做 UI。
- 不改 frontend、Gateway、Runtime Bridge、deploy、`.sentrux`、adapters 或 one-person-lab upstream。
- 不读取 `/home/dev/.secrets/medopl/secrets.env.txt`。
- 不调用真实云 API。
- 不运行 build/push/kubectl/live-test。
