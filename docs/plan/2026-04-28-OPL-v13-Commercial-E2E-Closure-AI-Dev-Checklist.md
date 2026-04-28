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

硬边界：

- `https://github.com/gaofeng21cn/one-person-lab` 是 upstream OPL 产品代码，v13 不修改它的 Web、runtime、任务执行逻辑或依赖。
- `opl-web-opl` 继续视为原始 OPL Web 镜像；如果需要登录、文件、trace、订单上下文，只能通过 Gateway、Adapter、Runtime Bridge、Runner 外围模块注入或桥接。
- 禁止把 Portal 逻辑、腾讯云逻辑、账单逻辑、Langfuse 逻辑写进 OPL upstream。
- 任何 AI 开发任务如果发现必须改 OPL upstream 才能完成，应标记为设计冲突，回到 Gateway/Adapter/Runtime Bridge 方案，不允许直接修改 upstream。

## 当前 v12 事实

- `portal.medopl.cn` 可以登录 Portal。
- `opl.medopl.cn` 可以用 Portal 用户邮箱密码登录 OPL 原生登录接口。
- Portal `/portal/opl` 可以生成 launch token。
- OPL Gateway 可以通过 launch cookie 返回 Portal 用户身份。
- OPL Web upstream 仍是 `opl-web-opl:opl-v1`，对应原始 one-person-lab Web，v12 未修改 upstream。
- Portal workspace API 可以看到默认 workspace、文件列表、账单钱包和流水。
- 当前 workspace 文件列表为空，未完成 OPL 文件上传到 Portal workspace 的端到端验证。
- 当前真实腾讯云报价未完成，原因是 Billing/Provisioner 还没有把硅谷 Ubuntu 22.04 LTS 镜像 ID 接入报价和节点池 payload。
- v13 指定公共镜像要求：硅谷区域 Ubuntu 22.04 LTS，已确认默认 fallback `ImageId=img-487zeit5`。实现上集中放在 Billing/Provisioner config，优先级为 env override -> Tencent `DescribeImages` 精确发现 -> 已确认 fallback `img-487zeit5`，避免在业务逻辑里散落硬编码。
- 用户已确认 TKE 到腾讯云 API/COS 的网络连通性，v13 不再把网络作为默认阻塞项；仍需在 smoke 中验证实际 API 调用。
- 用户已授权测试环境调用真实腾讯云 API 创建和删除 TKE 节点池；必须默认 `minNodes=0`、`maxNodes=2` 并启用 scale-to-zero 控制成本。
- 当前 Resource Provisioner 查询 TKE/CVM 返回 `fetch failed`，真实节点池未创建成功。
- 当前 COS 接口只是 `/billing/cos/status` 配置状态，没有实现 COS List/Get/Parse 账单文件。
- 当前 Langfuse trace 查询返回 `status_only`，并且 `langfuse-trace-client.mjs` 仍按本地 Docker ClickHouse 容器查询；v13 改为生产级自部署 Langfuse，不采用 Cloud。
- `$scan` 等价扫描结论：受控源码里有 `compose.langfuse.yaml`、Portal Langfuse/ClickHouse 查询代码和本地镜像缓存，但 TKE `opl-system` namespace 当前无 Langfuse/ClickHouse/Postgres/Redis 工作负载；现有云上平台镜像集中在 Portal、Gateway、Adapter、Billing、Provisioner、Runner，不包含 Langfuse 生产栈。
- 当前代码仍有大文件：`services/portal/src/app/portal-app.mjs`、`adapters/billing-aggregator/src/server.mjs`、`adapters/med-autoscience-runner/src/server.mjs`。

## 当前卡点判断

v13 的卡点不是“能不能登录”，而是商业闭环里的五个生产边界还没有闭合：

