# OPL v21 User-Owned Runtime Refactor Checklist

## 目标闭环

v21 的产品闭环固定为：

```text
管理员创建用户
  -> 给用户充值额度
  -> 用户分别登录 portal.medopl.cn 与 opl.medopl.cn
  -> 用户在 Portal 创建或绑定自己的 CVM
  -> 用户选择或绑定自己的存储
  -> Portal 展示用户自己的 CVM、存储、workspace 和预扣费状态
  -> Portal 按资源绑定冻结一周运维保护金
  -> 用户在 OPL Web 输入 Portal 账号、密码、gflabtoken API Key
  -> OPL Web 通过 Gateway / Adapter 接入 Portal
  -> Adapter 只通过公开 ACP 协议连接未修改的 one-person-lab runtime
  -> 用户在 OPL 发送消息、上传文件、运行任务、下载输出文件
  -> Portal 可查看 workspace 文件、账单、session 对话轨迹和原始审计记录
  -> 用户删除服务器或解绑资源
  -> 资源停止计费，保护金按账单结果结算或释放
```

核心产品定位：

- Portal 平台承担 Portal 服务、Portal 数据库、Portal 审计索引和控制面运维成本。
- 用户要使用 runtime，必须绑定自己的 CVM 和自己的存储。
- Portal 不默认代用户创建 TKE node pool、K8s Job、Harbor 镜像分发或 MinIO 存储。
- 一周运维保护金是资源绑定级保护，不是每次 run 的临时预授权。
- `https://github.com/gaofeng21cn/one-person-lab` 源码保持干净，可随时一键拉取更新。

## v21 总则

### 1. 不修改 upstream OPL

`one-person-lab` 只能作为可更新 upstream：

```text
git pull --ff-only upstream
  -> check upstream clean
  -> ACP contract gate
  -> build OPL Web upstream image
  -> restart OPL Web / Adapter runtime binding
```

禁止行为：

- 禁止在 `one-person-lab` 源码目录写 Portal 代码。
- 禁止 patch upstream 文件。
- 禁止 import upstream 内部模块。
- 禁止用平台逻辑替换 upstream session/runtime 语义。

允许行为：

- 通过 `OPL_ACP_RUNTIME_DIR` 指向 upstream checkout。
- 通过 `OPL_ACP_RUNTIME_COMMAND_JSON` 显式启动 `opl session runtime --acp`。
- 通过 Gateway 注入 Portal launch/login 脚本。
- 通过 Adapter 消费 ACP JSONL stdio 协议。

### 2. 默认 runtime 模式是 user-owned

v21 默认产品模式：

```text
PRODUCT_RUNTIME_MODE=user_owned
```

含义：

- runtime 执行在用户绑定的 CVM 上。
- workspace 文件、session raw ledger、artifacts 和 outputs 写入用户绑定存储。
- Portal 只保存索引、账单、审计摘要和必要的 raw event 引用。
- 没有 `WorkspaceResourceBinding` 时，不允许进入 OPL runtime。

### 3. 模块内高聚合，模块间低耦合

模块内高聚合：

- 身份模块只处理用户、登录、会话、权限。
- 资源模块只处理用户 CVM、用户存储、workspace 绑定和生命周期。
- 账务模块只处理钱包、保护金冻结、账单核对、结算、退款。
- OPL Adapter 只处理 launch token、ACP 协议转换、session ledger、stream/cancel。
- Gateway 只处理 OPL Web 包裹、同源代理、登录桥接和前端注入。
- Storage Adapter 只处理用户存储读写、prefix、credential scope 和文件索引。
- Runtime Agent 只处理用户 CVM 上的 OPL runtime 启动、健康检查和 ACP relay。

模块间低耦合：

- 模块之间只通过 API、短期 token、资源绑定 ID、append-only event 和只读 projection 通信。
- Portal 不直接 SSH 到用户 CVM 执行任意命令。
- Gateway 不读 Portal DB。
- Billing 不登录用户、不修改 session。
- Adapter 不创建 CVM、不决定价格。
- Storage Adapter 不决定账单。
- Runtime Agent 不扣费、不读取 Portal wallet。

### 4. Sentrux 是重构硬门禁

当前 Sentrux 结果：

```text
sentrux check .
Quality: 6484
min_quality failed: 0.65 < 0.69
min_modularity failed: 0.6203 < 0.8000
```

