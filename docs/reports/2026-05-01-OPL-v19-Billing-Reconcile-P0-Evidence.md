# OPL v19 Billing Reconcile P0 Evidence

日期：2026-05-01

工作区：`/home/dev/projects/platform-v19`

分支：`codex/opl-v19`

## 结论

`billing-reconcile` P0 已从“旧镜像且不可诊断失败”推进到“新镜像、显式一次性 reconcile 入口、可连 Portal PostgreSQL、手动 Job 成功完成”。

这不等于 v19 可滚云。它只关闭了账单 reconcile CronJob 健康这一项 P0 阻塞。live COS exact bill 归因、full user E2E、TKE cleanup、Portal restart recovery 等 P0 仍需继续验证。

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

## 当前仍未关闭的 P0

- live COS exact bill reconcile 还没有完成“可归因 daily bill -> exact ledger”的证据。
- full user E2E 还没有证明从 create 到 delete 到 T+1 exact bill 的闭环。
- TKE create/delete cleanup gate 还未真实运行。
- Portal PostgreSQL/Redis restart recovery gate 还未真实运行。
- v19 主服务仍未滚云，当前只修了 `billing-reconcile` CronJob。
