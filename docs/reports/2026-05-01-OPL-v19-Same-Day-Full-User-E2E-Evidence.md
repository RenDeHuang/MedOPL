# OPL v19 Same-Day Full User E2E Evidence

日期：2026-05-02

分支：`codex/opl-v19`

当前 HEAD：`eb06918`

## 结论

Step 5A same-day preauth/pending billing gate 和 Step 7A same-day full user E2E 已通过 live gate。

本次证据证明：脚本可自动创建测试用户、tenant、workspace，完成充值、storage 购买、live SKU 选择、quote/preauth、OPL run、artifact、trace、resourceOrder 到真实 TKE/CVM/Job/Pod 的绑定；billing same-day 返回正数 pending cost，exact bill 保持未结算状态；删除后 Kubernetes、TKE node pool、CVM 无残留，且 pending cost 在稳定窗口内不继续增长。

这仍不等于 v19 商业化完成。Step 5B/7B 仍必须等待 T+1 COS 日结 zip，且 zip 中必须出现本次同一条 `tenant/workspace/resourceOrder/run/serverPlan` 标签链的真实账单行后，才能验证 exact settlement、refund/makeup 和幂等。

## Live Gate

命令摘要：

```bash
RUN_V19_LIVE_E2E=1 \
V19_LIVE_E2E_PHASE=same_day \
V19_LIVE_E2E_PREPARE_FIXTURE=1 \
V19_LIVE_E2E_RUN_TKE_GATE=1 \
PORTAL_RECOVERY_SERVER_PLAN_ID=cpu-2c4g \
node scripts/live-test-v19-user-e2e.mjs
```

真实 kubeconfig/server 使用：

- kubeconfig：`/mnt/c/Users/Administrator/Downloads/cls-ngiq693i-config (1)`
- Kubernetes API server：`https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443`
- kubectl：`/mnt/c/DockerDesktopBin/kubectl.exe`
- server override 需要显式 `--insecure-skip-tls-verify=true`

Secret、密码和 token 没有写入本文档、git、日志或镜像。管理员凭据由 live Portal deployment 的运行环境注入本地 E2E 进程。

## Evidence

本地 evidence JSON：

- `.runtime/v19-live-e2e/2026-05-01T22-33-46-095Z-same_day.json`

fixture：

- `.runtime/portal/live-recovery-fixtures/test-v19-monhito4-55419e.json`

结果摘要：

```json
{
  "ok": true,
  "phase": "same_day",
  "warnings": [],
  "gates": {
    "recoveryBaseline": true,
    "tkeGate": true,
    "cos": false
  }
}
```

目标业务链：

```json
{
  "tenantId": "87d0ce31-ae12-411d-8b6c-7c344c39be89",
  "workspaceId": "test-v19-monhito4-55419e",
  "resourceOrderId": "dbb75dbe-bc46-426f-9987-808330219378",
  "runId": "test-run-test-v19-monhito4-55419e",
  "serverPlanId": "cpu-2c4g"
}
```

## 用户与 Portal 证据

自动生成测试账户：

- user/tenant id：`87d0ce31-ae12-411d-8b6c-7c344c39be89`
- email：`test-test-v19-monhito4-55419e@example.test`
- workspace：`test-v19-monhito4-55419e`
- resource order：`dbb75dbe-bc46-426f-9987-808330219378`
- run：`test-run-test-v19-monhito4-55419e`
- server plan：`cpu-2c4g`

Portal fixture 状态：

- storage file：`fixtures/test-v19-monhito4-55419e/input.txt`
- trace session：`test-run-test-v19-monhito4-55419e`
- workspace session：`561ff546-a25f-445e-bde4-ccb5776c9a91`
- trace count：`5`

OPL run 证据：

```json
{
  "runId": "test-run-test-v19-monhito4-55419e",
  "status": "succeeded",
  "artifactCount": 1,
  "artifact": {
    "name": ".keep",
    "objectKey": "med-autoscience/87d0ce31-ae12-411d-8b6c-7c344c39be89/test-v19-monhito4-55419e/outputs/.keep",
    "contentType": "application/octet-stream"
  }
}
```

## Billing Same-Day 证据

Step 5A 通过同一条业务链验证：

- `chargeBasis=pending`
- `source=metering_pending`
- `pendingSource=metering_pending`
- `exactSource=exact_unavailable`
- `exactTotal=0`
- target pending item count：`1`
- target pending total cost：`0.004708433494`
- pricing source：`k8s_requested_resources_pending`
- run start：`2026-05-01T22:30:17.747Z`
- run end：`2026-05-01T22:32:39Z`

删除前、删除后、稳定窗口后采样结果：

```json
{
  "beforeDelete": {
    "chargeBasis": "pending",
    "targetTotalCost": 0.004708433494,
    "exactSource": "exact_unavailable"
  },
  "afterCleanup": {
    "targetTotalCost": 0.004708433494
  },
  "stableAfterCleanup": {
    "targetTotalCost": 0.004708433494
  }
}
```

解释：

- same-day gate 只验证预扣、pending 和停止增长；不把 pending 当成最终扣费。
- exact settlement 必须等待 T+1 COS zip，不能用本地 pending cost 代替。

## TKE/CVM 绑定证据

Kubernetes selector：

