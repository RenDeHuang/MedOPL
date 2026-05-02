# OPL v19 Live Gates 补充 AI 开发方案

日期：2026-05-01

分支：`codex/opl-v19`

当前工作区：`/home/dev/projects/platform-v19`

## 结论

v19 不能继续按“已经完成商业化版本”推进。它现在是一个本地合同和 smoke 覆盖增强后的商业化候选分支，但还缺少生产云上证据。下一步应拆成 10 个 step，其中 Step 0 是接管校准，Step 1 到 Step 9 是补齐 live gate、账单闭环、恢复证据、结构门禁和 rollout 决策。

本补充方案的目标不是继续堆 UI 或文档，而是把 v19 从“本地可验证”推进到“云上可验收”。每个 step 必须有明确的输入、写入范围、验收命令和证据文件；不能用模拟结果替代明确要求 live 的验收项。

内测阶段采用单集群双节点池推进：同一个 TKE 集群内保留平台节点池运行 Portal、OPL、Trace、Billing、Provisioner 等控制面服务，另一个运行节点池承载用户 run、Job、Pod 和可归因计算资源。正式商业化前再评估双集群隔离；当前最快上线目标不是先新建第二个集群，而是在单集群内把调度隔离、资源映射、预扣款和清理证据闭环做严。

商业扣费采用双阶段 gate：当天完成 `quote -> preauth -> pending usage -> delete stops billing growth -> cleanup`，次日 COS 日结 zip 投递后完成 `exact bill -> refund/makeup -> idempotent reconcile`。当天可以证明用户创建了什么、什么时候开始计费、什么时候停止计费；次日才能证明腾讯云 exact bill 与平台账本完全对账。

## 为什么要做这个开发任务

v19 当前已经有 OPL 登录、真实消息 fixture、SKU 商品形状、storage gate、ledger smoke、RBAC smoke、Docker appliance、入口健康检查等本地能力，但这些能力还没有形成正式生产 SaaS 发布所需的云上闭环证据。

当前阻塞点：

- 云上主服务仍是 v18，v19 没有滚云。
- `billing-reconcile` CronJob 仍在旧镜像上运行，并且最近任务失败。
- live TKE create/delete 没有 cleanup 证明。
- live COS exact bill reconcile 没有真实 daily bill 文件证据。
- full user E2E 没有完成从充值、买存储、选 SKU、预扣、建节点、发消息、artifact、trace、下载、删服务器到 T+1 结算的闭环。
- Portal PostgreSQL/Redis 模式还缺重启恢复证据。
- live SKU quote 还缺生产凭据下的非零价格证据。
- Sentrux 当前 `check_rules=pass`，但 `quality_signal` 低于 v19 原计划目标。
- 单集群双节点池内测模式还必须证明用户任务不会调度到平台节点池，平台服务也不会被用户 run 的伸缩和清理动作影响。
- 资源映射账本必须成为 P0 gate：每条资源链必须能查询 `tenantId`、`workspaceId`、`resourceOrderId`、`runId`、`serverPlanId`、`nodePoolId`、CVM、Pod、Job、PVC、COS object、ledger、`billingStartedAt`、`billingStoppedAt`、`cleanupStatus` 和 cleanup remaining。

因此，下一步开发任务的目的，是补齐这些 P0/P1 gate，并把每个 gate 变成可重复执行的脚本、文档和验收证据。

## 总体规则

- 必须全程中文记录结论。
- 禁止使用任何 `gpt-5.1` 相关模型。
- 创建 git worktree 或 Codex native subagent 时，必须显式记录模型。
- 允许模型仅限：`gpt-5.4`、`gpt-5.3-codex`、`gpt-5.4-mini`。
- 默认使用 `gpt-5.4` 执行复杂开发和云上 gate。
- 不把 Secret、API key、腾讯云密钥、数据库密码、Redis 密码写入 git、文档、日志或镜像。
- 不修改 `.runtime/one-person-lab-upstream`。
- 不修改 Langfuse 源码。
- 不使用降级处理、兜底方案、临时补丁、启发式后处理来伪造通过。
- 没有 live 证据的项目，只能标记为未完成，不能写成已通过。
- 每个 lane 必须在独立 worktree 内开发，完成后提交，再合并回 `codex/opl-v19`。
- 每个 lane 合并前必须跑 Sentrux / Scan，并记录 `quality_signal`、`check_rules` 和 DSM 依赖方向。

