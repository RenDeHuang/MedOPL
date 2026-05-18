# 历史参考文档，不是 v22 active 合同或当前实现入口；不得作为当前主线、smoke、接云或部署依据。

# OPL v21 灰度推云与上线测试方案

日期：2026-05-06

## 文档状态

这是未完成 / 进行中的灰度推云计划。不得自动执行 live/deploy、kubectl、build/push 或真实云资源操作；任何 live-test、部署、推镜像、集群操作和真实云资源创建/删除都必须单独授权。

## 目标

v21 上线必须先证明两个事实：

1. 云端运行的是 `opl-v21`，不是 v20.33。
2. v21 产品主链只保留 Portal、OPL Web Gateway、OPL Web upstream、OPL Adapter、Billing 和 v21 云资源开通能力；不把旧 K8s Job runtime、med-runner、MinIO、Harbor、OpenCost、Rancher、KubeSphere 带回产品链路。

## 产品口径

v21 不是“用户自带云服务器和对象存储”。v21 是平台把 OPL、运行套餐、存储容量、账单核对和运维打包成科研服务：

```text
用户充值
  -> 在 Portal 选择套餐或自定义规格
  -> Portal 在后台开通隔离计算和隔离存储
  -> Portal 冻结一周运维保护金
  -> OPL Full Runtime 在后台隔离计算资源上运行未修改 one-person-lab
  -> 文件和输出写入隔离存储 prefix
  -> 用户释放资源后停止计费
```

因此 v19-v20.34 已验证有效的腾讯云资源创建、资源 ID 绑定、COS 账单核对能力要保留和重构。需要退场的是旧 TKE node pool / K8s Job / runner 作为 OPL runtime 的模型，以及旧运维组件暴露给用户的产品面。

## 上线阶段

### Stage 0: 本地推云前门禁

目的：先证明代码和部署包符合 v21 总则。

命令：

```bash
node scripts/check-v21-user-owned-runtime-boundaries.mjs
node scripts/check-one-person-lab-upstream-clean.mjs
node scripts/update-one-person-lab-upstream.mjs --check-only
node scripts/check-v21-deploy-env.mjs --deploy-env-file /home/dev/.secrets/medopl/tke-v21.env --deploy-secrets-env-file /home/dev/.secrets/medopl/secrets.env.txt --json
node scripts/smoke-test-v21-deploy-env-contract.mjs
node scripts/smoke-test-v21-cloud-readiness-contract.mjs
node scripts/smoke-test-v21-gray-preacceptance-contract.mjs
node scripts/smoke-test-v21-user-owned-full-loop-live-contract.mjs
for f in $(rg --files scripts -g 'smoke-test-v21-*.mjs' | sort); do node "$f"; done
npm --prefix services/portal run check
npm --prefix services/portal/frontend run typecheck
npm --prefix services/opl-runtime-bridge run check
npm --prefix adapters/billing-aggregator run check
sentrux gate .
```

通过标准：

- v21 smoke 全绿。
- Sentrux gate 无退化。
- one-person-lab upstream clean。
- v21 boundary check 不允许旧栈进入产品路径。
- v21 deploy env 必须是非 git 独立文件，不能复用 v20.32/v20.33 旧 env。
- 5 个核心镜像 tag 必须都是 `:opl-v21`。
- env 中不能出现旧 resource-provisioner、med-runner、OpenCost、MinIO、Harbor、Langfuse、Rancher、KubeSphere 等旧栈变量。
- env 可以出现 v21 cloud provisioner 内部需要的腾讯云 CVM/COS/Billing 变量，但必须使用 v21 命名、最小权限 secret 和明确的灰度 namespace/tag。
- Portal 和 OPL 必须分别配置 TLS secret：`PORTAL_TLS_SECRET_NAME` 与 `OPL_TLS_SECRET_NAME`。不能复用单个 `TLS_SECRET_NAME`，也不能与应用 Opaque secret `secret-portal` / `secret-opl` 同名。

### Stage 1: 灰度推云

目的：v21 先在灰度入口跑起来，不直接替换正式 v20.33 流量。

推荐：

