# platform-v22 Recovery Status Matrix

本矩阵记录 platform-v22 canonical trunk 的当前状态裁定。

## 仓库控制面裁定

| 裁定 | 路径/对象 | v22 规则 |
| --- | --- | --- |
| canonical | `platform-v22` | canonical trunk，所有新产品语义以 v22 为准 |
| canonical branch | `recovery/platform-v22-trunk` | v22 recovery trunk；正式 `feat/*` 应从这里新开 |
| legacy reference | `platform-v21` | 只作为历史参考和迁移输入，不作为 v22 默认叙事来源 |
| active | `services/portal`、`services/opl-web-gateway`、`services/opl-runtime-bridge`、`docs/product.md`、`docs/architecture.md`、`docs/contracts/v22-*`、`docs/recovery/*`、`scripts/smoke-test-v22-*` | 可以承载 v22 新产品语义、契约、文档收敛和本地 smoke |
| migrate | 有复用价值但仍带 v19/v20/v21 旧命名、旧路径或旧主叙事的资产 | 必须重落到 active surface，改成 v22 `platform-provisioned / customer-dedicated` 语义后才能进入主线 |
| archive/reference | `docs/plan/*`、`docs/reports/*`、`docs/releases/*`、`docs/logs/*`、`scripts/smoke-test-v19-*`、`scripts/smoke-test-v20*`、`scripts/live-test-*`、`OPL-v20-商业化产品套餐开发方案.md` | 只读历史证据和迁移参考，不作为新实现入口或默认验证入口 |
| delete/cleanup target | `user_owned` primary path、`resource-order` primary path、`med-autoscience-runner`、`resource-provisioner`、OpenCost 主叙事、Langfuse 旧默认叙事 | 不在普通 `feat/*` 继续扩写；删除、拆除或退场走专门 `cleanup/*` |
| forbidden without explicit authorization | `deploy/*`、`.sentrux/*`、`adapters/*`、one-person-lab upstream、build/push/kubectl/live-test/真实云资源操作 | 没有单独授权时禁止修改或运行 |

## Trunk 状态

| 项目 | 当前状态 | v22 裁定 |
| --- | --- | --- |
| platform-v22 | canonical trunk | 正式主线，所有新产品语义以此为准 |
| platform-v21 | legacy reference | 只作历史参考和迁移输入，不接收 v22 新主叙事 |
| `recovery/platform-v22-trunk` | v22 recovery trunk | 只接收已收敛的正式文档和正式变更 |
| `main` / `recovery/*` trunk | trunk 线 | 不接收半成品探索 |
| `spike/*` | 探索分支 | 可快、可脏、可丢，不直接合并 trunk |
| `feat/*` | 正式落地分支 | 从 v22 trunk 新开，干净实现一个产品意图 |
| `cleanup/*` | 清理分支 | pivot 后必须跟进，删除或归档被替代路径 |

## 产品域状态

