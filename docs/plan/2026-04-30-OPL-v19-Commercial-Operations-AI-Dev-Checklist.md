# OPL v19 商业化运营准入 AI 开发清单

## Summary

v19 目标是把 v18 从“云上联调候选版”推进到“商业化运营准入版”。判断标准不看代码里是否有能力雏形，而看它是否成为默认路径、是否贯穿全链路、是否有测试证明、是否能在客户环境稳定交付。

集成分支固定为 `codex/opl-v19`，集成 worktree 固定为 `.runtime/worktrees/opl-v19`。每个开发 lane 必须使用独立分支和独立 worktree，完成后提交，再合并回 `codex/opl-v19`。没通过测试不得滚云。

v19 的主目标：

- OPL 真消息闭环：登录、发送消息、生成 run、写 trace、产出 artifact、回到 Portal。
- 真实 SKU 商品目录：根据腾讯云真实机型、可售状态、报价生成服务器列表。
- 商业账单闭环：quote、preauth、pending、T+1 exact、退款/补扣、幂等对账。
- Docker 一键交付：本地默认完整产品形态，包含 OPL Gateway、Portal、Adapter、Runner、Billing、PostgreSQL、Redis。
- 多租户边界：所有用户态 API 都有 tenant/workspace/resourceOrder/run scope guard。
- 存储闭环：未购买 storage 禁止上传/output，购买后 COS durable storage 可上传、下载、回流、删除回收。
- 交付文档与 rollout plan：清楚说明 v19 更新、商业化能力、未完成风险、云上验收证据。

## Non-Negotiable Rules

- 必须用 `$scan` / Sentrux 审视代码结构，开发前、lane 合并前、集成前都要跑。
- 顶层原则：模块内高聚合，模块间低耦合，模块各司其职，模块间互不干扰。
- 不修改 `.runtime/one-person-lab-upstream`。
- 不修改 Langfuse 源码。
- Secret、API key、腾讯云密钥不得进入 git、YAML、镜像、文档、普通日志。
- Portal 管用户、钱包、订单、UI，不读腾讯云 Secret。
- Billing 管报价、账单、结算，不登录用户。
- Provisioner 管 TKE/CVM 生命周期，不扣费。
- Runner 只创建任务和打标签，不定价。
- Gateway 只做登录桥接、HTML 注入、鉴权转发，不读 Portal DB。
- `opl-web-opl` 保持 upstream 工作台镜像；若需要运行时能力，必须通过 Gateway/Adapter/Runtime/Runner 接入，不改上游源码。
- 每个 lane 只能改自己的写入范围，不允许跨 lane 修改文件。
- 每个 lane 必须写提交，提交信息遵守 Lore Commit Protocol。

## Baseline

当前 `codex/opl-v19` 从 `codex/opl-v18` HEAD 创建，初始 Scan：

- `quality_signal=6988`
- `check_rules=pass`
- DSM：依赖方向干净，all dependencies flow downward
- 主要瓶颈：`equality`
- 测试覆盖信号：仍偏低，需要通过 v19 smoke 和 contract tests 补强

v19 集成门禁：

- `quality_signal >= 6988`
- `check_rules=pass`
- `session_end` 不退化
- `one-person-lab` upstream diff 为 0
- 新功能不得继续堆进大文件
- 没有新增模块边界违规

## Lane 0: v18 Baseline Reconciliation

模型：`gpt-5.4`

分支：`codex/v19-baseline-reconcile`

worktree：`.runtime/worktrees/v19-baseline-reconcile`

写入范围：

- `docs/releases/**`
- `docs/reports/**`
- `scripts/check-*.mjs`
- 只允许挑入已在 v18 云上验证过、且缺失于 `codex/opl-v19` 的最小代码差异

目的：

把 v18 云上已验证能力从 dirty worktree 对齐到 v19 干净基线，避免 v19 建在“口头存在、分支不存在”的代码状态上。

如何开发：

1. 对比 `.runtime/worktrees/opl-v1` 与 `.runtime/worktrees/opl-v19`。
2. 列出 v18 云上能力对应的真实 diff。
3. 只挑已验证内容，不引入未验证实验代码。
4. 修复乱码文档。
5. 提交后合并回 `codex/opl-v19`。

交付边界：

- 不新增业务能力。
- 不重构大文件。
- 不修改 upstream OPL。