```text
tenant_id=87d0ce31-ae12-411d-8b6c-7c344c39be89,workspace_id=test-v19-monhito4-55419e,resource_order_id=dbb75dbe-bc46-426f-9987-808330219378,run_id=test-run-test-v19-monhito4-55419e,server_plan_id=cpu-2c4g
```

删除前 Kubernetes 命中：

- Job：`default/med-autoscience-test-run-test-v19-monhito4-55419e`
- Pod：`default/med-autoscience-test-run-test-v19-monhito4-55419e-s4q2t`
- Pod 调度到新节点：`10.0.0.142`
- Job/Pod 均带完整 `tenant_id`、`workspace_id`、`resource_order_id`、`run_id`、`server_plan_id` 标签。

删除前云资源命中：

- TKE node pool：`np-ao1bu42y`
- CVM instance：`ins-bei6axhy`
- CVM status：`RUNNING`
- CVM private IP：`10.0.0.142`

节点标签：

```json
{
  "gaofenglab/node-pool-role": "runtime",
  "gaofenglab/tenant-id": "87d0ce31-ae12-411d-8b6c-7c344c39be89",
  "gaofenglab/workspace-id": "test-v19-monhito4-55419e",
  "gaofenglab/run-id": "test-run-test-v19-monhito4-55419e",
  "gaofenglab/server-plan-id": "cpu-2c4g",
  "gaofenglab/resource-order-id": "dbb75dbe-bc46-426f-9987-808330219378"
}
```

云资源 tagMap：

```json
{
  "tenantid": "87d0ce31ae12411d8b6c7c34",
  "workspaceid": "testv19monhito455419e",
  "resourceorderid": "dbb75dbebc46426f99878083",
  "runid": "testruntestv19monhito455",
  "serverplanid": "cpu2c4g"
}
```

## Cleanup 证据

脚本删除了匹配 Job，并通过 `resource-provisioner-opl` 删除 node pool：

- deleted node pool：`np-ao1bu42y`
- delete request id：`802d91b1-3131-464a-a90d-85d2a3811dcd`
- resource order final status：`deleted`
- billing stopped at：`2026-05-01T22:33:08.472Z`

资源映射最终状态：

```json
{
  "cleanupStatus": "deleted",
  "cleanupEvidenceId": "same-day-dbb75dbe-bc46-426f-9987-808330219378",
  "cleanupRemaining": {
    "nodePools": 0,
    "instances": 0,
    "pods": 0,
    "jobs": 0,
    "pvcs": 0,
    "cosKeys": 0
  }
}
```

最终复查：

```json
{
  "kubernetesFinalItemCount": 0,
  "nodePoolsRemaining": 0,
  "instancesRemaining": 0
}
```

## 现场阻塞与修复记录

本次 Step 7A 前置修复：

- `scripts/live-test-v19-user-e2e.mjs` 增加显式 `V19_LIVE_E2E_KUBE_INSECURE_SKIP_TLS_VERIFY=1` 支持，用于当前 TKE API LB endpoint。
- `resource-provisioner-opl` 重新构建并滚动到 `uswccr.ccs.tencentyun.com/gaofenglab/resource-provisioner-opl:opl-v19-step7a-resource-mapping-20260502-eb06918`，因为 live 容器原镜像缺少 `/resource-mappings` route。
- 第一次自动选择到 `tencent-na-siliconvalley-1-MA5.MEDIUM16`，Job 请求 `2 CPU / 16Gi`，在当前节点上 Pending；重跑时显式选择 `cpu-2c4g`，触发 `tke_node_pool_create` 并通过。
- 2026-05-02 追加修复：`scripts/live-prepare-v19-portal-recovery-fixture.mjs` 默认选择规则改为优先选 `tke_node_pool_create`、非零价格、带 CPU/内存 request 的可执行内测规格。未显式传 `PORTAL_RECOVERY_SERVER_PLAN_ID` 时不会再盲选 `MA5.MEDIUM16`。

## 验收状态

- [x] 自动创建测试用户、tenant、workspace。
- [x] 测试账户充值。
- [x] storage order 和 entitlement 生效。
- [x] live SKU 选择。
- [x] quote/preauth 生成 resource order 和 freeze。
- [x] pending billing cost 为正。
- [x] exact billing 保持 T+1 未结算状态。
- [x] OPL run 成功并产生 artifact。
- [x] Portal 可读取 workspace file、resource order、trace/session。
- [x] TKE Job/Pod 与同一条业务链绑定。
- [x] TKE node pool 与 CVM 与同一条业务链绑定。
- [x] 删除后 Kubernetes、node pool、CVM 无残留。
- [x] 删除后 pending cost 在稳定窗口内不增长。
- [ ] 目标链可归因 COS exact bill 尚未出现。`100047070895-20260501-分账报表-明细账单.zip` 已可读，但该 zip 未命中本次业务链标签、`ins-bei6axhy` 或 `np-ao1bu42y`。
- [ ] exact settlement、refund/makeup、幂等仍未验证。

## 当前限制

本次 Step 5A/7A 证明了 full user same-day 链路、pending billing 和 cleanup。Step 5B/7B 必须等能覆盖本次资源运行窗口并可唯一归因的真实 COS 日结 zip。当前 Step 8A 产品 runtime 结构门禁仍未通过，因此 same-day rollout gate 仍不能封版为可上云。
