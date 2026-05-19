# platform-v22 Architecture Truth

platform-v22 的架构真相是：Portal 提供托管科研工作台控制面，OPL Web Gateway 接入 clean upstream OPL Web，Runtime Bridge / Runtime Agent 连接平台管理的 TKE/存储资源池，并把所有计算资源、存储资源和文件空间纳入 tenant binding、billing、quota、audit 和 admin 边界。

## 数据与云控制面真相

Portal canonical truth 是 control-plane store，生产方向是 PostgreSQL。Redis 不是事实源，只能用于 session、cache、queue、lock 或短期协调。

Portal 保存账号、用户、工作空间、钱包、冻结金额、账本、审计、资源 binding、文件 logical index、session/run/artifact/trace metadata 的业务事实。Runtime Bridge 只提供 launch/session/run/artifact/trace 的 canonical integration boundary；它不是 billing ledger truth，也不是 cloud inventory truth。

云控制面当前采用 Portal 内部 operation/job/projection/reconciliation 模型：

- desired state：Portal 中形成的资源、文件空间、计费和释放意图。
- actual state：云资源、runtime、文件空间、账单和审计的实际观测事实。
- reconciled state：Portal 对 desired state 和 actual state 的核对结果、异常、补偿和审计记录。

Object/blob plane 当前仍属本地/过渡实现；后续对象存储只承载文件正文和私有 locator，不成为账本、资源或审计事实源。secret plane、object/blob plane、runtime state plane 仍属本地/过渡实现，不能写成 productionized truth。

## 代码解耦真相

Portal frontend 只负责 UI composition、typed API client 和 UI-safe adapter，不直接接触云、secret、objectKey、localPath、signedUrl 或 runtime token。Portal backend 继续保持 route / domain / state / integration 分层。Gateway = 入口反腐层，只处理 launch、bootstrap、auth context、proxy 和 clean upstream 边界。Runtime Bridge = launch/session/run/artifact/trace 的 canonical integration boundary。

## 架构定位

MedOPL 是 `platform-provisioned / customer-dedicated` 托管科研工作台，不是云资源控制台。用户不直接配置 CVM、COS、K8s。平台管理自己的 TKE 和存储资源池，向账号和工作空间提供可选开通的计算资源和文件空间。

普通用户主语言优先使用：账号、工作空间、计算资源、文件空间、套餐、任务并发、余额、冻结金额。租户 / runtime / 运行环境 / environmentId 只能作为内部标签、对账标签或审计字段。

## 主链路

```text
Portal
  -> OPL Web Gateway
  -> clean upstream OPL Web
  -> Runtime Bridge / Runtime Agent
  -> platform-managed TKE/storage resource pools
  -> Billing/Quota/Audit/Admin
```

## 边界职责

### Portal

Portal 是 SaaS 控制面，负责账号、充值、gflabtoken 绑定状态展示、计算资源开通选择、资源套餐、workspace 状态、账单、冻结金额、审计和管理员治理。

Portal 展示的是托管科研工作台资源状态，不展示云资源控制台式 CVM/COS/K8s 配置界面。

Portal 不重做 OPL chatbot，不回答科研问题，不承接 OPL 工作台内的 agent 交互。Portal 负责准备、管理、进入、回流、计费、审计和释放：让用户知道自己买的是什么托管 OPL 工作台服务、工作台是否可用、还缺哪一步、下一步点哪里、文件/任务/结果在哪里，以及余额、预扣费、冻结金额和停止计费状态是否正常。

### OPL Web Gateway

OPL Web Gateway 是 `opl.medopl.cn` 的正式入口。它把平台身份、workspace 上下文、计算资源可用状态、resource binding 和 Runtime Bridge context 传给 upstream OPL Web，不把 Portal 逻辑写进 upstream。

`opl.medopl.cn` 登录 / 进入 OPL 工作台需要 gflabtoken API Key。API Key 输入框放在 OPL 登录页密码下面；已绑定时显示“已绑定”，不要求重复输入。

### clean upstream OPL Web

one-person-lab upstream OPL Web 必须保持 clean：

```text
https://github.com/gaofeng21cn/one-person-lab
```

v22 不修改 upstream 源码，不在 upstream 目录写 Portal、Gateway 或 Runtime Bridge 代码，不 import upstream 内部模块。upstream 更新后，平台拉取更新，并通过 OPL Web Gateway、Runtime Bridge / Runtime Agent、公开 API/CLI 和必要的内部 anti-corruption mapping 适配。

OPL 负责科研执行：chatbot、agent、文件理解、任务推进、结果生成和工作台内交互体验。Portal 只能通过公开边界把上下文带入 OPL，并把 session、run、artifact、trace、账单和审计状态回流。

### Runtime Bridge / Runtime Agent

Runtime Bridge / Runtime Agent 是运行集成边界。它只能在账号工作空间已开通计算资源、文件空间可用且资源绑定有效时调度托管计算任务。