## Subagent 并行推进要求

本补充任务必须使用 subagent 并行推进，但要按写入范围隔离，避免多个 subagent 修改同一批文件。

推荐并行方式：

- Subagent A，模型 `gpt-5.4`：云上只读接管、Kubernetes/CronJob/Deployment 状态核查，只写 `docs/reports/**`。
- Subagent B，模型 `gpt-5.4`：`billing-reconcile` P0 修复，只写 `adapters/billing-aggregator/**`、相关 billing smoke 脚本和账单文档。
- Subagent C，模型 `gpt-5.4`：live TKE create/delete cleanup 脚本，只写 `resource-provisioner`、TKE live gate 脚本和证据文档。
- Subagent D，模型 `gpt-5.4`：full user E2E 自动化，只写 E2E 脚本、fixture、证据文档。
- Subagent E，模型 `gpt-5.4` 或 `gpt-5.3-codex`：Portal 结构质量和 Sentrux gate，只写 Portal runtime 结构相关文件和结构测试。

subagent 使用规则：

- 每个 subagent 的任务说明必须写清楚分支、worktree、模型、写入范围、禁止事项、验收命令。
- subagent 不允许直接滚云，除非当前 step 明确授权其做受控 live gate。
- subagent 完成后必须提交，并在最终消息中列出改动文件、测试命令、失败项和未完成风险。
- 不再需要的 subagent 必须立即关闭，避免占用席位。

## Step 0：接管校准与分支状态确认

目的：

确认 WSL2 当前 worktree 与上一轮会话记录是否一致，避免在错误基线继续开发。

为什么要做：

当前 WSL2 worktree 的 HEAD 是 `ef4c460`，但上一轮记录提到过 `a17a246` 和 `2026-05-01-OPL-v19-Open-Items-Checklist.md`。如果不先校准，就可能漏掉待补清单或在旧基线上重复开发。

怎么做：

1. 检查 `git status --short --branch --untracked-files=all`。
2. 检查 `git log --oneline --decorate -20`。
3. 查找 `2026-05-01-OPL-v19-Open-Items-Checklist.md` 是否存在于其他 worktree 或 remote。
4. 确认 `AGENTS.md` 的当前修改是否只是工作区规则注入，不把无关变化混入业务提交。
5. 重新生成或恢复 v19 open items 文档。

验收：

- 明确记录当前 HEAD、branch、worktree、未提交文件。
- 若 `a17a246` 不在当前 repo，可说明无法从当前对象库恢复，并在当前分支重新落文档。
- `git status` 中没有被误修改的业务文件。

测试命令：

```bash
git status --short --branch --untracked-files=all
git log --oneline --decorate -20
find docs -name '*v19*Open*' -o -name '*Open-Items*' -o -name '*Checklist*'
```

## Step 1：云上访问与只读状态盘点

目的：

建立 v19 后续 live gate 的真实云上起点。

为什么要做：

v19 的问题不是本地 smoke 不足，而是云上证据不足。必须先知道当前集群实际部署了哪些镜像、哪些 CronJob 失败、哪些 Secret 存在、入口健康是否稳定。

怎么做：

1. 使用本地 operator 提供的 kubeconfig，不把 kubeconfig 内容写入仓库。
2. 使用可达的 TKE API endpoint 做 server override。
3. 只读检查 deployments、statefulsets、cronjobs、jobs、pods、secrets 名称、ingress、service。
4. 记录当前镜像 tag，尤其是 `portal-opl`、`opl-web-gateway-opl`、`portal-opl-adapter-opl`、`billing-aggregator-opl`、`resource-provisioner-opl`、runner 相关镜像。
5. 读取失败 Job 的 exit code 和日志摘要，但不记录 Secret。

验收：

- 产出云上只读状态报告。
- 明确列出哪些服务仍是 v18 或更旧版本。
- 明确列出 `billing-reconcile` 最近失败原因或当前不可诊断原因。
- 不产生任何云上写操作。

测试命令：

```bash
kubectl get deploy,sts,cronjob,job,pod,svc,ingress -n default
kubectl get deploy -n default -o wide
kubectl get cronjob billing-reconcile -n default -o yaml
kubectl logs -n default job/<latest-billing-reconcile-job>
node scripts/check-production-entry-performance.mjs --json
node scripts/smoke-test-v19-entry-health.mjs
```

