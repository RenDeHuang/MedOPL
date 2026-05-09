# v22 Authorized Tencent Create/Release Execution Boundary

本合同收敛 v22 authorized Tencent create/release execution 的可实现、可测试、可上线边界。它承接 `v22-authorized-tencent-create-release-boundary.md`、`v22-authorized-tencent-create-release-implementation-boundary.md` 和 `v22-tencent-readonly-inventory-boundary.md`。

本分支只写合同和 smoke，不实现真实 create/release，不调用真实云，不读取 secret，不真实扣费。

## Execution Scope

authorized create/release execution 只在后续单独授权的 feat/* 分支实现。本合同只定义执行前必须满足的 gate、secret、标签、费用、回滚、审计和用户展示规则。

本合同不得恢复旧 `user_owned` / `resource-order` 主叙事。用户购买和管理的是工作台资源、计算资源和文件空间，不是云控制台对象。

## Readonly 与 Mutation 分离

readonly inventory 与 authorized create/release 必须分离：

- readonly 只允许 Describe/List/Get/Head。
- readonly 使用 `RUN_TENCENT_READONLY_INVENTORY`。
- readonly secret 只允许 readonly inventory allowlist。
- create/release 使用独立 RUN gate：`RUN_TENCENT_CREATE_RELEASE_EXECUTION`。
- create/release 使用独立 mutation secret allowlist。
- create/release 使用独立 runner/bridge。
- create/release 不得复用 `RUN_TENCENT_READONLY_INVENTORY`。
- create/release 不得复用 `TENCENT_READONLY_SECRET_ID`。
- create/release 不得复用 `TENCENT_READONLY_SECRET_KEY`。

明确禁止：不得复用 RUN_TENCENT_READONLY_INVENTORY、不得复用 TENCENT_READONLY_SECRET_ID、不得复用 TENCENT_READONLY_SECRET_KEY。

readonly inventory 通过只能作为后续 mutation 授权评估证据，不能自动创建、删除、释放、扩缩容、改标签或扣费。

## Mutation Secret Allowlist

后续真实 execution 只能 allowlist 读取 mutation 所需 key，不允许一读全读，不允许 source env，不允许把整份 secret 注入 `process.env`。

mutation secret allowlist 必须独立于 readonly secret allowlist：

- `RUN_TENCENT_CREATE_RELEASE_EXECUTION`
- `TENCENT_MUTATION_SECRET_ID`
- `TENCENT_MUTATION_SECRET_KEY`
- `TENCENT_MUTATION_ALLOWED_APIS`
- `TENCENT_MUTATION_REGIONS`
- `TENCENT_MUTATION_ACCOUNT_ID`
- `TENCENT_MUTATION_DAILY_BUDGET_CNY`
- `TENCENT_MUTATION_MAX_OPERATION_COUNT`

mutation secret 不得进入 Portal payload、前端状态、URL、日志、evidence、git、GitHub、one-person-lab upstream 或普通用户可见界面。

## 资源生命周期分离

工作空间、计算资源和文件空间生命周期必须分离：

- 工作空间是业务容器。
- 计算资源可独立开通/扩缩/释放。
- 文件空间可独立开通/扩容/删除。
- 释放计算资源不删除文件空间。
- 释放计算资源不触发 7 天保护期。
- 删除文件空间/存储资源才进入 7 天保护期。
- 计算资源已释放但文件空间仍保留，是合法状态。

文件空间属于工作空间，不属于单个 run。输出文件可以带 `runId`，但仍归属工作空间文件空间。

## 用户删除语义

用户发起删除时必须按资源类型解释：

- 删除计算资源：释放计算资源，停止相关新任务/运行，不删除文件空间。
- 删除文件空间：进入 7 天保护期，期满清理文件。
- 冻结金额用尽：停止计算资源和新任务；文件空间进入 7 天保护期或欠费保护流程。

Portal 不得把“删除计算资源”写成“删除文件空间”。Portal 不得把“冻结金额用尽”自动写成“立即清空文件”。

## 归属校验和标签

create 时必须生成并写入以下标签：

- `accountId`
- `workspaceId`
- `resourceBindingId`
- `resourceOrderId`
- `serverPlanId`
- `resourceType`
- `region`

如存在任务级成本归因，`runId` 可以作为附加标签；无 runId 成本仍必须能通过账号、工作空间、资源绑定、套餐和区域归属。

release 时必须同时匹配 Portal ledger 和云资源标签。不能只靠资源名称、创建时间、IP、规格或历史任务推断归属。

标签缺失、冲突、归属不一致时 fail-closed，进入 admin 审计队列。审计队列必须保留安全证据、候选 ledger、候选标签摘要、处理状态和重试策略，不得暴露 secret 或 provider raw response。

## 默认风控和 Portal 配置

以下默认值是风控上限，不是默认开通规格：

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

Portal 管理员可按账号/账号组修改 override。Portal 必须展示 effective limits，并记录审计记录：修改人、目标账号、目标账号组、修改前值、修改后值、生效时间、原因和审批状态。

默认日预算只提醒，不默认硬停；管理员可以对指定账号开启 hard cap。

## 费用保护和对账

真实 create 前必须计算预估冻结金额。冻结金额展示给用户，并进入 Portal ledger。

费用保护必须覆盖：

- create 前计算预估冻结金额。
- 冻结金额展示给用户。
- 余额低于 20 元提醒。
- 120 分钟扣费核对。
- T+1 COS 对账。
- T+1 腾讯云账单和 Portal ledger 对不上时进入 admin 审计队列。

普通用户中文状态包括：

- 待对账。
- 对账异常。
- 运维处理中。
- 已补扣。
- 已退还。

T+1 异常不得静默补扣或退款，必须进入审计流程后处理。

## 失败回滚

create 分阶段执行：

预校验 -> 创建资源 -> 打标签 -> 写 ledger -> 开通可用

如果创建资源后标签或 ledger 写入失败，必须进入回滚/冻结状态，禁止对用户显示为可用。

rollback 失败进入 admin 审计队列，并冻结继续开通。超过 `failedOperationRetryLimit: 2` 或 `maxCreateReleaseOperationsPerDay: 10` 后必须人工审计，不得无限重试。

release 分阶段执行：

预校验 -> 停止新任务 -> 校验 Portal ledger + 云标签 -> 释放计算资源或删除文件空间 -> 写 ledger -> 进入对账

释放计算资源失败进入“释放失败待审计”。删除文件空间失败进入“清理失败待审计”，不得承诺秒级物理删除。

## 用户可见状态和语言

普通用户可见中文状态包括：

- 开通中。
- 可用。
- 开通失败待处理。
- 释放中。
- 已释放。
- 文件保护期。
- 余额不足。
- 对账中。
- 对账异常。

普通用户不展示 CVM/TKE/COS/K8s/nodePool、云资源清单、服务器编号、Secret/token/objectKey 等底层词。普通用户主语言必须是账号、工作空间、计算资源、文件空间、套餐、任务并发、余额、冻结金额、保护期和审计状态。

管理员/运维可以看到必要后台归因标签、审计状态和异常摘要，但 secret、raw response、objectKey、storageKey、cosPrefix、signedUrl、kubeconfig 仍不可见。

## Non-Goals

- 不真实 create/delete/modify/release。
- 不读取 mutation secret。
- 不调用真实腾讯云。
- 不真实扣费。
- 不运行 build/push/kubectl/live-test。
- 不改 deploy/.sentrux/adapters/upstream/Gateway/Runtime Bridge。
- 不把 user_owned/resource-order 旧叙事恢复为主线。
- 不恢复旧云控制台叙事。
- 不把普通用户页面写成 CVM/COS/K8s/TKE 控制台。

## Contract Data

<!-- v22-authorized-tencent-create-release-execution-contract:start -->
```json
{
  "contract": "v22_authorized_tencent_create_release_execution_boundary",
  "version": 1,
  "implementsRealCloudCall": false,
  "currentBranchOnlyContractsAndSmoke": true,
  "readsMutationSecretNow": false,
  "callsRealTencentCloudNow": false,
  "executesRealCreateReleaseNow": false,
  "readonlyRunGate": "RUN_TENCENT_READONLY_INVENTORY",
  "mutationRunGate": "RUN_TENCENT_CREATE_RELEASE_EXECUTION",
  "readonlyAndMutationGatesSeparated": true,
  "readonlyAllowedApiVerbs": [
    "Describe",
    "List",
    "Get",
    "Head"
  ],
  "mutationSecretAllowlist": [
    "RUN_TENCENT_CREATE_RELEASE_EXECUTION",
    "TENCENT_MUTATION_SECRET_ID",
    "TENCENT_MUTATION_SECRET_KEY",
    "TENCENT_MUTATION_ALLOWED_APIS",
    "TENCENT_MUTATION_REGIONS",
    "TENCENT_MUTATION_ACCOUNT_ID",
    "TENCENT_MUTATION_DAILY_BUDGET_CNY",
    "TENCENT_MUTATION_MAX_OPERATION_COUNT"
  ],
  "forbiddenReuseOfReadonlySecrets": [
    "RUN_TENCENT_READONLY_INVENTORY",
    "TENCENT_READONLY_SECRET_ID",
    "TENCENT_READONLY_SECRET_KEY"
  ],
  "resourceLifecycle": {
    "workspaceIsBusinessContainer": true,
    "computeCanOpenScaleReleaseIndependently": true,
    "fileSpaceCanOpenExpandDeleteIndependently": true,
    "computeReleaseDeletesFileSpace": false,
    "computeReleaseTriggersRetention": false,
    "storageDeleteTriggersRetentionDays": 7,
    "computeReleasedWithFileSpaceRetainedIsValid": true
  },
  "ownership": {
    "createWritesTags": [
      "accountId",
      "workspaceId",
      "resourceBindingId",
      "resourceOrderId",
      "serverPlanId",
      "resourceType",
      "region"
    ],
    "portalLedgerAndCloudTagsRequiredForRelease": true,
    "failClosedOnMissingOrConflictingOwnership": true,
    "adminAuditQueueOnOwnershipFailure": true
  },
  "defaultRiskLimits": {
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
    "portalAccountOrAccountGroupOverrideAllowed": true,
    "effectiveLimitsVisible": true,
    "auditRecordRequired": true
  },
  "billingProtection": {
    "requiresEstimatedFreezeBeforeCreate": true,
    "freezeAmountUserVisible": true,
    "t120ChargeCheckRequired": true,
    "tPlusOneCosReconciliationRequired": true,
    "reconciliationExceptionUserStatuses": [
      "待对账",
      "对账异常",
      "运维处理中",
      "已补扣",
      "已退还"
    ]
  },
  "rollback": {
    "createPhases": [
      "预校验",
      "创建资源",
      "打标签",
      "写 ledger",
      "开通可用"
    ],
    "resourceCreatedButTagOrLedgerFailedMustNotBeUserAvailable": true,
    "rollbackFailureGoesToAdminAuditQueue": true,
    "freezeFurtherOpenOnRollbackFailure": true
  },
  "userVisibleStatuses": [
    "开通中",
    "可用",
    "开通失败待处理",
    "释放中",
    "已释放",
    "文件保护期",
    "余额不足",
    "对账中",
    "对账异常"
  ],
  "nonGoals": {
    "doesNotReadMutationSecret": true,
    "doesNotCallRealTencentCloud": true,
    "doesNotCreateDeleteModifyRelease": true,
    "doesNotModifyDeploySentruxAdaptersUpstreamGatewayRuntimeBridge": true,
    "doesNotRestoreLegacyUserOwnedResourceOrderNarrative": true
  }
}
```
<!-- v22-authorized-tencent-create-release-execution-contract:end -->