它负责：

- 校验 tenant、user、workspace、resource binding、billing account、audit tag / cost allocation tag。
- 连接 platform-managed TKE/storage resource pools。
- 记录 run status、artifact index 和必要 session trace metadata。
- 阻止未开通计算资源或文件空间不可用的账号运行托管计算任务。

### Platform Resource Pools

平台资源池由平台管理，包括 TKE 和存储资源池。计算资源和文件空间以托管能力形式分配给账号工作空间，不暴露为用户自配云资源。

当前套餐：

| 套餐 | 计算资源 | 文件空间 | 任务并发 |
| --- | --- | --- | --- |
| 基础套餐 | 2c / 4GB | 10GB 文件空间 | 1 个任务并发 |
| Pro 套餐 | 8c / 16GB | 100GB 文件空间 | 2 个任务并发 |

自定义规格支持 CPU、内存、文件空间和任务并发数。叠加计算、叠加存储和自定义规格都必须进入 billing、quota、audit 边界。

工作空间是业务容器。计算资源可独立开通、扩容、缩容、释放。存储资源 / 文件空间可独立开通、扩容、删除。释放计算资源不删除文件空间。释放计算资源不让文件空间进入 7 天保护期。删除存储资源 / 文件空间，或独立欠费保留策略，才进入 7 天保护期。计算资源已释放但文件空间仍保留，是合法状态。

### Billing/Quota/Audit/Admin

Billing/Quota/Audit/Admin 是资源治理边界。开通计算资源和存储资源后开始预扣费或冻结金额。余额不足时，Portal 必须提示将消耗冻结金额。释放计算资源只停止计算计费和任务续用，不删除文件空间；删除存储资源 / 文件空间，或独立欠费保留策略，才进入 7 天保护期。文件空间进入保护期或不可用时，新任务不能依赖该文件空间。

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
- 运行集成：Runtime Bridge / Runtime Agent。
- 资源能力：platform-managed TKE/storage resource pools。
- 治理能力：Billing/Quota/Audit/Admin。

任何第二入口、新旧双入口或并行主路径只能存在于 `spike/*`，不能进入 v22 trunk。进入 `feat/*` 前必须收敛为一个正式入口。

## 现有仓库主干

当前 worktree 已有可继续作为 v22 canonical 的主干文件。它们不需要复制或重写，只需要在后续 feature 中按 v22 truth 继续收敛：

- Identity / Auth / Tenant：`services/portal/src/app/portal-auth-runtime-handler.mjs`、`services/portal/src/domain/portal-auth.mjs`、`provider-config.mjs`、`provider-secret-store.mjs`、`tenant-scope.mjs`、`portal-store-db-auth.mjs`、`portal-store-schema.mjs`。
- Portal Web：`services/portal/frontend/src/app/routes.tsx`、`src/app/App.tsx`、`src/app/components/Layout.tsx`、`src/app/pages/Overview.tsx`、`src/app/pages/RuntimeEnvironment.tsx`、`src/app/pages/Workspace.tsx`、`src/app/pages/TasksResults.tsx`、`src/app/pages/BillingAudit.tsx`、`src/app/pages/OPLEntry.tsx`、`src/app/data/portalAdapters.ts`，以及 `services/portal/src/routes/portal-api.routes.mjs`、`opl.routes.mjs`、`lab-package.routes.mjs`、`workspace-storage.routes.mjs`。
- OPL Web Gateway：`services/opl-web-gateway/src/server.mjs`、`proxy.mjs`、`portal-auth-bridge.mjs`、`html-injection.mjs`、`launch-client-script.mjs`、`config.mjs`。
- Runtime Bridge / Runtime Agent：`services/opl-runtime-bridge/src/server.mjs`、`runtime-bridge-launch.mjs`、`runtime-bridge-runs.mjs`、`runtime-bridge-messages.mjs`、`runtime-bridge-routes-http.mjs`、`provider-secret-store.mjs`、`opl-acp-runtime-client.mjs`、`run-contract.mjs`、`state-store*.mjs`。
- Workspace / Artifact：`services/portal/src/domain/workspace-storage.mjs`、`portal-api-workspace-storage.mjs`、`workspace-storage-route-handlers.mjs`、`workspace-storage-upload-support.mjs`、`workspace-files-internal.routes.mjs`。
- Session / Run：`services/portal/src/domain/session-traces.mjs`、`services/portal/src/app/portal-session-trace-payloads.mjs`、`services/portal/src/services/opl-launch.service.mjs`、`services/opl-runtime-bridge/src/state-store-run-records.mjs`、`state-store-message-records.mjs`、`state-store-artifact-trace-records.mjs`。
- Billing / Usage / Freeze：`services/portal/src/domain/wallet-ledger.mjs`、`lab-billing-policy.mjs`、`portal-page-billing-payloads.mjs`、`portal-runtime-observability.mjs` 的 Portal monolith 账本投影、`services/portal/frontend/src/api/portal/billing.ts`、`services/portal/frontend/src/app/pages/BillingAudit.tsx`。
- Resource Plan / Tenant Binding：`docs/contracts/v22-resource-plan-boundary.md`、`docs/contracts/v22-tenant-resource-binding-boundary.md`、`services/portal/src/domain/server-plans.mjs`、`platform-provisioned-resources.mjs`、`user-resource-bindings.mjs`、`services/portal/frontend/src/api/portal/resources.ts`。
- Admin / Ops：`services/portal/src/routes/admin-api.routes.mjs`、`admin-user.routes.mjs`、`admin-ops.routes.mjs`、`services/portal/src/app/portal-admin-*.mjs`。当前普通用户和管理员 Portal UI 已在同一个 React/Figma Make app 中存在，管理员页面位于 `services/portal/frontend/src/app/pages/admin/*.tsx`；管理员导航显示由 `/portal/api/me` 角色投影控制，真实权限仍由 `/portal/api/admin/*` 后端校验。
- Scripts / Contracts：`docs/contracts/v22-*.md` 和与 billing freeze、platform-provisioned resource lifecycle、tenant/resource binding 直接相关的 smoke contract。