```text
namespace: portal-v21-gray
build tag: opl-v21
expected healthz: build.sha=opl-v21
transport: V21_CONNECT_HOST 指向灰度 CLB / Ingress
public host header: portal.medopl.cn / opl.medopl.cn / trace.medopl.cn
ingressClass: qcloud
tls: portal-medopl-tls / opl-medopl-tls
```

灰度环境可以复用正式域名作为 Host/SNI，但请求实际连接到灰度 CLB。脚本保留 `V21_CONNECT_HOST`、`V21_CONNECT_PORT`、`V21_ALLOW_INSECURE_TLS`，用于固定 Host 下的隔离传输。

### Stage 2: 灰度非破坏性验收

目的：验证 v21 入口、登录、Portal/OPL 跳转和只读数据面，不创建云资源。

命令：

```bash
V21_PORTAL_BASE_URL=https://portal.medopl.cn \
V21_OPL_BASE_URL=https://opl.medopl.cn \
V21_TRACE_BASE_URL=https://trace.medopl.cn \
V21_EXPECTED_BUILD_TAG=opl-v21 \
V21_CONNECT_HOST=<gray-clb-or-ingress-ip> \
node scripts/check-v21-cloud-readiness.mjs
```

```bash
RUN_V21_GRAY_PREACCEPTANCE=1 \
V21_PORTAL_BASE_URL=https://portal.medopl.cn \
V21_OPL_BASE_URL=https://opl.medopl.cn \
V21_TRACE_BASE_URL=https://trace.medopl.cn \
V21_EXPECTED_BUILD_TAG=opl-v21 \
V21_CONNECT_HOST=<gray-clb-or-ingress-ip> \
PORTAL_LIVE_EMAIL=<test-user-or-admin> \
PORTAL_LIVE_PASSWORD=<password> \
node scripts/live-test-v21-gray-preacceptance.mjs
```

通过标准：

- Portal、OPL Gateway、Adapter `/healthz` 都是 `opl-v21`。
- 外部 Trace health 不是硬依赖；v21 以 Portal session raw ledger 为轨迹事实源。
- `/portal/api/config` 不出现旧栈 token。
- Portal 登录成功。
- Portal overview、user resources、user-owned resources、billing、session traces API 可读。
- `/portal/opl` 可进入 OPL 启动链路。
- OPL direct login surface 可达。

### Stage 3: 灰度破坏性小闭环

目的：用一个测试用户走 v21 Portal 开通套餐 / 存储容量 / weekly freeze / 文件 / 账单 / 删除资源闭环。

必须显式开启：

```bash
RUN_V21_FULL_LOOP=1 \
V21_CONFIRM_CREATE_RESOURCES=1 \
V21_CONFIRM_DELETE_RESOURCES=1 \
V21_EXPECTED_BUILD_TAG=opl-v21 \
GFLABTOKEN=<gflabtoken> \
node scripts/live-test-v21-user-owned-full-loop.mjs
```

破坏性 gate 默认不执行。没有 `RUN_V21_FULL_LOOP=1`、`V21_CONFIRM_CREATE_RESOURCES=1`、`V21_CONFIRM_DELETE_RESOURCES=1` 三个开关时只写 skip evidence。

通过标准：

- readiness 先通过。
- 创建测试用户，并通过 `/portal/api/admin/users?email=...` 查到真实 `user.id`。
- 用户充值必须使用真实 `userId`，充值后余额必须大于等于充值金额。
- Portal 登录必须返回 `portal_session`。
- OPL API-only login 必须返回 `launchToken` 和 `runtimeSessionId`。
- Lite API-only message 必须真实调用 `/portal-adapter/api/opl-launch/messages`，且 `message.reply` 非空。
- 创建隔离 compute/storage resource；compute 必须有 `runtimeAgentEndpoint`，没有就硬失败。
- compute/storage 必须包含真实腾讯云资源 ID 和 v21 标签，不能只有本地登记元数据。
- 创建 `WorkspaceResourceBinding`。
- 创建 weekly protection freeze。
- OPL full-runtime login 必须返回 `launchToken`、`runtimeSessionId`、`oplSessionId`。
- 文件上传必须走 `/portal/api/workspace/files/upload-url` + `/portal/workspace/files/upload-signed`，并在 workspace metadata 里看到输入文件。
- Runtime Agent message 必须真实调用 `/portal-adapter/api/opl-launch/messages`，且 `message.reply` 非空。
- Runtime file run 必须真实调用 `/portal-adapter/api/opl-launch/runs`，且返回同一个 `runId`。
- Session raw ledger 必须来自 `/portal-adapter/api/opl-launch/sessions/:runtimeSessionId/ledger?launch_token=...`，且包含 `runtime_token_issued`、`runtime_agent_message_received`、`runtime_agent_run_submitted`。
- 文件下载必须先从 Runtime Agent run artifacts 或 raw ledger 解析 output，再走 `/portal/api/workspace/files/download-url` + `/portal/workspace/files/download-signed`。如果 Runtime Agent 输出没有回写 Portal `workspaceFiles` 索引，gate 必须硬失败为 `runtime_output_index_missing`，不能伪造下载成功。
- Portal session trace、billing、`/portal/api/costs/run` 必须可读。
- 删除 compute/storage 后，compute 必须有 `billingStoppedAt`，binding 不能保持 active。
- 120min/T+1 只是外部 reconcile/audit checkpoint，记录为非阻塞项；不能把 pending checkpoint 当作 full-loop 通过依据。