验收条件：

- `git status --short` 只包含本 lane 预期文件。
- `node scripts/check-one-person-lab-upstream-clean.mjs`
- `node scripts/check-v18-module-boundaries.mjs`
- `node scripts/check-v18-large-files.mjs`
- `$scan` / Sentrux `rescan health check_rules session_end`

## Lane 1: Tencent Cloud SKU Catalog

模型：`gpt-5.4`

分支：`codex/v19-sku-catalog`

worktree：`.runtime/worktrees/v19-sku-catalog`

写入范围：

- `adapters/billing-aggregator/src/**`
- `services/portal/src/domain/server-plans.mjs`
- `services/portal/src/integrations/**billing**`
- `services/portal/frontend/src/views/servers/**`
- `services/portal/frontend/src/api/portal.ts`
- `scripts/smoke-test-v19-sku-*.mjs`

目的：

让客户看到腾讯云硅谷区域真实存在、真实可售、真实报价的服务器商品，而不是手写 CPU/内存排列组合。

如何开发：

1. 用腾讯云 CVM API 拉真实机型：
   - `DescribeInstanceTypeConfigs`：得到真实 `InstanceType`、CPU、内存、机型族。
   - `DescribeZoneInstanceConfigInfos`：得到可用区销售状态、售罄原因、状态分类。
   - 询价接口：得到小时价格。
2. 将真实机型归一化成商品目录：
   - CPU filter：`2/4/8/16/32/64`
   - Memory filter：`2/4/8/16/32/64/128GB`
   - 同 CPU/内存可能有多个机型时，优先稳定通用型，再按价格排序。
3. Portal UI 改成商品化列表：
   - 每页 4 个服务器。
   - 支持 CPU 筛选。
   - 支持内存筛选。
   - 支持“可下单 / 售罄 / 不支持 / 未报价”状态。
   - 不可售规格可展示但禁用下单。
4. Billing 返回明确字段：
   - `instanceType`
   - `cpu`
   - `memoryGb`
   - `zone`
   - `availabilityStatus`
   - `statusCategory`
   - `soldOutReason`
   - `hourlyPrice`
   - `currency`
   - `canOrder`
   - `source=tencent_cloud_live_catalog`

交付边界：

- 不做 GPU。
- 不做多地域，只做 `na-siliconvalley`。
- 不允许把未知状态当可下单。
- 不允许 Portal 自己拼腾讯云 Secret。

验收条件：

- `node scripts/smoke-test-v19-sku-discovery-live.mjs`
- `node scripts/smoke-test-v19-server-plan-pagination-filter.mjs`
- `/server-plans?region=na-siliconvalley&zone=na-siliconvalley-1` 返回真实 `InstanceType`。
- Portal 服务器页 4 个一页，可翻页，可按 CPU/内存筛选。
- 不可售规格无法 quote/preauth/provision。

## Lane 2: OPL Runtime Session Closure

模型：`gpt-5.4`

分支：`codex/v19-opl-runtime-session`

worktree：`.runtime/worktrees/v19-opl-runtime-session`

写入范围：

- `services/opl-web-gateway/src/**`
- `services/opl-runtime-bridge/src/**`
- `services/portal/src/integrations/opl-adapter-client.mjs`
- `services/portal/src/services/opl-launch.service.mjs`
- `services/portal/src/domain/provider-config.mjs`
- `scripts/smoke-test-v19-opl-*.mjs`

目的：

修复 v18 P0：OPL 登录后能真实发送消息，消息进入会话，生成 run，触发 runtime/runner，产出 trace 和 artifact。

如何开发：

1. 不改 upstream OPL 源码，先阅读 upstream 运行 contract：
   - 登录 session cookie
   - CSRF token
   - WebSocket policy 条件
   - 消息提交入口
   - runtime/provider config 读取方式
2. Gateway 负责把 Portal launch/native login 转成 upstream 合法会话。
3. Adapter/Runtime Bridge 负责保存 provider config secret reference。
4. 用户 API key 明文只在登录提交时进入服务端内存或 Secret 管理，不进入 token、日志、文档。
5. runtime/job 根据 secret reference 生成运行配置：
   - `model_provider="gflab"`
   - `model="gpt-5.5"`
   - `model_reasoning_effort="xhigh"`
   - `service_tier="fast"`
   - `sandbox_mode="danger-full-access"`
   - `base_url="https://gflabtoken.cn/"`
