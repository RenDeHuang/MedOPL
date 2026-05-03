# OPL v20 Deploy Secret Isolation And Live Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining OPL v20 deploy readiness work by isolating Tencent billing/COS/CloudAudit credentials, generating a non-committed TKE env, and passing live gates before any cloud push.

**Architecture:** Keep business modules already added for v20 intact. Add a small credential-normalization boundary so billing, resource provisioning, COS billing replay, and future CloudAudit consumption do not depend on one overloaded `TENCENT_CLOUD_SECRET_*` pair. Treat live deployment as a gated release path: render, build/push, apply, smoke, live E2E, then update v20 release notes.

**Tech Stack:** Node.js ESM scripts, Vue/TypeScript portal frontend, Kubernetes manifests, PowerShell TKE render/build scripts, Sentrux structural gate, kubectl, TCR.

---

### Task 1: Secret Naming Contract

**Files:**
- Modify: `adapters/billing-aggregator/src/billing-config.mjs`
- Modify: `adapters/resource-provisioner/src/config.mjs`
- Modify: `scripts/smoke-test-secret-hygiene-manifests.mjs`
- Test: add or extend a focused smoke test under `scripts/`

- [ ] **Step 1: Write the failing credential contract test**

Create `scripts/smoke-test-v20-tencent-secret-isolation-contract.mjs` asserting that billing code accepts `TENCENT_BILLING_SECRET_ID/KEY`, COS code accepts `TENCENT_COS_SECRET_ID/KEY`, and legacy `TENCENT_CLOUD_SECRET_ID/KEY` remains a compatibility alias only.

Run:

```bash
node scripts/smoke-test-v20-tencent-secret-isolation-contract.mjs
```

Expected: fail before implementation because billing/resource code does not fully recognize the new billing names.

- [ ] **Step 2: Implement credential normalization**

Add a focused helper in each adapter, or one shared helper only if the adapter dependency boundary already allows it. Required mapping:

```text
billing credential: TENCENT_BILLING_SECRET_ID/KEY, fallback TENCENT_CLOUD_SECRET_ID/KEY
resource provisioner credential: TENCENT_TKE_SECRET_ID/KEY if introduced, otherwise TENCENT_BILLING_SECRET_ID/KEY, fallback TENCENT_CLOUD_SECRET_ID/KEY
COS credential: TENCENT_COS_SECRET_ID/KEY, fallback TENCENT_CLOUD_SECRET_ID/KEY
CloudAudit credential: TENCENT_CLOUDAUDIT_SECRET_ID/KEY reserved, no runtime consumption until CloudAudit client exists
```

- [ ] **Step 3: Verify the contract**

Run:

```bash
node scripts/smoke-test-v20-tencent-secret-isolation-contract.mjs
```

Expected: pass.

### Task 2: Kubernetes Secret Template Isolation

**Files:**
- Modify: `deploy/tke-package/manifests/02-platform-secrets.example.yaml`
- Modify: `deploy/tke-package/manifests/05-platform-workloads.yaml`
- Modify: `deploy/tke-package/manifests/07-billing-reconcile-cronjob.yaml`
- Modify: `deploy/tke-package/env/tke.env.example`
- Modify: `deploy/tke-package/env/tke.env.tcr-gaofenglab.example`
- Test: `scripts/smoke-test-secret-hygiene-manifests.mjs`

- [ ] **Step 1: Write or update manifest assertions**

Update `scripts/smoke-test-secret-hygiene-manifests.mjs` so it checks:

```text
tencent-billing-secret contains TENCENT_BILLING_SECRET_ID/KEY
tencent-cos-secret contains TENCENT_COS_SECRET_ID/KEY
COS env references key TENCENT_COS_SECRET_ID/KEY, not TENCENT_CLOUD_SECRET_ID/KEY
legacy TENCENT_CLOUD_SECRET_ID/KEY is not required for COS secret injection
```

Run:

```bash
node scripts/smoke-test-secret-hygiene-manifests.mjs
```

Expected: fail before manifest edits.

- [ ] **Step 2: Update templates and examples**

Change the templates so Kubernetes secret names and env keys express the boundary:

