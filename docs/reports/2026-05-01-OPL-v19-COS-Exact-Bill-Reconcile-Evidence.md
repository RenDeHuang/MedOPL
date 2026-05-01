## OPL v19 COS Exact Bill Reconcile Evidence

日期：2026-05-01
分支：`codex/opl-v19`
脚本：`scripts/live-test-v19-cos-exact-bill-reconcile.mjs`
状态：`BLOCKED_ON_TAGGED_EXACT_BILL`

## 本轮结论（2026-05-01 12:16 CST 到 14:08 CST）

本轮已确认用户补充的信息：bucket `opl-1410708315` 里存在真实腾讯云分账明细 zip，但 zip 不在 `daily/` 前缀下，而在 bucket 根目录。

真实只读 preview 结果：

```json
{
  "ok": true,
  "preview": true,
  "reconciled": false,
  "latestFile": {
    "key": "100047070895-20260430-分账报表-明细账单.zip",
    "size": 55926,
    "lastModified": "2026-04-30T22:19:51.000Z"
  },
  "parsedRowCount": 1865,
  "attributedCount": 0,
  "unattributedCount": 1865,
  "totalCost": 0
}
```

这证明 Step 5 已经从“无真实账单文件”推进到“真实 zip 可读取、可解包、可解析 1865 行”。但它仍不能算 live exact bill reconcile 通过，因为当前账单行没有命中 v19 要求的完整标签：

- `resource_order_id`
- `run_id`
- `server_plan_id`
- `tenant_id`
- `workspace_id`

第一批未归因样本的标签字段归一化后均为空，成本字段可读：

```json
[
  { "resourceOrderId": "", "runId": "", "serverPlanId": "", "tenantId": "", "workspaceId": "", "totalCost": 19.2 },
  { "resourceOrderId": "", "runId": "", "serverPlanId": "", "tenantId": "", "workspaceId": "", "totalCost": 4.8 },
  { "resourceOrderId": "", "runId": "", "serverPlanId": "", "tenantId": "", "workspaceId": "", "totalCost": 16 }
]
```

真实表头确认：

- 账单共有 68 个表头。
- 真实 zip 内确实存在 v19 预期的 5 个标签列：
  - `标签键:resourceorderid`
  - `标签键:runid`
  - `标签键:serverplanid`
  - `标签键:tenantid`
  - `标签键:workspaceid`
- 全量 1865 行计数：
  - `anyTagged=0`
  - `fullTagged=0`
  - 以上 5 个标签列的有效值计数均为 0

因此，当前根因不是 zip 解包失败、中文表头识别失败或别名漏识别，而是这份历史账单本身没有 v19 测试资源完整标签值。

因此 Step 5 的当前准确状态是：

- 真实 COS zip 账单读取：已验证。
- root prefix 读取：本地实现已验证。
- 中文对象 key 签名和下载：已验证。
- 中文账单字段解析：已验证。
- `"-"` / `null` / `n/a` 标签值不再误判为归因：已验证。
- exact bill 归因和 settlement：未完成，原因是当前真实历史账单没有 v19 测试资源完整标签。
- 云上 deployment/CronJob 配置：`deployment/billing-aggregator-opl` 与 `cronjob/billing-reconcile` 都已经切到 `uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl:opl-v19-coszip-root-pgfix-20260501-79051d7`，且 `TENCENT_COS_BILL_PREFIX` 已是空前缀；这只属于 billing 修复，不代表整套 v19 rollout。
- `/billing/cos/reconcile` 语义：当前应视为 preview；`reconciled=false`，`hasAttributableRows` 仅表示预览阶段发现可归因行，不代表已经执行 settlement。
- Step 2 手动 Job：先前在 `opl-v19-coszip-root-20260501-79051d7` 上失败，根因是镜像内缺失 Node 依赖 `pg`；当前已通过 pgfix 镜像验证恢复。

已确认并修复的实现缺口：

- `adapters/billing-aggregator/src/cos-bill-reader.mjs` 之前只把 COS 对象按明文 `text()` 读取，再按 `.json` 或分隔文本解析；`.zip` 虽然能被列出，但不会被正确解包。
- 现已补齐严格 zip 解析：
  - 读取 zip 对象时走二进制 `arrayBuffer() -> Buffer`
  - 严格解析 central directory / local header
  - 仅接受单一 bill entry，且 entry 类型只允许 `.json` / `.csv` / `.tsv`
  - 仅接受 ZIP store(0) / deflate(8)
  - 校验未加密、边界、uncompressed size、CRC32
  - 对空 zip、多 entry、无支持类型、压缩方式不支持等场景给出明确错误码
