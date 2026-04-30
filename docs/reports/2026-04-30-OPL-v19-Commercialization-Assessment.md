# OPL v19 Commercialization Assessment

Date: 2026-04-30
Branch: `codex/opl-v19`

## Verdict

v19 is closer to a commercial operations candidate, but it is not yet a formal production SaaS release.

Current readiness estimate:

- Architecture direction: 75%.
- Product boundary: 65%.
- Docker local appliance: 60%.
- Commercial operations readiness: 45%.
- Formal production SaaS readiness: 30%.

The main reason is evidence: the local commercial chain has stronger smoke coverage now, but live cloud evidence is still incomplete.

## What Is Commercially Meaningful Now

- OPL message path is no longer only a UI demo. The smoke path creates a run, resource order, trace record, pending cost, and artifact.
- Storage is treated as a product entitlement: disabled by default, minimum 10GB, upload/output blocked before purchase.
- Server SKU selection is shaped around real Tencent Cloud catalog fields rather than hand-written CPU/memory combinations.
- Ledger has the right operational states: `topup`, `preauth_hold`, `pending_usage`, `exact_resource_charge`, `preauth_release`, `refund`, `makeup_charge`, and `manual_adjustment`.
- RBAC scope testing exists for user-owned resources and admin visibility.
- Product compose now has PostgreSQL and Redis in the default product profile.

## Remaining Commercial Gaps

### P0 Before Paid Trial

- Run live TKE create/delete cleanup with `RUN_TKE_LIVE=1` and prove no node pool or CVM residue remains.
- Run live COS daily bill reconcile when a real `daily/` file exists.
- Complete one live user E2E: create user, top up, buy storage, choose sellable SKU, preauth, provision, OPL send message, artifact return, trace visible, download file, delete server, pending stops.
- Roll Portal to `PORTAL_STORAGE_MODE=postgres_redis` only after migration and restart recovery evidence.
- Capture a live `/server-plans` response where `source=tencent_cloud_live_catalog` and prices are non-zero.

### P1 Before Public Trial

- Raise Sentrux quality back to the v19 plan target or explicitly revise the gate. Current branch passes `.sentrux/rules.toml` at `6901`, but the plan target says `6988`.
- Break down `services/portal/src/app/portal-runtime.mjs` and `services/portal/src/state/portal-store.mjs` with behavior locks first. Small mechanical splits lowered Sentrux score, so this needs a larger route/service extraction, not cosmetic movement.
- Add recovery scripts for failed preauth, failed provision, failed artifact upload, and missing exact bill.
- Add admin audit views for every privileged read/write action.
- Add backup/restore proof for PostgreSQL, Redis, and COS metadata.

### P2 Before Production SaaS

- External security review and image scanning.
- CAM least-privilege audit with proof.
- Capacity and load testing for Portal, Gateway, Adapter, Billing, and Langfuse ingestion.
- Incident runbooks and rollback drills.
- Organization-level RBAC beyond the current minimal tenant/user/admin contract.
- Payment, invoice, and tax flows if moving beyond manual recharge.

## Performance Assessment

Production entry health is reachable:

- `portal.medopl.cn/healthz`: 200.
- `opl.medopl.cn/healthz`: 200.
- `trace.medopl.cn/api/public/health`: 200.

Measured from this environment:

- DNS is fast, usually below 20ms.
- TCP is acceptable, usually below 35ms on first connect.
- TLS is slow, around 1.0-1.2s.
- Health endpoint TTFB is around 1.3-1.55s.

The current slowness is therefore mainly HTTPS/TLS/CLB and backend first-byte latency, not DNS. OPL page HTML itself returned in about 337ms after connection reuse.

Recommended next optimization:

- Keep Gateway static fast path and WebSocket 101 checks.
- Enable CDN only if asset P95 remains above 5s after static caching and gzip.
- Add continuous entry performance monitoring in CI or a scheduled job.
- Tune CLB certificate/session reuse and backend Pod requests/limits before adding more infrastructure.

## Production Decision

Do not roll v19 as a paid production release yet.

It is reasonable to continue as an internal or controlled commercial trial candidate after live cloud gates pass. The strongest next proof is not more UI work; it is one clean live order from quote to deletion with no residual cloud resources and auditable ledger output.