## Step 2：修复 `billing-reconcile` P0

目的：

让云上账单回补链路恢复为可运营状态。

为什么要做：

商业闭环依赖 T+1 exact bill、退款、补扣、幂等对账。如果 `billing-reconcile` 仍在旧镜像上失败，v19 不能作为商业化版本发布。

怎么做：

1. 读取当前 `billing-reconcile` CronJob 的镜像、command、args、env、Secret 引用。
2. 在 billing aggregator 内补齐或修复 reconcile CLI 入口，确保 CronJob 启动的是 reconcile 命令，不是普通 server 监听。
3. 明确 exact bill 输入来源、幂等键、ledger 写入规则和失败退出码。
4. 增加本地 contract smoke，覆盖重复执行不重复扣费。
5. 生成新的 CronJob patch 或 rollout 步骤，但 Secret 只引用 K8s Secret，不写明文。

验收：

- 本地 reconcile smoke 通过。
- CronJob 命令可解释、可重复运行、失败日志可诊断。
- 云上一次手动 Job 成功完成。
- 重复执行不会重复写 ledger。

测试命令：

```bash
node --check adapters/billing-aggregator/src/*.mjs
node scripts/smoke-test-v19-preauth-ledger-idempotency.mjs
node scripts/smoke-test-v19-t1-settlement-refund.mjs
node scripts/smoke-test-v19-t1-settlement-makeup.mjs
node scripts/smoke-test-v19-unattributed-bill-queue.mjs
kubectl create job --from=cronjob/billing-reconcile billing-reconcile-manual-<date> -n default
kubectl logs -n default job/billing-reconcile-manual-<date>
```

## Step 3：live SKU 非零报价证据

目的：

证明 `/server-plans` 不是静态商品形状，而是能用生产凭据取到腾讯云真实可售 SKU 和非零价格。

为什么要做：

服务器商品化必须建立在真实可售和真实报价上。没有 live non-zero quote，就不能证明客户看到的价格可用于预扣和结算。

怎么做：

1. 确认 billing 服务拥有腾讯云查询所需 Secret 引用。
2. 使用 `na-siliconvalley` 区域和明确 zone 查询真实机型。
3. 禁止把未知状态当作可下单。
4. 记录返回字段：`instanceType`、`cpu`、`memoryGb`、`zone`、`availabilityStatus`、`hourlyPrice`、`currency`、`canOrder`、`source`。
5. 将证据写入报告，只记录非敏感返回字段。

验收：

- `/server-plans` 返回 `source=tencent_cloud_live_catalog`。
- 至少一个可下单 SKU 有非零 `hourlyPrice`。
- 不可售 SKU 不能 quote/preauth/provision。
- Portal 每页 4 个规格、CPU/内存筛选仍通过。

测试命令：

```bash
node scripts/smoke-test-v19-sku-discovery-live.mjs
node scripts/smoke-test-v19-server-plan-pagination-filter.mjs
```

## Step 4：live TKE create/delete cleanup gate

目的：

证明 v19 可以创建真实计算资源，并能删除干净，不留下 node pool、CVM 或 Pod 残留。

为什么要做：

如果 create/delete 不能闭环，用户删除服务器后仍可能继续产生云成本，这是商业化 P0 风险。

怎么做：

1. 新增专用 live gate 脚本，要求显式环境变量才允许运行。
2. 使用测试 tenant/workspace/resourceOrder/run 标签创建资源。
3. 创建后验证 TKE node pool、CVM、Pod 或相关云资源带完整标签。
4. 将资源链写入 resource-provisioner 资源映射账本，并通过只读 evidence endpoint 查询到同一条映射。
5. 触发删除。
6. 轮询确认 node pool、CVM、Pod、pending usage 状态归零或停止增长。
7. 回写 `billingStoppedAt`、`cleanupStatus`、`deleteRequestId`、`cleanupRemaining`。
8. 输出 cleanup evidence JSON 到 `.runtime/`，不要写进源码树。

验收：

- 没有显式 live 开关时脚本拒绝执行。
- create 成功并有完整标签。
- delete 成功并证明无残留资源。
- 删除后 pending cost 停止增长。
- 资源映射账本能回答谁创建了什么资源、何时开始计费、何时停止计费、是否清理干净。
- 失败时脚本输出可执行的清理对象 ID。

