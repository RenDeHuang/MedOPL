# OPL v19 商业化运营候选 Rollout 与 L3/COS 账单归因检查清单

日期：2026-05-02

分支：`codex/opl-v19`

## 结论

这是 v19 更新范畴内的工作，属于 Step 5、Step 7、Step 8、Step 9 的商业化运营候选补充。

本阶段不接入 Portal 在线支付网关。商业收款边界定义为：客户线下转账给运营方，运营方确认到账后在 Portal 后台为目标 tenant/user 手动充值；Portal 负责余额、冻结、真实云资源消耗扣费、退款、补扣、流水和账单解释。

当前策略是：先把 `min_modularity >= 0.8000` 放到 GA 结构门禁继续追，商业化运营候选阶段优先完成单集群双节点池、管理员手动充值、预扣款、云资源标签、资源映射、删除清理、pending cost 停止增长、L3 明细账单 exact settlement 和 T+1 COS 审计回放。

## 安全规则

- 不把 COS signed URL、`q-ak`、`q-signature`、`x-cos-security-token` 写入 git、文档、日志或 evidence。
- 文档只记录 COS object key：`100047070895-20260501-分账报表-明细账单.zip`。
- 腾讯云 Secret 只通过 K8s Secret 引用：`tencent-billing-secret`、`tencent-cos-secret`、`tencent-provisioner-secret`。
- 不修改 `.runtime/one-person-lab-upstream`。
- 不修改 `https://github.com/gaofeng21cn/one-person-lab` 上游仓库。
- 没有唯一归因证据的账单行必须进入 unattributed，不允许为了通过 gate 强行扣到某个用户或 workspace。
- 不在 v19 本阶段新增微信、支付宝、Stripe、银行卡回调或自动支付入账。
- 线下转账未被运营方确认前，不允许写入 Portal `topup` ledger。
- 手动充值必须保留 operator、目标账户、金额、外部转账凭证号或备注、创建时间和幂等键。
- L3 账单只允许通过 `DescribeBillDetail` 读取；不能把 pending/OpenCost/local metering 当成 exact 扣费依据。
- L3 exact write 固定等待窗口为 `billingStoppedAt + 120min`。窗口未满足时只能 preview 或 pending，不允许写 exact ledger。

## 商业化运营候选最先实现的目标

商业化运营候选的首要目标不是接入在线支付，而是证明一个白名单用户可以在现有 TKE 集群完成真实收费链路：

```text
登录/创建测试用户
-> 线下收款确认
-> Portal 后台管理员手动充值
-> 用户余额增加且流水可见
-> 选择 live 可售 2c4g SKU
-> quote/preauth
-> 创建 TKE node pool/CVM/Job/Pod
-> OPL run 产生 artifact/trace
-> Portal 可见文件、trace、pending bill
-> 删除服务器
-> node pool/CVM/Pod/Job 无残留
-> billingStoppedAt 回写
-> pending cost 停止增长
-> billingStoppedAt + 120min 后 L3 明细账单唯一归因
-> exact settlement 写入或保持 unattributed
-> T+1 COS 审计回放
```

当天验收 admin topup、preauth、pending、resource mapping、cloud tags、cleanup、停止增长和 L3 exact settlement。COS 是日结审计账单，T+1 后再验收 replay、refund/makeup delta 和幂等 reconcile。

## 清单

### 1. 确认当前 v19 证据基线

- [ ] 确认 Step 2 `billing-reconcile` CronJob 最近 Job 为 Completed。
- [ ] 确认 Step 3 live SKU 非零报价仍可用，商业化运营候选优先使用 `cpu-2c4g`。
- [ ] 确认 Step 4 TKE create/delete cleanup 证据存在。
- [ ] 确认 Step 5A same-day preauth/pending billing 证据存在。
- [ ] 确认 `tencent-billing-secret` 对应 CAM 已具备 `QcloudFinanceBillReadOnlyAccess` 或等价 `DescribeBillDetail` 只读权限。
- [ ] 确认 Step 6 Portal PostgreSQL/Redis restart recovery 证据存在。
- [ ] 确认 Step 7A same-day full user E2E 证据存在。
- [ ] 确认 Portal admin recharge 可写入 `topup` ledger，且普通用户不能伪造充值。
- [ ] 确认 Secret hygiene smoke 通过。

推荐命令：

