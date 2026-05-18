# 历史参考文档，不是 v22 active 合同或当前实现入口；不得作为当前主线、smoke、接云或部署依据。

# OPL v21 Platform-Provisioned OPL Service Refactor Checklist

## 文档命名说明

文件名里的 `User-Owned` 是历史命名。当前 v21 语义是 `platform-provisioned / customer-dedicated`：平台代用户开通隔离计算和存储资源，用户购买套餐、计算能力、存储容量和运行环境；`user_owned` 只能作为 legacy alias。

## 2026-05-06 产品口径修正

v21 的商业模式不是“用户自己准备云服务器和对象存储，然后来平台登记”。这个口径对 AI 小白和科研小白不成立。

v21 的正确口径是：

```text
用户购买平台打包好的 OPL 科研服务
  -> 用户只选择套餐、计算能力和存储容量
  -> Portal 在后台代用户开通隔离的计算和存储资源
  -> 资源对该用户隔离、可计费、可释放
  -> 平台负责 OPL、云资源、存储、账单、审计和运维闭环
```

本文中历史出现的 `user-owned`，在 v21 之后应理解为“平台代开通、用户购买服务、后台资源隔离、用户承担费用”，不是“用户自带云账号或自带资源”。现有代码里的 `/portal/api/user-owned-resources`、`PRODUCT_RUNTIME_MODE=user_owned` 是历史兼容命名；新文档、新配置、新测试和默认产品语义必须使用 `platform_provisioned` / `customer_dedicated`，旧接口和值只作为兼容别名保留一段时间。

## 产品定位

v21 的目标用户不是云原生工程师，而是 AI 小白和科研小白。产品要把用户要理解的东西压到最少：

```text
充值
  -> 进入 OPL
  -> 普通问答，或在 Portal 选择运行套餐和存储容量进入完整科研工作台
  -> 上传资料
  -> 跑任务
  -> 下载结果
  -> 查看账单和轨迹
```

用户产品层只展示科研闭环需要的概念：账号、余额、workspace、API Key、套餐、计算能力、存储容量、文件、任务、输出、账单、审计轨迹。

平台运维层只服务平台团队：服务健康、版本、队列、账单核对、T+1 审计、upstream 更新、runtime agent 在线状态、异常告警。运维层不能把 Rancher、OpenCost、node pool、K8s Job 这类云原生概念暴露给 AI 小白用户。

## 目标闭环

v21 的产品闭环固定为：

```text
管理员创建用户
  -> 给用户充值额度
  -> 用户从 portal.medopl.cn 点击进入 OPL，或直接登录 opl.medopl.cn
  -> 统一入口校验 Portal 账号、密码、gflabtoken API Key
  -> OPL Web 通过 Gateway / Adapter 接入 Portal
  -> 用户默认进入 OPL Lite，只用 gflabtoken 做 API-only 问答
  -> 用户需要文件、任务、输出或持久化 runtime 时，在 Portal 选择套餐或自定义规格
  -> 用户上传文件并进入完整科研工作台
  -> 套餐计算能力不够时可升级或加计算
  -> 存储容量不够时可加容量
  -> Portal 展示套餐、存储容量、workspace 和预扣费状态
  -> Portal 按资源绑定冻结一周运维保护金
  -> 用户在 OPL Full Runtime 上传文件、运行任务、下载输出文件
  -> Portal 可查看 workspace 文件、账单、session 对话轨迹和原始审计记录
  -> 用户在 Portal 关闭套餐或释放资源
  -> 资源停止计费，保护金按账单结果结算或释放
```

核心产品定位：

- Portal 平台承担 Portal 服务、Portal 数据库、Portal 审计索引和控制面运维成本。
- OPL 入口统一，Portal 进入和直接登录 OPL 都落到同一套 launch token 签发、scope 校验、provider key、workspace、账单和审计逻辑。
- 用户只做 API-only 问答时，不要求开通运行套餐或存储容量。
- 用户要使用文件、任务、输出或 Full Runtime，必须在 Portal 选择运行套餐和存储容量。
- Portal 默认负责代用户创建和管理云资源；用户不直接面对腾讯云控制台、TKE、COS 权限、K8s、镜像仓库或底层网络。
- v19-v20.34 中已经验证有效的“腾讯云开资源、绑定资源 ID、COS 账单核对、资源标签归因”能力应作为 v21 Cloud Provisioning 的工程资产继续复用或抽取。
- 旧的 K8s Job runtime、med-runner、Harbor/MinIO/OpenCost/Rancher/KubeSphere 产品面不进入 v21 默认链路。
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

- 本地验收或后台 Runtime Agent 可通过 `OPL_ACP_RUNTIME_DIR` 指向 upstream checkout。
- 本地验收或后台 Runtime Agent 可通过 `OPL_ACP_RUNTIME_COMMAND_JSON` 显式启动 `opl session runtime --acp`。
- 通过 Gateway 注入 Portal launch/login 脚本。
- Adapter 通过 Runtime Agent 边界消费 ACP JSONL 事件；Full Runtime 的 stdio 进程只能在后台隔离计算资源内启动。

### 2. 唯一产品 runtime mode 是 platform-provisioned customer-dedicated，运行能力分 Lite 和 Full

v21 唯一产品 runtime mode 的产品语义：

```text
PRODUCT_RUNTIME_MODE=platform_provisioned
```

当前代码中仍有历史值 `PRODUCT_RUNTIME_MODE=user_owned`，只能作为兼容名存在，含义必须重解释为“平台代开通、用户专属隔离”，不能再解释成“用户自带资源”。

v21 合法运行能力分两层，入口统一，能力分流：

```text
OPL Lite
  -> Portal 登录 + gflabtoken API Key
  -> API-only message
  -> 普通 chatbot
  -> 不需要运行套餐
  -> 不需要存储容量
  -> 不冻结一周保护金

OPL Full Runtime
  -> Portal 登录 + gflabtoken API Key
  -> WorkspaceResourceBinding
  -> Portal 代开通的隔离计算资源
  -> Portal 代开通的隔离存储资源
  -> 真正运行 OPL 科研工作台
  -> file / task / output / artifact / full SessionRawLedger
  -> binding 级一周保护金
```

含义：

- API-only 问答不触发付费计算资源、不触发付费存储资源、不触发保护金冻结。
- Full Runtime 执行在 Portal 代开通且绑定给该用户的隔离计算资源上。
- workspace 文件、Full Runtime session raw ledger、artifacts 和 outputs 写入 Portal 代开通且绑定给该用户的隔离存储资源。
- Portal 只保存索引、账单、审计摘要和必要的 raw event 引用。
- 没有 `WorkspaceResourceBinding` 时，允许进入 OPL Lite 和 API-only 问答。
- 没有 `WorkspaceResourceBinding` 时，不允许上传文件、运行任务、生成输出、写隔离存储或启动 Runtime Agent。

统一入口要求：

- `portal.medopl.cn -> 进入 OPL` 和 `opl.medopl.cn -> 登录` 都必须使用同一套 Portal launch token 签发和 scope schema。
- launch token 用 `mode=api_only` 或 `mode=full_runtime` 表示能力，不允许维护两套入口逻辑。
- 用户可从 Lite 升级到 Full Runtime，但升级必须显式选择套餐、存储容量并完成保护金冻结。
- Full Runtime 失败不能静默降级成 Lite；Lite 也不能隐式升级成 Full Runtime。

### 3. 用户层和运维层分离

用户层面向 AI 小白和科研小白，只允许出现：

- 账号和余额。
- OPL 入口。
- gflabtoken API Key。
- workspace。
- 运行套餐。
- 计算能力。
- 存储容量。
- 文件、任务、输出。
- 账单、120min 核对状态、T+1 审计状态。
- session 对话轨迹。

运维层面向平台团队，只允许出现：

- Portal / Gateway / Adapter / Billing 服务健康。
- upstream `one-person-lab` 当前版本和更新状态。
- Runtime Agent 注册、在线、版本和异常。
- 账单核对队列、T+1 审计队列、失败重试。
- token scope 拒绝、跨租户访问拒绝、审计告警。