测试命令：

```bash
RUN_TKE_LIVE=1 node scripts/live-test-v19-tke-create-delete-cleanup.mjs
kubectl get pods -n default --show-labels
```

## Step 5：billing 双阶段 gate

目的：

把当天可验证的预扣款闭环和次日才能验证的 COS exact bill 闭环拆开，避免用日结账单要求阻塞同日上云判断。

为什么要做：

腾讯云 COS 分账明细是日结 zip。当天创建的 v19 测试资源，不能要求当天立即出现在 exact bill 中。当天必须证明 quote、preauth、pending usage、delete 后停止增长和 cleanup；次日账单投递后，再证明 exact bill 归因、refund/makeup 和幂等。

同时，历史 COS zip 可用于证明 reader/parser/unattributed queue，但如果历史资源没有完整 v19 标签，就不能证明 exact settlement。验收前必须先确认新测试 tenant/workspace 已经绑定到同一条 TKE/CVM/Pod/存储资源链，并且这些云资源或对象 metadata 带有 `tenant_id`、`workspace_id`、`resource_order_id`、`run_id`、`server_plan_id`。只创建租户不算通过；如果资源和账单标签没有绑定，次日 COS zip 仍会无法归因。

怎么做：

Step 5A，same-day preauth gate：

1. 使用 live SKU 非零报价生成 quote。
2. 为自动生成的测试 tenant/workspace/resourceOrder/run 执行 preauth。
3. 创建真实 TKE 资源，并确认 TKE node pool、CVM、Pod、Job、PVC、COS object 或相关 resource metadata 均带完整 v19 归因标签。
4. 通过资源映射账本查询同一条 tenant/workspace/resourceOrder/run/serverPlan 资源链，确认 node pool/CVM/Pod/Job/PVC/COS/ledger 与 `billingStartedAt` 可见。
5. 验证 pending usage 或 pending cost 能随资源运行增长。
6. 删除服务器。
7. 验证 pending cost 停止增长，且 TKE/CVM/Pod/Job/PVC 无残留。
8. 确认资源映射账本已回写 `billingStoppedAt`、`cleanupStatus` 和 cleanup remaining。
9. 记录资源 ID、ledger ID、request ID、标签键值和 cleanup 证据。

Step 5B，T+1 exact bill gate：

1. 等待真实 COS 日结 zip 投递到生产 bucket。当前真实账单位置是 `opl-1410708315` bucket 根目录，不是 `daily/` 前缀。
2. 只读取真实 bill，不用伪造 daily bill 替代 live gate。
3. 先指定具体日结 zip object key 做 preview，不能只依赖 prefix 下最新非空文件；确认账单内写的是原始 ID，还是腾讯云云标签归一化后的 `tenantid/workspaceid/resourceorderid/runid/serverplanid` 值。
4. 在 zip 内找到至少一条同时带有 `tenant_id`、`workspace_id`、`resource_order_id`、`run_id`、`server_plan_id` 的 v19 测试资源账单行；匹配时必须同时接受 Step 5A 原始 ID 和云标签归一化值，避免因为腾讯云标签值截断导致误判缺失。
5. 如果真实账单标签列为空，但账单行包含 `资源ID`、`ResourceId`、`InstanceId` 等云资源主键，则只能用平台持久化的 resource mapping 做确定性归因：资源 ID 必须唯一命中同一条 `tenant/workspace/resourceOrder/run/serverPlan` 映射；无映射、映射缺字段、多映射冲突时必须保持 unattributed，不能扣费。
6. 将 bill item 归因到 tenant/workspace/resourceOrder/run。
7. 对无法归因的账单进入 unattributed queue，并记录缺失标签、资源 ID、匹配数量和原因。
8. 对可归因账单写入 exact charge、refund 或 makeup。
9. 重复执行验证幂等，并记录 reconcile 前后 ledger 差异快照。

验收：