v21 重构规则：

- 每个阶段开始前运行 `sentrux gate --save .`。
- 每个阶段完成后运行 `sentrux gate .`。
- 每个 PR 必须说明 Sentrux quality、modularity、cycles、god files 是否改善或不退化。
- 最终目标是 `sentrux check .` 通过 `.sentrux/rules.toml`。
- 若阶段性无法一次通过，必须至少做到 no degradation，并明确剩余结构债。

结构目标：

```text
Quality >= 0.69
Modularity >= 0.80
Cycles = 0
God files = 0
No upward violations
```

新增边界应写入 `.sentrux/rules.toml`：

- Portal 不 import OPL upstream。
- Gateway 不 import Portal state/app。
- Adapter 不 import Portal state。
- Runtime Agent 不 import Portal wallet/resource-order internals。
- Billing 不 import Portal auth/session internals。
- User-owned runtime 默认路径不依赖 resource-provisioner、med-autoscience-runner、OpenCost、Harbor、MinIO、Rancher。

## 需要砍掉或移出默认路径的内容

### 1. run 触发资源开通

现状问题：

```text
submitRuntimeRun
  -> /portal/internal/resource-orders/prepare-run
  -> quote
  -> freeze
  -> provision
  -> create runner workspace
  -> submit K8s Job
```

需要砍掉默认路径：

- `services/opl-runtime-bridge/src/runtime-bridge-runs.mjs` 中默认调用 `prepare-run` 的路径。
- `POST /portal/internal/resource-orders/prepare-run` 作为 OPL 对话默认前置步骤。
- runId 作为资源订单复用和账单主键。

替代路径：

```text
launch / message / task
  -> resolve WorkspaceResourceBinding
  -> verify weekly protection freeze
  -> dispatch to user-owned runtime endpoint
  -> append SessionRawLedger
```

### 2. 默认 resource-provisioner

需要移出默认路径：

- `resource-provisioner` Deployment / compose service。
- TKE `CreateClusterNodePool`、scale、delete-node-pool 作为用户默认资源管理路径。
- `SERVER_PLAN_CATALOG_JSON.provisioningMode=tke_node_pool_create` 默认配置。

保留方式：

```text
PRODUCT_RUNTIME_MODE=managed_runtime
```

仅在 managed runtime profile 下启用。

### 3. 默认 med-autoscience-runner / K8s Job

需要移出默认路径：

- `med-autoscience-runner-orchestrator` 镜像。
- `med-autoscience-runner` 动态 Job 镜像。
- `infra/kubernetes/job-template.yaml` 默认运行路径。
- `deploy/tke-package/manifests/04-runner-rbac.yaml` 默认部署。
- Runner ClusterRole / ClusterRoleBinding。

保留方式：

- 只作为 managed-runtime 或历史兼容 profile。
- 不进入用户自有 CVM runtime 主链路。

### 4. 默认 MinIO / Harbor / OpenCost / Rancher / KubeSphere

需要从默认产品链路移除：

- `MINIO_API_URL` 和 `MINIO_CONSOLE_URL` 默认本地值。
- `HARBOR_URL`、`HARBOR_API_URL`、`HARBOR_USERNAME`、`HARBOR_PASSWORD` 默认值。
- `OPENCOST_UI_URL` 默认本地值。
- `RANCHER_URL` 默认本地值。
- KubeSphere 入口和 preview 配置的产品叙事。

保留方式：

```text
PRODUCT_OPS_PROFILE=1
```

仅运维 profile 展示探活和入口。

### 5. 共享 PVC / 平台 MinIO 承载用户数据

需要砍掉默认语义：

- 共享 PVC 作为用户 workspace/session/artifact truth。
- 平台 MinIO 作为用户默认对象存储。
- `workspaces/{tenantId}/{workspaceId}/...` 作为唯一存储隔离。

替代语义：

```text
UserStorageBucket
  -> WorkspaceStorageBinding
      -> users/{userId}/workspaces/{workspaceId}/sessions/{oplSessionId}/...
```

### 6. nodePool 资源页

需要从用户默认前端移除：

- 用户资源页中的 nodePool 删除模型。
- `delete-node-pool` 用户默认操作。
- `runId/nodePoolId/serverPlanId` 作为“我的资源”的主展示字段。

替代展示：