## 迁移和退场边界

以下现有路径有价值，但不能按旧命名或旧边界继续扩散：

- `services/portal/src/config/portal-config.mjs` 不得恢复 `PRODUCT_RUNTIME_MODE=user_owned`；默认语义必须是 `platform_provisioned` / `customer_dedicated`。
- `services/portal/src/routes/user-owned-resource.routes.mjs`、`services/portal/src/domain/user-owned-resources.mjs` 和 `services/portal/src/state/portal-user-owned-resource-store.mjs` 均已从 active repo 删除；不得恢复 user-owned public route、alias、fixture、copy 或测试锚点。
- `services/portal/src/domain/resource-orders.mjs`、`services/portal/src/routes/resource-order*.mjs` 和 `services/portal/src/integrations/resource-provisioner-client.mjs` 已从 active repo 删除；后续如需平台资源开通 client，必须以 v22 resource binding / cloud operation contract 重新命名、重新建边界。
- `services/portal/src/routes/workspace.routes.mjs` 是 workspace lifecycle route；旧 `task-space.routes.mjs` 文件名和 `/portal/tasks/*` 入口已清退，不得恢复为产品域或兼容入口。
- `services/opl-runtime-bridge/src/runtime-bridge-managed-runs.mjs` 已删除；旧 runtime mode 不得作为 active Runtime Bridge mode、产品能力入口或保留依据。
- `services/opl-runtime-bridge` 路径暂保留，但产品语义是 Runtime Bridge / Runtime Agent；新文档和新入口不得继续扩大 bridge 命名。

以下路径只作为 strict cleanup 删除目标或历史文档迁移输入；git history 已足够作为历史证据，不进入 v22 主产品叙事：

- `adapters/med-autoscience-runner/`、`adapters/resource-provisioner/`、`adapters/cloud-provisioner/` 和 `adapters/shared/` 已在 Slice D 删除；后续若需要平台内部资源池开通组件，必须以 v22 active contract 重新命名、重新建边界。
- `infra/opencost/`、`infra/kubernetes/`、`infra/codex-runtime/`、`infra/production-hardening/` 和 `deploy/tke-package/` 已在 Slice D 删除。
- `compose.demo.yaml` 和 `compose.langfuse.yaml` 已在 Slice D 删除。
- 旧 OpenCost 脚本 `scripts/start-opencost-*`、`scripts/install-opencost-local.ps1`、`scripts/smoke-test-billing-opencost.mjs` 已在 Slice C 删除。
- 旧 v13 Langfuse / commercial / COS 脚本、旧 portal resource-order/provisioner 脚本、旧 med-autoscience runner fixture、旧 v19/v20 helper lib 已在 Slice D 删除；未来真实外部 canary 必须使用新的 v22 授权合同和 gate。
- 旧 `docs/logs/*`、旧 `docs/plan/*`、旧 `docs/releases/*`、旧 `docs/reports/*`、旧 `docs/operations/*`、旧 `docs/superpowers/*` 和根部 v20 商业化方案已从 active repo 物理清退；历史事实只通过 git history 或已收敛的 v22 recovery/contract 摘要迁移，不能作为 active repo 默认实现入口。

后续 cleanup/delete 目标是继续清掉 active services 中残留的旧 deploy/live/canary runner 叙事和任何新发现的旧测试锚点；不得把已删除的旧 deploy/adapters/infra 资产、旧 billing adapter 或旧 Portal provisioner client 作为参考重新引入。

## 操作边界

未获单独授权时，不运行 build/push、kubectl、live-test、真实云资源操作，也不修改 `.sentrux/*`。普通文档收敛和本地验证不能顺手触发真实资源动作。