1. **真实报价卡点**：镜像 ID 已确认，但 Billing 还缺 `img-487zeit5` 默认 fallback、报价缓存、报价失败阻断和 `server-plans` 真实价格验收。
2. **真实开通卡点**：Provisioner 已有 TKE 节点池操作雏形，但缺订单生命周期事件、幂等契约、节点池创建后的状态回填、重复调用保护和 scale-to-zero 成本保护。
3. **存储商品卡点**：workspace 文件目前偏 runtime/PVC 视角，缺 storage entitlement、10GB 最小购买单元、COS workspace prefix、上传/下载/output gating、COS 同步和 workspace 删除清理。
4. **账单 exact 卡点**：`DescribeBillDetail` 与 COS 日账单尚未形成统一 exact settlement；无完整标签的账单不能进入 run 级扣费。
5. **自部署 Trace 卡点**：一天 10w+ 请求不适合依赖 Cloud 作为主要 trace 后端；需要生产级自部署 Langfuse Web/Worker/Postgres/ClickHouse/Redis/S3-or-COS，并定义对话 metadata 归属、保留周期和租户隔离。
6. **可维护性卡点**：Portal、Billing、Runner 仍有大文件。继续在大文件里叠 v13 功能会破坏模块内高聚合，必须边实现边拆分。

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

- 存储必须订单化/按需开通：免费容量为 0，用户未开通 workspace storage 时，Portal 和 OPL 都禁止上传文件，Runner 不写 output 文件，只允许纯对话/无文件任务。
- 最小购买容量为 10GB。
- 存储保留时间随 Resource Order / Storage Order 生命周期。
- 删除 workspace 时自动清理 COS 对应 prefix 的对象；清理动作必须幂等、可审计，失败时进入 `storage_cleanup_failed` 状态，不允许静默成功。
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

v13 采用本地自部署 Langfuse，不采用 Langfuse Cloud。原因是日请求量约 10w+，需要把 trace 成本、数据保留、脱敏策略和查询性能掌握在平台内。Langfuse 的 Web/Worker/Postgres/ClickHouse/Redis/S3-or-COS 作为独立观测栈部署，不进入 Portal、Billing、Provisioner、Runner 的业务职责。

v13 接入方式：

- OPL Gateway/Adapter 在 launch、message、run start、run complete、artifact created 时生成 trace event。
- Trace Publisher 调本地 Langfuse ingestion API，写入 trace/span/observation。
- Portal 只查询 Langfuse API，不直接解析 OPL 页面状态，也不直接查 ClickHouse。
- trace 关键标签必须包括 `tenant_id`、`workspace_id`、`run_id`、`resource_order_id`、`portal_user_id`。
- Portal 业务库只保存 trace 索引和业务 metadata，不保存完整对话正文；完整 trace 内容、span、observation 归 Langfuse 管理。

验收标准：

- Portal trace 页面能按用户、workspace、run 过滤。
- OPL 发一条消息后 Langfuse 出现 trace。
- Runner 完成任务后 Langfuse 出现 run span 和 artifact event。

参考：

- https://langfuse.com/handbook/product-engineering/architecture
- https://langfuse.com/docs
- https://langfuse.com/self-hosting
- https://langfuse.com/self-hosting/deployment/infrastructure/clickhouse
- https://langfuse.com/self-hosting/configuration/scaling

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

## AI 开发执行协议

每条 v13 开发线在改代码前必须先做结构阅读，且必须记录证据：

1. 优先使用 `$scan`：按 `C:\Users\Administrator\.codex\skills\scan\SKILL.md` 调用 sentrux `scan` 获取 overview；需要细节时继续调用 `architecture`、`coupling`、`cycles`、`hottest`、`test_gaps`。
2. 如果当前工具环境没有 sentrux MCP 或 `sentrux` 命令，不能伪造 scan 分数，也不能把本地行数统计写成 scan 结果；只能记录为“scan 工具不可用”，并附本地结构清单作为辅助证据。
3. 开发前必须确认写入范围：Portal、Billing、Provisioner、Adapter/Runtime Bridge、Runner、Gateway 各司其职；禁止跨模块偷懒直连。
4. 每个模块只暴露稳定 DTO/API，不共享内部数据库表、Secret、SDK client 或文件路径。
5. 每个模块失败时要有明确降级边界：例如 Billing 失败只影响真实报价/结算，不能影响 Portal 登录；Provisioner 失败只影响开节点，不能影响 OPL 登录。
6. 每次合并前必须跑对应 smoke 和类型/语法检查，并记录未验证项；没有真实云凭证或真实账单时，不得声称真实报价、真实开通或 exact 结算已完成。

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

### Self-hosted Langfuse Trace

职责：

- 通过本地 Langfuse API 接收 OPL/Runner trace。
- 存储和查询 session、message、run、artifact trace。

部署边界：