- 我的 CVM。
- 我的存储。
- workspace 绑定。
- 本周保护金。
- 账单日内核对。
- T+1 审计。
- session 文件与轨迹。

### 7. Langfuse 全栈默认部署

需要移出默认路径：

- `deploy/tke-package/manifests/08-langfuse-stack.yaml` 默认发布。
- Langfuse Postgres / Redis / ClickHouse / worker / web 作为主产品依赖。

替代方式：

- Portal 自有 `SessionRawLedger` 是默认审计来源。
- Langfuse 仅作为可选观测输出 sink。

## 需要加上的内容

### 1. UserComputeInstance

新增资源实体：

```text
UserComputeInstance
  id
  tenantId
  userId
  provider
  region
  zone
  cvmInstanceId
  publicEndpoint
  privateEndpoint
  runtimeAgentId
  runtimeAgentVersion
  status
  healthStatus
  billingStartedAt
  billingStoppedAt
  createdAt
  updatedAt
```

职责：

- 表达用户自己的 CVM。
- 不等同于 run。
- 不由 session 创建。
- 可绑定多个 workspace，但必须在同一用户下。

### 2. UserStorageBucket

新增存储实体：

```text
UserStorageBucket
  id
  tenantId
  userId
  provider
  region
  bucket
  endpoint
  credentialsSecretRef
  status
  createdAt
  updatedAt
```

职责：

- 表达用户自己的对象存储。
- 支持 COS / S3-compatible。
- credential 必须 scoped，不允许全局平台凭证写用户数据。

### 3. WorkspaceResourceBinding

新增绑定实体：

```text
WorkspaceResourceBinding
  id
  tenantId
  userId
  workspaceId
  computeInstanceId
  storageBucketId
  rootPrefix
  status
  protectionPolicyId
  createdAt
  updatedAt
```

职责：

- workspace 选择用户自己的 CVM 和存储。
- OPL launch、message、file、task 全部先 resolve binding。
- 这是 v21 runtime 和账单的核心主键。

### 4. WeeklyProtectionFreeze

新增保护金窗口：

```text
WeeklyProtectionFreeze
  id
  tenantId
  userId
  workspaceId
  resourceBindingId
  windowStartAt
  windowEndAt
  estimatedWeeklyAmount
  frozenAmount
  consumedAmount
  releasedAmount
  status
  ledgerEntryIds
  createdAt
  updatedAt
```

规则：

- 每个 active binding 每周最多一个 active freeze window。
- 周内只补差冻结，不重复全额冻结。
- 余额不足时不能启动新的付费 runtime，但已冻结保护范围内的当前服务可以继续按策略处理。
- 删除服务器或解绑资源时结束计费并释放未消耗保护金。

### 5. Runtime Agent

用户 CVM 上新增 runtime agent：

```text
runtime-agent
  -> register
  -> health
  -> start/reuse OPL ACP runtime
  -> relay ACP JSONL
  -> file sync with user storage
  -> report events
```

边界：

- Agent 不读取 Portal DB。
- Agent 不扣费。
- Agent 不持有其他用户凭证。
- Agent 只接受绑定到自己 `computeInstanceId` 的短期 runtime token。

### 6. SessionRawLedger

新增 append-only ledger：

```text
SessionRawLedger
  id
  tenantId
  userId
  workspaceId
  resourceBindingId
  workspaceSessionId
  runtimeSessionId
  oplSessionId
  messageId
  runId
  traceId
  sequence
  eventType
  rawPayload
  payloadHash
  artifactRefs
  createdAt
```

职责：

- 每个 session 的原始记录事实源。
- 记录 OPL event envelope、message、chunk、tool call、file event、task event、stdout/stderr 摘要、artifact hash。
- upstream `session_ledger` 只作为外部观测快照，不覆盖 Portal 主账本。

### 7. OPL stream / cancel

新增 Adapter 合同：

```text
POST /api/opl-launch/messages/stream
POST /api/opl-launch/messages/:id/cancel
POST /api/opl-launch/runs/:id/cancel
GET  /api/opl-launch/sessions/:id/ledger
```

状态机：

```text
accepted -> running -> succeeded | failed | cancelled | timed_out
```

要求：

- 消息不能只靠 2 秒轮询完整结果。
- Adapter 必须消费 ACP `session/update` 流式事件。
- cancel 必须写入 SessionRawLedger。

