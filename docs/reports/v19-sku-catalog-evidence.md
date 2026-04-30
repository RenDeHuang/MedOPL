# v19 SKU Catalog Lane Evidence

- Billing Aggregator `/server-plans?region=na-siliconvalley&zone=na-siliconvalley-1` now returns `source=tencent_cloud_live_catalog` when live discovery is available, and always preserves the contract fields `instanceType`, `cpu`, `memoryGb`, `zone`, `availabilityStatus`, `statusCategory`, `soldOutReason`, `hourlyPrice`, `currency`, `canOrder`.
- Portal server catalog UI now paginates at 4 SKUs per page, supports CPU and memory GB filters, and keeps non-orderable SKUs visible with disabled order actions.
- Verification executed in this lane:
  - `node --check adapters/billing-aggregator/src/server.mjs`
  - `node --check services/portal/src/domain/server-plans.mjs`
  - `node --check services/portal/frontend/src/views/servers/server-plan-catalog.mjs`
  - `node --check scripts/smoke-test-v19-sku-discovery-live.mjs`
  - `node --check scripts/smoke-test-v19-server-plan-pagination-filter.mjs`
  - `npm --prefix services/portal/frontend run typecheck`
  - `npm --prefix services/portal/frontend run build`
  - `node scripts/smoke-test-v19-sku-discovery-live.mjs`
  - `node scripts/smoke-test-v19-server-plan-pagination-filter.mjs`