- Langfuse 是独立观测栈，不和 Portal 主进程混部署。
- `trace.medopl.cn` 作为 Langfuse 管理员原生控制台入口，只给管理员/运维使用；客户侧仍走 Portal 原生 Agent Traces 页面。
- Portal 可通过 `/portal/app/trace` 或 `/portal/app/traces` 暴露业务化 trace 视图；不要把 Langfuse 原生 UI 直接作为客户默认界面。
- Portal 只展示业务化 trace 视图，不把 Langfuse UI iframe 作为默认客户界面，避免权限、会话、样式和多租户边界混乱。

不做：

- 不作为业务 DB。
- 不作为账单来源。

### Trace Metadata Contract

职责：

- 定义 Portal、Adapter、Runtime Bridge、Runner、Langfuse 之间共享的 trace metadata schema。
- 关联业务对象：tenant、workspace、session、run、resource order、storage order、artifact、billing tag。

不做：

- 不把 Langfuse 当作 Portal 用户库。
- 不把完整对话正文复制进 Portal DB。
- 不把 Secret、API key、原始云凭证写入 metadata。

### Portal Agent Traces UI

职责：

- Portal SaaS 后台内置轨迹模块，面向客户提供“实验记录/会话轨迹”，面向管理员提供“Agent Traces”运维视图。
- 使用 Portal 权限体系过滤 tenant/workspace/user/run，不直接暴露 Langfuse 管理权限。
- UI 参考截图中的 Agent Traces 信息架构：概览、追踪列表、会话、用户、接入密钥、监控集成、AI 问答。
- 用户端只能查看自己的 tenant/workspace/session/run/artifact/billing trace，不能跨 tenant、跨 workspace、跨用户查询。
- 用户端不展示原始 Langfuse 调试台；展示的是可理解、可追溯、可对账的业务轨迹。
- 管理员端可以按 tenant、workspace、user、session、run、resource order 过滤，用于客服排障、成本核查和运行审计。

用户端“会话轨迹/实验记录”展示：

- 会话列表：会话标题、workspace、最近时间、状态、消息数、运行次数、输入文件数、输出文件数、pending cost、exact cost、资源订单状态。
- 会话详情：时间线、用户消息、助手回复摘要、文件上传、任务启动、任务完成、artifact 生成、下载记录、服务器释放/删除、账单回补。
- 运行详情：runId、resourceOrderId、serverPlanId、storageOrderId、节点池状态、输入文件、输出文件、运行状态、错误摘要、开始/结束时间。
- 文件详情：文件名、大小、类型、COS object key、hash、上传时间、输出来源、下载入口。
- 费用详情：冻结金额、pending cost、exact cost、退款/补扣、腾讯云账单归因状态。
- 可暴露的技术信息：traceId、span 数、模型名称、token 用量、延迟、错误摘要；这些信息默认折叠，不作为首屏主体。

用户端禁止展示：

- system prompt、内部 tool call 原始参数、Secret/API key、中转站 key、腾讯云凭证、原始错误栈、跨租户 trace、Langfuse 原生 API key。
- 不能把 traceId 当作越权读取入口；所有 trace/detail API 必须重新校验 Portal RBAC 和 tenant/workspace 归属。

不做：

- 不在 Portal 里重建 Langfuse 的全部管理控制台。
- 不让普通用户访问跨 tenant trace。
- 不把 Langfuse 原生 API key 暴露给客户浏览器。

## v13 八步闭环缺口矩阵

| 步骤 | v12 状态 | v13 必须补齐 |
| --- | --- | --- |
| 创建用户 | 管理员创建用户可用 | smoke 固化创建用户和唯一邮箱，避免人工验证 |
| 充值额度 | 管理员充值可用 | ledger 要区分充值、冻结、释放、最终扣费 |
| 双域名登录 | Portal 登录、OPL native login 基本可用 | `portal.medopl.cn` 与 `opl.medopl.cn` 都纳入自动验收 |
| 创建节点和选择存储 | Resource Order 有雏形，真实节点池未闭合 | 真实报价、冻结、每订单节点池、storage order 一起进入订单 |
| OPL 工作与原始 runtime | upstream 未修改 | Gateway/Adapter 注入上下文，禁止改 upstream runtime |
| 发消息和跑文件任务 | 文件端到端未闭合 | Adapter 文件桥接、Runner 读 inputs、写 outputs、trace emitter |
| Portal 查看文件/账单/轨迹 | workspace 和 billing API 有雏形，trace 是 status only | COS workspace、COS 日账单、自部署 Langfuse trace 三条链路接通 |
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
- Storage policy 固定为：free quota = 0GB，min purchase = 10GB，retention = order lifecycle。
- 删除 workspace 时触发 COS prefix cleanup：`workspaces/{tenant_id}/{workspace_id}/`。
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
- 删除 workspace 后，COS prefix 清空或进入可审计的 cleanup failed 状态。