用户层禁止出现：

- Kubernetes、TKE node pool、K8s Job。
- Rancher、KubeSphere。
- OpenCost。
- Harbor。
- MinIO。
- ClusterRole、PVC、namespace、pod、manifest。

### 4. 模块内高聚合，模块间低耦合

模块内高聚合：

- 身份模块只处理用户、登录、会话、权限。
- 资源模块只处理套餐、计算资源、存储资源、workspace 绑定和生命周期。
- 账务模块只处理钱包、保护金冻结、账单核对、结算、退款。
- OPL Adapter 只处理 launch token、API-only message relay、ACP 协议转换、session ledger、stream/cancel。
- Gateway 只处理 OPL Web 包裹、同源代理、登录桥接和前端注入。
- Storage Adapter 只处理 Full Runtime 隔离存储读写、prefix、credential scope 和文件索引。
- Runtime Agent 只处理隔离计算资源上的 Full Runtime 启动、健康检查和 ACP relay。

模块间低耦合：

- 模块之间只通过 API、短期 token、资源绑定 ID、append-only event 和只读 projection 通信。
- Portal 不直接 SSH 到后台计算资源执行任意命令。
- Gateway 不读 Portal DB。
- Billing 不登录用户、不修改 session。
- Adapter 不创建计算资源、不决定价格。
- Storage Adapter 不决定账单。
- Runtime Agent 不扣费、不读取 Portal wallet。

### 5. Sentrux 是重构硬门禁

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
- v21 runtime 路径不得 import、配置或路由到旧 `resource-provisioner`、med-autoscience-runner、OpenCost、Harbor、MinIO、Rancher。
- v21 允许新增 `cloud-provisioner` 或等价模块，但职责必须是 Portal 代开通隔离计算/存储资源、回填真实云资源 ID、打标签和清理资源；不得复用旧 K8s Job runtime 语义。
- 用户层不 import 或展示 ops-only 模块。
- 运维层只能读取 projection 和健康状态，不能成为用户 runtime 热路径。

## 需要砍掉的内容

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

需要保留并重构的资产：

- 用户在 Portal 选套餐、看价格、确认冻结额度。
- 平台在腾讯云账号下创建资源并回填真实 `cloudResourceId`。
- 资源标签绑定 `tenantId/userId/workspaceId/resourceBindingId/resourceOrderId`。
- 腾讯云 COS 账单文件或 Billing API 用于日内核对、T+1 审计和多退少补。

正确的新边界是：

```text
Portal resource purchase
  -> quote compute/storage package
  -> freeze weekly protection amount
  -> v21 cloud-provisioner creates isolated compute/storage under platform cloud account
  -> install/register Runtime Agent
  -> create WorkspaceResourceBinding
  -> OPL Full Runtime can start
```

资源开通是 Portal 购买/开通动作，不是每条 OPL message 或每次 run 的隐式副作用。

替代路径分两类：

```text
API-only message
  -> verify Portal session / launch token
  -> verify gflabtoken provider key
  -> call API-only message relay
  -> append Portal SessionRawLedger index
```

```text
Full Runtime launch / message / task / file
  -> resolve WorkspaceResourceBinding
  -> verify weekly protection freeze
  -> dispatch to isolated runtime endpoint
  -> append SessionRawLedger
```

API-only message 不允许隐式升级成 Full Runtime，不允许触发付费计算、付费存储或保护金冻结。

Full Runtime 才允许文件、任务、输出、artifact 和隔离存储。

### 2. resource-provisioner

v21 删除的是旧 `resource-provisioner` 服务形态和 TKE node pool 默认模型：

- `resource-provisioner` Deployment / compose service。
- TKE `CreateClusterNodePool`、scale、delete-node-pool 作为用户默认资源管理路径。
- `SERVER_PLAN_CATALOG_JSON.provisioningMode=tke_node_pool_create` 默认配置。

退场规则：

- 旧服务不进入 v21 默认 compose、TKE manifest、发布清单和用户/管理员产品页面。
- 旧服务不在 v21 中作为 runtime 服务、路由、配置、镜像或测试目标保留。
- v21 代码中不得从 Full Runtime 热路径 import 旧 resource-provisioner client。

v21 需要新增或重写的能力：

- `cloud-provisioner` 只负责平台代用户开通和释放腾讯云资源。
- 创建后台计算资源时使用腾讯云 CVM API，而不是 TKE node pool API。
- 创建后台存储资源时使用 COS bucket/prefix/policy/CAM scoped credential，而不是平台 MinIO。
- 删除资源时必须写入 `billingStoppedAt`、云资源 cleanup evidence 和审计事件。
- 资源开通 API 要支持入门套餐、进阶套餐、自定义套餐。

### 3. med-autoscience-runner / K8s Job

v21 产品线删除：

- `med-autoscience-runner-orchestrator` 镜像。
- `med-autoscience-runner` 动态 Job 镜像。
- `infra/kubernetes/job-template.yaml` 默认运行路径。
- `deploy/tke-package/manifests/04-runner-rbac.yaml` 默认部署。
- Runner ClusterRole / ClusterRoleBinding。

退场规则：

- 不再把 K8s Job 作为 Full Runtime 的执行模型。
- Full Runtime 只允许调隔离计算资源上的 Runtime Agent。
- 文件任务也必须在隔离计算和隔离存储边界内执行。

### 4. MinIO / Harbor / OpenCost / Rancher / KubeSphere

v21 产品线删除：

- `MINIO_API_URL` 和 `MINIO_CONSOLE_URL` 默认本地值。
- `HARBOR_URL`、`HARBOR_API_URL`、`HARBOR_USERNAME`、`HARBOR_PASSWORD` 默认值。
- `OPENCOST_UI_URL` 默认本地值。
- `RANCHER_URL` 默认本地值。
- KubeSphere 入口和 preview 配置的产品叙事。

退场规则：

- 用户层不能展示这些入口。
- 运维层也不把这些作为 v21 依赖；如果平台团队另有内部工具，必须独立于 v21 产品代码和部署清单。
- v21 账单不能以 OpenCost allocation 作为默认事实源。
- v21 用户文件和输出不能以平台 MinIO 作为默认事实源。

### 5. 共享 PVC / 平台 MinIO 承载用户数据

需要砍掉默认语义：

- 共享 PVC 作为用户 workspace/session/artifact truth。
- 平台 MinIO 作为用户默认对象存储。
- `workspaces/{tenantId}/{workspaceId}/...` 作为唯一存储隔离。

替代语义：

```text
CustomerDedicatedStorage
  -> WorkspaceStorageBinding
      -> users/{userId}/workspaces/{workspaceId}/sessions/{oplSessionId}/...
```

### 6. nodePool 资源页

需要从用户默认前端移除：

- 资源开通页中的 nodePool 删除模型。
- `delete-node-pool` 用户默认操作。
- `runId/nodePoolId/serverPlanId` 作为“我的资源”的主展示字段。

替代展示：

- 运行套餐。
- 计算能力。
- 存储容量。
- workspace 绑定。
- 本周保护金。
- 账单日内核对。
- T+1 审计。
- session 文件与轨迹。

### 7. Langfuse 全栈默认部署

v21 产品线删除：

- `deploy/tke-package/manifests/08-langfuse-stack.yaml` 默认发布。
- Langfuse Postgres / Redis / ClickHouse / worker / web 作为主产品依赖。

替代方式：

- Portal 自有 `SessionRawLedger` 是默认审计来源。
- v21 不内置 Langfuse sink。
- 如果未来要接第三方观测系统，必须另起独立设计文档，且只能消费脱敏 projection，不能进入用户 runtime 热路径。

## 需要加上的内容

### 0. Unified OPL Entry

新增统一入口语义：