- Step 5A 通过：preauth 成功、pending usage 可见、删除后 pending cost 停止增长、cleanup 无残留；tenant/workspace/resourceOrder/run/serverPlan 必须与 TKE/CVM/Pod/Job/PVC/COS object 或 resource metadata 是同一条资源链，且资源标签完整；资源映射账本必须能查询创建、计费开始、删除请求、计费停止和清理状态。
- Step 5B 通过：真实 COS zip 内按 Step 5A 产出的 tenant/workspace/resourceOrder/run/serverPlan 键值至少找到一条账单行；如果腾讯云标签列为空，也可以通过账单 `资源ID/ResourceId/InstanceId` 唯一命中平台 resource mapping 后归因，但必须在证据中记录具体 COS object key、目标账单行、匹配资源 ID、resourceMappingId、reconcile 前后 ledger id 和重复执行后 ledger 不变。
- Step 5B 的 settlement 分支必须至少命中 `charged`、`refund` 或 `makeup_charge` 之一；命中哪一支由真实 exact cost 与预扣金额决定，不能人为构造账单金额。
- Unattributed queue 必须保留 sourceId/resourceId/product/amount/reason，不得静默丢弃无法归因的真实账单。
- 历史 zip 标签为空时，只能证明 parser/unattributed queue，不能把 exact settlement 标记为通过。

测试命令：

```bash
RUN_V19_LIVE_E2E=1 V19_LIVE_E2E_PHASE=same_day node scripts/live-test-v19-user-e2e.mjs
node scripts/smoke-test-v19-unattributed-bill-queue.mjs
node scripts/smoke-test-v19-t1-settlement-refund.mjs
node scripts/smoke-test-v19-t1-settlement-makeup.mjs
node scripts/smoke-test-billing-resource-attribution.mjs
node scripts/smoke-test-billing-cos-zip-reader.mjs
RUN_COS_LIVE=1 node scripts/live-test-v19-cos-exact-bill-reconcile.mjs
COS_LIVE_BILL_OBJECT_KEY='<target-zip>' RUN_COS_LIVE=1 node scripts/live-test-v19-cos-exact-bill-reconcile.mjs
```

## Step 6：Portal PostgreSQL/Redis restart recovery

目的：

证明 Portal 在 `postgres_redis` 模式下不是只靠内存状态运行，Pod 重启后用户、钱包、订单、文件、trace、session 关键状态不会丢失。

为什么要做：

商业 SaaS 不能依赖进程内状态。没有数据库和缓存恢复证据，不能滚 Portal v19。

怎么做：

1. 确认 Portal Secret 中有 PostgreSQL 和 Redis URL 引用。
2. 确认 `PORTAL_STORAGE_MODE=postgres_redis`。
3. 创建测试用户、钱包充值、存储购买、订单、文件元数据、trace 记录。
4. 重启 Portal Pod。
5. 重新登录并验证数据仍可读。
6. 记录数据库和 Redis 连接健康，但不记录密码。

验收：

- Pod 重启前后关键状态一致。
- Portal 不回退到 memory 模式。
- Redis 临时状态丢失不会破坏数据库持久状态。
- 恢复证据写入报告。

测试命令：

```bash
kubectl rollout restart deploy/portal-opl -n default
kubectl rollout status deploy/portal-opl -n default
RUN_PORTAL_RECOVERY_LIVE=1 node scripts/live-test-v19-postgres-redis-restart-recovery.mjs
```

## Step 7：full user E2E 双阶段 gate

目的：

用自动生成的新测试用户跑完整商业链路，并把当天 E2E 与次日 exact bill E2E 分开验收。

为什么要做：

单点 smoke 不能证明商业产品闭环。v19 必须有一条从用户创建到资源删除、从预扣到停止计费增长的当天证据链；exact bill、refund/makeup 和幂等则必须等真实 COS 日结账单投递后再验收。

怎么做：

Step 7A，same-day full user E2E：

1. 自动创建测试用户、tenant 和 workspace。
2. 给测试用户充值。
3. 登录 Portal 和 OPL。
4. 购买至少 10GB storage。
5. 选择 live 可售 SKU。
6. quote 和 preauth。
7. 创建 TKE 资源。
8. 确认 TKE/CVM/Pod/Job/PVC/COS object 或相关 resource metadata 带完整 v19 归因标签。
9. 确认 resource-provisioner 资源映射 evidence endpoint 能查到同一条资源链。
10. OPL 输入 provider API key 并发送真实消息。
11. 生成 run、trace、artifact。
12. Portal 展示 workspace file、pending bill、session trace。
13. 用户下载 artifact。
14. 删除服务器。
15. 验证 pending cost 停止增长，且云资源 cleanup 无残留。
16. 再次查询资源映射 evidence endpoint，确认 `billingStoppedAt` 和 cleanup 状态已回写。