### C. 真实服务器报价与节点创建

目的：用户选择规格后看到真实腾讯云价格，并能创建订单独立节点池。

开发：

- Billing 增加 `TENCENT_PRICE_IMAGE_ID` 自动发现：
  - 优先读取 env override。
  - 其次按硅谷区域 Ubuntu 22.04 LTS 公共镜像调用 CVM `DescribeImages` 发现 ImageId。
  - 再其次使用已确认 fallback `img-487zeit5`。
  - 失败时阻塞报价，不伪造价格。
- Billing `/server-plans` 和 Provisioner `/cloud/status` 必须返回 `imageId`、`imageSource`、`imageRegion`，让运维能确认当前报价使用的镜像来源。
- Billing `server-plans` 对四档 CPU 规格返回真实 `unitPrice`、`priceUpdatedAt`、`pricingSource=tencent_cloud_price`。
- Provisioner 在只读云状态 OK 后才允许 `RESOURCE_PROVISIONING_ENABLED=1`。
- Provisioner `ensure-capacity` 生成 TKE nodePool payload，含 VPC/Subnet/SG、labels、taints、min=0、max=2、imageId=`img-487zeit5` 或发现值。
- Provisioner 默认写入 scale-to-zero 策略：节点池空闲时可缩容到 0，运行前再扩容。
- Provisioner 记录订单生命周期事件：`provision_requested`、`node_pool_created`、`instances_ready`、`scale_to_zero_requested`、`node_pool_deleted`、`provision_failed`，供 Portal 状态页和审计使用。
- 跨模块接口必须有幂等键：`resourceOrderId` + `idempotencyKey`，重复调用不能重复创建节点池。

验收：

- `/server-plans` 四档规格价格非 0 且来源为腾讯云。
- `/server-plans` 展示 `imageId=img-487zeit5` 或腾讯云发现值，且 `imageSource` 清楚。
- 创建订单后状态 `quoted -> frozen -> provisioning`。
- TKE 控制台出现带 `resource_order_id` 的节点池。
- 重复调用同一个订单的 provision API，不会创建第二个节点池。
- 测试节点池空闲后能缩容到 0。

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

### E. Self-hosted Langfuse Session Trace

目的：Portal 能看到 OPL 对话轨迹和 run trace。

开发：

- 部署本地 Langfuse 栈：Langfuse Web、Langfuse Worker、Postgres、ClickHouse、Redis/Valkey、S3/COS blob storage。
- 起步低配资源建议：
  - namespace：`langfuse-system`，避免和 Portal 主业务 namespace 混在一起。
  - storageClass：先用当前默认 `standard`，后续生产迁移到腾讯云 CBS/CFS 对应 StorageClass。
  - Langfuse Web：1 replica，requests `250m CPU / 512Mi`，limits `1 CPU / 1Gi`。
  - Langfuse Worker：1 replica，requests `500m CPU / 1Gi`，limits `2 CPU / 2Gi`。
  - Postgres：requests `500m CPU / 1Gi`，storage `20Gi`。
  - ClickHouse：requests `1 CPU / 2Gi`，limits `2 CPU / 4Gi`，storage `100Gi`。
  - Redis/Valkey：requests `100m CPU / 256Mi`，limits `500m CPU / 512Mi`，storage `5Gi`。
  - Trace retention：30 天。
  - Langfuse blob storage：复用 COS bucket `opl-1410708315`，prefix `langfuse/`，与 `daily/` 和 `workspaces/` 完全隔离。