### 8. OPL native login API Key 输入

OPL 登录页必须支持：

```text
邮箱
密码
gflabtoken API Key
```

产品文案：

```text
模型服务来源：gflabtoken。API Key 仅用于当前用户的 OPL runtime，不会写入 one-person-lab 源码。
```

后端已有接收 `apiKey / gflabtoken` 的能力，v21 要补齐前端注入与清晰文案。

### 9. One-click upstream update

新增一键更新脚本：

```text
scripts/update-one-person-lab-upstream.mjs
```

流程：

```text
check upstream clean
  -> git pull --ff-only
  -> install/build
  -> node scripts/check-one-person-lab-upstream-clean.mjs
  -> ACP contract gate
  -> OPL Web smoke
  -> build/push opl-web-upstream image
```

门禁：

- upstream dirty 直接失败。
- ACP command 不兼容直接失败。
- 不允许静默回退到 fixture。

## 默认镜像清单

个人镜像仓库只有 10 个时，v21 默认自有镜像控制在 5 个以内。

### 默认需要

| 镜像 | 职责 | 是否自有 |
| --- | --- | --- |
| `portal-opl` | Portal 控制面、用户、充值、资源绑定、账单、文件索引、审计 | 是 |
| `portal-opl-adapter-opl` | OPL Adapter、launch、ACP relay、SessionRawLedger、stream/cancel | 是 |
| `opl-web-gateway-opl` | OPL Web Gateway、同源代理、登录桥接、脚本注入 | 是 |
| `opl-web-opl` | 干净构建的 upstream OPL Web | 是 |
| `billing-aggregator-opl` | 120min 核对、T+1 审计、保护金结算 | 是 |

### 默认不需要

| 镜像 | 处理 |
| --- | --- |
| `resource-provisioner-opl` | 移到 managed-runtime profile |
| `med-autoscience-runner-orchestrator-opl` | 移到 managed-runtime profile |
| `med-autoscience-runner-opl` | 移到 managed-runtime profile |
| Harbor 相关 | 不进入默认产品链路 |
| MinIO 相关 | 不进入默认产品链路 |
| OpenCost 相关 | 不进入默认产品链路 |
| Rancher / KubeSphere 相关 | 不进入默认产品链路 |
| Langfuse stack | 移到 ops profile |

## 多租户隔离总则

### 身份隔离

- 所有请求从 server-side session 或 launch token 解析 `tenantId/userId`。
- 不信任前端 body 传入的 owner 字段。
- 管理员 API 必须记录 operatorId。

### Launch Token 隔离

`launch_token` 必须绑定：

```text
tenantId
userId
workspaceId
resourceBindingId
workspaceSessionId
runtimeSessionId
oplSessionId
expiresAt
launchTokenHash
```

所有 `/api/opl-launch/*` 必须校验 token scope。

禁止：

- 只凭 `runId` 查询 status/artifacts。
- 只凭 `messageId` upsert message request。
- 跨 runtimeSession 复用 messageId。

### CVM 隔离

- 默认一个 CVM 只能属于一个 user。
- 同一用户可选择多个 workspace 共享一台 CVM。
- 跨用户共享 CVM 必须作为单独企业版能力，不进入 v21 默认路径。
- Runtime Agent token 绑定 `computeInstanceId + workspaceId + resourceBindingId`。

### 存储隔离

推荐 key：

```text
users/{userId}/workspaces/{workspaceId}/shared/
users/{userId}/workspaces/{workspaceId}/sessions/{oplSessionId}/raw/
users/{userId}/workspaces/{workspaceId}/sessions/{oplSessionId}/messages/
users/{userId}/workspaces/{workspaceId}/sessions/{oplSessionId}/artifacts/
users/{userId}/workspaces/{workspaceId}/sessions/{oplSessionId}/outputs/
```

要求：

- scoped credential 只允许访问该 user/workspace prefix。
- 文件下载必须校验 `userId + workspaceId + oplSessionId`。
- 删除服务器不等于立刻删除文件；文件按 retention policy 处理。

### 账单隔离

- 账单主键是 `resourceBindingId` 或 `resourceOrderId`。
- `runId` 只做追踪字段。
- 120min 日内核对按 active binding 扫描。
- T+1 审计按资源账单和 storage usage 对账。

## v21 开发清单

