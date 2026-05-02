# OPL v19 Live Gates Current Status

日期：2026-05-02

分支：`codex/opl-v19`

当前 HEAD：`eb06918`

## 当前结论

v19 仍不能滚为正式商业化版本。

same-day live gate 已经完成 Step 5A/7A，但 Step 8A 产品 runtime 结构门禁仍未通过；T+1 completion gate 还必须等待 COS 日结 zip 出现同一条资源链的可归因账单行。2026-05-02 再次只读检查 COS 日账单时，Kubernetes API/LB 入口被远端关闭连接，暂时无法通过 `kubectl_exec` 读取新的 zip 或触发 Step 5B/7B。

本轮补充开发已把 Portal 发给 resource-provisioner 的资源映射输入补齐，并重新跑过 live Step 7A。新的 Step 7A 证据显示同一条 resourceOrder 的 TKE node pool、CVM、Kubernetes Job/Pod 和计费窗口已经写回 resource mapping，删除后 mapping 保留 `nodePoolIds`、`cvmInstanceIds`、`billingStartedAt`、`billingStoppedAt` 与 cleanup evidence。

## 已完成

- Step 2：`billing-reconcile` CronJob 健康 gate 已关闭，手动 Job 成功；最新 CronJob 也持续出现 Completed Job。
- Step 3：live SKU 非零报价已有证据，`cpu-2c4g` 非零价并可售。
- Step 4：live TKE create/delete cleanup 已有证据，资源无残留。
- Step 5A：same-day preauth/pending billing 已有证据。
- Step 6：Portal PostgreSQL/Redis restart recovery 已有证据。
- Step 7A：same-day full user E2E 已有证据，测试账户由脚本自动生成。

## Step 7A 目标链

- evidence：`.runtime/v19-live-e2e/2026-05-01T22-33-46-095Z-same_day.json`
- tenant：`87d0ce31-ae12-411d-8b6c-7c344c39be89`
- workspace：`test-v19-monhito4-55419e`
- resourceOrder：`dbb75dbe-bc46-426f-9987-808330219378`
- run：`test-run-test-v19-monhito4-55419e`
- serverPlan：`cpu-2c4g`
- node pool：`np-ao1bu42y`
- CVM：`ins-bei6axhy`

Step 7A 已确认：

- 自动创建测试用户、tenant、workspace。
- storage order 和 entitlement 生效。
- quote/preauth 成功。
- pending cost 为正：`0.004708433494`。
- exact bill 在同日保持 `exact_unavailable`。
- OPL run 成功并产生 artifact。
- TKE Job/Pod 带完整 `tenant_id/workspace_id/resource_order_id/run_id/server_plan_id` label。
- 新 CVM `ins-bei6axhy` 曾注册进目标 node pool，并且 resource mapping 持久化了该 CVM ID。
- TKE node pool/CVM 带腾讯云标签值：`tenantid/workspaceid/resourceorderid/runid/serverplanid`。
- 删除后 Kubernetes、node pool、CVM 无残留。
- 删除后 pending cost 在稳定窗口不增长。

现场修复记录：

- 第一次自动选择到 live catalog 的 `tencent-na-siliconvalley-1-MA5.MEDIUM16`，runner Pod 请求 `2 CPU / 16Gi`，但当前 8C16G 节点 allocatable memory 约 `13.5Gi`，Pod 永远无法调度。
- 已修复 `scripts/live-prepare-v19-portal-recovery-fixture.mjs` 的默认选择规则：没有显式 `PORTAL_RECOVERY_SERVER_PLAN_ID` 时，优先选 `tke_node_pool_create`、非零价格、带 CPU/内存 request 的可执行内测规格，避免盲选不可调度的 live catalog 第一项。
- 修复后自动选择 `cpu-2c4g`，成功创建 `np-ao1bu42y` 与 `ins-bei6axhy`，并完成 cleanup。

## 当前未完成

### Step 5B / Step 7B

COS 是日结账单，不能用同日 pending cost 代替 exact settlement。

下一次真实 zip 到达后，必须先只读 preview：

1. 确认 zip 中目标标签列是否有值。
2. 确认值是原始 ID，还是腾讯云云标签归一化值。
3. 用 Step 7A 的原始 ID 和云标签归一化值同时匹配目标账单行。
4. 如果标签列为空，检查账单行是否包含 `资源ID`、`ResourceId`、`InstanceId` 等云资源主键，并用平台 resource mapping 做唯一映射归因。只有唯一命中同一条 `tenant/workspace/resourceOrder/run/serverPlan` 时才允许 exact settlement；无映射、多映射、映射缺字段都必须保持 unattributed。
5. 命中目标行后再执行 exact reconcile、refund/makeup 和幂等验证。

