# OPL v19 Live Gates 补充 AI 开发方案

日期：2026-05-01

分支：`codex/opl-v19`

当前工作区：`/home/dev/projects/platform-v19`

## 结论

v19 不能继续按“已经完成商业化版本”推进。它现在是一个本地合同和 smoke 覆盖增强后的商业化候选分支，但还缺少生产云上证据。下一步应拆成 10 个 step，其中 Step 0 是接管校准，Step 1 到 Step 9 是补齐 live gate、账单闭环、恢复证据、结构门禁和 rollout 决策。

本补充方案的目标不是继续堆 UI 或文档，而是把 v19 从“本地可验证”推进到“云上可验收”。每个 step 必须有明确的输入、写入范围、验收命令和证据文件；不能用模拟结果替代明确要求 live 的验收项。

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
4. 触发删除。
5. 轮询确认 node pool、CVM、Pod、pending usage 状态归零或停止增长。
6. 输出 cleanup evidence JSON 到 `.runtime/`，不要写进源码树。

验收：

- 没有显式 live 开关时脚本拒绝执行。
- create 成功并有完整标签。
- delete 成功并证明无残留资源。
- 删除后 pending cost 停止增长。
- 失败时脚本输出可执行的清理对象 ID。

测试命令：

```bash
RUN_TKE_LIVE=1 node scripts/live-test-v19-tke-create-delete-cleanup.mjs
kubectl get pods -n default --show-labels
```

## Step 5：live COS exact bill reconcile

目的：

证明 COS daily bill 可以进入 exact bill 回补，并正确形成 refund 或 makeup charge。

为什么要做：

storage 已被商品化，但没有真实 exact bill 回补，就不能证明长期计费准确。

怎么做：

1. 等待或准备真实 COS `daily/` bill 文件。
2. 只读取真实 bill，不用伪造 daily bill 替代 live gate。
3. 将 bill item 归因到 tenant/workspace/resourceOrder/run。
4. 对无法归因的账单进入 unattributed queue。
5. 对可归因账单写入 exact charge、refund 或 makeup。
6. 重复执行验证幂等。

验收：

- 至少一条真实 COS exact bill 被处理。
- 可归因账单进入正确 ledger。
- 不可归因账单进入 queue。
- 重复执行不重复扣费或退款。

测试命令：