Step 7B，T+1 full user bill E2E：

1. 等待 Step 7A 对应日期的 COS 分账明细 zip 投递。
2. 先只读确认 zip 中目标标签列是否出现 Step 7A 资源链值，并确认它们是原始 ID 还是云标签归一化值。
3. 用 Step 7A 的 tenant/workspace/resourceOrder/run/serverPlan 原始 ID 和云标签归一化值查找真实账单行；查找必须锁定对应日期的具体 zip object key。
4. 执行 exact bill reconcile。
5. 验证 refund 或 makeup。
6. 重复 reconcile 验证幂等。

历史版本中完整链路如下，Step 7A 覆盖 1 到 13，Step 7B 覆盖 14：

1. 创建测试用户。
2. 给测试用户充值。
3. 登录 Portal 和 OPL。
4. 购买至少 10GB storage。
5. 选择 live 可售 SKU。
6. quote 和 preauth。
7. 创建 TKE 资源。
8. OPL 输入 provider API key 并发送真实消息。
9. 生成 run、trace、artifact。
10. Portal 展示 workspace file、pending bill、session trace。
11. 用户下载 artifact。
12. 删除服务器。
13. 验证 pending cost 停止增长。
14. T+1 exact bill 后验证 refund 或 makeup。

验收：

- Step 7A 通过：每一步都有 request id、run id、resourceOrder id 或 ledger id。
- artifact 对象真实存在于 workspace COS prefix。
- artifact 下载必须有独立证据：HTTP 状态、对象 key、文件大小或 checksum。
- Portal 对 workspace file、pending bill、session trace 的展示必须分别有证据，不能用单个 E2E 成功概括。
- 用户只能看到自己的订单、文件、账单和 trace。
- 删除后资源和计费都停止。
- 资源映射 evidence endpoint 能查询到创建、计费开始、删除请求、计费停止和清理状态。
- Step 7A 的资源归因标签完整，能为 Step 7B 的 COS zip 归因提供目标键值；这一步要确认 tenant/workspace/resourceOrder/run/serverPlan 与 TKE/CVM/Pod/Job/PVC/COS object 或 resource metadata 是同一条链。
- Step 7B 通过：真实 COS zip 中存在 Step 7A 对应标签行，或通过账单资源 ID 唯一命中 Step 7A resource mapping；证据必须记录具体 zip object key、匹配账单行、匹配资源 ID、resourceMappingId、exact settlement ledger id、refund/makeup ledger id 或 charged ledger id，以及重复执行前后 ledger 不变。
- 证据文档不包含 Secret。

测试命令：

```bash
RUN_V19_LIVE_E2E=1 V19_LIVE_E2E_PHASE=same_day node scripts/live-test-v19-user-e2e.mjs
COS_LIVE_BILL_OBJECT_KEY='<target-zip>' RUN_V19_LIVE_E2E=1 V19_LIVE_E2E_PHASE=t1_bill node scripts/live-test-v19-user-e2e.mjs
node scripts/smoke-test-v19-tenant-rbac-matrix.mjs
node scripts/smoke-test-v19-opl-real-message.mjs
node scripts/smoke-test-v19-runtime-output-storage-gate.mjs
node scripts/smoke-test-v19-workspace-delete-retention.mjs
node scripts/smoke-test-billing-resource-attribution.mjs
```

## Step 8：结构质量双门禁

目的：

把 v19 的结构质量重新拉回原计划目标，或者把产品 runtime 结构门禁和 live gate/smoke 合同门禁正式拆开，并说明理由。

为什么要做：

当前分支虽然曾经达到过 `check_rules=pass`，但补入 live gate、same-day E2E、COS zip reader 和资源映射脚本后，整仓 `sentrux check .` 已经失败。只把所有文件放在一个结构分数里，会把两个不同责任面混在一起：线上产品 runtime 的模块边界，以及上线证据脚本的合同真实性。

这一步不能靠口头降级。必须明确双门禁：

- Step 8A：产品 runtime 结构门禁，保护真正上云运行的服务代码。
- Step 8B：live gate/smoke 合同门禁，保护证据脚本的真实性、拒绝误跑、资源归因和 cleanup 行为。