```bash
node scripts/smoke-test-secret-hygiene-manifests.mjs
node scripts/smoke-test-v19-user-e2e-contract.mjs
node scripts/smoke-test-portal-admin-user-routes-contract.mjs
node scripts/smoke-test-resource-provisioner-resource-mapping-contract.mjs
node scripts/smoke-test-billing-resource-attribution.mjs
node scripts/smoke-test-billing-tencent-runtime-contract.mjs
node scripts/smoke-test-v19-cos-target-matching-contract.mjs
```

### 2. 修订 Step 8 商业化运营候选/GA 结构门禁口径

- [ ] 商业化运营候选结构门禁不硬卡 `min_modularity >= 0.8000`。
- [ ] 商业化运营候选结构门禁必须保留：无循环依赖、模块边界通过、大文件检查通过、Secret hygiene 通过、关键 smoke 通过、Sentrux 不继续退化。
- [ ] GA 结构门禁继续保留 `min_modularity >= 0.8000`，除非后续正式批准修订。
- [ ] 文档口径统一：Step 8A 商业化运营候选通过不等于 GA 通过。

推荐命令：

```bash
node scripts/check-v18-module-boundaries.mjs
node scripts/check-v18-large-files.mjs
sentrux check .
```

### 3. 确认单集群双节点池商业化运营候选隔离

- [ ] 平台服务固定在平台节点池。
- [ ] 用户 run/Job/Pod 固定在运行节点池。
- [ ] server plan 带 `nodeSelector` / `tolerations` 或等价调度约束。
- [ ] TKE autoscaling 只扩运行节点池，不影响 Portal、OPL、Trace、Billing、Provisioner 控制面。
- [ ] 删除服务器时只清理该 resourceOrder 关联的 node pool/CVM/Job/Pod/PVC/COS key，不误删平台节点池资源。

验收字段：

```text
tenantId
workspaceId
resourceOrderId
runId
serverPlanId
nodePoolId
cvmInstanceIds
jobNames
podNames
cosKeys
billingStartedAt
billingStoppedAt
cleanupStatus
cleanupRemaining
```

### 4. 云资源标签与平台 resource mapping 合同

每个会产生账单或用于账单归因的资源，都必须同时满足两条线：

1. 云侧标签：腾讯云资源上能被账单系统读取或分账系统识别。
2. 平台映射：resource-provisioner `/resource-mappings` 能记录原始资源 ID 与业务主体。

必填业务字段：

```text
tenantId
workspaceId
resourceOrderId
runId
serverPlanId
```

云标签键使用腾讯云账单更容易保留的短键：

```text
tenantid
workspaceid
resourceorderid
runid
serverplanid
nodepoolrole
```

标签值必须使用 `cloudTagValue` 规则归一化，避免腾讯云标签长度、字符集和账单列归一化造成匹配失败。证据中必须同时记录原始 ID 和归一化标签值。

资源要求：

- [ ] TKE node pool 创建 payload 必须包含 `tenantid/workspaceid/resourceorderid/runid/serverplanid/nodepoolrole` 标签。
- [ ] TKE node pool 必须包含 Kubernetes label：`gaofenglab/tenant-id`、`gaofenglab/workspace-id`、`gaofenglab/resource-order-id`、`gaofenglab/run-id`、`gaofenglab/server-plan-id`。
- [ ] node pool 创建出的 CVM instance 必须能在 inventory 中看到同一组云标签；如果 TKE 不自动透传到 CVM，必须补 `TagResources`/等价打标动作。
- [ ] Job/Pod/PVC 必须带同一组 Kubernetes label，并写入 resource mapping 的 `jobNames/podNames/pvcNames`。
- [ ] 用户选择的存储资源必须能归因：CBS/PVC/COS key 至少一个维度必须进入 `pvcNames/cosKeys/cloudResourceIds`，并尽量在云资源上写同一组云标签。
- [ ] OPL artifact、trace、workspace 文件 key 必须带 tenant/workspace/run/resourceOrder 前缀或显式写入 `cosKeys`。
- [ ] `billingStartedAt`、`billingStoppedAt` 必须由 resource mapping 保留，供 L3 查询窗口和 COS replay 对齐。

验收原则：

- 标签命中优先，但标签缺失不能直接扣费。
- 标签缺失时，只有 `ResourceId/InstanceId -> resource mapping` 唯一命中，且时间窗口覆盖资源生命周期，才允许 exact settlement。
- 无标签、无资源 ID、资源 ID 多命中、mapping 缺字段、资源生命周期不重叠，全部进入 unattributed。

