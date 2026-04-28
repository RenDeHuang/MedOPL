# OPL v13 商业闭环 AI 开发清单

日期：2026-04-28
版本标记：opl-v13
基线：opl-v12

## 目标

v13 的目标是把 v12 的“商业化内测入口版”推进到“可验收的商业闭环版”：

1. 新用户可以由 Portal 创建、充值，并用同一账号登录 Portal 与 OPL。
2. 用户可以在 Portal 选择服务器规格和存储方案，看到真实腾讯云报价。
3. Portal 创建 Resource Order 并冻结余额，Resource Provisioner 自动创建每订单独立 TKE 节点池。
4. OPL 使用原始 one-person-lab runtime，不修改 upstream，只通过 Gateway/Adapter 注入 Portal 上下文。
5. OPL 内发消息、上传文件、跑任务后，Portal 能看到 workspace 文件、运行记录、账单、session trace。
6. 用户下载结果文件，释放/删除服务器后停止继续扣费，最终账单由腾讯云账单或 COS 日账单回补。

顶层原则：

- 模块内高聚合：身份、账单、资源、存储、trace、runtime 各自收口在自己的模块。
- 模块间低耦合：Portal 不直连腾讯云 Secret，Billing 不登录用户，Provisioner 不扣费，Runner 不决定价格，Gateway 不读 Portal DB。
- 一个模块挂了不影响另一个模块的基本可用性：例如 Billing 不可用时用户仍可登录和查看 workspace，但不能显示真实结算；Provisioner 不可用时不能开节点，但 Portal/OPL 登录不应失败。

## 当前 v12 事实

- `portal.medopl.cn` 可以登录 Portal。
- `opl.medopl.cn` 可以用 Portal 用户邮箱密码登录 OPL 原生登录接口。
- Portal `/portal/opl` 可以生成 launch token。
- OPL Gateway 可以通过 launch cookie 返回 Portal 用户身份。
- OPL Web upstream 仍是 `opl-web-opl:opl-v1`，对应原始 one-person-lab Web，v12 未修改 upstream。
- Portal workspace API 可以看到默认 workspace、文件列表、账单钱包和流水。
- 当前 workspace 文件列表为空，未完成 OPL 文件上传到 Portal workspace 的端到端验证。
- 当前真实腾讯云报价未完成，原因是缺少 `TENCENT_PRICE_IMAGE_ID` 或可自动发现的镜像 ID。
- v13 指定公共镜像要求：硅谷区域 Ubuntu 22.04 LTS。实现上不在代码里硬编码 ImageId，而由 Billing/Provisioner 调腾讯云 CVM `DescribeImages` 按 Region、ImageName、ImageOsName 自动发现，并把选中的 ImageId 写入只读运行状态。
- 用户已确认 TKE 到腾讯云 API/COS 的网络连通性，v13 不再把网络作为默认阻塞项；仍需在 smoke 中验证实际 API 调用。
- 当前 Resource Provisioner 查询 TKE/CVM 返回 `fetch failed`，真实节点池未创建成功。
- 当前 COS 接口只是 `/billing/cos/status` 配置状态，没有实现 COS List/Get/Parse 账单文件。
- 当前 Langfuse trace 查询返回 `status_only`，并且 `langfuse-trace-client.mjs` 仍按本地 Docker ClickHouse 容器查询，不适合 Langfuse Cloud。
- 当前代码仍有大文件：`services/portal/src/app/portal-app.mjs`、`adapters/billing-aggregator/src/server.mjs`、`adapters/med-autoscience-runner/src/server.mjs`。

## 用户问题结论

### 1. Portal 和 OPL 两个网站是否都可以登录？

可以，但语义不同：

- `portal.medopl.cn`：Portal 登录页，使用 Portal 本地账号或统一身份账号。
- `opl.medopl.cn`：OPL Web 页面，原生登录接口已通过 Gateway 桥接到 Portal 内部认证；同一 Portal 邮箱密码可以登录。
- 推荐商业入口仍是 Portal 的“进入工作台”，因为它会签发 launch token 并绑定 tenant、workspace、session、runtime。