怎么做：

Step 8A，产品 runtime 结构门禁：

1. 建立行为锁测试，先锁住 Portal runtime、Portal store、Gateway、Billing 的关键行为。
2. 拆分 `portal-runtime.mjs` 和 `portal-store.mjs` 中稳定职责，禁止为了追分做无行为锁的机械搬移。
3. 保持模块边界：Portal 不读腾讯云 Secret，Gateway 不读 Portal DB，Provisioner 不扣费。
4. 每次拆分后跑 Sentrux，并记录整仓结果与产品代码-only 结果。
5. 如果目标必须修订，必须写明新的数值、扫描范围、原因和替代门禁。

Step 8B，live gate/smoke 合同门禁：

1. 所有 live 脚本必须在没有显式 live 开关时拒绝执行。
2. COS exact bill gate 必须支持指定具体 zip object key，并支持通过 `kubectl_exec` 在集群内访问 `billing-aggregator`，避免依赖本地 port-forward。
3. 资源映射、cleanup、billing matching、COS target matching 必须有合同 smoke。
4. live gate 只能把不可归因账单写成失败证据或 unattributed queue，不能为了通过而伪造匹配。
5. 文档证据必须引用脚本输出的 `.runtime` evidence，不能只写人工判断。

验收：

- Step 8A 通过：产品 runtime 结构门禁通过，或有经过批准的结构目标修订；DSM 依赖方向干净；新功能没有继续堆进 `portal-runtime.mjs`、`portal-store.mjs`、`billing server.mjs`。
- Step 8B 通过：live gate/smoke 合同全过；脚本无显式 live 开关时拒绝执行；`kubectl_exec`、COS object key 指定、target matching、resource mapping、cleanup guard、unattributed 行为均有测试。
- 如果整仓 Sentrux 继续保留为信息性报告，不能把它当成唯一口径；必须同时记录产品代码-only 结构结果和 live gate 合同结果。
- 在 Step 8A/8B 都未通过或未被正式批准前，Step 9A 不能写成通过。

测试命令：

```bash
node --check services/portal/src/app/portal-runtime.mjs
node --check services/portal/src/state/portal-store.mjs
node --check scripts/live-test-v19-cos-exact-bill-reconcile.mjs
node scripts/check-one-person-lab-upstream-clean.mjs
node scripts/check-v18-module-boundaries.mjs
node scripts/check-v18-large-files.mjs
node scripts/smoke-test-v19-cos-live-kubectl-transport-contract.mjs
node scripts/smoke-test-v19-cos-target-matching-contract.mjs
node scripts/smoke-test-v19-live-cleanup-guard-contract.mjs
node scripts/smoke-test-resource-provisioner-resource-mapping-contract.mjs
node scripts/smoke-test-billing-resource-attribution.mjs
# Sentrux / Scan: rescan health check_rules session_end
```

## Step 9：rollout 决策与证据封版双阶段 gate

目的：

按证据阶段决定是否允许受控上云、是否允许宣布商业化完成，而不是先滚后补解释。

为什么要做：

v19 的发布风险集中在真实云资源、账单、恢复、Secret 和多租户边界。由于 COS 账单是日结，rollout 决策必须区分 same-day gate 和 T+1 gate：当天证据齐全可以进入受控灰度；T+1 exact bill 未通过前，不能宣称商业化正式完成。

怎么做：

Step 9A，same-day controlled rollout gate：

1. 汇总 Step 1 到 Step 8A/8B 的证据。
2. 更新 release note、rollout plan、commercialization assessment、live E2E evidence。
3. 明确 Step 9A 的 same-day rollout gate：Step 2、Step 3、Step 4、Step 5A、Step 6、Step 7A、Step 8A、Step 8B 必须通过，或者 Step 8A/8B 有正式批准的门禁修订。
4. 明确内测单集群双节点池策略：平台节点池运行控制面服务，运行节点池运行用户 Job/Pod；所有 server plan 必须携带运行节点池的 `nodeSelector`/`tolerations`。
5. 明确 resource-provisioner 资源映射账本为 P0 evidence source。
6. 明确允许受控 rollout 的服务顺序。
7. 明确 rollback 触发条件。
8. 如果 same-day P0 未完成，保持 `Do not roll v19`。
9. 如果 same-day P0 已完成但 T+1 未完成，只能写成 `controlled live candidate`，不能写成 `commercialization complete`。

