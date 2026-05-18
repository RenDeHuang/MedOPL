# 历史参考文档，不是 v22 active 合同或当前实现入口；不得作为当前主线、smoke、接云或部署依据。

# OPL v20 Update Log

Date: 2026-05-03
Branch: `platform-v20`
Image tag: `opl-v20`

## Summary

v20 adds a commercial package layer on top of the v19 cloud and runtime path. Ordinary Portal users now see a lab-product model instead of a raw cloud-resource console:

- Two regular packages: 入门套餐 and 进阶套餐.
- Package subscriptions with idempotent activation and upgrade events.
- Package storage entitlement before upload/run/output persistence.
- Weekly freeze and daily package charge ledger types, separate from L3 exact cloud settlement.
- Balance grace policy: grace keeps download enabled and blocks new upload/run work.
- Portal navigation exposes 总览 / 实验室套餐 / 任务空间 / 账单 / 会话轨迹, with server SKU details moved to `/advanced/servers`.

## Backend Changes

- Added product-layer modules:
  - `lab-packages.mjs` owns package definitions and public package views.
  - `lab-subscriptions.mjs` owns subscription lifecycle, package events, storage add-ons, and daily charge records.
  - `lab-entitlements.mjs` projects subscription state into compute, storage, and gate entitlements.
  - `lab-billing-policy.mjs` owns weekly freeze, daily charge, grace, and cleanup-queue status calculation.
- Added `lab-package.routes.mjs` for package list, activation, upgrade, subscription, entitlement, and storage add-on APIs.
- Added JSON and PostgreSQL/Redis persistence for lab subscriptions, package events, storage add-ons, and daily charges.
- Added ledger types: `subscription_weekly_freeze`, `subscription_daily_charge`, and `subscription_freeze_release`.
- Kept v19 `resourceOrders`, `storageOrders`, and billing aggregator as separate cloud-resource and audit layers.

## Portal And OPL Changes

- Added `PackagesView.vue`, `/packages`, and `/advanced/servers`.
- Removed `/servers` from ordinary user navigation.
- Added frontend API bindings for v20 package endpoints.
- Kept OPL runtime source aligned with upstream `.runtime/one-person-lab-upstream`; upstream clean check passed at HEAD `c3c6d18`.
- OPL login accepts `apiKey`, `providerApiKey`, `experimentalBearerToken`, or `gflabtoken`.
- Gateway injects a `gflabtoken API key` field below password and uses placeholder `来源于 gflabtoken.cn`.
- Portal native-login rejects missing provider keys and returns only redacted provider metadata.

## Secret Isolation And Deployment

- Split Tencent credentials by responsibility:
  - `tencent-billing-secret`
  - `tencent-cos-secret`
  - `tencent-provisioner-secret`
  - `portal-postgres-redis-secret`
- Updated billing aggregator and resource provisioner config to read scoped secret variables without broad cloud-secret fallback.
- Added Linux/WSL manifest renderer: `deploy/tke-package/scripts/render-tke-manifests.mjs`.
- Renderer refuses to overwrite tracked `deploy/tke-package/rendered` and writes local checks to ignored output directories.
- Rebuilt and pushed `portal-opl:opl-v20` after replacing Windows-only zip packaging with a Node ZIP writer.
- Current live Portal image digest:
  - `uswccr.ccs.tencentyun.com/gaofenglab/portal-opl@sha256:1fa3477a7083c935f7c580a89729e54b129035da76890d02ff8b8d59d063cb11`

## Live Rollout Evidence

- Live traffic is served from `default` namespace ingress `gaofenglab`, not `portal-staging`.
- Public health checks passed:
  - `https://portal.medopl.cn/healthz` reports `build.sha=opl-v20`.
  - `https://opl.medopl.cn/healthz` reports `build.sha=opl-v20`.
- Default namespace deployments updated to `opl-v20`:
  - `portal-opl`
  - `portal-opl-adapter-opl`
  - `opl-web-gateway-opl`
  - `opl-web-opl`
  - `billing-aggregator-opl`
  - `resource-provisioner-opl`
  - `med-autoscience-runner-orchestrator-opl`
- `billing-reconcile` CronJob image was also updated to `billing-aggregator-opl:opl-v20`.
- RBAC fix applied: `ClusterRoleBinding med-autoscience-runner-job-manager` now points to `system:serviceaccount:default:med-autoscience-runner`.
- Post-fix RBAC checks passed for `get jobs` and `create jobs` in `default`.
- Default namespace Postgres/Redis references were migrated to `portal-postgres-redis-secret`; old `portal-postgres-redis` refs are now zero in `portal-opl`, `med-autoscience-runner-orchestrator-opl`, `billing-aggregator-opl`, and `billing-reconcile`.

## Live User Journey Evidence

Fixture:

- File: `.runtime/portal/live-recovery-fixtures/test-v19-moor4xb4-aedcbf.json`
- User: `test-test-v19-moor4xb4-aedcbf@example.test`
- Tenant/user id: `f4814180-6c94-4b63-82bc-f9480bc1d483`
- Workspace: `test-v19-moor4xb4-aedcbf`
- Resource order: `e6e31f01-e6a6-49f1-a8ac-06d780c9ab88`
- Run: `test-run-test-v19-moor4xb4-aedcbf`
- Server plan: `cpu-2c4g`

