# OPL v19 Live SKU Quote Evidence

日期：2026-05-01

分支：`codex/opl-v19`

提交基线：`a438432`

## 结论

Step 3 live SKU 非零报价 gate 已在本地 billing aggregator 进程中使用云上 `tencent-billing-secret` 凭据跑通，并已同步到云上 `billing-aggregator-opl` Deployment。

本次证据证明：

- `/server-plans` 返回 `source=tencent_cloud_live_catalog`。
- 腾讯云 `na-siliconvalley-1` 返回 80 个真实规格。
- 80 个规格都有非零价格。
- 本地 smoke 时 35 个规格被判定为 `canOrder=true`。
- 云上 Deployment 验证时 34 个规格被判定为 `canOrder=true`，这是实时库存状态差异，不影响 gate 结论。
- `EnoughStock` 和 `NormalStock` 不再被误判为不可下单。
- `UnderStock` 仍被阻断为不可下单。

注意：这证明 v19 代码路径可以使用生产腾讯云凭据取得 live SKU 和非零价格。当前只滚动了 `billing-aggregator-opl`，没有滚动 Portal、Gateway、Provisioner、Runner 或 OPL Web 主服务。

## 根因

旧逻辑在 `hasSoldOutMarker(statusCategory, soldOutReason)` 中把任何包含 `stock` 的 `statusCategory` 都当成售罄。

腾讯云真实返回值中存在：

- `EnoughStock`
- `NormalStock`
- `UnderStock`

因此旧逻辑会把 `EnoughStock` 和 `NormalStock` 误判为不可下单，导致 live discovery 虽然拿到 80 个非零价格 SKU，但 `orderableCount=0`。

## 修复

修复文件：

- `adapters/billing-aggregator/src/server.mjs`
- `scripts/smoke-test-v19-sku-discovery-live.mjs`

修复策略：

- 明确允许 `EnoughStock`、`NormalStock`、`InStock`。
- 明确阻断 `SoldOut`、`StockOut`、`OutOfStock`、`NoStock`、`UnderStock`、`Insufficient`、`Shortage` 等负面库存状态。
- 如果 `soldOutReason` 有值，仍判定为不可下单。
- smoke 增加回归断言：`EnoughStock` 必须可下单，`SoldOut` 必须不可下单。

## Live 数据来源

- Kubeconfig：`/mnt/c/Users/Administrator/Downloads/cls-ngiq693i-config (1)`
- Kubernetes API server override：`https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443`
- Namespace：`default`
- Secret：`tencent-billing-secret`
- Secret keys used by process env：
  - `TENCENT_CLOUD_SECRET_ID`
  - `TENCENT_CLOUD_SECRET_KEY`

Secret 明文没有写入本文档、git、命令输出或镜像。

## 云上 Deployment

- Deployment：`default/billing-aggregator-opl`
- Service：`default/billing-aggregator`
- 镜像：`uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl:opl-v19-live-gates-20260501-a438432`
- Digest：`sha256:b94619825c7a3d8c38e86baa416e014b2e947b9096fba284745108411f1aea89`
- Running Pod：`billing-aggregator-opl-6fc574df96-vxvtz`
- Pod ready：`true`
- Pod restarts：`0`
- `TENCENT_PLAN_DISCOVERY_ENABLED=1`
- `BUILD_SHA=a438432`

## 命令

```bash
node --check adapters/billing-aggregator/src/server.mjs
node --check scripts/smoke-test-v19-sku-discovery-live.mjs
env -u TENCENT_CLOUD_SECRET_ID -u TENCENTCLOUD_SECRET_ID -u TENCENT_CLOUD_SECRET_KEY -u TENCENTCLOUD_SECRET_KEY node scripts/smoke-test-v19-sku-discovery-live.mjs
TENCENT_CLOUD_SECRET_ID=<from k8s secret> TENCENT_CLOUD_SECRET_KEY=<from k8s secret> node scripts/smoke-test-v19-sku-discovery-live.mjs
node scripts/smoke-test-v19-server-plan-pagination-filter.mjs
node scripts/check-v18-module-boundaries.mjs
node scripts/check-v18-large-files.mjs
kubectl -n default exec deploy/billing-aggregator-opl -- node --input-type=module -e '<fetch /server-plans summary>'
```

