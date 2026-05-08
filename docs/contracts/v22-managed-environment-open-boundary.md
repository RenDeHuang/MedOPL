# v22 Managed Environment Open Boundary Contract

本合同定义 MedOPL v22 MVP 闭环第二段：用户在 Portal 开通托管运行环境，选择套餐和文件空间，平台后台生成资源绑定，并开始预扣费/冻结。

## Product Boundary

用户主叙事必须是：

- 用户开通“托管运行环境”。
- 用户选择“套餐”和“文件空间”。
- 用户看到“托管运行环境状态 / 工作空间 / 文件空间 / 余额 / 预扣费”。

不得把 CVM、COS、K8s、TKE 或云资源控制台作为用户主语言。

后台实现可以表达 platform-managed CVM / COS / runtime、tenant、user、workspace、resourceBinding、billingAccount、auditTag 和 costAllocationTag。这些字段只属于平台内部合同、计费、隔离和审计边界。

## Preconditions

- 开通前必须检查 provider readiness。
- 未绑定 gflabtoken provider key 时，开通接口必须返回 `provider_key_required`。
- 不读取 `/home/dev/.secrets/medopl/secrets.env.txt`。
- 不调用真实云 API。
- 不泄露 raw API key、`launchToken` 或 `runtimeToken`。

## Plans

MVP 只支持两个默认套餐：

- `starter_2c4g_10gb`
- `pro_8c16g_100gb`

套餐边界：

- `storageBackend = cos_standard_workspace_quota`
- `basePrice = null`
- `pendingProductApproval = true`

本轮不写正式价格，不扩展自定义套餐实现。

## Open Flow

1. 用户调用 Portal 后端开通“托管运行环境”。
2. 请求必须显式包含 `workspaceId`、`planId` 和 `fileSpaceGb`。
3. Portal 后端先检查 provider readiness；不满足时返回 `provider_key_required`。
4. Portal 后端只生成平台内部合同状态，不调用真实云 API。
5. 后台创建 platform-managed CVM / COS / runtime 表达的内部资源记录。
6. 后台生成 `resourceBinding`。
7. `resourceBinding` 必须绑定 tenant、user、workspace、billingAccount、auditTag 和 costAllocationTag。
8. 开通后进入预扣费/冻结状态。
9. API response 和 canonical state 只暴露用户可理解的托管环境、工作空间、文件空间、套餐、余额、预扣费状态，以及必要的 binding/audit 引用。

缺失开通参数时必须稳定失败：

- 缺 `workspaceId` 返回 `workspace_required`。
- 缺 `planId` 返回 `plan_required`。
- 缺 `fileSpaceGb` 返回 `file_space_required`。

不得使用用户当前任务、`default`、默认套餐或套餐容量补齐缺失的开通参数。

## Canonical State Contract

开通后 canonical state 必须表达：

```json
{
  "managedEnvironmentEnabled": true,
  "workspace": {
    "workspaceId": "workspace id",
    "status": "active"
  },
  "fileSpace": {
    "capacityGb": 100,
    "storageBackend": "cos_standard_workspace_quota",
    "status": "active"
  },
  "resourceBinding": {
    "resourceBindingId": "resource binding id",
    "tenantId": "tenant id",
    "userId": "user id",
    "workspaceId": "workspace id",
    "billingAccountId": "billing account id",
    "auditTag": "audit tag",
    "costAllocationTag": "cost allocation tag"
  },
  "freeze": {
    "resourceBindingId": "resource binding id",
    "status": "active_pending_product_approval",
    "preauthStatus": "pending_product_approval",
    "basePrice": null,
    "pendingProductApproval": true
  },
  "selectedPlan": {
    "id": "starter_2c4g_10gb or pro_8c16g_100gb",
    "storageBackend": "cos_standard_workspace_quota",
    "basePrice": null,
    "pendingProductApproval": true
  }
}
```

## Managed Resource Binding Plan View

Portal 工作空间可以展示 `managed resource binding plan / mock snapshot`，用于把“托管运行环境”的区域、规格、状态、预计费用、释放策略和审计状态呈现给普通用户。

该视图是 managed resource binding 的计划摘要，不代表真实资源已创建，不调用真实腾讯云 API，不读取真实 COS、TKE、CVM、kubeconfig、SecretId/SecretKey、token 或任何本地 secret。Portal payload 只暴露业务对象：

```json
{
  "resourceBindingId": "resource binding id",
  "managedEnvironment": "托管运行环境",
  "regionLabel": "硅谷一区",
  "planSpec": "8核 / 16GB 内存 / 100GB 文件空间",
  "status": "active",
  "estimatedCost": {
    "amount": 0,
    "currency": "CNY",
    "source": "contract_snapshot_fixture",
    "status": "mock_snapshot",
    "billingTruth": false,
    "chargeApplied": false
  },
  "quoteSource": "mock/tencent-readonly-quote-provider",
  "quoteStatus": "mock_snapshot",
  "quoteSnapshotId": "quote-snapshot-v22-pro-8c16g-100gb",
  "releasePolicy": {
    "status": "not_released",
    "stopBillingConfirmWithinMinutes": 120
  },
  "auditStatus": {
    "status": "audit_pending",
    "policy": "T+1"
  },
  "snapshot": {
    "source": "mock_snapshot_provider",
    "label": "managed resource binding plan / mock snapshot",
    "realResourceCreated": false
  }
}
```

普通用户界面只使用“托管运行环境、区域、规格、预计费用、释放策略、审计状态、状态”等产品语言，不把 CVM、COS、K8s、TKE 或云资源控制台作为主语言。

后续真实腾讯云接入路线必须按阶段推进：

`mock/snapshot provider -> readonly/tencent quote provider -> dry-run/tencent plan provider -> authorized/tencent create/release provider`

真实接入另开 feat/* 并单独授权。替换点是 provider adapter，不重做 Portal 用户闭环；真实创建、释放、报价、Ingress/TLS、kubeconfig、SecretId/SecretKey、token 和真实云资源操作均不属于当前合同层级。

本分支允许的最小 Portal frontend 展示范围：

- Portal 工作空间 payload 输出 `managedResourceBindingPlan`。
- Portal 工作空间普通用户页面展示托管运行环境的区域、规格、状态、预计费用、释放策略和审计状态。
- 前端只消费 `managedResourceBindingPlan` 里的业务字段，不展示或传递真实云对象、provider 内部字段、密钥或内部存储字段。

## Non-goals

- 不创建、绑定或释放真实腾讯云资源。
- 不调用真实腾讯云、COS、Langfuse 或 one-person-lab API。
- 不改 OPL Gateway、Runtime Bridge、deploy、`.sentrux`、`adapters` 或 one-person-lab upstream。
- 不暴露 SecretId/SecretKey、kubeconfig、token、raw API Key、objectKey/storageKey/localPath/signedUrl 或 provider raw cost internals。
- 不把 CVM、COS、K8s 或 TKE 作为普通用户主语言。
- 不运行 build/push/kubectl/live-test。
