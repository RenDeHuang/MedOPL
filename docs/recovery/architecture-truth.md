# platform-v22 Architecture Truth

platform-v22 的架构真相是：Portal 提供托管科研工作台控制面，OPL Web Gateway 接入 clean upstream OPL Web，Portal OPL Adapter / Runtime Agent 连接平台管理的 TKE/存储资源池，并把所有 runtime、compute、storage 纳入 tenant binding、billing、quota、audit 和 admin 边界。

## 架构定位

MedOPL 是 `platform-provisioned / customer-dedicated` 托管科研工作台，不是云资源控制台。用户不直接配置 CVM、COS、K8s。平台管理自己的 TKE 和存储资源池，向租户提供可选开通的托管 runtime、计算和存储能力。

## 主链路

```text
Portal
  -> OPL Web Gateway
  -> clean upstream OPL Web
  -> Portal OPL Adapter / Runtime Agent
  -> platform-managed TKE/storage resource pools
  -> Billing/Quota/Audit/Admin
```

## 边界职责

### Portal

Portal 是 SaaS 控制面，负责用户和租户、充值、gflabtoken 绑定状态展示、runtime 开通选择、资源套餐、workspace 状态、账单、冻结金额、审计和管理员治理。

Portal 展示的是托管科研工作台资源状态，不展示云资源控制台式 CVM/COS/K8s 配置界面。

### OPL Web Gateway

OPL Web Gateway 是 `opl.medopl.cn` 的正式入口。它把平台身份、workspace 上下文、runtime availability、resource binding 和 adapter 接入传给 upstream OPL Web，不把 Portal 逻辑写进 upstream。

`opl.medopl.cn` 登录 / 进入 OPL 工作台需要 gflabtoken API Key。API Key 输入框放在 OPL 登录页密码下面；已绑定时显示“已绑定”，不要求重复输入。

### clean upstream OPL Web

one-person-lab upstream OPL Web 必须保持 clean：

```text
https://github.com/gaofeng21cn/one-person-lab
```

v22 不修改 upstream 源码，不在 upstream 目录写 Portal、Gateway、Adapter 代码，不 import upstream 内部模块。upstream 更新后，平台拉取更新，并通过 Gateway、Adapter、Runtime Agent、API/CLI 等公开边界适配。

### Portal OPL Adapter / Runtime Agent

Portal OPL Adapter / Runtime Agent 是运行集成边界。它只能在租户已开通 runtime 且资源绑定有效时调度托管 runtime 任务。

它负责：

- 校验 tenant、user、workspace、resource binding、billing account、audit tag / cost allocation tag。
- 连接 platform-managed TKE/storage resource pools。
- 记录 run status、artifact index 和必要 session trace metadata。
- 阻止未开通 runtime 的租户运行托管 runtime 任务。

### Platform Resource Pools

平台资源池由平台管理，包括 TKE 和存储资源池。runtime、compute、storage 以托管能力形式分配给租户，不暴露为用户自配云资源。

默认基础套餐：

| 套餐 | 计算 | 存储 |
| --- | --- | --- |
| 默认套餐 1 | 2c4gb | 10GB |
| 默认套餐 2 | 8c16gb | 100GB |

叠加计算、叠加存储和自定义套餐都必须进入 billing、quota、audit 边界。

### Billing/Quota/Audit/Admin

Billing/Quota/Audit/Admin 是资源治理边界。开通 runtime、compute、storage 后开始预扣费或冻结金额。余额不足时，Portal 必须提示将消耗冻结金额。冻结保护期是 7 天；7 天后清理对应数据和资源。用户删除或释放资源后，扣费停止。

## Token Provider Boundary

MedOPL 的 OpenAI-compatible API 中转站 base URL 是：

```text
https://gflabtoken.cn/v1
```

portal.medopl.cn 登录不需要 gflabtoken API Key。gflabtoken.cn 网站本身不进入 MedOPL 用户主流程。Portal 可以展示“是否已绑定”状态，但 API Key 不是 Portal 普通登录字段。

raw API Key 只能进入后端密钥边界。前端最多保留一次性输入态、`providerKeyRef` 和 bound status，不能把 raw API Key、bearer token、launchToken 或 runtimeToken 写入 sessionStorage、localStorage、global JS state、log、evidence 或 git，不能返回前端、不能写日志、不能进 git。

## Trace Metadata Boundary

Portal 可以保留 session trace metadata，用于轨迹跟踪、审计和排障。metadata 不能包含 raw prompt、API key、secret、token 或可还原敏感内容。

Langfuse 只作为后续可能的 trace metadata 来源，不是当前 v22 主产品叙事。具体接入必须单独设计。

## 单入口规则

一个核心域只能有一个正式入口：

- 用户和租户控制面：Portal。
- OPL Web 工作入口：OPL Web Gateway。
- Upstream OPL：clean upstream OPL Web 公开边界。
- 运行集成：Portal OPL Adapter / Runtime Agent。
- 资源能力：platform-managed TKE/storage resource pools。
- 治理能力：Billing/Quota/Audit/Admin。

任何第二入口、新旧双入口或并行主路径只能存在于 `spike/*`，不能进入 v22 trunk。进入 `feat/*` 前必须收敛为一个正式入口。

## 现有仓库主干

当前 worktree 已有可继续作为 v22 canonical 的主干文件。它们不需要复制或重写，只需要在后续 feature 中按 v22 truth 继续收敛：

