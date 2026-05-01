# OPL v19 Open Items Checklist

Date: 2026-05-01
Branch: `codex/opl-v19`
Worktree: `C:\Users\Administrator\Desktop\平台搭建_v1\.runtime\worktrees\opl-v19`

## Current Verdict

v19 is not complete as a commercial operations release.

It has passed many local and contract-level checks, but the default cloud path has not been proven end to end. The largest gap is not whether code exists. The gap is whether the paid-user path can run on Tencent Cloud with durable state, real resources, exact billing, cleanup, and audit evidence.

## Why v19 Is Not Complete

1. v19 has only been partially rolled to cloud.
   `billing-aggregator-opl`, `resource-provisioner-opl`, and `portal-opl` have been rolled for live gate closure. Other platform services are still on older images, and `opl-web-opl` remains on upstream `opl-v1`. This is not a full v19 rollout.

2. Live TKE create/delete cleanup is now proven.
   On 2026-05-01, `0501h` created a labeled TKE node pool, created real CVM `ins-h4uz5mky`, reached `RUNNING`, and then cleaned up to zero residual node pools, CVMs, AS groups, Pods, Jobs, and PVCs. The earlier blocker `[19045] CVM not support the required disk` was resolved by using `CLOUD_BSSD` as the default system disk type. Evidence: `docs/reports/2026-05-01-OPL-v19-TKE-Live-Cleanup-Evidence.md`.

3. Billing reconcile is fixed, but exact bill attribution still needs live data.
   `billing-reconcile` has been moved to the pgfix billing image and successful manual Jobs have been recorded after the COS zip/root prefix repair. The remaining billing blocker is not CronJob health; it is a live bill object containing complete v19 cost tags.

4. COS exact bill回补 has not been proven.
   The real bucket `opl-1410708315` is readable and root-level Tencent billing zip files can be parsed. The current latest parsed file has 1865 rows, but none of the rows contains complete `tenant_id / workspace_id / resource_order_id / run_id / server_plan_id` values, so no idempotent refund or makeup charge can be proven yet.

5. Full live user E2E is missing.
   The required path has not been captured end to end: create user, recharge, login Portal and OPL, buy storage, select a sellable SKU, preauth, provision, run OPL message, produce artifact, see trace/bill/file, download, delete server, stop pending cost.

6. PostgreSQL/Redis production cutover proof is complete for the v19 Portal gate.
   `portal-opl` was rolled to `opl-v19-portal-recovery-20260501-79051d7`, uses `PORTAL_STORAGE_MODE=postgres_redis`, references `portal-postgres-redis`, and passed real fixture self-bootstrap plus user, wallet, order, workspace file, trace, and session state equality across restart.

7. Live Tencent Cloud SKU quote is captured from production credentials and cloud `billing-aggregator-opl`.
   On 2026-05-01, the WSL2 live smoke used `tencent-billing-secret` and proved `source=tencent_cloud_live_catalog`, 80 discovered SKUs, 80 non-zero prices, and 35 orderable SKUs. The cloud Deployment was then updated to `opl-v19-live-gates-20260501-a438432` and returned `source=tencent_cloud_live_catalog`, 80 discovered SKUs, 80 non-zero prices, and 34 orderable SKUs. Evidence: `docs/reports/2026-05-01-OPL-v19-Live-SKU-Quote-Evidence.md`.

8. Sentrux quality does not meet the stricter v19 plan target.
   Current integrated branch is `quality_signal=6901` with `check_rules=pass`, but the v19 plan target was `quality_signal >= 6988`. Rules pass, but the stricter quality target is not satisfied.

9. Portal large-file structure is still a debt.
   `services/portal/src/app/portal-runtime.mjs` and `services/portal/src/state/portal-store.mjs` remain too large. Small mechanical extraction attempts lowered the Sentrux score, so this needs behavior-locked route/service extraction, not cosmetic splitting.

10. Live observability is incomplete.
    Entry health works, but commercial observability still needs live correlation across `tenantId`, `workspaceId`, `resourceOrderId`, `runId`, TKE, COS, ledger, Langfuse trace, and audit logs.

## P0 Checklist Before v19 Can Be Rolled

- [x] Fix `billing-reconcile` CronJob image and command so it runs the current reconcile path, not stale `opl-v14`.
- [x] Add or restore a dedicated live TKE create/delete cleanup script with `try/finally`.
- [x] Run live TKE create/delete cleanup and record no residual node pools, CVMs, AS groups, Pods, Jobs, or PVC artifacts.
- [x] Record partial live TKE evidence: labeled node pool create/delete cleanup and final no-residue proof.
- [x] Prove live TKE creates at least one matching CVM instance before cleanup.
- [x] Run live `/server-plans` discovery with Tencent Cloud credentials and prove `source=tencent_cloud_live_catalog`.
- [x] Prove sellable SKUs have non-zero prices and unsellable SKUs are disabled.
- [x] Build and deploy a cloud billing aggregator image containing the SKU stock-status fix before relying on the cloud `/server-plans` endpoint.
- [x] Confirm cloud Portal is running with `PORTAL_STORAGE_MODE=postgres_redis`.
- [ ] Run migration into TencentDB PostgreSQL and Redis without writing secrets into git or YAML.
- [x] Restart Portal Pod and prove Deployment readiness and `/healthz` recovery.
- [x] Prove user, wallet, order, workspace, file metadata, trace/session, and ledger state survive Portal restart with a real live fixture on current live Portal.
- [x] Rerun Portal restart recovery after `portal-opl` is on a v19 image.
- [ ] Run live COS reconcile when a real bill file contains complete v19 cost tags.
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