- 新增本地 smoke：`scripts/smoke-test-billing-cos-zip-reader.mjs`
  - 验证 zip 文件可列出
  - 验证 zip 内账单可解析
  - 验证 `/billing/cos/reconcile` preview 能完成标签归因
  - 验证空 zip / 多文件 zip 的可诊断错误

## 本轮本地验证

已实际执行并通过：

```bash
node scripts/smoke-test-v13-cos-bill-reader.mjs
node scripts/smoke-test-billing-cos-zip-reader.mjs
node scripts/smoke-test-billing-aggregator-dockerfile-deps.mjs
node --check adapters/billing-aggregator/src/cos-bill-reader.mjs
node --check adapters/billing-aggregator/src/server.mjs
node --check scripts/smoke-test-billing-cos-zip-reader.mjs
node --check scripts/live-test-v19-cos-exact-bill-reconcile.mjs
```

本地 zip smoke 结果：

- `listFiles` 能返回 `.zip` 对象
- `parseLatestFile()` 能解析 zip 内单文件 bill
- `/billing/cos/reconcile` preview 返回：
  - `latestFile.key=daily/cos-bill-2026-05-01.zip`
  - `parsedRowCount=1`
  - `attributedCount=1`
  - `pricingSource=tencent_cos_daily_bill`
- 空 zip 明确失败：`cos_bill_zip_no_entries`
- 多 entry zip 明确失败：`cos_bill_zip_multiple_entries`

## 本轮真实 COS preview

本轮使用真实 `tencent-cos-secret` / `tencent-billing-secret` 对 bucket `opl-1410708315` 做只读 preview。没有把 Secret 值写入仓库、文档或日志。

关键差异：

- 云上 deployment/CronJob 当前配置已经是 `TENCENT_COS_BILL_PREFIX=""`。
- 真实可用 zip 在 bucket 根目录。
- 云上 live 接口现在已经能直接列出并解析该 root zip。
- 这解释了早前 `/billing/cos/files` 返回 `fileCount=0` 的原因：当时不是 bucket 无账单，而是 prefix 配置不匹配。

## Step 5 live gate 真实数据要求

根据 `docs/plan/2026-05-01-OPL-v19-Live-Gates-Supplement-AI-Dev-Plan.md` 与脚本实现，live COS exact bill reconcile 需要同时满足：

- 真实 COS bill 文件已经投递到生产 bucket/prefix。当前真实位置是 bucket 根目录，不是 `daily/`。
- 账单中至少存在 1 条可归因 exact bill，且标签同时覆盖：
  - `resource_order_id`
  - `run_id`
  - `server_plan_id`
  - `tenant_id`
  - `workspace_id`
- `/billing/cos/status` 可读，且 `readable=true`。
- `/billing/cos/files` 至少能列出目标 bill 文件，文件大小大于 0。
- `/billing/cos/reconcile` 能在 preview 阶段识别该文件，`exactSource` 必须为 `tencent_cos_daily_bill`。
- live 脚本显式环境变量要求：
  - 必填：`RUN_COS_LIVE=1`
  - base URL：`COS_LIVE_BILLING_BASE_URL`，或回退到 `BILLING_BASE_URL` / `BILLING_SERVICE_URL` / `BILLING_RECONCILE_URL`
  - target：`COS_LIVE_EXPECT_TENANT_ID`、`COS_LIVE_EXPECT_WORKSPACE_ID`、`COS_LIVE_EXPECT_RESOURCE_ORDER_ID`、`COS_LIVE_EXPECT_RUN_ID`、`COS_LIVE_EXPECT_SERVER_PLAN_ID`
  - bill locator：二选一
    - `COS_LIVE_BILL_OBJECT_KEY`
    - `COS_LIVE_BILL_BUCKET` + `COS_LIVE_BILL_REGION` + `COS_LIVE_BILL_PREFIX`，可选 `COS_LIVE_BILL_ENDPOINT`
  - 可选：`COS_LIVE_RECONCILE_WINDOW`、`COS_LIVE_TIMEOUT_MS`
- 第一次 `/reconcile` 必须对目标 `runId` 产生一次真实 settlement：`charged` / `refund` / `makeup_charge`
- 第二次 `/reconcile` 不得再次对同一 `runId` 产生 settlement

## 只读 K8s 盘点

### Secret 存在性与 key 名

- `tencent-billing-secret`
  - `TENCENT_CLOUD_SECRET_ID`
  - `TENCENT_CLOUD_SECRET_KEY`
