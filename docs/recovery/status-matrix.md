# platform-v22 Recovery Status Matrix

本矩阵记录 platform-v22 canonical trunk 的当前状态裁定。

## 仓库控制面裁定

| 裁定 | 路径/对象 | v22 规则 |
| --- | --- | --- |
| canonical | `platform-v22` | canonical trunk，所有新产品语义以 v22 为准 |
| canonical branch | `recovery/platform-v22-trunk` | v22 recovery trunk；正式 `feat/*` 应从这里新开 |
| legacy reference | `platform-v21` | 只作为迁移输入，不作为 v22 默认叙事来源；active repo 不再复制或保留 v21 兼容面 |
| active | `services/portal`、`services/opl-web-gateway`、`services/opl-runtime-bridge`、`docs/product.md`、`docs/architecture.md`、`docs/contracts/v22-*`、`docs/recovery/*`、`scripts/smoke-test-v22-*` | 可以承载 v22 新产品语义、契约、文档收敛和本地 smoke |
| migrate | 有复用价值但仍带 v19/v20/v21 旧命名、旧路径或旧主叙事的资产 | 必须重落到 active surface，改成 v22 `platform-provisioned / customer-dedicated` 语义后才能进入主线 |
| retired/delete target | `user_owned` primary path、`resource-order` primary path、`scripts/smoke-test-v19-*`、`scripts/smoke-test-v20*`、`scripts/smoke-test-v21-*`、旧 `med-autoscience-runner`、旧 `resource-provisioner`、OpenCost 旧资产、Langfuse 旧默认资产 | 不在普通 `feat/*` 继续扩写；本 strict monolith cleanup 物理删除旧兼容面、旧测试、旧脚本和旧 deploy/adapters/infra 资产 |
| strict monolith delete policy | old public tombstone / archive legacy tests / compat alias / old deploy-adapters-infra assets | 这些不是完成态；只允许作为删除记录或 forbidden-token gate 证据。public tombstone routes 必须删除；保留项必须有 active v22 reason，不能因为历史证据保留 |
| zero-compat active surface | active repo 默认上下文 | completed through Slice O；任何让旧路线、旧字段、旧模块、旧部署形态、旧测试体系、旧叙事还能被调用、注册、接受、映射、解释、验证、部署或作为默认上下文存在的 active repo 资产都视为兼容层并必须清退 |
| forbidden without explicit authorization | `deploy/*`、`.sentrux/*`、`adapters/*`、one-person-lab upstream、build/push/kubectl/live-test/真实云资源操作 | 没有单独授权时禁止修改或运行 |

## Trunk 状态