```text
Portal entry
  -> /portal/opl
  -> issue launch token
  -> redirect to opl.medopl.cn

Direct OPL entry
  -> opl.medopl.cn login
  -> Portal auth bridge
  -> issue launch token
```

职责：

- 两个入口共用同一个 Portal 身份、provider key、workspace、billing、ledger 系统。
- 入口差异只允许存在于登录体验，不允许存在于后端授权语义。
- launch token 必须显式包含 `mode=api_only` 或 `mode=full_runtime`。
- Portal 进入 OPL 默认可进入 Lite；如果用户选择 Full Runtime，再解析 workspace resource binding。

### 0.1 User Product Surface

用户产品面只保留：

```text
Dashboard
  -> 余额 / 充值
  -> 进入 OPL
  -> 我的 Workspace
  -> 运行套餐
  -> 计算能力
  -> 存储容量
  -> 文件 / 输出
  -> 账单 / 审计轨迹
```

职责：

- 帮 AI 小白和科研小白完成科研闭环。
- 不展示底层云原生资源。
- 所有错误文案必须映射到用户能理解的动作：充值、绑定 API Key、选择套餐、增加计算能力、增加存储容量、重试任务、联系运维。

### 0.2 Operator Surface

运维面只保留：

```text
Ops
  -> 服务健康
  -> upstream OPL 版本和一键更新状态
  -> Runtime Agent 状态
  -> 账单核对队列
  -> T+1 审计队列
  -> 安全和跨租户拒绝事件
```

职责：

- 帮平台团队看系统是否正常。
- 不承接用户 runtime 热路径。
- 不把 Rancher、OpenCost、KubeSphere 等旧工具作为 v21 内建依赖。

### 1. CustomerComputeResource

新增资源实体：

```text
CustomerComputeResource
  id
  tenantId
  userId
  provider
  region
  zone
  resourceOrderId
  cloudResourceId
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

- 表达 Portal 代用户开通、隔离使用和付费的后台计算资源。
- 不等同于 run。
- 不由 session 创建。
- 可绑定多个 workspace，但必须在同一用户下。
- 必须记录腾讯云实例 ID、资源标签、创建/删除证据和计费起止时间。
- 用户产品层不展示 `CVM`、实例 ID、VPC、安全组等云资源细节，只展示“运行套餐 / 计算能力 / 状态 / 费用”。

兼容说明：

- 当前代码实体名 `UserComputeInstance` 可以短期保留，但产品含义必须迁移为 `CustomerComputeResource`。

### 2. CustomerStorageResource

新增存储实体：

```text
CustomerStorageResource
  id
  tenantId
  userId
  provider
  region
  resourceOrderId
  cloudResourceId
  bucket
  endpoint
  credentialsSecretRef
  rootPrefix
  status
  createdAt
  updatedAt
```

职责：

- 表达 Portal 代用户开通、隔离使用和付费的后台存储资源。
- v21 默认优先使用腾讯云 COS。
- credential 必须 scoped 到该用户和 workspace/session prefix，不允许把平台全局凭证下发给 Runtime Agent 或浏览器。
- 支持 bucket 级隔离或共享 bucket + prefix 级隔离；最小上线方案可用共享 bucket + 强制 prefix/CAM scope，但文档、代码和审计必须清楚写明隔离级别。
- 用户产品层不展示 `COS`、bucket、prefix、CAM 等云资源细节，只展示“存储容量 / 已用容量 / 状态 / 费用”。

兼容说明：

- 当前代码实体名 `UserStorageBucket` 可以短期保留，但产品含义必须迁移为 `CustomerStorageResource`。

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

- workspace 绑定 Portal 代开通的后台计算资源和后台存储资源。
- Full Runtime launch、runtime-backed message、file、task 全部先 resolve binding。
- API-only launch 和 API-only message 不要求 binding。
- 这是 v21 Full Runtime 和资源账单的核心主键。
- 不能把 `WorkspaceResourceBinding` 当作“是否允许进入 OPL”的总开关。

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
- 关闭套餐或释放资源时结束对应资源计费并释放未消耗保护金。
- OPL Lite / API-only message 不触发保护金冻结。
- 保护金只保护付费计算、付费存储和 Full Runtime 运维风险。

### 5. Runtime Agent

隔离计算资源上新增 runtime agent：

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
- API-only session ledger 可以只保存在 Portal DB / 平台审计存储。
- Full Runtime session ledger 需要写入用户绑定存储，并在 Portal 保存索引。

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
- Full Runtime message 必须消费 ACP `session/update` 流式事件。
- API-only message 可以走 provider API 流式 relay，不要求运行套餐。
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
模型服务来源：gflabtoken。API Key 仅用于当前用户的 OPL Lite 或 Full Runtime，不会写入 one-person-lab 源码。
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
  -> git pull --ff-only upstream <current-branch>
  -> node scripts/check-one-person-lab-upstream-clean.mjs
  -> ACP contract gate
  -> OPL Web smoke
  -> platform-provisioned runtime boundary check
  -> prepare platform build/push dry-run output with current one-person-lab runtime
```

门禁：

- upstream dirty 直接失败。
- ACP command 不兼容直接失败。
- 不允许静默回退到 fixture。
- `--check-only` 不执行实际 pull，但必须完成 gate、smoke、边界检查和 dry-run 规划。
- 当前 `one-person-lab` upstream 的 `opl web` 已退场；一键更新不把它伪装成 OPL Web 源码构建。
- 一键更新必须把 `one-person-lab` 整体打入 Adapter / Runtime Agent 可见的 ACP runtime 边界，OPL Web shell 镜像由独立 Web 源或既有镜像负责。
- 任一步失败都不能产生 upstream dirty。

## 默认镜像清单

个人镜像仓库只有 10 个时，v21 默认自有镜像优先控制在 5 个以内。这个是容量约束下的工程目标，不是牺牲交付边界的硬门禁；硬门禁是旧栈不得回到 v21 产品线。

### 默认需要

| 镜像 | 职责 | 是否自有 |
| --- | --- | --- |
| `portal-opl` | Portal 控制面、用户、充值、资源绑定、账单、文件索引、审计 | 是 |
| `portal-opl-adapter-opl` | OPL Adapter、launch、ACP relay、SessionRawLedger、stream/cancel | 是 |
| `opl-web-gateway-opl` | OPL Web Gateway、同源代理、登录桥接、脚本注入 | 是 |
| `opl-web-opl` | OPL Web shell / 既有 WebUI 镜像，不从 `one-person-lab` runtime 仓库伪构建 | 是 |
| `billing-aggregator-opl` | 120min 核对、T+1 审计、保护金结算 | 是 |

说明：

- `one-person-lab` 是 ACP runtime upstream，必须整体保持 clean，可被 Adapter 或后台 Runtime Agent 以 `opl session runtime --acp` 启动。
- `opl-web-opl` 不是 `one-person-lab` runtime 仓库的 patch 产物；如果 Web shell 源独立更新，必须走独立 Web shell 更新链路。
- Runtime Agent 可以作为后台计算资源安装包、单独二进制或轻量镜像交付，不计入平台默认镜像清单。
- 运维面复用 `portal-opl` 的 ops route 和 admin UI，不新增默认镜像。

### v21 删除

| 镜像 | 处理 |
| --- | --- |
| `resource-provisioner-opl` | 从 v21 产品线删除 |
| `med-autoscience-runner-orchestrator-opl` | 从 v21 产品线删除 |
| `med-autoscience-runner-opl` | 从 v21 产品线删除 |
| Harbor 相关 | 从 v21 产品线删除 |
| MinIO 相关 | 从 v21 产品线删除 |
| OpenCost 相关 | 从 v21 产品线删除 |
| Rancher / KubeSphere 相关 | 从 v21 产品线删除 |
| Langfuse stack | 从 v21 产品线删除 |

## 多租户隔离总则

### 身份隔离

- 所有请求从 server-side session 或 launch token 解析 `tenantId/userId`。
- 不信任前端 body 传入的 owner 字段。
- 管理员 API 必须记录 operatorId。