Evidence:

- `.runtime/v20-live-e2e/2026-05-02T19-52-08-951Z-same_day.json`
  - `ok=true`
  - `warnings=[]`
  - TKE cleanup ended with nodePools `0`, runtime instances `0`.
  - Same-day billing total remained stable during cleanup.
- `.runtime/v20-ui-evidence/2026-05-02T20-26-27-385Z.json`
  - Portal pages verified: overview, packages, workspace, billing, trace.
  - Workspace API returned target workspace with 1 input file, storage enabled, and 10 GB storage.
  - Session trace API returned target workspace/run evidence.
  - Portal download returned `application/zip`, status `200`, ZIP signature `504b0304`.
  - OPL page showed `gflabtoken API key` input, name `apiKey`, placeholder `来源于 gflabtoken.cn`.
  - OPL native login returned status `200`, provider source recorded as `gflabtoken`.
- Screenshots:
  - `.runtime/v20-ui-evidence/portal-trace.png`
  - `.runtime/v20-ui-evidence/opl-login.png`

## Fixes From Live Verification

- Found live `download-all` failure: Portal called `powershell Compress-Archive` inside Linux TKE container.
- Symptom: `GET /portal/workspace/download-all?...` returned 502 and Portal Pod restarted.
- Root cause: platform-specific archive command in `createZipFromDir`.
- Fix:
  - Added `services/portal/src/lib/zip-archive.mjs`.
  - Replaced shell zip with a Node standard-library ZIP writer.
  - Added `scripts/smoke-test-portal-zip-archive-contract.mjs`.
- Live verification after redeploy:
  - Portal Pod image digest `sha256:1fa3477a7083c935f7c580a89729e54b129035da76890d02ff8b8d59d063cb11`.
  - `download-all inputs` returned `200 application/zip`.
  - Portal Pod restart count stayed `0`.

## COS And T+1 Status

- COS exact bill gate was run against `100047070895-20260501-分账报表-明细账单.zip`.
- Evidence: `.runtime/cos-exact-bill-reconcile/2026-05-02T20-01-02-515Z.json`.
- Result: not passed as exact attribution.
- Error: `exact_bill_target_not_attributed`.
- Reason: the selected T+1 bill object does not contain the 2026-05-02 evening target resource attribution; sampled rows also lacked required target tags (`resource_order_id`, `run_id`, `server_plan_id`, `tenant_id`, `workspace_id`).
- This is recorded as bill-object coverage not yet available for the target run, not as a passed settlement gate.

## Recovery Baseline Status

- Recovery baseline was rerun after secret ref migration.
- Result: baseline check passed for current live object references and fixture integrity.
- Scope:
  - Portal build `opl-v20`.
  - `PORTAL_STORAGE_MODE=postgres_redis`.
  - Portal container references `portal-postgres-redis-secret`.
  - `PORTAL_POSTGRES_URL` and `PORTAL_REDIS_URL` are `secretKeyRef`, not literals.
- The run used `PORTAL_RECOVERY_EXPECT_POST_RESTART=0`, so it does not claim full restart before/after recovery.

## Verification Completed

- `node scripts/smoke-test-portal-zip-archive-contract.mjs`
- `node scripts/smoke-test-portal-task-space-routes-contract.mjs`
- `node scripts/smoke-test-v20-lab-packages-contract.mjs`
- `node scripts/smoke-test-v20-lab-subscription-billing-contract.mjs`
- `node scripts/smoke-test-v20-lab-entitlements-contract.mjs`
- `node scripts/smoke-test-v20-lab-package-routes-contract.mjs`
- `node scripts/smoke-test-v20-portal-copy-contract.mjs`
- `node scripts/smoke-test-secret-hygiene-manifests.mjs`
- `node scripts/smoke-test-tke-manifest-renderer-contract.mjs`
- `node scripts/smoke-test-v20-tencent-secret-isolation-contract.mjs`
- `node scripts/smoke-test-v19-commercial-ops-full-journey-contract.mjs`
- `node scripts/check-one-person-lab-upstream-clean.mjs`
- `npm --prefix services/portal run check`
- `npm --prefix services/portal/frontend run typecheck`
- `npm --prefix services/portal/frontend run build`
- `sentrux gate .`

## Known Gaps

- Full restart recovery with `PORTAL_RECOVERY_EXPECT_POST_RESTART=1` was not run in this pass.
- COS exact bill settlement for the 2026-05-02 target run must be rerun after a bill object that covers this resource is available.
- `gstack-browse` daemon failed locally with `lastConsoleFlushed is not defined`; Playwright direct evidence was used instead.
- One diagnostic OPL browser load recorded transient 401/502 resources before login; follow-up checks showed native login returned `200` three times and the PNG asset returned `200 image/png`.

## Operational Notes

- Do not use L3/COS T+1 as the ordinary user daily-charge source; it remains a backend audit and margin-control path.
- Do not expose raw SKU/TKE/CVM/COS/L3 wording in ordinary Portal package pages.
- Keep build context `deploy/tke-package/source/` ignored; sync it only for image builds and do not commit it.
