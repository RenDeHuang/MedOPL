# Billing Aggregator

This service is the billing boundary for Portal + OPL. It keeps Tencent Cloud
billing and pricing integration out of Portal, while exposing a small HTTP
contract that Portal can consume.

Cost source priority:

1. `tencent_cloud_bill` - Tencent Cloud bill detail or COS bill import. This is
   the final billing source when bill rows carry `tenant_id`, `workspace_id`,
   and `run_id` cloud resource tags.
2. `tencent_cloud_bill_unattributed` - real Tencent Cloud bill rows that cannot
   be attributed to a run. These rows are visible for operations, but they are
   not used for per-run wallet reconciliation.
3. `opencost_pending` - near-real-time Kubernetes allocation. This is only a
   pending allocation signal.
4. `metering_pending` - local requested-resource estimate. This is only a
   fallback signal.

OpenCost must not be treated as the final bill. Wallet adjustments should be
reconciled against Tencent Cloud bill details.
If Tencent Cloud pagination reaches `TENCENT_BILLING_MAX_PAGES` before all
reported rows are fetched, the request fails instead of returning a partial
result as exact.

## Included

- CPU
- GPU
- PVC / storage
- Tencent Cloud bill detail attribution
- Tencent Cloud server plan quotation status

## Excluded

- token billing
- subscription logic
- invoices
- Portal user authentication
- OPL launch/session identity

## Data Source

- Tencent Cloud bill detail
- Tencent Cloud CVM price inquiry for allowlisted server plans
- OpenCost `/allocation` for pending allocation only
- Local requested-resource metering as a fallback

## Tencent Cloud configuration

```text
TENCENT_BILLING_ENABLED=1
TENCENT_BILLING_REQUIRED=0
TENCENT_PRICE_ENABLED=1
TENCENT_CLOUD_SECRET_ID=...
TENCENT_CLOUD_SECRET_KEY=...
TENCENT_CLOUD_REGION=ap-guangzhou
TENCENT_PRICE_IMAGE_ID=img-...
SERVER_PLAN_CATALOG_JSON=[{"id":"cpu-standard-gz","name":"CPU standard","region":"ap-guangzhou","zone":"ap-guangzhou-7","instanceType":"S5.MEDIUM4","cpu":2,"memoryGb":4,"minBillableHours":1,"riskFactor":1.2}]
```

## Endpoints

- `GET /server-plans` - allowlisted server plans with Tencent Cloud quote state.
- `GET /billing` - cost summary; Tencent Cloud bill details are used first when
  configured.
- `POST /reconcile` - writes ledger adjustments only when exact Tencent Cloud
  bill data is available.

`DescribeBillDetail` windows are split by month before calling Tencent Cloud, so
weekly reconcile jobs remain valid across month boundaries.