`V21_RESOURCE_LIFECYCLE_MODE=registered_only` 只能作为本地或灰度非破坏性演示，不是 Stage 3 通过条件。Stage 3 必须使用 `cloud_provisioned`。

### Stage 4: 正式切流

只有 Stage 0-3 通过后，才允许把正式入口切到 v21。

切流后必须立刻运行：

```bash
V21_EXPECTED_BUILD_TAG=opl-v21 node scripts/check-v21-cloud-readiness.mjs
RUN_V21_GRAY_PREACCEPTANCE=1 V21_EXPECTED_BUILD_TAG=opl-v21 node scripts/live-test-v21-gray-preacceptance.mjs
```

如果正式入口 `/healthz` 不是 `opl-v21`，必须停止验收，不能把旧版本测试当 v21 通过。

## 回滚边界

以下任一情况必须回滚或停止切流：

- build tag 不是 `opl-v21`。
- `/portal/api/config` 暴露旧栈 token。
- Portal 或 OPL 登录失败。
- `/portal/opl` 不能进入 OPL 链路。
- user-owned resources API 不能返回。
- 破坏性 full loop 创建了资源但删除失败。
- one-person-lab upstream 在云测期间出现本地修改。

## 新增 gate

```text
scripts/check-v21-cloud-readiness.mjs
scripts/check-v21-deploy-env.mjs
scripts/live-test-v21-gray-preacceptance.mjs
scripts/live-test-v21-user-owned-full-loop.mjs
scripts/smoke-test-v21-deploy-env-contract.mjs
scripts/smoke-test-v21-cloud-readiness-contract.mjs
scripts/smoke-test-v21-gray-preacceptance-contract.mjs
scripts/smoke-test-v21-user-owned-full-loop-live-contract.mjs
```

这些 gate 的共同原则：

- 默认不创建资源。
- 默认不删除资源。
- 默认不发模型消息。
- 必须校验 `opl-v21` build tag。
- 必须校验 v21 deploy env 不含旧栈变量和示例占位符。
- 必须拒绝旧栈回到 v21 产品路径。
- evidence 不记录密钥明文。

## 当前执行状态

截至 2026-05-06，本地 gate 与灰度 Stage 2 已通过。

本地已补强并执行以下 gate：

```bash
node --check scripts/lib/v21-cloud-live-gate.mjs
node --check scripts/check-v21-cloud-readiness.mjs
node --check scripts/live-test-v21-gray-preacceptance.mjs
node --check scripts/live-test-v21-user-owned-full-loop.mjs
node scripts/smoke-test-v21-deploy-env-contract.mjs
node scripts/smoke-test-v21-cloud-readiness-contract.mjs
node scripts/smoke-test-v21-gray-preacceptance-contract.mjs
node scripts/smoke-test-v21-user-owned-full-loop-live-contract.mjs
node scripts/check-v21-user-owned-runtime-boundaries.mjs
node scripts/check-one-person-lab-upstream-clean.mjs
node scripts/update-one-person-lab-upstream.mjs --check-only
sentrux gate .
```

结果：

