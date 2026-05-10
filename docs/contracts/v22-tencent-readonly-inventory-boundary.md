# v22 Tencent Readonly Inventory Boundary

本合同定义 v22 `readonly/tencent inventory` 边界。默认未授权路径不读取 secret、不调用真实腾讯云 / COS / TKE / CVM / 账单 API。本分支范围是 Tencent official SDK readonly 连接：允许把 SDK dependency diff、loader/provider/client 和 readonly smoke 落成可审分支；真实 readonly live 仍只能在用户明确授权下执行，证据只进入 `.runtime` 脱敏 report。

该合同属于 Tencent Provider 合同包，阶段位置是：

`mock/snapshot -> readonly/tencent quote -> dry-run/tencent plan -> readonly/tencent inventory -> authorized/tencent create/release`

## 阶段边界

readonly inventory 只做真实云只读盘点，用来验证云上事实和 Portal 账本是否一致。

它不代表后续不能创建、删除、释放、扩缩容、改标签。创建、删除、释放、扩缩容、改标签属于后续 authorized create/release 阶段，必须另开 feat/* 并单独授权。

readonly inventory 通过后，只能说明后续 create/release 可以进入授权评估；它不能自动执行真实云 mutation，不能自动读取 mutation secret，不能自动释放资源，不能真实扣费。

## Purpose

readonly inventory 要验证：

- 云上有哪些 MedOPL 资源。
- 资源标签是否完整。
- 资源是否能映射到账号、工作空间、resourceOrderId、resourceBindingId。
- 是否存在孤儿资源、标签缺失、标签冲突、区域不一致。
- 是否支持后续 T+1 对账和 create/release 安全执行。

inventory 结果只能进入管理员 / 运维审计和后续授权评估，不得成为普通用户云控制台视图。

## Secret 文件模型

允许未来使用 git 外 readonly inventory allowlist secret 文件：

```text
<git-outside-readonly-inventory-secret-file>
```

但 secret 读取必须是 allowlist_only，不允许“一读全读”。readonly inventory 阶段只允许读取以下 key：

- RUN_TENCENT_READONLY_INVENTORY
- TENCENT_READONLY_SECRET_ID
- TENCENT_READONLY_SECRET_KEY
- TENCENT_READONLY_REGIONS
- TENCENT_READONLY_ALLOWED_APIS
- TENCENT_READONLY_ACCOUNT_ID 或等价只读账号标识

明确禁止读取或使用：

- TENCENT_MUTATION_SECRET_ID
- TENCENT_MUTATION_SECRET_KEY
- RUN_TENCENT_CREATE_RELEASE
- LANGFUSE_SECRET_KEY
- GITHUB_TOKEN
- DATABASE_URL
- SSH_PRIVATE_KEY
- kubeconfig
- raw API Key
- 任何非 readonly inventory allowlist 的 key

当前分支的默认 smoke 不读取真实 secret 文件，不验证真实 secret 文件是否存在，不打印 secret 路径内容。任何真实 readonly live 必须单独授权，并且只允许读取 readonly allowlist key。

## API allowlist

readonly inventory 后续授权阶段只允许 Describe / List / Get / Head 类 API，例如：

- 账号身份摘要，只输出脱敏账号标识。
- CVM 实例列表、状态、标签。
- TKE 集群 / namespace / node pool 只读摘要和标签。
- COS bucket 列表、bucket 标签、prefix 用量摘要。
- COS object metadata / HEAD，用于验证文件存在和归属，不读取对象正文。
- Tencent tag resources 只读查询。
- 账单 / 费用只读摘要，如后续单独授权。

禁止 API：

- Create*
- Delete*
- Modify*
- Run*
- Terminate*
- Attach*
- Detach*
- PutBucket*
- PutObject*
- DeleteObject*
- Update*
- Tag mutation
- 权限、策略、bucket policy 修改

readonly inventory 不允许使用任何可能创建、删除、释放、扩缩容、改标签、改权限或改变 bucket policy 的 API。API allowlist 必须显式配置；缺少 allowlist 时 fail-closed。

## COS 对账边界

readonly inventory 不读取 COS 对象正文，不下载用户文件，不打印用户文件内容。

允许读取 bucket / prefix / object metadata、用量摘要、账单明细和资源标签，用于归属校验、文件存在性校验和 T+1 对账。

objectKey、storageKey、cosPrefix、signedUrl 不得进入普通用户 payload、日志或 evidence。管理员 / 运维输出也只能看到脱敏摘要、计数、状态和审计队列项，不能看到可直接定位或下载用户文件的内部存储字段。

## 输出边界

inventory 输出只能是脱敏摘要：

- accountMasked
- region
- resourceType
- resourceStatus
- tagCompleteness
- portalMappingStatus
- orphanResourceCount
- missingTagCount
- conflictCount
- auditQueueItems

不得输出：

- SecretId / SecretKey
- token
- kubeconfig
- objectKey / storageKey / cosPrefix / signedUrl
- CVM instance raw full object
- COS object 正文
- bucket policy
- provider raw response 全量

输出必须默认 redacted。任何 raw provider response、raw cloud object、raw billing object 只能留在后端受控调试边界，且必须另行授权；不得进入 Portal payload、日志、evidence 或 git。

## 映射规则

readonly inventory 必须用 Portal 账本 + 云标签双重校验：

- accountId / portal account
- workspaceId
- resourceOrderId
- resourceBindingId
- serverPlanId
- runId 可为空
- resource type
- region

不能只靠资源名称、创建时间、IP、规格推断归属。

归属缺失或冲突必须 fail-closed，进入 admin 审计队列。inventory 不得用默认账号、默认 workspace、最近创建时间、IP 段或规格相似度补齐归属。

## 用户删除 / 释放安全

readonly inventory 必须证明后续 release/delete 只能作用于用户自己的资源：

- 删除计算资源前必须证明 resourceBindingId、workspaceId、accountId 一致。
- 删除存储资源/文件空间前必须证明 storage entitlement 和 workspaceId 一致。
- 释放计算资源不得删除文件空间。
- 删除文件空间才进入 7 天保护期。

inventory 通过不能直接触发删除或释放；它只为 authorized create/release 阶段提供只读证据。任何不一致、缺失或冲突都必须阻断 mutation 授权并进入 admin 审计队列。

## 当前分支 Non-Goals

- 不读取真实 secret 文件。
- 不调用真实腾讯云/COS/TKE/CVM/账单 API。
- 不创建、删除、释放、扩缩容、改标签、改权限。
- 不真实扣费。
- 不运行 build/push/kubectl/live-test。
- 不修改 deploy/.sentrux/adapters/upstream/Gateway/Runtime Bridge。
- 不实现真实 inventory provider。
- 不新增 Portal UI。

## Implementation Note: SDK Client Wrapper

SDK adapter 属于 readonly inventory 实现层，不是 create/release。当前分支不读取 secret、不运行真实云盘点。

SDK 只能隐藏在 thin client wrapper 里。业务层只允许使用 inventory client interface，不能暴露 Tencent SDK raw client 或通用 call(apiName, params)。

SDK wrapper 仍必须遵守 allowlist_only、Describe/List/Get/Head only、COS metadata only/no object body、fail-closed ownership 和 redacted contract-whitelisted output。它不允许 Create/Delete/Modify/Run/Terminate 等 mutation API。

## Official SDK Provider Strategy

readonly inventory 的 production default provider = Tencent official SDK wrapper。业务层只允许依赖 v22 自己的 readonly inventory interface，不直接依赖 Tencent SDK raw client。

hand-rolled TC3 = diagnostic/reference only, not production default。TC3 暂不删除，但不能作为 production default readonly live path，不能作为 create/release provider，也不能扩大 mutation 权限。

official SDK wrapper 仍必须 obey readonly allowlist、secret allowlist、redaction、RUN gate、no raw SDK exposure。它只能暴露现有语义接口：

- describeAccount
- describeRegions
- describeCvmInstances
- describeTkeClusters
- describeCosBuckets
- describeCosMetadata
- describeBillingSummary
- describeTagResources

禁止 raw SDK client 泄露到业务层。禁止通用 call(apiName, params)。禁止 mutation API。SDK raw response 不得进入 stdout/report/Portal payload。

新增或升级 tencentcloud-sdk-nodejs / cos-nodejs-sdk-v5 依赖必须有用户授权，并由 B 审查 package diff。Package A 已安装 SDK dependency diff 到本分支：`tencentcloud-sdk-nodejs@4.1.227` 和 `cos-nodejs-sdk-v5@2.15.4`。

## Implementation Note: Official SDK Dependency Loader

official SDK dependency loader 属于 readonly inventory 实现层，只负责把 `tencentcloud-sdk-nodejs` package shape 包成 `createTencentReadonlyInventoryOfficialSdkModules` 可消费的 factories。

loader 不读取 process.env，不读取 secret 文件，不 source env，不调用真实腾讯云。runner 只有在 `--live-readonly`、`--sdk-mode tencent-official-sdk-readonly`、`--enable-official-sdk-loader`、RUN gate 开启、regions 非空且 readonly API allowlist 通过后，才允许加载 official SDK package。默认未显式开启时必须 fail-closed，不加载 SDK package，不打云。

loader 不暴露 raw SDK client，不暴露通用 call(apiName, params)，不暴露 Create/Delete/Modify/Run/Terminate/Put/Update/Attach/Detach/Tag mutation。SDK raw response、endpoint、authorization header、SecretId/SecretKey、token、objectKey/storageKey/cosPrefix/signedUrl 不得进入 stdout、report、Portal payload 或 evidence。

Implementation shape note: `tencentcloud-sdk-nodejs` covers the readonly account/CVM/TKE/billing/tag client shapes used by this inventory path, but does not provide COS bucket/object metadata access. Full cloud connection therefore requires `cos-nodejs-sdk-v5` or a dedicated COS implementation path. Non-COS readonly allowlists must not initialize or be blocked by COS client shape, while COS-enabled allowlists must fail closed with a sanitized diagnostic if the COS SDK shape is missing.

## COS SDK Dependency Decision

`cos-nodejs-sdk-v5` is part of the authorized SDK dependency package for the cloud connection loop. Package A has installed it in `services/portal`.

Before a full readonly cloud report can be accepted, shape smoke must prove:

- `tencentcloud-sdk-nodejs` can load STS / CVM / TKE / billing / tag client shapes.
- `cos-nodejs-sdk-v5` can support bucket list, bucket/prefix metadata or equivalent metadata-only file-space evidence.
- COS object bodies are not read.
- bucket policy, objectKey, storageKey, cosPrefix and signedUrl do not enter stdout, report, Portal payload, evidence or git.

If `cos-nodejs-sdk-v5` is not installed or COS shape is unavailable, the official readonly path can still run a non-COS account/TKE/billing/tag report, but it cannot mark the full storage/file-space connection complete.

cleanup 策略：

- official SDK readonly live 跑通前，不删除 TC3。
- official SDK readonly live 跑通后，另开 cleanup 分支将 TC3 从 production default 退场。
- TC3 可保留为 isolated diagnostic fixture。
- TC3 不能作为 create/release 或默认 readonly live 主路径。

本分支已在 Package A/B 授权下安装 SDK，并落地 SDK dependency / loader / readonly client 连接形状；默认 smoke 不读 secret、不调用真实腾讯云。调用真实 readonly 云 API 只能发生在用户显式授权的 live readonly 路径中，且只证明 readonly connection 可生成脱敏审计摘要；它不证明 Portal canonical mapping 已完成，不允许 mutation 自动推进。本分支不删除 TC3、不改 create/release mutation 边界、不读取 mutation secret、不执行 mutation、不改 deploy、不 kubectl、不 merge、不 push。

## Live Readonly Authorization Note

live readonly 只允许读取用户当前会话明确授权的 git 外 readonly inventory secret 文件，且只允许读取 `TENCENT_READONLY_*` allowlist key。必须要求 `RUN_TENCENT_READONLY_INVENTORY=1`，并且只允许调用 check-config 已通过的 Describe/List/Get/Head 类 API。

禁止 Create/Delete/Modify/Run/Terminate/Put/Update/Attach/Detach/Tag mutation。输出只能写 `.runtime/v22-tencent-readonly-inventory/*.json`，stdout 只打印脱敏摘要；不写 git，不写 docs，不贴 raw response。

live readonly 不创建、不删除、不释放、不扩缩容、不改标签、不扣费。权限/限流/region 错误只进入安全 audit summary。真实 live run 必须由用户在当前会话单独授权后执行。

runner 只有在 `--sdk-mode tencent-official-sdk-readonly`、`--enable-official-sdk-loader`、`RUN_TENCENT_READONLY_INVENTORY=1`、allowlist 通过、用户单独授权执行时，才允许加载 official SDK package 并调用真实只读 SDK。默认 smoke 和 CI 不运行真实云。

`--sdk-mode tencent-real-readonly` 只保留为 dependency-injected SDK modules 的兼容测试入口，用来证明 runner 的 readonly gate、regions、API allowlist、redaction 和 mutation rejection；它不能作为 production default provider，不能加载 raw SDK package，不能绕过 official SDK dependency loader 合同。

TC3 readonly modules 属于 readonly inventory live client implementation，不是 create/release，不扩大 mutation 权限。TC3 modules 只能通过注入 fetch 和 readonly credentials 生成 Describe/List/Get/Head 请求，不读取 secret 文件、不 source env、不暴露 raw client 或通用 call(apiName, params)。

Live Bridge 是 readonly inventory 的授权运行入口，默认关闭。runner 只有在 `--live-readonly`、`--sdk-mode tencent-tc3-readonly`、`--enable-real-fetch`、`RUN_TENCENT_READONLY_INVENTORY=1`、regions 非空、allowlist 通过且用户在当前会话单独授权执行时，才允许把 `globalThis.fetch` 注入 TC3 readonly modules；未显式开启时必须 fail-closed。Live Bridge 不扩大 create/release，不支持 mutation API，不改变输出脱敏边界，默认 smoke 和 CI 不运行真实云。

## Contract Data

<!-- v22-tencent-readonly-inventory-contract:start -->
```json
{
  "contract": "v22_tencent_readonly_inventory_boundary",
  "version": 1,
  "providerPackage": "Tencent Provider",
  "stage": "readonly/tencent inventory",
  "route": "mock/snapshot -> readonly/tencent quote -> dry-run/tencent plan -> readonly/tencent inventory -> authorized/tencent create/release",
  "productionDefaultProviderStrategy": "tencent_official_sdk_wrapper",
  "tc3ProviderStrategy": "diagnostic_reference_only",
  "officialSdkWrapperExposesOnlyReadonlyInventoryInterface": true,
  "rawSdkClientExposedToBusinessLayer": false,
  "genericApiCallExposed": false,
  "sdkRawResponseAllowedInStdoutReportOrPortalPayload": false,
  "newSdkDependencyRequiresUserAuthorizationAndPackageDiffReview": true,
  "requiredSdkDependencies": [
    "tencentcloud-sdk-nodejs",
    "cos-nodejs-sdk-v5"
  ],
  "contractBranchInstallsSdkDependency": true,
  "installedSdkDependencies": [
    {
      "name": "tencentcloud-sdk-nodejs",
      "version": "4.1.227"
    },
    {
      "name": "cos-nodejs-sdk-v5",
      "version": "2.15.4"
    }
  ],
  "fullCosConnectionRequiresCosNodejsSdkV5": true,
  "removeTc3BeforeOfficialSdkLivePass": false,
  "tc3AllowedAsCreateReleaseProvider": false,
  "changesCreateReleaseMutationBoundary": false,
  "implementsRealCloudCall": true,
  "readsSecretNow": true,
  "defaultUnauthorizedPathFailsClosed": true,
  "authorizedReadonlyLiveReport": {
    "path": ".runtime/v22-tencent-readonly-inventory/<authorized-run-id>.json",
    "redactedOnly": true,
    "provesReadonlyConnectionOnly": true,
    "doesNotProvePortalCanonicalMappingComplete": true,
    "doesNotAuthorizeMutation": true
  },
  "futureSecretFileAllowed": true,
  "futureSecretFile": "<git-outside-readonly-inventory-secret-file>",
  "secretLoadMode": "allowlist_only",
  "forbidsReadAllSecretFile": true,
  "allowedReadonlySecretKeys": [
    "RUN_TENCENT_READONLY_INVENTORY",
    "TENCENT_READONLY_SECRET_ID",
    "TENCENT_READONLY_SECRET_KEY",
    "TENCENT_READONLY_REGIONS",
    "TENCENT_READONLY_ALLOWED_APIS",
    "TENCENT_READONLY_ACCOUNT_ID"
  ],
  "forbiddenSecretKeys": [
    "TENCENT_MUTATION_SECRET_ID",
    "TENCENT_MUTATION_SECRET_KEY",
    "RUN_TENCENT_CREATE_RELEASE",
    "LANGFUSE_SECRET_KEY",
    "GITHUB_TOKEN",
    "DATABASE_URL",
    "SSH_PRIVATE_KEY",
    "kubeconfig",
    "raw API Key"
  ],
  "allowedApiVerbs": [
    "Describe",
    "List",
    "Get",
    "Head"
  ],
  "forbiddenApiVerbs": [
    "Create",
    "Delete",
    "Modify",
    "Run",
    "Terminate",
    "Attach",
    "Detach",
    "PutBucket",
    "PutObject",
    "DeleteObject",
    "Update",
    "TagMutation",
    "PolicyMutation"
  ],
  "allowsCosMetadataAndUsageRead": true,
  "forbidsCosObjectBodyRead": true,
  "allowsBillingSummaryReadAfterSeparateAuthorization": true,
  "outputRedactionRequired": true,
  "allowedOutputFields": [
    "accountMasked",
    "region",
    "resourceType",
    "resourceStatus",
    "tagCompleteness",
    "portalMappingStatus",
    "orphanResourceCount",
    "missingTagCount",
    "conflictCount",
    "auditQueueItems"
  ],
  "forbiddenOutputFields": [
    "SecretId",
    "SecretKey",
    "token",
    "kubeconfig",
    "objectKey",
    "storageKey",
    "cosPrefix",
    "signedUrl",
    "cvmInstanceRawFullObject",
    "cosObjectBody",
    "bucketPolicy",
    "providerRawResponse"
  ],
  "requiresPortalLedgerAndCloudTagMatch": true,
  "requiredOwnershipTags": [
    "accountId",
    "workspaceId",
    "resourceOrderId",
    "resourceBindingId",
    "serverPlanId",
    "resourceType",
    "region"
  ],
  "runIdMayBeNull": true,
  "forbidsOwnershipInferenceByNameTimeIpOrSpec": true,
  "failClosedOnMissingOrConflictingOwnership": true,
  "createReleaseMayProceedAfterInventoryPass": true,
  "inventoryPassDoesNotExecuteMutation": true,
  "computeReleaseDeletesFileSpace": false,
  "fileSpaceDeleteTriggersRetentionDays": 7
}
```
<!-- v22-tencent-readonly-inventory-contract:end -->