### Phase 0: Sentrux 基线和边界规则

目的：先把重构边界写成工具能检查的规则。

- [ ] 运行 `sentrux gate --save .` 保存阶段基线。
- [ ] 修改 `.sentrux/rules.toml`，新增 user-owned runtime 边界。
- [ ] 新增结构检查脚本，禁止默认路径 import managed-runtime 模块。
- [ ] 运行 `sentrux check .`，记录当前失败项。
- [ ] 交付边界：Sentrux gate 无退化，新增边界规则可执行。

### Phase 1: Product profile 收敛

目的：把默认产品路径从 managed K8s 切到 user-owned runtime。

- [ ] 新增 `PRODUCT_RUNTIME_MODE=user_owned`。
- [ ] 默认禁用 `resource-provisioner`、`med-autoscience-runner`、runner RBAC。
- [ ] 默认清空 Rancher/OpenCost/Harbor/MinIO/KubeSphere URL。
- [ ] 前端默认隐藏 K8s 运维、nodePool 删除、registry、OpenCost 卡片。
- [ ] deploy/compose 默认只启动核心 4-5 个镜像。
- [ ] 交付边界：新用户默认看不到平台托管 K8s 运维入口。

### Phase 2: User resource model

目的：建立用户自有 CVM 和自有存储事实源。

- [ ] 新增 `UserComputeInstance` domain/state/schema。
- [ ] 新增 `UserStorageBucket` domain/state/schema。
- [ ] 新增 `WorkspaceResourceBinding` domain/state/schema。
- [ ] 新增 Portal API：创建/绑定/解绑 CVM。
- [ ] 新增 Portal API：创建/绑定/解绑存储。
- [ ] 更新用户资源页：展示 CVM、存储、workspace binding。
- [ ] 交付边界：用户可以在 Portal 创建 workspace 并绑定自己的 CVM 与存储。

### Phase 3: Weekly protection billing

目的：把一周保护金从 run 预授权改为 binding 级冻结。

- [ ] 新增 `WeeklyProtectionFreeze` domain/state/schema。
- [ ] `ledger_entries` 增加 `resourceBindingId`。
- [ ] 保护金冻结按 `resourceBindingId + week window` 幂等。
- [ ] 120min 核对扫描 active binding。
- [ ] T+1 审计按 binding 结算、补扣、退款。
- [ ] 删除服务器或解绑资源时停止计费并释放未消耗冻结。
- [ ] 交付边界：用户可看见本周冻结、已消耗、剩余、核对状态和 T+1 审计状态。

### Phase 4: Runtime Agent and dispatch

目的：runtime 真正在用户 CVM 上执行。

- [ ] 新增 runtime-agent service 或独立包。
- [ ] Agent 注册到 Portal，生成 `runtimeAgentId`。
- [ ] Agent health 上报 CVM 可用状态。
- [ ] Adapter resolve `WorkspaceResourceBinding` 后签发短期 runtime token。
- [ ] Adapter 通过 Agent 启动或复用 `opl session runtime --acp`。
- [ ] 禁止默认路径调用 K8s runner。
- [ ] 交付边界：消息执行链路落到用户绑定 CVM，而不是平台 adapter 容器或 K8s Job。

### Phase 5: User storage isolation

目的：文件、输出、session raw ledger 写用户自有存储。

- [ ] 新增 storage adapter interface。
- [ ] 实现 COS/S3-compatible scoped credential。
- [ ] 文件上传写入 user/workspace/session prefix。
- [ ] 输出文件写入 session outputs prefix。
- [ ] Portal 文件页读取用户 storage index。
- [ ] 下载文件校验 owner scope。
- [ ] 交付边界：用户只能看到和下载自己 workspace/session 的文件。

### Phase 6: OPL Adapter hardening

目的：不改 OPL upstream，但把 Adapter 做成稳定协议层。

- [ ] 所有 `/api/opl-launch/*` 校验 launch token scope。
- [ ] message request 主键改为 `runtimeSessionId + launchTokenHash + messageId`。
- [ ] 新增 `SessionRawLedger`。
- [ ] 新增 message stream。
- [ ] 新增 message cancel。
- [ ] 新增 run cancel。
- [ ] upstream `session_ledger` 只作为外部快照，不覆盖 Portal ledger。
- [ ] 交付边界：跨用户、跨 workspace、跨 runtimeSession 访问被拒绝。

