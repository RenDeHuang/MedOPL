## OPL v19 COS Exact Bill Reconcile Evidence

日期：2026-05-01
分支：`codex/opl-v19`
脚本：`scripts/live-test-v19-cos-exact-bill-reconcile.mjs`
状态：`BLOCKED`

## Step 5 live gate 真实数据要求

根据 `docs/plan/2026-05-01-OPL-v19-Live-Gates-Supplement-AI-Dev-Plan.md` 与脚本实现，live COS exact bill reconcile 需要同时满足：

- 真实 COS `daily/` bill 文件已经投递到生产 bucket/prefix。
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
- 镜像：`uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl:opl-v19-live-gates-20260501-a438432`
- command：`node src/server.mjs reconcile`
- 显式 env：
  - `TENCENT_BILLING_ENABLED=1`
  - `TENCENT_BILLING_REQUIRED=0`
  - `TENCENT_PRICE_ENABLED=1`
  - `TENCENT_CLOUD_REGION=na-siliconvalley`
  - `TENCENT_COS_BILL_BUCKET=opl-1410708315`
  - `TENCENT_COS_BILL_REGION=na-siliconvalley`
  - `TENCENT_COS_BILL_PREFIX=daily/`
  - `TENCENT_COS_BILL_ENDPOINT=https://opl-1410708315.cos.na-siliconvalley.myqcloud.com`
- `envFrom`：
  - `tencent-billing-secret`
  - `portal-postgres-redis`
- 状态：
  - `lastScheduleTime=2026-05-01T02:00:00Z`
  - `lastSuccessfulTime=2026-05-01T02:00:07Z`

### billing-aggregator-opl Deployment

- 对象：`deployment/billing-aggregator-opl`
- 镜像：`uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl:opl-v19-live-gates-20260501-a438432`
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
  - `TENCENT_COS_BILL_PREFIX=daily/`
  - `TENCENT_COS_BILL_ENDPOINT=https://opl-1410708315.cos.na-siliconvalley.myqcloud.com`

结论：从安全 env / Secret 引用层面，已能确认真实 COS daily bill bucket/prefix 为：

- bucket：`opl-1410708315`
- region：`na-siliconvalley`
- prefix：`daily/`
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
- 这只是脚本健壮性修复，不改变 Step 5 的验收状态；没有真实 `daily/` bill 文件时仍然不能通过。

## live 接口只读结果

通过 Kubernetes API service proxy 访问 `service/billing-aggregator:3001`：

### `/billing/cos/status`

- `ok=true`
- `credentialsConfigured=true`
- `source=tencent_cloud_cos_bill_delivery`
- `bucket=opl-1410708315`
- `region=na-siliconvalley`
- `prefix=daily/`
- `endpoint=opl-1410708315.cos.na-siliconvalley.myqcloud.com`
- `deliveryConfigured=true`
- `readable=true`
- `latestFile=null`
- `fileCount=0`
- `lastReadAt=2026-05-01T02:05:21.766Z`

### `/billing/cos/files`

- `ok=true`
- `readable=true`
- `fileCount=0`
- `files=[]`
- `lastReadAt=2026-05-01T02:05:21.990Z`

### `POST /billing/cos/reconcile`

- `ok=true`
- `reconciled=false`
- `exactSource=tencent_cos_daily_bill`
- `latestFile=null`
- `parsedRowCount=0`
- `attributedCount=0`
- `unattributedCount=0`
- `totalCost=0`
- `items=[]`
- `unattributed=[]`
- `lastReadAt=2026-05-01T02:05:43.802Z`

## 结论

当前 Step 5 不能判定通过，必须标记为 `BLOCKED`。

阻塞原因不是凭据缺失，而是实时 bill 数据缺失：

- COS bill delivery 配置存在且可读。
- bucket/prefix 已确认是生产真实配置。
- 但截至 `2026-05-01T02:05:43Z`，`daily/` 下没有任何 bill 文件。
- 因此不存在可供 reconcile 的真实 exact bill，更不存在可归因 target item，无法生成 `charged` / `refund` / `makeup_charge` 的一次真实结算，也无法验证第二次幂等。

## 如何获取真实数据并解除阻塞