### Launch Token 隔离

Lite `launch_token` 必须绑定：

```text
tenantId
userId
workspaceId
workspaceSessionId
oplSessionId
providerKeyRef
mode=api_only
expiresAt
launchTokenHash
```

Full Runtime `launch_token` 必须额外绑定：

```text
resourceBindingId
runtimeSessionId
computeInstanceId
storageBucketId
mode=full_runtime
```

所有 `/api/opl-launch/*` 必须校验 token scope。
API-only token 不得访问 file/task/output/runtime-agent API。
Full Runtime token 必须校验 `resourceBindingId + computeInstanceId + storageBucketId`。

禁止：

- 只凭 `runId` 查询 status/artifacts。
- 只凭 `messageId` upsert message request。
- 跨 runtimeSession 复用 messageId。
- 用 API-only token 触发付费计算、付费存储、保护金冻结或 Runtime Agent。

### 计算隔离

- API-only message 不分配付费计算资源，不生成 runtime agent token。
- 默认一个后台计算资源只能属于一个 user。
- 同一用户可选择多个 workspace 共享同一份计算能力。
- 跨用户共享计算资源必须作为单独企业版能力，不进入 v21 默认路径。
- Runtime Agent token 绑定 `computeInstanceId + workspaceId + resourceBindingId`。

### 存储隔离

推荐 key：

```text
users/{userId}/workspaces/{workspaceId}/api-only/sessions/{oplSessionId}/messages/
users/{userId}/workspaces/{workspaceId}/shared/
users/{userId}/workspaces/{workspaceId}/sessions/{oplSessionId}/raw/
users/{userId}/workspaces/{workspaceId}/sessions/{oplSessionId}/messages/
users/{userId}/workspaces/{workspaceId}/sessions/{oplSessionId}/artifacts/
users/{userId}/workspaces/{workspaceId}/sessions/{oplSessionId}/outputs/
```

要求：

- API-only 默认可只写 Portal DB / 平台审计存储；如需归档到付费存储，必须用户显式开通存储容量。
- scoped credential 只允许访问该 user/workspace prefix。
- 文件下载必须校验 `userId + workspaceId + oplSessionId`。
- 关闭运行套餐不等于立刻删除文件；文件按 retention policy 处理。

### 账单隔离

- API-only 账单主键是 `userId + providerKeyRef + messageId/usageId`。
- Full Runtime 账单主键是 `resourceBindingId`。
- `runId` 只做追踪字段。
- 120min 日内核对按 active binding 扫描。
- T+1 审计按资源账单和 storage usage 对账。

## v21 实现细则

### 1. 统一 OPL 入口

目标：

- Portal 进入 OPL 和直接登录 OPL 走同一套授权语义。
- 后端只有一种 launch token scope 模型，不维护两套入口分支。

涉及模块：

- `services/portal/src/routes/opl.routes.mjs`
- `services/portal/src/integrations/opl-adapter-client.mjs`
- `services/opl-web-gateway/src/portal-auth-bridge.mjs`
- `services/opl-runtime-bridge/src/runtime-bridge-launch.mjs`
- `services/opl-runtime-bridge/src/runtime-bridge-launch-routes.mjs`

当前问题：

- Portal 进入和 OPL direct login 容易形成两条身份路径。
- launch token 当前还没有把 `mode=api_only/full_runtime` 作为授权核心字段。

修改方式：

- `Portal /portal/opl` 和 OPL direct login 都调用同一个 adapter launch issuing API。
- launch record 必须包含 `tenantId/userId/workspaceId/workspaceSessionId/oplSessionId/providerKeyRef/mode/expiresAt/launchTokenHash`。
- 用户未选择 Full Runtime 时，默认签发 `mode=api_only`。
- 用户选择 Full Runtime 时，先 resolve active `WorkspaceResourceBinding`，再签发 `mode=full_runtime`。
- Gateway 只负责携带 launch token 和注入登录增强脚本，不读取 Portal DB。

交付边界：

- 同一用户从 Portal 点击进入 OPL、直接打开 OPL 登录，得到的 token scope 字段一致。
- OPL direct login 不能绕过 Portal 余额、provider key 和审计逻辑。

### 2. Lite Chatbot 实现

目标：

- 没有运行套餐和存储容量的用户也能做普通 chatbot。
- Lite 不触发平台托管资源、保护金或 Runtime Agent。

涉及模块：

- `services/opl-runtime-bridge/src/runtime-bridge-message-routes.mjs`
- `services/opl-runtime-bridge/src/runtime-bridge-messages.mjs`
- `services/opl-runtime-bridge/src/provider-secret-store.mjs`
- `services/portal/src/services/opl-launch.service.mjs`
- `services/portal/src/domain/portal-api-sessions.mjs`
- `services/portal/src/domain/portal-api-costs.mjs`

当前问题：

- message 链路容易默认绑定 runtime session。
- API-only 和 runtime-backed message 的主键、账单和 ledger 边界还不够清晰。

修改方式：

- 新增 API-only message relay，主键为 `launchTokenHash + messageId`。
- API-only request 必须绑定 `userId/workspaceId/providerKeyRef/mode=api_only`。
- gflabtoken secret 只以 provider secret ref 存储，日志、ledger、trace 不写明文。
- API-only 支持 provider stream，不能靠 2 秒轮询完整结果制造体感延迟。
- API-only ledger 默认写 Portal DB / 平台审计存储，只记录消息、chunk、usage、provider request id 和 payload hash。

禁止行为：

- API-only 触发付费计算创建、付费存储写入、保护金冻结、runtime token 或 Runtime Agent。
- API-only token 调用 file/task/output/runtime-agent API。

交付边界：

- 新用户只充值和绑定 gflabtoken 后，可以在 OPL 发送消息并看到回复、轨迹和 API 使用账单。

### 3. Full Runtime 实现

目标：

- 需要文件、任务、输出和完整科研工作台时，真正跑在 Portal 代开通的隔离计算和隔离存储上。

涉及模块：

- `services/portal/src/domain/user-owned-resources.mjs`
- `services/portal/src/state/portal-user-owned-resource-store.mjs`
- `services/portal/src/routes/user-owned-resource.routes.mjs`
- `services/opl-runtime-bridge/src/runtime-bridge-runs.mjs`
- `services/opl-runtime-bridge/src/runtime-bridge-message-routes.mjs`
- 新增 `runtime-agent` 包或服务

当前问题：

- 旧链路的 run 会绕到 `prepare-run -> provision -> K8s Job`。
- 当前 default customer-dedicated run dispatch 还只是阻断旧路径，真正 Runtime Agent 尚未落地。
- 当前 Portal 资源 API 主要是登记和绑定元数据，还没有真实调用腾讯云计算/存储创建和删除。

修改方式：

- Full Runtime 入口必须先 resolve active `WorkspaceResourceBinding`。
- Adapter 根据 binding 签发短期 runtime token，token 绑定 `computeInstanceId + storageBucketId + workspaceId + resourceBindingId`。
- Runtime Agent 注册到 Portal，持续上报 `runtimeAgentId/version/healthStatus`。
- Adapter 只通过 Agent 启动或复用 `opl session runtime --acp`。
- 文件任务在隔离计算资源上执行，输入和输出通过隔离存储 scoped prefix 读写。

禁止行为：

- 调用 K8s runner。
- 调用旧 resource-provisioner。
- 以 `runId` 决定资源生命周期。
- Full Runtime 失败后静默退回 Lite。

交付边界：

- 绑定资源用户能进入 Full Runtime，发送 runtime-backed message，上传文件，运行任务，下载输出。

### 4. 平台托管资源和存储隔离实现

目标：

- Portal 代开通的隔离计算资源、隔离存储资源和 workspace binding 是资源事实源。
- 存储隔离可验证，不依赖平台 MinIO 或共享 PVC。

涉及模块：