### Phase 7: OPL login and API Key UX

目的：用户在 opl.medopl.cn 可直接登录并绑定 gflabtoken。

- [ ] Gateway 注入登录表单增强脚本。
- [ ] 在密码下面添加 `gflabtoken API Key` 输入。
- [ ] 写明来源：`模型服务来源于 gflabtoken`。
- [ ] 登录请求带 `apiKey/gflabtoken` 到 Portal internal login。
- [ ] Adapter 写 provider secret，不写 upstream。
- [ ] 交付边界：新用户在 OPL 登录后可发送消息，缺 API Key 时明确阻断。

### Phase 8: One-click OPL upstream update

目的：保证经常拉取 upstream 仍可稳定升级。

- [ ] 新增 `scripts/update-one-person-lab-upstream.mjs`。
- [ ] 检查 upstream clean。
- [ ] `git pull --ff-only`。
- [ ] 运行 ACP contract gate。
- [ ] 运行 OPL Web gateway smoke。
- [ ] 构建并推送 `opl-web-opl`。
- [ ] 交付边界：一条命令完成 upstream 更新，失败时不污染 upstream。

### Phase 9: End-to-end acceptance

目的：验证用户目标闭环。

- [ ] 创建 1 名新用户。
- [ ] 给用户充值额度。
- [ ] 用户登录 `portal.medopl.cn`。
- [ ] 用户登录 `opl.medopl.cn`。
- [ ] 用户在 Portal 创建或绑定 CVM。
- [ ] 用户选择存储。
- [ ] Portal 展示用户 CVM、存储、保护金预扣。
- [ ] 用户在 OPL 输入 API Key 并发送消息。
- [ ] 用户上传文件。
- [ ] 用户运行文件任务。
- [ ] 用户下载输出文件。
- [ ] Portal 展示 workspace 文件。
- [ ] Portal 展示账单、120min 核对、T+1 审计状态。
- [ ] Portal 可追踪 session 对话和 raw ledger。
- [ ] 用户删除服务器。
- [ ] 计费停止，保护金结算或释放。
- [ ] 交付边界：完整闭环通过，无 upstream dirty，无 Sentrux 退化。

## 验收命令

每个阶段至少运行：

```bash
sentrux gate .
sentrux check .
node scripts/check-one-person-lab-upstream-clean.mjs
npm --prefix services/portal run check
npm --prefix services/opl-runtime-bridge run check
node --check services/opl-web-gateway/src/server.mjs
```

最终验收必须包含：

```bash
node scripts/update-one-person-lab-upstream.mjs --check-only
node scripts/smoke-test-opl-acp-runtime-adapter.mjs
node scripts/smoke-test-opl-web-gateway-launch.mjs
```

新增 v21 smoke 建议：

```bash
node scripts/smoke-test-v21-user-owned-resource-binding.mjs
node scripts/smoke-test-v21-weekly-protection-freeze.mjs
node scripts/smoke-test-v21-opl-launch-token-scope.mjs
node scripts/smoke-test-v21-session-raw-ledger.mjs
node scripts/smoke-test-v21-user-storage-isolation.mjs
node scripts/smoke-test-v21-runtime-agent-contract.mjs
```

## 不做事项

v21 默认路径不做：

- 不改 `one-person-lab` 源码。
- 不做平台默认 TKE node pool 创建。
- 不做平台默认 K8s Job runtime。
- 不做默认 MinIO 用户存储。
- 不做默认 Harbor 分发面。
- 不做默认 OpenCost 成本来源。
- 不做默认 Rancher/KubeSphere 入口。
- 不做假流式切字。
- 不用 runId 作为账单主键。
- 不让 session 创建 CVM 或存储。

## 成功标准

v21 成功标准：

- 新用户能完成充值、绑定 CVM、绑定存储、冻结保护金、进入 OPL、发送消息、上传文件、运行任务、下载输出、查看账单和轨迹、删除服务器。
- upstream `one-person-lab` 始终 clean。
- OPL 可一键拉取更新。
- 默认镜像数量控制在 5 个以内。
- 用户 CVM 隔离、用户存储隔离、多租户 token scope 隔离全部有测试。
- Sentrux gate 不退化，并逐步让 `min_quality` 和 `min_modularity` 达到规则线。
