# Portal PostgreSQL/Redis Restart Recovery Evidence

Date: 2026-05-01
Branch: `codex/opl-v19`
Model: `gpt-5.4`
Script reviewed: `scripts/live-test-v19-postgres-redis-restart-recovery.mjs`
Kubernetes access: `C:\DockerDesktopBin\kubectl.exe` with server override `https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443`

## Scope

This pass executed the authorized Portal deployment restart only. It did not roll a new image and did not modify the Deployment spec.

This pass does not claim full Step 6 acceptance, because the required live user fixture and login credentials were not available in the current environment. The recovery script Secret-name mismatch found during this pass has been fixed in the current worktree.

## Read-only Preflight

- Query time: `2026-05-01T10:05:00+08:00`
- Namespace: `default`
- Deployment: `portal-opl`
- Image: `uswccr.ccs.tencentyun.com/gaofenglab/portal-opl:opl-v18`
- Deployment selector:
  - `k8s-app=portal-opl`
  - `qcloud-app=portal-opl`
- Deployment status after rollout:
  - `observedGeneration=40`
  - `readyReplicas=1`
  - `updatedReplicas=1`
  - `availableReplicas=1`
  - `Progressing=True`
  - `Available=True`

### Portal env / secret references

- `PORTAL_STORAGE_MODE=postgres_redis`
- `PORTAL_POSTGRES_URL -> secretKeyRef portal-postgres-redis / PORTAL_POSTGRES_URL`
- `PORTAL_REDIS_URL -> secretKeyRef portal-postgres-redis / PORTAL_REDIS_URL`
- Additional secretKeyRef observed:
  - `LANGFUSE_PUBLIC_KEY -> langfuse-client-keys / LANGFUSE_PUBLIC_KEY`
  - `LANGFUSE_SECRET_KEY -> langfuse-client-keys / LANGFUSE_SECRET_KEY`
- `envFrom` secret references on the first Portal container: none

### Secret presence check

- Present:
  - `portal-postgres-redis`
  - `secret-portal`
  - `secret-opl`
  - `secret-trace`
- Not found:
  - `portal-postgres-redis-secret`

### Script/template alignment result

The reviewed recovery assets were not aligned with the live cluster at the start of this pass:

- The evidence template expected `portal-postgres-redis-secret`.
- `scripts/live-test-v19-postgres-redis-restart-recovery.mjs` hard-coded `portal-postgres-redis-secret` in `defaultSecretNames` and in the `databaseSecretReferenced` assertion path.
- Live `portal-opl` currently references `portal-postgres-redis`, and no `portal-postgres-redis-secret` exists in `default`.

Current worktree fix:

- `scripts/live-test-v19-postgres-redis-restart-recovery.mjs` now defaults to `portal-postgres-redis`.
- `PORTAL_RECOVERY_DATABASE_SECRET_NAME` can override the database Secret name.
- `PORTAL_RECOVERY_KUBECTL_BIN` can point to Windows `kubectl.exe` from WSL2.

This removes the preflight mismatch. Full Step 6 is still blocked by missing live fixture inputs.

## Restart Execution

### Commands executed

```bash
cmd.exe /c C:\DockerDesktopBin\kubectl.exe --kubeconfig "C:\Users\Administrator\Downloads\cls-ngiq693i-config (1)" --server "https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443" -n default rollout restart deploy/portal-opl

cmd.exe /c C:\DockerDesktopBin\kubectl.exe --kubeconfig "C:\Users\Administrator\Downloads\cls-ngiq693i-config (1)" --server "https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443" -n default rollout status deploy/portal-opl --timeout=600s
```

### Before restart

- Pod: `portal-opl-77547886df-j9k2z`
- UID: `d6286eae-9e21-40cb-b8e7-5782f79dfa74`
- Phase: `Running`
- Container ready: `true`
- Restart count: `0`
- External health:
  - `https://portal.medopl.cn/healthz -> 200`

### After restart

- Rollout status: success
- New Pod: `portal-opl-dd5f59db5-jpnmw`
- New UID: `71e4766c-c426-4438-bb16-305d2ccf1fbb`
- Phase: `Running`
- Container ready: `true`
- Restart count: `0`
- External health recovered:
  - `https://portal.medopl.cn/healthz -> 200`

### Infra-level comparison

- Pod replaced: `true`
- Deployment ready after restart: `true`
- Portal `/healthz` available after restart: `true`
- Image changed: `false`
- Deployment config intentionally modified in this pass: `false`

## Missing Live Fixture Evidence

The following Step 6 acceptance items were not verifiable in this pass:

- Same authenticated `portal_session` cookie remains valid after restart
- User snapshot unchanged
- Wallet snapshot unchanged
- Resource order snapshot unchanged
- Workspace file metadata unchanged
- Trace snapshot unchanged
- Session snapshot unchanged

Reason:

- Required live fixture inputs were not present in the current environment:
  - `PORTAL_RECOVERY_USER_EMAIL`
  - `PORTAL_RECOVERY_USER_PASSWORD`
  - `PORTAL_RECOVERY_WORKSPACE_ID`
  - `PORTAL_RECOVERY_RESOURCE_ORDER_ID`
  - `PORTAL_RECOVERY_FILE_RELATIVE_PATH`
  - `PORTAL_RECOVERY_TRACE_SESSION_ID`
  - optional `PORTAL_RECOVERY_WORKSPACE_SESSION_ID`
- No validated live fixture manifest for one stable user/order/file/trace tuple was available in the repository.
- The recovery script Secret-name mismatch has been fixed in the current worktree, but no fixture was available to complete the state comparison.

## Conclusion

- Cluster-level Portal restart recovery was executed successfully:
  - rollout restart completed
  - Pod UID changed
  - Deployment returned to ready
  - external `/healthz` returned `200`
- Full Step 6 live gate is still **not passed**.
- Remaining blockers are:
  1. provide one stable live recovery fixture and login credentials through runtime environment only
  2. rerun the script to capture before/after user, wallet, order, file, trace, and session consistency