6. OPL 消息事件必须带：
   - `tenantId`
   - `workspaceId`
   - `runId`
   - `resourceOrderId`
   - `serverPlanId`
   - `providerConfigSecretRef`

交付边界：

- 不改 `.runtime/one-person-lab-upstream`。
- 不改 `opl-web-opl` upstream 镜像源码。
- 不把用户 key 写入共享 upstream 全局 config。
- 如果 upstream 无法支持共享进程多用户 provider，必须走每订单 runtime/job 配置。

验收条件：

- `node scripts/smoke-test-v19-opl-login-provider.mjs`
- `node scripts/smoke-test-v19-opl-real-message.mjs`
- `node scripts/smoke-test-v19-runtime-provider-config.mjs`
- 浏览器 E2E：登录 OPL -> 输入消息 -> 发送 -> 会话出现用户消息 -> run 创建 -> trace 可查。
- console 不再出现阻断性的 WebSocket policy violation。
- `kubectl logs` 不出现明文 API key。

## Lane 3: Commercial Ledger And T+1 Settlement

模型：`gpt-5.4`

分支：`codex/v19-commercial-ledger`

worktree：`.runtime/worktrees/v19-commercial-ledger`

写入范围：

- `adapters/billing-aggregator/src/**`
- `services/portal/src/domain/wallet-ledger.mjs`
- `services/portal/src/domain/resource-orders.mjs`
- `services/portal/src/routes/**billing**`
- `scripts/smoke-test-v19-ledger-*.mjs`

目的：

把商业收费从“有雏形”推进到“可运营账本”：下单前报价，运行前预扣，运行中 pending，T+1 exact 多退少补，重复对账不重复扣费。

如何开发：

1. 固化 ledger 类型：
   - `topup`
   - `preauth_hold`
   - `pending_usage`
   - `exact_resource_charge`
   - `preauth_release`
   - `refund`
   - `makeup_charge`
   - `manual_adjustment`
2. 每条 ledger 必须有：
   - `tenantId`
   - `workspaceId`
   - `resourceOrderId`
   - `runId`
   - `billingAccountId`
   - `idempotencyKey`
3. quote 时返回真实价格和 buffer。
4. preauth 时冻结余额，不直接确认为 exact charge。
5. pending 只展示估算，不做最终结算。
6. T+1 exact bill 回补后：
   - exact <= preauth：生成 charge + release/refund。
   - exact > preauth：生成 charge + makeup_charge。
   - 余额不足：订单进入欠费/限制状态。
7. unattributed bill 进入队列，不静默吞掉。

交付边界：

- 不接支付网关。
- 不开发发票。
- 不用 OpenCost/local metering 做最终 exact。

验收条件：

- `node scripts/smoke-test-v19-preauth-ledger-idempotency.mjs`
- `node scripts/smoke-test-v19-t1-settlement-refund.mjs`
- `node scripts/smoke-test-v19-t1-settlement-makeup.mjs`
- `node scripts/smoke-test-v19-unattributed-bill-queue.mjs`
- 重复 reconcile 不重复扣费。
- 删除服务器后 pending 停止增长。

## Lane 4: Tenant RBAC And Scope Guard

模型：`gpt-5.4`

分支：`codex/v19-tenant-rbac`

worktree：`.runtime/worktrees/v19-tenant-rbac`

写入范围：

- `services/portal/src/routes/**`
- `services/portal/src/domain/**auth**`
- `services/portal/src/domain/**tenant**`
- `services/portal/src/domain/**workspace**`
- `scripts/smoke-test-v19-tenant-*.mjs`

目的：

商业化运营必须保证用户只能看到自己的 workspace、文件、账单、会话轨迹、资源订单；管理员视图必须明确分权。

如何开发：

1. 建立最小商业主键合同：
   - `tenantId`
   - `organizationId`
   - `workspaceId`
   - `resourceOrderId`
   - `runId`
   - `billingAccountId`
2. 用户态 API 统一经过 scope guard。
3. 管理员 API 与用户 API 分离。
4. 管理员行为写 audit event。
5. Portal UI 不展示用户无权访问的数据入口。

交付边界：

- 不做企业 SAML/LDAP。
- 不做复杂组织层级。
- 不做支付角色。