- `services/portal/src/domain/user-owned-resources.mjs`
- `services/portal/src/state/portal-store-schema.mjs`
- `services/portal/src/state/portal-store-postgres-persistence.mjs`
- `services/portal/src/state/portal-schema-health.mjs`
- 新增 Storage Adapter interface
- `services/portal/frontend/src/views/resources/ResourcesView.vue`

当前问题：

- 旧模型以 resource order、node pool、runId、平台 MinIO 为主。
- 资源开通页和存储索引需要彻底转成 customer-dedicated 语义。
- 现有代码名 `user-owned` 容易误导成用户自带资源。

修改方式：

- 保留并完善 `CustomerComputeResource`、`CustomerStorageResource`、`WorkspaceResourceBinding` 三个事实表；当前 `UserComputeInstance` / `UserStorageBucket` 作为兼容名。
- Storage Adapter 支持 COS/S3-compatible endpoint 和 scoped credential。
- Full Runtime storage prefix 固定为 `users/{userId}/workspaces/{workspaceId}/sessions/{oplSessionId}/...`。
- 下载文件必须校验 `tenantId/userId/workspaceId/oplSessionId/resourceBindingId`。
- 资源开通页只展示“运行套餐、计算能力、存储容量、workspace、保护金和账单状态”。
- 资源创建接口必须从“登记”升级成“询价、冻结、腾讯云创建、安装 Agent、绑定、回填证据”的状态机。

禁止行为：

- 用户层出现 node pool、PVC、namespace、pod、ClusterRole。
- 使用平台 MinIO 作为用户数据 truth。

交付边界：

- 两个用户无法读取彼此 workspace/session 文件。
- 关闭运行套餐不会误删文件；文件按 retention policy 处理。

### 5. 账务和保护金实现

目标：

- Lite 按 API 使用计费。
- Full Runtime 按 resource binding 和资源账单计费。
- 一周保护金是 binding 级保护，不是 run 级预授权。

涉及模块：

- `services/portal/src/domain/resource-orders.mjs`
- `services/portal/src/domain/portal-api-costs.mjs`
- `services/portal/src/state/portal-store-schema.mjs`
- `adapters/billing-aggregator/src/*`
- 新增 `WeeklyProtectionFreeze` domain/state/schema

当前问题：

- 旧模型以 `runId/resourceOrderId/nodePoolId/OpenCost allocation` 作为默认归因。
- 这不适合 Portal 代开通、用户购买服务的隔离计算和隔离存储。
- 但 v19-v20.34 的腾讯云账单明细、COS 账单文件、资源标签核对是有效能力，v21 应该保留并收敛到 `resourceBindingId`。

修改方式：

- 新增 `WeeklyProtectionFreeze`，唯一窗口为 `resourceBindingId + windowStartAt + windowEndAt`。
- `ledger_entries` 增加 `resourceBindingId/providerKeyRef/usageId`。
- API-only 账单主键为 `userId + providerKeyRef + messageId/usageId`。
- Full Runtime 账单主键为 `resourceBindingId`。
- 120min 核对扫描 active binding 和 API usage。
- T+1 审计按腾讯云账单、COS storage usage、Portal ledger 对账。
- 关闭套餐、释放计算或释放存储时停止对应资源计费，结算或释放未消耗保护金。

禁止行为：

- OpenCost 作为 v21 默认成本事实源。
- `runId` 作为账单主键。
- API-only 冻结一周保护金。

交付边界：

- Portal 能展示 Lite API 用量账单。
- Portal 能展示 Full Runtime 本周冻结、已消耗、剩余、120min 核对和 T+1 审计状态。

### 6. SessionRawLedger 实现

目标：

- Portal 有自己的 append-only session 账本。
- upstream `session_ledger` 只作为外部观测快照，不覆盖 Portal 账本。

涉及模块：

- `services/opl-runtime-bridge/src/state-store-message-records.mjs`
- `services/opl-runtime-bridge/src/state-store-run-records.mjs`
- `services/portal/src/domain/portal-api-sessions.mjs`
- `services/portal/src/domain/portal-api-traces.mjs`
- 新增 `SessionRawLedger` domain/state/schema

当前问题：

- 当前 state 更像投影，不是完整 append-only raw ledger。
- message status 不能只保存最终结果。

修改方式：

- 每个 event 写入 `tenantId/userId/workspaceId/oplSessionId/sequence/eventType/rawPayload/payloadHash/artifactRefs`。
- Lite ledger 可写 Portal DB / 平台审计存储。
- Full Runtime ledger 同步写隔离存储 raw prefix，并在 Portal 保存索引。
- stream chunk、tool call、file event、task event、cancel、error 都必须入账。

禁止行为：

- 覆盖式更新 raw event。
- 只保存 reply preview。
- 跨 session 复用 sequence。

交付边界：

- Portal 可按 workspace/session 查看完整对话轨迹。
- 审计可以用 ledger 重建用户请求、模型响应、任务事件和输出引用。

### 7. 运维面实现

目标：

- 平台团队能看系统运行状态。
- 运维面不成为用户 runtime 依赖，也不暴露给 AI 小白用户。

涉及模块：

- `services/portal/src/app/portal-admin-api-payloads.mjs`
- `services/portal/src/app/portal-admin-overview-payloads.mjs`
- `services/portal/frontend/src/views/admin/*`
- `services/portal/src/routes/admin-api.routes.mjs`

当前问题：

- 旧 admin payload 仍容易把 Rancher、OpenCost、registry、MinIO 当作系统状态。

修改方式：

- 运维面改成 Portal/Gateway/Adapter/Billing/Runtime Agent/ledger/billing audit 队列。
- upstream 更新状态来自 `check-one-person-lab-upstream-clean` 和 one-click update 结果。
- OpenCost、Rancher、KubeSphere、Harbor、MinIO 不作为 v21 内建状态项。
- 所有 ops API 必须校验管理员身份并记录 `operatorId`。

交付边界：

- 用户层完全看不到旧云原生工具。
- 运维层可以定位服务异常、agent 异常、账单核对异常和跨租户拒绝事件。

### 8. 旧栈删除实现

目标：

- v21 代码、部署、文档和测试不再把旧托管 K8s 栈作为可选产品模式。

涉及模块：

- `adapters/resource-provisioner/*`
- `adapters/med-autoscience-runner/*`
- `deploy/tke-package/manifests/04-runner-rbac.yaml`
- `deploy/tke-package/manifests/08-langfuse-stack.yaml`
- `configs/kind/*`
- `configs/kubesphere/*`
- Portal admin / resources / registry / OpenCost / MinIO / Harbor / Rancher 相关 payload 和前端
- 边界检查脚本

当前问题：

- 旧栈残留会让后续开发继续绕回 managed K8s runtime。

修改方式：

- v21 默认 compose/deploy 删除 resource-provisioner、med-runner、runner RBAC、K8s Job manifest、MinIO、Harbor、OpenCost、Rancher、KubeSphere。
- v21 仓库内删除旧栈服务入口、路由入口、配置入口、前端菜单入口和验收脚本入口。
- 新增边界脚本阻断旧栈重新进入 import graph、路由、前端菜单、配置或验收脚本。

禁止行为：

- 恢复 `PRODUCT_RUNTIME_MODE=managed_runtime`。
- 在用户层用旧栈词汇包装成“高级模式”。

交付边界：

- v21 默认镜像只有核心平台镜像。
- `sentrux gate .` 无退化。
- 边界脚本只检查指定 active files，避免全仓误杀。
- 边界脚本能在以下结构问题重新进入 v21 active path 时失败：
  - `runtime-bridge-runs` 重新调用 `prepare-run` 或恢复 provision 语义。
  - `portal-api-costs`、`portal-page-payload-helpers` 重新把 OpenCost 作为用户账单默认文案。
  - admin active payload 重新出现 MinIO payload 字段、MinIO 同步调用或 MinIO 控制台入口。
  - `runtime-bridge-launch` 再次把 `runnerUrl`、`k8sNamespace`、`runnerImage` 回传到 active payload。
  - `opl-adapter-client` 热路径重新出现空 `catch {}` 或 `fetchJson` 直接 `return null`。