### 5. 线下收款与 Portal 手动充值检查

- [ ] 本阶段明确不提供用户自助在线支付入口。
- [ ] 线下收款由运营方在系统外确认，不由 Portal 自动判断到账。
- [ ] Portal 后台充值只允许 admin 或 billing admin 操作。
- [ ] 充值对象必须明确到 tenant/user，后续 GA 前优先收敛为 tenant 主账户、user 作为操作人。
- [ ] 每笔 `topup` ledger 至少包含 `tenantId`、`userId`、`amount`、`operatorId`、`idempotencyKey`、`createdAt`。
- [ ] 有线下转账凭证时，记录 `externalTransferRef` 或等价备注字段；没有凭证号时必须记录人工备注。
- [ ] 充值后普通用户账单页能看到余额和充值流水，但不能看到其他 tenant/user 的充值流水。
- [ ] 充值、退款、补扣、手动调整都必须可审计，不能直接改 wallet balance 而不写 ledger。

### 6. L3 明细账单当天 exact settlement gate

主结算来源：腾讯云 `DescribeBillDetail` L3 明细账单。

固定等待窗口：

```text
earliestExactWriteAt = billingStoppedAt + 120min
```

在 `earliestExactWriteAt` 之前：

- [ ] 可以调用 L3 preview 检查账单行是否出现。
- [ ] 可以展示 pending 或 exact unavailable。
- [ ] 不能写 `exact_resource_charge`、`refund`、`makeup_charge`。

在 `earliestExactWriteAt` 之后：

- [ ] 用 `billingStartedAt` 到 `billingStoppedAt + 120min` 查询 `DescribeBillDetail`。
- [ ] 查询结果必须完整分页；如果触达 `TENCENT_BILLING_MAX_PAGES` 仍未拉完，必须失败，不允许用部分结果扣费。
- [ ] 先按标签匹配 `tenantid/workspaceid/resourceorderid/runid/serverplanid`。
- [ ] 标签无效时，再按 `ResourceId/InstanceId/资源ID` 匹配 resource mapping。
- [ ] 只允许唯一命中的目标 run 写 exact ledger。
- [ ] 第一遍 reconcile 写 `exact_resource_charge`，并按 preauth 差额写 `refund` 或 `makeup_charge`。
- [ ] 第二遍 reconcile 必须幂等，不重复扣费或退款。

证据字段：

```text
exactSource=DescribeBillDetail
waitPolicy=billingStoppedAt+120min
queryBeginTime
queryEndTime
tenantId
workspaceId
resourceOrderId
runId
serverPlanId
nodePoolId
cvmInstanceIds
matchedResourceId
resourceMappingId
ledgerIds
unattributedCount
```

### 7. COS 账单 zip 次日审计回放

目标 object key：

```text
100047070895-20260501-分账报表-明细账单.zip
```

- [ ] 不使用 signed URL 入库。
- [ ] 通过 billing service 的 COS reader 或 K8s 内部 `kubectl_exec` 读取 object key。
- [ ] COS 不再阻塞当天 Step 9A 商业化运营候选；它用于 T+1 审计回放、争议处理和 L3 结算复核。
- [ ] 先跑只读 replay，不直接重复写账本。
- [ ] 记录 parsed row count、attributed count、unattributed count、matched target item、L3 ledger delta。
- [ ] 如果 `分账标签` 为空或无效，不能直接判定账单可归因。
- [ ] 如果 COS replay 与 L3 已结算金额不同，只允许通过幂等 adjustment 处理差额。

推荐命令：

```bash
COS_DAILY_CHECK_OBJECT_KEY='100047070895-20260501-分账报表-明细账单.zip' \
COS_DAILY_CHECK_TARGET_DATE=20260501 \
COS_DAILY_CHECK_TRANSPORT=kubectl_exec \
COS_DAILY_CHECK_KUBECONFIG='/mnt/c/Users/Administrator/Downloads/cls-ngiq693i-config (1)' \
COS_DAILY_CHECK_KUBE_SERVER_OVERRIDE='https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443' \
COS_DAILY_CHECK_KUBE_INSECURE_SKIP_TLS_VERIFY=1 \
node scripts/daily-check-v19-cos-target-bill.mjs
```

### 8. 分账标签无效时的检查方法

分账标签无效时，检查顺序必须从强到弱：

