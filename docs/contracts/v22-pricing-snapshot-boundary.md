# v22 Pricing Snapshot Boundary Contract

本合同定义 MedOPL v22 默认套餐的 pricing snapshot 边界。它只记录平台托管套餐的产品待审批状态和内部成本快照结构，不发布 MedOPL 售卖价。

## Scope

- v22 默认套餐只包含 `starter_2c4g_10gb` 和 `pro_8c16g_100gb`。
- 资源由平台开通，区域固定为 `na-siliconvalley`，可用区固定为 `na-siliconvalley-1`。
- 存储后端固定为 `cos_standard_workspace_quota`，操作系统固定为 `ubuntu_22_04`。
- 云账单模式固定为 `pay_as_you_go`。

## Product Approval Boundary

- `basePrice` 是 MedOPL 对客户售卖价字段。本轮产品审批未完成，因此必须为 `null`。
- `pendingProductApproval` 必须为 `true`，用于阻止前端、API、文档或测试把套餐展示为正式售卖价。
- 前端、API、文档、smoke 不得硬编码正式售卖价、小时价、按量单价或任何可被解释为当前可售价格的数值。
- `costSnapshot` 只允许表达内部云成本快照，不是客户价格，不得写入 `basePrice`，也不得作为 MedOPL 售卖价来源。
- 腾讯云成本价只能作为内部成本评审输入；不允许把腾讯云成本价当 MedOPL 售卖价。

## Contract Data

<!-- v22-pricing-snapshot-contract:start -->
```json
{
  "contract": "v22_pricing_snapshot_boundary",
  "version": 1,
  "advancedIsolationModes": [
    "dedicated_node_pool",
    "dedicated_node"
  ],
  "plans": [
    {
      "id": "starter_2c4g_10gb",
      "compute": {
        "cpuCores": 2,
        "memoryGb": 4,
        "isolationMode": "shared_quota",
        "userBuysNodePool": false
      },
      "storage": {
        "capacityGb": 10
      },
      "storageBackend": "cos_standard_workspace_quota",
      "region": "na-siliconvalley",
      "zone": "na-siliconvalley-1",
      "os": "ubuntu_22_04",
      "cloudBillingMode": "pay_as_you_go",
      "basePrice": null,
      "pendingProductApproval": true,
      "costSnapshot": {
        "kind": "provider_cost_snapshot",
        "provider": "tencent_cloud",
        "region": "na-siliconvalley",
        "zone": "na-siliconvalley-1",
        "billingMode": "pay_as_you_go",
        "currency": null,
        "providerCostAmount": null,
        "capturedAt": null,
        "usage": "internal_cost_review_only",
        "mayPopulateBasePrice": false
      }
    },
    {
      "id": "pro_8c16g_100gb",
      "compute": {
        "cpuCores": 8,
        "memoryGb": 16,
        "isolationMode": "shared_quota",
        "userBuysNodePool": false
      },
      "storage": {
        "capacityGb": 100
      },
      "storageBackend": "cos_standard_workspace_quota",
      "region": "na-siliconvalley",
      "zone": "na-siliconvalley-1",
      "os": "ubuntu_22_04",
      "cloudBillingMode": "pay_as_you_go",
      "basePrice": null,
      "pendingProductApproval": true,
      "costSnapshot": {
        "kind": "provider_cost_snapshot",
        "provider": "tencent_cloud",
        "region": "na-siliconvalley",
        "zone": "na-siliconvalley-1",
        "billingMode": "pay_as_you_go",
        "currency": null,
        "providerCostAmount": null,
        "capturedAt": null,
        "usage": "internal_cost_review_only",
        "mayPopulateBasePrice": false
      }
    }
  ]
}
```
<!-- v22-pricing-snapshot-contract:end -->

## Smoke Boundary

`scripts/smoke-test-v22-pricing-plan-contract.mjs` 是纯本地 contract 校验。它只读取本文件中的 JSON 契约块，不读取 `/home/dev/.secrets/medopl/secrets.env.txt`，不调用真实云 API，不执行 build、push、kubectl 或 live-test。