- `tencent-cos-secret`
  - `TENCENT_CLOUD_SECRET_ID`
  - `TENCENT_CLOUD_SECRET_KEY`

### billing-reconcile CronJob

- 对象：`cronjob/billing-reconcile`
- 镜像：`uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl:opl-v19-coszip-root-pgfix-20260501-79051d7`
- command：通过 `BILLING_RECONCILE_ONCE=1` 触发单次 reconcile
- 显式 env：
  - `PORT=0`
  - `BILLING_RECONCILE_ONCE=1`
  - `TENCENT_BILLING_ENABLED=1`
  - `TENCENT_BILLING_REQUIRED=0`
  - `TENCENT_PRICE_ENABLED=1`
  - `TENCENT_CLOUD_REGION=na-siliconvalley`
  - `TENCENT_COS_BILL_BUCKET=opl-1410708315`
  - `TENCENT_COS_BILL_REGION=na-siliconvalley`
  - `TENCENT_COS_BILL_PREFIX=`
  - `TENCENT_PRICE_IMAGE_ID=img-487zeit5`
  - `TENCENT_COS_BILL_ENDPOINT=https://opl-1410708315.cos.na-siliconvalley.myqcloud.com`
- 手动 Job 实测：
  - Job：`billing-reconcile-manual-cos-20260501-140540`
  - 结果：`BackoffLimitExceeded`，两次 Pod 都是 `Error`
  - Pod：`billing-reconcile-manual-cos-20260501-140540-snqxq`、`billing-reconcile-manual-cos-20260501-140540-zqrjg`
  - 日志摘要：`Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'pg' imported from /app/src/server.mjs`
- pgfix 后手动 Job 实测：
  - 修复：`adapters/billing-aggregator/Dockerfile` 增加 `npm ci --omit=dev`
  - 镜像：`uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl:opl-v19-coszip-root-pgfix-20260501-79051d7`
  - Digest：`sha256:1b0bfb64ae53dfbab347ceaa3a4bc0cd996c3a2a3800f5d22e90f3d0d7e286fa`
  - Job：`billing-reconcile-manual-pgfix-20260501061659`
  - 结果：`Complete`，`succeeded=1`

### billing-aggregator-opl Deployment

- 对象：`deployment/billing-aggregator-opl`
- 镜像：`uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl:opl-v19-coszip-root-pgfix-20260501-79051d7`
- Secret 引用：
  - `TENCENT_COS_SECRET_ID <- secret/tencent-cos-secret:TENCENT_CLOUD_SECRET_ID`
  - `TENCENT_COS_SECRET_KEY <- secret/tencent-cos-secret:TENCENT_CLOUD_SECRET_KEY`
  - `TENCENT_CLOUD_SECRET_ID <- secret/tencent-billing-secret:TENCENT_CLOUD_SECRET_ID`
  - `TENCENT_CLOUD_SECRET_KEY <- secret/tencent-billing-secret:TENCENT_CLOUD_SECRET_KEY`
- 显式 env：
  - `TENCENT_BILLING_ENABLED=1`
  - `TENCENT_BILLING_REQUIRED=0`
  - `TENCENT_PRICE_ENABLED=1`
  - `TENCENT_CLOUD_REGION=na-siliconvalley`
  - `TENCENT_BILLING_ENDPOINT=billing.tencentcloudapi.com`
  - `TENCENT_COS_BILL_BUCKET=opl-1410708315`
  - `TENCENT_COS_BILL_REGION=na-siliconvalley`
  - `TENCENT_COS_BILL_PREFIX=`
  - `TENCENT_COS_BILL_ENDPOINT=https://opl-1410708315.cos.na-siliconvalley.myqcloud.com`
  - `BUILD_SHA=79051d7+v19-coszip-root`
  - `BUILD_TIME=2026-05-01T06:10:00Z`

结论：从安全 env / Secret 引用层面，已能确认真实 COS bill bucket/root prefix 为：

- bucket：`opl-1410708315`
- region：`na-siliconvalley`
- prefix：``
- endpoint：`opl-1410708315.cos.na-siliconvalley.myqcloud.com`

## 脚本 guard / dry-run 行为

执行结果：

1. `node scripts/live-test-v19-cos-exact-bill-reconcile.mjs`
   - 脚本按预期拒绝执行，返回 `RUN_COS_LIVE_REQUIRED`
2. `RUN_COS_LIVE=1 node scripts/live-test-v19-cos-exact-bill-reconcile.mjs`
   - 已在当前工作区修复为结构化失败证据，错误为 `billing_base_url_required`
   - Evidence JSON 示例：`.runtime/cos-exact-bill-reconcile/2026-05-01T02-19-38-667Z.json`