## Live smoke 输出摘要

```json
{
  "ok": true,
  "skippedLive": false,
  "source": "tencent_cloud_live_catalog",
  "itemCount": 80,
  "orderableCount": 35,
  "validatedFields": [
    "instanceType",
    "cpu",
    "memoryGb",
    "zone",
    "availabilityStatus",
    "statusCategory",
    "soldOutReason",
    "hourlyPrice",
    "currency",
    "canOrder"
  ]
}
```

## 脱敏样例

```json
{
  "ok": true,
  "source": "tencent_cloud_live_catalog",
  "itemCount": 80,
  "orderableCount": 35,
  "nonZeroPriceCount": 80,
  "orderable": [
    {
      "instanceType": "MA5.MEDIUM16",
      "cpu": 2,
      "memoryGb": 16,
      "zone": "na-siliconvalley-1",
      "availabilityStatus": "SELL",
      "statusCategory": "EnoughStock",
      "hourlyPrice": 0.69,
      "currency": "CNY",
      "canOrder": true
    },
    {
      "instanceType": "MA5.LARGE32",
      "cpu": 4,
      "memoryGb": 32,
      "zone": "na-siliconvalley-1",
      "availabilityStatus": "SELL",
      "statusCategory": "NormalStock",
      "hourlyPrice": 1.37,
      "currency": "CNY",
      "canOrder": true
    }
  ],
  "blocked": [
    {
      "instanceType": "MA5.2XLARGE64",
      "zone": "na-siliconvalley-1",
      "availabilityStatus": "SELL",
      "statusCategory": "UnderStock",
      "hourlyPrice": 2.75,
      "currency": "CNY",
      "canOrder": false,
      "reason": "UnderStock"
    }
  ]
}
```

## 云上 Service 输出摘要

```json
{
  "status": 200,
  "ok": true,
  "source": "tencent_cloud_live_catalog",
  "configured": true,
  "discoveryEnabled": true,
  "priceEnabled": true,
  "discoveredCount": 80,
  "itemCount": 80,
  "orderableCount": 34,
  "nonZeroPriceCount": 80,
  "orderable": [
    {
      "instanceType": "MA5.MEDIUM16",
      "cpu": 2,
      "memoryGb": 16,
      "zone": "na-siliconvalley-1",
      "availabilityStatus": "SELL",
      "statusCategory": "EnoughStock",
      "hourlyPrice": 0.69,
      "currency": "CNY",
      "canOrder": true
    },
    {
      "instanceType": "MA5.LARGE32",
      "cpu": 4,
      "memoryGb": 32,
      "zone": "na-siliconvalley-1",
      "availabilityStatus": "SELL",
      "statusCategory": "NormalStock",
      "hourlyPrice": 1.37,
      "currency": "CNY",
      "canOrder": true
    }
  ],
  "blocked": [
    {
      "instanceType": "MA5.2XLARGE64",
      "zone": "na-siliconvalley-1",
      "availabilityStatus": "SELL",
      "statusCategory": "UnderStock",
      "hourlyPrice": 2.75,
      "currency": "CNY",
      "canOrder": false,
      "reason": "UnderStock"
    }
  ]
}
```

## 验收状态

- [x] `/server-plans` 返回 `source=tencent_cloud_live_catalog`
- [x] 至少一个可下单 SKU 有非零 `hourlyPrice`
- [x] 不可售 SKU 不允许 `canOrder=true`
- [x] Portal 每页 4 个规格、CPU/内存筛选 smoke 通过
- [x] 云上 billing aggregator Deployment 使用包含本修复的新镜像
- [x] 云上 billing aggregator Service 直接返回 live catalog、非零价格和可下单 SKU
