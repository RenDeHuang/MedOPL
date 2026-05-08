# v22 Authorized Tencent Create/Release Implementation Boundary

本合同定义 v22 真实腾讯云 create/release implementation 的后续授权边界。当前分支只写合同和 smoke，不实现真实云调用。

本合同承接 `v22-authorized-tencent-create-release-boundary.md`：前者定义 authorized create/release 的产品和授权边界；本文补齐真实 implementation 前必须明确的授权、风控、失败回滚、审计、费用保护、清理策略和 Portal 可配置规则。

## 当前分支边界

- 不读取 secret。
- 不调用真实腾讯云 / COS / Langfuse / one-person-lab。
- 不创建、释放真实资源。
- 不真实扣费。
- 不运行 build/push/kubectl/live-test。
- 不修改 deploy / .sentrux / adapters / upstream / Gateway / Runtime Bridge。

后续真实实现必须另开 feat/*，并单独授权 secret 边界、真实云 API、测试账号、区域、资源类型、费用上限和清理策略。

## 资源生命周期分离

工作空间、计算资源、存储资源必须分离：

- 工作空间是业务容器。
- 计算资源可独立开通、扩容、缩容、释放。
- 存储资源 / 文件空间可独立开通、扩容、删除。
- 释放计算资源不删除文件空间。
- 释放计算资源不让文件空间进入 7 天保护期。
- 删除存储资源 / 文件空间，或独立欠费保留策略，才进入 7 天保护期。
- 计算资源已释放但存储资源仍保留，是合法状态。
- 计算资源已释放但文件空间仍保留，是合法状态。
- 存储资源进入保护期或不可用时，新任务不能依赖该文件空间。

释放计算资源只能停止计算计费和任务续用。不得把“释放计算资源”自动写成“删除文件空间”。存储资源是否进入保护期，必须由独立存储删除 / 欠费保留策略触发。

## 默认风控上限

以下值是默认风控上限，不是默认开通规格：

- maxCpuCoresPerWorkspace: 16
- maxMemoryGbPerWorkspace: 32
- maxFileSpaceGbPerWorkspace: 500
- maxConcurrentTasksPerWorkspace: 5
- maxQueuedTasksPerWorkspace: 20
- balanceWarningThresholdCny: 20
- dailySpendAlertCny: 300
- dailyHardCapCny: null
- failedOperationRetryLimit: 2
- maxCreateReleaseOperationsPerDay: 10

这些值必须是 Portal 管理员可按账号修改的策略，不是产品永久上限。后续可支持账号组默认值 + 单账号 override + effective limits 展示。

管理员修改风控策略时必须记录：

- 修改人账号。
- 目标账号。
- 修改前策略。
- 修改后策略。
- 生效时间。
- 修改原因。

普通用户主语言优先使用：账号、工作空间、计算资源、文件空间、套餐、任务并发、余额、冻结金额。租户 / runtime / 运行环境 / environmentId 只能作为内部标签、对账标签或审计字段。

普通用户只能看到业务化结果，例如“可用额度”“任务并发”“排队上限”“余额提醒”，不能看到云控制台对象或 provider 内部字段。

## 套餐口径

套餐和自定义规格必须使用产品语言：

- 基础套餐：2c / 4GB / 10GB 文件空间。
- Pro 套餐：8c / 16GB / 100GB 文件空间。
- 自定义：CPU、内存、文件空间、任务并发数。

5 个必须写成任务并发，不是 session 并发。session 只是运行、观测或访问上下文，不等同于可同时执行的任务数。

## 费用和冻结

真实开通前必须完成费用保护：

- 开通时需要扣费 / 预扣 + 冻结金额。
- Portal 普通用户展示中文状态：已冻结金额、预计可用时长、120 分钟扣费核对、隔日账单审计。
- 日预算默认只提醒，不默认硬停。
- 管理员可以给某个账号打开硬停。
- 余额低于 20 元提醒。
- 冻结金额不足时：停止新任务和计算资源续用。
- 存储资源是否进入 7 天保护期，必须由独立存储删除 / 欠费保留策略触发。

冻结和解冻规则：

- 询价失败前不得冻结。
- 冻结失败不得创建资源。
- 计算创建失败后，未消费部分必须进入解冻或待审计。
- 释放计算资源成功后，停止计算续费；已产生账单等待 120 分钟扣费核对和隔日账单审计。
- T+1 异常不得直接静默补扣或退款，必须进入管理员审计队列。

## T+1 对账异常

T+1 腾讯云 / COS 账单和 Portal ledger 对不上时，进入管理员审计队列。

普通用户看到中文状态：

- 账单核对中。
- 账单异常待处理。
- 已校准。
- 待补扣。
- 待退还。

管理员审计队列必须区分：

- 标签缺失。
- 标签不一致。
- 资源孤儿。
- 金额偏差。
- 账单迟到。
- 账单缺失。

不得直接暴露底层云账单字段、bucket、object key、SecretId、SecretKey、kubeconfig。管理员/运维也只能看到业务摘要、分账标签、审计证据和处理状态；secret 和 provider 内部对象仍不得进入 Portal payload。

## 失败回滚状态机

真实 create/release implementation 必须定义补偿状态机：

- 待执行。
- 执行中。
- 待回滚。
- 回滚中。
- 已回滚。
- 待审计 / 可重试。
- 回滚失败待审计。
- 释放失败待审计。
- 清理失败待审计。

失败分支必须满足：

- 询价失败：不冻结、不创建资源。
- 冻结失败：不创建资源。
- 计算创建失败：释放已创建的计算子资源，记录失败证据。
- 存储创建失败：计算资源是否保留必须按用户计划和审计策略处理，不得隐式删除用户已有文件空间。
- 绑定失败：资源进入待审计 / 可重试状态，不能假装可用。
- 释放失败：进入释放失败待审计，保留重试队列和证据。
- 删除存储失败：进入清理失败待审计，不承诺秒级物理删除。

回滚动作必须明确可重试次数，并受 failedOperationRetryLimit: 2 和 maxCreateReleaseOperationsPerDay: 10 约束。超过限制后必须进入人工审计，不得无限重试。

## Portal Role Surface 边界

借鉴 Sub2API 的 role-based Web app 思路：同一 Portal，同一登录，同一 UI shell，普通用户和管理员 surface 按角色分离。

不复制 Sub2API 代码、路由、鉴权或存储结构。

普通用户 surface 只展示自己的工作空间、套餐、文件空间、任务并发、余额、冻结金额、费用估算和中文状态。

管理员 / 运维 surface 可以展示全局账号、工作空间、分账标签、审计队列、异常队列和策略 override，但仍不得展示 SecretId、SecretKey、token、kubeconfig、objectKey、storageKey、cosPrefix、storageBackend、signedUrl。

## 防污染和 truth 边界

借鉴 one-person-lab 的 worktree / repo-tracked truth / 防污染纪律：

- truth 进入 docs/contracts/scripts/tests。
- tmux/session/agent 对话/本地 runtime state 不进仓库。
- 不把 upstream 内部逻辑写进 Portal。
- 不 import upstream 内部模块。
- 不让 v19/v20/v21 旧路线、user_owned、resource-order、旧云控制台叙事重新成为 v22 主线。

## Contract Data

<!-- v22-authorized-tencent-create-release-implementation-contract:start -->
```json
{
  "contract": "v22_authorized_tencent_create_release_implementation_boundary",
  "version": 1,
  "implementsRealCloudCall": false,
  "currentBranchOnlyContractsAndSmoke": true,
  "resourceLifecycle": {
    "workspaceLifecycleSeparatedFromCompute": true,
    "workspaceLifecycleSeparatedFromStorage": true,
    "computeResourceIndependentlyManaged": true,
    "storageResourceIndependentlyManaged": true,
    "computeReleaseDeletesFileSpace": false,
    "storageDeleteTriggersRetentionDays": 7,
    "computeReleasedWithStorageRetainedIsValid": true,
    "tasksRequireAvailableFileSpace": true
  },
  "defaultRiskLimits": {
    "defaultLimitsAreRiskCapsNotDefaultProvisioningSpec": true,
    "maxCpuCoresPerWorkspace": 16,
    "maxMemoryGbPerWorkspace": 32,
    "maxFileSpaceGbPerWorkspace": 500,
    "maxConcurrentTasksPerWorkspace": 5,
    "maxQueuedTasksPerWorkspace": 20,
    "balanceWarningThresholdCny": 20,
    "dailySpendAlertCny": 300,
    "dailyHardCapCny": null,
    "failedOperationRetryLimit": 2,
    "maxCreateReleaseOperationsPerDay": 10,
    "adminAccountOverrideAllowed": true,
    "accountGroupDefaults": true,
    "effectiveLimitsVisible": true
  },
  "packages": {
    "starter": "2c / 4GB / 10GB 文件空间",
    "pro": "8c / 16GB / 100GB 文件空间",
    "customSupports": [
      "CPU",
      "内存",
      "文件空间",
      "任务并发数"
    ],
    "fiveMeansTaskConcurrencyNotSessionConcurrency": true
  },
  "billingProtection": {
    "requiresPrechargeOrFreezeBeforeCreate": true,
    "userVisibleStatuses": [
      "已冻结金额",
      "预计可用时长",
      "120 分钟扣费核对",
      "隔日账单审计"
    ],
    "dailyBudgetWarnsByDefault": true,
    "dailyHardStopDefault": false,
    "adminCanEnableDailyHardStopPerAccount": true,
    "balanceWarningThresholdCny": 20,
    "insufficientFreezeStopsNewTasksAndComputeContinuation": true,
    "insufficientFreezeDoesNotDeleteFileSpace": true
  },
  "tPlusOneReconciliation": {
    "adminAuditQueue": true,
    "userVisibleStatuses": [
      "账单核对中",
      "账单异常待处理",
      "已校准",
      "待补扣",
      "待退还"
    ],
    "exceptionTypes": [
      "标签缺失",
      "标签不一致",
      "资源孤儿",
      "金额偏差",
      "账单迟到",
      "账单缺失"
    ]
  },
  "failureRollback": {
    "quoteFailure": "不冻结、不创建资源",
    "freezeFailure": "不创建资源",
    "computeCreateFailure": "释放已创建的计算子资源，记录失败证据",
    "storageCreateFailure": "按用户计划和审计策略决定是否保留计算资源，不隐式删除用户已有文件空间",
    "bindingFailure": "资源进入待审计 / 可重试状态，不能假装可用",
    "releaseFailure": "进入释放失败待审计，保留重试队列和证据",
    "storageDeleteFailure": "进入清理失败待审计，不承诺秒级物理删除"
  },
  "authorizationBoundary": {
    "readsSecret": false,
    "callsRealTencentCloud": false,
    "callsRealCos": false,
    "callsRealLangfuse": false,
    "callsRealOnePersonLab": false,
    "createsOrReleasesRealResources": false,
    "appliesRealBilling": false,
    "runsBuildPushKubectlLiveTest": false,
    "modifiesDeploySentruxAdaptersUpstreamGatewayRuntimeBridge": false,
    "futureImplementationRequiresSeparateFeatAndAuthorization": true
  },
  "borrowedBoundaries": {
    "sub2apiRoleBasedPatternOnly": true,
    "doNotCopySub2apiCodeRoutesAuthOrStorage": true,
    "onePersonLabWorktreeRepoTruthDiscipline": true,
    "repoTrackedTruth": [
      "docs/contracts",
      "scripts",
      "tests"
    ],
    "localRuntimeStateNotTruth": true
  }
}
```
<!-- v22-authorized-tencent-create-release-implementation-contract:end -->

## Non-goals

- 不实现真实腾讯云 SDK 调用。
- 不实现 Portal UI。
- 不实现 Gateway 或 Runtime Bridge 接线。
- 不读取 secret。
- 不创建、绑定、释放真实资源。
- 不真实扣费。
- 不运行 build/push/kubectl/live-test。
- 不修改 deploy / .sentrux / adapters / upstream / Gateway / Runtime Bridge。
