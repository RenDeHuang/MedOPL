# OPL v19 COS Exact Bill Reconcile Evidence Template

日期：
分支：`codex/opl-v19`
脚本：`scripts/live-test-v19-cos-exact-bill-reconcile.mjs`

## 前提

- 不在本文档记录任何 Secret 明文。
- 只允许真实 COS daily bill；不要使用本地伪造账单、fixture、sample 或手工拼接 payload。
- `billing-reconcile` endpoint 已可用，且其运行环境可直接读取目标 COS bill bucket。
- 目标账单至少包含一条完整标签的 exact bill，标签必须同时覆盖：
  - `resource_order_id`
  - `run_id`
  - `server_plan_id`
  - `tenant_id`
  - `workspace_id`

## 必填环境变量

```bash
RUN_COS_LIVE=1
COS_LIVE_BILLING_BASE_URL=https://...
COS_LIVE_EXPECT_TENANT_ID=...
COS_LIVE_EXPECT_WORKSPACE_ID=...
COS_LIVE_EXPECT_RESOURCE_ORDER_ID=...
COS_LIVE_EXPECT_RUN_ID=...
COS_LIVE_EXPECT_SERVER_PLAN_ID=...
```

以下二选一：

```bash
COS_LIVE_BILL_OBJECT_KEY=daily/...
```

或

```bash
COS_LIVE_BILL_BUCKET=...
COS_LIVE_BILL_REGION=...
COS_LIVE_BILL_PREFIX=daily/
COS_LIVE_BILL_ENDPOINT=...
```

可选：

```bash
COS_LIVE_RECONCILE_WINDOW=30d
COS_LIVE_TIMEOUT_MS=30000
```

## 执行命令

```bash
RUN_COS_LIVE=1 \
COS_LIVE_BILLING_BASE_URL=https://... \
COS_LIVE_EXPECT_TENANT_ID=... \
COS_LIVE_EXPECT_WORKSPACE_ID=... \
COS_LIVE_EXPECT_RESOURCE_ORDER_ID=... \
COS_LIVE_EXPECT_RUN_ID=... \
COS_LIVE_EXPECT_SERVER_PLAN_ID=... \
COS_LIVE_BILL_OBJECT_KEY=daily/... \
node scripts/live-test-v19-cos-exact-bill-reconcile.mjs
```

如果不用 `COS_LIVE_BILL_OBJECT_KEY`，则改为：

```bash
RUN_COS_LIVE=1 \
COS_LIVE_BILLING_BASE_URL=https://... \
COS_LIVE_EXPECT_TENANT_ID=... \
COS_LIVE_EXPECT_WORKSPACE_ID=... \
COS_LIVE_EXPECT_RESOURCE_ORDER_ID=... \
COS_LIVE_EXPECT_RUN_ID=... \
COS_LIVE_EXPECT_SERVER_PLAN_ID=... \
COS_LIVE_BILL_BUCKET=... \
COS_LIVE_BILL_REGION=... \
COS_LIVE_BILL_PREFIX=daily/ \
node scripts/live-test-v19-cos-exact-bill-reconcile.mjs
```

## 期望行为

- 未设置 `RUN_COS_LIVE=1` 时，脚本拒绝执行并返回非 0。
- 脚本先验证 `/billing/cos/status`、`/billing/cos/files`、`/billing/cos/reconcile`。
- 若目标账单只有 `unattributed`、没有完整标签 exact item，脚本明确失败。
- 目标 exact item 命中后，脚本连续调用两次 `/reconcile`：
  - 第一次必须对目标 `runId` 产生一次真实 settlement 动作：`charged` / `refund` / `makeup_charge`
  - 第二次不得再次对同一 `runId` 产生 settlement 动作
- 证据 JSON 写入 `.runtime/cos-exact-bill-reconcile/`
- 证据 JSON 不包含 Secret

## 记录项

- Billing base URL：
- COS bucket / region / prefix / endpoint：
- 指定 object key（如使用）：
- 目标：
  - `tenantId=`
  - `workspaceId=`
  - `resourceOrderId=`
  - `runId=`
  - `serverPlanId=`
- `/billing/cos/status`：
  - `readable=`
  - `latestFile.key=`
  - `latestFile.size=`
- `/billing/cos/files`：
  - `fileCount=`
- `/billing/cos/reconcile`：
  - `parsedRowCount=`
  - `attributedCount=`
  - `unattributedCount=`
  - 目标 `matchedItem.totalCost=`
- 第一次 `/reconcile`：
  - `targetResult.action=`
  - `exactCount=`
  - `resultsCount=`
- 第二次 `/reconcile`：
  - `targetResult.action=` 应为空
  - `exactCount=`
  - `resultsCount=`
- 证据文件路径：

## 失败记录

- 若失败于 `unattributed`，记录：
  - `unattributedCount`
  - 缺失标签统计
  - 示例 item 的缺失标签组合
- 若失败于第一次 reconcile 未结算，记录：
  - 目标 `runId`
  - 返回 `results`
  - `exactCount / estimatedCount / adjustmentCount`
- 若失败于第二次 reconcile 非幂等，记录：
  - 第二次返回的目标 `targetResult`
  - 第二次 `results`