1. 标签归因：检查账单行是否包含 `tenant_id`、`workspace_id`、`resource_order_id`、`run_id`、`server_plan_id` 或腾讯云归一化标签值。
2. 资源 ID 归因：如果标签列为空，检查账单行是否包含 `资源ID`、`ResourceId`、`InstanceId`、`资源ID/实例ID` 等字段。
3. 平台 resource mapping 唯一命中：用账单资源 ID 匹配 resource-provisioner 的 `nodePoolIds`、`cvmInstanceIds`、`podNames`、`jobNames`、`pvcNames`、`cosKeys`。
4. 唯一命中后才允许归因：必须只有一个 mapping 命中，并且 mapping 内有完整 `tenantId/workspaceId/resourceOrderId/runId/serverPlanId`。
5. 多命中、无命中、mapping 缺字段、时间窗口不匹配，都必须保持 unattributed。

当前代码支持的 fallback：

- `adapters/billing-aggregator/src/resource-attribution.mjs` 会从账单行提取资源 ID 候选。
- `adapters/billing-aggregator/src/cos-billing-runtime.mjs` 会读取 resource-provisioner `/resource-mappings` 后尝试唯一映射归因。
- `scripts/daily-check-v19-cos-target-bill.mjs` 会先判断 `matchedAttributed`，再判断 `matchedByResourceId`。
- L3 明细账单也必须接入同一套 fallback，不允许 L3 与 COS 使用两套归因规则。

### 9. Step 5B/7B-L3 exact reconcile

只有 Step 6 L3 只读检查满足以下任一条件，才进入写账本 reconcile：

- `matchedAttributed` 命中目标 resourceOrder/run。
- `matchedByResourceId` 命中目标 CVM/node pool，并且 resource mapping 唯一归因到同一个 tenant/workspace/resourceOrder/run/serverPlan。

推荐执行策略：

```bash
TENCENT_BILLING_ENABLED=1 \
TENCENT_BILLING_REQUIRED=1 \
L3_EXACT_WAIT_MINUTES=120 \
BILLING_RECONCILE_CUSTOMER_ID='<from Step 7A evidence>' \
BILLING_RECONCILE_WORKSPACE_ID='<from Step 7A evidence>' \
BILLING_RECONCILE_WINDOW='6h' \
node adapters/billing-aggregator/src/server.mjs reconcile
```

COS replay 执行时必须指定同一个 object key：

```bash
RUN_COS_LIVE=1 \
COS_LIVE_HTTP_TRANSPORT=kubectl_exec \
COS_LIVE_BILL_OBJECT_KEY='100047070895-20260501-分账报表-明细账单.zip' \
COS_LIVE_EXPECT_TENANT_ID='<from Step 7A evidence>' \
COS_LIVE_EXPECT_WORKSPACE_ID='<from Step 7A evidence>' \
COS_LIVE_EXPECT_RESOURCE_ORDER_ID='<from Step 7A evidence>' \
COS_LIVE_EXPECT_RUN_ID='<from Step 7A evidence>' \
COS_LIVE_EXPECT_SERVER_PLAN_ID='<from Step 7A evidence>' \
COS_LIVE_KUBECONFIG='/mnt/c/Users/Administrator/Downloads/cls-ngiq693i-config (1)' \
COS_LIVE_KUBE_SERVER_OVERRIDE='https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443' \
COS_LIVE_KUBE_INSECURE_SKIP_TLS_VERIFY=1 \
node scripts/live-test-v19-cos-exact-bill-reconcile.mjs
```

验收：

- [ ] L3 第一遍 reconcile 对目标 run 产生 `charged`、`refund` 或 `makeup_charge` 之一。
- [ ] 第二遍 reconcile 不重复扣费或退款。
- [ ] COS replay 不重复写相同 exact charge，只对 L3/COS 差额写幂等 adjustment。
- [ ] evidence 记录 exact source、object key、匹配账单行、matchedResourceId、resourceMappingId、ledger id。
- [ ] 如果真实账单没有目标行，结果必须是未通过或 pending exact，不允许造数据。

### 10. Step 9A 商业化运营候选 rollout

