# OPL v19 Rollout Plan

Date: 2026-04-30
Branch: `codex/opl-v19`

## Current Decision

Do not roll v19 to cloud yet.

Reason: local and contract smoke passed, but live TKE create/delete, COS exact bill reconcile, PostgreSQL/Redis restart recovery, live SKU quote, and full user E2E evidence are not complete.

Additional cloud finding: the current `billing-reconcile` CronJob is still on `billing-aggregator-opl:opl-v14` and recent Jobs are failing. Fix reconcile health before using any v19 rollout as a commercial billing gate.

## Rollout Order

1. Build images from clean `codex/opl-v19`.
2. Push only existing self-owned repositories to TCR, do not create extra image repositories.
3. Roll `opl-web-gateway-opl` first.
4. Verify:
   - `https://opl.medopl.cn/healthz` returns v19.
   - `/` loads.
   - Native login requires provider API key.
   - WebSocket upgrade returns 101.
5. Roll `portal-opl-adapter-opl`.
6. Verify:
   - OPL launch bootstrap works.
   - OPL message creates run and trace.
   - Provider key remains redacted.
7. Roll `billing-aggregator-opl`.
8. Verify live `/server-plans` returns `source=tencent_cloud_live_catalog` and non-zero prices.
9. Roll `resource-provisioner-opl`.
10. Run live TKE create/delete cleanup.
11. Roll `med-autoscience-runner-orchestrator-opl` and runner image if required by the current deployment.
12. Roll `portal-opl` only after PostgreSQL/Redis secrets are present and migration is complete.

## Required Kubernetes State

- Portal Secret contains PostgreSQL and Redis URLs.
- `PORTAL_STORAGE_MODE=postgres_redis`.
- Tencent Cloud secrets remain only in Billing and Provisioner workloads.
- Provider API keys remain per-user/session secret references, not environment variables in shared OPL Web.
- Ingress health for `portal.medopl.cn`, `opl.medopl.cn`, and `trace.medopl.cn` is green before and after rollout.

## Rollback

Rollback one service at a time in reverse order.

Priority rollback triggers:

- Portal cannot read PostgreSQL/Redis.
- OPL login white-screens after provider login.
- WebSocket stops returning 101.
- `/server-plans` returns empty or zero-price sellable plans.
- Provisioner creates a node pool but cannot delete it.
- Billing reconcile creates duplicate ledger entries.

## Post-Rollout Verification

Run:

```bash
node scripts/check-production-entry-performance.mjs --json
node scripts/smoke-test-v19-entry-health.mjs
node scripts/smoke-test-v19-opl-websocket-business-session.mjs
node scripts/smoke-test-v19-sku-discovery-live.mjs
node scripts/smoke-test-portal-commercial-saas.mjs
```

Before rollout, add or restore dedicated live scripts for TKE create/delete cleanup and full user E2E. They are required gates, but they are not present in this branch yet. If any command fails, rollback the affected service and keep v19 marked as not rolled.