验收条件：

- `node scripts/smoke-test-v19-tenant-rbac-matrix.mjs`
- 用户 A 不能访问用户 B 的：
  - workspace 文件
  - billing ledger
  - session trace
  - resource order
  - storage order
- 管理员访问有 audit event。

## Lane 5: Storage And Artifact Closure

模型：`gpt-5.4-mini`

分支：`codex/v19-storage-artifacts`

worktree：`.runtime/worktrees/v19-storage-artifacts`

写入范围：

- `services/portal/src/domain/workspace-storage.mjs`
- `services/portal/src/routes/workspace-storage.routes.mjs`
- `services/opl-runtime-bridge/src/**storage**`
- `adapters/med-autoscience-runner/src/**artifact**`
- `scripts/smoke-test-v19-storage-*.mjs`

目的：

让 storage 成为可计费商品，而不是附带功能：未购买不能上传、不能保存 output；购买后文件可上传、下载、回流、删除回收。

如何开发：

1. storage entitlement 默认 disabled。
2. 最小购买 10GB。
3. 开通后 COS prefix：
   - `workspaces/{tenantId}/{workspaceId}/inputs/`
   - `workspaces/{tenantId}/{workspaceId}/runs/{runId}/outputs/`
4. 文件 metadata 入 PostgreSQL。
5. 上传/下载走短期签名 URL 或 Portal 代理。
6. Runner output 写入时检查 entitlement。
7. 删除 workspace 后进入 7 天回收窗口，再清理 prefix。

交付边界：

- 不做跨区域复制。
- 不做用户自带 bucket。
- 不把 CFS 当 durable storage，CFS/PVC 只做 scratch。

验收条件：

- `node scripts/smoke-test-v19-storage-entitlement.mjs`
- `node scripts/smoke-test-v19-workspace-cos-upload-download.mjs`
- `node scripts/smoke-test-v19-runtime-output-storage-gate.mjs`
- `node scripts/smoke-test-v19-workspace-delete-retention.mjs`
- 未购买 storage 时 upload/output 都失败且原因明确。
- 购买后文件可下载且内容一致。

## Lane 6: Docker Product Appliance

模型：`gpt-5.4`

分支：`codex/v19-docker-appliance`

worktree：`.runtime/worktrees/v19-docker-appliance`

写入范围：

- `docker-compose*.yaml`
- `deploy/local/**`
- `Dockerfile*`
- `README.md`
- `docs/deployment/**`
- `scripts/smoke-test-v19-compose-*.mjs`

目的：

把 Docker 交付从 dev 骨架推进到可验收 appliance：一条命令起完整本地产品，默认不是 JSON 状态，默认有 PostgreSQL/Redis。

如何开发：

1. compose 标准组件：
   - `portal-opl`
   - `opl-web-gateway`
   - `opl-web-opl` 或明确外部 `OPL_WEB_URL`
   - `portal-opl-adapter`
   - `opl-runtime-bridge`
   - `billing-aggregator`
   - `resource-provisioner`
   - `med-autoscience-runner-orchestrator`
   - `postgres`
   - `redis`
2. 默认 `PORTAL_STORAGE_MODE=postgres_redis`。
3. 提供初始化 job：
   - 默认 admin
   - 默认 workspace
   - 默认 demo storage disabled
4. 每个服务加 healthcheck。
5. dev profile 可以源码挂载，product profile 必须跑镜像。

交付边界：

- 本地 Docker 不负责真实 TKE 创建。
- 本地 Docker 可用 fixture/mock cloud，但必须明确不是 production cloud。
- 不新增非必要镜像仓库。

验收条件：

- `docker compose -f compose.product.yaml up -d`
- `node scripts/smoke-test-v19-compose-product-appliance.mjs`
- Portal、OPL、Adapter、Billing、Runner、Postgres、Redis 全部健康。
- 重启 Portal 后状态不丢。

## Lane 7: Production Entry And Observability

模型：`gpt-5.4-mini`

分支：`codex/v19-entry-observability`

worktree：`.runtime/worktrees/v19-entry-observability`

写入范围：

- `deploy/tke-package/**`
- `scripts/check-production-entry-*.mjs`
- `services/*/src/**health**`
- `docs/ops/**`

目的：

让入口性能、健康检查、日志、告警、Trace 具备运营可用性。

如何开发：

