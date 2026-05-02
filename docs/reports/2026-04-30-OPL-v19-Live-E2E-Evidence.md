# OPL v19 Live E2E Evidence

Date: 2026-04-30
Branch: `codex/opl-v19`

## Evidence Captured In This Pass

### 2026-05-01 Live Gate Update

The original 2026-04-30 evidence is now stale for several gates. Current live state on 2026-05-01:

- `billing-aggregator-opl` is on `opl-v19-coszip-root-pgfix-20260501-79051d7`.
- `billing-reconcile` CronJob is on the same pgfix image and manual Job `billing-reconcile-manual-pgfix-20260501061659` completed successfully.
- `resource-provisioner-opl` is on `opl-v19-tke-disk-20260501-79051d7`.
- Live TKE create/delete cleanup passed for `test-ro-v19-0501h`; real CVM `ins-h4uz5mky` reached `RUNNING` and cleanup left no node pool, CVM, ASG, Pod, Job, or PVC residue.
- `portal-opl` is on `opl-v19-portal-recovery-20260501-79051d7`.
- Portal PostgreSQL/Redis restart recovery passed on v19 with fixture `test-v19-momjzcpx-abbc19`; user, wallet, order, workspace file, trace, and session snapshots matched before/after restart.
- Production entry health is still up after the partial live gate rollout: Portal health 200, OPL health 200, Trace health 200.

This section is superseded by the 2026-05-02 current-status report. The gate is now split into Step 5A/7A same-day evidence and Step 5B/7B T+1 evidence: same-day preauth, pending, cleanup, and full-user E2E have evidence, but T+1 exact settlement still requires a real COS zip row that can be attributed either by complete v19 tags or by a unique `ResourceId/InstanceId -> resource mapping` match. Step 9 is also split: Step 9A can only call the branch a `controlled live candidate`; Step 9B is required before `commercialization complete`.

### Read-Only Kubernetes Evidence

The provided kubeconfig still points at `https://medopl.cn`, which currently resets the Kubernetes API connection. The newer endpoint `lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443` reaches the TKE API when used as the kubectl server override.

Read-only cluster inspection showed:

- Platform Deployments are healthy, but still run `opl-v18` images.
- `opl-web-opl` remains on the upstream workbench image tag `opl-v1`.
- Langfuse web, worker, PostgreSQL, Redis, and ClickHouse pods are running.
- `billing-reconcile` CronJob still uses `billing-aggregator-opl:opl-v14`.
- Recent `billing-reconcile-*` Jobs are failing with exit code 1.
- The failing reconcile pod logs only showed `billing-aggregator listening on :0`, so the current CronJob command is not producing actionable reconcile output.

This means cloud is reachable, but v19 has not been rolled and the current exact-bill reconciliation job is unhealthy.

### Local And Contract Evidence

- Product compose contract passed.
- OPL login provider injection passed.
- OPL runtime provider redaction passed.
- OPL real message fixture path passed.
- OPL launch adapter fixture path passed.
- OPL WebSocket business-session check passed.
- SKU catalog live-shape smoke passed, but live credentials were not configured in this local worktree.
- Server plan pagination/filter smoke passed with four cards per page.
- Storage entitlement smoke passed.
- Workspace COS upload/download contract smoke passed.
- Runtime output storage gate smoke passed.
- Workspace delete retention smoke passed.
- Tenant RBAC matrix smoke passed.
- Preauth ledger idempotency smoke passed.
- T+1 refund and makeup settlement smoke passed.
- Unattributed bill queue smoke passed.

### Production Entry Evidence

Command:

```bash
node scripts/check-production-entry-performance.mjs --json
```

Observed:

- `https://portal.medopl.cn/healthz`: 200.
- `https://portal.medopl.cn/`: 302 to `/login`.
- `https://opl.medopl.cn/healthz`: 200.
- `https://opl.medopl.cn/`: 200.
- `https://trace.medopl.cn/api/public/health`: 200.
- `https://trace.medopl.cn/`: 200.

Latency signal:

- DNS below 20ms.
- First TCP below 35ms.
- TLS around 1.0-1.2s.
- Health TTFB around 1.3-1.55s.

## Evidence Not Captured Yet

- Step 5B/7B COS exact bill reconcile from a real bill row with complete v19 tags, or from a real bill row whose resource ID uniquely matches the platform resource mapping.
- Full live user E2E is now captured as Step 7A same-day evidence, but Step 7B T+1 bill evidence is still pending.
- Browser screenshot evidence for Portal workspace file, billing, and session trace pages.
- T+1 exact bill refund/makeup for the Step 4 tagged TKE resource.

## Required Live E2E Script Shape

The next live run must prove:

1. Create one test user.
2. Recharge the user.
3. Login to Portal and OPL as that user.
4. Select a sellable Silicon Valley SKU from the live Tencent Cloud catalog.
5. Buy at least 10GB storage.
6. Quote and preauth succeed.
7. TKE node pool is created with tags: `tenantid`, `workspaceid`, `runid`, `serverplanid`, `resourceorderid`.
8. OPL login requires gflabtoken API key.
9. OPL sends a real message and creates a run.
10. Runner produces an artifact.
11. Artifact metadata appears in Portal and object exists under the workspace COS prefix.
12. Portal shows workspace file, pending bill, and session trace.
13. User can download the artifact.
14. Delete server triggers scale-to-zero or node pool deletion.
15. Pending cost stops growing after deletion.
16. T+1 exact bill later produces charge, refund, or makeup charge, and the second reconcile proves idempotency.

## Rollout Gate

Do not call v19 commercialization complete until Step 5B/7B and Step 9B have evidence. Same-day evidence may only support controlled live candidate rollout language, and release, assessment, live evidence, and current status documents must use the same wording.