验收标准：

- 新建用户登录 Portal 返回 302 到 `/portal` 或可访问 `/portal/app/overview`。
- 同一用户调用 OPL `/api/auth/login` 与 `/api/v1/auths/signin` 返回 200。
- 带 launch cookie 调 OPL `/api/auth/user` 返回 Portal 用户。

### 2. Workspace 能否上传文件？文件存储到哪里？

v12 的 Portal workspace 文件读取路径是共享 runtime PVC：

- inputs：`/app/.runtime/med-autoscience/workspaces/{userId}/{workspaceId}/inputs`
- outputs：`/app/.runtime/med-autoscience/workspaces/{userId}/{workspaceId}/outputs`
- run metadata：`/app/.runtime/med-autoscience/runs`

v13 要补齐：

- 存储必须订单化/按需开通：用户未开通 workspace storage 时，Portal 和 OPL 都禁止上传文件，Runner 不写 output 文件，只允许纯对话/无文件任务。
- 新增 Storage Order 或 Resource Order storage section：`storagePlanId`、`storageSizeGb`、`storageBackend=cos|cfs`、`retentionPolicy`、`status`。
- COS 适合作为用户可购买的对象存储：按 tenant/workspace prefix 隔离，例如 `workspaces/{tenant_id}/{workspace_id}/inputs/` 和 `outputs/`。
- CFS/PVC 适合作为运行时热目录：任务执行期间挂载或同步，任务结束后把 output 同步到 COS。
- Portal 上传文件 API。
- OPL 上传文件到 workspace inputs 的桥接。
- Runner 输出文件写回 outputs。
- Portal 下载单文件和 zip 打包下载。
- 对象存储同步：COS 是商业存储账单来源，CFS/PVC 是 runtime scratch，不作为长期用户资产源。

存储策略：

- 初版运行时最优：CFS/PVC，适合容器挂载、任务读写、低改造成本。
- 长期归档最优：COS，适合结果文件、账单文件、下载、跨节点迁移。
- 不建议直接把 COS 当容器 POSIX 工作目录，除非引入稳定挂载层并接受一致性/性能成本。

### 3. 是否有真实报价、是否可以自动开通节点、存储是否 COS 最优？

v12 尚未达标：

- 真实报价缺 `TENCENT_PRICE_IMAGE_ID`。
- Provisioner 查询 TKE/CVM 失败，错误为 `fetch failed`。
- `RESOURCE_PROVISIONING_ENABLED` 当前不应贸然打开，直到报价、权限、网络、nodePool payload 全部通过只读验证。

v13 目标：

- Billing 负责 `server-plans` 真实报价。
- Provisioner 负责 `ensure-capacity` 创建每订单独立 TKE 节点池。
- Portal 只负责订单、冻结余额、UI 和状态展示。
- 存储选择拆成：
  - 运行存储：CFS/PVC。
  - 结果归档：COS。
  - 账单归档：COS `daily/`。

### 4. 腾讯云账单是否隔日回补？

应按“两条账单链路”设计：

- 运行中 pending：按报价、冻结、OpenCost/本地 metering 展示，不作为最终扣费。
- 真实 exact：来自腾讯云 `DescribeBillDetail` 或 COS 账单文件。

生产建议：

- `DescribeBillDetail` 做近实时回补，通常会有延迟，不保证分钟级完整。
- COS 账单文件做 T+1 日对账，作为最终校准来源。
- 没有 exact bill 时不能做最终 resource_charge，只能维持 pending/frozen 状态。

### 5. session trace 后端如何可用？

v13 采用 Langfuse Cloud，不在 TKE 集群内自建 Langfuse Web/Worker/Postgres/ClickHouse/Redis。Langfuse 的内部架构仍可作为事件模型参考，但生产边界要收敛成“平台只调用 Langfuse Cloud API”。

v13 接入方式：

