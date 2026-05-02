# OPL v19 Commercial Ops Full User Journey 实现/验证包开发记录

日期：2026-05-02

分支：`codex/opl-v19`

## Goal

交付一个 v19 商业化运营候选的完整用户链路实现/验证包：补齐 L3 明细账单当天 exact settlement 代码和测试，然后用一名新建用户跑 live journey，并把充值、资源创建、OPL 工作、文件、trace、账单、删除、L3 结算证据写入报告。

本包不新增 Portal 在线支付。收款模式固定为：客户线下转账，运营方确认到账后在 Portal 后台手动充值；Portal 负责余额、冻结、扣费、退款、补扣、流水和账单解释。

## 非目标

- 不修改 `https://github.com/gaofeng21cn/one-person-lab` 上游 runtime。
- 不把 COS signed URL、`q-ak`、`q-signature`、`x-cos-security-token`、Secret 或 token 写入 git、报告、日志。
- 不把 pending/OpenCost/local metering 当成 exact 扣费依据。
- 不接入微信、支付宝、Stripe、银行卡回调或自动支付入账。
- 不绕过唯一归因要求；无唯一归因的账单行必须保持 unattributed。

## 并行分工

- `Fermat`，模型：`gpt-5.3-codex`，角色：worker，负责 L3 billing exact settlement 实现和测试。
- `Huygens`，模型：`gpt-5.4-mini`，角色：explorer，只读梳理 Portal/OPL full user journey 现有入口、证据脚本和缺口。
- `Rawls`，模型：`gpt-5.4-mini`，角色：explorer，只读检查 resource-provisioner、CVM、存储、PVC/COS key 的标签与 resource mapping 覆盖情况。

## 要开发的内容

### 1. L3 明细账单 exact settlement

文件范围：

- `adapters/billing-aggregator/src/tencent-billing-runtime.mjs`
- `adapters/billing-aggregator/src/tencent-bill-summary.mjs`
- `adapters/billing-aggregator/src/billing-config.mjs`
- `adapters/billing-aggregator/src/reconcile-service.mjs`
- `adapters/billing-aggregator/src/server.mjs`
- `scripts/smoke-test-billing-tencent-runtime-contract.mjs`
- `scripts/smoke-test-billing-tencent-bill-summary.mjs`
- 可新增 `scripts/smoke-test-v19-l3-billing-*.mjs`

必须实现：

- `DescribeBillDetail` 是当天 exact settlement 主来源。
- 新增 `L3_EXACT_WAIT_MINUTES`，默认 `120`。
- 对已完成并删除的资源，只有当前时间达到 `billingStoppedAt + L3_EXACT_WAIT_MINUTES` 后才允许写 exact ledger。
- 未到窗口时返回 `pending_l3_settlement_window`，不写 `exact_resource_charge`、`refund`、`makeup_charge`。
- L3 查询窗口使用 `billingStartedAt` 到 `billingStoppedAt + 120min`。
- L3 分页必须完整；如果触达 `TENCENT_BILLING_MAX_PAGES` 仍未拉完，必须失败，不能用部分账单扣费。
- L3 账单行优先使用标签归因；标签缺失或无效时复用 `resource-attribution.mjs` 的 `ResourceId/InstanceId -> resource mapping` 唯一归因。
- L3 source id 使用 `tencent_l3_bill:<resourceOrderId 或 runId>`，避免和 COS T+1 replay 混淆。
- 第二次 reconcile 必须幂等，不重复扣费、退款或补扣。

### 2. 云资源标签和存储归因验证

文件/入口：

- `adapters/resource-provisioner/src/labels.mjs`
- `adapters/resource-provisioner/src/provisioner.mjs`
- `adapters/resource-provisioner/src/store.mjs`
- `scripts/smoke-test-resource-provisioner-resource-mapping-contract.mjs`
- `scripts/live-test-v19-user-e2e.mjs`

必须确认：

- TKE node pool 创建 payload 包含 `tenantid/workspaceid/resourceorderid/runid/serverplanid/nodepoolrole`。
- 如果 TKE node pool 标签不能自动透传给 CVM，必须明确补 CVM 打标动作或记录为阻塞。
- Job/Pod/PVC 带 Kubernetes label，并写入 resource mapping 的 `jobNames/podNames/pvcNames`。
- 用户存储、OPL artifact、workspace 文件、trace 文件的 key 能进入 `cosKeys` 或等价 resource mapping 字段。
- `billingStartedAt`、`billingStoppedAt` 保留在 resource mapping，供 L3 窗口对齐。

### 3. Full User Journey live evidence

需要证明的新用户链路：

```text
创建 1 名用户
-> 管理员给该用户/tenant 充值额度
-> 用户登录 portal.medopl.cn
-> 用户登录 opl.medopl.cn，并输入 gflabtoken API key
-> 用户在 Portal 创建节点并选择存储
-> Portal 展示该用户 CVM/server、storage、preauth/pending bill
-> 用户在 OPL 发送信息
-> 用户上传文件并跑任务
-> 用户下载输出文件
-> Portal 展示 workspace 文件、账单、session trace
-> 用户删除服务器
-> billingStoppedAt 回写，pending cost 停止增长
-> billingStoppedAt + 120min 后执行 L3 exact settlement
-> T+1 COS replay 只做审计回放
```

标准证据步骤 ID：