- Identity / Auth / Tenant：`services/portal/src/app/portal-auth-runtime-handler.mjs`、`services/portal/src/domain/portal-auth.mjs`、`provider-config.mjs`、`provider-secret-store.mjs`、`tenant-scope.mjs`、`portal-store-db-auth.mjs`、`portal-store-schema.mjs`。
- Portal Web：`services/portal/frontend/src/router/index.ts`、`AppSidebar.vue`、`OverviewView.vue`、`PackagesView.vue`、`ResourcesView.vue`、`WorkspaceView.vue`、`OplLaunchView.vue`、`BillingView.vue`、`TraceView.vue`，以及 `services/portal/src/routes/portal-api.routes.mjs`、`opl.routes.mjs`、`lab-package.routes.mjs`、`workspace-storage.routes.mjs`。
- OPL Web Gateway：`services/opl-web-gateway/src/server.mjs`、`proxy.mjs`、`portal-auth-bridge.mjs`、`html-injection.mjs`、`launch-client-script.mjs`、`config.mjs`。
- OPL Adapter / Runtime Agent：`services/opl-runtime-bridge/src/server.mjs`、`runtime-bridge-launch.mjs`、`runtime-bridge-runs.mjs`、`runtime-bridge-messages.mjs`、`runtime-bridge-routes-http.mjs`、`provider-secret-store.mjs`、`opl-acp-runtime-client.mjs`、`run-contract.mjs`、`state-store*.mjs`。
- Workspace / Artifact：`services/portal/src/domain/workspace-storage.mjs`、`portal-api-workspace-storage.mjs`、`workspace-storage-route-handlers.mjs`、`workspace-storage-upload-support.mjs`、`workspace-files-internal.routes.mjs`。
- Session / Run：`services/portal/src/domain/session-traces.mjs`、`services/portal/src/app/portal-session-trace-payloads.mjs`、`services/portal/src/services/opl-launch.service.mjs`、`services/opl-runtime-bridge/src/state-store-run-records.mjs`、`state-store-message-records.mjs`、`state-store-artifact-trace-records.mjs`。
- Billing / Usage / Freeze：`services/portal/src/domain/wallet-ledger.mjs`、`lab-billing-policy.mjs`、`portal-page-billing-payloads.mjs`、`services/portal/src/integrations/billing-client.mjs`、`services/portal/frontend/src/api/portal/billing.ts`、`services/portal/frontend/src/views/billing/BillingView.vue`、`adapters/billing-aggregator/src/*`。
- Resource Plan / Tenant Binding：`docs/contracts/v22-resource-plan-boundary.md`、`docs/contracts/v22-tenant-resource-binding-boundary.md`、`services/portal/src/domain/server-plans.mjs`、`platform-provisioned-resources.mjs`、`user-resource-bindings.mjs`、`services/portal/frontend/src/api/portal/resources.ts`。
- Admin / Ops：`services/portal/src/routes/admin-api.routes.mjs`、`admin-user.routes.mjs`、`admin-ops.routes.mjs`、`services/portal/src/app/portal-admin-*.mjs`、`services/portal/frontend/src/views/admin/*.vue`。
- Scripts / Contracts：`docs/contracts/v22-*.md` 和与 billing freeze、platform-provisioned resource lifecycle、tenant/resource binding 直接相关的 smoke contract。

## 迁移和退场边界

以下现有路径有价值，但不能按旧命名或旧边界继续扩散：

- `services/portal/src/config/portal-config.mjs` 中 `PRODUCT_RUNTIME_MODE=user_owned` 只能迁为 legacy alias，默认语义必须是 `platform_provisioned` / `customer_dedicated`。
- `services/portal/src/domain/user-owned-resources.mjs`、`services/portal/src/routes/user-owned-resource.routes.mjs`、`services/portal/src/state/portal-user-owned-resource-store.mjs` 只能作为 legacy alias 参考。
- `services/portal/src/domain/resource-orders.mjs`、`services/portal/src/routes/resource-order*.mjs` 和 `services/portal/src/integrations/resource-provisioner-client.mjs` 要迁到 resource binding / billing / audit 语义；旧 resource-order 不再是 v22 正式产品入口。
- `services/portal/src/routes/task-space.routes.mjs` 要迁到 workspace 语义。
- `services/opl-runtime-bridge/src/runtime-bridge-managed-runs.mjs` 和 `managed_runtime` 词组只作为 retired compatibility fence。
- `services/opl-runtime-bridge` 路径暂保留，但产品语义是 Portal OPL Adapter / Runtime Agent；新文档和新入口不得继续扩大 bridge 命名。

以下路径只作为 archive/reference，不进入 v22 主产品叙事：

- `adapters/med-autoscience-runner/`
- `adapters/resource-provisioner/`
- `adapters/cloud-provisioner/`，除非后续单独迁为平台内部资源池开通组件。
- `infra/opencost/`、`deploy/tke-package/optional/opencost-values.yaml`、`scripts/start-opencost-*`、`scripts/install-opencost-local.ps1`。
- `compose.langfuse.yaml`、`deploy/tke-package/manifests/08-langfuse-stack.yaml`、`scripts/load-test-v13-langfuse-ingestion.mjs`。
- `deploy/tke-package/rendered-v20.32-*`、旧 `docs/logs/*`、旧 `docs/plan/*`、旧 `docs/releases/*`。

后续 cleanup/delete 目标是删除旧 `med-autoscience-runner`、`resource-provisioner`、K8s Job、OpenCost、Langfuse 主叙事和默认入口；本次只记录裁定，不执行删除。

## 操作边界

未获单独授权时，不运行 build/push、kubectl、live-test、真实云资源操作，也不修改 `.sentrux/*`。普通文档收敛和本地验证不能顺手触发真实资源动作。