| 项目 | 当前状态 | v22 裁定 |
| --- | --- | --- |
| platform-v22 | canonical trunk | 正式主线，所有新产品语义以此为准 |
| platform-v21 | legacy reference | 只作迁移输入，不接收 v22 新主叙事 |
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
| OPL Web | clean upstream OPL Web | keep，active surface 不允许修改 one-person-lab upstream；one-person-lab upstream 不属于 active surface；2026-05-10 主仓 canary 确认 `opl web` retired，主仓未暴露 `/api/opl/system`、`/api/opl/messages`、`/api/opl/sessions` HTTP Product API；真实 WebUI canary 确认独立 WebUI 页面、auth context、Gateway proxy、WebSocket session bridge 和 Runtime Bridge session bridge 可接通，但 `/api/opl/*` 是 catch-all placeholder，不是 Product API；Portal-OPL context/backflow 三级合同已将 Portal、Gateway、OPL context bootstrap、Runtime Bridge projection、downstream Runtime gate 和 downstream Langfuse session trace boundary 解耦；Real OPL capability canary 三级合同已定义剩余 message/file/run/artifact/runtime/observability 全工作流验证链路；Real OPL provider message canary 四级合同已定义 provider key gate、真实 message send、reply observation、Portal message status 和 Portal session trace 验证路径；Real OPL file/run/artifact canary 三级细分合同已定义 fileRef、Runtime Agent gate、artifact/output、Portal projection 和 billing metadata handoff 验证路径，每个 step 必须 gate；`scripts/smoke-test-v22-real-opl-file-run-artifact-gates.mjs` 已验证真实 WebUI bridge profile 下 Runtime Bridge 不把未验证 file/run/artifact 伪成功；Runtime Agent HTTP API proof 已证明 workspace-scoped fileRef、run、artifact/output 和 Portal trace projection 闭环，但该 proof 不进入默认 MVP suite，也不是 production deploy evidence；Real OPL provider message live canary 已在用户授权下通过，当前 message reply capability 为 `mapped_to_webui_bridge`，不进入默认 MVP suite；这些不代表真实云 runtime/COS 账单/Langfuse 已上线 |
| upstream 更新 | pull + Gateway/Runtime Bridge/Runtime Agent/API/CLI 适配 | keep，不修改 upstream 源码；当前可验证公开边界是 `opl session runtime --acp`、独立 WebUI WebSocket bridge session 创建/DB 回读、授权 live canary 下的 WebUI bridge provider message reply 回流，以及本地独立 Runtime Agent HTTP API relay file/run/artifact 回流；Runtime Bridge 可映射 bootstrap/session bind/message status/session trace，未验证或不兼容能力必须显式 `capability_not_supported`；真实 WebUI bridge profile 下 file upload/fileRef 返回 `file_upload_capability_not_supported` + `file_ref_not_observed`，run 缺 Runtime Agent relay 返回 queryable `requires_runtime_agent` gated run，artifact/output 未观测到时返回 `artifact_not_observed` + `output_file_ref_not_observed`，不能把 file/run/artifact 伪成功；配置 Runtime Agent HTTP API endpoint 时，Runtime Bridge 可通过公开 HTTP relay 获取 workspace-scoped fileRef、run state、artifact/output projection、`billingMetadataRef` 和 `usageMetadataRef`，并把 `resourceBindingId/workspace runtime identity` 回流 Portal session trace；真实云 runtime、COS 账单、Langfuse 部署和性能预算仍需按 Real OPL capability canary 与 Real OPL file/run/artifact canary 链路逐项裁定；OPL 分支只传 `billingMetadataRef`、`usageMetadataRef` 或 `resourceBindingId`，真实 COS/云账单核对归云服务链路；OPL lane 不提供 `ownerRef`、`operationId` 或 K8s labels，这些归 Package D / deploy lane |
| Billing freeze | 7 天冻结保护 | keep，余额不足提示消耗冻结金额，释放后停止扣费 |
| Trace metadata | Portal 元数据边界 | keep，仅用于轨迹、审计、排障 |
| Langfuse | sanitized trace metadata implementation boundary | keep only for active sanitized client/publisher code；旧 compose/deploy/infra 资产删除；不是 Portal、billing、artifact 或 run 的 canonical source |
| `user_owned` | 无正式入口 | delete，不能作为 alias、public route、copy、fixture 或测试锚点保留 |
| 旧 `med-autoscience-runner` | 无正式入口 | delete，非 v22 主线 |
| 旧 `resource-provisioner` | 无正式入口 | delete，非 v22 主线 |
| K8s Job 主叙事 | 无正式入口 | delete unless migrated into active v22 Runtime Bridge / Package D boundary |
| OpenCost 主叙事 | 无正式入口 | delete，非当前账单事实源 |
| OpenCost strict cleanup | 旧资产、旧脚本、旧默认叙事 | OpenCost 旧资产、旧脚本和旧默认叙事不得作为默认账单事实源 |

### OPL Productionization Truth Split