| 核心域 | 正式入口/边界 | 当前裁定 |
| --- | --- | --- |
| 托管科研工作台 | Portal + OPL Web Gateway | keep，MedOPL 不是云资源控制台 |
| 小白科研用户体验 | Portal/OPL Web | keep，不要求用户理解 CVM/COS/K8s |
| 云资源控制台叙事 | 无正式入口 | delete，不进入 v22 主线 |
| Runtime | 租户可选开通能力 | keep，未开通不能跑托管 runtime 任务 |
| Compute/Storage | 平台 TKE/存储资源池 | keep，由平台管理并绑定租户 |
| 默认资源套餐 | 2c4gb+10GB、8c16gb+100GB | keep |
| 叠加计算/叠加存储/自定义套餐 | billing/quota/audit 边界 | keep，不能描述成用户自配云资源 |
| 资源绑定 | tenant/user/workspace/resource binding/billing account/audit tag / cost allocation tag | keep，所有资源必须绑定 |
| API token 业务 | `https://gflabtoken.cn/v1` | keep，商业目标之一是销售 token/API 使用额度；gflabtoken.cn 网站本身不进入 MedOPL 用户主流程 |
| API key 密钥边界 | OPL entry/preflight + 后端密钥边界 | keep，portal.medopl.cn 登录不需要 gflabtoken API Key；opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key；API Key 输入框放在 OPL 登录页密码下面；Portal 可以展示“是否已绑定”状态；API Key 不是 Portal 普通登录字段；raw API Key 只能进入后端密钥边界，不能返回前端、不能写日志、不能进 git |
| OPL Web 双入口 | Portal “进入 OPL 工作台” + `/opl/entry/preflight` | keep，用户可见入口必须是 Portal “进入 OPL 工作台”或 /opl/entry/preflight；/internal/opl/auth/login 只能作为 internal implementation path；旧 v19/v20/v21 OPL direct path、direct upstream path、internal path 不能成为 v22 产品入口；后续真实 proxy / upstream 运行接入单独 feat；旧入口删除如需要另开 cleanup/* |
| OPL Web | clean upstream OPL Web | keep，active surface 不允许修改 one-person-lab upstream；one-person-lab upstream 不属于 active surface |
| upstream 更新 | pull + Gateway/Adapter/Runtime Agent/API/CLI 适配 | keep，不修改 upstream 源码 |
| Billing freeze | 7 天冻结保护 | keep，余额不足提示消耗冻结金额，释放后停止扣费 |
| Trace metadata | Portal 元数据边界 | keep，仅用于轨迹、审计、排障 |
| Langfuse | 后续 trace metadata 来源 | archive/reference，不是当前主产品叙事 |
| `user_owned` | legacy alias only | archive alias，不作为产品主路径 |
| 旧 `med-autoscience-runner` | 无正式入口 | archive/reference，非 v22 主线 |
| 旧 `resource-provisioner` | 无正式入口 | archive/reference，非 v22 主线 |
| K8s Job 主叙事 | 无正式入口 | archive/reference，非 v22 主线 |
| OpenCost 主叙事 | 无正式入口 | archive/reference，非 v22 主线 |

## 现有仓库域分类

本节基于当前 worktree 的已有文件做 recovery 分类。分类只记录裁定；本次不删除文件、不搬目录、不写业务代码。

| 域 | keep | migrate | delete | archive |
| --- | --- | --- | --- | --- |
| Identity / Auth / Tenant | `services/portal/src/app/portal-auth-runtime-handler.mjs`、`services/portal/src/domain/portal-auth.mjs`、`services/portal/src/domain/provider-config.mjs`、`services/portal/src/domain/provider-secret-store.mjs`、`services/portal/src/domain/tenant-scope.mjs`、`services/portal/src/state/portal-store-db-auth.mjs`、`services/portal/src/state/portal-store-schema.mjs`、`services/opl-web-gateway/src/portal-auth-bridge.mjs` | `services/portal/src/config/portal-config.mjs` 的 `PRODUCT_RUNTIME_MODE=user_owned` 默认值和旧文案必须迁到 `platform_provisioned` / `customer_dedicated` 语义；`services/portal/src/routes/platform-provisioned-resource.routes.mjs` 中 legacy user-owned alias 只作兼容 | 后续 cleanup 应删除把 `user_owned` 当正式产品语义的默认配置、文案和新入口 | `services/portal/src/domain/user-owned-resources.mjs`、`services/portal/src/routes/user-owned-resource.routes.mjs`、`services/portal/src/state/portal-user-owned-resource-store.mjs` 只作为 legacy alias 参考 |
| Portal Web | `services/portal/frontend/src/router/index.ts`、`services/portal/frontend/src/layouts/AppSidebar.vue`、`services/portal/frontend/src/views/overview/OverviewView.vue`、`services/portal/frontend/src/views/packages/PackagesView.vue`、`services/portal/frontend/src/views/resources/ResourcesView.vue`、`services/portal/frontend/src/views/workspace/WorkspaceView.vue`、`services/portal/frontend/src/views/opl/OplLaunchView.vue`、`services/portal/frontend/src/views/billing/BillingView.vue`、`services/portal/frontend/src/views/trace/TraceView.vue`、`services/portal/src/routes/portal-api.routes.mjs`、`services/portal/src/routes/opl.routes.mjs`、`services/portal/src/routes/lab-package.routes.mjs`、`services/portal/src/routes/workspace-storage.routes.mjs` | `services/portal/src/routes/portal-legacy-redirect.routes.mjs` 只作路径迁移壳；frontend/admin 中 ops surface 门控要表达租户能力，不要成为产品主叙事 | 后续 cleanup 应删除旧 `/portal` 兼容入口被继续扩写的可能性 | 旧 resource-order 页面/路由叙事不作为 Portal Web 主线 |
| OPL Web Gateway | `services/opl-web-gateway/src/server.mjs`、`services/opl-web-gateway/src/proxy.mjs`、`services/opl-web-gateway/src/portal-auth-bridge.mjs`、`services/opl-web-gateway/src/html-injection.mjs`、`services/opl-web-gateway/src/launch-client-script.mjs`、`services/opl-web-gateway/src/config.mjs` | Gateway 必须保持网关职责，不下沉 upstream 内部逻辑；后续命名和文案继续强调 clean upstream 公开边界；用户可见入口必须是 Portal “进入 OPL 工作台”或 /opl/entry/preflight；/internal/opl/auth/login 只能作为 internal implementation path；旧 v19/v20/v21 OPL direct path、direct upstream path、internal path 不能成为 v22 产品入口；后续真实 proxy / upstream 运行接入单独 feat | 后续 cleanup 删除任何把 Portal/Gateway/Adapter 代码写入 upstream 的路径；旧入口删除如需要另开 cleanup/* | 无 |
| OPL Adapter / Runtime Agent | `services/opl-runtime-bridge/src/server.mjs`、`services/opl-runtime-bridge/src/runtime-bridge-launch.mjs`、`runtime-bridge-runs.mjs`、`runtime-bridge-messages.mjs`、`runtime-bridge-routes-http.mjs`、`runtime-bridge-launch-scope.mjs`、`opl-acp-runtime-client.mjs`、`provider-secret-store.mjs`、`run-contract.mjs`、`state-store*.mjs` | 目录名和文件前缀 `opl-runtime-bridge` / `runtime-bridge` 暂保留实现，但产品语义迁到 Portal OPL Adapter / Runtime Agent；`managed_runtime` 只能作为退场兼容词 | 后续 cleanup 删除把 retired managed runtime 当新产品能力的入口 | `services/opl-runtime-bridge/src/runtime-bridge-managed-runs.mjs` 只作为 retired compatibility fence |
| Workspace / Artifact | `services/portal/src/routes/workspace-storage.routes.mjs`、`workspace-storage-route-handlers.mjs`、`workspace-storage-upload-support.mjs`、`workspace-files-internal.routes.mjs`、`services/portal/src/domain/workspace-storage.mjs`、`portal-api-workspace-storage.mjs`、`services/portal/src/app/portal-page-workspace-payloads.mjs`、`portal-workspace-runtime.mjs` | `services/portal/src/routes/task-space.routes.mjs` 的 product 语义迁到 workspace；旧 workspace redirects 只作兼容 | 后续 cleanup 删除继续扩展 task-space 作为正式产品域的路径 | `services/portal/src/routes/portal-legacy-redirect.routes.mjs` 只作旧入口兼容参考 |
| Session / Run | `services/portal/src/domain/session-traces.mjs`、`services/portal/src/app/portal-session-trace-payloads.mjs`、`services/portal/src/services/opl-launch.service.mjs`、`services/opl-runtime-bridge/src/runtime-bridge-runs.mjs`、`runtime-bridge-messages.mjs`、`state-store-run-records.mjs`、`state-store-message-records.mjs`、`state-store-artifact-trace-records.mjs`、`run-observability.mjs` | run/session 命名要收敛到最小 trace metadata boundary；Langfuse publisher 只能作为后续 metadata source 适配点 | 后续 cleanup 删除 `/prepare-run` 旧 resource-order run 链 | `services/portal/src/routes/resource-order-internal.routes.mjs` 中退场的 `/prepare-run` 只作 legacy reference |
| Billing / Usage / Freeze | `services/portal/src/domain/wallet-ledger.mjs`、`lab-billing-policy.mjs`、`services/portal/src/app/portal-page-billing-payloads.mjs`、`services/portal/src/integrations/billing-client.mjs`、`services/portal/frontend/src/api/portal/billing.ts`、`services/portal/frontend/src/views/billing/BillingView.vue`、`services/portal/frontend/src/views/admin/AdminBillingOpsView.vue` | `services/portal/src/app/portal-commercial-domain.mjs` 和旧 docs/deploy README 要迁到 v22 的预扣费、冻结金额、7 天保护和释放停止扣费叙事；`adapters/*` 和 `deploy/*` 没有单独授权时不能作为普通开发面 | 后续 cleanup 删除 OpenCost 作为默认账单事实源的产品路径 | `infra/opencost/helm-values.yaml`、`deploy/tke-package/optional/opencost-values.yaml`、`scripts/start-opencost-*`、`scripts/install-opencost-local.ps1`、`scripts/smoke-test-billing-opencost.mjs` 只作历史参考 |
| Resource Plan / Tenant Binding | `docs/contracts/v22-resource-plan-boundary.md`、`docs/contracts/v22-tenant-resource-binding-boundary.md`、`services/portal/src/domain/server-plans.mjs`、`services/portal/src/app/portal-server-plan-runtime-handler.mjs`、`services/portal/src/domain/platform-provisioned-resources.mjs`、`services/portal/src/domain/user-resource-bindings.mjs`、`services/portal/frontend/src/api/portal/resources.ts`、`services/portal/frontend/src/views/resources/ResourcesView.vue` | `services/portal/src/domain/resource-orders.mjs`、`services/portal/src/routes/resource-order-public.routes.mjs`、`resource-order*.routes.mjs`、`services/portal/src/integrations/resource-provisioner-client.mjs` 必须迁到 resource binding / billing / audit 语义，不再把 provisioner 当主入口 | 后续 cleanup 删除旧 resource-order 作为正式产品入口 | user-owned 资源绑定脚本和旧 resource-order 退场脚本只作 legacy 参考 |
| Admin / Ops | `services/portal/src/routes/admin-api.routes.mjs`、`admin-user.routes.mjs`、`admin-ops.routes.mjs`、`services/portal/src/app/portal-admin-overview-payloads.mjs`、`portal-admin-api-payloads.mjs`、`portal-admin-portrait-payloads.mjs`、`services/portal/frontend/src/views/admin/*.vue`、`services/portal/frontend/src/views/servers/ServersView.vue` | admin payload 和前端文案中旧 `user_owned`、OpenCost、Langfuse、runner/provisioner 表述要迁到平台托管资源池和 metadata boundary | 后续 cleanup 删除把 Rancher/OpenCost/KubeSphere/runner 暴露成用户产品面的入口 | 旧 ops 工具和旧栈画像只作运维参考，不进入用户主线 |
| Deploy / Provisioning | 无普通开发 active 入口 | `deploy/*` 只有单独授权后才能作为交付/发布工具迁移或修整，不是普通开发验证面 | 后续 cleanup 删除默认部署中的 runner RBAC、med-autoscience-runner、resource-provisioner、OpenCost、Langfuse 主产品依赖 | `compose.demo.yaml`、`compose.product.yaml`、`deploy/tke-package/rendered-v20.32-*`、`deploy/tke-package/manifests/04-runner-rbac.yaml`、`08-langfuse-stack.yaml`、`optional/managed-runtime-*` 只作历史或迁移参考 |
| Scripts / Contracts | `docs/contracts/v22-*.md`、`docs/product.md`、`docs/architecture.md`、`docs/recovery/*`、`scripts/smoke-test-v22-*` | `scripts/smoke-test-v20*`、`scripts/smoke-test-v21-*` 中仍有价值的合同要迁成 v22 命名和 truth；`README.md` 和旧说明文档后续继续清理残留 v21 口径 | 后续 cleanup 删除 live-test 作为普通验证入口的使用说明 | `scripts/smoke-test-v19-*`、`scripts/smoke-test-v20*`、`scripts/live-test-*`、`scripts/check-v21-user-owned-runtime-boundaries.mjs`、`scripts/smoke-test-v21-*user-owned*.mjs`、旧 v19/v20 合同只作历史参考 |
| Legacy / Retired Stack | 无正式主线入口 | `adapters/*` 没有单独授权时禁止触碰；若未来保留部分实现，必须重设为平台内部资源池开通参考，不得成为用户云控制台 | 后续 cleanup 删除旧 `med-autoscience-runner`、`resource-provisioner`、K8s Job、OpenCost、Langfuse 主叙事和默认入口 | `adapters/med-autoscience-runner/`、`adapters/resource-provisioner/`、`infra/opencost/`、`compose.langfuse.yaml`、`docs/logs/*`、`docs/plan/*`、`docs/releases/*` 作为 legacy/reference |

## 资产裁定规则

| 裁定 | 含义 | 进入 v22 的条件 |
| --- | --- | --- |
| keep | 符合当前主线 | 可以重落或迁入 |
| migrate | 有价值但边界不对 | 改边界、命名、合同后通过 `feat/*` 进入 |
| delete | 属于被替代路线 | 通过 `cleanup/*` 删除 |
| archive | 只保留参考价值 | 不进入产品主线，不作为正式入口 |

## 合入检查

| 检查项 | 要求 |
| --- | --- |
| 产品叙事 | MedOPL 是托管 OPL 科研工作台，不是云资源控制台 |
| Runtime gate | runtime 是租户可选能力，未开通不能跑托管 runtime 任务 |
| 资源池 | 平台 TKE/存储资源池由平台管理，用户不直接配置云资源 |
| 资源套餐 | 明确 2c4gb+10GB、8c16gb+100GB、叠加和自定义能力 |
| 资源绑定 | runtime/compute/storage 绑定 tenant/user/workspace/resource binding/billing account/audit tag / cost allocation tag |
| Token provider | 明确 `https://gflabtoken.cn/v1`、OPL entry/preflight 输入位置、Portal 非登录字段和 API Key 后端密钥边界 |
| Upstream | one-person-lab upstream clean，不修改源码 |
| Billing freeze | 明确 7 天冻结保护、余额不足提示、释放后停止扣费 |
| Trace | Langfuse 只作为后续 trace metadata 来源，不是当前主产品叙事 |
| 探索隔离 | `spike/*` 不直接合并 trunk |
| 操作限制 | 未授权不运行 build/push、kubectl、live-test、真实云资源操作，不修改 `.sentrux/*` |
