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
2. 请求必须包含 workspace、默认套餐和文件空间。
3. Portal 后端先检查 provider readiness；不满足时返回 `provider_key_required`。
4. Portal 后端只生成平台内部合同状态，不调用真实云 API。
5. 后台创建 platform-managed CVM / COS / runtime 表达的内部资源记录。
6. 后台生成 `resourceBinding`。
7. `resourceBinding` 必须绑定 tenant、user、workspace、billingAccount、auditTag 和 costAllocationTag。
8. 开通后进入预扣费/冻结状态。
9. API response 和 canonical state 只暴露用户可理解的托管环境、工作空间、文件空间、套餐、余额、预扣费状态，以及必要的 binding/audit 引用。

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

## Non-goals

- 不改 frontend。
- 不改 OPL Gateway。
- 不改 Runtime Bridge。
- 不改 deploy、`.sentrux` 或 `adapters`。
- 不修改 one-person-lab upstream。
- 不运行 build/push/kubectl/live-test。