- [ ] Step 2、3、4、5A、6、7A 证据齐全。
- [ ] Step 8 商业化运营候选结构门禁口径已批准并记录。
- [ ] Kube API 可连通。
- [ ] L3 `DescribeBillDetail` 可读取目标窗口账单；`QcloudFinanceBillReadOnlyAccess` 权限已验证。
- [ ] L3 exact settlement 等待窗口固定为 `billingStoppedAt + 120min` 并有证据。
- [ ] COS daily check 已能读取目标 zip；如果标签无效，已确认 resource ID fallback 的结论。COS 作为审计回放，不阻塞当天候选 rollout。
- [ ] admin recharge 证据齐全，且充值流水、余额、冻结、扣费链路可由同一 tenant/user 解释。
- [ ] rollout 文档明确状态只能写 `commercial-ops candidate` 或 `controlled commercial trial candidate`。
- [ ] 未完成 L3 exact settlement 前，不写 `commercial-ops candidate`。
- [ ] 未完成 COS T+1 replay、持续对账和结构 GA gate 前，不写 `commercialization complete` 或 `GA`。

## 分账标签无效的判断结论

分账标签无效不是立刻阻塞商业化运营候选，但会阻塞商业化完成。

它对两个 gate 的影响不同：

- 对 Step 9A 商业化运营候选：可以接受，但必须依赖平台 resource mapping、CVM/node pool ID、计费开始/停止时间、cleanup evidence 和 L3 exact settlement 证明当天链路可控。
- 对 Step 9B 商业化完成：不能接受“无归因扣费”。只有通过资源 ID 唯一映射到 Step 7A 的 resource mapping 后，才可以做 exact settlement；否则必须进入 unattributed queue。

## 方案 B 实现清单

### Billing aggregator

- [ ] 新增 L3 target preview/reconcile 能力，复用 `DescribeBillDetail`，支持按目标 `tenantId/workspaceId/resourceOrderId/runId/serverPlanId/nodePoolId/cvmInstanceIds` 检查。
- [ ] L3 账单行 normalize 后接入 `applyResourceAttributionToRows`，与 COS 共用同一套标签和资源 ID fallback 规则。
- [ ] 增加 `L3_EXACT_WAIT_MINUTES=120` 配置；未到窗口时返回 `pending_l3_settlement_window`，不写 ledger。
- [ ] L3 分页必须完整；分页截断时失败。
- [ ] exact ledger 的 `sourceId` 必须区分 `tencent_l3_bill:<resourceOrderId>` 与 `tencent_cos_replay:<resourceOrderId>:<objectKey>`，保证 L3 与 COS replay 幂等。

### Resource provisioner

- [ ] TKE node pool payload 继续写 `Tags` 和 `Labels`。
- [ ] 验证 node pool 标签是否透传到 CVM instance；不透传时补打 CVM 标签动作。
- [ ] resource mapping 必须持久化 `nodePoolIds/cvmInstanceIds/podNames/jobNames/pvcNames/cosKeys/billingStartedAt/billingStoppedAt`。
- [ ] 创建、删除、cleanup evidence 必须记录原始 ID 与云标签归一化值。

### Portal

- [ ] admin recharge ledger 补 operator 和外部转账凭证或备注。
- [ ] 用户账单页展示 exact source：`L3`、`COS replay adjustment`、`pending`。
- [ ] 普通用户不能看到其他 tenant/user 的充值、扣费或 unattributed 明细。

### Live scripts

- [ ] 新增 L3 preview 脚本：只读检查目标 run，不写账本。
- [ ] 新增 L3 reconcile 脚本：在 `billingStoppedAt + 120min` 后写账本并跑两遍幂等。
- [ ] COS replay 脚本改为 audit replay，不再作为当天候选 rollout 前置阻塞。

## 完成定义

本清单完成时，v19 可以进入商业化运营候选的条件是：

- 白名单用户链路可以完成。
- 线下收款确认后，Portal admin 手动充值可以形成可审计 `topup` ledger。
- 用户余额、冻结、扣费、退款、补扣可以通过 Portal 账单解释。
- TKE/CVM 创建和删除可控。
- 每个云资源都有平台 resource mapping。
- 每个会产生账单的云资源都有业务标签或可唯一回溯的资源 ID。
- 删除后无残留，pending cost 停止增长。
- `billingStoppedAt + 120min` 后，L3 明细账单可以读取、解析并唯一归因，或正确进入 unattributed。
- COS zip 能读取并作为 T+1 审计回放解析。
- 分账标签无效时，不会误扣用户账本。
- 如果资源 ID fallback 唯一命中，则可以继续 L3 exact reconcile。
- 如果 fallback 也不能唯一命中，则保持 unattributed，并把腾讯云分账标签配置修复列为 GA 前 P0。