- OPL Gateway/Adapter 在 launch、message、run start、run complete、artifact created 时生成 trace event。
- Trace Gateway 或 Adapter 调 Langfuse Cloud ingestion API，写入 trace/span/observation。
- Portal 只查询 Langfuse Cloud API，不直接解析 OPL 页面状态，也不依赖本地 ClickHouse 容器名。
- trace 关键标签必须包括 `tenant_id`、`workspace_id`、`run_id`、`resource_order_id`、`portal_user_id`。

验收标准：

- Portal trace 页面能按用户、workspace、run 过滤。
- OPL 发一条消息后 Langfuse 出现 trace。
- Runner 完成任务后 Langfuse 出现 run span 和 artifact event。

参考：

- https://langfuse.com/handbook/product-engineering/architecture
- https://langfuse.com/docs

### 6. 删除服务器、停止扣费如何实现？

需要 Resource Order 生命周期闭环：

1. `running`：节点池存在，可能产生费用。
2. 用户点击释放：Portal 调 Provisioner `scale-to-zero`。
3. Provisioner 把节点池 `desired/min` 调到 0，并记录状态。
4. Portal 把订单转为 `released`，释放冻结余额中未使用部分。
5. 用户选择删除节点池：
   - 默认不销毁 CVM 实例时，必须提示仍可能继续产生费用。
   - 选择销毁 CVM 实例时，必须二次确认数据不可恢复风险。
6. Provisioner 调 TKE 删除节点池，回填 `nodePoolDeletedAt`。
7. Billing 等腾讯云 exact bill 回补，订单进入 `reconciling -> settled`。

验收标准：

- 删除前 UI 明确展示“销毁 CVM 后节点本地数据不可恢复”。
- 删除成功后云资源列表不再出现该订单节点池。
- 订单状态变为 `released` 或 `settled`。
- 删除后不再产生 pending 运行费用。
- exact bill 到达后有 `resource_charge` 或 `makeup_charge/refund`。

### 7. 大文件和维护性问题在哪里？

必须在 v13 拆分：

- `services/portal/src/app/portal-app.mjs`
  - 当前约 5882 行，聚合了 auth、admin、workspace、billing、resource order、storage、trace、HTML legacy routes、DB persistence。
  - 应拆成 routes + domain + state + integrations。
- `adapters/billing-aggregator/src/server.mjs`
  - 当前约 1862 行，聚合了 OpenCost pending、腾讯云签名、报价、账单查询、reconcile、HTML UI。
  - 应拆成 config、tencent-price、tencent-billing、cos-bill-reader、reconcile-ledger、routes。
- `adapters/med-autoscience-runner/src/server.mjs`
  - 当前约 1035 行，聚合 runner API、Job metadata、artifact handling、billing reconcile placeholder。
  - 应拆成 job-factory、metadata-store、artifact-store、routes、health。
- `services/portal/frontend/src/api/portal.ts`
  - 当前约 984 行，聚合所有 Portal 前端 API 类型和请求函数。
  - 应拆成 `auth.api.ts`、`workspace.api.ts`、`billing.api.ts`、`resource-orders.api.ts`、`cloud.api.ts`、`traces.api.ts`。

`$scan` 执行说明：本会话没有暴露 sentrux MCP 工具，且本机没有 `sentrux` 命令；已按 scan 目标做本地结构扫描，结论是 v13 必须至少拆生产热路径大文件，避免继续把新商业闭环堆回单文件。

## v13 模块边界

### Portal

职责：

- 用户、租户、钱包、Resource Order、商业 UI、workspace 视图、下载入口。

不做：

- 不读 Tencent Secret。
- 不直接调用 TKE/CVM/COS。
- 不决定 exact cost。
- 不修改 OPL upstream。

### OPL Gateway

职责：

- OPL 域名入口。
- Portal 原生账号登录桥接。
- launch token cookie。
- WebSocket/HTTP proxy。

不做：

- 不读 Portal DB。
- 不扣费。
- 不创建节点。

### Portal OPL Adapter / Runtime Bridge

职责：

- launch token bootstrap。
- 绑定 tenant/workspace/session/runtime。
- 将 OPL run 请求转成 Portal Resource Order + Runner 调用。
- 发送 trace events。

