# Portal PostgreSQL/Redis Restart Recovery Evidence Template

Date:
Branch: `codex/opl-v19`
Script: `scripts/live-test-v19-postgres-redis-restart-recovery.mjs`

## Fixture Preconditions

Do not paste secret values into this file.

- Portal URL:
- Login mode: `oidc` or `local`
- Namespace: `default`
- Deployment: `portal-opl`
- Prepared user email:
- Workspace ID:
- Resource order ID:
- File relative path:
- Trace session ID:
- Optional workspace session ID:

The selected order, file metadata, and trace row should already exist and should not be changing while the restart gate is running.

## Required Environment Variables

```bash
RUN_PORTAL_RECOVERY_LIVE=1
PORTAL_BASE_URL=https://portal.medopl.cn
PORTAL_TEST_LOGIN=oidc
PORTAL_RECOVERY_USER_EMAIL=...
PORTAL_RECOVERY_USER_PASSWORD=...
PORTAL_RECOVERY_WORKSPACE_ID=...
PORTAL_RECOVERY_RESOURCE_ORDER_ID=...
PORTAL_RECOVERY_FILE_RELATIVE_PATH=...
PORTAL_RECOVERY_TRACE_SESSION_ID=...
PORTAL_RECOVERY_WORKSPACE_SESSION_ID=...
KUBECONFIG="/mnt/c/Users/Administrator/Downloads/cls-ngiq693i-config (1)"
KUBE_SERVER_OVERRIDE=https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443
```

## Run Shape

### 1. Read-only baseline only

```bash
RUN_PORTAL_RECOVERY_LIVE=1 \
PORTAL_RECOVERY_USER_EMAIL=... \
PORTAL_RECOVERY_USER_PASSWORD=... \
PORTAL_RECOVERY_WORKSPACE_ID=... \
PORTAL_RECOVERY_RESOURCE_ORDER_ID=... \
PORTAL_RECOVERY_FILE_RELATIVE_PATH=... \
PORTAL_RECOVERY_TRACE_SESSION_ID=... \
node scripts/live-test-v19-postgres-redis-restart-recovery.mjs
```

Expected result:

- Confirms `PORTAL_STORAGE_MODE=postgres_redis`.
- Confirms `portal-postgres-redis-secret` is referenced without reading secret values.
- Confirms `portal-postgres-redis-secret`, `secret-portal`, `secret-opl`, and `secret-trace` exist.
- Captures baseline user, wallet, order, file metadata, trace, and session evidence.

### 2. Manual restart in another terminal

Start the watcher first:

```bash
RUN_PORTAL_RECOVERY_LIVE=1 \
PORTAL_RECOVERY_EXPECT_POST_RESTART=1 \
PORTAL_RECOVERY_USER_EMAIL=... \
PORTAL_RECOVERY_USER_PASSWORD=... \
PORTAL_RECOVERY_WORKSPACE_ID=... \
PORTAL_RECOVERY_RESOURCE_ORDER_ID=... \
PORTAL_RECOVERY_FILE_RELATIVE_PATH=... \
PORTAL_RECOVERY_TRACE_SESSION_ID=... \
node scripts/live-test-v19-postgres-redis-restart-recovery.mjs
```

Then execute restart separately:

```bash
kubectl --kubeconfig "/mnt/c/Users/Administrator/Downloads/cls-ngiq693i-config (1)" \
  --server "https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443" \
  rollout restart deploy/portal-opl -n default

kubectl --kubeconfig "/mnt/c/Users/Administrator/Downloads/cls-ngiq693i-config (1)" \
  --server "https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443" \
  rollout status deploy/portal-opl -n default
```

### 3. Optional script-managed restart

Use only if the operator explicitly wants the script to issue the restart:

```bash
RUN_PORTAL_RECOVERY_LIVE=1 \
PORTAL_RECOVERY_EXPECT_POST_RESTART=1 \
PORTAL_RECOVERY_ALLOW_KUBECTL_RESTART=1 \
PORTAL_RECOVERY_USER_EMAIL=... \
PORTAL_RECOVERY_USER_PASSWORD=... \
PORTAL_RECOVERY_WORKSPACE_ID=... \
PORTAL_RECOVERY_RESOURCE_ORDER_ID=... \
PORTAL_RECOVERY_FILE_RELATIVE_PATH=... \
PORTAL_RECOVERY_TRACE_SESSION_ID=... \
node scripts/live-test-v19-postgres-redis-restart-recovery.mjs
```

## Evidence To Record

### Read-only preflight

- Deployment ready before restart:
- Portal container image:
- `PORTAL_STORAGE_MODE`:
- Portal container referenced secrets:
- Secret presence check:
  - `portal-postgres-redis-secret`
  - `secret-portal`
  - `secret-opl`
  - `secret-trace`
- Pod names and UIDs before restart:

### Baseline state before restart

- User:
  - `id`
  - `email`
  - `name`
  - `role`
  - `status`
- Wallet:
  - `balance`
  - `activeFreeze`
  - `availableBalance`
  - `trialRemaining`
- Resource order:
  - `id`
  - `status`
  - `workspaceId`
  - `runId`
  - `serverPlanId`
  - `storageSizeGb`
  - `quoteAmount`
  - `freezeAmount`
- File metadata:
  - `relativePath`
  - `storageKey`
  - `sizeBytes`
  - `status`
- Trace:
  - `sessionId`
  - `workspaceId`
  - `runId`
  - `businessStatus`
  - `dataSource`
- Session:
  - same `portal_session` cookie remains valid after restart
  - sessions API total
  - optional workspace session identity

### Post-restart state

- Pod names and UIDs after restart:
- Portal `/healthz` recovered:
- Same cookie still authenticates:
- User snapshot unchanged:
- Wallet snapshot unchanged:
- Order snapshot unchanged:
- File metadata unchanged:
- Trace snapshot unchanged:
- Session snapshot unchanged:

### Comparison result

- `matched=true`:
- Differences:

## Failure Notes

- Missing fixture data:
- Ambiguous resource order/file/trace selection:
- Cookie lost after restart:
- Deployment never rolled:
- Portal never returned healthy:
- Any other blocker:
