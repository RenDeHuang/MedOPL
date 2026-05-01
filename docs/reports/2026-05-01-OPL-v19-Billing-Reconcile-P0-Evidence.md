# OPL v19 Billing Reconcile P0 Evidence

日期：2026-05-01

工作区：`/home/dev/projects/platform-v19`

分支：`codex/opl-v19`

## 结论

`billing-reconcile` P0 已从“旧镜像且不可诊断失败”推进到“新镜像、显式一次性 reconcile 入口、可连 Portal PostgreSQL、手动 Job 成功完成”。

这不等于 v19 可滚云。它只关闭了账单 reconcile CronJob 健康这一项 P0 阻塞。live COS exact bill 归因、full user E2E、TKE cleanup、Portal restart recovery 等 P0 仍需继续验证。

2026-05-01 追加验证：`billing-aggregator-opl` Deployment 为 Step 3 live SKU 修复滚动到 `opl-v19-live-gates-20260501-a438432` 后，`billing-reconcile` CronJob 也同步到同一镜像，并再次创建手动 Job 成功完成。该追加验证证明 SKU 修复镜像没有破坏一次性 reconcile 入口。

2026-05-01 二次追加验证：COS zip/root prefix 修复镜像 `opl-v19-coszip-root-20260501-79051d7` 暴露出 Dockerfile 没有安装 `pg` 依赖，手动 Job 启动时报 `ERR_MODULE_NOT_FOUND`。当前工作区已修复 `adapters/billing-aggregator/Dockerfile`，新增 Dockerfile dependency smoke，构建并推送 `opl-v19-coszip-root-pgfix-20260501-79051d7`。Deployment 与 CronJob 已切到该镜像，手动 Job `billing-reconcile-manual-pgfix-20260501061659` 已成功完成。至此 Step 2 的 CronJob 健康 gate 重新关闭；剩余阻塞转移到 Step 5 的真实账单标签归因。

## 本次修复

- 代码提交：`17b6e03 Fix v19 billing reconcile one-shot entry`
- 镜像：`uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl:opl-v19-billing-reconcile-20260501-17b6e03`
- 镜像 digest：`sha256:9b998bbade24adf7271874f8908dd77a3b31a978438627240335dc480e0d6b5c`
- CronJob：`default/billing-reconcile`
- 命令：`node src/server.mjs reconcile`
- Secret 引用：
  - `tencent-billing-secret`
  - `portal-postgres-redis`

## 本地验证

已通过：

```bash
node --check adapters/billing-aggregator/src/server.mjs
node --check adapters/billing-aggregator/src/ledger-contract.mjs
node --check scripts/smoke-test-v19-billing-reconcile-cli.mjs
node scripts/check-v18-module-boundaries.mjs
node scripts/smoke-test-v19-billing-reconcile-cli.mjs
node scripts/smoke-test-v19-preauth-ledger-idempotency.mjs
node scripts/smoke-test-v19-t1-settlement-refund.mjs
node scripts/smoke-test-v19-t1-settlement-makeup.mjs
node scripts/smoke-test-v19-unattributed-bill-queue.mjs
node scripts/smoke-test-billing-exact-only-settlement.mjs
node scripts/smoke-test-no-legacy-billing-paths.mjs
npm --prefix adapters/billing-aggregator run check
```

关键行为：

- `node src/server.mjs reconcile` 不启动 HTTP server。
- `BILLING_RECONCILE_ONCE=1` 走同一条一次性 reconcile 路径。
- Billing 不 import `services/portal/src/**`，模块边界通过。
- exact settlement 使用 `exact_resource_charge`、`refund`、`makeup_charge`，并带 `idempotency_key`。
- 没有 exact bill 时不写最终扣费，只保留 `pending_exact_bill`。

## 云上验证

### 第一次手动 Job

Job：`billing-reconcile-manual-v19-20260501-0124`

结果：失败。

已确认：

- 新镜像拉取成功。
- 命令已变为 `node src/server.mjs reconcile`。
- 失败原因可诊断：CronJob 未注入 `PORTAL_POSTGRES_URL`，进程尝试连接默认 `127.0.0.1:5432`。

日志摘要：

```text
Error: connect ECONNREFUSED 127.0.0.1:5432
```

处理：

- 确认 `portal-postgres-redis` Secret 存在，且包含 `PORTAL_POSTGRES_URL`、`PORTAL_REDIS_URL` 两个 key。
- 将 `portal-postgres-redis` 加入 `billing-reconcile` CronJob `envFrom`。

### 第二次手动 Job

Job：`billing-reconcile-manual-v19-20260501-0129`

结果：成功。

状态：

```text
Complete 1/1
```

Pod：

```text
billing-reconcile-manual-v19-20260501-0129-6q24f Completed
```

日志摘要：

```json
{
  "settlementMode": "exact_only",
  "reconciledCount": 0,
  "exactCount": 0,
  "estimatedCount": 0,
  "adjustmentCount": 0,
  "unattributedItemCount": 9,
  "unattributedRunCount": 9,
  "resultsCount": 0
}
```

解释：

- CronJob 已能运行并成功退出。
- 真实腾讯云账单可读取，但当前账单行缺少完整 `resource_order_id / run_id / server_plan_id / tenant_id / workspace_id` 标签，进入 unattributed 路径。
- 本次没有生成用户级 exact charge、refund 或 makeup charge；这符合“缺完整标签不扣用户”的规则。

### 自动 CronJob

Job：`billing-reconcile-29626170`

调度时间：`2026-05-01 01:30:00 +08:00`

结果：成功。

状态：

```text
Complete 1/1
```

日志摘要：

```json
{
  "settlementMode": "exact_only",
  "reconciledCount": 0,
  "exactCount": 0,
  "estimatedCount": 0,
  "adjustmentCount": 0,
  "unattributedItemCount": 9,
  "resultsCount": 0
}
```

解释：

- CronJob 自然调度已经使用新镜像和显式 `reconcile` 入口。
- CronJob 可成功读取 Portal PostgreSQL 配置并完成一次对账。
- 当前真实账单仍缺完整成本标签，因此只证明 CronJob 健康和 unattributed 路径，不证明可归因 exact settlement。

### SKU 修复镜像后的手动 Job

- 镜像：`uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl:opl-v19-live-gates-20260501-a438432`
- Digest：`sha256:b94619825c7a3d8c38e86baa416e014b2e947b9096fba284745108411f1aea89`
- CronJob：`default/billing-reconcile`
- Command：`["node","src/server.mjs","reconcile"]`
- `envFrom`：
  - `tencent-billing-secret`
  - `portal-postgres-redis`
- Job：`billing-reconcile-manual-v19-20260501-0105`
- Completion：`2026-05-01T01:06:34Z`
- Succeeded：`1`

日志结论：

- Job 成功完成。
- `settlementMode` 仍为 `exact_only`。
- 返回 `results=[]`。
- 账单条目仍以 `tencent_cloud_bill_unattributed` 为主，说明真实云资源还缺完整业务归因标签。

### COS zip/root prefix pgfix 镜像后的手动 Job

- 根因：`adapters/billing-aggregator/Dockerfile` 只复制 `package.json` 和 `src`，没有执行 `npm ci --omit=dev`，因此镜像内缺少 `pg`。
- 修复：Dockerfile 改为复制 `package*.json` 并安装生产依赖；新增 `scripts/smoke-test-billing-aggregator-dockerfile-deps.mjs` 锁定该构建要求。
- 镜像：`uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl:opl-v19-coszip-root-pgfix-20260501-79051d7`
- Digest：`sha256:1b0bfb64ae53dfbab347ceaa3a4bc0cd996c3a2a3800f5d22e90f3d0d7e286fa`
- Deployment rollout：`deployment/billing-aggregator-opl` 成功。
- CronJob：`default/billing-reconcile` 已切到同一镜像。
- Job：`billing-reconcile-manual-pgfix-20260501061659`
- 结果：`Complete`，`succeeded=1`。

验证命令：

```bash
node scripts/smoke-test-billing-aggregator-dockerfile-deps.mjs
docker run --rm uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl:opl-v19-coszip-root-pgfix-20260501-79051d7 node -e "require('pg'); console.log('pg import ok')"
kubectl -n default rollout status deployment/billing-aggregator-opl --timeout=180s
kubectl -n default create job --from=cronjob/billing-reconcile billing-reconcile-manual-pgfix-20260501061659
kubectl -n default wait --for=condition=complete job/billing-reconcile-manual-pgfix-20260501061659 --timeout=180s
kubectl -n default logs job/billing-reconcile-manual-pgfix-20260501061659 --tail=200
```

日志结论：

- Job 已能加载 `pg` 并成功退出。
- 当前真实账单仍无完整 v19 成本标签，因此没有用户级 exact settlement；未归因账单继续进入 unattributed 路径。

## 当前仍未关闭的 P0

- live COS exact bill reconcile 还没有完成“可归因 daily bill -> exact ledger”的证据。
- full user E2E 还没有证明从 create 到 delete 到 T+1 exact bill 的闭环。
- TKE create/delete cleanup gate 仍在 live 验证中。
- Portal PostgreSQL/Redis restart recovery 已在 v18 live 上预演通过，但 v19 Portal 尚未上云，不能记为 Step 6 通过。
- v19 主服务仍未滚云，当前只修了 `billing-reconcile` CronJob。