不做：

- 不保存腾讯云 Secret。
- 不做最终账单。

### Billing Aggregator

职责：

- 腾讯云 CVM 真实报价。
- 腾讯云账单明细。
- COS 日账单 List/Get/Parse。
- exact attribution。

不做：

- 不登录用户。
- 不改 Portal 用户状态。
- 不创建节点。

### Resource Provisioner

职责：

- 只读云资源状态。
- 创建、扩缩容、删除订单独立节点池。
- 回填 nodePoolId/instanceIds。

不做：

- 不扣费。
- 不登录用户。
- 不展示商业 UI。

### Runner / Orchestrator

职责：

- 创建 Job。
- 注入 labels：`tenant_id`、`workspace_id`、`run_id`、`resource_order_id`、`server_plan_id`。
- 挂载 workspace runtime 存储。

不做：

- 不决定价格。
- 不直接操作钱包。

### Langfuse Cloud Trace

职责：

- 通过 Langfuse Cloud API 接收 OPL/Runner trace。
- 存储和查询 session、message、run、artifact trace。

不做：

- 不作为业务 DB。
- 不作为账单来源。

## v13 八步闭环缺口矩阵

| 步骤 | v12 状态 | v13 必须补齐 |
| --- | --- | --- |
| 创建用户 | 管理员创建用户可用 | smoke 固化创建用户和唯一邮箱，避免人工验证 |
| 充值额度 | 管理员充值可用 | ledger 要区分充值、冻结、释放、最终扣费 |
| 双域名登录 | Portal 登录、OPL native login 基本可用 | `portal.medopl.cn` 与 `opl.medopl.cn` 都纳入自动验收 |
| 创建节点和选择存储 | Resource Order 有雏形，真实节点池未闭合 | 真实报价、冻结、每订单节点池、storage order 一起进入订单 |
| OPL 工作与原始 runtime | upstream 未修改 | Gateway/Adapter 注入上下文，禁止改 upstream runtime |
| 发消息和跑文件任务 | 文件端到端未闭合 | Adapter 文件桥接、Runner 读 inputs、写 outputs、trace emitter |
| Portal 查看文件/账单/轨迹 | workspace 和 billing API 有雏形，trace 是 status only | COS workspace、COS 日账单、Langfuse Cloud trace 三条链路接通 |
| 下载文件和删除服务器 | 下载、释放、删除、停止扣费未闭合 | Portal 下载 API、Provisioner scale/delete、Billing exact settlement、ledger refund/makeup |

## v13 开发任务

### A. 身份与入口验收

目的：保证两个域名都能登录，且商业入口推荐 Portal launch。

开发：

- 增加 smoke：创建用户、充值、Portal 登录、OPL native login、Portal launch、OPL `/api/auth/user`。
- Gateway 对 launch URL 长度和 cookie 解析做回归测试。
- Portal UI 把“进入工作台”做成主行动，不暴露 OPL 工程名称。

验收：

- 8 步测试前 3 步全自动通过。

### B. Workspace 文件闭环

目的：用户能上传输入文件、OPL/Runner 能使用文件、Portal 能下载结果。

开发：

- Portal 增加 `storageEntitlement` 判断：未开通 storage 的 workspace，上传按钮禁用，上传 API 返回 402/403 业务错误。
- Adapter 文件桥接也必须检查 storage entitlement，不能绕过 Portal UI 直接上传。
- Portal 新增 upload API：`POST /portal/api/workspace/files/upload`。
- Adapter 新增 OPL 文件桥接 API：`POST /portal-adapter/api/workspace/files`。
- Runner 在没有 storage entitlement 时拒绝写 output artifact；有 entitlement 时输出统一写入 `outputs/` 并生成 artifact metadata。
- Portal workspace 页面显示 inputs/outputs、大小、更新时间、下载链接。
- 增加 COS sync worker，把 inputs/outputs 同步到 `workspaces/{tenant_id}/{workspace_id}/`；CFS/PVC 只作为 runtime scratch，不作为长期用户资产源。