脚本修复说明：

- `buildConfig()` 已纳入结构化错误处理。
- 只要 `RUN_COS_LIVE=1` 已设置、但其余必填环境变量缺失，脚本会写入 `.runtime/cos-exact-bill-reconcile/*.json`，不会直接抛未捕获异常栈。
- 这只是脚本健壮性修复，不改变 Step 5 的验收状态；当前 root zip 可读，但没有带完整 v19 标签值的真实 bill 行时仍然不能通过。

## live 接口只读结果

通过 Kubernetes API service proxy 访问 `service/billing-aggregator:3001`：

### `/billing/cos/status`

- `ok=true`
- `credentialsConfigured=true`
- `source=tencent_cloud_cos_bill_delivery`
- `bucket=opl-1410708315`
- `region=na-siliconvalley`
- `prefix=`
- `endpoint=opl-1410708315.cos.na-siliconvalley.myqcloud.com`
- `deliveryConfigured=true`
- `readable=true`
- `latestFile.key=100047070895-20260427-分账报表-明细账单.zip`
- `latestFile.size=819`
- `fileCount=5`
- `lastReadAt=2026-05-01T06:07:56.599Z`

### `/billing/cos/files`

- `ok=true`
- `readable=true`
- `fileCount=50`
- 前 4 个对象就是 bucket 根目录账单 zip：
  - `100047070895-20260427-分账报表-明细账单.zip`
  - `100047070895-20260428-分账报表-明细账单.zip`
  - `100047070895-20260429-分账报表-明细账单.zip`
  - `100047070895-20260430-分账报表-明细账单.zip`
- 返回同时包含其他 root object；当前接口按 bucket 根前缀列出，不只限账单文件。
- `lastReadAt=2026-05-01T06:07:56.660Z`

### `POST /billing/cos/reconcile`

- `ok=true`
- `reconciled=false`
- `preview=true`
- `hasAttributableRows=false`
- `exactSource=tencent_cos_daily_bill`
- `latestFile.key=100047070895-20260430-分账报表-明细账单.zip`
- `latestFile.size=55926`
- `parsedRowCount=1865`
- `attributedCount=0`
- `unattributedCount=1865`
- `totalCost=0`
- `items=[]`
- 未归因样本中 5 个目标标签归一化后均为空字符串
- `lastReadAt=2026-05-01T06:07:59.720Z`

## 结论

当前 Step 5 不能判定通过，必须标记为 `BLOCKED_ON_TAGGED_EXACT_BILL`。

阻塞原因不是凭据缺失，也不是 zip 读取失败，而是当前真实账单缺少可归因标签值：

- Step 2 方面，`deployment/billing-aggregator-opl` 与 `cronjob/billing-reconcile` 的 pgfix 镜像和 root prefix 配置已到位，手动 Job 已成功完成，reconcile 批处理健康已恢复。
- COS bill delivery 配置存在且可读。
- bucket `opl-1410708315` 根目录存在真实 zip。
- 新 reader 可以解析 `100047070895-20260430-分账报表-明细账单.zip` 的 1865 行。
- 该文件包含 v19 预期标签列，但 1865 行中 5 个标签列的有效值计数均为 0。
- 因此不存在可归因 target item，无法生成 `charged` / `refund` / `makeup_charge` 的一次真实结算，也无法验证第二次幂等。

## 如何获取真实数据并解除阻塞

需要先产生一条带完整 v19 标签的真实资源账单，然后再重跑本 gate：

1. 使用 v19 测试 tenant/workspace 创建真实 TKE/COS 资源，确保云资源标签包含：
   - `tenant_id`
   - `workspace_id`
   - `resource_order_id`
   - `run_id`
   - `server_plan_id`
   本轮 Step 4 已经产生过一条候选真实 TKE 资源并完成 cleanup：
   - `tenant_id=test-tenant-v19-0501h`
   - `workspace_id=test-workspace-v19-0501h`
   - `resource_order_id=test-ro-v19-0501h`
   - `run_id=test-run-v19-0501h`
   - `server_plan_id=ma5-medium16`
   - CVM：`ins-h4uz5mky`
   - node pool：`np-59gyia12`