Step 9B，T+1 commercialization completion gate：

1. 等待 Step 5A/7A 对应日期真实 COS zip 到达。
2. 先只读 preview 对应日期的具体 zip object key，确认目标标签列是否有值，并确认值是原始 `tenant/workspace/resourceOrder/run/serverPlan`，还是腾讯云云标签归一化后的 `tenantid/workspaceid/resourceorderid/runid/serverplanid`。
3. 用 Step 7A 证据链的原始 ID 和云标签值同时匹配目标账单行。
4. 执行 Step 5B/7B exact reconcile、refund/makeup 和幂等验证。
5. Step 5B 和 Step 7B 通过后，才允许把 v19 写成商业化完成。

验收：

- Step 9A 通过：same-day P0 gate 通过并有证据后，才允许受控上云。
- Step 9B 通过：T+1 exact bill gate 通过并有证据后，才允许封版为商业化完成。
- 云上主服务镜像升级计划可执行。
- rollback 可以按服务逐个回退。
- 文档没有夸大 live 状态。release note、commercialization assessment、live evidence、current status 的口径必须一致：Step 9A 只能写 `controlled live candidate`，Step 9B 通过后才能写 `commercialization complete`。

测试命令：

```bash
node --check scripts/*.mjs
node scripts/check-production-entry-performance.mjs --json
node scripts/smoke-test-v19-entry-health.mjs
node scripts/smoke-test-v19-opl-websocket-business-session.mjs
node scripts/smoke-test-v19-sku-discovery-live.mjs
node scripts/smoke-test-portal-commercial-saas.mjs
rg -n "commercialization complete|controlled live candidate|Step 5B|Step 7B|Step 8A|Step 8B|Step 9A|Step 9B" docs/releases docs/reports docs/plan
```

## 推荐执行顺序

第一批并行：

- Step 0：主 agent 执行，不能委派，因为它决定当前基线。
- Step 1：Subagent A 执行，只读云上状态。
- Step 8A/8B：Subagent E 执行结构质量预研和行为锁，不接触云上；主 agent 或 billing lane 补 live gate 合同。

第二批并行：

- Step 2：Subagent B 修 `billing-reconcile`。
- Step 3：Subagent B 或独立 billing/SKU subagent 取 live SKU 证据。
- Step 4：Subagent C 写 TKE cleanup gate。
- Step 6：Subagent D 或独立 Portal recovery subagent 写恢复 gate。

第三批串联：

- Step 5A 和 Step 7A 必须在 Step 2、Step 3、Step 4、Step 6 都通过后执行。
- Step 5B 和 Step 7B 必须在对应日期真实 COS zip 投递且包含完整 v19 标签后执行。
- Step 9 的 same-day rollout 决策必须在 Step 5A/7A 通过后执行；商业化完成决策必须等 Step 5B/7B 通过。

## 完成定义

v19 补充任务完成，不是指文档写完，也不是指本地 smoke 通过，而是满足以下条件：

- 云上 `billing-reconcile` 健康，并能成功跑一次 reconcile。
- live SKU 非零报价证据存在。
- live TKE create/delete cleanup 通过，无资源残留。
- same-day preauth、pending usage、delete 后停止增长和资源标签完整证据存在。
- resource-provisioner 资源映射账本可查询创建、计费开始、删除、计费停止、清理状态和残留数量。
- 内测单集群双节点池调度隔离通过：平台服务固定在平台节点池，用户 run/Job/Pod 固定在运行节点池。
- live COS exact bill reconcile 有真实日结 zip 证据，并且 zip 内存在完整 v19 标签行。
- Portal PostgreSQL/Redis restart recovery 通过。
- full user E2E Step 7A 当天闭环通过，Step 7B 次日 exact bill 闭环通过。
- Step 8A 产品 runtime 结构门禁和 Step 8B live gate/smoke 合同门禁均达标，或有正式批准的门禁修订。
- release、rollout、assessment、live evidence 文档全部更新。
- `one-person-lab` upstream 保持 clean。
- 没有 Secret 进入 git、文档、日志或镜像。

只有这些条件全部满足，v19 才能从“商业化候选”改为“可滚云验收版本”。