2026-05-02 复查云上 `billing-aggregator-opl`：

- bucket：`opl-1410708315`
- region：`na-siliconvalley`
- prefix：空字符串，账单 zip 位于 bucket 根目录。
- 早期复查可读账单 zip：`100047070895-20260430-分账报表-明细账单.zip`
- `20260430` zip parsed row count：`1868`
- `20260430` zip attributed count：`0`
- `20260430` zip unattributed count：`1868`
- 标签列 `标签键:resourceorderid/runid/serverplanid/tenantid/workspaceid` 当前均为空或 `-`

追加复查：

- 已出现目标日期 zip：`100047070895-20260501-分账报表-明细账单.zip`
- 该 zip `lastModified`：`2026-05-01T20:49:24.000Z`
- Step 7A 资源链创建时间：`2026-05-01T22:30:17.546Z`
- Step 7A 资源链停止计费时间：`2026-05-01T22:33:08.472Z`
- live 脚本 evidence：`.runtime/cos-exact-bill-reconcile/2026-05-01T23-26-20-382Z.json`
- `httpTransport`：`kubectl_exec`
- parsed row count：`531`
- attributed count：`0`
- unattributed count：`531`
- matched item：`null`
- error：`exact_bill_target_not_attributed`

这说明 `20260501` zip 已经能读取，但不能证明 Step 7A 目标资源链的 exact settlement。原因是目标资源创建晚于该 zip 的投递时间，且该 zip 中没有 `ins-bei6axhy`、`np-ao1bu42y`、目标 `resourceOrderId`、目标 `runId` 或目标 workspace 的匹配行。该 zip 可以证明 reader/parser/unattributed queue 和 live gate 拒绝错误归因，不能证明 exact settlement。

目标匹配键：

```json
{
  "tenantId": "87d0ce31-ae12-411d-8b6c-7c344c39be89",
  "workspaceId": "test-v19-monhito4-55419e",
  "resourceOrderId": "dbb75dbe-bc46-426f-9987-808330219378",
  "runId": "test-run-test-v19-monhito4-55419e",
  "serverPlanId": "cpu-2c4g",
  "nodePoolId": "np-ao1bu42y",
  "cvmInstanceId": "ins-bei6axhy",
  "tagValues": {
    "tenantid": "87d0ce31ae12411d8b6c7c34",
    "workspaceid": "testv19monhito455419e",
    "resourceorderid": "dbb75dbebc46426f99878083",
    "runid": "testruntestv19monhito455",
    "serverplanid": "cpu2c4g"
  }
}
```

当前脚本已补齐匹配合同，避免只用原始 UUID/runId 导致无法匹配腾讯云截断标签。

当前本地已补齐并验证：COS preview/reconcile 可以指定具体 `COS_LIVE_BILL_OBJECT_KEY`，避免只读取 prefix 下最新非空 zip；billing 也已补齐资源 ID 到 resource mapping 的确定性归因合同。仍需要用真实 T+1 zip 复核 Step 7A 的 `ins-bei6axhy`、`np-ao1bu42y` 或其账单资源 ID 是否出现在账单资源 ID 字段中，并确认能唯一命中云上 resource mapping。

### Step 8A / Step 8B

当前整仓 Sentrux gate 仍失败。注意：`sentrux check .` 在当前仓库使用 `git ls-files`，未提交/未暂存的新模块不会进入结构图，因此新增模块落地后需要用临时全量 repo 或最终提交后的真实 index 复核。

当前工作区直接运行结果：

```text
sentrux check .
Quality: 6729
min_quality: 0.67 < 0.69
min_modularity: 0.6831 < 0.8000
```

将当前 working tree 全量复制到临时 repo、`git add -A` 后的评估结果也未通过：

```text
sentrux check /tmp/platform-v19-full-sentrux-*
Quality: 6648
min_quality: 0.66 < 0.69
min_modularity: 0.6921 < 0.8000
min_equality: 0.3488 < 0.3500
```

只复制产品源码（`services/portal/src`、`services/portal/frontend/src`、`services/opl-runtime-bridge/src`、`adapters/billing-aggregator/src`、`adapters/resource-provisioner/src`），排除 `node_modules`、`dist`、live/smoke 脚本后的临时评估也未通过：

```text
sentrux check /tmp/platform-v19-product-src-sentrux-*
Quality: 6734
min_quality: 0.67 < 0.69
min_modularity: 0.7243 < 0.8000
min_equality: 0.3279 < 0.3500
```

这说明 Step 8A 仍是 same-day rollout gate 的阻塞；阻塞不是单纯由 live/smoke 脚本纳入整仓图造成。

已完成的 Step 8 修复尝试：