2. 等待腾讯云账单投递生成包含这些标签值的分账明细 zip。
3. 选取该文件内一条带完整标签的 exact bill，记录非敏感 target 值。
4. 提供可访问 billing 服务的 base URL。
5. 以真实值设置：
   - `RUN_COS_LIVE=1`
   - `COS_LIVE_BILLING_BASE_URL=...`
   - `COS_LIVE_EXPECT_TENANT_ID=...`
   - `COS_LIVE_EXPECT_WORKSPACE_ID=...`
   - `COS_LIVE_EXPECT_RESOURCE_ORDER_ID=...`
   - `COS_LIVE_EXPECT_RUN_ID=...`
   - `COS_LIVE_EXPECT_SERVER_PLAN_ID=...`
   - `COS_LIVE_BILL_OBJECT_KEY=...` 或沿用 bucket/region/prefix。当前 root zip 场景需要 `COS_LIVE_BILL_PREFIX=""`。
6. 重新执行 `node scripts/live-test-v19-cos-exact-bill-reconcile.mjs`，确认第一次结算、第二次幂等。

## 本次执行命令

```bash
KUBECONFIG='/mnt/c/Users/Administrator/Downloads/cls-ngiq693i-config (1)' /mnt/c/DockerDesktopBin/kubectl.exe --server='https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443' --insecure-skip-tls-verify=true -n default get deploy billing-aggregator-opl -o jsonpath='{range .spec.template.spec.containers[*].env[*]}{.name}={.value}{"\n"}{end}{range .spec.template.spec.containers[*].envFrom[*]}envFrom:{.secretRef.name}{"\n"}{end}'
KUBECONFIG='/mnt/c/Users/Administrator/Downloads/cls-ngiq693i-config (1)' /mnt/c/DockerDesktopBin/kubectl.exe --server='https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443' --insecure-skip-tls-verify=true -n default get cronjob billing-reconcile -o jsonpath='{.kind}{"\t"}{.metadata.name}{"\t"}{range .spec.jobTemplate.spec.template.spec.containers[*]}{.image}{"\t"}{end}{range .spec.jobTemplate.spec.template.spec.containers[*].env[*]}{.name}={.value}{"\n"}{end}'
KUBECONFIG='/mnt/c/Users/Administrator/Downloads/cls-ngiq693i-config (1)' /mnt/c/DockerDesktopBin/kubectl.exe --server='https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443' --insecure-skip-tls-verify=true -n default create job --from=cronjob/billing-reconcile billing-reconcile-manual-cos-20260501-140540
KUBECONFIG='/mnt/c/Users/Administrator/Downloads/cls-ngiq693i-config (1)' /mnt/c/DockerDesktopBin/kubectl.exe --server='https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443' --insecure-skip-tls-verify=true -n default get job/billing-reconcile-manual-cos-20260501-140540 -o jsonpath='{.status.succeeded}{"\t"}{.status.failed}{"\t"}{.status.startTime}{"\t"}{.status.completionTime}{"\n"}'
KUBECONFIG='/mnt/c/Users/Administrator/Downloads/cls-ngiq693i-config (1)' /mnt/c/DockerDesktopBin/kubectl.exe --server='https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443' --insecure-skip-tls-verify=true -n default get pods -l job-name=billing-reconcile-manual-cos-20260501-140540 -o wide
KUBECONFIG='/mnt/c/Users/Administrator/Downloads/cls-ngiq693i-config (1)' /mnt/c/DockerDesktopBin/kubectl.exe --server='https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443' --insecure-skip-tls-verify=true -n default logs job/billing-reconcile-manual-cos-20260501-140540 --tail=200
KUBECONFIG='/mnt/c/Users/Administrator/Downloads/cls-ngiq693i-config (1)' /mnt/c/DockerDesktopBin/kubectl.exe --server='https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443' --insecure-skip-tls-verify=true -n default get svc billing-aggregator -o wide
KUBECONFIG='/mnt/c/Users/Administrator/Downloads/cls-ngiq693i-config (1)' /mnt/c/DockerDesktopBin/kubectl.exe --server='https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443' --insecure-skip-tls-verify=true get --raw '/api/v1/namespaces/default/services/billing-aggregator:3001/proxy/billing/cos/status'
KUBECONFIG='/mnt/c/Users/Administrator/Downloads/cls-ngiq693i-config (1)' /mnt/c/DockerDesktopBin/kubectl.exe --server='https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443' --insecure-skip-tls-verify=true get --raw '/api/v1/namespaces/default/services/billing-aggregator:3001/proxy/billing/cos/files'
printf '{}' | KUBECONFIG='/mnt/c/Users/Administrator/Downloads/cls-ngiq693i-config (1)' /mnt/c/DockerDesktopBin/kubectl.exe --server='https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443' --insecure-skip-tls-verify=true create --raw '/api/v1/namespaces/default/services/billing-aggregator:3001/proxy/billing/cos/reconcile' -f -
```