验收：

- 未开通 storage 时，Portal 上传、OPL 上传桥接、Runner output 都被明确拒绝，且不产生对象存储费用。
- 开通 storage 后，COS prefix 可见，账单标签可归因到 tenant/workspace。
- 上传 `input.txt` 后 Portal storage API 显示 inputsCount=1。
- OPL run 读取该文件并输出 `result.txt`。
- Portal 可以下载单文件和 zip。

### C. 真实服务器报价与节点创建

目的：用户选择规格后看到真实腾讯云价格，并能创建订单独立节点池。

开发：

- Billing 增加 `TENCENT_PRICE_IMAGE_ID` 自动发现：
  - 优先按硅谷区域 Ubuntu 22.04 LTS 公共镜像调用 CVM `DescribeImages` 发现 ImageId。
  - 其次从现有节点/节点池 OS/ImageId 读取。
  - 失败时阻塞报价，不伪造价格。
- Billing `server-plans` 对四档 CPU 规格返回真实 `unitPrice`、`priceUpdatedAt`、`pricingSource=tencent_cloud_price`。
- Provisioner 在只读云状态 OK 后才允许 `RESOURCE_PROVISIONING_ENABLED=1`。
- Provisioner `ensure-capacity` 生成 TKE nodePool payload，含 VPC/Subnet/SG、labels、taints、min=0、max=2。
- Provisioner 记录订单生命周期事件：`provision_requested`、`node_pool_created`、`instances_ready`、`scale_to_zero_requested`、`node_pool_deleted`、`provision_failed`，供 Portal 状态页和审计使用。
- 跨模块接口必须有幂等键：`resourceOrderId` + `idempotencyKey`，重复调用不能重复创建节点池。

验收：

- `/server-plans` 四档规格价格非 0 且来源为腾讯云。
- 创建订单后状态 `quoted -> frozen -> provisioning`。
- TKE 控制台出现带 `resource_order_id` 的节点池。
- 重复调用同一个订单的 provision API，不会创建第二个节点池。

参考：

- https://www.tencentcloud.com/document/api/213/33272

### D. COS 账单日对账

目的：COS `daily/` 账单文件成为 T+1 exact bill 对账来源。

开发：

- Billing 新增 `cos-bill-reader.mjs`：
  - TC3/COS 签名。
  - ListObjects by prefix。
  - GetObject。
  - CSV/JSON 解析。
  - 标签字段校验。
- 新增 `/billing/cos/files`、`/billing/cos/reconcile`。
- 没有完整标签的账单进入 unattributed 队列，不扣 run 级费用。

验收：

- `/billing/cos/status` 不只显示配置，还显示最近文件、最近读取时间、解析行数。
- 无 exact bill 不生成最终扣费。
- 有 exact bill 后订单进入 settled。

### E. Langfuse Session Trace

目的：Portal 能看到 OPL 对话轨迹和 run trace。

开发：

- 使用 Langfuse Cloud，不在本集群自建 Langfuse Web/Worker/Postgres/ClickHouse/Redis。
- Secret 只放 Kubernetes Secret：`LANGFUSE_PUBLIC_KEY`、`LANGFUSE_SECRET_KEY`、`LANGFUSE_BASE_URL`。
- 删除 Portal 对本地 Docker ClickHouse 容器名的依赖，改为 Langfuse Cloud API client。
- Adapter 新增 trace emitter，并把 launch、message、run request、artifact metadata 转成统一 trace event。
- Runtime Bridge 新增 trace publisher，只负责把领域事件发布到 Langfuse Cloud；不把 Langfuse SDK 直接扩散到 Gateway/Runner。
- Runner 新增 run lifecycle event 输出，由 Runtime Bridge 或 Adapter 统一发布 run span 和 artifact event。
- Portal trace client 只读 Langfuse API；ClickHouse 查询只保留在本地开发诊断脚本，不进入生产路径。

验收：