## v21 开发清单

### Phase 0: Sentrux 基线和边界规则

目的：先把重构边界写成工具能检查的规则。

- [ ] 运行 `sentrux gate --save .` 保存阶段基线。
- [x] 修改 `.sentrux/rules.toml`，新增 user-owned runtime 边界。
- [x] 新增结构检查脚本，禁止默认路径 import managed-runtime 模块。
- [x] 新增结构检查脚本，禁止用户层 import ops-only 模块。
- [x] 新增结构检查脚本，禁止 Gateway / Adapter import upstream 内部模块。
- [x] 运行 `sentrux check .`，记录当前失败项。
- [x] 交付边界：Sentrux gate 无退化，新增边界规则可执行。

### Phase 0.5: Boundary reconciliation after retired-stack decision

目的：把 v21 新总则落实成可执行边界，避免旧托管 K8s 栈以 managed-runtime/profile/ops 名义回到产品线。

- [x] Sentrux rules 不再把 resource-provisioner / med-runner 作为 v21 正式层。
- [x] 边界脚本禁止旧栈进入 v21 代码、部署、配置、前端或验收脚本。
- [x] 旧栈模块化 smoke 改为旧栈缺席 smoke。
- [x] Runtime Bridge 默认 trace sink 改为 `session_raw_ledger`，不再内置 Langfuse publisher。
- [x] 交付边界：旧栈重新进入 v21 产品面时自动失败。

### Phase 1: Product surface and retired stack deletion

目的：把产品面固定成统一 OPL 入口、Lite/Full 双模式，并从 v21 删除旧托管 K8s Job runtime、旧运维面板和旧对象存储/镜像仓库依赖。

- [x] 将默认 `PRODUCT_RUNTIME_MODE` 迁移为 `platform_provisioned`。
- [x] 保留 `PRODUCT_RUNTIME_MODE=user_owned` 作为旧值兼容，但文档、配置生成器和新测试默认使用新语义。
- [x] 删除 v21 compose/deploy 中的 `resource-provisioner`、`med-autoscience-runner`、runner RBAC。
- [x] 删除 v21 默认配置中的 Rancher/OpenCost/Harbor/MinIO/KubeSphere URL。
- [x] 删除用户前端中的 K8s 运维、nodePool 删除、registry、OpenCost 卡片。
- [x] 新增用户层 / 运维层菜单边界：用户层只看科研闭环，运维层只看服务健康和审计队列。
- [x] 统一 Portal 进入 OPL 和直接登录 OPL 的 launch token 签发语义。
- [x] deploy/compose 默认只启动核心 4-5 个镜像。
- [x] 交付边界：新用户默认看不到平台托管 K8s 运维入口；运维面也不依赖 Rancher/OpenCost/KubeSphere 作为 v21 内建组件。

### Phase 2: Package and isolated resource model

目的：建立用户可理解的套餐/计算能力/存储容量模型，以及内部隔离计算/存储事实源，但不阻断 OPL Lite。

- [x] 新增 `UserComputeInstance` domain/state/schema。
- [x] 新增 `UserStorageBucket` domain/state/schema。
- [x] 新增 `WorkspaceResourceBinding` domain/state/schema。
- [x] 新增 Portal API：登记/绑定/解绑后台计算元数据。
- [x] 新增 Portal API：登记/绑定/解绑后台存储元数据。
- [ ] 新增 Portal API：套餐询价、确认购买、开通计算能力、开通存储容量。
- [ ] 将 `UserComputeInstance` / `UserStorageBucket` 产品文案迁移为 `CustomerComputeResource` / `CustomerStorageResource`，旧 API 作为兼容 alias。
- [x] 更新资源开通页：展示运行套餐、计算能力、存储容量、workspace binding。
- [x] 明确 OPL Lite 不要求 `WorkspaceResourceBinding`。
- [x] 用户产品文案避免 node pool、namespace、pod、PVC、ClusterRole 等云原生词汇。
- [x] 交付边界：用户可以在 Portal 创建 workspace 并登记/绑定后台计算与存储；未绑定资源的用户仍可进入 OPL Lite。
- [ ] 真实交付边界：用户可以在 Portal 选择套餐，由 Portal 真实创建后台计算/存储并完成绑定；未绑定资源的用户仍可进入 OPL Lite。

验证：

```bash
node scripts/smoke-test-v21-user-owned-resource-binding.mjs
node scripts/smoke-test-v21-user-owned-resource-postgres-contract.mjs
node scripts/smoke-test-v21-user-owned-resource-ui-contract.mjs
```

### Phase 2.5: Platform cloud provisioning

目的：把 v19-v20.34 反复验证过的“平台开腾讯云资源、绑定 ID、COS 账单核对”能力重构成 v21 正式云资源开通服务。

- [ ] 新增 v21 `cloud-provisioner` 或 Portal 内聚模块，职责只包含套餐询价、后台计算/存储创建、Runtime Agent 安装、资源状态查询、释放和 evidence 记录。
- [ ] 接入腾讯云 CVM `RunInstances` / `TerminateInstances` 或等价 API 作为内部计算实现，不再走 TKE node pool。
- [ ] 接入腾讯云 COS bucket/prefix/policy/CAM scoped credential 创建和回收，不再走平台 MinIO。
- [ ] 保留资源订单/套餐/冻结逻辑，但主键从 `runId` 迁移到 `resourceBindingId + resourceOrderId`。
- [ ] 写入真实 `cloudResourceId`、`cvmInstanceId`、`bucketName`、`rootPrefix`、`billingStartedAt`、`billingStoppedAt`、`cleanupEvidence`。
- [ ] 所有云资源必须带标签：`tenantId`、`userId`、`workspaceId`、`resourceBindingId`、`resourceOrderId`、`environment=v21`。
- [ ] 支持入门套餐、进阶套餐、自定义套餐。
- [ ] 失败状态必须可恢复：quote 不冻结、freeze 可释放、provision 失败自动清理已创建子资源、delete 失败保留重试任务。
- [ ] 灰度破坏性 full-loop 必须使用真实腾讯云资源创建和删除，不允许 `registered_only` 冒充通过。

验证：

```bash
node scripts/smoke-test-v21-cloud-provisioning-contract.mjs
RUN_V21_FULL_LOOP=1 \
V21_RESOURCE_LIFECYCLE_MODE=cloud_provisioned \
V21_CONFIRM_CREATE_RESOURCES=1 \
V21_CONFIRM_DELETE_RESOURCES=1 \
node scripts/live-test-v21-user-owned-full-loop.mjs
```

### Phase 3: Weekly protection billing

目的：把一周保护金从 run 预授权改为 binding 级冻结；API-only 不冻结保护金。

- [x] 新增 `WeeklyProtectionFreeze` domain/state/schema。
- [x] `ledger_entries` 增加 `resourceBindingId`。
- [x] 保护金冻结按 `resourceBindingId + week window` 幂等。
- [x] 120min 核对状态按 active binding 投影到 Portal。
- [x] T+1 审计状态按 binding 投影到 Portal。
- [x] 关闭套餐或释放计算资源时停止计费并释放未消耗冻结。
- [x] API-only message 仅记录 provider/API 使用账单，不触发付费计算/付费存储保护金。
- [x] 交付边界：绑定资源用户可看见本周冻结、已消耗、剩余、核对状态和 T+1 审计状态；Lite 用户不会看到错误的资源冻结。

验证：

```bash
node scripts/smoke-test-v21-weekly-protection-freeze.mjs
node scripts/smoke-test-v21-user-owned-resource-postgres-contract.mjs
node scripts/smoke-test-v21-billing-user-owned-runtime-contract.mjs
```

剩余云侧上线项：120min 和 T+1 的真实云账单执行器需要在有生产账单源后做 live gate，本地 v21 已完成 schema、状态、归因和闭环 smoke。

### Phase 4: Runtime Agent and dispatch