- Leaf 6 productionization contract refresh: contract_refresh_only.
- canary_proven_local_fact: local Runtime Agent HTTP API relay full-loop canary proves workspace-scoped `fileRef`, `runId`, `artifactRef` / `outputFileRef`, Portal projection, `billingMetadataRef`, `usageMetadataRef`, and no Package D owner fields in a local HTTP relay.
- canary_proven_local_fact: WebUI bridge negative no-fake-success gate proves unsupported file/run/artifact paths stay gated instead of returning fake success.
- canary_proven_authorized_fact: provider message reply canary proves message reply only.
- not_production_truth_yet: these are not production deploy evidence, not true cloud runtime evidence, not COS billing reconciliation evidence, and not Langfuse / `trace.medopl.cn` deployment evidence.
- OPL production branch may consume `resourceBindingId`, `billingMetadataRef`, `usageMetadataRef`, `fileRef`, `runId`, `artifactRef`, and `outputFileRef` only as OPL-lane projection facts; cloud/deploy owner facts remain outside this lane.
- Leaf 7 productionization eval shell: `scripts/smoke-test-v22-opl-productionization-eval-shell.mjs` is a local repo-tracked gate for the next OPL production implementation branch.
- production_eval_gate: OPL production branch must fail closed if it promotes local canary evidence to production truth, emits Package D owner fields, leaks raw key/token/storage/path fields, treats fake success as real file/run/artifact success, modifies upstream, or requires cloud/deploy/live operations without a step-local auth record.
- Leaf 8 local productionization implementation: Runtime Agent HTTP relay now rejects Package D owner fields (`ownerRef`, `operationId`, K8s labels, deploy owner labels) in relay request/response payloads, alongside raw key/token/storage/path guards. This is local hardening only and is not true cloud runtime, COS billing reconciliation, Langfuse deployment, deploy evidence, or upstream production truth.

## v22 Program Board

- v22 program board: [v22-program-board.md](./v22-program-board.md)
- v22 program status table: [v22-program-status-table.md](./v22-program-status-table.md)
- cloud onboarding execution board: [cloud-onboarding-execution-board.md](./cloud-onboarding-execution-board.md)
- cloud onboarding status table: [cloud-onboarding-status-table.md](./cloud-onboarding-status-table.md)
- cloud onboarding verification matrix: [cloud-onboarding-verification-matrix.md](./cloud-onboarding-verification-matrix.md)
- cloud onboarding program id: v22-cloud-onboarding
- program ids: portal-product-surface, cloud-onboarding, one-person-lab-sync
- 总执行板记录 A/B/C/D 窗口角色、三条 program、lane、测试边界和真实副作用规则；不读 secret、不调用真实云、不改 services/deploy/upstream，不 build/push/kubectl。

## Long-Term Governance Surfaces

- long-term governance surfaces: [../status.md](../status.md), [../invariants.md](../invariants.md), [../decisions.md](../decisions.md)
- `docs/status.md` 是 v22 当前唯一活状态入口，指向 active program、cloud onboarding execution board、status table 和 MVP suite。
- `docs/invariants.md` 固化长期红线；`docs/decisions.md` 记录当前有效关键决策。

## 现有仓库域分类

本节基于当前 worktree 的已有文件做 recovery 分类。分类只记录裁定；本次不删除文件、不搬目录、不写业务代码。