```text
tencent-billing-secret -> TENCENT_BILLING_SECRET_ID/KEY
tencent-cos-secret -> TENCENT_COS_SECRET_ID/KEY
tencent-cloudaudit-secret -> TENCENT_CLOUDAUDIT_SECRET_ID/KEY, only if a consuming workload is added
```

Keep container env names stable where production code already expects them, but source them from the correct secret key.

- [ ] **Step 3: Verify manifest hygiene**

Run:

```bash
node scripts/smoke-test-secret-hygiene-manifests.mjs
```

Expected: pass.

### Task 3: Local TKE Env Generation

**Files:**
- Create local-only: `deploy/tke-package/env/tke.env`
- Do not commit: `/home/dev/.secrets/medopl/secrets.env.txt`
- Do not commit: `/home/dev/.secrets/medopl/kubeconfig`

- [ ] **Step 1: Generate a local env without printing secrets**

Use `/home/dev/.secrets/medopl/secrets.env.txt` as the input and `deploy/tke-package/env/tke.env.tcr-gaofenglab.example` as the base. Required local-only values:

```text
PORTAL_HOST=portal.medopl.cn
OPL_HOST=opl.medopl.cn
BASE_DOMAIN=medopl.cn
BUILD_SHA=opl-v20
all business images tagged with opl-v20
HARBOR_USERNAME from TCR_ID
HARBOR_PASSWORD from TCR_SECRET
TENCENT_BILLING_SECRET_ID/KEY from billing section
TENCENT_COS_SECRET_ID/KEY from COS section
TENCENT_CLOUDAUDIT_SECRET_ID/KEY from CloudAudit section
GFLABTOKEN from secrets file
```

- [ ] **Step 2: Fill values that cannot be inferred**

The operator must provide real values for:

```text
PORTAL_POSTGRES_URL
PORTAL_REDIS_URL
OPL_LAUNCH_SECRET
MED_AUTOSCIENCE_RUNNER_TOKEN
LANGFUSE_PUBLIC_KEY
LANGFUSE_SECRET_KEY
LANGFUSE_PROJECT_ID
TENCENT_CLOUD_TOKEN if the Tencent credentials require a session token
```

- [ ] **Step 3: Render manifests**

Run:

```bash
pwsh deploy/tke-package/scripts/render-tke-manifests.ps1 \
  -EnvFile deploy/tke-package/env/tke.env \
  -TemplateDir deploy/tke-package/manifests \
  -OutDir deploy/tke-package/rendered
```

Expected: render succeeds with no unresolved placeholders.

### Task 4: Runtime Upstream Integrity

**Files:**
- Create local-only: `.runtime/one-person-lab-upstream`
- Test: `scripts/check-one-person-lab-upstream-clean.mjs`

- [ ] **Step 1: Restore or clone upstream**

Use the exact upstream runtime:

```bash
git clone https://github.com/gaofeng21cn/one-person-lab .runtime/one-person-lab-upstream
```

If the directory is supplied by the operator instead, keep it at the same path.

- [ ] **Step 2: Verify clean upstream**

Run:

```bash
node scripts/check-one-person-lab-upstream-clean.mjs
```

Expected: pass and report the upstream runtime is clean.

### Task 5: Pre-Cloud Verification

**Files:**
- Existing v20 smoke tests under `scripts/`
- Existing portal/frontend source
- Existing Sentrux baseline `.sentrux/baseline.json`

- [ ] **Step 1: Run contract and regression tests**

Run:

```bash
node scripts/smoke-test-v20-lab-packages-contract.mjs
node scripts/smoke-test-v20-lab-subscription-billing-contract.mjs
node scripts/smoke-test-v20-lab-entitlements-contract.mjs
node scripts/smoke-test-v20-lab-package-routes-contract.mjs
node scripts/smoke-test-v20-portal-copy-contract.mjs
node scripts/smoke-test-v17-storage-entitlement.mjs
node scripts/smoke-test-v19-preauth-ledger-idempotency.mjs
node scripts/smoke-test-v19-commercial-ops-full-journey-contract.mjs
node scripts/check-v18-large-files.mjs
node scripts/check-v18-module-boundaries.mjs
npm --prefix services/portal run check
npm --prefix services/portal/frontend run typecheck
npm --prefix services/portal/frontend run build
sentrux gate .
```