- 用户在 OPL 发消息后，Portal `/portal/api/traces` 返回 trace。
- Trace 带 `tenant_id/workspace_id/session_id/run_id`。
- `langfuse-trace-client.mjs` 不再出现 `docker exec`、本地 ClickHouse 容器名或生产路径 ClickHouse SQL。

### F. 删除服务器与停止扣费

目的：资源生命周期和费用生命周期一致。

开发：

- Portal Release UI：保留节点池、缩容到 0、删除节点池、销毁 CVM 四种动作清楚分开。
- Provisioner 实现 `scale-to-zero`、`delete-node-pool` 状态回填。
- Billing 只用 exact bill 做最终扣费。
- Portal ledger 对释放冻结、退款、补扣做不可变流水。

验收：

- 删除后 Provisioner cloud resources 不再显示对应 nodePool。
- Portal 订单状态 released/settled。
- 后续 pending cost 停止增长。

### G. 大文件拆分

目的：降低维护风险，保证模块内高聚合。

开发：

- Portal 拆：
  - `routes/auth.routes.mjs`
  - `routes/workspace.routes.mjs`
  - `routes/billing.routes.mjs`
  - `routes/resource-order.routes.mjs`
  - `routes/admin.routes.mjs`
  - `state/portal-store.mjs`
  - `state/portal-persistence-json.mjs`
  - `state/portal-persistence-postgres.mjs`
- Billing 拆：
  - `config.mjs`
  - `tencent-price.mjs`
  - `tencent-billing.mjs`
  - `cos-bill-reader.mjs`
  - `reconcile.mjs`
  - `routes.mjs`
- Runner 拆：
  - `job-factory.mjs`
  - `metadata-store.mjs`
  - `artifact-store.mjs`
  - `routes.mjs`

验收：

- 单文件不超过 800 行，路由文件不超过 500 行。
- smoke tests 全通过。

## v13 端到端验收脚本

必须新增：

- `scripts/smoke-test-v13-commercial-e2e.mjs`
  - 创建用户。
  - 充值。
  - Portal 登录。
  - OPL native login。
  - Portal launch。
  - 上传文件。
  - 创建订单 quote/freeze/provision。
  - 调 Runner 跑任务。
  - 查询 Portal workspace 文件、账单、trace。
  - release/delete node pool。

- `scripts/smoke-test-v13-cos-bill-reader.mjs`
  - 无 COS 权限时失败原因明确。
  - 有 COS 权限时列出文件并解析标签。

- `scripts/smoke-test-v13-langfuse-trace.mjs`
  - 发送 trace。
  - 查询 trace。

## v13 推云前标准

必须全部满足才允许推 `opl-v13`：

- 不能把 SecretId/SecretKey 写入 git、YAML、镜像、日志摘要。
- `portal.medopl.cn/healthz` 返回 `sha=opl-v13`。
- `opl.medopl.cn/healthz` 返回 `sha=opl-v13`。
- 真实报价非 0。
- 真实 TKE nodePool 创建成功。
- COS 至少读取到一个账单文件或明确显示“无文件但权限可用”。
- Langfuse trace 可写可查。
- 删除节点池后订单状态和资源状态一致。

## 当前 v13 仍需要用户/云侧准备

1. 允许 Billing/Provisioner 在 `na-siliconvalley` 自动发现 Ubuntu 22.04 LTS 公共镜像；如果自动发现失败，再提供一个硅谷一区可用的 CVM `ImageId`。
2. 在 `opl-system` namespace 创建 Kubernetes Secret：腾讯云 Billing/COS/Provisioner 凭证、Langfuse Cloud `LANGFUSE_PUBLIC_KEY`、`LANGFUSE_SECRET_KEY`、`LANGFUSE_BASE_URL`。Secret 不进入 git、YAML、镜像或日志摘要。
3. COS `daily/` 下放入至少一个真实账单样例文件，或确认投递已经开启但当前周期还没有文件。
4. 给 COS bucket/prefix 配好最小权限：Billing 只读账单 prefix；Workspace storage 只读写 `workspaces/{tenant_id}/{workspace_id}/`。
5. 确认测试创建/删除 TKE 节点池会产生费用，允许用测试订单执行。