| 域 | keep | migrate | delete | archive |
| --- | --- | --- | --- | --- |
| Identity / Auth / Tenant | `services/portal/src/app/portal-auth-runtime-handler.mjs`、`services/portal/src/domain/portal-auth.mjs`、`services/portal/src/domain/provider-config.mjs`、`services/portal/src/domain/provider-secret-store.mjs`、`services/portal/src/domain/tenant-scope.mjs`、`services/portal/src/state/portal-store-db-auth.mjs`、`services/portal/src/state/portal-store-schema.mjs`、`services/opl-web-gateway/src/portal-auth-bridge.mjs` | cleanup/v22-retire-user-owned-primary-path 已把 `services/portal/src/config/portal-config.mjs` 默认 runtime 收敛到 `platform_provisioned`；strict monolith cleanup 已删除旧 user-owned public route / registration / copy / fixture / tests；Slice E 已删除残余 resource-order schema/store/domain remnants | 不得恢复 `user_owned` 或 `resource-order` 正式产品语义、默认配置、文案、新入口或兼容壳 | 旧 user-owned domain/store/route shell 和 resource-order store/domain/schema remnants 已物理删除 |
| Portal Web | `services/portal/frontend/src/app/routes.tsx`、`services/portal/frontend/src/app/App.tsx`、`services/portal/frontend/src/app/components/Layout.tsx`、`services/portal/frontend/src/app/pages/Overview.tsx`、`services/portal/frontend/src/app/pages/RuntimeEnvironment.tsx`、`services/portal/frontend/src/app/pages/Workspace.tsx`、`services/portal/frontend/src/app/pages/OPLEntry.tsx`、`services/portal/frontend/src/app/pages/BillingAudit.tsx`、`services/portal/frontend/src/app/pages/TasksResults.tsx`、`services/portal/frontend/src/app/pages/admin/*.tsx`、`services/portal/frontend/src/app/contexts/RoleContext.tsx`、`services/portal/frontend/src/app/data/portalAdapters.ts`、`services/portal/frontend/src/api/portal/*.ts`、`services/portal/src/routes/portal-api.routes.mjs`、`services/portal/src/routes/admin-api.routes.mjs`、`services/portal/src/routes/opl.routes.mjs`、`services/portal/src/routes/lab-package.routes.mjs`、`services/portal/src/routes/workspace.routes.mjs`、`services/portal/src/routes/workspace-storage.routes.mjs` | current Portal UI 是 Figma Make ZIP source-of-truth + React + Vite + TypeScript + react-router + shadcn/Radix + lucide，覆盖普通用户和管理员 Portal；管理员导航显示由 `/portal/api/me` 角色投影控制，真实权限由 `/portal/api/admin/*` 后端校验 | legacy redirect route 已删除；retired frontend surface gate 列出的旧前端路径、旧入口和旧路由不得恢复为当前 frontend route | 历史前端栈、历史 UI evidence、上一轮非 ZIP 1:1 React shell、retired admin residue 和旧 resource-order 页面/路由叙事不作为 Portal Web 主线 |
| OPL Web Gateway | `services/opl-web-gateway/src/server.mjs`、`services/opl-web-gateway/src/proxy.mjs`、`services/opl-web-gateway/src/portal-auth-bridge.mjs`、`services/opl-web-gateway/src/html-injection.mjs`、`services/opl-web-gateway/src/launch-client-script.mjs`、`services/opl-web-gateway/src/config.mjs` | Gateway 必须保持网关职责，不下沉 upstream 内部逻辑；后续命名和文案继续强调 clean upstream 公开边界；用户可见入口必须是 Portal “进入 OPL 工作台”或 /opl/entry/preflight；/internal/opl/auth/login 只能作为 internal implementation path；旧 v19/v20/v21 OPL direct path、direct upstream path、internal path 不能成为 v22 产品入口；后续真实 proxy / upstream 运行接入单独 feat | 后续 cleanup 删除任何把 Portal/Gateway/Runtime Bridge 代码写入 upstream 的路径 | 无 |
| Runtime Bridge / Runtime Agent | `services/opl-runtime-bridge/src/server.mjs`、`services/opl-runtime-bridge/src/runtime-bridge-launch.mjs`、`runtime-bridge-runs.mjs`、`runtime-bridge-messages.mjs`、`runtime-bridge-routes-http.mjs`、`runtime-bridge-launch-scope.mjs`、`runtime-agent-http-relay.mjs`、`opl-acp-runtime-client.mjs`、`provider-secret-store.mjs`、`run-contract.mjs`、`state-store*.mjs`、`docs/contracts/v22-portal-opl-context-backflow-boundary.md`、`docs/contracts/v22-real-opl-capability-canary-boundary.md`、`docs/contracts/v22-real-opl-provider-message-canary-boundary.md`、`docs/contracts/v22-real-opl-file-run-artifact-canary-boundary.md`、`docs/recovery/portal-opl-context-backflow-validation-path.md`、`docs/recovery/real-opl-capability-canary-validation-path.md`、`docs/recovery/real-opl-provider-message-canary-validation-path.md`、`docs/recovery/real-opl-file-run-artifact-validation-path.md` | 当前 active 仅保留 Runtime Bridge / Runtime Agent 的 production-boundary 语义；`services/opl-runtime-bridge` 是实现路径，不是产品主叙事或旧层保留理由。zero-compat cleanup 已删除 active code 中 retired resource-order and user-owned runtime identifiers。Portal-OPL context/backflow 合同要求 capability registry、context bootstrap、session/message backflow、Portal projection、downstream runtime gate 和 downstream Langfuse session trace boundary；Real OPL capability/provider/file contracts 仅作为验证和 future authorization boundary，不属于默认 active executable surface。OPL lane 不提供 `ownerRef`、`operationId` 或 K8s labels；真实 provider 调用、真实云 runtime、COS 账单与真实 Langfuse 部署需要单独授权 | 后续 cleanup 只能删除或重命名旧实现词，不能把 retired managed runtime 当新产品能力入口 | 旧 runtime mode 与 bridge compatibility 叙事不得作为保留依据 |
| Workspace / Artifact | `services/portal/src/routes/workspace.routes.mjs`、`services/portal/src/routes/workspace-storage.routes.mjs`、`workspace-storage-route-handlers.mjs`、`workspace-storage-upload-support.mjs`、`workspace-files-internal.routes.mjs`、`services/portal/src/domain/workspace-storage.mjs`、`portal-api-workspace-storage.mjs`、`services/portal/src/app/portal-page-workspace-payloads.mjs`、`portal-workspace-runtime.mjs` | workspace lifecycle route 承载创建、归档、恢复、删除；公开操作入口是 `/portal/workspaces/*` | `task-space.routes.mjs`、`/portal/tasks/*` 和“task-space”产品域不得恢复 | 旧 task-space/legacy redirect 只作已删除记录，不作为参考实现 |
| Session / Run | `services/portal/src/domain/session-traces.mjs`、`services/portal/src/app/portal-session-trace-payloads.mjs`、`services/portal/src/services/opl-launch.service.mjs`、`services/opl-runtime-bridge/src/runtime-bridge-runs.mjs`、`runtime-bridge-messages.mjs`、`state-store-run-records.mjs`、`state-store-message-records.mjs`、`state-store-artifact-trace-records.mjs`、`run-observability.mjs` | run/session 命名要收敛到最小 trace metadata boundary；Langfuse publisher 只能作为后续 metadata source 适配点 | strict cleanup 已删除 `/prepare-run` 旧 resource-order run 链；不得恢复旧 resource-order run path | 旧 resource-order internal route family 已物理删除 |
| Billing / Usage / Freeze | `services/portal/src/domain/wallet-ledger.mjs`、`lab-billing-policy.mjs`、`services/portal/src/app/portal-page-billing-payloads.mjs`、`services/portal/src/app/portal-runtime-observability.mjs`、`services/portal/frontend/src/api/portal/billing.ts`、`services/portal/frontend/src/app/pages/BillingAudit.tsx` | v22 账单叙事是预扣费、冻结金额、7 天保护和释放停止扣费；账单 summary、pending、status 和套餐目录由 Portal monolith 账本投影提供 | Slice K 已删除 residual billing adapter compatibility surface；不得恢复 `adapters/billing-aggregator/**` 或 `BILLING_SERVICE_URL` 外呼；Admin billing ops 前端后续同栈 leaf 单独恢复 | `adapters/billing-aggregator/**`、`services/portal/src/integrations/billing-client.mjs`、`scripts/start-opencost-*`、`scripts/install-opencost-local.ps1`、`scripts/smoke-test-billing-opencost.mjs`、旧 non-v22 billing smoke、残余 non-v22 billing smoke 和 `scripts/start-billing-live.mjs` 已删除 |
| Resource Plan / Tenant Binding | `docs/contracts/v22-resource-plan-boundary.md`、`docs/contracts/v22-tenant-resource-binding-boundary.md`、`services/portal/src/domain/server-plans.mjs`、`services/portal/src/app/portal-server-plan-runtime-handler.mjs`、`services/portal/src/domain/platform-provisioned-resources.mjs`、`services/portal/src/domain/user-resource-bindings.mjs`、`services/portal/frontend/src/api/portal/resources.ts`、`services/portal/frontend/src/app/pages/RuntimeEnvironment.tsx` | `services/portal/src/domain/resource-orders.mjs`、`services/portal/src/routes/resource-order-public.routes.mjs`、`resource-order*.routes.mjs` 和 `services/portal/src/integrations/resource-provisioner-client.mjs` are physically deleted; active semantics use resource binding / billing / audit and v22 cloud operation contracts. | 不得恢复旧 resource-order 或 resource-provisioner 作为正式产品入口 | user-owned 资源绑定脚本、旧 resource-order 退场脚本、旧 Portal provisioner client 和旧 non-v22 Portal/billing smoke 已作为 active repo 旧入口清退 |
| Admin / Ops | `services/portal/src/routes/admin-api.routes.mjs`、`admin-user.routes.mjs`、`admin-ops.routes.mjs`、`services/portal/src/app/portal-admin-overview-payloads.mjs`、`portal-admin-api-payloads.mjs`、`portal-admin-portrait-payloads.mjs`、`services/portal/frontend/src/app/pages/admin/*.tsx` | admin payload 和前端文案中旧 `user_owned`、OpenCost、Langfuse、runner/provisioner 表述要迁到平台托管资源池和 metadata boundary；当前 Figma Make admin pages 已作为 active admin UI 接入现有 `/portal/api/admin/*` adapter | 后续 cleanup 删除把 Rancher/OpenCost/KubeSphere/runner 暴露成用户产品面的入口；RoleContext 只控制导航展示，不替代后端 admin 权限校验 | 旧 ops 工具和旧栈画像只作运维参考，不进入用户主线；retired admin frontend residue 已从当前 Portal frontend surface 清退 |
| Deploy / Provisioning | 无 strict monolith default executable surface | zero-compat 下 `deploy/local/dockerfiles/**` 已删除；未来真实部署只保留合同边界，需重新授权和新的 v22 build recipe boundary | 不得在本 cleanup 分支执行 build/push/kubectl/deploy；Package D 本地 gate 只保留 `imageTargetRef` + active service `sourceRoot` 元数据 | `deploy/tke-package/**`、旧 runner/provisioner Dockerfile、residual local Dockerfiles 和旧 `docs/deployment/docker-product-appliance.md` 均已删除 |
| Scripts / Contracts | `docs/contracts/v22-*.md`、`docs/product.md`、`docs/architecture.md`、`docs/recovery/*`、`scripts/smoke-test-v22-*`、`scripts/v22-verify.mjs` | 有价值的旧合同必须迁成 v22 命名和 truth 后保留；旧脚本本体不保留；MVP suite 可以通过 `scripts/v22-verify.mjs` 统一 runner 执行 branch-appropriate bundle；Slice N 已把已删除 live/canary/authorized/proof-loop runner 改为 `.runtime` historical evidence 或 future-authorized boundary | live-test 作为普通验证入口的使用说明已清理；已删除 runner 不得作为现行命令、授权入口、默认 suite 或完成态 | `scripts/smoke-test-v19-*`、`scripts/smoke-test-v20*`、`scripts/smoke-test-v21-*`、旧 check/daily/live-prepare/resource-provisioner/OpenCost 脚本已在 Slice C 删除；旧 v13、portal resource-order/provisioner、runner fixture、v19/v20 helper lib 已在 Slice D 删除；旧 non-v22 billing/portal smoke 已在 Slice E 删除；残余 non-v22 Portal/Billing smoke 和本地 start/install helper remnants 已在 residual Phase G 删除 |
| Legacy / Retired Stack | 无正式主线入口 | active v22 reason 必须逐项写明；不能因为历史证据保留 | strict cleanup 删除旧 `med-autoscience-runner`、`resource-provisioner`、K8s Job、OpenCost、Langfuse 主叙事和默认入口 | `adapters/med-autoscience-runner/`、`adapters/resource-provisioner/`、`adapters/cloud-provisioner/`、`adapters/shared/`、`infra/opencost/`、`infra/kubernetes/`、`infra/codex-runtime/`、`infra/production-hardening/`、`compose.demo.yaml`、`compose.langfuse.yaml`、`deploy/tke-package/**` 和旧 runner/provisioner/v13/resource-order 脚本资产已在 Slice D 删除 |

## 资产裁定规则

| 裁定 | 含义 | 进入 v22 的条件 |
| --- | --- | --- |
| keep | 符合当前主线 | 可以重落或迁入 |
| migrate | 有价值但边界不对 | 改边界、命名、合同后通过 `feat/*` 进入 |
| delete | 属于被替代路线 | 通过 `cleanup/*` 删除 |
| retired | 已被 v22 替代 | active repo 中必须删除，或先迁入 active surface |

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