Expected: all pass. `sentrux check .` may still fail on pre-existing baseline quality thresholds; `sentrux gate .` must not degrade.

### Task 6: Build, Push, Deploy, And Live Gate

**Files:**
- Existing: `deploy/tke-package/scripts/build-and-push-tcr.ps1`
- Existing: `deploy/tke-package/scripts/verify-tke-smoke.ps1`
- Existing: `scripts/live-test-v19-tke-create-delete-cleanup.mjs`
- Existing: `scripts/live-test-v19-cos-exact-bill-reconcile.mjs`
- Existing: `scripts/live-test-v19-postgres-redis-restart-recovery.mjs`
- Existing: `scripts/live-test-v19-user-e2e.mjs`

- [ ] **Step 1: Build and push images**

Run only after Docker/TCR login is confirmed:

```bash
export TCR_PASSWORD="$TCR_SECRET"
pwsh deploy/tke-package/scripts/build-and-push-tcr.ps1 -Tag opl-v20
```

Expected: all required images pushed with tag `opl-v20`.

- [ ] **Step 2: Apply rendered manifests**

Run:

```bash
kubectl --kubeconfig /home/dev/.secrets/medopl/kubeconfig apply -f deploy/tke-package/rendered
kubectl --kubeconfig /home/dev/.secrets/medopl/kubeconfig -n portal-staging rollout status deploy/portal --timeout=10m
kubectl --kubeconfig /home/dev/.secrets/medopl/kubeconfig -n portal-staging rollout status deploy/portal-opl-adapter --timeout=10m
kubectl --kubeconfig /home/dev/.secrets/medopl/kubeconfig -n portal-staging rollout status deploy/opl-web-gateway --timeout=10m
kubectl --kubeconfig /home/dev/.secrets/medopl/kubeconfig -n portal-staging rollout status deploy/billing-aggregator --timeout=10m
kubectl --kubeconfig /home/dev/.secrets/medopl/kubeconfig -n portal-staging rollout status deploy/med-autoscience-runner --timeout=10m
```

Expected: all rollouts complete.

- [ ] **Step 3: Run smoke and live gates**

Run:

```bash
pwsh deploy/tke-package/scripts/verify-tke-smoke.ps1 \
  -Namespace portal-staging \
  -PortalHost portal.medopl.cn \
  -OplHost opl.medopl.cn

RUN_TKE_LIVE=1 TKE_LIVE_KUBECONFIG=/home/dev/.secrets/medopl/kubeconfig node scripts/live-test-v19-tke-create-delete-cleanup.mjs
RUN_COS_LIVE=1 COS_LIVE_KUBECONFIG=/home/dev/.secrets/medopl/kubeconfig node scripts/live-test-v19-cos-exact-bill-reconcile.mjs
node scripts/live-test-v19-postgres-redis-restart-recovery.mjs
RUN_V19_LIVE_E2E=1 V19_LIVE_E2E_KUBECONFIG=/home/dev/.secrets/medopl/kubeconfig node scripts/live-test-v19-user-e2e.mjs
```

Expected: live E2E creates one user, recharges balance, logs into portal and OPL, creates storage-backed node/workspace, runs OPL messages and file task, verifies billing/session trace/workspace files, downloads output, deletes server, and observes billing stop.

### Task 7: v20 Release Summary

**Files:**
- Modify: `docs/releases/2026-05-03-OPL-v20-Update-Log.md`

- [ ] **Step 1: Update changelog with final verification**

Add the exact command list and pass/fail result for:

```text
secret isolation
manifest render
Sentrux gate
frontend typecheck/build
backend check
TKE smoke
TKE create/delete cleanup
COS exact bill replay
Postgres/Redis recovery
portal/OPL live E2E
```

- [ ] **Step 2: Final diff review**

Run:

```bash
git status --short --untracked-files=all
git diff --stat
git diff --check
```

Expected: no whitespace errors, no committed secret values, no unrelated lockfile churn.
