# OPL v19 TKE Live Create/Delete Cleanup Evidence

Date:
Branch: `codex/opl-v19`
Script: `scripts/live-test-v19-tke-create-delete-cleanup.mjs`

## Preconditions

- `RUN_TKE_LIVE=1`
- `RESOURCE_PROVISIONING_ENABLED=1`
- Tencent Cloud credentials configured in shell only, not recorded here
- `TKE_LIVE_KUBECTL_BIN` points to the executable used by the script; in WSL this can be `/mnt/c/DockerDesktopBin/kubectl.exe`
- `TKE_LIVE_KUBECONFIG` path recorded, but kubeconfig token content not copied
- `TKE_LIVE_KUBE_SERVER_OVERRIDE` recorded when the kubeconfig server needs override; current required value: `https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443`

## Test Labels

- `TKE_LIVE_TENANT_ID=` `test-...`
- `TKE_LIVE_WORKSPACE_ID=` `test-...`
- `TKE_LIVE_RESOURCE_ORDER_ID=` `test-...`
- `TKE_LIVE_RUN_ID=` `test-...`
- `TKE_LIVE_SERVER_PLAN_ID=`

## Command

```bash
RUN_TKE_LIVE=1 \
RESOURCE_PROVISIONING_ENABLED=1 \
TKE_LIVE_TENANT_ID=test-... \
TKE_LIVE_WORKSPACE_ID=test-... \
TKE_LIVE_RESOURCE_ORDER_ID=test-... \
TKE_LIVE_RUN_ID=test-... \
TKE_LIVE_SERVER_PLAN_ID=... \
TKE_LIVE_INSTANCE_TYPE=... \
TKE_LIVE_KUBECTL_BIN=/mnt/c/DockerDesktopBin/kubectl.exe \
TKE_LIVE_KUBECONFIG='/mnt/c/Users/Administrator/Downloads/cls-ngiq693i-config (1)' \
TKE_LIVE_KUBE_SERVER_OVERRIDE=https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443 \
node scripts/live-test-v19-tke-create-delete-cleanup.mjs
```

If cleanup must be re-run:

```bash
RUN_TKE_LIVE=1 \
RESOURCE_PROVISIONING_ENABLED=1 \
TKE_LIVE_CLEANUP_ONLY=1 \
TKE_LIVE_TENANT_ID=test-... \
TKE_LIVE_WORKSPACE_ID=test-... \
TKE_LIVE_RESOURCE_ORDER_ID=test-... \
TKE_LIVE_RUN_ID=test-... \
TKE_LIVE_SERVER_PLAN_ID=... \
TKE_LIVE_NODE_POOL_ID=np-... \
TKE_LIVE_KUBECTL_BIN=/mnt/c/DockerDesktopBin/kubectl.exe \
TKE_LIVE_KUBECONFIG='/mnt/c/Users/Administrator/Downloads/cls-ngiq693i-config (1)' \
TKE_LIVE_KUBE_SERVER_OVERRIDE=https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443 \
node scripts/live-test-v19-tke-create-delete-cleanup.mjs
```

## Captured Evidence

- Evidence JSON path under `.runtime/resource-provisioner/live-tke-create-delete-cleanup/`
- `kubectlBinary=`
- Created `nodePoolId=`
- Create `requestId=`
- Node pool tags confirmed:
  - `tenantid=`
  - `workspaceid=`
  - `runid=`
  - `serverplanid=`
  - `resourceorderid=`
- Node pool labels confirmed:
  - `gaofenglab/tenant-id=`
  - `gaofenglab/workspace-id=`
  - `gaofenglab/run-id=`
  - `gaofenglab/server-plan-id=`
  - `gaofenglab/resource-order-id=`
- Matched CVM instances:
  - `instanceId=`
  - `status=`
  - `nodePoolId=`
- `kubectl get pods,jobs,pvc --all-namespaces -l ... -o json` summary:
  - before create:
  - after create:
  - after delete:

## Cleanup Result

- `scaleToZero requestId=`
- `deleteNodePool requestId=`
- Final node pool count: `0`
- Final matched instance count: `0`
- Final matched pod/job/pvc count: `0`

## Failure Notes

- If the script failed, paste:
  - `cleanupCommand`
  - `nodePoolId`
  - evidence JSON path
  - exact failing stage and error message