目的：Full Runtime 真正在 Portal 代开通的隔离计算资源上执行；API-only message 不需要运行套餐。

- [x] 新增 runtime-agent relay contract。
- [x] 后台计算记录承载 `runtimeAgentId/runtimeAgentEndpoint/runtimeAgentVersion/healthStatus`。
- [x] Agent health 状态在后台计算资源记录和运维面投影。
- [x] Adapter 对 Full Runtime resolve `WorkspaceResourceBinding` 后签发短期 runtime token。
- [x] Adapter 对 API-only message 走 provider API relay，不签发 runtime agent token。
- [x] Adapter 通过 Agent 启动或复用 `opl session runtime --acp`，仅限 Full Runtime。
- [x] 禁止默认路径调用 K8s runner。
- [x] 交付边界：Full Runtime 的消息、文件、任务执行链路落到隔离计算资源；API-only message 不需要运行套餐。

验证：

```bash
node scripts/smoke-test-v21-runtime-agent-contract.mjs
node scripts/smoke-test-v21-opl-adapter-lite-full-contract.mjs
```

剩余工程项：如需独立 runtime-agent 安装包或心跳注册服务，应作为上线部署形态继续拆分；当前 v21 已完成 Adapter 到后台 Runtime Agent 的协议、token 和 relay 合同。

### Phase 5: User storage isolation

目的：Full Runtime 文件、输出、session raw ledger 写隔离存储；API-only 默认不要求存储容量。

- [x] 新增 user storage adapter interface。
- [x] 实现 user/workspace/session scoped storage key 和 transfer token。
- [x] Full Runtime 文件上传写入 user/workspace/session prefix。
- [x] Full Runtime 输出文件写入 session outputs prefix。
- [x] Portal 文件页读取用户 storage index。
- [x] 下载文件校验 owner scope。
- [x] API-only session 只保存消息轨迹，不提供文件上传、任务输出或隔离存储下载。
- [x] 交付边界：用户只能看到和下载自己 workspace/session 的文件；Lite 用户不被要求先买存储容量。

验证：

```bash
node scripts/smoke-test-v21-user-storage-isolation.mjs
node scripts/smoke-test-workspace-storage-routes-contract.mjs
```

剩余云侧上线项：真实 COS/S3 scoped credential 需要由平台代开通存储时生成后做 live gate；本地已完成隔离 key、索引、上传/下载 scope 和端到端合同。

### Phase 6: OPL Adapter hardening

目的：不改 OPL upstream，但把 Adapter 做成稳定协议层，明确 Lite 和 Full Runtime 两种能力。

- [x] 统一 Portal entry 与 direct OPL login 的 launch token scope。
- [x] 所有 `/api/opl-launch/*` 校验 launch token scope。
- [x] API-only message request 主键为 `launchTokenHash + messageId`，并绑定 `userId/workspaceId/providerKeyRef`。
- [x] Full Runtime message request 主键为 `runtimeSessionId + launchTokenHash + messageId`。
- [x] 新增 `SessionRawLedger`。
- [x] 新增 API-only message stream。
- [x] 新增 Full Runtime ACP message stream。
- [x] 新增 message cancel。
- [x] 新增 run cancel，仅限 Full Runtime。
- [x] upstream `session_ledger` 只作为外部快照，不覆盖 Portal ledger。
- [x] 交付边界：跨用户、跨 workspace、跨 runtimeSession 或跨 providerKeyRef 访问被拒绝；API-only token 不能调用 Full Runtime API。

验证：

```bash
node scripts/smoke-test-v21-opl-entry-unified-contract.mjs
node scripts/smoke-test-v21-opl-launch-token-scope.mjs
node scripts/smoke-test-v21-session-raw-ledger.mjs
node scripts/smoke-test-v21-opl-stream-cancel-ledger-contract.mjs
node scripts/smoke-test-v21-opl-adapter-lite-full-contract.mjs
```

### Phase 7: OPL login and API Key UX

目的：用户在 opl.medopl.cn 可直接登录并绑定 gflabtoken。

- [x] Gateway 注入登录表单增强脚本。
- [x] 在密码下面添加 `gflabtoken API Key` 输入。
- [x] 写明来源：`模型服务来源于 gflabtoken`。
- [x] 登录请求带 `apiKey/gflabtoken` 到 Portal internal login。
- [x] Adapter 写 provider secret，不写 upstream。
- [x] 交付边界：新用户在 OPL 登录后可发送消息，缺 API Key 时明确阻断。

验证：

```bash
node scripts/smoke-test-v21-gflabtoken-login-contract.mjs
```

### Phase 8: One-click OPL upstream update

目的：保证经常拉取 upstream 仍可稳定升级。

- [x] 新增 `scripts/update-one-person-lab-upstream.mjs`。
- [x] 支持 `--check-only`。
- [x] 检查 upstream clean。
- [x] 支持 `git pull --ff-only upstream <current-branch>`。
- [x] 运行 `node scripts/check-one-person-lab-upstream-clean.mjs` 边界检查。
- [x] 运行 ACP contract gate。
- [x] 运行 OPL Web gateway smoke。
- [x] 运行 platform-provisioned runtime boundary check。
- [x] 准备 platform build/push dry-run 输出，保留既有 `OPL_WEB_IMAGE`，不从 `one-person-lab` runtime 伪构建 Web 镜像。
- [x] 新增 `scripts/smoke-test-v21-one-person-lab-current-upstream-package-contract.mjs`，验证当前 GitHub upstream 结构可通过一键更新检查。
- [x] 交付边界：一条命令完成 upstream 更新或 check-only 验证，失败时不产生 upstream dirty。

### Phase 9: End-to-end acceptance

目的：分层验证用户目标闭环。Phase 9 不能把本地 smoke、灰度只读验收和真实套餐/存储容量 full-loop 混成一个结论。

验收分三层：

```text
本地合同闭环
  -> 不创建云资源
  -> 用 fake/local Runtime Agent 验证 API-only、Full Runtime、文件、账单、ledger 合同

灰度非破坏性闭环
  -> 固定 Host/SNI + 灰度 CLB
  -> 只验证 opl-v21 build tag、登录、Portal API、Portal->OPL 跳转、OPL API Key surface
  -> 不开通付费计算
  -> 不删除资源
  -> 不发模型消息

灰度破坏性 full-loop
  -> 真实后台 Runtime Agent endpoint
  -> Portal 真实开通套餐和存储容量
  -> 真实发送消息、上传文件、跑任务、下载输出
  -> 关闭套餐或释放资源，确认停止扣费
```

本地合同闭环已覆盖：

- [x] 创建 1 名新用户。
- [x] 给用户充值额度。
- [x] 用户登录 `portal.medopl.cn`。
- [x] 用户登录 `opl.medopl.cn`。
- [x] 用户从 Portal 点击进入 OPL。
- [x] 用户直接打开 OPL 登录。
- [x] 两个入口签发同一 scope 语义的 launch token。
- [x] 用户在 OPL 输入 API Key 并发送 API-only 消息。
- [x] Portal 展示 Lite session 对话轨迹和 API 使用账单。
- [x] 用户在 Portal 登记或绑定后台计算元数据。
- [x] 用户选择存储容量。
- [x] Portal 展示套餐、计算能力、存储容量和保护金预扣。
- [x] 用户在 OPL 进入 Full Runtime 并发送 runtime-backed 消息。
- [x] 用户上传文件。
- [x] 用户运行文件任务。
- [x] 用户下载输出文件。
- [x] Portal 展示 workspace 文件。
- [x] Portal 展示账单、120min 核对、T+1 审计状态。
- [x] Portal 可追踪 session 对话和 raw ledger。
- [x] 用户关闭套餐或释放后台计算资源。
- [x] 计费停止，保护金结算或释放。
- [x] 交付边界：本地完整闭环 smoke 通过，无 upstream dirty，无 Sentrux 退化。

验证：