- strict full-loop 静态合同已从红灯变绿：脚本不再允许 `skippedLiveMutation`、`skippedUntilRuntimeAgentEndpointAvailable`、`recorded_for_external_scheduler` 冒充通过。
- one-person-lab upstream clean；一键更新 check-only 跑通 upstream boundary、ACP adapter smoke、OPL Web Gateway smoke、v21 boundary check 和 build/push dry-run。
- v21 boundary check 通过。
- `sentrux gate .` 显示无结构退化。
- `sentrux check .` 仍失败：quality `0.66 < 0.69`、modularity `0.6140 < 0.8000`、redundancy `0.6266 < 0.6500`。这表示当前绝对阈值仍未达标，不能把结构健康宣称为完全达标。

灰度环境状态：

```text
V21_CONNECT_HOST=lb-cjchlvww-907mxycpd48jrlo3.clb.usw-tencentclb.com
deploy env=/home/dev/.secrets/medopl/tke-v21.env
namespace=portal-v21-gray
runtime namespace=portal-v21-runtime
build tag=opl-v21
```

已通过：

```bash
node scripts/check-v21-deploy-env.mjs \
  --deploy-env-file /home/dev/.secrets/medopl/tke-v21.env \
  --deploy-secrets-env-file /home/dev/.secrets/medopl/secrets.env.txt \
  --json
```

结果：`ok=true`，5 个核心镜像 tag 为 `opl-v21`，没有旧栈 env 违规。

已通过灰度 readiness：

```bash
V21_ENV_FILE=/home/dev/.secrets/medopl/tke-v21.env \
V21_SECRETS_ENV_FILE=/home/dev/.secrets/medopl/secrets.env.txt \
V21_CONNECT_HOST=lb-cjchlvww-907mxycpd48jrlo3.clb.usw-tencentclb.com \
V21_EXPECTED_BUILD_TAG=opl-v21 \
node scripts/check-v21-cloud-readiness.mjs
```

证据：

```text
.runtime/v21-cloud-readiness/2026-05-06T02-30-15-284Z.json
portal=opl-v21
opl-web-gateway=opl-v21
portal-opl-adapter=opl-v21
```

已通过灰度非破坏性 preacceptance：

```bash
RUN_V21_GRAY_PREACCEPTANCE=1 \
V21_ENV_FILE=/home/dev/.secrets/medopl/tke-v21.env \
V21_SECRETS_ENV_FILE=/home/dev/.secrets/medopl/secrets.env.txt \
V21_CONNECT_HOST=lb-cjchlvww-907mxycpd48jrlo3.clb.usw-tencentclb.com \
V21_EXPECTED_BUILD_TAG=opl-v21 \
node scripts/live-test-v21-gray-preacceptance.mjs
```

证据：

```text
.runtime/v21-gray-preacceptance/2026-05-06T02-30-22-251Z.json
readiness.ok=true
Portal login=302
/portal/api/overview=200
/portal/api/my/resources=410 retired_in_v21
/portal/api/user-owned-resources=200
/portal/api/billing=200
/portal/api/session-traces=200
/portal/opl=302
/api/auth/login without apiKey=400 provider_api_key_required
```

尚未执行 Stage 3 破坏性 full-loop。当前缺少：

```text
V21_TEST_RUNTIME_AGENT_ENDPOINT
RUN_V21_FULL_LOOP=1
V21_CONFIRM_CREATE_RESOURCES=1
V21_CONFIRM_DELETE_RESOURCES=1
```

因此不能宣称真实套餐开通、后台 Runtime Agent、真实文件任务、删除停费、120min 核对和 T+1 审计已经云侧闭环。

本轮 Kubernetes API 只读盘点未能作为新证据：`kubectl --request-timeout=20s get ns portal-v21-gray portal-v21-runtime` 在连接 `https://medopl.cn/api` 时超时或 connection reset。当前灰度通过证据以 HTTP v21 gate 和 `.runtime` evidence 为准。

仍禁止直接用 `/home/dev/.secrets/medopl/tke-v20.32.env` 推 v21。该文件仍包含 `resource-provisioner`、runner、MinIO、Harbor、OpenCost、Langfuse 和 v20.32 namespace 等旧部署语义。v21 推云必须使用独立 v21 env，且 rendered manifest 不得把这些旧栈作为产品主链部署。
