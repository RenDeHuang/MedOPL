# OPL v19 Open Items Checklist

Date: 2026-05-01
Branch: `codex/opl-v19`
Worktree: `C:\Users\Administrator\Desktop\平台搭建_v1\.runtime\worktrees\opl-v19`

## Current Verdict

v19 is not complete as a commercial operations release.

It has passed many local and contract-level checks, but the default cloud path has not been proven end to end. The largest gap is not whether code exists. The gap is whether the paid-user path can run on Tencent Cloud with durable state, real resources, exact billing, cleanup, and audit evidence.

## Why v19 Is Not Complete

1. v19 has not been rolled to cloud.
   Cloud Deployments are still on `opl-v18` for the platform services, and `opl-web-opl` remains on upstream `opl-v1`.

2. Live TKE create/delete is not proven.
   The branch does not yet have completed evidence that a real order can create a dedicated node pool, run a labeled task, delete or scale it to zero, and leave no orphan TKE/CVM resources.

3. Exact bill reconciliation is unhealthy on cloud.
   Read-only cluster inspection found `billing-reconcile` still using `billing-aggregator-opl:opl-v14`, and recent reconcile Jobs are failing. This blocks commercial billing acceptance.

4. COS daily exact bill回补 has not been proven.
   Local settlement smoke passed, but there is no successful live evidence from a real COS `daily/` bill file producing idempotent refund or makeup charge.

5. Full live user E2E is missing.
   The required path has not been captured end to end: create user, recharge, login Portal and OPL, buy storage, select a sellable SKU, preauth, provision, run OPL message, produce artifact, see trace/bill/file, download, delete server, stop pending cost.

6. PostgreSQL/Redis production cutover still needs restart recovery proof.
   Product compose defaults to `postgres_redis`, but cloud Portal must still show `PORTAL_STORAGE_MODE=postgres_redis` and prove state survives Pod restart.

7. Live Tencent Cloud SKU quote is not captured from production credentials.
   The local SKU smoke validated response shape and UI behavior, but live discovery was skipped locally because Tencent credentials were not configured in the worktree.

8. Sentrux quality does not meet the stricter v19 plan target.
   Current integrated branch is `quality_signal=6901` with `check_rules=pass`, but the v19 plan target was `quality_signal >= 6988`. Rules pass, but the stricter quality target is not satisfied.

9. Portal large-file structure is still a debt.
   `services/portal/src/app/portal-runtime.mjs` and `services/portal/src/state/portal-store.mjs` remain too large. Small mechanical extraction attempts lowered the Sentrux score, so this needs behavior-locked route/service extraction, not cosmetic splitting.

10. Live observability is incomplete.
    Entry health works, but commercial observability still needs live correlation across `tenantId`, `workspaceId`, `resourceOrderId`, `runId`, TKE, COS, ledger, Langfuse trace, and audit logs.

## P0 Checklist Before v19 Can Be Rolled

- [ ] Fix `billing-reconcile` CronJob image and command so it runs the current reconcile path, not stale `opl-v14`.
- [ ] Add or restore a dedicated live TKE create/delete cleanup script with `try/finally`.
- [ ] Run live TKE create/delete cleanup and record no residual node pools, CVMs, Pods, Jobs, or PVC artifacts.
- [ ] Run live `/server-plans` discovery with Tencent Cloud credentials and prove `source=tencent_cloud_live_catalog`.
- [ ] Prove sellable SKUs have non-zero prices and unsellable SKUs are disabled.
- [ ] Switch cloud Portal to `PORTAL_STORAGE_MODE=postgres_redis`.
- [ ] Run migration into TencentDB PostgreSQL and Redis without writing secrets into git or YAML.
- [ ] Restart Portal Pod and prove user, wallet, order, workspace, file metadata, and ledger state survive.
- [ ] Run live COS `daily/` reconcile when a real bill file exists.
- [ ] Prove repeated reconcile is idempotent and does not double-charge.
- [ ] Complete one full live user E2E with screenshots or JSON evidence.
- [ ] Verify deleting server stops pending cost growth.
- [ ] Verify `one-person-lab` upstream remains clean after the live run.

## P1 Checklist Before Commercial Trial

- [ ] Raise Sentrux quality to the v19 target or formally revise the gate in `.sentrux/rules.toml` and the v19 plan.
- [ ] Refactor Portal backend by behavior-locked modules: auth/session, workspace, resource orders, storage, billing, admin, traces.
- [ ] Add regression tests before each Portal extraction.
- [ ] Add admin audit evidence for every privileged read and write.
- [ ] Add failure recovery scripts for preauth failed, provision failed, artifact upload failed, reconcile failed, and exact bill missing.
- [ ] Add structured log checks for `tenantId/workspaceId/resourceOrderId/runId/requestId`.
- [ ] Add alert rules for Portal 5xx, Gateway WebSocket 504, OPL policy violation, TKE orphan, COS bill missing, reconcile failed.
- [ ] Add backup and restore proof for PostgreSQL, Redis, and COS metadata.

## P2 Checklist Before Formal Production SaaS

- [ ] External security review.
- [ ] Image vulnerability scanning and deploy gate.
- [ ] CAM least-privilege proof for Billing, Provisioner, COS, and TCR.
- [ ] Capacity test for Gateway, Portal, Adapter, Billing, Langfuse ingestion, and Runner queue.
- [ ] Disaster recovery drill.
- [ ] Rollback drill for each service.
- [ ] Organization-level RBAC and workspace membership model.
- [ ] Payment, invoice, and tax flow if moving beyond manual recharge.
- [ ] Customer-facing pricing and terms page.

## Minimum Acceptance Definition

v19 can be called complete only when all P0 items pass and evidence is added to:

- `docs/reports/2026-04-30-OPL-v19-Live-E2E-Evidence.md`
- `docs/releases/2026-04-30-OPL-v19-Rollout-Plan.md`
- `docs/reports/2026-04-30-OPL-v19-Commercialization-Assessment.md`

Until then, v19 should be described as a local/contract-validated commercial candidate, not a completed commercial operations release.