- 新增 `trace.medopl.cn` Ingress/TLS 配置，指向 Langfuse Web；该入口为管理员原生控制台，不承载普通客户的 trace 浏览。
- Secret 只放 Kubernetes Secret：Langfuse salt/encryption/auth secrets、Postgres/ClickHouse/Redis 凭证、Langfuse API keys。
- 删除 Portal 对本地 Docker ClickHouse 容器名的依赖，改为调用 Langfuse API；Portal 不直查 ClickHouse。
- Adapter 新增 trace emitter，并把 launch、message、run request、artifact metadata 转成统一 trace event。
- Runtime Bridge 新增 trace publisher，只负责把领域事件发布到本地 Langfuse；不把 Langfuse SDK 直接扩散到 Gateway/Runner。
- Runner 新增 run lifecycle event 输出，由 Runtime Bridge 或 Adapter 统一发布 run span 和 artifact event。
- Portal trace client 只读 Langfuse API；ClickHouse 查询只保留在运维诊断脚本，不进入 Portal 生产请求路径。
- Portal 前端新增/优化“Agent Traces”模块：
  - 用户侧路由：`/portal/app/trace` 或 `/portal/app/traces`，产品名优先用“实验记录”或“会话轨迹”，展示当前 tenant/workspace 范围内的业务轨迹。
  - 管理员路由：`/portal/app/admin/trace`，展示跨用户、跨 workspace 的运维视图。
  - 侧边栏用户区增加“轨迹”；管理员区将 `Trace` 改成“Agent Traces”或“轨迹中心”。
  - 页面结构参考截图：顶部项目/工作区选择器、tab 导航、概览指标、追踪列表、追踪详情分栏、span 树、输入/输出、metadata。
  - 用户端列表字段：时间、会话标题、workspace、状态、消息数、运行数、文件数、pending cost、exact cost、最近 artifact、资源订单状态。
  - 用户端详情字段：会话时间线、消息摘要、输入文件、输出文件、run 状态、下载入口、费用明细、账单归因、资源释放状态。
  - 管理员端列表字段：时间、名称、traceId、状态、span 数、输入摘要、输出摘要、延迟、tenant、user、workspace、runId、resourceOrderId。
  - 管理员端详情字段：span tree、model、token、latency、input/output、artifact links、COS object keys、错误信息、metadata。
  - 普通用户只能看自己的 tenant/workspace/session/run；管理员可按 tenant/user/workspace/session/run 过滤。

对话 metadata 处理：

- Portal DB 保存业务索引：`tenant_id`、`workspace_id`、`portal_user_id`、`session_id`、`run_id`、`resource_order_id`、`storage_order_id`、`trace_id`、`artifact_ids`、`status`、`started_at`、`ended_at`。
- Langfuse 保存观测数据：trace/span/observation、message input/output、token usage、latency、model、tool call、error、score。
- COS 保存文件资产：inputs、outputs、artifact payload；Langfuse metadata 只保存 artifact id、COS object key、hash、size、content type。
- COS prefix 分工：
  - `daily/`：腾讯云账单投递。
  - `workspaces/{tenant_id}/{workspace_id}/`：客户 workspace inputs/outputs/artifacts，删除 workspace 后进入 7 天回收窗口，之后物理清理。
  - `langfuse/`：Langfuse 自部署栈的 blob storage，用于原始 ingestion events、多模态附件、大对象和导出，不存放客户 workspace 的权威文件副本。
- metadata 必须带 `schema_version`，便于后续迁移。
- metadata 禁止出现 Secret、API key、腾讯云凭证、用户模型中转站 key。
- 删除 workspace 时：清理 COS prefix；Portal 删除或匿名化 workspace trace 索引；Langfuse trace 内容按 trace retention 策略删除或脱敏；账单 ledger 保留最小审计字段。

验收：

- 用户在 OPL 发消息后，Portal `/portal/api/traces` 返回 trace。
- Trace 带 `tenant_id/workspace_id/session_id/run_id`。
- 普通用户只能看到自己的会话轨迹；用其他 tenant/workspace/session/traceId 请求详情必须返回 403 或 404。
- 用户端首屏展示业务化实验记录：会话、文件、运行、费用、下载入口和资源状态，而不是 Langfuse 原生技术调试台。
- `langfuse-trace-client.mjs` 不再出现 `docker exec`、固定本地 ClickHouse 容器名或 Portal 生产路径 ClickHouse SQL。
- 10w+/day trace ingestion 压测有明确吞吐、队列积压、ClickHouse 写入和查询延迟指标。
- Portal “Agent Traces” 页面满足截图中的核心体验：概览卡片、trace 列表、trace 详情分栏、span 树、输入/输出、metadata。
- 普通用户无法通过 traceId 访问其他 tenant/workspace 的 trace。

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
- Portal 前端 trace/API 拆：
  - `services/portal/frontend/src/api/traces.api.ts`
  - `services/portal/frontend/src/views/trace/TraceOverviewView.vue`
  - `services/portal/frontend/src/views/trace/TraceListView.vue`
  - `services/portal/frontend/src/views/trace/TraceDetailPane.vue`
  - `services/portal/frontend/src/views/trace/TraceSpanTree.vue`

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
  - 验证 metadata 不包含 Secret/API key。
  - 验证 Portal trace 查询来自 Langfuse API，而不是直接 ClickHouse SQL。
  - 验证普通用户无法读取其他 tenant/workspace trace。