```text
admin_create_user
admin_recharge
portal_user_login
opl_user_login_with_gflabtoken
portal_create_node_and_storage
portal_pending_bill_visible
opl_send_message
opl_upload_file
opl_run_task
opl_download_output
portal_workspace_file_visible
portal_billing_visible
portal_trace_visible
delete_server
billing_stopped
l3_exact_settlement
```

证据报告必须记录：

- `tenantId`
- `userId`
- `workspaceId`
- `resourceOrderId`
- `runId`
- `serverPlanId`
- `nodePoolId`
- `cvmInstanceIds`
- `storageOrderId` 或 `pvcNames/cosKeys`
- `billingStartedAt`
- `billingStoppedAt`
- `earliestExactWriteAt`
- `matchedResourceId`
- `resourceMappingId`
- `ledgerIds`
- `cleanupStatus`
- `cleanupRemaining`
- `portalBaseUrl`
- `oplBaseUrl`
- `onePersonLabUpstreamClean`

## 测试命令

开发阶段优先运行：

```bash
node scripts/smoke-test-billing-tencent-runtime-contract.mjs
node scripts/smoke-test-billing-tencent-bill-summary.mjs
node scripts/smoke-test-billing-resource-attribution.mjs
node scripts/smoke-test-v19-user-e2e-contract.mjs
node scripts/check-one-person-lab-upstream-clean.mjs
```

如果新增 L3 专项测试，必须加入：

```bash
node scripts/smoke-test-v19-l3-billing-settlement-contract.mjs
```

live 执行前还必须运行：

```bash
node scripts/smoke-test-secret-hygiene-manifests.mjs
node scripts/smoke-test-resource-provisioner-resource-mapping-contract.mjs
node scripts/smoke-test-platform-nodepool-isolation-contract.mjs
```

## 当前卡点

- L3 exact settlement 代码已完成本地实现和 contract 验证；live 结算仍必须等待真实新用户 run 到达 `billingStoppedAt + 120min` 后执行。
- live TKE/kubectl 曾需要 server override 和 insecure skip TLS；执行前必须重新确认连接。
- 既有 COS zip 分账标签为空或无效，不能直接作为 exact 扣费依据；L3 必须通过标签或 resource mapping 唯一归因。
- CVM 标签是否由 TKE node pool 自动透传仍需确认；如果不能透传，需要补打标实现。
- OPL 真 UI 上传/下载/消息证据和 Portal 普通用户视角账单/文件/trace 证据需要在 live journey 中补齐。
- `.runtime/one-person-lab-upstream` 当前有大量既有脏改，`node scripts/check-one-person-lab-upstream-clean.mjs` 未通过；live 前必须恢复 upstream clean 或重新记录该目录来源。

## 本次实现记录

- L3 reconcile gate 改为先按每个 run 的 `billingStartedAt/billingStoppedAt` 做窗口判断，再用 `billingStartedAt -> billingStoppedAt + L3_EXACT_WAIT_MINUTES` 查询 `DescribeBillDetail`。
- `L3_EXACT_WAIT_MINUTES` 从 billing config 传入实际 reconcile gate，默认固定 `120`。
- `/reconcile` HTTP 入口保留 L3 target 字段，不再只保留 COS object key/prefix。
- exact settlement 历史账本匹配改为 `resourceOrderId + runId`，避免同一 `runId` 多 resource order 串账。
- Tencent bill summary 聚合键改为 `resourceOrderId + runId`，避免不同 resource order 被合并。
- 新增 `scripts/lib/v19-commercial-ops-journey-contract.mjs` 和 `scripts/smoke-test-v19-commercial-ops-full-journey-contract.mjs`，固定 full journey evidence 的步骤、字段和敏感信息红线。

## 已验证命令

```bash
node scripts/smoke-test-v19-l3-billing-reconcile-runtime.mjs
node scripts/smoke-test-billing-tencent-runtime-contract.mjs
node scripts/smoke-test-billing-tencent-bill-summary.mjs
node scripts/smoke-test-billing-http-routes-contract.mjs
node scripts/smoke-test-billing-summary-runtime-contract.mjs
node scripts/smoke-test-billing-server-runtime-contract.mjs
node scripts/smoke-test-billing-server-entry-contract.mjs
node scripts/smoke-test-billing-resource-attribution.mjs
node scripts/smoke-test-secret-hygiene-manifests.mjs
node scripts/smoke-test-v19-commercial-ops-full-journey-contract.mjs
node scripts/smoke-test-v19-user-e2e-contract.mjs
```

当前未通过：

```bash
node scripts/check-one-person-lab-upstream-clean.mjs
```

失败原因：`.runtime/one-person-lab-upstream` 存在大量既有 modified 文件。该失败不是本次 L3/full journey contract 代码引入，但会阻塞 live 证据报告里的 `onePersonLabUpstreamClean=true`。

## 完成定义

- L3 billing 代码具备测试覆盖，并通过本文件列出的 billing/attribution smoke。
- 新用户 live journey 能从创建、充值、创建节点、OPL 工作、文件、trace、账单、删除走完。
- 删除后 TKE node pool、CVM、Job、Pod、PVC 无目标残留，pending cost 不继续增长。
- `billingStoppedAt + 120min` 后 L3 exact settlement 产生 charged/refund/makeup 或明确 unattributed，不产生重复结算。
- 报告写入 `docs/reports/`，且不含任何 Secret、token 或 signed URL。