```bash
node scripts/smoke-test-v19-unattributed-bill-queue.mjs
node scripts/smoke-test-v19-t1-settlement-refund.mjs
node scripts/smoke-test-v19-t1-settlement-makeup.mjs
RUN_COS_LIVE=1 node scripts/live-test-v19-cos-exact-bill-reconcile.mjs
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

## Step 7：full user E2E

目的：

用一个新测试用户跑完整商业链路，证明 v19 用户路径真实可用。

为什么要做：

单点 smoke 不能证明商业产品闭环。v19 必须有一条从用户创建到资源删除、从预扣到 exact bill 的完整证据链。

怎么做：

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

- 每一步都有 request id、run id、resourceOrder id 或 ledger id。
- artifact 对象真实存在于 workspace COS prefix。
- 用户只能看到自己的订单、文件、账单和 trace。
- 删除后资源和计费都停止。
- 证据文档不包含 Secret。

测试命令：

```bash
RUN_V19_LIVE_E2E=1 node scripts/live-test-v19-user-e2e.mjs
node scripts/smoke-test-v19-tenant-rbac-matrix.mjs
node scripts/smoke-test-v19-opl-real-message.mjs
node scripts/smoke-test-v19-runtime-output-storage-gate.mjs
node scripts/smoke-test-v19-workspace-delete-retention.mjs
```

## Step 8：Sentrux 质量门禁修复

目的：

把 v19 的结构质量重新拉回原计划目标，或者正式修订目标并说明理由。

为什么要做：

当前分支虽然 `check_rules=pass`，但 `quality_signal` 低于原计划的 `6988`。如果不处理，v19 的工程质量标准会变成口头标准。

怎么做：

1. 建立行为锁测试，先锁住 Portal runtime、Portal store、Gateway、Billing 的关键行为。
2. 拆分 `portal-runtime.mjs` 和 `portal-store.mjs` 中稳定职责，禁止为了追分做无行为锁的机械搬移。
3. 保持模块边界：Portal 不读腾讯云 Secret，Gateway 不读 Portal DB，Provisioner 不扣费。
4. 每次拆分后跑 Sentrux `session_end`。
5. 如果目标必须修订，必须写明新的数值、原因和替代门禁。

验收：

- `check_rules=pass`。
- DSM 依赖方向干净。
- `quality_signal >= 6988`，或有经过批准的目标修订文档。
- 新功能没有继续堆进大文件。

测试命令：

```bash
node --check services/portal/src/app/portal-runtime.mjs
node --check services/portal/src/state/portal-store.mjs
node scripts/check-one-person-lab-upstream-clean.mjs
node scripts/check-v18-module-boundaries.mjs
node scripts/check-v18-large-files.mjs
# Sentrux / Scan: rescan health check_rules session_end
```

## Step 9：rollout 决策与证据封版

目的：

在证据齐全后决定是否滚 v19，而不是先滚后补解释。

为什么要做：

v19 的发布风险集中在真实云资源、账单、恢复、Secret 和多租户边界。只有证据齐全后才能进入 rollout。

怎么做：

1. 汇总 Step 1 到 Step 8 的证据。
2. 更新 release note、rollout plan、commercialization assessment、live E2E evidence。
3. 明确允许 rollout 的服务顺序。
4. 明确 rollback 触发条件。
5. 如果任一 P0 未完成，保持 `Do not roll v19`。

验收：

- 所有 P0 gate 通过并有证据。
- 云上主服务镜像升级计划可执行。
- rollback 可以按服务逐个回退。
- 文档没有夸大 live 状态。

测试命令：

```bash
node --check scripts/*.mjs
node scripts/check-production-entry-performance.mjs --json
node scripts/smoke-test-v19-entry-health.mjs
node scripts/smoke-test-v19-opl-websocket-business-session.mjs
node scripts/smoke-test-v19-sku-discovery-live.mjs
node scripts/smoke-test-portal-commercial-saas.mjs
```

## 推荐执行顺序

第一批并行：

- Step 0：主 agent 执行，不能委派，因为它决定当前基线。
- Step 1：Subagent A 执行，只读云上状态。
- Step 8：Subagent E 执行结构质量预研和行为锁，不接触云上。

第二批并行：

- Step 2：Subagent B 修 `billing-reconcile`。
- Step 3：Subagent B 或独立 billing/SKU subagent 取 live SKU 证据。
- Step 4：Subagent C 写 TKE cleanup gate。
- Step 6：Subagent D 或独立 Portal recovery subagent 写恢复 gate。

第三批串联：

- Step 5 必须在账单和 COS daily 文件条件满足后执行。
- Step 7 必须在 Step 2、Step 3、Step 4、Step 6 都通过后执行。
- Step 9 必须在所有 P0 证据齐全后执行。

## 完成定义

v19 补充任务完成，不是指文档写完，也不是指本地 smoke 通过，而是满足以下条件：

- 云上 `billing-reconcile` 健康，并能成功跑一次 reconcile。
- live SKU 非零报价证据存在。
- live TKE create/delete cleanup 通过，无资源残留。
- live COS exact bill reconcile 有真实 daily bill 证据。
- Portal PostgreSQL/Redis restart recovery 通过。
- full user E2E 通过。
- Sentrux 质量门禁达标，或有正式批准的门禁修订。
- release、rollout、assessment、live evidence 文档全部更新。
- `one-person-lab` upstream 保持 clean。
- 没有 Secret 进入 git、文档、日志或镜像。

只有这些条件全部满足，v19 才能从“商业化候选”改为“可滚云验收版本”。