- `scripts/load-test-v13-langfuse-ingestion.mjs`
  - 模拟 10w+/day 等级的 ingestion 速率。
  - 输出吞吐、失败率、队列积压、ClickHouse 写入延迟、Portal 查询延迟。
  - 不写真实用户敏感正文，使用合成 message。

## v13 推云前标准

必须全部满足才允许推 `opl-v13`：

- 不能把 SecretId/SecretKey 写入 git、YAML、镜像、日志摘要。
- `portal.medopl.cn/healthz` 返回 `sha=opl-v13`。
- `opl.medopl.cn/healthz` 返回 `sha=opl-v13`。
- 真实报价非 0。
- 真实 TKE nodePool 创建成功。
- 测试节点池具备 scale-to-zero，空闲时缩容到 0。
- COS 至少读取到一个账单文件或明确显示“无文件但权限可用”。
- 自部署 Langfuse trace 可写可查，并通过 10w+/day 等级的 ingestion 验证。
- Portal Agent Traces 用户侧和管理员侧页面可用，权限隔离通过。
- 删除节点池后订单状态和资源状态一致。

## 当前 v13 仍需要用户/云侧准备

你已提供并确认的内容：

- Region/Zone：`na-siliconvalley` / `na-siliconvalley-1`。
- Cluster：`cls-ngiq693i`。
- Namespace：`opl-system`。
- VPC/Subnet/SG：`vpc-ahl6epyx`、`subnet-mbehh5wi` / `subnet-r8mzuptu`、`sg-6671l5we`。
- COS bucket：`opl-1410708315`。
- COS endpoint：`https://opl-1410708315.cos.na-siliconvalley.myqcloud.com`。
- COS billing prefix：`daily/`。
- COS workspace prefix：`workspaces/{tenant_id}/{workspace_id}/`。
- COS Langfuse blob prefix：`langfuse/`。
- Langfuse 管理员入口域名：`trace.medopl.cn`；客户侧仍使用 Portal Agent Traces 页面。
- 节点池策略：每订单独立节点池，`minNodes=0`、`maxNodes=2`，允许缩容到 0。
- 公共镜像要求：硅谷区域 Ubuntu 22.04 LTS，已确认 fallback `ImageId=img-487zeit5`。
- 网络连通性已确认。
- 测试环境已授权真实创建/删除 TKE 节点池，需默认 scale-to-zero 控制成本。
- Storage 商品口径：free quota = 0GB，min purchase = 10GB，retention = order lifecycle，删除 workspace 后 COS workspace 对象保留 7 天再清理。
- Trace retention：30 天。
- 当前默认 StorageClass：`standard`（`rancher.io/local-path`），起步可用；生产建议后续换腾讯云 CBS/CFS 对应 StorageClass。
- K8s namespace `opl-system` 已创建。
- K8s Secrets 已创建：`tencent-billing-secret`、`tencent-provisioner-secret`、`tencent-cos-secret`。文档不记录 Secret 值。
- one-person-lab upstream URL：`https://github.com/gaofeng21cn/one-person-lab`，不得修改。

仍需要你提供或在云侧完成：

1. 创建或允许自动生成 Langfuse 相关 Kubernetes Secret：salt/encryption/auth secrets、Postgres/ClickHouse/Redis 凭证、Langfuse API keys。Secret 不进入 git、YAML、镜像或日志摘要。
2. 校验 `tencent-provisioner-secret` 中 SecretKey 是否存在尾随空白；如果有，重新创建该 Secret。
3. COS `daily/` 下放入至少一个真实账单样例文件，或确认投递已经开启但当前周期还没有文件。
4. 给 COS bucket/prefix 配好最小权限：Billing 只读 `daily/`；Workspace storage 读写 `workspaces/{tenant_id}/{workspace_id}/`；Langfuse 读写 `langfuse/`。