1. 三域名健康脚本：
   - DNS
   - TCP
   - TLS
   - TTFB
   - status
   - content
2. OPL 静态资源性能脚本：
   - gzip
   - immutable cache
   - fast path
   - chunk load
3. WebSocket 101 与业务 session 分开验证。
4. healthz 暴露必要但不泄密的状态。
5. 结构化日志至少包含：
   - `tenantId`
   - `workspaceId`
   - `resourceOrderId`
   - `runId`
   - `requestId`
6. 告警文档覆盖：
   - Portal 5xx
   - OPL WebSocket policy violation
   - TKE orphan
   - COS bill missing
   - reconcile failed

交付边界：

- 不做完整 APM 平台。
- 不做外部渗透测试。
- 不做多地域 HA。

验收条件：

- `node scripts/check-production-entry-performance.mjs --json`
- `node scripts/smoke-test-v19-entry-health.mjs`
- `node scripts/smoke-test-v19-opl-websocket-business-session.mjs`
- 三域名页面可访问，healthz 不泄密。

## Lane 8: Release Verify And Rollout Plan

模型：`gpt-5.4-mini`

分支：`codex/v19-release-verify`

worktree：`.runtime/worktrees/v19-release-verify`

写入范围：

- `docs/releases/**`
- `docs/reports/**`
- `docs/plan/**`
- `scripts/check-v19-*.mjs`

目的：

把 v19 变成可验收版本，而不是散落的功能分支。

如何开发：

1. 汇总所有 lane 的提交和验证结果。
2. 生成：
   - `docs/releases/2026-04-30-OPL-v19-Update-Log.md`
   - `docs/reports/2026-04-30-OPL-v19-Commercialization-Assessment.md`
   - `docs/reports/2026-04-30-OPL-v19-Live-E2E-Evidence.md`
   - `docs/reports/2026-04-30-OPL-v19-Rollout-Plan.md`
3. 汇总云上 rollout 顺序：
   - Gateway canary
   - Portal postgres_redis check
   - Billing SKU/catalog
   - Provisioner live create/delete
   - OPL runtime session
   - Full commercial E2E
4. 写明 rollback 条件。

交付边界：

- 不替代测试。
- 不允许文档宣称未验证能力。
- 未通过测试不得写“已完成”。

验收条件：

- 全量 `node --check`
- `npm --prefix services/portal/frontend run typecheck`
- `npm --prefix services/portal/frontend run build`
- `$scan` / Sentrux `health check_rules session_end`
- 所有 v19 smoke 通过
- `git -C .runtime/one-person-lab-upstream status --short` 为空
- rollout plan 明确“通过哪些条件才允许滚云”

## Required Final E2E

v19 完成后必须跑完整商业 E2E：

1. 创建 1 名用户。
2. 给该用户充值。
3. 用户分别登录 `portal.medopl.cn` 与 `opl.medopl.cn`。
4. 用户在 Portal 创建服务器订单，选择真实可售 SKU。
5. 用户购买至少 10GB storage。
6. 运行前 quote/preauth 成功。
7. TKE 节点池创建成功，标签完整。
8. OPL 输入 gflabtoken API key 后进入工作台。
9. OPL 发送消息成功，生成会话、run、trace。
10. Runner 执行任务并产出 output artifact。
11. output artifact 写入 COS workspace prefix。
12. Portal 能看到 workspace 文件、账单、会话轨迹。
13. 用户可以下载文件。
14. 删除服务器后节点池删除或 scale-to-zero，pending 停止增长。
15. COS `daily/` 文件出现后 exact reconcile 多退少补；如果当天无文件，只能标记 pending，不得宣称 exact 完成。

## Rollout Gate

满足以下条件才允许推云：

- `codex/opl-v19` clean。
- 所有 lane 已提交并合并。
- Scan `quality_signal >= 6988`，`check_rules=pass`。
- `one-person-lab` upstream diff 为 0。
- OPL 真消息闭环通过。
- SKU 目录来自腾讯云真实 API。
- Portal 默认 PostgreSQL/Redis。
- Docker product appliance 通过。
- Tenant/RBAC 越权矩阵通过。
- TKE live create/delete 清理通过。
- COS daily 无文件时明确 pending。
- release log、commercial assessment、live evidence、rollout plan 已生成。

不满足任一条件时，不滚云。