- 抽出 `portal-admin-api-payloads.mjs`，并用合同测试锁住 admin payload。
- 抽出 `domain/portal-api-payloads.mjs`，并用合同测试锁住 portal API payload。
- 抽出 `routes/admin-api.routes.mjs`，并用 route 合同测试锁住 admin API 分发。
- 抽出 `routes/portal-api.routes.mjs`，并用 route 合同测试锁住 authenticated portal API 分发。
- 抽出 `portal-runtime-bootstrap.mjs` 和 `portal-page-payloads.mjs`，并用 contract 锁住 runtime bootstrap/page payload。
- 抽出 `portal-store-health.mjs`、`portal-store-migrations.mjs`、`portal-store-postgres-persistence.mjs`，把 `portal-store.mjs` 从 1006 行降到 371 行，并用 `smoke-test-portal-store-structure-contract.mjs`、`smoke-test-v19-portal-postgres-storage-upsert-contract.mjs` 锁住 health、migration、Postgres/Redis session、upsert 和 mirror JSON 合同。
- 抽出 OPL runtime bridge bootstrap/routes/runs 边界，并用 `smoke-test-opl-runtime-bridge-routes-contract.mjs`、`smoke-test-opl-runtime-bridge-bootstrap.mjs` 锁住 launch/bootstrap 基础合同。
- 抽出 billing HTTP routes 边界，并用 `smoke-test-billing-http-routes-contract.mjs` 锁住 billing HTTP 分发合同。
- 抽出 `portal-workspace-runtime.mjs` 和 `workspace-storage-upload-support.mjs`，把 task space、workspace session、run 聚合、policy、workspace storage snapshot 和 legacy `/portal/workspace/upload` 从 `portal-runtime.mjs` 收口，并修复 `handleUpload` 对 `readMultipartFiles` / `persistWorkspaceUpload` 的悬空引用；新增 `smoke-test-portal-workspace-runtime-contract.mjs` 和 `smoke-test-portal-legacy-workspace-upload-contract.mjs`。
- 抽出 `billing-metering-runtime.mjs`，把 billing 本地 runs 读取、workspace bytes、pending requested resource cost、OpenCost entries 汇总从 `billing-aggregator/src/server.mjs` 移出。
- 抽出 `tencent-billing-runtime.mjs`，把腾讯账单时间窗口切分和 `DescribeBillDetail` 查询从 `server.mjs` 移出，并新增 `smoke-test-billing-tencent-runtime-contract.mjs`。
- 抽出 `billing-server-runtime.mjs`，把 billing reconcile 状态、pending risk 列表、CLI usage、single reconcile、auto reconcile loop 从 `server.mjs` 移出，并新增 `smoke-test-billing-server-runtime-contract.mjs`。
- 抽出 `portal-identity-security-runtime.mjs`，把 Zitadel admin runner、OIDC token/userinfo 调用和 admin security summary 从 `portal-runtime.mjs` 移出，并新增 `smoke-test-portal-identity-security-runtime-contract.mjs`。
- 抽出 `portal-admin-portrait-payloads.mjs`，把 admin user/workspace/run portrait payload 从 `portal-admin-api-payloads.mjs` 移出，并新增 `smoke-test-portal-admin-portrait-payloads-contract.mjs`。

这些改动把 `billing-aggregator/src/server.mjs` 从 1081 行降到 521 行，把 `portal-runtime.mjs` 降到 718 行，把 `portal-admin-api-payloads.mjs` 从 636 行降到 461 行，并修复了 `portal-runtime.mjs` 的 workspace upload 悬空引用；相关 smoke 均通过。但它们仍没有把 product-src `min_modularity` 推过 `0.8000`。因此 Step 8A 仍未完成，Step 9A 仍不能执行。

Step 8B 新增补强：

- `scripts/live-test-v19-cos-exact-bill-reconcile.mjs` 新增 `COS_LIVE_HTTP_TRANSPORT=kubectl_exec`，可以通过 `kubectl exec deploy/billing-aggregator-opl` 在集群内访问 billing HTTP，不依赖本地 port-forward。
- 新增 `scripts/smoke-test-v19-cos-live-kubectl-transport-contract.mjs` 锁住 `kubectl_exec`、kubeconfig/server override、TLS bypass、billing deployment/namespace/port 和无 shell 插值调用。
- 20260501 zip 已用 `kubectl_exec` transport 跑出标准失败证据，未进入 `/reconcile` 写账本。

2026-05-02 的只读结构调查结论：

- `portal-runtime.mjs` 仍是总协调器。
- `portal-store.mjs` 已拆出 health、migration、Postgres persistence，但 Portal runtime / billing server / resource-order lifecycle 仍是主要结构热点。
- `resource-order.routes.mjs` 仍覆盖 internal callback、quote/freeze/provision、release/delete-node-pool 多条生命周期路径。
- `billing-aggregator/src/server.mjs` 仍是全仓库最大结构热点之一。