需要由具备云账单投递控制权限的操作者完成以下动作后，再重跑本 gate：

1. 确认腾讯云 COS 账单投递已对 bucket `opl-1410708315` 的 `daily/` 生效，并等待首个真实 daily bill 文件落地。
2. 选取该文件内一条带完整标签的 COS exact bill，记录以下非敏感 target：
   - `tenant_id`
   - `workspace_id`
   - `resource_order_id`
   - `run_id`
   - `server_plan_id`
3. 提供可访问 billing 服务的 base URL。
4. 以真实值设置：
   - `RUN_COS_LIVE=1`
   - `COS_LIVE_BILLING_BASE_URL=...`
   - `COS_LIVE_EXPECT_TENANT_ID=...`
   - `COS_LIVE_EXPECT_WORKSPACE_ID=...`
   - `COS_LIVE_EXPECT_RESOURCE_ORDER_ID=...`
   - `COS_LIVE_EXPECT_RUN_ID=...`
   - `COS_LIVE_EXPECT_SERVER_PLAN_ID=...`
   - `COS_LIVE_BILL_OBJECT_KEY=daily/...` 或沿用 bucket/region/prefix
5. 重新执行 `node scripts/live-test-v19-cos-exact-bill-reconcile.mjs`，确认第一次结算、第二次幂等。

## 本次执行命令

```bash
sed -n '1,260p' docs/plan/2026-05-01-OPL-v19-Live-Gates-Supplement-AI-Dev-Plan.md
sed -n '1,520p' scripts/live-test-v19-cos-exact-bill-reconcile.mjs
sed -n '1,260p' docs/reports/2026-05-01-OPL-v19-COS-Exact-Bill-Reconcile-Evidence-Template.md

node scripts/live-test-v19-cos-exact-bill-reconcile.mjs
RUN_COS_LIVE=1 node scripts/live-test-v19-cos-exact-bill-reconcile.mjs

/mnt/c/DockerDesktopBin/kubectl.exe --kubeconfig "C:\Users\Administrator\Downloads\cls-ngiq693i-config (1)" --server "https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443" get secret tencent-billing-secret -n default -o go-template='{{.metadata.name}}{{"\n"}}{{range $k, $v := .data}}{{$k}}{{"\n"}}{{end}}'
/mnt/c/DockerDesktopBin/kubectl.exe --kubeconfig "C:\Users\Administrator\Downloads\cls-ngiq693i-config (1)" --server "https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443" get secret tencent-cos-secret -n default -o go-template='{{.metadata.name}}{{"\n"}}{{range $k, $v := .data}}{{$k}}{{"\n"}}{{end}}'
/mnt/c/DockerDesktopBin/kubectl.exe --kubeconfig "C:\Users\Administrator\Downloads\cls-ngiq693i-config (1)" --server "https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443" get cronjob billing-reconcile -n default -o json
/mnt/c/DockerDesktopBin/kubectl.exe --kubeconfig "C:\Users\Administrator\Downloads\cls-ngiq693i-config (1)" --server "https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443" get deploy billing-aggregator-opl -n default -o json
/mnt/c/DockerDesktopBin/kubectl.exe --kubeconfig "C:\Users\Administrator\Downloads\cls-ngiq693i-config (1)" --server "https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443" get svc -n default -o wide

/mnt/c/DockerDesktopBin/kubectl.exe --kubeconfig "C:\Users\Administrator\Downloads\cls-ngiq693i-config (1)" --server "https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443" get --raw "/api/v1/namespaces/default/services/billing-aggregator:3001/proxy/billing/cos/status"
/mnt/c/DockerDesktopBin/kubectl.exe --kubeconfig "C:\Users\Administrator\Downloads\cls-ngiq693i-config (1)" --server "https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443" get --raw "/api/v1/namespaces/default/services/billing-aggregator:3001/proxy/billing/cos/files"
/mnt/c/DockerDesktopBin/kubectl.exe --kubeconfig "C:\Users\Administrator\Downloads\cls-ngiq693i-config (1)" --server "https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443" create --raw "/api/v1/namespaces/default/services/billing-aggregator:3001/proxy/billing/cos/reconcile" -f -
```