```bash
node scripts/smoke-test-v21-end-to-end-user-owned-closure.mjs
node scripts/update-one-person-lab-upstream.mjs --check-only
```

灰度非破坏性验收已覆盖：

- [x] v21 deploy env gate 通过。
- [x] 灰度 Portal `/healthz` 是 `opl-v21`。
- [x] 灰度 OPL Gateway `/healthz` 是 `opl-v21`。
- [x] 灰度 Adapter `/portal-adapter/healthz` 是 `opl-v21`。
- [x] `/portal/api/my/resources` 返回 `410 retired_in_v21`。
- [x] `/portal/api/user-owned-resources` 可读。
- [x] `/portal/api/billing` 可读。
- [x] `/portal/api/session-traces` 可读。
- [x] `/portal/opl` 可跳转到 OPL launch。
- [x] OPL direct login 在缺 API Key 时返回 `provider_api_key_required`。

灰度非破坏性验证：

```bash
V21_ENV_FILE=/home/dev/.secrets/medopl/tke-v21.env \
V21_SECRETS_ENV_FILE=/home/dev/.secrets/medopl/secrets.env.txt \
V21_CONNECT_HOST=lb-cjchlvww-907mxycpd48jrlo3.clb.usw-tencentclb.com \
V21_EXPECTED_BUILD_TAG=opl-v21 \
node scripts/check-v21-cloud-readiness.mjs

RUN_V21_GRAY_PREACCEPTANCE=1 \
V21_ENV_FILE=/home/dev/.secrets/medopl/tke-v21.env \
V21_SECRETS_ENV_FILE=/home/dev/.secrets/medopl/secrets.env.txt \
V21_CONNECT_HOST=lb-cjchlvww-907mxycpd48jrlo3.clb.usw-tencentclb.com \
V21_EXPECTED_BUILD_TAG=opl-v21 \
node scripts/live-test-v21-gray-preacceptance.mjs
```

灰度破坏性 full-loop 尚未完成，当前缺少真实 `V21_TEST_RUNTIME_AGENT_ENDPOINT` 和显式 create/delete 开关。该层必须单独跑，不能用本地 smoke 或灰度 preacceptance 替代。

灰度破坏性验证：

```bash
RUN_V21_FULL_LOOP=1 \
V21_CONFIRM_CREATE_RESOURCES=1 \
V21_CONFIRM_DELETE_RESOURCES=1 \
V21_ENV_FILE=/home/dev/.secrets/medopl/tke-v21.env \
V21_SECRETS_ENV_FILE=/home/dev/.secrets/medopl/secrets.env.txt \
V21_CONNECT_HOST=lb-cjchlvww-907mxycpd48jrlo3.clb.usw-tencentclb.com \
V21_EXPECTED_BUILD_TAG=opl-v21 \
V21_TEST_RUNTIME_AGENT_ENDPOINT=<真实后台 Runtime Agent endpoint> \
node scripts/live-test-v21-user-owned-full-loop.mjs
```

正式切流前必须看到灰度破坏性 full-loop evidence。缺该 evidence 时，v21 只能算灰度入口和非破坏性验收通过，不能算完整上线闭环完成。

## 验收命令

每个阶段至少运行：

```bash
sentrux gate .
sentrux check .
node scripts/check-one-person-lab-upstream-clean.mjs
node scripts/check-v21-user-owned-runtime-boundaries.mjs
npm --prefix services/portal run check
npm --prefix services/opl-runtime-bridge run check
node --check services/opl-web-gateway/src/server.mjs
```

最终验收必须包含：

```bash
node scripts/update-one-person-lab-upstream.mjs --check-only
node scripts/smoke-test-opl-acp-runtime-adapter.mjs
node scripts/smoke-test-opl-web-gateway-launch.mjs
node scripts/smoke-test-v21-one-person-lab-upstream-update-contract.mjs
node scripts/smoke-test-v21-user-owned-boundary-script-contract.mjs
node scripts/check-v21-user-owned-runtime-boundaries.mjs
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

云端灰度验收必须包含：

```bash
node scripts/check-v21-deploy-env.mjs \
  --deploy-env-file /home/dev/.secrets/medopl/tke-v21.env \
  --deploy-secrets-env-file /home/dev/.secrets/medopl/secrets.env.txt \
  --json

V21_ENV_FILE=/home/dev/.secrets/medopl/tke-v21.env \
V21_SECRETS_ENV_FILE=/home/dev/.secrets/medopl/secrets.env.txt \
V21_CONNECT_HOST=<gray-clb-host> \
V21_EXPECTED_BUILD_TAG=opl-v21 \
node scripts/check-v21-cloud-readiness.mjs

RUN_V21_GRAY_PREACCEPTANCE=1 \
V21_ENV_FILE=/home/dev/.secrets/medopl/tke-v21.env \
V21_SECRETS_ENV_FILE=/home/dev/.secrets/medopl/secrets.env.txt \
V21_CONNECT_HOST=<gray-clb-host> \
V21_EXPECTED_BUILD_TAG=opl-v21 \
node scripts/live-test-v21-gray-preacceptance.mjs
```

正式切流前的破坏性验收必须包含：

```bash
RUN_V21_FULL_LOOP=1 \
V21_CONFIRM_CREATE_RESOURCES=1 \
V21_CONFIRM_DELETE_RESOURCES=1 \
V21_ENV_FILE=/home/dev/.secrets/medopl/tke-v21.env \
V21_SECRETS_ENV_FILE=/home/dev/.secrets/medopl/secrets.env.txt \
V21_CONNECT_HOST=<gray-clb-host> \
V21_EXPECTED_BUILD_TAG=opl-v21 \
V21_TEST_RUNTIME_AGENT_ENDPOINT=<真实后台 Runtime Agent endpoint> \
node scripts/live-test-v21-user-owned-full-loop.mjs
```

验收结论必须按层级写：

- 本地合同闭环通过。
- 灰度非破坏性验收通过。
- 灰度破坏性 full-loop 通过或未执行。
- 正式切流后 readiness/preacceptance 通过或未执行。

禁止把未执行的层级写成通过。

## 不做事项

v21 默认路径不做：

- 不改 `one-person-lab` 源码。
- 不做 TKE node pool 作为 v21 默认 OPL runtime。
- 不做平台默认 K8s Job runtime。
- 不做默认 MinIO 用户数据存储。
- 不做默认 Harbor 分发面。
- 不做默认 OpenCost 成本来源。
- 不做默认 Rancher/KubeSphere 入口。
- 不在用户产品层展示 node pool、pod、namespace、PVC、ClusterRole、manifest。
- 不把旧 resource-provisioner、med-runner、OpenCost、MinIO、Harbor、Rancher、KubeSphere 作为 v21 可选产品模式。
- 不做假流式切字。
- 不用 runId 作为账单主键。
- 不让 session 隐式开通付费计算或付费存储。

## 成功标准

v21 成功标准：

- 新用户能完成充值、进入 OPL Lite、绑定 API Key、发送 API-only 消息，并看到 Lite 轨迹和 API 使用账单。
- 新用户能按需在 Portal 选择套餐和存储容量、冻结保护金、进入 Full Runtime、上传文件、运行任务、下载输出、查看账单和轨迹、关闭套餐或释放资源。
- 用户可以从 Portal 进入 OPL，也可以直接登录 OPL；两个入口共用同一授权和审计语义。
- 用户产品层对 AI 小白和科研小白可理解，不暴露云原生运维概念。
- 运维层能看到服务健康、upstream 更新、Runtime Agent、账单核对和审计队列，但不进入用户 runtime 热路径。
- upstream `one-person-lab` 始终 clean。
- OPL 可一键拉取更新。
- 默认自有镜像优先控制在 5 个以内；如果 Runtime Agent 采用独立镜像，必须仍然不恢复旧托管 K8s 栈。
- 后台计算隔离、后台存储隔离、多租户 token scope 隔离全部有测试。
- Sentrux gate 不退化，并逐步让 `min_quality` 和 `min_modularity` 达到规则线。