下一步应优先做真实能力边界拆分，而不是修改 `.sentrux/rules.toml` 或添加例外。

### Secret Hygiene

Secret hygiene 已补齐并验证。部署模板、tracked rendered 产物、env example 和 Portal recovery live 脚本都已收口到 scoped Secret 名称，不再保留旧的 `portal-platform-secrets`、旧 `portal-postgres-redis` 或旧 `tcr-pull-secret` 默认值。当前基线：

- Portal runtime Secret：`secret-portal`
- OPL Secret：`secret-opl`
- Trace Secret：`secret-trace`
- PostgreSQL/Redis Secret：`portal-postgres-redis-secret`
- Billing/COS Secret：`tencent-billing-secret`、`tencent-cos-secret`
- Provisioner Secret：`tencent-provisioner-secret`
- Image pull Secret：`gaofeng-tcr-key`

验证命令已通过：

```bash
node scripts/smoke-test-secret-hygiene-manifests.mjs
node scripts/smoke-test-billing-aggregator-postgres-env-contract.mjs
```

### Step 9A

Step 9A 单集群双节点池受控内测 rollout 当前仍不能执行。原因：

- Step 8A 产品 runtime 结构门禁仍未通过。
- 2026-05-02 COS daily check 依赖的 Kubernetes API/LB 当前不可达，`kubectl` 对 `https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443` 复现 `wsarecv: An existing connection was forcibly closed by the remote host` / `EOF`。
- Step 5B/7B 仍未命中覆盖 `2026-05-01T22:30:17Z` 到 `2026-05-01T22:33:08Z` 的 exact bill 行。

因此当前状态仍是 `controlled live candidate blocked`，不能写成已上云或商业化完成。

## 验证命令

```bash
node --check scripts/live-test-v19-user-e2e.mjs
node --check scripts/lib/v19-live-e2e-contract.mjs
node scripts/smoke-test-v19-user-e2e-contract.mjs
node scripts/smoke-test-resource-provisioner-contract.mjs
node scripts/smoke-test-resource-provisioner-resource-mapping-contract.mjs
node scripts/smoke-test-billing-resource-attribution.mjs
node scripts/smoke-test-billing-cos-zip-reader.mjs
node scripts/smoke-test-v19-cos-target-matching-contract.mjs
node scripts/smoke-test-v19-cos-live-kubectl-transport-contract.mjs
node scripts/smoke-test-portal-resource-order-attribution-contract.mjs
node scripts/smoke-test-portal-store-structure-contract.mjs
node scripts/smoke-test-portal-workspace-runtime-contract.mjs
node scripts/smoke-test-portal-legacy-workspace-upload-contract.mjs
node scripts/smoke-test-portal-runtime-entrypoint-contract.mjs
node scripts/smoke-test-portal-identity-security-runtime-contract.mjs
node scripts/smoke-test-portal-admin-portrait-payloads-contract.mjs
node scripts/smoke-test-v19-portal-postgres-storage-upsert-contract.mjs
node scripts/smoke-test-billing-http-routes-contract.mjs
node scripts/smoke-test-billing-server-entry-contract.mjs
node scripts/smoke-test-billing-server-runtime-contract.mjs
node scripts/smoke-test-billing-summary-runtime-contract.mjs
node scripts/smoke-test-billing-tencent-runtime-contract.mjs
node scripts/smoke-test-secret-hygiene-manifests.mjs
node scripts/check-v18-module-boundaries.mjs
node scripts/check-v18-large-files.mjs
sentrux check .
COS_LIVE_HTTP_TRANSPORT=kubectl_exec COS_LIVE_BILL_OBJECT_KEY='<target-zip>' RUN_COS_LIVE=1 node scripts/live-test-v19-cos-exact-bill-reconcile.mjs
```

## 需要用户帮助

当前不需要用户提供测试账户，脚本可以自动生成。

后续需要用户帮助的只有两类：

- 恢复 Kubernetes API/LB 入口连通性。当前 `kubectl --server https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443` 会被远端关闭连接；没有这个通道，无法继续每日 COS zip 检查、Step 5B/7B 或 Step 9A 云上 rollout。
- 等下一份能覆盖 `2026-05-01T22:30:17Z` 到 `2026-05-01T22:33:08Z` 的 COS 日结 zip 到达后，允许继续读取 `opl-1410708315` bucket 根目录 zip 做 Step 5B/7B。
- 如果决定不继续做更大结构拆分，需要用户明确批准修订 Step 8A/8B 门禁；在批准前不能把 Step 8A 写成通过。
