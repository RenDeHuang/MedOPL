# Specs Truth

Owner: `MedOPL`
Purpose: `v22_contract_spec_single_truth`
State: `active`
Machine boundary: 本文是 v22 合同/spec 的唯一 repo-tracked authority。旧合同叶子已经吸收为本文 anchor；新增或修改合同必须直接改本文和对应 eval，不再新增分散 leaf。

## Scope

`docs/specs/README.md` 回答 v22 的长期不变量、产品边界、接口/状态/字段、失败码、验收边界、授权红线和合同订阅包。它不替代 source code、runtime evidence、verify manifest、agent run evidence 或真实云授权记录。

Node Portal backend physical removal: `services/portal/src` 已物理清退；当前 Portal frontend 只通过 Go backend `/api` 通信，旧 Node backend 不能作为 shell、facade、compatibility layer、deployable backend、frontend proxy target、typed API owner 或 current verification owner。

## Contract Subscription Discipline

- 正式开发开始前必须声明本分支订阅的 specs anchors、active truth、policy/delivery/source/runtime 边界和验收命令。
- 新增合同、修改合同、合同冲突、主叙事变化、授权边界变化，必须先让用户审阅确认，再写 eval 或实现。
- 合同审阅必须确认范围、边界、非目标、验收条件和污染风险。
- `future-authorized` 只能表示未来授权边界可见，不授权真实云、secret、deploy、kubectl、live-test 或外部 mutation。
- Framework owner/readiness/surface impact 先读 `docs/framework/README.md`；evidence level 和 can-claim / cannot-claim 先读 `docs/evidence/README.md`。Specs 只保合同下限，不承载 evidence log、current cursor 或 production completion claim。

## Non-Negotiable Specs

- MedOPL v22 是 `platform-provisioned / customer-dedicated` 的 OPL SaaS 托管科研工作台。
- Portal 登录不需要 provider key；每个用户使用自己的 gflabtoken API Key 作为模型调用凭证。
- 进入 OPL 工作台和运行平台托管任务是两道 gate；OPL entry/preflight 或工作台 provider 绑定面负责收取或复用用户自己的 gflabtoken API Key，managed run 再要求托管计算资源、文件空间、余额 / 冻结金额、`providerKeyRef` 和 Runtime Bridge 可用。
- raw provider key、bearer token、launchToken、runtimeToken 只能进入后端密钥边界。
- `user_owned`、`resource-order`、旧 runner/provisioner、OpenCost、Langfuse 主叙事不得回流主线。
- 所有资源必须绑定 tenant/user/workspace/resourceBinding/billingAccount/auditTag。
- 释放计算资源不等于删除文件空间；用户删除存储进入 7 天保护期。
- `future-authorized` 不得混入默认本地验证。
- 不读取 secret，不调用真实云，不 build/deploy/kubectl/live-test，除非用户单独授权。

## Spec Anchor Index

| Anchor | Former leaf id |
| --- | --- |
| [spec:v22-admin-ops-console-boundary](#spec-v22-admin-ops-console-boundary) | `v22-admin-ops-console-boundary` |
| [spec:v22-ai-runtime-contract-boundary](#spec-v22-ai-runtime-contract-boundary) | `v22-ai-runtime-contract-boundary` |
| [spec:v22-authorized-tencent-create-release-boundary](#spec-v22-authorized-tencent-create-release-boundary) | `v22-authorized-tencent-create-release-boundary` |
| [spec:v22-authorized-tencent-create-release-execution-boundary](#spec-v22-authorized-tencent-create-release-execution-boundary) | `v22-authorized-tencent-create-release-execution-boundary` |
| [spec:v22-authorized-tencent-create-release-implementation-boundary](#spec-v22-authorized-tencent-create-release-implementation-boundary) | `v22-authorized-tencent-create-release-implementation-boundary` |
| [spec:v22-go-control-plane-mvp-takeover-boundary](#spec-v22-go-control-plane-mvp-takeover-boundary) | `v22-go-control-plane-mvp-takeover-boundary` |
| [spec:v22-precloud-deployable-rc-boundary](#spec-v22-precloud-deployable-rc-boundary) | `precloud-deployable-rc` |
| [spec:v22-backend-go-convergence-program-boundary](#spec-v22-backend-go-convergence-program-boundary) | `v22-backend-go-convergence-program-boundary` |
| [spec:v22-authorized-tencent-deploy-execution-boundary](#spec-v22-authorized-tencent-deploy-execution-boundary) | `v22-authorized-tencent-deploy-execution-boundary` |
| [spec:v22-billing-freeze-boundary](#spec-v22-billing-freeze-boundary) | `v22-billing-freeze-boundary` |
| [spec:v22-cloud-onboarding-workflow-boundary](#spec-v22-cloud-onboarding-workflow-boundary) | `v22-cloud-onboarding-workflow-boundary` |
| [spec:v22-commercial-package-model](#spec-v22-commercial-package-model) | `v22-commercial-package-model` |
| [spec:v22-commercial-ui-impact-decision](#spec-v22-commercial-ui-impact-decision) | `v22-commercial-ui-impact-decision` |
| [spec:v22-langfuse-observability-metadata-boundary](#spec-v22-langfuse-observability-metadata-boundary) | `v22-langfuse-observability-metadata-boundary` |
| [spec:v22-managed-environment-open-boundary](#spec-v22-managed-environment-open-boundary) | `v22-managed-environment-open-boundary` |
| [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop) | `v22-mvp-managed-opl-loop` |
| [spec:v22-opl-deployment-ownership-release-plan-boundary](#spec-v22-opl-deployment-ownership-release-plan-boundary) | `v22-opl-deployment-ownership-release-plan-boundary` |
| [spec:v22-opl-entry-preflight-auth-boundary](#spec-v22-opl-entry-preflight-auth-boundary) | `v22-opl-entry-preflight-auth-boundary` |
| [spec:v22-opl-work-message-file-run-boundary](#spec-v22-opl-work-message-file-run-boundary) | `v22-opl-work-message-file-run-boundary` |
| [spec:v22-portal-admin-ops-surface-boundary](#spec-v22-portal-admin-ops-surface-boundary) | `v22-portal-admin-ops-surface-boundary` |
| [spec:v22-portal-figma-make-ui-implementation-boundary](#spec-v22-portal-figma-make-ui-implementation-boundary) | `v22-portal-figma-make-ui-implementation-boundary` |
| [spec:v22-portal-files-billing-trace-boundary](#spec-v22-portal-files-billing-trace-boundary) | `v22-portal-files-billing-trace-boundary` |
| [spec:v22-portal-opl-connection-boundary](#spec-v22-portal-opl-connection-boundary) | `v22-portal-opl-connection-boundary` |
| [spec:v22-portal-opl-context-backflow-boundary](#spec-v22-portal-opl-context-backflow-boundary) | `v22-portal-opl-context-backflow-boundary` |
| [spec:v22-portal-structure-failure-isolation-boundary](#spec-v22-portal-structure-failure-isolation-boundary) | `v22-portal-structure-failure-isolation-boundary` |
| [spec:v22-portal-ui-design-quality-audit-boundary](#spec-v22-portal-ui-design-quality-audit-boundary) | `v22-portal-ui-design-quality-audit-boundary` |
| [spec:v22-portal-user-surface-boundary](#spec-v22-portal-user-surface-boundary) | `v22-portal-user-surface-boundary` |
| [spec:v22-portal-workbench-management-ui-composition-boundary](#spec-v22-portal-workbench-management-ui-composition-boundary) | `v22-portal-workbench-management-ui-composition-boundary` |
| [spec:v22-pricing-snapshot-boundary](#spec-v22-pricing-snapshot-boundary) | `v22-pricing-snapshot-boundary` |
| [spec:v22-production-cloud-topology-boundary](#spec-v22-production-cloud-topology-boundary) | `v22-production-cloud-topology-boundary` |
| [spec:v22-real-opl-capability-canary-boundary](#spec-v22-real-opl-capability-canary-boundary) | `v22-real-opl-capability-canary-boundary` |
| [spec:v22-real-opl-file-run-artifact-canary-boundary](#spec-v22-real-opl-file-run-artifact-canary-boundary) | `v22-real-opl-file-run-artifact-canary-boundary` |
| [spec:v22-real-opl-provider-message-canary-boundary](#spec-v22-real-opl-provider-message-canary-boundary) | `v22-real-opl-provider-message-canary-boundary` |
| [spec:v22-release-stop-billing-audit-boundary](#spec-v22-release-stop-billing-audit-boundary) | `v22-release-stop-billing-audit-boundary` |
| [spec:v22-resource-plan-boundary](#spec-v22-resource-plan-boundary) | `v22-resource-plan-boundary` |
| [spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary](#spec-v22-runtime-bridge-session-run-file-provider-keyref-boundary) | `v22-runtime-bridge-session-run-file-provider-keyref-boundary` |
| [spec:v22-saas-control-plane-user-experience-boundary](#spec-v22-saas-control-plane-user-experience-boundary) | `v22-saas-control-plane-user-experience-boundary` |
| [spec:v22-saas-portal-opl-ops-surface-boundary](#spec-v22-saas-portal-opl-ops-surface-boundary) | `v22-saas-portal-opl-ops-surface-boundary` |
| [spec:v22-smoke-eval-boundary](#spec-v22-smoke-eval-boundary) | `v22-smoke-eval-boundary` |
| [spec:v22-tenant-resource-binding-boundary](#spec-v22-tenant-resource-binding-boundary) | `v22-tenant-resource-binding-boundary` |
| [spec:v22-tencent-dry-run-resource-plan-provider-boundary](#spec-v22-tencent-dry-run-resource-plan-provider-boundary) | `v22-tencent-dry-run-resource-plan-provider-boundary` |
| [spec:v22-tencent-readonly-inventory-boundary](#spec-v22-tencent-readonly-inventory-boundary) | `v22-tencent-readonly-inventory-boundary` |
| [spec:v22-tencent-readonly-quote-provider-boundary](#spec-v22-tencent-readonly-quote-provider-boundary) | `v22-tencent-readonly-quote-provider-boundary` |
| [spec:v22-tencent-tc3-diagnostic-cleanup-plan](#spec-v22-tencent-tc3-diagnostic-cleanup-plan) | `v22-tencent-tc3-diagnostic-cleanup-plan` |
| [spec:v22-tke-bootstrap-preflight-boundary](#spec-v22-tke-bootstrap-preflight-boundary) | `v22-tke-bootstrap-preflight-boundary` |
| [spec:v22-token-provider-boundary](#spec-v22-token-provider-boundary) | `v22-token-provider-boundary` |
| [spec:v22-trace-metadata-boundary](#spec-v22-trace-metadata-boundary) | `v22-trace-metadata-boundary` |
| [spec:v22-upstream-opl-boundary](#spec-v22-upstream-opl-boundary) | `v22-upstream-opl-boundary` |
| [spec:v22-user-credit-provider-boundary](#spec-v22-user-credit-provider-boundary) | `v22-user-credit-provider-boundary` |

## Absorbed Contract Index

本文件是 MedOPL v22 合同目录/合同树索引，只用于帮助开发者理解现有 contract-level 边界。

它不代表真实云资源、Gateway、Runtime Bridge 或 one-person-lab upstream 已全部打通；也不代表真实价格审批、真实上线部署、真实账单核对或真实 trace source 已完成。

## 合同订阅规则

正式开发开始前，必须先订阅合同包。合同包用于限定本分支的产品真相、技术边界、非目标、污染防护和验收条件。

合同包至少包含：

- v22 主合同
- 本次相关分支合同
- 本次相关共享边界合同
- recovery 约束文档

新增合同、修改合同、合同冲突、主叙事变化，以及真实云、secret、upstream、deploy 授权边界变化，必须先让用户审阅确认。

合同审阅必须确认：

- 范围是否正确
- 边界是否正确
- 非目标是否完整
- 验收条件是否可验证
- 是否存在污染风险

## v22 主合同

- [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop): MVP 托管 OPL 用户闭环主合同，定义从平台创建用户、充值、登录 Portal、进入工作空间、上传文件 / 提任务、绑定用户自己的 gflabtoken API Key、进入 OPL 工作台、按需开通托管运行环境、产出文件到释放环境和审计的 contract-level 主路径。Portal 登录不要求 gflabtoken API Key；模型调用和 managed run 使用用户自己的 gflabtoken `providerKeyRef`。
- [spec:v22-saas-control-plane-user-experience-boundary](#spec-v22-saas-control-plane-user-experience-boundary): SaaS 控制面用户体验真相合同，固定 MedOPL 是 One Person Lab 的 SaaS 控制面和托管交付平台。Portal 帮用户理解自己买的是什么托管 OPL 工作台服务、工作台是否可用、还缺哪一步、下一步点哪里、文件/任务/结果在哪里、费用状态是否正常；OPL 继续负责 chatbot、agent、科研任务执行、文件理解、结果生成和工作台内交互体验。
- [spec:v22-saas-portal-opl-ops-surface-boundary](#spec-v22-saas-portal-opl-ops-surface-boundary): Portal 工作台、OPL Web 和管理台共享界面合同，固定普通用户中文产品语言、OPL 双入口、管理台可见边界、多租户后台边界和腾讯云分账标签边界。路径 1：从 Portal 工作台进入；路径 2：直接访问 OPL 工作台；两条路径最终进入同一套 Gateway、preflight 和 launch 逻辑。

## 用户闭环段合同

- pricing snapshot: [spec:v22-pricing-snapshot-boundary](#spec-v22-pricing-snapshot-boundary)
- user credit / user provider key: [spec:v22-user-credit-provider-boundary](#spec-v22-user-credit-provider-boundary)
- managed environment open / managed resource binding plan view: [spec:v22-managed-environment-open-boundary](#spec-v22-managed-environment-open-boundary)
- Portal-OPL connection: [spec:v22-portal-opl-connection-boundary](#spec-v22-portal-opl-connection-boundary)
- opl work message file run: [spec:v22-opl-work-message-file-run-boundary](#spec-v22-opl-work-message-file-run-boundary)
- runtime bridge session/run/file/providerKeyRef: [spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary](#spec-v22-runtime-bridge-session-run-file-provider-keyref-boundary)
- portal files billing trace: [spec:v22-portal-files-billing-trace-boundary](#spec-v22-portal-files-billing-trace-boundary)
- release stop billing audit: [spec:v22-release-stop-billing-audit-boundary](#spec-v22-release-stop-billing-audit-boundary)

## 共享边界合同

- smoke / eval 分层: [spec:v22-smoke-eval-boundary](#spec-v22-smoke-eval-boundary)。`tests/**/*.mjs` 是 repo-local eval gate 文件族，不全等于 smoke；只有 `health-check` 和 `smoke-golden` 两层可以称为 smoke。`suite smoke` 只跑小型关键路径；`suite local-contract` 和 `suite local-regression` 承接更宽的本地 deterministic gate；`suite real-cloud-readiness` 独立覆盖 mock/snapshot、readonly quote、dry-run plan 和 readonly inventory 的本地 readiness gate；`suite cloud-future-authorized` 只标记 mutation/deploy/live/canary 等未来授权边界，不授权真实云、deploy、kubectl、live-test 或 secret 读取。
- truth freeze: [../history/README.md](../history/README.md)。该文件是当前业务、架构、数据、云和 AI 开发治理的单页真相冻结入口；它不替代长期合同，只防止阶段性合同和旧叙事继续作为当前事实源。
- token/provider key: [spec:v22-token-provider-boundary](#spec-v22-token-provider-boundary), [spec:v22-user-credit-provider-boundary](#spec-v22-user-credit-provider-boundary), [spec:v22-opl-entry-preflight-auth-boundary](#spec-v22-opl-entry-preflight-auth-boundary)。每个用户使用自己的 gflabtoken API Key 作为模型调用凭证；Portal 可以展示“是否已绑定”状态，但 API Key 不是 Portal 普通登录字段；gflabtoken.cn 网站本身不进入 MedOPL 用户主流程。
- resource plan: [spec:v22-resource-plan-boundary](#spec-v22-resource-plan-boundary)。用户购买的是计算资源套餐和工作台能力，不是节点、节点池或云控制台资源；后台实现必须为每个租户或工作台创建并绑定独立 tenant node pool。
- tenant/resource binding: [spec:v22-tenant-resource-binding-boundary](#spec-v22-tenant-resource-binding-boundary), [spec:v22-managed-environment-open-boundary](#spec-v22-managed-environment-open-boundary)
- managed resource binding plan / mock snapshot: [spec:v22-managed-environment-open-boundary](#spec-v22-managed-environment-open-boundary)。当前只展示托管运行环境计划摘要，不代表真实资源已创建；后续真实腾讯云接入路线为 `mock/snapshot provider -> readonly/tencent quote provider -> dry-run/tencent plan provider -> TKE bootstrap preflight when no TKE foundation exists -> readonly/tencent inventory provider -> authorized/tencent create/release provider -> authorized/tencent deploy provider -> canary / QA / status update`，真实接入另开 feat/* 并单独授权。
- readonly/tencent quote provider: [spec:v22-tencent-readonly-quote-provider-boundary](#spec-v22-tencent-readonly-quote-provider-boundary)。当前只定义 interface 和 mock adapter，输出 `regionLabel`、`planSpec`、`estimatedCost`、`quoteSource`、`quoteStatus`、`quoteSnapshotId`，不读取 secret，不调用真实腾讯云 API。
- dry-run/tencent resource plan provider: [spec:v22-tencent-dry-run-resource-plan-provider-boundary](#spec-v22-tencent-dry-run-resource-plan-provider-boundary)。当前只基于 readonly quote 和 managed resource binding plan 生成不会执行的资源创建计划，输出 `resourcePlanId`、`resourceBindingId`、`planMode`、`resourceSteps`、`approvalRequired`、`releasePolicy`、`auditStatus`、`riskNotes` 等业务字段；`realResourceCreated` 和 `chargeApplied` 不属于 `resourcePlan` 顶层字段。
- TKE bootstrap preflight: [spec:v22-tke-bootstrap-preflight-boundary](#spec-v22-tke-bootstrap-preflight-boundary)。当前只生成云底座 checklist，说明缺 TKE 时先创建/选择 VPC、私有子网、统一 TKE 集群和 platform service node pool；tenant node pool 由 Package C 在租户或工作台开通时创建和释放。它不读取 secret、不调用真实云、不 kubectl、不 deploy、不 build/push、不创建资源。PostgreSQL / COS / CBS 是当前必需数据面，Redis 不进入必需项。
- readonly/tencent inventory: [spec:v22-tencent-readonly-inventory-boundary](#spec-v22-tencent-readonly-inventory-boundary)。当前只定义真实云只读盘点合同，用来验证云上事实和 Portal 账本是否一致；未来 secret 文件只能 allowlist_only 读取 readonly inventory keys，不允许“一读全读”；仅允许 Describe/List/Get/Head 类只读 API，不读取 COS 对象正文，不调用 mutation API，不创建、删除、释放、扩缩容或改标签。
- production cloud topology: [spec:v22-production-cloud-topology-boundary](#spec-v22-production-cloud-topology-boundary)。当前只是合同，定义 CLB / TKE / COS / CBS / NAT / PostgreSQL 在 MedOPL v22 生产拓扑中的角色，并区分 platform service node pool 与每个租户或工作台的 tenant node pool；不代表已部署、已接入或已验证，不读取 secret，不调用真实云，不改 deploy，不 kubectl，不 build/push，不创建/删除资源。普通用户产品语言不展示这些云资源名；region/VPC/subnet/security group/resource tag/cost allocation 后续进入 readonly inventory 和 deploy plan。
- cloud onboarding workflow: [spec:v22-cloud-onboarding-workflow-boundary](#spec-v22-cloud-onboarding-workflow-boundary)。该 repo-tracked cloud onboarding workflow 合同把 official SDK provider strategy、wrapper、dependency loader、check-config、default gate、user-authorized readonly live、report review、TC3 cleanup、dry-run create/release、TKE bootstrap preflight、mutation wrapper、authorized live、deploy、Portal production integration 和 canary/QA/status update 定成业务推进顺序；它不替代 AGENTS.md，AGENTS.md 管 A/B/C/D 纪律和授权红线，本合同管业务推进顺序、阶段状态、blocker 回流和下一步任务包。
- authorized/tencent create/release: [spec:v22-authorized-tencent-create-release-boundary](#spec-v22-authorized-tencent-create-release-boundary)。当前只定义真实创建/释放前的授权边界，覆盖基础套餐、Pro 套餐、自定义规格、统一 TKE 集群、tenant node pool create/release、namespace/quota、node pool class、COS 文件空间、7 天保护期、文件夹管理、T+1 分账标签和失败审计；标准套餐也必须由 MedOPL 创建并绑定独立 tenant node pool；7 天保护期只由存储资源 / 文件空间删除或独立欠费保留策略触发；不读取 secret，不调用真实腾讯云 API，不创建或释放真实资源。
- authorized/tencent create/release implementation: [spec:v22-authorized-tencent-create-release-implementation-boundary](#spec-v22-authorized-tencent-create-release-implementation-boundary)。当前只定义后续真实 create/release implementation 前的授权、风控、失败回滚、费用保护和审计合同；默认风控上限不是默认开通规格，计算资源和存储资源生命周期分离，且风控可由 Portal 管理员按账号修改；不读取 secret，不调用真实腾讯云 API，不创建或释放真实资源。
- authorized/tencent create/release execution: [spec:v22-authorized-tencent-create-release-execution-boundary](#spec-v22-authorized-tencent-create-release-execution-boundary)。当前只收敛真实变更资源执行前的 gate、mutation secret allowlist、资源生命周期、Portal ledger + 云标签双重校验、风控 override、冻结金额、120 分钟核对、T+1 COS 对账、回滚和 admin 审计边界；Package C 必须为租户或工作台创建 tenant node pool，再写 compute allocation、namespace、ResourceQuota / LimitRange / admission policy，超过 allocation 必须 fail-closed；readonly inventory 与 create/release mutation gate、secret 和 runner/bridge 必须分离；本合同不读取 mutation secret，不调用真实云，不执行真实 create/release。
- authorized/tencent deploy execution: [spec:v22-authorized-tencent-deploy-execution-boundary](#spec-v22-authorized-tencent-deploy-execution-boundary)。Package D 合同，定义 TCR 镜像、push 唯一 test tag、digest verify、kubectl deploy dry-run、指定 namespace/workload/container rollout、runtime smoke 和 rollback evidence 边界；Package D 不授权 Package C 的资源生命周期动作，不创建、删除、释放或扩缩容 TKE node pool，不创建、删除、清空或扩容 COS bucket/prefix/object，不允许误删、误停或误改别人的节点和存储。
- OPL deployment ownership release plan: [spec:v22-opl-deployment-ownership-release-plan-boundary](#spec-v22-opl-deployment-ownership-release-plan-boundary)。Package D 的 Level 4 子合同，定义 `platform_service_target` 与 `workspace_runtime_target` 的 release plan owner guard。平台服务 target 需要 `ownerRef/operationId`，不强制 `workspaceId/resourceBindingId`；workspace runtime target 必须绑定 `workspaceId/resourceBindingId`。该合同只证明 release plan ownership gate，不授权 build/push/kubectl，也不把 OPL lane 扩权成 deploy lane。
- Package D image push gate: [spec:v22-authorized-tencent-deploy-execution-boundary](#spec-v22-authorized-tencent-deploy-execution-boundary) 的 R-14/R-15 子链路。`build-push` 必须先有已审查的 TCR preflight evidence，并显式传入 `acceptedPreflightId`；缺失时 runner fail-closed。cloud-lane 分支可长期保存 D1/D2/D3 stacked evidence，但不得把 fake-live 或未授权真实 push 当作 production deploy 完成。
- Package D deploy dry-run gate: [spec:v22-authorized-tencent-deploy-execution-boundary](#spec-v22-authorized-tencent-deploy-execution-boundary) 的 R-16 子链路。`deploy-dry-run` 必须消费 D2 build-push digest report，并显式传入 `imageDigestsFile`；缺失时 runner fail-closed。该 gate 不授权 `kubectl apply`、rollout、runtime smoke 或 Package C 资源生命周期动作。
- real resource contract alignment smoke: [../../tests/future-authorized/cloud/future-authorized-test-v22-real-resource-contract-alignment.mjs](../../tests/future-authorized/cloud/future-authorized-test-v22-real-resource-contract-alignment.mjs)。该 smoke 守住基础套餐、Pro 套餐、自定义规格、任务并发、计算资源和存储资源生命周期分离，以及普通用户主语言边界，防止真实资源接入前恢复旧口径。
- billing freeze/preauth: [spec:v22-billing-freeze-boundary](#spec-v22-billing-freeze-boundary), [spec:v22-release-stop-billing-audit-boundary](#spec-v22-release-stop-billing-audit-boundary)
- trace metadata: [spec:v22-trace-metadata-boundary](#spec-v22-trace-metadata-boundary), [spec:v22-portal-files-billing-trace-boundary](#spec-v22-portal-files-billing-trace-boundary), [spec:v22-langfuse-observability-metadata-boundary](#spec-v22-langfuse-observability-metadata-boundary)
- AI Runtime Contract: [spec:v22-ai-runtime-contract-boundary](#spec-v22-ai-runtime-contract-boundary)。该合同把 Runtime Bridge 固定为 AI runtime adapter owner，定义 runtimeSession / runtimeTool / runtimeResource / runtimeRun / runtimeArtifact / runtimeApproval，并把 MCP-compatible boundary 限定为 tools / resources / prompts / artifacts / approval shape compatibility；不授权真实云、secret、deploy、kubectl、build/push 或 live-test，也不授权 production MCP server 或外部 MCP client。
- Langfuse 观测附件: [spec:v22-langfuse-observability-metadata-boundary](#spec-v22-langfuse-observability-metadata-boundary)。该合同只定义 sanitized trace/session metadata 边界，不代表 Langfuse 部署、ClickHouse、真实 API key 或真实 trace source 已接入。
- runtime bridge session/run/file/providerKeyRef: [spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary](#spec-v22-runtime-bridge-session-run-file-provider-keyref-boundary)
- Portal-OPL connection: [spec:v22-portal-opl-connection-boundary](#spec-v22-portal-opl-connection-boundary)。Portal 发起进入 OPL、Gateway bootstrap、OPL session bind、message/file/run、artifact projection、workspace/session/run 归属、token 不进 URL/browser state 和 clean upstream 边界由该合同统一固定。它不修改 one-person-lab upstream，不读取 secret，不调用真实云。
- Portal-OPL context/backflow: [spec:v22-portal-opl-context-backflow-boundary](#spec-v22-portal-opl-context-backflow-boundary)。该三级执行合同把 Portal 工作台控制面、Gateway entry/proxy、OPL context bootstrap、Runtime Bridge capability/backflow projection、downstream Runtime gate 和 downstream Langfuse `trace.medopl.cn` session trace boundary 拆开；它不修改 one-person-lab upstream，不实现真实云 runtime，不部署 Langfuse，不允许 200 假成功。
- Real OPL capability canary: [spec:v22-real-opl-capability-canary-boundary](#spec-v22-real-opl-capability-canary-boundary)。该三级执行合同把真实 OPL WebUI/ACP/Runtime 能力发现、message reply、file、run、artifact、observability 和 Portal projection 的 canary 验证拆开；它只定义真实能力裁定、错误 gate、canary evidence 和 productionization handoff。历史授权 provider message live canary 脱敏 evidence 曾观察到 message reply 子链路，但不代表真实文件上传、真实 Runtime Agent、真实云 runtime 或 Langfuse 已上线；后续再次执行必须重新授权。
- Real OPL provider message canary: [spec:v22-real-opl-provider-message-canary-boundary](#spec-v22-real-opl-provider-message-canary-boundary)。该四级细分执行合同只定义真实 provider message reply canary 的 provider key gate、message send、reply observation、Runtime Bridge normalization、Portal message status、Portal session trace、Langfuse attachment boundary 和 no fake 200；默认 smoke 不读取 raw provider key、不调用真实 provider；历史授权 live canary 脱敏 evidence 曾观察到真实 assistant reply 可按 `mapped_to_webui_bridge` 回流 Portal；后续再次执行必须重新授权。
- Real OPL file/run/artifact canary: [spec:v22-real-opl-file-run-artifact-canary-boundary](#spec-v22-real-opl-file-run-artifact-canary-boundary)。该三级执行合同细化真实 file upload 或 file intent、workspace-scoped fileRef、run intent、Runtime Agent gate、artifact/output backflow、Portal projection、billing metadata handoff、Production Runtime Agent binding、Langfuse optional attachment 和 no fake 200。它不部署 Langfuse，不调用真实云 mutation，不实现 COS 真实账单结算，不把 `/api/opl/*` placeholder 当 Product API；每个 step 必须 gate，不能用 200 假成功。当前本地 Runtime Agent HTTP API relay full-loop canary 已证明 file/run/artifact 可通过独立 Runtime Agent API 回流 Portal projection，并明确 OPL lane 只提供 `resourceBindingId/workspace runtime identity`、`billingMetadataRef`、`usageMetadataRef`、run/artifact projection；OPL lane 不决定 `ownerRef`、`operationId` 或 K8s labels，不代表真实云 runtime、COS 账单或 Langfuse 已上线。
- upstream one-person-lab clean boundary: [spec:v22-upstream-opl-boundary](#spec-v22-upstream-opl-boundary), [spec:v22-opl-work-message-file-run-boundary](#spec-v22-opl-work-message-file-run-boundary)。upstream 目录只读/clean；Portal / Gateway / Runtime Bridge / Runtime Agent / Langfuse / 腾讯云逻辑不得写进 upstream；只能通过 OPL Web Gateway、Runtime Bridge / Runtime Agent、公开 API/CLI、WebSocket bridge 或反向代理边界接入。OPL Gateway 本地 proxy 通过 `OPL_UPSTREAM_URL` 显式接入 clean upstream；未配置时返回 `opl_upstream_url_required`，不兜底到旧 v19/v20/v21 direct path 或硬编码 upstream。历史真实 WebUI canary 脱敏 evidence 曾确认独立 WebUI 页面、auth context、Gateway proxy、WebSocket session bridge 和 Runtime Bridge session bridge 可接通，但 `/api/opl/*` 是 catch-all placeholder，不是 Product API；历史授权 provider message live canary evidence 曾确认 message AI reply 可回流；file upload 和 run/artifact 回流仍需单独 agent/runtime canary。
- pricing snapshot: [spec:v22-pricing-snapshot-boundary](#spec-v22-pricing-snapshot-boundary)

## 界面/运维合同

- 普通用户 Portal 中文产品语言: [spec:v22-saas-portal-opl-ops-surface-boundary](#spec-v22-saas-portal-opl-ops-surface-boundary), [spec:v22-portal-files-billing-trace-boundary](#spec-v22-portal-files-billing-trace-boundary)
- Portal role surface 边界: [spec:v22-portal-user-surface-boundary](#spec-v22-portal-user-surface-boundary), [spec:v22-portal-admin-ops-surface-boundary](#spec-v22-portal-admin-ops-surface-boundary)。MedOPL 是同一个 Portal 应用、同一套登录、同一套 UI shell；普通用户 surface 和管理员 surface 严格分离，管理员页面/API 使用独立分区，普通用户不能看到 admin/ops 入口、全局数据或管理操作。这两份合同是 Portal 角色真相；[spec:v22-saas-portal-opl-ops-surface-boundary](#spec-v22-saas-portal-opl-ops-surface-boundary) 是更宽的 Portal、OPL 和管理台共享界面总述，不替代 role surface 合同。
- Portal 结构治理 / failure isolation: [spec:v22-portal-structure-failure-isolation-boundary](#spec-v22-portal-structure-failure-isolation-boundary)。这是 Portal 三级结构治理合同，只定义 Portal 后端 route/dispatcher、payload/DTO builder、frontend view/composable、frontend API module 和 smoke 分层边界；不定义新产品主叙事，不替代 role surface 合同，不调用真实云，不改 OPL Gateway / Runtime Bridge。
- OPL Web entry/preflight: [spec:v22-saas-portal-opl-ops-surface-boundary](#spec-v22-saas-portal-opl-ops-surface-boundary), [spec:v22-opl-entry-preflight-auth-boundary](#spec-v22-opl-entry-preflight-auth-boundary), [spec:v22-upstream-opl-boundary](#spec-v22-upstream-opl-boundary), [spec:v22-opl-work-message-file-run-boundary](#spec-v22-opl-work-message-file-run-boundary)。用户可见入口必须是 Portal “进入 OPL 工作台”或 /opl/entry/preflight；进入 OPL 工作台不等于开始平台托管任务。/internal/opl/auth/login 只能是 internal implementation path，不是用户入口。Gateway local proxy 只注入 `workspaceId`、`sessionId`/`launchStatus`、`providerBound`、`providerKeyRef` 和 Portal return URL；raw API Key、launchToken、runtimeToken、bearer token、objectKey、localPath、signedUrl 不进入 upstream、URL query 或浏览器持久化存储。
- 管理台可见边界: [spec:v22-saas-portal-opl-ops-surface-boundary](#spec-v22-saas-portal-opl-ops-surface-boundary), [spec:v22-tenant-resource-binding-boundary](#spec-v22-tenant-resource-binding-boundary), [spec:v22-release-stop-billing-audit-boundary](#spec-v22-release-stop-billing-audit-boundary)
- Admin / Ops Console 边界: [spec:v22-admin-ops-console-boundary](#spec-v22-admin-ops-console-boundary)。该合同只定义管理员/运维界面边界，不实现 UI，不调用真实云，不读取 secret；普通用户资源页不得恢复云控制台或运维语义。
- 腾讯云分账标签后台边界: [spec:v22-saas-portal-opl-ops-surface-boundary](#spec-v22-saas-portal-opl-ops-surface-boundary), [spec:v22-tenant-resource-binding-boundary](#spec-v22-tenant-resource-binding-boundary), [spec:v22-pricing-snapshot-boundary](#spec-v22-pricing-snapshot-boundary)

## Truth Layer 索引

以下索引用于回答“当前真相在哪里”。它不新增产品方向，只把已经存在的 truth 固定到可订阅入口，避免后续 coding 只订阅交付层、漏读用户体验层。

| Truth layer | 当前事实源 | 订阅用途 |
| --- | --- | --- |
| 服务商品真相 | [../active/README.md](../active/README.md), [spec:v22-saas-control-plane-user-experience-boundary](#spec-v22-saas-control-plane-user-experience-boundary), [spec:v22-authorized-tencent-create-release-boundary](#spec-v22-authorized-tencent-create-release-boundary) | 用户购买的是托管 OPL 科研工作台服务，不是云资源控制台对象。 |
| 用户体验真相 | [spec:v22-saas-control-plane-user-experience-boundary](#spec-v22-saas-control-plane-user-experience-boundary), [spec:v22-saas-portal-opl-ops-surface-boundary](#spec-v22-saas-portal-opl-ops-surface-boundary) | Portal 必须解释买了什么、能不能用、缺什么、下一步点哪里、结果和费用在哪里。 |
| 信息架构真相 | [spec:v22-portal-workbench-management-ui-composition-boundary](#spec-v22-portal-workbench-management-ui-composition-boundary), [spec:v22-portal-figma-make-ui-implementation-boundary](#spec-v22-portal-figma-make-ui-implementation-boundary), [../../services/portal/frontend/src/app](../../services/portal/frontend/src/app) | Figma Make ZIP、active route、page composition、layout、API adapter 和旧 UI 物理清退。 |
| 生命周期真相 | [../history/README.md](../history/README.md), [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop), [spec:v22-authorized-tencent-create-release-boundary](#spec-v22-authorized-tencent-create-release-boundary) | 开户、充值、进入工作空间、上传文件 / 提任务、进入 OPL、按需开通资源、回流、冻结、释放、审计。 |
| 权限/角色真相 | [spec:v22-portal-user-surface-boundary](#spec-v22-portal-user-surface-boundary), [spec:v22-portal-admin-ops-surface-boundary](#spec-v22-portal-admin-ops-surface-boundary), [spec:v22-admin-ops-console-boundary](#spec-v22-admin-ops-console-boundary) | 普通用户、管理员和运维的可见、不可见和可操作边界。 |
| 状态/数据源真相 | [../active/README.md](../active/README.md), [spec:v22-authorized-tencent-create-release-boundary](#spec-v22-authorized-tencent-create-release-boundary), [spec:v22-portal-files-billing-trace-boundary](#spec-v22-portal-files-billing-trace-boundary) | workspace、resource binding、billing、run、artifact、trace 的 canonical source 和 projection。 |
| 操作风险真相 | [spec:v22-authorized-tencent-create-release-execution-boundary](#spec-v22-authorized-tencent-create-release-execution-boundary), [spec:v22-cloud-onboarding-workflow-boundary](#spec-v22-cloud-onboarding-workflow-boundary) | 真实资源、真实扣费、release、rollback、审计队列和 fail-closed gate。 |
| UI composition 真相 | [spec:v22-portal-workbench-management-ui-composition-boundary](#spec-v22-portal-workbench-management-ui-composition-boundary), [spec:v22-portal-ui-design-quality-audit-boundary](#spec-v22-portal-ui-design-quality-audit-boundary), [spec:v22-portal-figma-make-ui-implementation-boundary](#spec-v22-portal-figma-make-ui-implementation-boundary), [../../services/portal/frontend/src/app](../../services/portal/frontend/src/app) | 页面层级、组件状态、空态、错误态、Figma Make ZIP source、design quality audit 和 surface gate。 |
| UI implementation source | [spec:v22-portal-figma-make-ui-implementation-boundary](#spec-v22-portal-figma-make-ui-implementation-boundary), [../../DESIGN.md](../../DESIGN.md) | v22 Portal UI 实现源：Portal 全体前端技术栈为 React + Vite + TypeScript + shadcn/Radix + lucide；当前 Figma Make ZIP 覆盖普通用户和管理员 Portal UI。 |
| 交付/平台真相 | [../active/README.md](../active/README.md), [spec:v22-resource-plan-boundary](#spec-v22-resource-plan-boundary), [spec:v22-tenant-resource-binding-boundary](#spec-v22-tenant-resource-binding-boundary), [spec:v22-production-cloud-topology-boundary](#spec-v22-production-cloud-topology-boundary) | 开通、隔离、计费、审计、释放、secret 和 deploy 授权边界。 |
| 运营/支持真相 | [spec:v22-admin-ops-console-boundary](#spec-v22-admin-ops-console-boundary), [spec:v22-portal-admin-ops-surface-boundary](#spec-v22-portal-admin-ops-surface-boundary), [spec:v22-release-stop-billing-audit-boundary](#spec-v22-release-stop-billing-audit-boundary) | 服务状态、异常账单、失败任务、释放失败、审计查询和排障。 |

订阅规则：凡是会改变普通用户可见页面、OPL 入口、run/file/artifact 回流、资源/账单状态、真实云 projection 或管理台摘要的分支，都必须订阅 [spec:v22-saas-control-plane-user-experience-boundary](#spec-v22-saas-control-plane-user-experience-boundary)，再订阅对应实现合同。

## 合同包模板

### Portal / UI 合同包

适用于 Portal dashboard、资源状态、账单、文件、trace 页面和普通用户中文产品语言。

订阅：

- [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop)
- [spec:v22-saas-control-plane-user-experience-boundary](#spec-v22-saas-control-plane-user-experience-boundary)
- [spec:v22-saas-portal-opl-ops-surface-boundary](#spec-v22-saas-portal-opl-ops-surface-boundary)
- [spec:v22-portal-user-surface-boundary](#spec-v22-portal-user-surface-boundary)
- [spec:v22-portal-admin-ops-surface-boundary](#spec-v22-portal-admin-ops-surface-boundary)
- [spec:v22-portal-files-billing-trace-boundary](#spec-v22-portal-files-billing-trace-boundary)
- [spec:v22-portal-structure-failure-isolation-boundary](#spec-v22-portal-structure-failure-isolation-boundary)
- [spec:v22-portal-workbench-management-ui-composition-boundary](#spec-v22-portal-workbench-management-ui-composition-boundary): Portal UI composition 合同只管产品边界、UI 分层、禁词、Figma Make ZIP source、Portal data model 和统一验证入口；具体 route、surface、layout 和 API wiring 由 `services/portal/frontend/src/app/**`、`services/portal/frontend/src/app/data/portal*Model.ts`、`services/portal/frontend/src/app/data/portalQuery.ts` 和 surface smoke 承接。
- [spec:v22-portal-ui-design-quality-audit-boundary](#spec-v22-portal-ui-design-quality-audit-boundary): UI design quality audit 合同只管边界、评价标准、audit evidence schema 和后续 UI implementation leaf handoff，不替代 UI composition 合同，不冻结具体布局、配色、字体、圆角或组件库；它审计 Portal 是否回答用户买了什么、能不能用、缺什么、下一步点哪里、结果在哪里和费用是否正常。审计证据路径固定为 `.runtime/portal-ui-design-quality/report.json` 且不进 git；当前 React/Figma Make implementation leaf 已在 `services/portal/frontend/**` 落地普通用户 6 个路由、服务摘要、状态驱动下一步、Portal/OPL runtime 职责边界、环境/套餐/算力/存储/释放状态和文件/任务/结果链路，并同步 React route/surface eval、typecheck 和 build 验证。
- [spec:v22-portal-figma-make-ui-implementation-boundary](#spec-v22-portal-figma-make-ui-implementation-boundary): 当前 Portal frontend implementation leaf，授权 Portal 全体前端栈收敛为 React + Vite + TypeScript + react-router + shadcn/Radix + lucide，并以 Figma Make ZIP 作为唯一 Portal UI source-of-truth，吸收普通用户路由 `/overview`、`/resources`、`/workspace`、`/trace`、`/billing`、`/opl-launch` 和管理员路由 `/admin/dashboard`、`/admin/users`、`/admin/alerts`、`/admin/billing-ops`、`/admin/audit`、`/admin/system`、`/admin/ops`；retired frontend surface gate 已证明旧管理员 console residue 物理清退，管理员导航显示由后端角色投影控制，真实权限仍由 `/api/admin/*` 后端校验；`/admin/ops` 默认后端可返回 `404 ops_surface_disabled`，前端必须展示“平台托管运维入口未启用”的产品态。
- [../../DESIGN.md](../../DESIGN.md): Portal UI 重构设计执行源，用于指导当前 React implementation 的产品气质、信息架构、组件使用、文案、视觉规则和 Figma Make ZIP 吸收流程；它不替代本合同包、不替代 Figma Make ZIP source-of-truth、不替代 smoke，也不授权修改后端、真实云、deploy、upstream 或 secret 边界。
- [../history/README.md](../history/README.md)
- [../active/README.md](../active/README.md)

统一验证入口：

```bash
node tests/contract/contract-test-v22-node-portal-backend-physical-removal.mjs
```

Portal frontend surface 可执行验证入口：

```bash
node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs
```

### OPL Entry / Gateway 合同包

适用于 OPL entry/preflight、Portal 进入 OPL 工作台、直接访问 OPL 工作台和用户自己的 gflabtoken 输入边界。

订阅：

- [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop)
- [spec:v22-saas-control-plane-user-experience-boundary](#spec-v22-saas-control-plane-user-experience-boundary)
- [spec:v22-portal-opl-connection-boundary](#spec-v22-portal-opl-connection-boundary)
- [spec:v22-opl-entry-preflight-auth-boundary](#spec-v22-opl-entry-preflight-auth-boundary)
- [spec:v22-saas-portal-opl-ops-surface-boundary](#spec-v22-saas-portal-opl-ops-surface-boundary)
- [spec:v22-token-provider-boundary](#spec-v22-token-provider-boundary)
- [spec:v22-upstream-opl-boundary](#spec-v22-upstream-opl-boundary)
- [../history/README.md](../history/README.md)

### Runtime Bridge 合同包

适用于 OPL session bind、run、message、file reference、artifact reference、providerKeyRef 透传和 Runtime Agent relay。当前实现目录是 services/opl-runtime-bridge；这是 v22 active Runtime Bridge 主线服务，不是旧 adapters/* 路线。

订阅：

- [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop)
- [spec:v22-saas-control-plane-user-experience-boundary](#spec-v22-saas-control-plane-user-experience-boundary)
- [spec:v22-portal-opl-connection-boundary](#spec-v22-portal-opl-connection-boundary)
- [spec:v22-portal-opl-context-backflow-boundary](#spec-v22-portal-opl-context-backflow-boundary)
- [spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary](#spec-v22-runtime-bridge-session-run-file-provider-keyref-boundary)
- [spec:v22-ai-runtime-contract-boundary](#spec-v22-ai-runtime-contract-boundary)
- [spec:v22-opl-work-message-file-run-boundary](#spec-v22-opl-work-message-file-run-boundary)
- [spec:v22-token-provider-boundary](#spec-v22-token-provider-boundary)
- [spec:v22-trace-metadata-boundary](#spec-v22-trace-metadata-boundary)
- [../history/README.md](../history/README.md)

### spec:v22-ai-runtime-contract-boundary

AI Runtime Contract 是 MedOPL v22 的 Runtime Bridge AI runtime adapter layer 合同。它把 Portal/Gateway/Runtime Bridge 到 OPL ACP runtime、Runtime Agent HTTP API 和未来 MCP-compatible tools/resources 的边界收敛为同一 adapter contract，不把 LangGraph、OpenAI Agents SDK、MCP、A2A 或 upstream OPL 内部状态变成 MedOPL 平台框架 owner。

合同对象为 runtimeSession、runtimeTool、runtimeResource、runtimeRun、runtimeArtifact 和 runtimeApproval。MCP-compatible boundary 只表示 tools / resources / prompts / artifacts / approval shape compatibility；当前 machine boundary 是 `services/opl-runtime-bridge/src/runtime-bridge-mcp-compatible-shapes.mjs` 的本地 shape-only projection，不授权真实云、secret、deploy、kubectl、build/push 或 live-test，不声明 production MCP server 已运行，不授权外部 MCP client，不读取 raw provider key、bearer token、launchToken、runtimeToken、objectKey、localPath、signedUrl 或 presignedUrl。

验收入口：

```bash
node tests/contract/runtime-bridge/contract-test-v22-ai-runtime-contract.mjs
node tests/contract/contract-test-v22-ai-mvp-readiness-audit.mjs
```

AI MVP readiness audit 只汇总本地 readiness 证据边界：MVP contract suite、pre-cloud deployable RC、local Portal/OPL delivery RC、AI Runtime Contract、Runtime Bridge session/run/file/providerKeyRef smoke、Runtime Bridge local fake probe、MCP-compatible shape-only projection、real-cloud authorization blocker 和 Sentrux structure gate 状态。它不能把本地 proof 升级成真实云、production MCP server、external MCP client、deploy、kubectl、build/push、live-test、secret read 或 production runtime readiness。

six-step AI MVP readiness 完成后的唯一可声明状态是 `local_ai_mvp_readiness_only`：当前修复分支收口、Portal 结构质量恢复、E2E MVP 验证、AI Runtime Contract、Runtime Bridge AI runtime layer 和 MCP-compatible boundary design 都只能证明本地端到端 MVP readiness。六步之后仍必须进入 real-cloud authorization boundary、mock/snapshot provider、readonly quote、dry-run plan、readonly inventory、authorized create/release、authorized deploy、canary / QA / status update。未完成这些云门禁前，不能声明 real_cloud_ready、production_online、deploy_ready、secret_authorized 或 live_test_authorized。

### Portal-OPL Context Backflow 合同包

适用于 Portal 打通 clean OPL WebUI、OPL 获取 MedOPL public context、session/message 事件回流 Portal、capability registry、downstream runtime gate、downstream Langfuse `trace.medopl.cn` session trace boundary 和性能 canary。该合同包是三级执行合同包，不实现真实云 runtime，不部署 Langfuse。

订阅：

- [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop)
- [spec:v22-saas-control-plane-user-experience-boundary](#spec-v22-saas-control-plane-user-experience-boundary)
- [spec:v22-portal-opl-connection-boundary](#spec-v22-portal-opl-connection-boundary)
- [spec:v22-portal-opl-context-backflow-boundary](#spec-v22-portal-opl-context-backflow-boundary)
- [spec:v22-upstream-opl-boundary](#spec-v22-upstream-opl-boundary)
- [spec:v22-opl-work-message-file-run-boundary](#spec-v22-opl-work-message-file-run-boundary)
- [spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary](#spec-v22-runtime-bridge-session-run-file-provider-keyref-boundary)
- [spec:v22-portal-files-billing-trace-boundary](#spec-v22-portal-files-billing-trace-boundary)
- [spec:v22-token-provider-boundary](#spec-v22-token-provider-boundary)
- [spec:v22-langfuse-observability-metadata-boundary](#spec-v22-langfuse-observability-metadata-boundary)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)

### Real OPL Capability Canary 合同包

适用于真实 OPL WebUI/ACP/Runtime 能力发现、message reply canary、file capability canary、Runtime Agent / run canary、artifact/output backflow canary、observability metadata canary、Portal projection negative gates 和 productionization handoff。该合同包是三级执行合同包，不修改 one-person-lab upstream，不读取 secret，不调用真实云，不部署 Langfuse，不允许 fake 200。

订阅：

- [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop)
- [spec:v22-saas-control-plane-user-experience-boundary](#spec-v22-saas-control-plane-user-experience-boundary)
- [spec:v22-portal-opl-connection-boundary](#spec-v22-portal-opl-connection-boundary)
- [spec:v22-portal-opl-context-backflow-boundary](#spec-v22-portal-opl-context-backflow-boundary)
- [spec:v22-real-opl-capability-canary-boundary](#spec-v22-real-opl-capability-canary-boundary)
- [spec:v22-real-opl-provider-message-canary-boundary](#spec-v22-real-opl-provider-message-canary-boundary)
- [spec:v22-upstream-opl-boundary](#spec-v22-upstream-opl-boundary)
- [spec:v22-opl-work-message-file-run-boundary](#spec-v22-opl-work-message-file-run-boundary)
- [spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary](#spec-v22-runtime-bridge-session-run-file-provider-keyref-boundary)
- [spec:v22-portal-files-billing-trace-boundary](#spec-v22-portal-files-billing-trace-boundary)
- [spec:v22-token-provider-boundary](#spec-v22-token-provider-boundary)
- [spec:v22-trace-metadata-boundary](#spec-v22-trace-metadata-boundary)
- [spec:v22-langfuse-observability-metadata-boundary](#spec-v22-langfuse-observability-metadata-boundary)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)

### Real OPL Provider Message Canary 合同包

适用于真实 OPL provider message reply canary 的 provider key gate、真实 message intent、provider invocation evidence、assistant reply observation、Runtime Bridge normalized message state、Portal message status、Portal session trace projection、Langfuse optional attachment boundary 和 no fake 200。该合同包是 Real OPL Capability Canary 的四级细分执行合同；默认合同 smoke 不修改 one-person-lab upstream、不读取 secret、不调用真实 provider、不调用真实云、不部署 Langfuse。真实 provider key 和真实模型调用必须通过 `REAL_OPL_PROVIDER_MESSAGE_CANARY=1`、`OPL_PROVIDER_SECRET_FILE`、`OPL_REAL_WEBUI_DIR` 或 `OPL_REAL_WEBUI_URL` 单独授权，并且 live canary 不进入默认 MVP suite。历史授权 live canary 脱敏 evidence 曾观察到 message reply capability 为 `mapped_to_webui_bridge`；这不代表 file/run/artifact、真实云 runtime 或 Langfuse 已上线，后续再次执行必须重新授权。

订阅：

- [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop)
- [spec:v22-saas-control-plane-user-experience-boundary](#spec-v22-saas-control-plane-user-experience-boundary)
- [spec:v22-portal-opl-connection-boundary](#spec-v22-portal-opl-connection-boundary)
- [spec:v22-portal-opl-context-backflow-boundary](#spec-v22-portal-opl-context-backflow-boundary)
- [spec:v22-real-opl-capability-canary-boundary](#spec-v22-real-opl-capability-canary-boundary)
- [spec:v22-real-opl-provider-message-canary-boundary](#spec-v22-real-opl-provider-message-canary-boundary)
- [spec:v22-upstream-opl-boundary](#spec-v22-upstream-opl-boundary)
- [spec:v22-opl-work-message-file-run-boundary](#spec-v22-opl-work-message-file-run-boundary)
- [spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary](#spec-v22-runtime-bridge-session-run-file-provider-keyref-boundary)
- [spec:v22-portal-files-billing-trace-boundary](#spec-v22-portal-files-billing-trace-boundary)
- [spec:v22-token-provider-boundary](#spec-v22-token-provider-boundary)
- [spec:v22-trace-metadata-boundary](#spec-v22-trace-metadata-boundary)
- [spec:v22-langfuse-observability-metadata-boundary](#spec-v22-langfuse-observability-metadata-boundary)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)

### Real OPL File Run Artifact Canary 合同包

适用于真实 OPL file upload 或 file intent、workspace-scoped fileRef、run intent、Runtime Agent gate、run state projection、artifact/output backflow、Portal workspace/session/run 查询、trace metadata、billing metadata handoff、Production Runtime Agent binding 和 Langfuse optional attachment boundary。该合同包是 Real OPL Capability Canary 的三级细分执行合同；默认合同 smoke 不修改 one-person-lab upstream、不读取 secret、不调用真实云 mutation、不部署 Langfuse、不实现 COS 真实账单结算。每个 step 必须有明确 gate，例如 `file_ref_not_observed`、`workspace_file_scope_missing`、`requires_runtime_agent`、`runtime_authorization_required`、`run_not_observed`、`artifact_not_observed`、`output_file_ref_not_observed`、`portal_projection_missing`、`trace_sink_not_configured`，不能用 200 假成功。Runtime Agent HTTP API proof 已证明 Portal -> Runtime Bridge -> Runtime Agent HTTP API -> fileRef/run/artifact -> Portal trace projection 闭环；该 proof 不进入默认 MVP suite，也不是 production deploy evidence。`tests/regression/opl/regression-test-v22-real-opl-file-run-artifact-gates.mjs` 是负向保护，证明真实 WebUI bridge profile 下未验证 file/run/artifact 能力会返回明确 gate 而不是 200 假成功。OPL 分支只传 `billingMetadataRef`、`usageMetadataRef` 或 `resourceBindingId`，真实 COS/云账单核对归云服务链路；OPL lane 不决定 `ownerRef`、`operationId` 或 K8s labels。

订阅：

- [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop)
- [spec:v22-saas-control-plane-user-experience-boundary](#spec-v22-saas-control-plane-user-experience-boundary)
- [spec:v22-portal-opl-connection-boundary](#spec-v22-portal-opl-connection-boundary)
- [spec:v22-portal-opl-context-backflow-boundary](#spec-v22-portal-opl-context-backflow-boundary)
- [spec:v22-real-opl-capability-canary-boundary](#spec-v22-real-opl-capability-canary-boundary)
- [spec:v22-real-opl-provider-message-canary-boundary](#spec-v22-real-opl-provider-message-canary-boundary)
- [spec:v22-real-opl-file-run-artifact-canary-boundary](#spec-v22-real-opl-file-run-artifact-canary-boundary)
- [spec:v22-upstream-opl-boundary](#spec-v22-upstream-opl-boundary)
- [spec:v22-opl-work-message-file-run-boundary](#spec-v22-opl-work-message-file-run-boundary)
- [spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary](#spec-v22-runtime-bridge-session-run-file-provider-keyref-boundary)
- [spec:v22-portal-files-billing-trace-boundary](#spec-v22-portal-files-billing-trace-boundary)
- [spec:v22-token-provider-boundary](#spec-v22-token-provider-boundary)
- [spec:v22-trace-metadata-boundary](#spec-v22-trace-metadata-boundary)
- [spec:v22-langfuse-observability-metadata-boundary](#spec-v22-langfuse-observability-metadata-boundary)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)

### Langfuse / Trace 合同包

适用于 Langfuse 观测附件、sanitized projection、Portal 会话轨迹、trace metadata 和非 canonical source 边界。

订阅：

- [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop)
- [spec:v22-saas-control-plane-user-experience-boundary](#spec-v22-saas-control-plane-user-experience-boundary)
- [spec:v22-langfuse-observability-metadata-boundary](#spec-v22-langfuse-observability-metadata-boundary)
- [spec:v22-trace-metadata-boundary](#spec-v22-trace-metadata-boundary)
- [spec:v22-portal-files-billing-trace-boundary](#spec-v22-portal-files-billing-trace-boundary)
- [../history/README.md](../history/README.md)

### Resource / Billing / Audit 合同包

适用于套餐、托管环境开通、资源绑定、预扣费、冻结金额、释放停止计费、审计状态。默认资源模型是平台统一 TKE 集群 + platform service node pool + Package C 为每个租户或工作台创建的 tenant node pool；普通用户仍购买专属计算资源/工作台能力，不购买节点池。

订阅：

- [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop)
- [spec:v22-saas-control-plane-user-experience-boundary](#spec-v22-saas-control-plane-user-experience-boundary)
- [spec:v22-managed-environment-open-boundary](#spec-v22-managed-environment-open-boundary)
- [spec:v22-resource-plan-boundary](#spec-v22-resource-plan-boundary)
- [spec:v22-pricing-snapshot-boundary](#spec-v22-pricing-snapshot-boundary)
- [spec:v22-tenant-resource-binding-boundary](#spec-v22-tenant-resource-binding-boundary)
- [spec:v22-billing-freeze-boundary](#spec-v22-billing-freeze-boundary)
- [spec:v22-release-stop-billing-audit-boundary](#spec-v22-release-stop-billing-audit-boundary)
- [../history/README.md](../history/README.md)

### Tencent Provider 合同包

适用于 readonly/tencent quote provider、dry-run/tencent resource plan provider、TKE bootstrap preflight、readonly/tencent inventory、authorized/tencent create/release boundary、mock adapter、套餐估算、quote snapshot、不会执行的资源创建计划、真实云只读盘点和后续真实腾讯云接入前的授权边界。阶段路线：`mock/snapshot -> readonly/tencent quote -> dry-run/tencent plan -> TKE bootstrap preflight when no TKE foundation exists -> readonly/tencent inventory -> authorized/tencent create/release -> authorized/tencent deploy -> canary / QA / status update`。Package C 负责计算/存储生命周期；Package D 不授权 Package C 的资源生命周期动作。

订阅：

- [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop)
- [spec:v22-saas-control-plane-user-experience-boundary](#spec-v22-saas-control-plane-user-experience-boundary)
- [spec:v22-managed-environment-open-boundary](#spec-v22-managed-environment-open-boundary)
- [spec:v22-tencent-readonly-quote-provider-boundary](#spec-v22-tencent-readonly-quote-provider-boundary)
- [spec:v22-tencent-dry-run-resource-plan-provider-boundary](#spec-v22-tencent-dry-run-resource-plan-provider-boundary)
- [spec:v22-production-cloud-topology-boundary](#spec-v22-production-cloud-topology-boundary)
- [spec:v22-tencent-readonly-inventory-boundary](#spec-v22-tencent-readonly-inventory-boundary)
- [spec:v22-cloud-onboarding-workflow-boundary](#spec-v22-cloud-onboarding-workflow-boundary)
- [spec:v22-authorized-tencent-create-release-boundary](#spec-v22-authorized-tencent-create-release-boundary)
- [spec:v22-authorized-tencent-create-release-implementation-boundary](#spec-v22-authorized-tencent-create-release-implementation-boundary)
- [spec:v22-authorized-tencent-create-release-execution-boundary](#spec-v22-authorized-tencent-create-release-execution-boundary)
- [spec:v22-authorized-tencent-deploy-execution-boundary](#spec-v22-authorized-tencent-deploy-execution-boundary)
- [spec:v22-pricing-snapshot-boundary](#spec-v22-pricing-snapshot-boundary)
- [spec:v22-resource-plan-boundary](#spec-v22-resource-plan-boundary)
- [../history/README.md](../history/README.md)

真实腾讯云 API、真实 SecretId/SecretKey、真实资源创建/释放、deploy、build/push、kubectl 和 live-test 必须另开 feat/* 并单独授权。

readonly inventory 的 official Tencent SDK wrapper 是 future authorized provider candidate；当前 trunk 默认路径仍是合同级、本地 smoke 和 fail-closed gate，`defaultExecutable=false`、`readsSecretNow=false`、`implementsRealCloudCallNow=false`。TC3 仅作为 diagnostic/reference，不能作为默认 readonly live 主路径或 create/release provider。新增官方 SDK 依赖必须另开 feat/* 或 cloud-lane candidate，并经 package diff 审查；不得把 cloud-lane evidence 写成 trunk 当前已生效事实。

Cloud resource isolation 不再保留旧 scoped aggregate wrapper。future-authorized cloud 边界必须以 `tests/future-authorized/cloud/*.mjs` active registered 原子 gate 表达，并由 `scripts/v22-test-classification.mjs` 的 `future-authorized` lane、`ownerSurface` 和 `lifecycleRole=future-authorized-boundary` 约束；任何旧 alias、compat-only wrapper 或只包装历史路径的 suite-wrapper 迁完 caller 后直接删除。该边界不替代 `node tests/contract/contract-test-v22-mvp-contract-suite.mjs`，也不读取 secret、不调用真实云、不 build/push/kubectl。

[spec:v22-tencent-tc3-diagnostic-cleanup-plan](#spec-v22-tencent-tc3-diagnostic-cleanup-plan) 是 TC3 diagnostic cleanup closeout。official SDK wrapper、official SDK dependencies、authorized readonly live redacted report 和 B closeout 已满足启动条件；runner 不支持 `tencent-tc3-readonly` 或 `--enable-real-fetch`，TC3 live bridge 不在 production path 或 future authorized default path。该 cleanup 不读 secret、不调用真实云、不改 official SDK implementation、不改 create/release；历史 TC3 只保留为 provenance / static diagnostic contract。

### Cleanup 合同包

适用于退役 `user_owned`、`resource-order`、旧 runner/provisioner、OpenCost/Langfuse 主叙事、旧 v19/v20/v21 路线。strict monolith cleanup 下，active repo 不保留旧 public shell、compat alias、旧测试、旧 deploy/adapters/infra 资产或旧脚本作为完成态；git history 已足够保存历史。

订阅：

- [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop)
- [spec:v22-saas-control-plane-user-experience-boundary](#spec-v22-saas-control-plane-user-experience-boundary)
- [../history/README.md](../history/README.md)
- [../active/README.md](../active/README.md)
- [../history/README.md](../history/README.md)
- `tests/health/health-check-v22-archive-smoke-contract-physical-retirement-gate.mjs`
- 与被退役路径相关的分支合同

cleanup 分支必须证明：退役后每个核心域只剩一个正式入口。
后续 feature leaf 碰到过时模块、接口、测试或兼容面时，必须同 leaf 清理退役，或拆出 cleanup leaf 后再继续。

## Absorbed Spec Leaves

### spec:v22-admin-ops-console-boundary

Former leaf id: `v22-admin-ops-console-boundary`
Former title: v22 Admin / Ops Console Boundary

这是 admin/ops console 合同，不实现 UI。

本合同定义 MedOPL v22 管理员/运维界面与普通用户工作台的边界。普通用户资源页不得恢复云控制台或运维语义。管理员/运维视角可以查看后台归因和异常，也可以执行已接入的本地 Portal 管理动作，但不能执行真实云控制台式操作。

## 定位

Admin / Ops Console 面向平台运维人员，用于查看租户、账号、工作空间、托管运行环境、运行任务、文件空间、费用估算、分账标签、审计事件和异常状态。

它不是普通用户工作台，也不是真实腾讯云控制台。普通用户继续只看到工作台资源、套餐、文件空间、费用估算、释放策略和审计状态。

## 管理员/运维可见能力

管理员/运维可见：

- 租户列表、账号状态、开通/禁用状态
- workspace 列表和归属
- 托管运行环境列表
- 每个租户/环境的套餐、CPU、内存、文件空间、并发、队列
- 当前运行中的 session/run/task
- 文件空间用量、7 天保护期占用
- 资源状态：计划中、准备中、可用、释放中、已释放、异常
- 费用估算、冻结金额、T+1 对账状态
- 分账标签：resourceBindingId、cloudOperationId、billingAttributionId、workspaceId、accountId、serverPlanId、tenantId、environmentId、runId；旧 resource-order 标识不得作为 tag 或兼容归属 alias
- 审计事件、异常、释放失败、账单异常
- 公告管理入口

这些能力用于隔离、归因、排障、对账、审计和运营。当前已接入的本地 Portal 管理动作只覆盖用户查看、Portal 本地账户充值、Portal 本地账本退款、用户启用/禁用、用户软删除和公告管理；它们不是真实云资源变更，也不是真实支付或真实扣费通道，不能替代真实扣费链路。

## 普通用户不可见能力

普通用户界面不可见：

- CVM / COS / K8s / TKE / 节点池 / kubeconfig
- 真实云资源 ID
- objectKey / storageKey / cosPrefix / storageBackend / signedUrl
- SecretId / SecretKey / token / raw API Key
- 真实腾讯云控制台式操作
- 直接删除节点池、直接释放云资源、直接改真实资源

普通用户界面必须继续使用产品语言：工作台资源、套餐、文件空间、费用估算、释放策略、审计状态。
普通用户界面不得展示 tenantId、resourceBindingId、retired resource-order identifiers、serverPlanId、runId、CVM、COS、K8s、TKE、节点池或真实云资源 ID。

## 分账标签边界

Admin / Ops Console 可以查看分账标签归因和异常：

- resourceBindingId
- cloudOperationId
- billingAttributionId
- accountId
- runId
- serverPlanId
- tenantId
- workspaceId
- environmentId
- retired resource-order identifiers forbidden

这些标签只属于后台、运维、计费和审计边界。普通用户不能被要求理解或配置这些标签。

## 操作边界

- 不读取 secret。
- 不调用真实云。
- 不做真实扣费。
- 不创建、绑定或释放真实资源。
- 不修改 deploy / .sentrux / adapters / upstream。
- 不改 Gateway / Runtime Bridge，除非后续分支明确授权。
- 不恢复 CVM / COS / K8s / TKE / 节点池等普通用户语义。
- raw API Key 只能进入后端密钥边界，不能作为 Portal 普通登录字段。
- launchToken/runtimeToken 不进入 URL、localStorage 或 sessionStorage。
- one-person-lab upstream 保持 clean，不修改源码，不 import 内部模块。

真实腾讯云控制台式操作、直接删除节点池、直接释放云资源、直接改真实资源，不属于本合同授权范围。后续如需要真实资源运维能力，必须另开 feat/* 并单独授权 secret、云 API、deploy 和 live-test。

## Contract Data

<!-- v22-admin-ops-console-contract:start -->
```json
{
  "contract": "v22_admin_ops_console_boundary",
  "version": 1,
  "scope": {
    "implementsUi": false,
    "callsRealCloud": false,
    "readsSecret": false,
    "realBillingMutation": false,
    "realResourceMutation": false,
    "localPortalAdminActionsEnabled": true,
    "localPortalAccountingActionsEnabled": true
  },
  "adminOpsVisibleCapabilities": [
    "租户列表",
    "账号状态",
    "开通/禁用状态",
    "workspace 列表和归属",
    "托管运行环境列表",
    "每个租户/环境的套餐",
    "CPU",
    "内存",
    "文件空间",
    "并发",
    "队列",
    "当前运行中的 session/run/task",
    "文件空间用量",
    "7 天保护期占用",
    "资源状态",
    "费用估算",
    "冻结金额",
    "T+1 对账状态",
    "分账标签",
    "审计事件",
    "异常",
    "释放失败",
    "账单异常",
    "公告管理入口"
  ],
  "resourceStates": [
    "计划中",
    "准备中",
    "可用",
    "释放中",
    "已释放",
    "异常"
  ],
  "costAllocationTags": [
    "resourceBindingId",
    "cloudOperationId",
    "billingAttributionId",
    "accountId",
    "runId",
    "serverPlanId",
    "tenantId",
    "workspaceId",
    "environmentId",
    "retiredResourceOrderIdentifiersForbidden"
  ],
  "beginnerUserInvisibleCapabilities": [
    "CVM",
    "COS",
    "K8s",
    "TKE",
    "节点池",
    "kubeconfig",
    "真实云资源 ID",
    "objectKey",
    "storageKey",
    "cosPrefix",
    "storageBackend",
    "signedUrl",
    "SecretId",
    "SecretKey",
    "token",
    "raw API Key",
    "真实腾讯云控制台式操作",
    "直接删除节点池",
    "直接释放云资源",
    "直接改真实资源"
  ],
  "beginnerSurface": {
    "mustShowOnlyProductLanguage": [
      "工作台资源",
      "套餐",
      "文件空间",
      "费用估算",
      "释放策略",
      "审计状态"
    ],
    "mustNotShow": [
      "tenantId",
      "resourceBindingId",
      "retired resource-order identifiers",
      "serverPlanId",
      "runId",
      "CVM",
      "COS",
      "K8s",
      "TKE",
      "节点池",
      "真实云资源 ID"
    ]
  },
  "beginnerSurfaceMustRemainProductLanguage": true,
  "accountAndTokenBoundary": {
    "rawApiKeyBackendOnly": true,
    "apiKeyPortalLoginField": false,
    "launchTokenInUrlOrStorage": false,
    "runtimeTokenInUrlOrStorage": false
  },
  "upstreamBoundary": {
    "cleanUpstream": true,
    "modifySource": false,
    "importInternalModules": false
  },
  "adminOpsCanInspectAttribution": true,
  "localPortalAdminActions": [
    "查看用户详情",
    "Portal 本地账户充值",
    "Portal 本地账本退款",
    "启用用户",
    "禁用用户",
    "软删除用户",
    "新建公告",
    "编辑公告",
    "发布公告",
    "下线公告",
    "置顶公告",
    "删除公告",
    "标记当前 billing ops 事实源中的本地账单运营项"
  ],
  "readonlyOrDisabledProductStates": [
    "/admin/ops",
    "真实账单审批",
    "高风险站点设置",
    "真实待处理事项审批",
    "真实云资源操作",
    "真实扣费"
  ],
  "adminOpsCanExecuteRealCloudConsoleOperation": false,
  "forbiddenPaths": [
    "deploy",
    ".sentrux",
    "adapters",
    "one-person-lab upstream",
    "Gateway",
    "Runtime Bridge"
  ],
  "deferredAuthorization": [
    "真实腾讯云 API",
    "真实 SecretId/SecretKey",
    "真实资源创建/释放",
    "真实扣费",
    "deploy",
    "build/push",
    "kubectl",
    "live-test",
    "Gateway / Runtime Bridge 改动"
  ]
}
```
<!-- v22-admin-ops-console-contract:end -->

## Non-goals

- 不实现 UI。
- 不写业务代码。
- 不读取 secret。
- 不调用真实云。
- 不做真实扣费。
- 不创建、绑定或释放真实资源。
- 不修改 deploy / .sentrux / adapters / upstream。
- 不改 Gateway / Runtime Bridge，除非合同明确后续授权。

### spec:v22-authorized-tencent-create-release-boundary

Former leaf id: `v22-authorized-tencent-create-release-boundary`
Former title: v22 Authorized Tencent Create/Release Boundary

本合同定义 v22 `authorized Tencent create/release` 的授权边界。它描述 MedOPL 后续在用户明确授权后，如何把工作台资源计划映射到腾讯云资源创建、释放、记账和审计。

本合同只定义授权边界，不执行真实创建或释放；当前不得读取 secret，不调用真实腾讯云 API，不创建、绑定、释放真实资源，不真实扣费。

## Product Model

用户购买和管理的是“工作台资源”，不是云资源控制台对象。用户购买的是计算资源套餐和工作台能力，不是节点、节点池或云控制台资源。

用户可见套餐必须使用产品语言：

- 基础套餐：2c / 4GB / 10GB 文件空间，默认 1 个任务并发。
- Pro 套餐：8c / 16GB / 100GB 文件空间，默认 2 个任务并发。
- 自定义规格：CPU、内存、文件空间和任务并发数。

工作台资源展示字段包括：套餐、计算资源、文件空间、任务并发、状态、预计费用、释放策略和审计状态。普通用户可以理解自己购买了多少计算和存储，但不得管理 CVM、COS、K8s、TKE、kubeconfig、bucket、object key、VPC 或安全组。

普通用户主语言优先使用：账号、工作空间、计算资源、文件空间、套餐、任务并发、余额、冻结金额。租户 / runtime / 运行环境 / environmentId 只能作为内部标签、对账标签或审计字段。

## Task Concurrency And Resource Reuse

一个工作空间可以绑定一组工作台资源。多个任务可以复用同一组计算资源。并发口径统一为任务并发，session 只是访问、运行或观测上下文，不是任务并发。

`runId` 是任务级成本标签，可为空。纯 API 对话、文件空间保留、计算资源 idle、7 天保护期存储和工作空间基础存储成本都可能没有单个 `runId`。无 `runId` 的成本必须在内部归属上完整绑定 `tenantId`、`workspaceId`、`resourceBindingId` 和 `environmentId`。

并发和队列必须作为套餐能力展示给用户：

- 基础套餐默认 1 个任务并发。
- Pro 套餐默认 2 个任务并发。
- 自定义规格按 CPU、内存、文件空间和任务并发数估算。
- 5 个必须写成任务并发，不是 session 并发。

超过并发上限的任务进入队列，用户看到“排队中 / 等待资源 / 运行中 / 已完成 / 失败”等产品状态，不看到 Kubernetes scheduler 或节点池细节。

## Internal Tencent Mapping

内部真实执行阶段可以把工作台资源映射到：

- unified TKE cluster。
- platform service node pool，仅承载 Portal、Gateway、Runtime Bridge、worker、trace、billing 和 system。
- tenant node pool，由 Package C 在租户或工作台开通时创建并绑定。
- namespace / quota。
- node pool class。
- COS 文件空间。
- COS prefix 是内部实现。
- 可选 CBS / CFS / pod ephemeral scratch，仅作为运行时内部实现，不作为用户购买的文件空间主叙事。

MVP 默认使用统一 TKE 集群，不默认为每个租户创建独立集群。多租户通过 tenant node pool、namespace、quota、labels、network policy、admission policy、taint、nodeSelector、toleration、resource binding 和资源标签隔离。`starter_2c4g_10gb`、`pro_8c16g_100gb` 和后续叠加计算都必须由 Package C 创建或绑定该租户/工作台自己的 tenant node pool；用户 A 和用户 B 不得共享同一个用户计算池。超过 compute allocation 的 workload 必须 fail-closed，不得自动扩容并由平台垫付，也不得借用其他用户 allocation。

计算升级必须先完成 Portal 套餐变更、冻结金额或余额校验、cloud operation 和审计记录，然后 Package C 才能更新 compute allocation、ResourceQuota / LimitRange / admission policy，并调整对应 tenant node pool desired capacity 或绑定更高 workload class。普通用户仍看到“计算资源 / 套餐 / 任务并发 / 状态”，不是节点池。

“加计算”必须明确为以下一种或多种授权动作，不能隐式推断：

- 提高 workspace namespace quota。
- 调整已授权 node pool desired capacity。
- 绑定更高 workload class。
- 追加已审查的计算资源绑定记录。

任何 TKE node pool 扩缩容、namespace/quota 变更或 kubectl/deploy 动作都是真实副作用，必须单独授权并串行执行。

## Create/Release State Machine

授权创建和释放必须使用稳定状态机：

计划中 -> 待授权 -> 准备中 -> 可用 -> 释放中 -> 已释放

失败态：

- 准备失败待处理。
- 释放失败待审计。

进入真实创建前必须满足：

- 用户明确授权。
- 余额、冻结金额或 quota 满足本次计划。
- `resourceBindingId`、`cloudOperationId`、`billingAttributionId`、`environmentId`、`accountId`、`tenantId`、`workspaceId` 和 `serverPlanId` 已确定；旧 resource-order 标识不得作为 v22 fixed required tag、optional tag 或兼容归属 alias。
- readonly quote 和 dry-run plan 已生成。
- secret boundary 已授权，且 SecretId / SecretKey / kubeconfig 只进入后端 secret boundary。
- billing tags 完整。

缺少任一条件必须阻断真实创建，不能使用默认值、隐式兜底或历史任务推断。

## Billing Tags

所有真实腾讯云资源必须带 MedOPL 分账标签。当前 T+1 账单标签集合为：

```json
{
  "resourceBindingId": "resource binding id",
  "cloudOperationId": "cloud operation id",
  "billingAttributionId": "billing attribution id",
  "workspaceId": "workspace id",
  "accountId": "account id",
  "serverPlanId": "starter_2c4g_10gb or pro_8c16g_100gb or custom",
  "tenantId": "tenant id",
  "runId": "run id or null",
  "environmentId": "environment id"
}
```

`runId` 可以为空，但 `accountId`、`workspaceId`、`resourceBindingId`、`cloudOperationId`、`billingAttributionId`、`serverPlanId` 和 `environmentId` 不得为空。标签缺失、标签与 resource binding 不一致、或资源无法归属到 account/workspace 时，真实 create path 必须阻断或进入审计失败。

T+1 账单用于对账和审计，不作为实时扣费来源。Portal 实时展示仍以费用估算、余额、冻结金额和预计消耗为准。T+1 结果只能用于账单校准、异常审计、补扣或退还依据。

## Authorized Plan Shape

后续授权执行前，Portal / 运维审计可以消费的计划对象必须保持业务字段边界：

```json
{
  "workspaceResource": {
    "planName": "Pro 套餐",
    "cpuCores": 8,
    "memoryGb": 16,
    "fileSpaceGb": 100,
    "concurrency": 2
  },
  "createReleaseState": "待授权",
  "billingTags": {
    "resourceBindingId": "resource binding id",
    "cloudOperationId": "cloud operation id",
    "billingAttributionId": "billing attribution id",
    "workspaceId": "workspace id",
    "accountId": "account id",
    "serverPlanId": "pro_8c16g_100gb",
    "tenantId": "tenant id",
    "runId": null,
    "environmentId": "environment id"
  },
  "fileSpacePolicy": {
    "storageModel": "workspace 文件空间",
    "retentionDays": 7,
    "ordinaryDeleteRequiresConfirmation": false,
    "permanentDeleteRequiresConfirmation": true
  }
}
```

该对象不得包含真实云资源 ID、CVM 实例、COS bucket、TKE 集群、kubeconfig、objectKey、signedUrl 或 secret。

## Portal Canonical Store

Portal canonical truth 存在 PostgreSQL，不存在 COS、CBS、Redis 或云标签中。真实 create/release 前必须能写入并审计以下业务记录：

- workspace。
- resource binding。
- file space entitlement。
- compute allocation。
- cloud operation。
- cloud resource projection。
- wallet ledger / freeze。
- billing reconciliation。
- audit event。
- provider secret reference。

当前生产必需数据面是 PostgreSQL-only required data plane。queue、lock、session、job state 和短期协调优先由 PostgreSQL-backed 表、状态机、事务锁和运行时内存边界承接；Redis 不属于必需拓扑，不得作为上线前置。若后续 runtime evidence 证明需要更高吞吐的 volatile accelerator，必须另开独立 leaf 并证明 Redis 仍不持有 canonical truth。COS 只保存文件对象。CBS 只作为 TKE 节点盘或必要持久卷。腾讯云 tag / cost allocation 只作为云侧对账证据。

Portal 点击“开通工作台资源”时，必须先写 cloud operation 和审计事件，再进入 dry-run diff 和真实执行授权。真实执行结果必须回写 cloud operation state，不能只靠云侧状态代表 Portal truth。

## File Space Contract

工作空间、计算资源和文件空间生命周期分离。

- 工作空间是业务容器。
- 计算资源可独立开通、扩容、缩容、释放。
- 存储资源 / 文件空间可独立开通、扩容、删除。
- 释放计算资源不删除文件空间。
- 释放计算资源不让文件空间进入 7 天保护期。
- 删除存储资源 / 文件空间，或独立欠费保留策略，才进入 7 天保护期。
- 计算资源已释放但文件空间仍保留，是合法状态。

计算资源释放后，文件空间可以继续保留。文件空间属于 workspace，不属于单个 run；输出文件可以带 `runId`，但仍进入 workspace 文件空间。

Portal 文件空间必须支持：

- 创建文件夹。
- 重命名文件夹。
- 删除文件夹。
- 上传文件到指定文件夹。
- 移动文件或文件夹。
- 选择文件作为 OPL 对话或任务输入。
- 批量下载。
- 批量删除。
- 查看输入文件和输出文件来源。

内部可以用 COS prefix 表达文件夹；普通用户 payload 不得暴露 COS bucket、objectKey、storageKey、localPath、signedUrl 或 provider 内部存储字段。

## Delete And Retention Policy

普通删除不需要二次确认。删除后文件进入 7 天保护期，Portal 必须提示：

- 删除后 7 天内可恢复或联系平台处理。
- 7 天后自动清理，不可恢复。
- 保护期内文件仍可能占用文件空间容量或产生存储费用。

永久删除或清空文件空间需要二次确认。永久删除和清空属于高风险操作，必须写入审计记录。

删除和清理是异步动作。Portal 可以展示“待清理 / 清理中 / 已删除 / 清理失败待审计”，不得承诺秒级物理删除。

## Release Semantics

释放计算资源不等于删除文件空间。

释放流程必须：

1. 检查是否存在运行中任务。
2. 如有运行中任务，提示先停止任务或等待任务结束。
3. 停止新任务使用该计算资源。
4. 释放计算资源。
5. 停止计算计费。
6. 文件空间保持原存储状态；仅当独立存储删除或欠费保留策略触发时，才进入保护或清理流程。
7. 写入 T+1 对账和审计记录。

释放失败必须进入“释放失败待审计”，并保留 resourceBindingId、environmentId、billing tags、失败原因和人工处理入口。

## Secret Boundary

SecretId / SecretKey / kubeconfig 只进入后端 secret boundary。不得进入：

- Portal payload。
- 前端状态。
- URL。
- 日志。
- evidence。
- git。
- GitHub。
- one-person-lab upstream。

真实执行必须另开 feat/* 并单独授权。授权必须明确允许读取哪个 secret 边界、调用哪些腾讯云 API、创建或释放哪些资源、验证范围是什么。

## Forbidden User-Facing Language

普通用户主界面不得把 CVM、COS、K8s、TKE、Kubernetes、节点池、kubeconfig、bucket、object key、VPC 或安全组作为主要操作语言。

允许的用户语言包括：工作台资源、计算资源、计算规格、文件空间、文件夹、输入文件、输出文件、预计费用、余额、冻结金额、任务并发、队列、释放策略、保护期、审计状态。

## Non-Goals

- 不读取真实 SecretId、SecretKey、kubeconfig、token、SSH private key 或 `.env`。
- 不调用真实腾讯云、COS、Langfuse、one-person-lab 或外部生产 API。
- 不创建、绑定、释放真实资源。
- 不真实扣费。
- 不运行 build/push/kubectl/live-test。
- 不修改 deploy、`.sentrux`、adapters 或 upstream。
- 不改变 Portal 已有 mock/snapshot、readonly quote 和 dry-run plan 实现。

### spec:v22-authorized-tencent-create-release-execution-boundary

Former leaf id: `v22-authorized-tencent-create-release-execution-boundary`
Former title: v22 Authorized Tencent Create/Release Execution Boundary

本合同收敛 v22 authorized Tencent create/release execution 的可实现、可测试、可上线边界。它承接 `spec:v22-authorized-tencent-create-release-boundary`、`spec:v22-authorized-tencent-create-release-implementation-boundary` 和 `spec:v22-tencent-readonly-inventory-boundary`。

本分支只写合同和 smoke，不实现真实 create/release，不调用真实云，不读取 secret，不真实扣费。

## Execution Scope

authorized create/release execution 只在后续单独授权的 feat/* 分支实现。本合同只定义执行前必须满足的 gate、secret、标签、费用、回滚、审计和用户展示规则。

本合同不得恢复旧 `user_owned` / `resource-order` 主叙事。用户购买和管理的是工作台资源、计算资源和文件空间，不是云控制台对象。

本合同属于 authorized cloud connection loop 的资源生命周期段。旧 CO-01..CO-14 阶段状态机不再作为本合同的执行入口。

## Readonly 与 Mutation 分离

readonly inventory 与 authorized create/release 必须分离：

- readonly 只允许 Describe/List/Get/Head。
- readonly 使用 `RUN_TENCENT_READONLY_INVENTORY`。
- readonly secret 只允许 readonly inventory allowlist。
- create/release 使用独立 RUN gate：`RUN_TENCENT_CREATE_RELEASE_EXECUTION`。
- create/release 使用独立 mutation secret allowlist。
- create/release 使用独立 runner/bridge。
- create/release 不得复用 `RUN_TENCENT_READONLY_INVENTORY`。
- create/release 不得复用 `TENCENT_READONLY_SECRET_ID`。
- create/release 不得复用 `TENCENT_READONLY_SECRET_KEY`。

明确禁止：不得复用 RUN_TENCENT_READONLY_INVENTORY、不得复用 TENCENT_READONLY_SECRET_ID、不得复用 TENCENT_READONLY_SECRET_KEY。

readonly inventory 通过只能作为后续 mutation 授权评估证据，不能自动创建、删除、释放、扩缩容、改标签或扣费。

## Mutation Secret Allowlist

后续真实 execution 只能 allowlist 读取 mutation 所需 key，不允许一读全读，不允许 source env，不允许把整份 secret 注入 `process.env`。

mutation secret allowlist 必须独立于 readonly secret allowlist：

- `RUN_TENCENT_CREATE_RELEASE_EXECUTION`
- `TENCENT_MUTATION_SECRET_ID`
- `TENCENT_MUTATION_SECRET_KEY`
- `TENCENT_MUTATION_ALLOWED_APIS`
- `TENCENT_MUTATION_REGIONS`
- `TENCENT_MUTATION_ACCOUNT_ID`
- `TENCENT_MUTATION_DAILY_BUDGET_CNY`
- `TENCENT_MUTATION_MAX_OPERATION_COUNT`
- `TENCENT_MUTATION_TKE_CLUSTER_ID`
- `TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID`
- `TENCENT_MUTATION_COS_BUCKET`
- `TENCENT_MUTATION_COS_REGION`
- `TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT`

mutation secret 不得进入 Portal payload、前端状态、URL、日志、evidence、git、GitHub、one-person-lab upstream 或普通用户可见界面。

## Package C Live Canary Non-Secret Cloud Parameters

Package C live canary readiness 需要独立的 non-secret cloud parameters JSON 输入；worker subnet、安全组、实例规格、系统盘、计费模式、public IP、AZ、镜像/runtime 和登录策略不得写入 `package-c-mutation.env`，也不得进入 mutation secret allowlist。

当前 prepare-only input contract 固定：

- cluster：`cls-fi097sy4`
- protected platform node pool：`np-cbk784r8`
- worker subnet：`subnet-a1fldajw`
- security group：`sg-6671l5we`
- tenant node pool prefix：`medopl-tenant-`
- public IP：disabled
- `RUN_TENCENT_CREATE_RELEASE_EXECUTION`：`0`

readiness runner 只校验 schema、固定值、redaction 和 evidence sink，输出 `.runtime` readiness evidence、redacted `CreateNodePool` request 和 authorization pack；它不执行 `CreateNodePool`、`ScaleNodePool`、`DeleteNodePool`，不调用 Tencent mutation，不读取 kubeconfig，不执行 kubectl、deploy、build/push 或 Package D。

## 资源生命周期分离

工作空间、计算资源和文件空间生命周期必须分离：

- 工作空间是业务容器。
- 计算资源可独立开通/扩缩/释放。
- 文件空间可独立开通/扩容/删除。
- 释放计算资源不删除文件空间。
- 释放计算资源不触发 7 天保护期。
- 删除文件空间/存储资源才进入 7 天保护期。
- 计算资源已释放但文件空间仍保留，是合法状态。

文件空间属于工作空间，不属于单个 run。输出文件可以带 `runId`，但仍归属工作空间文件空间。

## Existing TKE Cluster Execution Model

MVP compute execution 默认使用已有 TKE 集群，不默认创建新集群。

每个租户或工作台必须拥有由 MedOPL 创建并绑定的 tenant node pool。Package C 必须先创建 tenant node pool，再写 compute allocation、namespace、quota、labels、network policy 和 admission policy。平台服务池只承载平台服务，不承载租户 workload。超过 allocation 的 workload 必须 fail-closed，回到 Portal 套餐升级、余额/冻结校验、cloud operation 和审计链路。

TKE 节点池必须先分型再 mutation。Package C 创建 tenant node pool 时必须使用匹配节点池形态的腾讯云 API：普通节点池可通过 TKE `2018-05-25` 的 `DescribeClusterNodePools` 观察，原生节点池通过 TKE `2022-05-01` 的 `DescribeNodePools` / `CreateNodePool` / `ScaleNodePool` / `DeleteNodePool` 管理。授权计算开通和释放默认映射为 tenant node pool create/release、compute allocation、namespace quota、workload class 和 admission policy 的状态变化。`DescribeNodePools` 返回 `Native` 时，不得用旧 `ModifyNodePoolDesiredCapacityAboutAsg` 判定 tenant node pool 不存在。

计算资源生命周期映射为：

- create compute：创建 tenant node pool，创建或更新 namespace、quota、labels、network policy、workload class 绑定和 compute allocation。
- expand compute：提高 namespace quota、调整对应 tenant node pool desired capacity，或绑定更高 workload class。
- release compute：停止新任务、解除 compute allocation、释放或删除对应 tenant node pool，停止计算计费。

release compute 不删除文件空间，不触发文件空间 7 天保护期。

node pool 扩缩容、namespace/quota 变更、kubectl、deploy 都必须由用户在当前会话明确授权，并且必须有 dry-run diff、预算上限和回滚策略。

Portal 后台必须能通过 PostgreSQL canonical `compute_allocation` 追踪每个用户 / 工作空间 / `resourceBindingId` 绑定到哪个 tenant node pool：`nodePoolRef` 是后台审计字段，不是普通用户产品概念，但它必须指向该租户或工作台的专属运行池。同一个 tenant node pool 不得承载无关用户的计算分配；普通用户只看到“计算资源 / 套餐 / 任务并发 / 状态”，管理员和审计路径可以查看脱敏 `nodePoolRef`、`clusterRef`、`namespaceRef`、quota 和 workload class。

tenant node pool 只能绑定到一个 resourceBindingId 或一个明确的租户/账号组。tenant pool 必须使用 taint / label / nodeSelector / toleration 防止平台服务和其他用户调度进入。平台服务不得依赖 tenant 用户池，其他用户 workload 也不得通过共享 toleration 进入该 tenant pool。

当前承载 Portal/OPL/trace/billing/system 的 platform service node pool 不得缩到 0。replicas_0_1_0 只允许用于 tenant node pool 的闭环 canary；它不能作为平台服务节点池的默认 cleanup 或 release compute 语义。

## Portal Operation Truth

真实 execution 前，Portal 必须先写 PostgreSQL canonical operation。至少需要以下记录类型：

- cloud operation：operationId、operationType、requestedBy、workspaceId、resourceBindingId、status、requestedSpec、dryRunDiffRef、authorizationRef。
- compute allocation：workspaceId、resourceBindingId、clusterRef、namespaceRef、nodePoolRef、quota、workloadClass、status。
- file space entitlement：workspaceId、resourceBindingId、capacityGb、retentionState、status。
- cloud resource projection：只保存脱敏资源摘要和绑定标签，不保存 raw cloud object。
- wallet ledger / freeze：预估冻结金额、状态、核对窗口。
- billing reconciliation：billingReadRef、reconciliationStatus、auditQueueRef。
- audit event：actor、operationId、before/after summary、decision、reason。

这些记录是 Portal truth。云标签和账单只作为 reconciliation evidence。

## 用户删除语义

用户发起删除时必须按资源类型解释：

- 删除计算资源：释放计算资源，停止相关新任务/运行，不删除文件空间。
- 删除文件空间：进入 7 天保护期，期满清理文件。
- 冻结金额用尽：停止计算资源和新任务；文件空间进入 7 天保护期或欠费保护流程。

Portal 不得把“删除计算资源”写成“删除文件空间”。Portal 不得把“冻结金额用尽”自动写成“立即清空文件”。

## 归属校验和标签

create 时必须生成并写入以下标签：

- `accountId`
- `workspaceId`
- `resourceBindingId`
- `cloudOperationId`
- `billingAttributionId`
- `serverPlanId`
- `resourceType`
- `region`
- 旧 resource-order 标识不得作为 tag 或兼容归属 alias

如存在任务级成本归因，`runId` 可以作为附加标签；无 runId 成本仍必须能通过账号、工作空间、资源绑定、套餐和区域归属。

release 时必须同时匹配 Portal ledger 和云资源标签。不能只靠资源名称、创建时间、IP、规格或历史任务推断归属。

标签、Portal `resourceBindingId`、compute allocation 和后台 `nodePoolRef` 缺失、冲突、归属不一致时 fail-closed，进入 admin 审计队列。审计队列必须保留安全证据、候选 ledger、候选标签摘要、处理状态和重试策略，不得暴露 secret 或 provider raw response。

## 默认风控和 Portal 配置

以下默认值是风控上限，不是默认开通规格：

- maxCpuCoresPerWorkspace: 16
- maxMemoryGbPerWorkspace: 32
- maxFileSpaceGbPerWorkspace: 500
- maxConcurrentTasksPerWorkspace: 5
- maxQueuedTasksPerWorkspace: 20
- balanceWarningThresholdCny: 20
- dailySpendAlertCny: 300
- dailyHardCapCny: null
- failedOperationRetryLimit: 2
- maxCreateReleaseOperationsPerDay: 10

Portal 管理员可按账号/账号组修改 override。Portal 必须展示 effective limits，并记录审计记录：修改人、目标账号、目标账号组、修改前值、修改后值、生效时间、原因和审批状态。

默认日预算只提醒，不默认硬停；管理员可以对指定账号开启 hard cap。

## 费用保护和对账

真实 create 前必须计算预估冻结金额。冻结金额展示给用户，并进入 Portal ledger。

费用保护必须覆盖：

- create 前计算预估冻结金额。
- 冻结金额展示给用户。
- 余额低于 20 元提醒。
- 120 分钟扣费核对。
- T+1 COS 对账。
- T+1 腾讯云账单和 Portal ledger 对不上时进入 admin 审计队列。

普通用户中文状态包括：

- 待对账。
- 对账异常。
- 运维处理中。
- 已补扣。
- 已退还。

T+1 异常不得静默补扣或退款，必须进入审计流程后处理。

## 失败回滚

create 分阶段执行：

预校验 -> 创建资源 -> 打标签 -> 写 ledger -> 开通可用

如果创建资源后标签或 ledger 写入失败，必须进入回滚/冻结状态，禁止对用户显示为可用。

rollback 失败进入 admin 审计队列，并冻结继续开通。超过 `failedOperationRetryLimit: 2` 或 `maxCreateReleaseOperationsPerDay: 10` 后必须人工审计，不得无限重试。

release 分阶段执行：

预校验 -> 停止新任务 -> 校验 Portal ledger + 云标签 -> 释放计算资源或删除文件空间 -> 写 ledger -> 进入对账

释放计算资源失败进入“释放失败待审计”。删除文件空间失败进入“清理失败待审计”，不得承诺秒级物理删除。

## 用户可见状态和语言

普通用户可见中文状态包括：

- 开通中。
- 可用。
- 开通失败待处理。
- 释放中。
- 已释放。
- 文件保护期。
- 余额不足。
- 对账中。
- 对账异常。

普通用户不展示 CVM/TKE/COS/K8s/nodePool、云资源清单、服务器编号、Secret/token/objectKey 等底层词。普通用户主语言必须是账号、工作空间、计算资源、文件空间、套餐、任务并发、余额、冻结金额、保护期和审计状态。

管理员/运维可以看到必要后台归因标签、审计状态和异常摘要，但 secret、raw response、objectKey、storageKey、cosPrefix、signedUrl、kubeconfig 仍不可见。

管理员/运维可见的后台归因可以包括脱敏 `nodePoolRef`，用于判断用户计算分配属于哪个授权资源池。普通用户可见 projection、API response、Portal 页面和 OPL session 不得出现 `nodePoolRef`、nodePool、TKE、Kubernetes 或云控制台语言。

## Non-Goals

- 不真实 create/delete/modify/release。
- 不读取 mutation secret。
- 不调用真实腾讯云。
- 不真实扣费。
- 不运行 build/push/kubectl/live-test。
- 不改 deploy/.sentrux/adapters/upstream/Gateway/Runtime Bridge。
- 不把 user_owned/resource-order 旧叙事恢复为主线。
- 不恢复旧云控制台叙事。
- 不把普通用户页面写成 CVM/COS/K8s/TKE 控制台。

## Contract Data

<!-- v22-authorized-tencent-create-release-execution-contract:start -->
```json
{
  "contract": "v22_authorized_tencent_create_release_execution_boundary",
  "version": 1,
  "implementsRealCloudCall": false,
  "currentBranchOnlyContractsAndSmoke": true,
  "readsMutationSecretNow": false,
  "callsRealTencentCloudNow": false,
  "executesRealCreateReleaseNow": false,
  "readonlyRunGate": "RUN_TENCENT_READONLY_INVENTORY",
  "mutationRunGate": "RUN_TENCENT_CREATE_RELEASE_EXECUTION",
  "readonlyAndMutationGatesSeparated": true,
  "workflowModel": "authorized_cloud_connection_loop",
  "oldCoPhaseStateMachineRetired": true,
  "readonlyAllowedApiVerbs": [
    "Describe",
    "List",
    "Get",
    "Head"
  ],
  "mutationSecretAllowlist": [
    "RUN_TENCENT_CREATE_RELEASE_EXECUTION",
    "TENCENT_MUTATION_SECRET_ID",
    "TENCENT_MUTATION_SECRET_KEY",
    "TENCENT_MUTATION_ALLOWED_APIS",
    "TENCENT_MUTATION_REGIONS",
    "TENCENT_MUTATION_ACCOUNT_ID",
    "TENCENT_MUTATION_DAILY_BUDGET_CNY",
    "TENCENT_MUTATION_MAX_OPERATION_COUNT",
    "TENCENT_MUTATION_TKE_CLUSTER_ID",
    "TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID",
    "TENCENT_MUTATION_COS_BUCKET",
    "TENCENT_MUTATION_COS_REGION",
    "TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT"
  ],
  "forbiddenReuseOfReadonlySecrets": [
    "RUN_TENCENT_READONLY_INVENTORY",
    "TENCENT_READONLY_SECRET_ID",
    "TENCENT_READONLY_SECRET_KEY"
  ],
  "resourceLifecycle": {
    "workspaceIsBusinessContainer": true,
    "computeCanOpenScaleReleaseIndependently": true,
    "fileSpaceCanOpenExpandDeleteIndependently": true,
    "computeReleaseDeletesFileSpace": false,
    "computeReleaseTriggersRetention": false,
    "storageDeleteTriggersRetentionDays": 7,
    "computeReleasedWithFileSpaceRetainedIsValid": true,
    "usesExistingTkeClusterByDefault": true,
    "tenantNodePoolRequiredPerWorkspace": true,
    "computeCreateUsesTenantNodePoolNamespaceQuotaWorkloadClass": true,
    "computeExpandMayAdjustTenantNodePoolCapacity": true,
    "tkeNodePoolShapeMustBeDetectedBeforeMutation": true,
    "nativeNodePoolReadApi": "DescribeNodePools",
    "nativeNodePoolMutationApi": "ScaleNodePool",
    "nativeNodePoolCreateApi": "CreateNodePool",
    "nativeNodePoolDeleteApi": "DeleteNodePool",
    "nativeNodePoolCanaryLoop": "replicas_0_1_0_only_for_tenant_node_pool",
    "standardPlansUseSharedUserComputePool": false,
    "sharedUserComputePoolSupported": false,
    "standardPlansRequireNamespaceQuota": true,
    "overAllocationMustFailClosed": true,
    "platformServicePoolProtected": true,
    "packageCCreatesTenantNodePool": true,
    "packageCReleasesTenantNodePool": true,
    "singleMutationNodePoolEnvForbidden": true
  },
  "portalCanonicalTruth": {
    "store": "PostgreSQL",
    "redisIsTruth": false,
    "cosIsTruth": false,
    "cloudTagsAreReconciliationEvidence": true,
    "requiredRecords": [
      "cloud operation",
      "compute allocation",
      "file space entitlement",
      "cloud resource projection",
      "wallet ledger / freeze",
      "billing reconciliation",
      "audit event"
    ]
  },
  "ownership": {
    "createWritesTags": [
      "accountId",
      "workspaceId",
      "resourceBindingId",
      "cloudOperationId",
      "billingAttributionId",
      "serverPlanId",
      "resourceType",
      "region",
      "retiredResourceOrderIdentifiersForbidden"
    ],
    "portalLedgerAndCloudTagsRequiredForRelease": true,
    "failClosedOnMissingOrConflictingOwnership": true,
    "adminAuditQueueOnOwnershipFailure": true
  },
  "defaultRiskLimits": {
    "maxCpuCoresPerWorkspace": 16,
    "maxMemoryGbPerWorkspace": 32,
    "maxFileSpaceGbPerWorkspace": 500,
    "maxConcurrentTasksPerWorkspace": 5,
    "maxQueuedTasksPerWorkspace": 20,
    "balanceWarningThresholdCny": 20,
    "dailySpendAlertCny": 300,
    "dailyHardCapCny": null,
    "failedOperationRetryLimit": 2,
    "maxCreateReleaseOperationsPerDay": 10,
    "portalAccountOrAccountGroupOverrideAllowed": true,
    "effectiveLimitsVisible": true,
    "auditRecordRequired": true
  },
  "billingProtection": {
    "requiresEstimatedFreezeBeforeCreate": true,
    "freezeAmountUserVisible": true,
    "t120ChargeCheckRequired": true,
    "tPlusOneCosReconciliationRequired": true,
    "reconciliationExceptionUserStatuses": [
      "待对账",
      "对账异常",
      "运维处理中",
      "已补扣",
      "已退还"
    ]
  },
  "rollback": {
    "createPhases": [
      "预校验",
      "创建资源",
      "打标签",
      "写 ledger",
      "开通可用"
    ],
    "resourceCreatedButTagOrLedgerFailedMustNotBeUserAvailable": true,
    "rollbackFailureGoesToAdminAuditQueue": true,
    "freezeFurtherOpenOnRollbackFailure": true
  },
  "userVisibleStatuses": [
    "开通中",
    "可用",
    "开通失败待处理",
    "释放中",
    "已释放",
    "文件保护期",
    "余额不足",
    "对账中",
    "对账异常"
  ],
  "nonGoals": {
    "doesNotReadMutationSecret": true,
    "doesNotCallRealTencentCloud": true,
    "doesNotCreateDeleteModifyRelease": true,
    "doesNotModifyDeploySentruxAdaptersUpstreamGatewayRuntimeBridge": true,
    "doesNotRestoreLegacyUserOwnedResourceOrderNarrative": true
  }
}
```
<!-- v22-authorized-tencent-create-release-execution-contract:end -->

### spec:v22-go-control-plane-mvp-takeover-boundary

Former leaf id: `v22-backend-go-convergence-program-boundary`
Former title: v22 Backend Go Convergence Program Boundary

本合同定义 MedOPL v22 当前 Go control-plane MVP takeover 边界。用户已选择把上云时间后推，先让 `services/medopl-go-backend` 接管本地 control-plane MVP，再开启 `real-cloud-readiness`。该 takeover 不保留 Node/Go 长期双控制面，不把 Node Portal backend 写成第二控制面，也不把 local proof 写成 production truth。

Canonical backend boundary：

- `services/medopl-go-backend` 是本地 MVP takeover target；它必须承接 Portal Control Plane、Workflow Boundary、Runtime Broker / OPL Bridge、Agent Runtime coordination boundary 和 Cloud / Billing / Audit Workers 的本地 control-plane API truth。
- `services/portal/frontend` 是现代前后端分离下的 repo-native frontend package；它只能通过 typed API 读取 Go-owned projection，不持有 package、provider key、launch、billing、audit、resource 或 release truth。
- `services/portal/src` 已物理清退；它不是 active backend、shell、facade、relay 或 compatibility control plane，不得继续承载 long task orchestration、cloud mutation、billing mutation、audit reconciliation 或 runtime launch truth。
- 真实云、secret、provider operation、deploy、kubectl、build/push 和 live-test 均推迟到 Go local RC 之后的独立 authorization/readiness package。

必须先 Go control-plane MVP，再 real-cloud-readiness。当前 program 只能声明 local MVP takeover target 和本地 deterministic eval；不能声明 production backend replacement、真实云 readiness、真实 provider capability、真实账单 reconciliation 或 deploy 完成。

后端职责边界：

- Portal Control Plane 处理用户、workspace、套餐、订阅、entitlement、文件列表、run request、账单 / 审计查询和状态展示。
- Workflow Boundary 承接长任务 command/state；durable engine 只能在 facade 后替换。
- Runtime Broker / OPL Bridge 只适配 clean upstream OPL、Runtime Bridge / Runtime Agent 和 anti-corruption mapping。
- Cloud / Billing / Audit Workers 是内部 worker 边界，负责资源计划、账单事件、审计事件和 reconciliation；普通用户不能把它们理解成云控制台。

数据和安全边界：

- raw provider key、bearer token、launchToken、runtimeToken、objectKey、localPath、signedUrl 不得进入前端持久化、普通用户 payload、日志、evidence 或 git。
- local memory store 只能证明 local MVP shape；PostgreSQL-only production data layer 需要后续 eval 明确接管。
- Node Portal backend retirement 必须按 inventory / migration map / eval 推进，不允许 ad hoc 删除导致黄金链路断裂。

验收边界：

- program 必须由 `tests/contract/contract-test-v22-backend-go-convergence-program.mjs` 验证。
- Go service surface 必须由 `tests/contract/contract-test-v22-go-backend-service-surface.mjs` 和 `bash -lc "cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./..."` 验证。
- frontend/backend split 必须由 `npm --prefix services/portal/frontend run typecheck` 和 Portal typed API regression 验证。
- branch override 必须只允许本 program 的 docs/specs/changes/tests/scripts、Portal frontend、Portal retirement surface 和 Go service surface。

### spec:v22-precloud-deployable-rc-boundary

Former leaf id: `precloud-deployable-rc`
Former title: Pre-cloud Deployable RC Boundary

本合同定义 MedOPL v22 上云前的本地可部署边界。目标是让 OPL Workbench、Portal frontend、Go SaaS backend 和 cloud connector fail-closed API 通过本地 deterministic eval 闭合；它不是 real-cloud readiness，也不授权 secret、provider、cloud、deploy、kubectl、build/push 或 live-test。

Canonical deployment boundary：

- `services/portal/frontend` 是 Portal frontend deployment surface；Vite dev proxy 和 typed API modules 必须默认走 Go `/api`。
- `services/medopl-go-backend` 是 pre-cloud SaaS backend deployment surface；它必须提供 `/healthz`、`/readyz`、Portal projection API、provider/preflight/launch、file/run/artifact、billing/audit/resource/release 和 cloud connector fail-closed API。
- `services/portal/src` 已物理清退，不得作为 deployable backend、frontend proxy target、typed API owner 或 current verification owner；后续只允许被 negative physical-removal gate 或 history 引用。
- Cloud connector 在 real-cloud authorization package 打开前必须返回 `authorization_required` / `fail_closed`，不得创建 plan 副作用或访问真实 provider。

验收边界：

- package gate：`node tests/contract/contract-test-v22-precloud-deployable-rc.mjs`
- Go backend：`bash -lc "cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./..."`
- frontend：`npm --prefix services/portal/frontend run typecheck`
- repo verify：`node scripts/v22-verify.mjs current --branch feat/v22-precloud-deployable-rc --base origin/recovery/platform-v22-trunk --json`

### spec:v22-backend-go-convergence-program-boundary

Former leaf id: `v22-backend-go-convergence-program-boundary`
Former title: v22 Backend Go Convergence Program Boundary

本合同定义 MedOPL v22 后端收敛 program 的结构边界。该 program 的目标是把后端从当前 Node/ESM Portal-heavy 形态收敛为 Go canonical backend，同时保留 MedOPL 的产品真相：Portal 是 SaaS 控制面和托管交付平台，OPL 负责科研执行，Gateway / Runtime Bridge 负责 clean upstream 适配，Cloud / Billing / Audit workers 负责内部资源、计费和审计。

目标 Go 后端结构参考 `sub2api` 的 Go 工程形状，但不得照搬其业务语义。允许的目标结构是 `cmd/server`、`internal/config`、`internal/domain`、`internal/handler`、`internal/repository`、`internal/service`、`internal/server`、`internal/integration`、`internal/worker`、`ent/schema`、`migrations` 和 `resources`。MedOPL 领域必须以 workspace、run、file、artifact、billing、workflow、tenant、runtime broker、OPL bridge、cloud worker、audit worker 为中心。

Canonical backend boundary：

- `services/medopl-go-backend` 是未来 canonical backend target；它必须承接 SaaS control-plane API、workflow facade、repository、worker 和 integration interfaces。
- 当前 `services/portal` 是迁移前 active implementation。它可以继续服务现有本地闭环和用户可见 Portal API，但不得继续扩张长任务编排、cloud mutation、billing mutation、audit reconciliation 或 runtime launch truth。
- Node Portal 迁移期只能保留 thin route、contract-compatible DTO、read projection 和 command handoff；新长任务状态必须进入 workflow boundary，新云资源变更必须进入 internal worker boundary。
- Go backend 进入 active service surface 前，必须先补 manifest allowlist、test lane registry、workflow review recommendation 和 package verification；不能只新增目录就宣称 canonical backend 已经上线。
- 后续如果接 Temporal、LangGraph 或其他 durable engine，只能替换 workflow facade 后面的实现，不得改变 Portal / Runtime Broker / Cloud Worker 合同。

参考 `sub2api` 的范围只限工程形状：Go、Gin、Ent schema、repository/service/handler/server 分层、PostgreSQL canonical store 边界和 no-Redis-truth guard。不得吸收 `sub2api` 的订阅聚合、代理转换、套餐语义、用户路径、Redis 必需依赖或配置模型。

后端职责边界：

- Portal Control Plane 只处理用户、workspace、套餐、文件列表、run request、账单/审计查询和状态展示。
- Workflow Boundary 承接长任务 command/state；先 facade，后 durable engine。Portal route 不能继续直接承载长任务真相。
- Runtime Broker / OPL Bridge 只适配 clean upstream OPL、Runtime Bridge / Runtime Agent 和 anti-corruption mapping；它不是 Portal product truth、billing ledger truth 或 cloud inventory truth。
- Agent Runtime 只负责执行，不负责 SaaS 产品真相、计费、资源生命周期或审计归属。
- Cloud / Billing / Audit Workers 是内部 worker 边界，负责资源计划、账单事件、审计事件和 reconciliation；普通用户不能把它们理解成云控制台。

数据边界：

- PostgreSQL 是 canonical truth。
- Redis is not a required production dependency；当前目标是 PostgreSQL-only required data plane。session、cache、queue、lock 或短期协调优先由 PostgreSQL-backed 表、状态机、事务锁和 runtime memory boundary 承接；只有后续独立授权 leaf 和 evidence 证明需要时，Redis 才能作为 optional volatile accelerator 评估，且不得持有 canonical truth。
- Object/blob plane 只承载文件正文和私有 locator，不成为账本、资源或审计事实源。
- raw provider key、bearer token、launchToken、runtimeToken、objectKey、localPath、signedUrl 不得进入前端持久化、普通用户 payload、日志、evidence 或 git。

Program lifecycle：

```text
truth -> gap -> eval -> implementation/cleanup -> verify -> landing gate -> post-merge closeout -> next cursor
```

7 个阶段只能作为 compact machine program block 存在于 `tests/fixtures/v22/goal-current.json`，并由 registered tests、manifest branch override 和 landed history summary 承接。不得恢复 `docs/contracts/**`、`docs/recovery/**`、root stage docs、`scripts/smoke-test-*`、per-phase docs 或 shadow archive。

当前 program 阶段：

1. `structure-truth-convergence`: 明确 Portal / Workflow / Runtime Broker / Agent Runtime / Cloud Worker 边界。
2. `responsibility-inventory`: 把现有 Portal、Gateway、Runtime Bridge 文件归类为正确位置、错位、待迁移和待删除。
3. `docs-code-alignment-pass-1`: 先 gate 最危险错位：Portal 长任务、cloud operation 和内存 launch 状态。
4. `production-data-layer`: PostgreSQL canonical，Redis not required，JSON 不再作为 production path。
5. `runtime-run-file-artifact-closure`: run、file、artifact 和 trace 接口与 Runtime Bridge 合同一致。
6. `workflow-facade`: 长任务统一进入 workflow facade；durable engine 在 facade 后面替换。
7. `commercial-mainline`: 结构稳定后设计 `api_only`、`full_runtime`、`customer_dedicated`，再判断 UI 是否需要修改。

非目标：

- 不读取 secret。
- 不调用真实云。
- 不 build/push/kubectl/deploy/live-test。
- 不修改 `deploy/*`、`.sentrux/*`、`adapters/*`、`infra/*`、one-person-lab upstream。
- 不恢复 `user_owned`、`resource-order`、旧 runner/provisioner、OpenCost 或 Langfuse 主叙事。
- 不把 Go scaffold 或 workflow facade 写成已生产后端，除非对应 source、tests、manifest、landing gate 和 post-merge closeout 完成。

验收边界：

- program 必须由 `tests/contract/contract-test-v22-backend-go-convergence-program.mjs` 验证。
- branch override 必须只允许本 program 的 docs/tests/fixtures/scripts 和后续显式 Go service surface。
- Step 2 必须能证明 Go backend 是 future canonical target、Node Portal 是迁移前 active implementation、Portal 不得继续扩张长任务和云 mutation 职责。
- 每个 step 只能有一个 commit，并在 authoring record 中记录模型、subagent、订阅文件、验收命令、风险和 landing gate recommendation。
- landed 后只在 `docs/history/README.md` 保留摘要，不新增 agent-run 文件树。

### spec:v22-commercial-package-model

Former leaf id: `v22-commercial-package-model`
Former title: v22 Commercial Package Model

本合同定义结构收敛后的商业化套餐模型。它不实现 UI，不修改服务代码，不读取 secret，不调用真实云，不授权 deploy/build/kubectl/live-test。

商业化主链路从客户视角出发：谁都可以进入 OPL；需要平台托管计算、文件空间、隔离环境、计费和审计时，必须进入 MedOPL。MedOPL 销售的是托管 OPL 科研工作台服务和平台代管运行能力，不销售云控制台配置权。

## 套餐层级

- `api_only`: 面向只需要账号、工作空间、OPL 入口、用户自己的 gflabtoken providerKeyRef、文件/任务/结果索引的客户；不购买平台托管算力。
- `full_runtime`: 面向需要上云计算、平台托管文件空间、任务并发、余额/冻结金额、run/artifact/trace 回流、释放和停止计费的客户。
- `customer_dedicated`: 面向需要客户级隔离、专属运行边界、专属审计标签、人工审批和变更窗口的客户。

## 客户选择规则

- 只要进入 OPL 和保留工作空间上下文，走 `api_only`。
- 要跑平台托管计算任务，必须走 `full_runtime` 或 `customer_dedicated`。
- 需要客户级隔离、专属审计、审批窗口或更强资源边界，走 `customer_dedicated`。

Portal 普通用户必须看到“托管 OPL 科研工作台”的能力层级，不得看到云资源控制台、底层节点、存储桶、K8s 配置或用户自配云资源路径。

## Contract Data

<!-- v22-commercial-package-model:start -->
```json
{
  "contract": "v22_commercial_package_model",
  "version": 1,
  "customerRule": {
    "anyoneCanEnterOpl": true,
    "medoplRequiredForCloudCompute": true,
    "portalIsCloudConsole": false,
    "ordinaryUserSelfConfiguresCloud": false
  },
  "packages": [
    {
      "id": "api_only",
      "label": "API / OPL entry only",
      "includes": [
        "账号",
        "工作空间",
        "OPL 入口",
        "用户自己的 gflabtoken providerKeyRef",
        "文件/任务/结果索引"
      ],
      "allowsPlatformManagedCompute": false,
      "requiresBalanceFreeze": false,
      "requiresFileSpace": false,
      "medoplRequiredBecause": "需要账号、工作空间、入口治理和回流索引，但不购买平台托管算力。"
    },
    {
      "id": "full_runtime",
      "label": "Full managed runtime",
      "includes": [
        "平台托管计算",
        "文件空间",
        "任务并发",
        "余额/冻结金额",
        "run/artifact/trace 回流",
        "释放和停止计费"
      ],
      "allowsPlatformManagedCompute": true,
      "requiresBalanceFreeze": true,
      "requiresFileSpace": true,
      "medoplRequiredBecause": "需要平台代管计算、文件空间、计费、审计和释放。"
    },
    {
      "id": "customer_dedicated",
      "label": "Customer dedicated runtime",
      "includes": [
        "客户级隔离",
        "专属运行边界",
        "专属审计标签",
        "人工审批",
        "变更窗口"
      ],
      "allowsPlatformManagedCompute": true,
      "requiresBalanceFreeze": true,
      "requiresFileSpace": true,
      "isolation": "dedicated_runtime_boundary",
      "medoplRequiredBecause": "需要客户级隔离、专属运行边界、审批和审计。"
    }
  ]
}
```
<!-- v22-commercial-package-model:end -->

### spec:v22-commercial-ui-impact-decision

Former leaf id: `v22-commercial-ui-impact-decision`
Former title: v22 Commercial UI Impact Decision

本合同定义商业化套餐模型对当前 Portal UI 的影响决策。它不实现 UI，不修改服务代码，不读取 secret，不调用真实云，不授权 deploy/build/kubectl/live-test。

决策：本阶段不修改 Portal UI 代码。现有 Portal UI surface 已经覆盖商业化主链路必须回答的六个客户问题：买了什么、能不能用、缺什么、下一步点哪里、结果在哪里、费用是否正常。商业化模型在本阶段只改变产品分层 truth，不改变当前普通用户 route、API payload 或 UI 组件合同。

现有 UI 覆盖关系：

- `overview`: 承接“买了什么”“能不能用”“下一步点哪里”，展示托管 OPL 科研工作台服务、工作台可用性和下一步动作。
- `resources`: 承接“买了什么”“缺什么”，展示计算资源、文件空间、套餐规格和释放状态。
- `workspace`: 承接“结果在哪里”，展示文件列表、任务入口和输出结果。
- `trace`: 承接“结果在哪里”“费用是否正常”，展示任务运行轨迹、输出回流和费用关联。
- `billing`: 承接“费用是否正常”，展示余额、冻结金额、运行费用和账本审计。
- `opl-launch`: 承接“能不能用”“缺什么”“下一步点哪里”，展示进入 OPL 工作台、启动阶段和 provider 绑定状态。

商业化分层对 UI 的后续影响：

- `api_only` 只需要入口、账号、工作空间、provider 绑定状态和文件/任务/结果索引；当前 UI 已覆盖为 OPL entry/context 状态。
- `full_runtime` 使用当前运行环境、资源、文件空间、账单、trace 和释放 surface；当前 MVP 规格 `starter_2c4g_10gb` / `pro_8c16g_100gb` 仍属于该层。
- `customer_dedicated` 在真正对客户展示前必须另开 UI implementation leaf，补专属隔离、审批窗口、客户级审计标签和变更窗口的可见状态；不得在本阶段用文案把它伪装成已上线能力。

## Contract Data

<!-- v22-commercial-ui-impact-decision:start -->
```json
{
  "contract": "v22_commercial_ui_impact_decision",
  "version": 1,
  "decision": "no_immediate_ui_code_change",
  "reason": "existing_portal_surface_already_answers_required_customer_questions",
  "requiredCustomerQuestions": [
    "买了什么",
    "能不能用",
    "缺什么",
    "下一步点哪里",
    "结果在哪里",
    "费用是否正常"
  ],
  "existingUiCoverage": {
    "overview": [
      "托管 OPL 科研工作台服务",
      "工作台可用性",
      "下一步动作"
    ],
    "resources": [
      "计算资源",
      "文件空间",
      "套餐规格",
      "释放状态"
    ],
    "workspace": [
      "文件列表",
      "任务入口",
      "输出结果"
    ],
    "trace": [
      "任务运行轨迹",
      "输出回流",
      "费用关联"
    ],
    "billing": [
      "余额",
      "冻结金额",
      "运行费用",
      "账本审计"
    ],
    "oplLaunch": [
      "进入 OPL 工作台",
      "启动阶段",
      "provider 绑定状态"
    ]
  },
  "commercialModelImpacts": [
    "api_only_needs_entry_and_context_state_only",
    "full_runtime_uses_existing_runtime_resource_billing_surfaces",
    "customer_dedicated_requires_future_ui_leaf_before_customer_visible_launch"
  ],
  "modifiesUiNow": false,
  "requiresFutureUiLeafForCustomerDedicated": true
}
```
<!-- v22-commercial-ui-impact-decision:end -->

### spec:v22-authorized-tencent-create-release-implementation-boundary

Former leaf id: `v22-authorized-tencent-create-release-implementation-boundary`
Former title: v22 Authorized Tencent Create/Release Implementation Boundary

本合同定义 v22 真实腾讯云 create/release implementation 的后续授权边界。当前分支只写合同和 smoke，不实现真实云调用。

本合同承接 `spec:v22-authorized-tencent-create-release-boundary`：前者定义 authorized create/release 的产品和授权边界；本文补齐真实 implementation 前必须明确的授权、风控、失败回滚、审计、费用保护、清理策略和 Portal 可配置规则。

## 当前分支边界

- 不读取 secret。
- 不调用真实腾讯云 / COS / Langfuse / one-person-lab。
- 不创建、释放真实资源。
- 不真实扣费。
- 不运行 build/push/kubectl/live-test。
- 不修改 deploy / .sentrux / adapters / upstream / Gateway / Runtime Bridge。

后续真实实现必须另开 feat/*，并单独授权 secret 边界、真实云 API、测试账号、区域、资源类型、费用上限和清理策略。

## 资源生命周期分离

工作空间、计算资源、存储资源必须分离：

- 工作空间是业务容器。
- 计算资源可独立开通、扩容、缩容、释放。
- 存储资源 / 文件空间可独立开通、扩容、删除。
- 释放计算资源不删除文件空间。
- 释放计算资源不让文件空间进入 7 天保护期。
- 删除存储资源 / 文件空间，或独立欠费保留策略，才进入 7 天保护期。
- 计算资源已释放但存储资源仍保留，是合法状态。
- 计算资源已释放但文件空间仍保留，是合法状态。
- 存储资源进入保护期或不可用时，新任务不能依赖该文件空间。

释放计算资源只能停止计算计费和任务续用。不得把“释放计算资源”自动写成“删除文件空间”。存储资源是否进入保护期，必须由独立存储删除 / 欠费保留策略触发。

## 默认风控上限

以下值是默认风控上限，不是默认开通规格：

- maxCpuCoresPerWorkspace: 16
- maxMemoryGbPerWorkspace: 32
- maxFileSpaceGbPerWorkspace: 500
- maxConcurrentTasksPerWorkspace: 5
- maxQueuedTasksPerWorkspace: 20
- balanceWarningThresholdCny: 20
- dailySpendAlertCny: 300
- dailyHardCapCny: null
- failedOperationRetryLimit: 2
- maxCreateReleaseOperationsPerDay: 10

这些值必须是 Portal 管理员可按账号修改的策略，不是产品永久上限。后续可支持账号组默认值 + 单账号 override + effective limits 展示。

管理员修改风控策略时必须记录：

- 修改人账号。
- 目标账号。
- 修改前策略。
- 修改后策略。
- 生效时间。
- 修改原因。

普通用户主语言优先使用：账号、工作空间、计算资源、文件空间、套餐、任务并发、余额、冻结金额。租户 / runtime / 运行环境 / environmentId 只能作为内部标签、对账标签或审计字段。

普通用户只能看到业务化结果，例如“可用额度”“任务并发”“排队上限”“余额提醒”，不能看到云控制台对象或 provider 内部字段。

## 套餐口径

套餐和自定义规格必须使用产品语言：

- 基础套餐：2c / 4GB / 10GB 文件空间。
- Pro 套餐：8c / 16GB / 100GB 文件空间。
- 自定义：CPU、内存、文件空间、任务并发数。

5 个必须写成任务并发，不是 session 并发。session 只是运行、观测或访问上下文，不等同于可同时执行的任务数。

## 费用和冻结

真实开通前必须完成费用保护：

- 开通时需要扣费 / 预扣 + 冻结金额。
- Portal 普通用户展示中文状态：已冻结金额、预计可用时长、120 分钟扣费核对、隔日账单审计。
- 日预算默认只提醒，不默认硬停。
- 管理员可以给某个账号打开硬停。
- 余额低于 20 元提醒。
- 冻结金额不足时：停止新任务和计算资源续用。
- 存储资源是否进入 7 天保护期，必须由独立存储删除 / 欠费保留策略触发。

冻结和解冻规则：

- 询价失败前不得冻结。
- 冻结失败不得创建资源。
- 计算创建失败后，未消费部分必须进入解冻或待审计。
- 释放计算资源成功后，停止计算续费；已产生账单等待 120 分钟扣费核对和隔日账单审计。
- T+1 异常不得直接静默补扣或退款，必须进入管理员审计队列。

## T+1 对账异常

T+1 腾讯云 / COS 账单和 Portal ledger 对不上时，进入管理员审计队列。

普通用户看到中文状态：

- 账单核对中。
- 账单异常待处理。
- 已校准。
- 待补扣。
- 待退还。

管理员审计队列必须区分：

- 标签缺失。
- 标签不一致。
- 资源孤儿。
- 金额偏差。
- 账单迟到。
- 账单缺失。

不得直接暴露底层云账单字段、bucket、object key、SecretId、SecretKey、kubeconfig。管理员/运维也只能看到业务摘要、分账标签、审计证据和处理状态；secret 和 provider 内部对象仍不得进入 Portal payload。

## 失败回滚状态机

真实 create/release implementation 必须定义补偿状态机：

- 待执行。
- 执行中。
- 待回滚。
- 回滚中。
- 已回滚。
- 待审计 / 可重试。
- 回滚失败待审计。
- 释放失败待审计。
- 清理失败待审计。

失败分支必须满足：

- 询价失败：不冻结、不创建资源。
- 冻结失败：不创建资源。
- 计算创建失败：释放已创建的计算子资源，记录失败证据。
- 存储创建失败：计算资源是否保留必须按用户计划和审计策略处理，不得隐式删除用户已有文件空间。
- 绑定失败：资源进入待审计 / 可重试状态，不能假装可用。
- 释放失败：进入释放失败待审计，保留重试队列和证据。
- 删除存储失败：进入清理失败待审计，不承诺秒级物理删除。

回滚动作必须明确可重试次数，并受 failedOperationRetryLimit: 2 和 maxCreateReleaseOperationsPerDay: 10 约束。超过限制后必须进入人工审计，不得无限重试。

## Portal Role Surface 边界

借鉴 Sub2API 的 role-based Web app 思路：同一 Portal，同一登录，同一 UI shell，普通用户和管理员 surface 按角色分离。

不复制 Sub2API 代码、路由、鉴权或存储结构。

普通用户 surface 只展示自己的工作空间、套餐、文件空间、任务并发、余额、冻结金额、费用估算和中文状态。

管理员 / 运维 surface 可以展示全局账号、工作空间、分账标签、审计队列、异常队列和策略 override，但仍不得展示 SecretId、SecretKey、token、kubeconfig、objectKey、storageKey、cosPrefix、storageBackend、signedUrl。

## 防污染和 truth 边界

借鉴 one-person-lab 的 worktree / repo-tracked truth / 防污染纪律：

- truth 进入 docs/specs/scripts/tests。
- tmux/session/agent 对话/本地 runtime state 不进仓库。
- 不把 upstream 内部逻辑写进 Portal。
- 不 import upstream 内部模块。
- 不让 v19/v20/v21 旧路线、user_owned、resource-order、旧云控制台叙事重新成为 v22 主线。

## Contract Data

<!-- v22-authorized-tencent-create-release-implementation-contract:start -->
```json
{
  "contract": "v22_authorized_tencent_create_release_implementation_boundary",
  "version": 1,
  "implementsRealCloudCall": false,
  "currentBranchOnlyContractsAndSmoke": true,
  "resourceLifecycle": {
    "workspaceLifecycleSeparatedFromCompute": true,
    "workspaceLifecycleSeparatedFromStorage": true,
    "computeResourceIndependentlyManaged": true,
    "storageResourceIndependentlyManaged": true,
    "computeReleaseDeletesFileSpace": false,
    "storageDeleteTriggersRetentionDays": 7,
    "computeReleasedWithStorageRetainedIsValid": true,
    "tasksRequireAvailableFileSpace": true
  },
  "defaultRiskLimits": {
    "defaultLimitsAreRiskCapsNotDefaultProvisioningSpec": true,
    "maxCpuCoresPerWorkspace": 16,
    "maxMemoryGbPerWorkspace": 32,
    "maxFileSpaceGbPerWorkspace": 500,
    "maxConcurrentTasksPerWorkspace": 5,
    "maxQueuedTasksPerWorkspace": 20,
    "balanceWarningThresholdCny": 20,
    "dailySpendAlertCny": 300,
    "dailyHardCapCny": null,
    "failedOperationRetryLimit": 2,
    "maxCreateReleaseOperationsPerDay": 10,
    "adminAccountOverrideAllowed": true,
    "accountGroupDefaults": true,
    "effectiveLimitsVisible": true
  },
  "packages": {
    "starter": "2c / 4GB / 10GB 文件空间",
    "pro": "8c / 16GB / 100GB 文件空间",
    "customSupports": [
      "CPU",
      "内存",
      "文件空间",
      "任务并发数"
    ],
    "fiveMeansTaskConcurrencyNotSessionConcurrency": true
  },
  "billingProtection": {
    "requiresPrechargeOrFreezeBeforeCreate": true,
    "userVisibleStatuses": [
      "已冻结金额",
      "预计可用时长",
      "120 分钟扣费核对",
      "隔日账单审计"
    ],
    "dailyBudgetWarnsByDefault": true,
    "dailyHardStopDefault": false,
    "adminCanEnableDailyHardStopPerAccount": true,
    "balanceWarningThresholdCny": 20,
    "insufficientFreezeStopsNewTasksAndComputeContinuation": true,
    "insufficientFreezeDoesNotDeleteFileSpace": true
  },
  "tPlusOneReconciliation": {
    "adminAuditQueue": true,
    "userVisibleStatuses": [
      "账单核对中",
      "账单异常待处理",
      "已校准",
      "待补扣",
      "待退还"
    ],
    "exceptionTypes": [
      "标签缺失",
      "标签不一致",
      "资源孤儿",
      "金额偏差",
      "账单迟到",
      "账单缺失"
    ]
  },
  "failureRollback": {
    "quoteFailure": "不冻结、不创建资源",
    "freezeFailure": "不创建资源",
    "computeCreateFailure": "释放已创建的计算子资源，记录失败证据",
    "storageCreateFailure": "按用户计划和审计策略决定是否保留计算资源，不隐式删除用户已有文件空间",
    "bindingFailure": "资源进入待审计 / 可重试状态，不能假装可用",
    "releaseFailure": "进入释放失败待审计，保留重试队列和证据",
    "storageDeleteFailure": "进入清理失败待审计，不承诺秒级物理删除"
  },
  "authorizationBoundary": {
    "readsSecret": false,
    "callsRealTencentCloud": false,
    "callsRealCos": false,
    "callsRealLangfuse": false,
    "callsRealOnePersonLab": false,
    "createsOrReleasesRealResources": false,
    "appliesRealBilling": false,
    "runsBuildPushKubectlLiveTest": false,
    "modifiesDeploySentruxAdaptersUpstreamGatewayRuntimeBridge": false,
    "futureImplementationRequiresSeparateFeatAndAuthorization": true
  },
  "borrowedBoundaries": {
    "sub2apiRoleBasedPatternOnly": true,
    "doNotCopySub2apiCodeRoutesAuthOrStorage": true,
    "onePersonLabWorktreeRepoTruthDiscipline": true,
    "repoTrackedTruth": [
      "docs/specs",
      "scripts",
      "tests"
    ],
    "localRuntimeStateNotTruth": true
  }
}
```
<!-- v22-authorized-tencent-create-release-implementation-contract:end -->

## Non-goals

- 不实现真实腾讯云 SDK 调用。
- 不实现 Portal UI。
- 不实现 Gateway 或 Runtime Bridge 接线。
- 不读取 secret。
- 不创建、绑定、释放真实资源。
- 不真实扣费。
- 不运行 build/push/kubectl/live-test。
- 不修改 deploy / .sentrux / adapters / upstream / Gateway / Runtime Bridge。

### spec:v22-authorized-tencent-deploy-execution-boundary

Former leaf id: `v22-authorized-tencent-deploy-execution-boundary`
Former title: v22 Authorized Tencent Deploy Execution Boundary

本合同定义 Package D: deploy and production integration 的执行边界。它只覆盖 TCR 镜像、push 版本、kubectl/deploy 和 runtime smoke；不覆盖 Package C 的存储 / 计算资源生命周期。

本合同只定义 TCR 镜像、push 版本、kubectl/deploy 和 runtime smoke 的授权边界。默认未授权路径不读取 deploy secret，不 build，不 push，不 kubectl，不调用真实云，不修改 deploy，不改变 TKE 或 COS 资源。

Package D 不授权 Package C 的资源生命周期动作。不创建、删除、释放或扩缩容 TKE node pool。不创建、删除、清空或扩容 COS bucket / prefix / object。任何需要开通、扩容、释放、删除计算或存储的动作必须回到 Package C，并重新取得当前会话授权。

## Positioning

Package D 的定位是“把一组已审查镜像版本接到指定运行面并证明它们在跑”，不是“管理云资源”。D 不是一个镜像包含所有服务；Portal、OPL Gateway、Runtime Bridge、上游 OPL、Langfuse 等必须按实际部署职责拆成多个 target 或外部 smoke surface。

可以做：

- TCR repository/tag preflight。
- multi-image build and push unique test tag。
- deploy dry-run。
- authorized deploy rollout。
- runtime smoke。
- rollback / stop condition 记录。
- final deploy evidence 写入 `.runtime` 脱敏报告。
- Portal schema migration preflight / evidence gate：若 Portal image 在启动时要求新的 PostgreSQL 表或 schema version，Package D 必须先停止在 migration gate，不能把 rollout 失败泛化成普通 deploy 失败。

不可以做：

- 不删除、关闭、扩缩容或创建任何未授权节点、节点池、namespace、storage、bucket、prefix 或 object。
- 不把 TCR、TKE、Kubernetes、namespace、workload、image digest、kubectl 暴露给普通用户。
- 不把 deploy secret、registry secret、kubeconfig、raw token、object key、signed URL 写入 stdout、docs、git、Portal payload 或 `.runtime`。
- 不绕过 dry-run、ownerRef、rollback evidence 或 B review。

## Package D Secret Allowlist

Package D 只能读取以下 key，且必须按 allowlist 精确读取，不允许 source env，不允许一读全读：

- `RUN_TENCENT_DEPLOY_EXECUTION`
- `TCR_ID`
- `TCR_SECRET`
- `TENCENT_TCR_REGISTRY`
- `TENCENT_TCR_NAMESPACE`
- `TENCENT_TCR_REGION`
- `TENCENT_DEPLOY_CLUSTER_ID`
- `TENCENT_DEPLOY_KUBECONFIG_REF`

`TENCENT_DEPLOY_KUBECONFIG_REF` 只能是后端 secret reference 或本机受控路径引用，不能把 raw kubeconfig 写入合同、日志、Portal payload、`.runtime` 或 git。

`TENCENT_TCR_REPOSITORY`、`TENCENT_DEPLOY_NAMESPACE`、`TENCENT_DEPLOY_WORKLOAD`、`TENCENT_DEPLOY_CONTAINER`、`TENCENT_DEPLOY_RUNTIME_SMOKE_URL` 不属于 secret allowlist。它们是 release plan 的 non-secret target 字段，必须逐 target 显式声明，不能用单值环境变量把多服务发布压成单容器发布。

## Release Plan

Package D 必须通过 `--release-plan <json>` 消费本地受控 release plan。release plan 可以放在 `.runtime` 或用户指定的本地路径，不进入 git，不包含 raw secret、raw kubeconfig、token、cookie、object key、signed URL 或 raw cloud response。

OPL / Portal / Gateway / Runtime Agent target ownership 必须同时订阅 [spec:v22-opl-deployment-ownership-release-plan-boundary](#spec-v22-opl-deployment-ownership-release-plan-boundary)。该 Level 4 子合同把 target 分为 `platform_service_target` 和 `workspace_runtime_target`：平台服务必须有 `ownerRef/operationId`，但不强制 `workspaceId/resourceBindingId`；workspace runtime target 必须额外绑定 `workspaceId/resourceBindingId`。只有 `k8s-app/qcloud-app`、deployment 名字、namespace、IP、创建时间或人工记忆时必须 fail-closed。

release plan 顶层字段：

- `runId`：本次发布 run id。
- `versionTag`：唯一版本 tag，禁止 `latest`。
- `namespace`：本次 release 允许 mutation 的单一 namespace；如各 target namespace 不一致，fail-closed。
- `targets[]`：要 build/push/deploy 的镜像目标。
- `runtimeSmokeTargets[]`：要访问的外部入口验证面。

每个 `targets[]` 必须包含：

- `component`：例如 `portal`、`opl-web-gateway`、`opl-runtime-bridge`、`opl-web-upstream`。
- `targetClass`：`platform_service_target` 或 `workspace_runtime_target`。
- `repository`：该 component 对应的 TCR repository。
- `imageTargetRef`、`sourceRoot`：非 secret image target metadata 与 repo-relative active service source root；`sourceRoot` 必须指向当前 active service 目录。strict monolith zero-compat 下 active repo 不保留默认 Dockerfile / deploy asset；未来真实 build recipe 必须在重新授权的 v22 deploy boundary 中定义。
- `namespace`、`workload`、`container`：指定 Kubernetes Deployment/container。
- `ownerRef`、`operationId`，以及按 target class 需要的 `workspaceId`、`resourceBindingId`：owner guard 字段。
- `expectedVersionMarker`：该 target 被 runtime smoke 证明时应匹配的版本 marker 或 build id。

每个 `runtimeSmokeTargets[]` 必须包含：

- `surface`：`portal`、`opl`、`trace` 等外部验证面。
- `url`：授权访问的 endpoint，例如 `https://portal.medopl.cn/healthz`、`https://opl.medopl.cn/healthz`、`https://trace.medopl.cn/api/public/health`。
- `expectedVersionMarker`。
- `provesPushedVersion`：是否证明本次 pushed component 正在运行。
- `provesComponents[]`：该 endpoint 证明的 target component 列表。

`trace.medopl.cn` 是 Langfuse/admin trace surface；除非 release plan 明确包含已审查的 Langfuse image target metadata、source root / build recipe boundary、workload 和 owner guard，否则它只能作为 runtime smoke surface，不得被默认建模成“本仓库 Langfuse 镜像 target”。换言之，trace surface 可验证观测入口可达，但不能替代 Portal/Gateway/Runtime Bridge pushed version marker。

## Cloud-Lane D2 Image Push Gate

`cloud-lane/feat/v22-package-d-image-push-gate` 是 Package D cloud-lane 的长期 stack 分支。它基于 D1 `feat/v22-opl-deployment-ownership-release-plan` 的 `eb23e02`，只收敛 R-14/R-15：

- R-14 TCR repository/tag preflight。
- R-15 multi-image build and push unique test tag。

D2 订阅 D1 owner gate。D2 不能绕过 D1 的 `targetClass`、`ownerRef`、`operationId`、workspace runtime binding、runtime smoke coverage 或 redaction 边界。

D2 的关键硬门：

- `--build-push` 必须显式传入 `--accepted-preflight-id <id>`。
- `acceptedPreflightId` 必须来自已审查的 R-14 preflight report。
- 缺失 `acceptedPreflightId` 时 runner 必须返回 `deploy_accepted_preflight_required`。
- local shape gate 只能证明 gate shape、唯一 tag、digest readback shape 和脱敏 report shape。
- real mode 读取 deploy secret、docker login、docker build、docker push 和真实 TCR digest readback 都需要当前会话显式授权。

D2 不授权 kubectl dry-run、rollout、runtime smoke、rollback 或 Package C 计算/存储生命周期动作。

## Cloud-Lane D3 Deploy Dry-Run Gate

`cloud-lane/feat/v22-package-d-deploy-dry-run-gate` 是 Package D cloud-lane 的 D3a stack 分支。它基于 D2 `cloud-lane/feat/v22-package-d-image-push-gate` 的 `7fbc632`，只收敛 R-16 deploy dry-run gate。

D3a 订阅 D1 owner gate 和 D2 image push gate。D3a 不能绕过 D2 的 digest readback evidence，也不能绕过 D1 的 target ownership guard。

D3a 的关键硬门：

- `--deploy-dry-run` 必须显式传入 `--image-digests-file <path>`。
- `imageDigestsFile` 必须来自已审查的 D2 build-push report。
- 缺失 `imageDigestsFile` 时 runner 必须返回 `deploy_image_digests_file_required`。
- local shape gate 只能证明 per-target digest consumption、dry-run report shape、rollback image known shape 和脱敏 evidence shape。
- real mode 读取 deploy secret、读取 kubeconfig、调用 `kubectl get deployment` 和执行 server-side dry-run 都需要当前会话显式授权。

D3a 不授权 `kubectl apply`、rollout、runtime smoke、rollback 或 Package C 计算/存储生命周期动作。

## TCR Scope

只能操作指定 TCR registry / namespace，以及 release plan 中列出的 repositories。

允许的 registry 动作：

- `DescribeRepositories`
- `DescribeImages`
- `docker login`
- `docker build`
- `docker tag`
- `docker push`
- digest readback

约束：

- 只能 push 唯一 test tag。
- 禁止使用 `latest`。
- tag 必须包含 run id 或不可重复版本号。
- 必须记录 digest。
- 不得覆盖已有 tag。
- 不得删除 image、tag、repository 或 namespace。
- 不得写入 raw docker config、registry secret 或完整 registry credential。

## Kubernetes Deploy Scope

只能操作指定 TKE cluster。只能操作 release plan 中的单一 namespace。只能操作 release plan 中列出的 workload。只能更新 release plan 中列出的 container image。

允许的 kubectl 动作：

- `kubectl diff`
- server-side dry-run
- `kubectl apply`
- `kubectl rollout status`
- `kubectl get`
- `kubectl rollout undo`

必须先 `kubectl diff` 或 server-side dry-run，再执行 `kubectl apply`。执行后必须有 rollout status。失败或不确定时必须有 rollback evidence。

## Portal Schema Migration Gate

Portal target rollout 不能假设生产 PostgreSQL schema 已经随镜像自动迁移。Package D 在执行 Portal image rollout 前必须有明确的 schema migration evidence 或显式的 migration step 授权。

如果新 Portal image 启动时报：

- `portal_schema_not_ready`
- `portal_schema_missing_tables`

runner 必须把 blocker 分类为 `deploy_portal_schema_not_ready` 或 `deploy_portal_schema_missing_tables`，停止后续 target rollout，并保留 rollback evidence。不得把这类故障写成 `deploy_runner_failed` 后继续 rollout。

Package D 不默认授权数据库迁移。执行 `node src/migrate-schema.mjs`、Kubernetes migration Job、直接连接 PostgreSQL 或修改 schema 都必须单独进入 Portal / DB migration gate，并明确：

- 使用哪个 Portal image 运行 migration。
- 连接哪个 namespace / database / schema namespace。
- migration 前后 health check。
- rollback / restore 口径。
- migration evidence 的脱敏路径。

未完成该 gate 前，Package D 可以证明 TCR push 和 deploy dry-run，但不能宣称 Portal pushed version 已经在生产运行。

## Ownership Guard

Package D 的每个 deploy target 必须同时通过 Portal truth 和 Kubernetes metadata 归属校验。

必须校验：

- targetClass。
- ownerRef。
- operationId。
- workspaceId 和 resourceBindingId，若 targetClass 是 `workspace_runtime_target`。
- expected labels。
- 指定 cluster / namespace / workload / container。
- 目标 workload 当前 image 和回滚 image。

缺失、冲突或不一致时 fail-closed。不得靠名称、创建时间、IP、规格或人工记忆推断归属。不靠名称、创建时间、IP、规格或人工记忆推断归属。

这是防止误删、误停或误改别人节点和存储的硬边界。Package D 只能改“已确认属于本次 deploy operation 的指定 workload container image”，不能碰节点池容量、COS 文件空间或其他租户资源。

Implementation note: OPL deployment discovery.

This note does not loosen the current Package D contract. The discovery branch `docs/v22-package-d-opl-deploy-discovery` records that current OPL candidate deployments are visible as possible Portal/Gateway/Runtime Bridge/trace targets, but lack Package D owner guard labels for this purpose. `k8s-app/qcloud-app`, deployment name, namespace, IP, creation time, or manual memory cannot prove ownership.

Portal/Gateway/Runtime Bridge/trace may be platform service targets. A future OPL deployment ownership / release plan sub-contract may define a platform service target guard that uses platform-level `ownerRef` and `operationId` without forcing `workspaceId/resourceBindingId` on shared platform services. Workspace runtime targets still require workspaceId/resourceBindingId because they represent tenant-scoped runtime capacity.

The repo-tracked OPL deployment ownership / release plan sub-contract is [spec:v22-opl-deployment-ownership-release-plan-boundary](#spec-v22-opl-deployment-ownership-release-plan-boundary). It explicitly classifies every target as `platform_service_target` or `workspace_runtime_target`, defines which owner guard fields are mandatory for each class, and keeps fail-closed behavior when Portal truth or Kubernetes metadata is missing or conflicting. Package D real rollout remains blocked for any target that lacks a reviewed release plan, real target metadata, dry-run evidence, rollback evidence or explicit authorization; the authorized `default` platform-service target run can be reviewed as real rollout evidence without weakening that future-target gate.

## Forbidden Side Effects

明确禁止：

- 禁止 `kubectl delete`。
- 禁止 `DeleteNodePool`。
- 禁止 `CreateNodePool`。
- 禁止 `ScaleNodePool`。
- 禁止 `ModifyNodePoolDesiredCapacityAboutAsg`。
- 禁止删除 bucket。
- 禁止删除 prefix。
- 禁止删除对象。
- 禁止清空 bucket。
- 禁止跨 namespace。
- 禁止 cluster-wide mutation。
- 禁止修改 Secret。
- 禁止修改 CRD。
- 禁止修改 Ingress。
- 禁止修改 Service、PVC、PV、StorageClass、ClusterRole、ClusterRoleBinding。
- 禁止删除或关闭别人的节点和存储。

如果 deploy 需要上述任一动作，Package D 必须停止，并回到合同审阅与用户授权。

## Runtime Smoke

runtime smoke 必须命中 release plan 中的已授权 endpoint，必须证明 pushed version 正在运行，不能只证明镜像存在。

runtime smoke evidence 至少包含：

- smoke run id。
- deployed tag。
- digest。
- sanitized endpoint ref。
- version marker 或 build id。
- rollout status summary。
- rollback evidence ref。
- runtime smoke surface 到 target component 的覆盖关系。

不得输出 raw token、kubeconfig、registry secret、object key、signed URL、raw response、Authorization header 或 cookie。

## Portal Projection

普通用户不展示 TCR、TKE、Kubernetes、namespace、workload、image digest、kubectl。Portal 只能展示工作台版本、运行状态、更新时间和审计状态。

管理员/运维也只能看到脱敏 registry/deploy/runtime evidence，不得看到 raw secret、raw kubeconfig、registry credential、raw cloud response、object key 或 signed URL。

## Closed Loop

Package D 的闭环链路：

1. R-14 TCR repository/tag preflight：按 release plan targets 确认 registry、repositories、docker login、tag/digest readback 可用。
2. R-15 multi-image build and push unique test tag：逐 target build、tag、push 唯一 test tag，逐 target 读回 digest。
3. R-16 deploy dry-run：逐 target 对指定 namespace/workload/container 生成 diff 或 server-side dry-run evidence。
4. R-17 authorized deploy rollout：用户确认 dry-run 后逐 target apply，等待 rollout status；失败时停止并记录 rollback evidence。
5. R-18 runtime smoke：命中 `portal.medopl.cn`、`opl.medopl.cn`、`trace.medopl.cn` 等 release plan 授权 endpoint，证明 pushed components 正在运行，并确认 trace surface 可访问。

产物路径：

- `.runtime/v22-registry/<run-id>.json`
- `.runtime/v22-cloud-deploy/<run-id>.json`
- `.runtime/v22-runtime-smoke/<run-id>.json`

当前 repo-tracked 验证入口：

- `tests/future-authorized/cloud/future-authorized-test-v22-opl-deployment-ownership-release-plan-contract.mjs`
- `tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`

zero-compat cleanup 已删除 deploy runner executable surface。当前 active repo 只保留合同和本地 shape gate；未来若重新授权真实 build/push/kubectl/deploy，必须先建立新的 v22 build recipe / deploy execution boundary 和新的执行入口。release plan 缺 `runId`、`versionTag`、`targets[]`、`runtimeSmokeTargets[]`、任一 owner guard 字段、任一 target repository/source/deploy 字段或任一 smoke surface 覆盖关系都必须 fail-closed。

R-15 `build-push` 必须显式传入 `--accepted-preflight-id <id>`，并且该 id 必须来自已审查的 R-14 preflight report。缺失时 fail-closed。这样可以防止绕过 repository/tag/readback preflight 直接 build/push。`acceptedPreflightId` 只能作为脱敏 evidence 出现在 `.runtime` report；不能包含 raw registry credential、docker config、kubeconfig 或 secret path。

R-16 `deploy-dry-run` 必须显式传入 `--image-digests-file <path>`，并且该文件必须来自已审查的 R-15 build-push report。缺失时 fail-closed，返回 `deploy_image_digests_file_required`。这样可以防止没有 pushed image digest 的 deploy dry-run 伪通过。

只有 R-14..R-18 都通过，且 evidence 脱敏、rollback evidence 存在、没有越权 mutation，才能说 Package D 验证通过。

## Non-Goals

- 不读取 deploy secret now。
- 不运行 build/push/kubectl now。
- 不修改 TKE node pool。
- 不修改 COS storage。
- 不运行 live-test。
- 不修改 deploy / `.sentrux` / adapters / upstream。
- 不 merge，不 push。

## Contract Data

<!-- v22-authorized-tencent-deploy-execution-contract:start -->
```json
{
  "contract": "v22_authorized_tencent_deploy_execution_boundary",
  "version": 1,
  "authorizationPackage": "deploy_and_production_integration",
  "readsDeploySecretNow": false,
  "runsBuildPushKubectlNow": false,
  "modifiesTkeNodePool": false,
  "modifiesCosStorage": false,
  "forbidsLatestTag": true,
  "requiresUniqueTag": true,
  "requiresDigestVerification": true,
  "requiresDeployDryRunBeforeApply": true,
  "requiresRuntimeSmokeForPushedVersion": true,
  "requiresRollbackEvidence": true,
  "runnableSteps": [
    "R-14",
    "R-15",
    "R-16",
    "R-17",
    "R-18"
  ],
  "secretAllowlist": [
    "RUN_TENCENT_DEPLOY_EXECUTION",
    "TCR_ID",
    "TCR_SECRET",
    "TENCENT_TCR_REGISTRY",
    "TENCENT_TCR_NAMESPACE",
    "TENCENT_TCR_REGION",
    "TENCENT_DEPLOY_CLUSTER_ID",
    "TENCENT_DEPLOY_KUBECONFIG_REF"
  ],
  "releasePlan": {
    "required": true,
    "singleNamespaceOnly": true,
    "requiresMultipleTargets": true,
    "forbidsSingleImageAllInOneAssumption": true,
    "targetRequiredFields": [
      "component",
      "repository",
      "imageTargetRef",
      "sourceRoot",
      "namespace",
      "workload",
      "container",
      "targetClass",
      "ownerRef",
      "operationId",
      "expectedVersionMarker"
    ],
    "targetClasses": {
      "platform_service_target": {
        "requiresWorkspaceBinding": false,
        "requiredOwnerGuard": ["ownerRef", "operationId"]
      },
      "workspace_runtime_target": {
        "requiresWorkspaceBinding": true,
        "requiredOwnerGuard": ["ownerRef", "operationId", "workspaceId", "resourceBindingId"]
      }
    },
    "runtimeSmokeTargetsRequired": [
      "portal",
      "opl",
      "trace"
    ],
    "defaultRuntimeSmokeUrls": {
      "portal": "https://portal.medopl.cn/healthz",
      "opl": "https://opl.medopl.cn/healthz",
      "trace": "https://trace.medopl.cn/api/public/health"
    },
    "traceSurfaceIsNotImplicitImageTarget": true
  },
  "allowedAfterCurrentSessionExplicitAuthorizationRegistryActions": [
    "DescribeRepositories",
    "DescribeImages",
    "docker login",
    "docker build",
    "docker tag",
    "docker push",
    "digest readback"
  ],
  "allowedAfterCurrentSessionExplicitAuthorizationKubectlActions": [
    "kubectl diff",
    "kubectl server-side dry-run",
    "kubectl apply",
    "kubectl rollout status",
    "kubectl get",
    "kubectl rollout undo"
  ],
  "forbiddenActions": [
    "kubectl delete",
    "DeleteNodePool",
    "CreateNodePool",
    "ScaleNodePool",
    "ModifyNodePoolDesiredCapacityAboutAsg",
    "deleteBucket",
    "deletePrefix",
    "deleteObject",
    "emptyBucket",
    "crossNamespaceMutation",
    "clusterWideMutation",
    "modifySecret",
    "modifyCRD",
    "modifyIngress",
    "modifyService",
    "modifyPVC",
    "modifyPV",
    "modifyStorageClass",
    "modifyClusterRole",
    "modifyClusterRoleBinding"
  ],
  "ownershipGuard": {
    "requiresOwnerRef": true,
    "requiredLabelsByTargetClass": {
      "platform_service_target": [
        "ownerRef",
        "operationId"
      ],
      "workspace_runtime_target": [
        "ownerRef",
        "operationId",
        "workspaceId",
        "resourceBindingId"
      ]
    },
    "scope": [
      "cluster",
      "namespace",
      "workload",
      "container"
    ],
    "failClosedOnMissingOrConflictingOwner": true,
    "forbidsInferenceByNameTimeIpSpecOrMemory": true
  },
  "runner": {
    "executableSurfaceDeleted": true,
    "futureRunnerRequiresNewV22Boundary": true,
    "localGateSmoke": "tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs",
    "requiresExplicitNonSecretExecutionParameters": [
      "releasePlan",
      "acceptedPreflightId",
      "imageDigestsFile",
      "acceptedDryRunId"
    ],
    "buildPushRequiresAcceptedPreflightId": true,
    "acceptedPreflightMissingReason": "deploy_accepted_preflight_required",
    "deployDryRunRequiresImageDigestsFile": true,
    "imageDigestsFileMissingReason": "deploy_image_digests_file_required",
    "defaultProviderMode": "config-only",
    "realProviderMode": "real"
  },
  "artifactRoots": [
    ".runtime/v22-registry/",
    ".runtime/v22-cloud-deploy/",
    ".runtime/v22-runtime-smoke/"
  ],
  "ordinaryUserProjection": [
    "工作台版本",
    "运行状态",
    "更新时间",
    "审计状态"
  ]
}
```
<!-- v22-authorized-tencent-deploy-execution-contract:end -->

### spec:v22-billing-freeze-boundary

Former leaf id: `v22-billing-freeze-boundary`
Former title: v22 Billing Freeze Boundary Contract

本合同定义 MedOPL v22 的资源计费、冻结金额和释放边界。

## Billing Start

租户开通 runtime、compute 或 storage 后，资源进入 billing、quota、audit 边界，并开始预扣费或冻结金额。

## Insufficient Balance

当余额不足时，Portal 必须提示用户将消耗冻结金额。该提示属于产品主 loop，不能被隐藏在后台资源逻辑中。

## Freeze Protection

冻结保护期是 7 天。

- 保护期内，Portal 可以展示资源、余额、冻结金额和释放状态。
- 保护期结束后，平台清理对应数据和资源。
- 清理和释放必须保留 audit tag / cost allocation tag 可追踪性。

## Billing Stop

用户删除或释放 runtime、compute、storage 后，扣费停止。释放后的资源不得继续产生租户费用。

## Non-goals

- 不把冻结保护描述成云资源控制台欠费流程。
- 不让用户直接操作 CVM、COS、K8s 来停止扣费。

### spec:v22-cloud-onboarding-workflow-boundary

Former leaf id: `v22-cloud-onboarding-workflow-boundary`
Former title: v22 Cloud Onboarding Workflow Boundary

本合同定义 v22 接云上线的 repo-tracked workflow 合同，把旧 cloud onboarding 阶段、当前 Package C/D 边界和生产 Portal 点击闭环验收路径写成同一个可审计状态机。

本合同不替代 AGENTS.md。AGENTS.md 管 A/B/C/D 纪律、授权红线、协作规则和禁止路径；本合同管业务推进顺序、阶段依赖、验收状态和 blocker 回流。后续 cloud onboarding 不得只依赖聊天记忆推进，必须以 repo-tracked workflow 合同、合同索引、status/execution board 和 smoke 为准。

旧 `CO-01..CO-14` 只保留为历史阶段和证据索引，不再作为当前验收主线。当前 cloud-lane 执行入口是 `docs/delivery/README.md` 中的 L1 -> L2a -> L2b -> L3 -> L4 串联验收；该 manifest 不是新大合同，而是本合同的 harness-native 执行路由层。

当前分支允许修改旧 cloud 合同、recovery 状态、selector/check smoke 和 Portal cloud operation 控制面；读取 secret、调用真实云、build/push、kubectl、live-test 仍只能发生在本地 gate 通过后的 L1-L4 授权验收步骤中。

## 2026-05 Framework Mapping

本合同采用 2026-05 的三层工程框架：

- Microsoft Azure Architecture Center 的 Async Request-Reply pattern：Portal HTTP API 只接收请求、写入 operation/outbox，并返回 `202 Accepted + operationId/status endpoint`；长耗时真实云开通不得阻塞 Portal 请求。
- Kubernetes controller pattern：独立 worker/controller 持续把 canonical store 的 desired state 推进到 cloud current state；每次恢复先 cleanup/reconcile，再执行新 mutation。
- OpenAI Harness Engineering / Codex App Server：repo 内合同、manifest、selector、smoke、evidence 和 handoff 是系统事实；不能靠聊天记忆判断要跑哪些 gate 或是否完成。

## Current Production Acceptance Path

当前生产验收只认以下 L-level，不再把单个 CO 阶段或单次 canary 当作完成态：

| level | gate | purpose | pass condition |
| --- | --- | --- | --- |
| L1 | production env/secret/schema gate | 证明生产 Portal/worker 所需 env、secret reference、PostgreSQL schema 和 route 注册形状存在 | 不读 secret 内容、不打云；只证明引用、schema 和 fail-closed 行为 |
| L2a | direct Package C lifecycle canary | 直接用 Package C runner 验证 storage/compute create/expand/release/delete | 先 dry-run，后执行，最后清理回 baseline |
| L2b | Portal click -> queued -> worker -> projection | 证明用户点击套餐只入队，独立 worker drain，projection 只读 canonical store | Portal 返回 202；worker 带 lease；普通用户不见云控制台语言 |
| L3 | billing/reconciliation/cleanup | 证明冻结金额、释放停止计费、120min 对账、T+1 状态和 cleanup evidence | 没有 queued/running orphan operation；compute released；storage 删除或保护期可审计 |
| L4 | ordinary user product lifecycle | 证明普通用户可开通、上传文件、升级、删除并看到产品态 | 用户只看到工作台资源、计算资源、文件空间、套餐、余额、冻结金额和审计状态 |

Live 验收成本控制是硬 gate：测试前 node pool desired/current baseline 必须是 `2`；测试后必须回到 `2`，并且本次创建的 compute allocation 已 release，本次创建的 storage marker 已删除或进入合同允许的保护期。禁止把平台服务池删到 0，禁止 `kubectl delete`，禁止删除 node pool 或 bucket。

## Workflow Principle

v22 cloud onboarding workflow 是状态机。每个阶段必须显式记录：

- owner
- 是否可并发
- 是否必须独立 worktree
- 是否允许读 secret
- 是否允许真实云
- required contracts
- required smoke
- success status
- blocker 回流到谁
- 什么时候必须停下来问用户

阶段推进必须满足：

- 上一阶段 success status 明确后，下一阶段才能进入可执行状态。
- 真实外部副作用必须串行，不能和其他真实副作用并发。
- 每个阶段的 blocker 必须回流到明确 owner，不允许靠下一阶段兜底。
- 涉及真实 secret、真实云、deploy/build/push/kubectl、依赖安装、merge/push 时必须停下来问用户。

## Cloud Authorization Dual Gates

Cloud 路径必须同时满足双门禁：

- Gate-A（人/流程授权门）：用户在当前会话显式授权目标范围（secret allowlist、API allowlist、region、预算、回滚边界、证据路径）。
- Gate-B（执行门）：runner / allowlist / mode 满足本合同与对应子合同约束，并且默认 fail-closed。

任一门禁未通过时必须保持 `realCloudCalls=false`。

`realCloudCalls` 只能由执行证据正向推出（授权记录 + runner 执行记录 + 脱敏 evidence）；不得由 `runnerMode`、资源物化状态或推测结果反推。

## Required State Machine

### 1. official SDK provider strategy

目标：确认 production default provider strategy 是 Tencent official SDK wrapper，TC3 仅为 diagnostic/reference。

- owner: A
- 是否可并发: 是，可与 docs/specs、smoke、fake wrapper 设计并行。
- 是否必须独立 worktree: 是。
- 是否允许读 secret: 否。
- 是否允许真实云: 否。
- required contracts: `spec:v22-tencent-readonly-inventory-boundary`, `spec:v22-production-cloud-topology-boundary`
- required smoke: `future-authorized-test-v22-tencent-official-sdk-provider-strategy-contract.mjs`
- success status: provider strategy contract accepted and smoke passed
- blocker 回流到谁: A 修合同，B 复审策略冲突
- 什么时候必须停下来问用户: provider strategy 与已有 readonly inventory / create-release 合同冲突，或需要新增 SDK 依赖、真实 secret、真实云授权

### 2. official SDK wrapper

目标：定义或实现 wrapper shell，使业务层只依赖 readonly inventory interface，不暴露 raw SDK client。

- owner: A
- 是否可并发: 是，可与合同 smoke 和 cleanup plan 并行。
- 是否必须独立 worktree: 是。
- 是否允许读 secret: 否。
- 是否允许真实云: 否。
- required contracts: `spec:v22-tencent-readonly-inventory-boundary`
- required smoke: `future-authorized-test-v22-tencent-readonly-inventory-official-sdk-wrapper-local-gate.mjs`
- success status: official SDK wrapper merged with dependency-injected local gate
- blocker 回流到谁: A 修 wrapper，B 审查 raw SDK exposure
- 什么时候必须停下来问用户: 需要安装依赖、读取 secret、启用真实 SDK fetch、或改变 create/release mutation 边界

### 3. official SDK dependency loader

目标：loader 只负责把 `tencentcloud-sdk-nodejs` package shape 包成 readonly modules factories；默认不加载 SDK package，不打云。

- owner: A
- 是否可并发: 是，但依赖安装本身不可并发执行。
- 是否必须独立 worktree: 是。
- 是否允许读 secret: 否。
- 是否允许真实云: 否。
- required contracts: `spec:v22-tencent-readonly-inventory-boundary`
- required smoke: `future-authorized-test-v22-tencent-readonly-inventory-live-runner-local-gate.mjs`, `future-authorized-test-v22-tencent-readonly-inventory-official-sdk-shape.mjs`
- success status: dependency loader contract/smoke merged; loader fail-closed by default unless `--enable-official-sdk-loader` is explicit
- blocker 回流到谁: A 修 loader，B 审查 package diff 和默认 gate
- 什么时候必须停下来问用户: 需要新增或升级 npm 依赖、修改 lockfile、加载真实 SDK package、或启用 live readonly

### 4. check-config

目标：在真实 readonly live 前确认 regions、readonly API allowlist、SDK mode、RUN gate、report 输出目录和 redaction policy 均可静态检查。

- owner: A
- 是否可并发: 是，可与 report review 模板、cleanup plan 设计并行。
- 是否必须独立 worktree: 是。
- 是否允许读 secret: 否。
- 是否允许真实云: 否。
- required contracts: `spec:v22-tencent-readonly-inventory-boundary`, `spec:v22-cloud-onboarding-workflow-boundary`
- required smoke: `future-authorized-test-v22-tencent-readonly-inventory-boundary.mjs`, `future-authorized-test-v22-tencent-readonly-inventory-live-runner-local-gate.mjs`
- success status: check-config blocks missing RUN gate, mutation API, read-all secret, and non-redacted output
- blocker 回流到谁: A 修 check-config，B 审查 gate
- 什么时候必须停下来问用户: 静态检查需要读取真实 secret 文件、source env、调用真实云或修改 deploy

### 5. default gate

目标：确认默认路径不读 secret、不加载真实 SDK、不调用真实云、不执行 mutation，不把 TC3 恢复为 production default。

- owner: B
- 是否可并发: 否，必须在 live readonly 前串行确认。
- 是否必须独立 worktree: 否，B 可在主工作区只读审查。
- 是否允许读 secret: 否。
- 是否允许真实云: 否。
- required contracts: `spec:v22-tencent-readonly-inventory-boundary`, `spec:v22-tencent-tc3-diagnostic-cleanup-plan`
- required smoke: `future-authorized-test-v22-tencent-readonly-inventory-official-sdk-wrapper-local-gate.mjs`, `future-authorized-test-v22-tencent-readonly-inventory-live-runner-local-gate.mjs`, `future-authorized-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs`
- success status: default gate confirms official SDK wrapper path is default and all live paths are opt-in
- blocker 回流到谁: B blocks; A fixes default gate or wrapper
- 什么时候必须停下来问用户: default behavior would read secret, call cloud, install dependency, push, merge, or change deploy

### 6. user-authorized readonly live

目标：在用户明确授权后，运行 official SDK readonly live，只调用 Describe/List/Get/Head 类 API，并生成脱敏 report。

- owner: user
- 是否可并发: 否，真实云 live 必须串行。
- 是否必须独立 worktree: 是。
- 是否允许读 secret: 是，但仅限用户授权的 readonly secret allowlist。
- 是否允许真实云: 是，但仅限用户授权的 readonly live。
- required contracts: `spec:v22-tencent-readonly-inventory-boundary`, `spec:v22-production-cloud-topology-boundary`
- required smoke: `future-authorized-test-v22-tencent-readonly-inventory-live-runner-local-gate.mjs`, check-config output；真实 readonly inventory live runner 只允许在当前会话显式授权后运行，证据只写 `.runtime`。
- success status: redacted readonly inventory report generated outside git
- blocker 回流到谁: user decides retry/stop; A fixes config-only blockers; B reviews safety blockers
- 什么时候必须停下来问用户: before reading secret, before real cloud call, before changing region/API allowlist, on permission/limit/account mismatch, before sharing report contents

### 7. readonly report review

目标：B 审查脱敏 readonly report，确认 topology、resource tag、cost allocation、Portal ledger 映射和 orphan/conflict 风险。

- owner: B
- 是否可并发: 否，必须等待 readonly live report。
- 是否必须独立 worktree: 否，B 可只读审查 report 摘要。
- 是否允许读 secret: 否。
- 是否允许真实云: 否。
- required contracts: `spec:v22-tencent-readonly-inventory-boundary`, `spec:v22-production-cloud-topology-boundary`, `spec:v22-tenant-resource-binding-boundary`
- required smoke: `future-authorized-test-v22-tencent-readonly-inventory-boundary.mjs`, report redaction checks
- success status: B accepts report or returns blocker list
- blocker 回流到谁: A for contract/code gaps, user for cloud/account/permission decisions, C for QA reproduction
- 什么时候必须停下来问用户: report shows unknown resources, missing tags, conflicting ownership, permission gaps, cost anomaly, or requires another real cloud read

### 8. TC3 cleanup gate

目标：确认 official SDK readonly live 已生成脱敏 report，B 确认 production default 不再依赖 TC3 后，才允许另开 cleanup 分支处理 TC3 production path。

- owner: B
- 是否可并发: 是，可与 dry-run create/release plan 合同并行；不能和真实 live 副作用并行。
- 是否必须独立 worktree: 是，cleanup 必须独立。
- 是否允许读 secret: 否。
- 是否允许真实云: 否。
- required contracts: `spec:v22-tencent-tc3-diagnostic-cleanup-plan`, `spec:v22-tencent-readonly-inventory-boundary`
- required smoke: `future-authorized-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs`
- success status: TC3 cleanup branch may start; TC3 remains diagnostic/reference until cleanup proves removal
- blocker 回流到谁: B blocks; A updates cleanup plan
- 什么时候必须停下来问用户: cleanup would delete TC3 before official SDK report review, change official SDK implementation, or touch create/release

### 9. create/release dry-run plan

目标：把 readonly evidence、topology 和 resource binding 映射成不会执行的 create/release dry-run plan。

- owner: A
- 是否可并发: 是，可与 TC3 cleanup plan、Portal copy review 和 deploy contract 并行。
- 是否必须独立 worktree: 是。
- 是否允许读 secret: 否。
- 是否允许真实云: 否。
- required contracts: `spec:v22-tencent-dry-run-resource-plan-provider-boundary`, `spec:v22-authorized-tencent-create-release-boundary`, `spec:v22-production-cloud-topology-boundary`
- required smoke: `future-authorized-test-v22-authorized-tencent-create-release-contract.mjs`, `future-authorized-test-v22-tencent-resource-lifecycle-dry-run-plan-local-gate.mjs`
- success status: dry-run create/release plan produces tenant node pool lifecycle plan with no mutation and no charge
- blocker 回流到谁: A fixes plan, B reviews mutation leakage
- 什么时候必须停下来问用户: dry-run plan wants to call real cloud, read mutation secret, alter ledger, or expose cloud console language to ordinary users

### 10. TKE bootstrap preflight

目标：当 Package C mutation env 缺少 TKE cluster / platform service node pool identifiers 时，先把 operator 需要创建或选择的 TKE foundation 转成 local-only checklist，而不是填假值或直接执行 live mutation。tenant node pool 不由 foundation 预置，必须由 Package C 在租户或工作台开通时创建。

- owner: A
- 是否可并发: 是，可与 mutation wrapper contract 和 report review 并行；不得与真实云副作用并发。
- 是否必须独立 worktree: 是。
- 是否允许读 secret: 否。
- 是否允许真实云: 否。
- required contracts: `spec:v22-tke-bootstrap-preflight-boundary`, `spec:v22-production-cloud-topology-boundary`, `spec:v22-authorized-tencent-create-release-boundary`
- required smoke: `future-authorized-test-v22-tke-bootstrap-preflight-local-gate.mjs`
- success status: local preflight names target region/VPC, one unified TKE cluster, platform service pool, tenant node pool creation strategy, PostgreSQL / COS / CBS data plane and the exact Package C env fields to fill after readonly observation
- blocker 回流到谁: A fixes preflight contract/code; user creates or authorizes creation of the cloud foundation; B reviews side-effect boundary
- 什么时候必须停下来问用户: preflight would read secret, call real cloud, create/modify resource, run kubectl/deploy/build-push/live-test, or claim production readiness

### 11. mutation SDK wrapper

目标：定义 mutation SDK wrapper 的最小接口、独立 RUN gate、独立 mutation secret allowlist、operation budget 和 fail-closed behavior。

- owner: A
- 是否可并发: 是，仅限 fake wrapper、contract、smoke；不得与真实 create/release live 并发。
- 是否必须独立 worktree: 是。
- 是否允许读 secret: 否。
- 是否允许真实云: 否。
- required contracts: `spec:v22-authorized-tencent-create-release-implementation-boundary`, `spec:v22-authorized-tencent-create-release-execution-boundary`
- required smoke: `future-authorized-test-v22-authorized-tencent-create-release-implementation-contract.mjs`, `future-authorized-test-v22-authorized-tencent-create-release-execution-contract.mjs`
- success status: mutation wrapper shell is gated, fake-only by default, and separate from readonly runner/secret
- blocker 回流到谁: A fixes wrapper, B reviews side-effect boundary
- 什么时候必须停下来问用户: need mutation secret, real API, SDK dependency change, build/push, kubectl, or deploy change

### 12. minimal authorized create/release live

目标：在用户明确授权后，对最小资源集合执行真实 create/release live，并按 Portal ledger + cloud tags 双重校验、预算和回滚策略执行。

- owner: user
- 是否可并发: 否，create/release 必须串行。
- 是否必须独立 worktree: 是。
- 是否允许读 secret: 是，但仅限用户授权的 mutation secret allowlist。
- 是否允许真实云: 是，但仅限用户授权的 minimal create/release live。
- required contracts: `spec:v22-authorized-tencent-create-release-boundary`, `spec:v22-authorized-tencent-create-release-implementation-boundary`, `spec:v22-authorized-tencent-create-release-execution-boundary`
- required smoke: execution contract smoke, preflight dry-run diff, rollback/audit smoke
- success status: minimal live operation completed, tagged, ledgered, audited, and rollback-ready
- blocker 回流到谁: user decides stop/retry; A fixes implementation; B reviews evidence before further mutation
- 什么时候必须停下来问用户: before reading mutation secret, before each real mutation, on budget/ownership/tag mismatch, before retry, before rollback with side effect, before expanding scope

### 13. production deploy execution

目标：在用户明确授权后执行 production deploy/build/push/kubectl 路径，且只按已审查 deploy plan 执行。

- owner: user
- 是否可并发: 否，deploy/build/push/kubectl 必须串行。
- 是否必须独立 worktree: 是。
- 是否允许读 secret: 是，但仅限用户授权的 deploy secret/kubeconfig/registry allowlist。
- 是否允许真实云: 是，但仅限用户授权的 production deploy execution。
- required contracts: `spec:v22-production-cloud-topology-boundary`, `spec:v22-authorized-tencent-deploy-execution-boundary`, `spec:v22-cloud-onboarding-workflow-boundary`
- required smoke: deploy plan smoke, local build/deploy dry-run smoke, workflow gate review
- success status: deployment executed with versioned evidence and rollback plan
- blocker 回流到谁: user decides stop/rollback; A fixes deploy plan; B reviews evidence; C runs QA
- 什么时候必须停下来问用户: before build, before push, before kubectl, before changing deploy, before reading kubeconfig/registry secret, before rollback

Package D production deploy execution 必须订阅 `spec:v22-authorized-tencent-deploy-execution-boundary`。Package D release plan 是唯一允许的 deploy 输入形状：它显式列出 portal.medopl.cn、opl.medopl.cn、trace.medopl.cn runtime smoke surfaces，并逐 target 绑定 repository、imageTargetRef、sourceRoot、namespace、workload、container、targetClass、ownerRef、operationId 和 expectedVersionMarker。平台服务 target 使用 `platform_service_target`，只强制 `ownerRef/operationId`；workspace runtime target 使用 `workspace_runtime_target`，必须额外绑定 `workspaceId/resourceBindingId`。zero-compat active repo 不保留默认 Dockerfile / deploy asset；真实 build recipe 需未来单独授权。

Package D 不授权 Package C 的资源生命周期动作：不得创建、删除、释放或扩缩容 TKE node pool，不得创建、删除、清空或扩容 COS bucket / prefix / object。Package D 禁止 `kubectl delete`，禁止 `DeleteNodePool`，禁止 `CreateNodePool`、`ScaleNodePool`、`ModifyNodePoolDesiredCapacityAboutAsg`，禁止删除 bucket/prefix/object，禁止跨 namespace 或 cluster-wide mutation。

### 14. Portal production integration

目标：将 Portal 生产路径接入已授权云事实，但普通用户仍只看到工作台资源、文件空间、预计费用、释放策略和审计状态。

- owner: A
- 是否可并发: 是，可与 QA checklist 和 release status draft 并行；不得与真实 deploy/mutation 并发。
- 是否必须独立 worktree: 是。
- 是否允许读 secret: 否。
- 是否允许真实云: 否。
- required contracts: `spec:v22-portal-user-surface-boundary`, `spec:v22-portal-admin-ops-surface-boundary`, `spec:v22-portal-files-billing-trace-boundary`, `spec:v22-cloud-onboarding-workflow-boundary`
- required smoke: portal payload contract smoke, portal role surface smoke, mobile usability smoke
- success status: Portal consumes sanitized production projection without cloud console leakage
- blocker 回流到谁: A fixes Portal/API; B reviews role boundary; C runs UI QA
- 什么时候必须停下来问用户: Portal would expose secret/internal storage/cloud console language, alter billing truth, or require real cloud read

#### Portal API test-only local-executor bridge

在 Portal production integration 之前，允许存在一个本地 smoke 专用的 test-only local-executor bridge，用来验证 Portal API、PostgreSQL canonical shape、Package C local-executor operation 状态回写和普通用户 projection 的闭环。

测试路径：

- `POST /api/v22/cloud-operations/test/local`
- `GET /api/v22/cloud-operations/test/projection?workspaceId=<workspace-id>`

边界：

- 该 API 只能用于本地 smoke 和合同验证，必须返回 `testOnly=true`、`productionPortalConnected=false`、`runnerMode=local-executor`、`realCloudCalls=false`。
- 该 API 默认不注册到 Portal route。只有 `PORTAL_ENABLE_CLOUD_OPERATION_TEST_BRIDGE=1` 且 `NODE_ENV` 不是 `production` 时才允许注册；production 环境必须强制关闭，即使设置该 env 也不能启用。
- 该 API 不读 secret、不调用真实云、不执行真实 TKE/COS/TCR/deploy、不写真实 `.runtime` evidence。
- 该 API 只写与未来真实 Portal 一致的 canonical record shape：`cloudOperations`、`computeAllocations`、`fileSpaceEntitlements`、`cloudResourceProjections`、`workspaceResourceBindings`、`weeklyProtectionFreezes` / wallet ledger、`billingReconciliations`、`auditEvents`。
- 支持的测试操作仅限：`create_storage`、`create_compute`、`expand_storage`、`expand_compute`、`release_compute`、`delete_storage`。
- 后续真实 Portal 可以复用同一 canonical shape，但必须替换为正式 Portal route、真实 PostgreSQL persistence、授权 runner queue 和用户确认链路；不得把该测试 API 当作生产 Portal 已接云。
- 普通用户 projection 只能显示工作台资源、计算资源、文件空间、套餐、余额、冻结金额、开通中、可用、扩容中、释放中、文件保护期、对账中、对账异常等产品语言；不得展示 CVM、COS、TKE、Kubernetes、node pool、bucket、object key、VPC、安全组、kubeconfig、SecretId、SecretKey 或 raw response。

### 14. canary / QA / release status update

目标：C/D 对生产路径做 canary、QA 和 release status update，B 汇总是否可推进 release。

- owner: C
- 是否可并发: 是，QA/canary/status 文档可以并行；真实外部副作用仍串行。
- 是否必须独立 worktree: 是，QA/report/status 更新必须独立于 deploy/mutation worktree。
- 是否允许读 secret: 否，除非用户另行授权只读 canary 所需 key。
- 是否允许真实云: 否，除非用户另行授权 canary。
- required contracts: `spec:v22-cloud-onboarding-workflow-boundary`, role surface contracts, release/status docs
- required smoke: canary/QA smoke, MVP suite, workflow gate review
- success status: C_PASS or B_BLOCKER with release status updated
- blocker 回流到谁: C files repro, A fixes, B decides merge/release, user authorizes any further live action
- 什么时候必须停下来问用户: QA needs live credentials, canary calls real service, release status implies production readiness, or rollout expands blast radius

## Serial External Side Effects

真实外部副作用必须串行：

- 真实云 live。
- create/release。
- deploy/build/push/kubectl。
- 依赖安装。
- merge/push。

这些动作不得由 workflow 自动执行，不得和其他真实副作用并发，不得在没有用户当前会话明确授权时发生。任何阶段如果要进入上述动作，必须停下来问用户。

## Parallelizable Work

可并发项：

- docs/specs。
- smoke。
- fake wrapper。
- cleanup plan。
- topology/deploy contract。

这些工作仍必须使用独立 worktree，并且不得读取 secret、不得调用真实云、不得执行 build/push/kubectl/live-test。

## Future Authorized Cloud Connection Path

当前接云模块只把 R-00 到 R-21 记录为 future authorized / cloud-lane candidate 闭环验证路径；它不是默认可运行路径。旧 `CO-01..CO-14` 只保留为历史阶段和状态说明，不再作为新验收主线。`C00`、`C01`、`C02`、`C03`、`C04` 也不得作为当前 gate id、task packet id 或完成状态使用。

| step | gate | authorization package | entrypoint | artifact path | pass condition |
| --- | --- | --- | --- | --- | --- |
| R-00 local contract guard | CC-01 | none | repo root | stdout JSON only | 合同、board、status、workflow task packet 口径一致 |
| R-01 SDK dependency install | CC-01 | dependency_install | `services/portal` | `services/portal/package.json`; `services/portal/package-lock.json` | 只增加经审查 SDK dependency diff |
| R-02 SDK shape smoke | CC-01 | dependency_install | repo root | stdout JSON only | Tencent SDK 和 COS SDK shape 被证明或 fail-closed |
| R-03 readonly preflight | CC-02 | readonly_connection | repo root | stdout JSON only | RUN gate、readonly secret allowlist、region/API allowlist 和 redaction 规则通过 |
| R-04 readonly live report | CC-02 | readonly_connection | repo root | `.runtime/v22-tencent-readonly-inventory/<authorized-run-id>.json` | 脱敏 report 证明账号、region、TKE、COS、billing、tag/cost allocation 可读 |
| R-05 Portal canonical operation smoke | CC-03 | local_contract_smoke | repo root | stdout JSON only | Portal click/test API 写入 canonical operation、binding、file space、compute、ledger、audit 形状 |
| R-06 storage dry-run | CC-04 | authorized_resource_lifecycle | repo root | `.runtime/v22-cloud-lifecycle/<operation-id>-storage-dry-run.json` | dry-run 写明 workspace、file space、COS scope、预算和 rollback/retention policy，且不 mutation |
| R-07 authorized storage execution | CC-04 | authorized_resource_lifecycle | repo root | `.runtime/v22-cloud-lifecycle/<operation-id>-storage-execution.json` | 授权后执行最小 storage create/expand/delete，并回写 Portal/audit |
| R-08 compute dry-run | CC-05 | authorized_resource_lifecycle | repo root | `.runtime/v22-cloud-lifecycle/<operation-id>-compute-dry-run.json` | dry-run 写明已有 TKE cluster、namespace/quota/workload class/node pool capacity，且不 mutation |
| R-09 authorized compute execution | CC-05 | authorized_resource_lifecycle | repo root | `.runtime/v22-cloud-lifecycle/<operation-id>-compute-execution.json` | 授权后执行最小 compute create/expand/release，并保持 file space retained |
| R-10 Portal projection smoke | CC-03 | local_contract_smoke | repo root | stdout JSON only | 普通用户 projection 只展示工作台/计算/文件空间/账单状态，不展示云控制台对象 |
| R-11 expand storage dry-run and execution | CC-04 | authorized_resource_lifecycle | repo root | `.runtime/v22-cloud-lifecycle/<operation-id>-storage-expand.json` | 文件空间 entitlement、费用冻结估算和 audit event 更新 |
| R-12 expand compute dry-run and execution | CC-05 | authorized_resource_lifecycle | repo root | `.runtime/v22-cloud-lifecycle/<operation-id>-compute-expand.json` | namespace quota、workload class 或 node pool capacity 更新，Portal projection 同步 |
| R-13 COS billing checkpoint | CC-06 | readonly_connection | repo root | `.runtime/v22-cloud-reconciliation/<run-id>.json` | billing summary、COS usage、Portal ledger、cloud tag/cost allocation 可对账或产出 blocker |
| R-14 TCR repository/tag preflight | CC-07 | deploy_and_production_integration | repo root | `.runtime/v22-registry/<run-id>.json` | release plan 内每个 target repository/tag/digest 预检通过，禁止 `latest` |
| R-15 multi-image build and push unique test tag | CC-07 | deploy_and_production_integration | repo root | `.runtime/v22-registry/<run-id>.json` | 每个 target image push 唯一 test tag，并读回 digest |
| R-16 deploy dry-run | CC-07 | deploy_and_production_integration | repo root | `.runtime/v22-cloud-deploy/<run-id>.json` | dry-run 限定在 release plan 指定 namespace/workload/container，并有 rollback target |
| R-17 authorized deploy rollout | CC-07 | deploy_and_production_integration | repo root | `.runtime/v22-cloud-deploy/<run-id>.json` | 授权后 rollout 成功或 rollback evidence 完整 |
| R-18 runtime smoke | CC-07 | deploy_and_production_integration | repo root | `.runtime/v22-runtime-smoke/<run-id>.json` | `portal.medopl.cn`、`opl.medopl.cn`、`trace.medopl.cn` 证明推送版本运行且无 secret 泄漏 |
| R-19 release compute | CC-05 | authorized_resource_lifecycle | repo root | `.runtime/v22-cloud-lifecycle/<operation-id>-compute-release.json` | compute allocation 释放、计算计费停止、file space 保留 |
| R-20 delete file space | CC-04 | authorized_resource_lifecycle | repo root | `.runtime/v22-cloud-lifecycle/<operation-id>-storage-delete.json` | file space 进入 7 天保护期或有审计永久清理记录 |
| R-21 final reconciliation cleanup and B review | CC-REVIEW | manual_b_review | repo root | `.runtime/v22-cloud-cleanup/<run-id>.json` | billing、COS、TKE、TCR、deploy、runtime smoke、cleanup evidence 被 B 接受或返回 blocker |

任何 R-step 都不得把 raw provider response、SecretId、SecretKey、token、kubeconfig、object key、signed URL 或 COS object body 写入 stdout、`.runtime`、docs、git 或 Portal payload。

## Workflow Non-Goals

本 workflow 不自动 merge、不自动 push、不读 secret、不调用真实云；只能生成任务包、可跑路径和下一步建议。

本分支只允许 `scripts/v22-workflow-gate.mjs cloud-onboarding status --json` 输出 future authorized task packet 形状；这些 task packet 默认 blocked，不新增真实云执行能力、不读 secret、不执行 build/push/kubectl。

## Contract Data

<!-- v22-cloud-onboarding-workflow-contract:start -->
```json
{
  "contract": "v22_cloud_onboarding_workflow_boundary",
  "version": 1,
  "replacesAgentsMd": false,
  "agentsMdRole": "AGENTS.md 管 A/B/C/D 纪律",
  "contractRole": "本合同管业务推进顺序",
  "automerges": false,
  "autopushes": false,
  "readsSecretNow": false,
  "callsRealCloudNow": false,
  "installsDependencyNow": false,
  "executesMutationNow": false,
  "runsBuildPushKubectlNow": false,
  "oldCoPhaseStateMachineRetired": true,
  "activeGatePrefix": "CC",
  "retiredLegacyGateAliases": [
    "C00",
    "C01",
    "C02",
    "C03",
    "C04",
    "CO-01..CO-14"
  ],
  "loopName": "cloud_harness_native_async_lifecycle_loop",
  "harnessManifest": "docs/delivery/README.md",
  "productionAcceptanceLevels": [
    "L1",
    "L2a",
    "L2b",
    "L3",
    "L4"
  ],
  "liveBaselineDesiredCapacity": 2,
  "cleanupRequiredForLiveRuns": true,
  "generatesOnlyTaskPackagesAndNextStepSuggestions": true,
  "scriptLaneType": "cloud-onboarding",
  "implementsScriptLogicNow": true,
  "serialExternalSideEffects": [
    "真实云 live",
    "create/release",
    "deploy/build/push/kubectl",
    "依赖安装",
    "merge/push"
  ],
  "parallelizableWork": [
    "docs/specs",
    "smoke",
    "fake wrapper",
    "cleanup plan",
    "topology/deploy contract"
  ],
  "authorizationPackages": [
    "dependency_install",
    "readonly_connection",
    "authorized_resource_lifecycle",
    "deploy_and_production_integration"
  ],
  "futureAuthorizedPath": [
    { "step": "R-00", "gateId": "CC-01", "authorizationPackage": "none", "entrypoint": "repo root", "artifactPath": "stdout JSON only", "blockerWriteback": "docs/delivery/README.md" },
    { "step": "R-01", "gateId": "CC-01", "authorizationPackage": "dependency_install", "entrypoint": "services/portal", "artifactPath": "services/portal/package.json and services/portal/package-lock.json", "blockerWriteback": "docs/delivery/README.md" },
    { "step": "R-02", "gateId": "CC-01", "authorizationPackage": "dependency_install", "entrypoint": "repo root", "artifactPath": "stdout JSON only", "blockerWriteback": "docs/delivery/README.md" },
    { "step": "R-03", "gateId": "CC-02", "authorizationPackage": "readonly_connection", "entrypoint": "repo root", "artifactPath": "stdout JSON only", "blockerWriteback": "docs/delivery/README.md" },
    { "step": "R-04", "gateId": "CC-02", "authorizationPackage": "readonly_connection", "entrypoint": "repo root", "artifactPath": ".runtime/v22-tencent-readonly-inventory/<authorized-run-id>.json", "blockerWriteback": "docs/delivery/README.md" },
    { "step": "R-05", "gateId": "CC-03", "authorizationPackage": "local_contract_smoke", "entrypoint": "repo root", "artifactPath": "stdout JSON only", "blockerWriteback": "docs/specs/README.md" },
    { "step": "R-06", "gateId": "CC-04", "authorizationPackage": "authorized_resource_lifecycle", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-lifecycle/<operation-id>-storage-dry-run.json", "blockerWriteback": "docs/delivery/README.md" },
    { "step": "R-07", "gateId": "CC-04", "authorizationPackage": "authorized_resource_lifecycle", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-lifecycle/<operation-id>-storage-execution.json", "blockerWriteback": "cloud operation row and docs/delivery/README.md" },
    { "step": "R-08", "gateId": "CC-05", "authorizationPackage": "authorized_resource_lifecycle", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-lifecycle/<operation-id>-compute-dry-run.json", "blockerWriteback": "docs/delivery/README.md" },
    { "step": "R-09", "gateId": "CC-05", "authorizationPackage": "authorized_resource_lifecycle", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-lifecycle/<operation-id>-compute-execution.json", "blockerWriteback": "cloud operation row and CC-05 status" },
    { "step": "R-10", "gateId": "CC-03", "authorizationPackage": "local_contract_smoke", "entrypoint": "repo root", "artifactPath": "stdout JSON only", "blockerWriteback": "docs/specs/README.md and CC-03 blocker" },
    { "step": "R-11", "gateId": "CC-04", "authorizationPackage": "authorized_resource_lifecycle", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-lifecycle/<operation-id>-storage-expand.json", "blockerWriteback": "cloud operation row and CC-04 status" },
    { "step": "R-12", "gateId": "CC-05", "authorizationPackage": "authorized_resource_lifecycle", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-lifecycle/<operation-id>-compute-expand.json", "blockerWriteback": "cloud operation row and CC-05 status" },
    { "step": "R-13", "gateId": "CC-06", "authorizationPackage": "readonly_connection", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-reconciliation/<run-id>.json", "blockerWriteback": "billing_reconciliation record and CC-06 blocker" },
    { "step": "R-14", "gateId": "CC-07", "authorizationPackage": "deploy_and_production_integration", "entrypoint": "repo root", "artifactPath": ".runtime/v22-registry/<run-id>.json", "blockerWriteback": "CC-07 blocker and registry preflight evidence" },
    { "step": "R-15", "gateId": "CC-07", "authorizationPackage": "deploy_and_production_integration", "entrypoint": "repo root", "artifactPath": ".runtime/v22-registry/<run-id>.json", "blockerWriteback": "CC-07 blocker and registry evidence" },
    { "step": "R-16", "gateId": "CC-07", "authorizationPackage": "deploy_and_production_integration", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-deploy/<run-id>.json", "blockerWriteback": "CC-07 blocker and deploy dry-run evidence" },
    { "step": "R-17", "gateId": "CC-07", "authorizationPackage": "deploy_and_production_integration", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-deploy/<run-id>.json", "blockerWriteback": "CC-07 blocker and rollout evidence" },
    { "step": "R-18", "gateId": "CC-07", "authorizationPackage": "deploy_and_production_integration", "entrypoint": "repo root", "artifactPath": ".runtime/v22-runtime-smoke/<run-id>.json", "blockerWriteback": "CC-07 blocker and runtime smoke evidence" },
    { "step": "R-19", "gateId": "CC-05", "authorizationPackage": "authorized_resource_lifecycle", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-lifecycle/<operation-id>-compute-release.json", "blockerWriteback": "cloud operation row and CC-05 status" },
    { "step": "R-20", "gateId": "CC-04", "authorizationPackage": "authorized_resource_lifecycle", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-lifecycle/<operation-id>-storage-delete.json", "blockerWriteback": "cloud operation row and CC-04 status" },
    { "step": "R-21", "gateId": "CC-REVIEW", "authorizationPackage": "manual_b_review", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-cleanup/<run-id>.json", "blockerWriteback": "B review note" }
  ],
  "portalApiTestBridge": {
    "testOnly": true,
    "productionPortalConnected": false,
    "runnerMode": "local-executor",
    "realCloudCalls": false,
    "readsSecretNow": false,
    "defaultRouteEnabled": false,
    "enableEnv": "PORTAL_ENABLE_CLOUD_OPERATION_TEST_BRIDGE",
    "requiresEnableEnvValue": "1",
    "forbidsProductionRouteRegistration": true,
    "apiPaths": [
      "POST /api/v22/cloud-operations/test/local",
      "GET /api/v22/cloud-operations/test/projection"
    ],
    "operations": [
      "create_storage",
      "create_compute",
      "expand_storage",
      "expand_compute",
      "release_compute",
      "delete_storage"
    ],
    "canonicalRecords": [
      "cloudOperations",
      "computeAllocations",
      "fileSpaceEntitlements",
      "cloudResourceProjections",
      "workspaceResourceBindings",
      "weeklyProtectionFreezes",
      "walletLedger",
      "billingReconciliations",
      "auditEvents"
    ],
    "futureProductionPortalMustReplaceTestRoute": true,
    "ordinaryProjectionHidesCloudConsoleObjects": true
  },
  "packageD": {
    "contract": "docs/specs/README.md",
    "authorizationPackage": "deploy_and_production_integration",
    "readsDeploySecretNow": false,
    "runsBuildPushKubectlNow": false,
    "modifiesTkeNodePool": false,
    "modifiesCosStorage": false,
    "forbidsLatestTag": true,
    "requiresUniqueTag": true,
    "requiresDigestVerification": true,
    "requiresDeployDryRunBeforeApply": true,
    "requiresRuntimeSmokeForPushedVersion": true,
    "requiresRollbackEvidence": true,
    "runnableSteps": [
      "R-14",
      "R-15",
      "R-16",
      "R-17",
      "R-18"
    ],
    "secretAllowlist": [
      "RUN_TENCENT_DEPLOY_EXECUTION",
      "TCR_ID",
      "TCR_SECRET",
      "TENCENT_TCR_REGISTRY",
      "TENCENT_TCR_NAMESPACE",
      "TENCENT_TCR_REGION",
      "TENCENT_DEPLOY_CLUSTER_ID",
      "TENCENT_DEPLOY_KUBECONFIG_REF"
    ],
    "releasePlan": {
      "required": true,
      "singleNamespaceOnly": true,
      "requiresMultipleTargets": true,
      "forbidsSingleImageAllInOneAssumption": true,
      "targetClasses": {
        "platform_service_target": {
          "requiresWorkspaceBinding": false,
          "requiredOwnerGuard": [
            "ownerRef",
            "operationId"
          ]
        },
        "workspace_runtime_target": {
          "requiresWorkspaceBinding": true,
          "requiredOwnerGuard": [
            "ownerRef",
            "operationId",
            "workspaceId",
            "resourceBindingId"
          ]
        }
      },
      "runtimeSmokeTargetsRequired": [
        "portal",
        "opl",
        "trace"
      ],
      "defaultRuntimeSmokeUrls": {
        "portal": "https://portal.medopl.cn/healthz",
        "opl": "https://opl.medopl.cn/healthz",
        "trace": "https://trace.medopl.cn/api/public/health"
      },
      "traceSurfaceIsNotImplicitImageTarget": true
    },
    "allowedAfterCurrentSessionExplicitAuthorizationKubectlActions": [
      "kubectl diff",
      "kubectl server-side dry-run",
      "kubectl apply",
      "kubectl rollout status",
      "kubectl get",
      "kubectl rollout undo"
    ],
    "forbiddenActions": [
      "kubectl delete",
      "DeleteNodePool",
      "CreateNodePool",
      "ScaleNodePool",
      "ModifyNodePoolDesiredCapacityAboutAsg",
      "deleteBucket",
      "deletePrefix",
      "deleteObject",
      "emptyBucket",
      "crossNamespaceMutation",
      "clusterWideMutation",
      "modifySecret",
      "modifyCRD",
      "modifyIngress"
    ]
  },
  "phases": [
    {
      "name": "official SDK provider strategy",
      "owner": "A",
      "parallelizable": true,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/specs/README.md",
        "docs/specs/README.md"
      ],
      "requiredSmoke": [
        "tests/future-authorized/cloud/future-authorized-test-v22-tencent-official-sdk-provider-strategy-contract.mjs"
      ],
      "successStatus": "provider strategy contract accepted and smoke passed",
      "blockerReturnsTo": "A; B reviews strategy conflicts",
      "mustStopAndAskUserWhen": [
        "strategy conflicts with readonly inventory or create/release contracts",
        "new SDK dependency or real cloud authorization is needed"
      ]
    },
    {
      "name": "official SDK wrapper",
      "owner": "A",
      "parallelizable": true,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/specs/README.md"
      ],
      "requiredSmoke": [
        "tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-official-sdk-wrapper.mjs"
      ],
      "successStatus": "official SDK wrapper shell merged with static smoke",
      "blockerReturnsTo": "A; B reviews raw SDK exposure",
      "mustStopAndAskUserWhen": [
        "dependency install is needed",
        "real SDK fetch or secret read is needed",
        "create/release mutation boundary changes"
      ]
    },
    {
      "name": "official SDK dependency loader",
      "owner": "A",
      "parallelizable": true,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/specs/README.md"
      ],
      "requiredSmoke": [
        "tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs"
      ],
      "successStatus": "dependency loader contract/smoke merged and fail-closed by default",
      "blockerReturnsTo": "A; B reviews package diff and default gate",
      "mustStopAndAskUserWhen": [
        "npm dependency or lockfile changes are needed",
        "live readonly execution is needed"
      ]
    },
    {
      "name": "check-config",
      "owner": "A",
      "parallelizable": true,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/specs/README.md",
        "docs/specs/README.md"
      ],
      "requiredSmoke": [
        "tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-boundary.mjs",
        "tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs"
      ],
      "successStatus": "check-config blocks missing gate, mutation API, read-all secret, and non-redacted output",
      "blockerReturnsTo": "A; B reviews gate",
      "mustStopAndAskUserWhen": [
        "check-config needs to read a real secret file",
        "check-config needs to call real cloud or modify deploy"
      ]
    },
    {
      "name": "default gate",
      "owner": "B",
      "parallelizable": false,
      "requiresIndependentWorktree": false,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/specs/README.md",
        "docs/specs/README.md"
      ],
      "requiredSmoke": [
        "tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-official-sdk-wrapper.mjs",
        "tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs",
        "tests/future-authorized/cloud/future-authorized-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs"
      ],
      "successStatus": "default gate confirms official SDK wrapper path is default and all live paths are opt-in",
      "blockerReturnsTo": "B blocks; A fixes default gate or wrapper",
      "mustStopAndAskUserWhen": [
        "default behavior would read secret or call cloud",
        "default behavior would install dependency, push, merge, or change deploy"
      ]
    },
    {
      "name": "user-authorized readonly live",
      "owner": "user",
      "parallelizable": false,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": true,
      "realCloudAllowed": true,
      "requiredContracts": [
        "docs/specs/README.md",
        "docs/specs/README.md"
      ],
      "requiredSmoke": [
        "tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-bridge-local-gate.mjs",
        "check-config output"
      ],
      "successStatus": "redacted readonly inventory report generated outside git",
      "blockerReturnsTo": "user decides retry/stop; A fixes config-only blockers; B reviews safety blockers",
      "mustStopAndAskUserWhen": [
        "before reading readonly secret",
        "before real cloud call",
        "before changing region or API allowlist",
        "on permission, limit, or account mismatch",
        "before sharing report contents"
      ]
    },
    {
      "name": "readonly report review",
      "owner": "B",
      "parallelizable": false,
      "requiresIndependentWorktree": false,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/specs/README.md",
        "docs/specs/README.md",
        "docs/specs/README.md"
      ],
      "requiredSmoke": [
        "tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-boundary.mjs",
        "report redaction checks"
      ],
      "successStatus": "B accepts report or returns blocker list",
      "blockerReturnsTo": "A for contract/code gaps; user for cloud/account/permission decisions; C for QA reproduction",
      "mustStopAndAskUserWhen": [
        "report shows unknown resources or missing tags",
        "report shows conflicting ownership, permission gaps, or cost anomaly",
        "another real cloud read is needed"
      ]
    },
    {
      "name": "TC3 cleanup gate",
      "owner": "B",
      "parallelizable": true,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/specs/README.md",
        "docs/specs/README.md"
      ],
      "requiredSmoke": [
        "tests/future-authorized/cloud/future-authorized-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs"
      ],
      "successStatus": "TC3 cleanup branch may start; TC3 remains diagnostic/reference until cleanup proves removal",
      "blockerReturnsTo": "B blocks; A updates cleanup plan",
      "mustStopAndAskUserWhen": [
        "cleanup would delete TC3 before official SDK report review",
        "cleanup would change official SDK implementation or create/release"
      ]
    },
    {
      "name": "create/release dry-run plan",
      "owner": "A",
      "parallelizable": true,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/specs/README.md",
        "docs/specs/README.md",
        "docs/specs/README.md"
      ],
      "requiredSmoke": [
        "tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-contract.mjs",
        "tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-contract.mjs"
      ],
      "successStatus": "dry-run create/release plan produces no mutation and no charge",
      "blockerReturnsTo": "A fixes plan; B reviews mutation leakage",
      "mustStopAndAskUserWhen": [
        "dry-run plan wants to call real cloud or read mutation secret",
        "dry-run plan would alter ledger or expose cloud console language to ordinary users"
      ]
    },
    {
      "name": "TKE bootstrap preflight",
      "owner": "A",
      "parallelizable": true,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/specs/README.md",
        "docs/specs/README.md",
        "docs/specs/README.md"
      ],
      "requiredSmoke": [
        "tests/future-authorized/cloud/future-authorized-test-v22-tke-bootstrap-preflight-local-gate.mjs"
      ],
      "successStatus": "local preflight names TKE foundation and required Package C env fields without mutation",
      "blockerReturnsTo": "A fixes preflight contract/code; user creates or authorizes cloud foundation; B reviews side-effect boundary",
      "mustStopAndAskUserWhen": [
        "preflight wants to read secret or call real cloud",
        "preflight would create/modify resources, run kubectl/deploy/build-push/live-test, or claim production readiness"
      ]
    },
    {
      "name": "mutation SDK wrapper",
      "owner": "A",
      "parallelizable": true,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/specs/README.md",
        "docs/specs/README.md"
      ],
      "requiredSmoke": [
        "tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-implementation-contract.mjs",
        "tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-execution-contract.mjs"
      ],
      "successStatus": "mutation wrapper shell is gated, fake-only by default, and separate from readonly runner/secret",
      "blockerReturnsTo": "A fixes wrapper; B reviews side-effect boundary",
      "mustStopAndAskUserWhen": [
        "mutation secret or real API is needed",
        "SDK dependency change, build/push, kubectl, or deploy change is needed"
      ]
    },
    {
      "name": "minimal authorized create/release live",
      "owner": "user",
      "parallelizable": false,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": true,
      "realCloudAllowed": true,
      "requiredContracts": [
        "docs/specs/README.md",
        "docs/specs/README.md",
        "docs/specs/README.md"
      ],
      "requiredSmoke": [
        "execution contract smoke",
        "preflight dry-run diff",
        "rollback/audit smoke"
      ],
      "successStatus": "minimal live operation completed, tagged, ledgered, audited, and rollback-ready",
      "blockerReturnsTo": "user decides stop/retry; A fixes implementation; B reviews evidence before further mutation",
      "mustStopAndAskUserWhen": [
        "before reading mutation secret",
        "before each real mutation",
        "on budget, ownership, or tag mismatch",
        "before retry or rollback with side effect",
        "before expanding scope"
      ]
    },
    {
      "name": "production deploy execution",
      "owner": "user",
      "parallelizable": false,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": true,
      "realCloudAllowed": true,
      "requiredContracts": [
        "docs/specs/README.md",
        "deploy plan contract",
        "docs/specs/README.md"
      ],
      "requiredSmoke": [
        "deploy plan smoke",
        "local build/deploy dry-run smoke",
        "workflow gate review"
      ],
      "successStatus": "deployment executed with versioned evidence and rollback plan",
      "blockerReturnsTo": "user decides stop/rollback; A fixes deploy plan; B reviews evidence; C runs QA",
      "mustStopAndAskUserWhen": [
        "before build",
        "before push",
        "before kubectl",
        "before changing deploy",
        "before reading kubeconfig or registry secret",
        "before rollback"
      ]
    },
    {
      "name": "Portal production integration",
      "owner": "A",
      "parallelizable": true,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/specs/README.md",
        "docs/specs/README.md",
        "docs/specs/README.md",
        "docs/specs/README.md"
      ],
      "requiredSmoke": [
        "portal payload contract smoke",
        "portal role surface smoke",
        "mobile usability smoke"
      ],
      "successStatus": "Portal consumes sanitized production projection without cloud console leakage",
      "blockerReturnsTo": "A fixes Portal/API; B reviews role boundary; C runs UI QA",
      "mustStopAndAskUserWhen": [
        "Portal would expose secret, internal storage, or cloud console language",
        "Portal would alter billing truth or require real cloud read"
      ]
    },
    {
      "name": "canary / QA / release status update",
      "owner": "C",
      "parallelizable": true,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/specs/README.md",
        "role surface contracts",
        "release/status docs"
      ],
      "requiredSmoke": [
        "canary/QA smoke",
        "tests/contract/contract-test-v22-mvp-contract-suite.mjs",
        "workflow gate review"
      ],
      "successStatus": "C_PASS or B_BLOCKER with release status updated",
      "blockerReturnsTo": "C files repro; A fixes; B decides merge/release; user authorizes any further live action",
      "mustStopAndAskUserWhen": [
        "QA needs live credentials",
        "canary calls real service",
        "release status implies production readiness",
        "rollout expands blast radius"
      ]
    }
  ]
}
```
<!-- v22-cloud-onboarding-workflow-contract:end -->

### spec:v22-langfuse-observability-metadata-boundary

Former leaf id: `v22-langfuse-observability-metadata-boundary`
Former title: v22 Langfuse Observability Metadata Boundary Contract

本合同定义 MedOPL v22 中 Langfuse 作为 optional observability attachment（可选观测附件）时的 metadata 边界，只约束合同和静态 smoke，不接真实 Langfuse，不改 runtime 实现。

## Product Boundary

Runtime Bridge session/run metadata 是 MedOPL 业务事实，负责 `workspace`、`run`、`artifact`、`resourceBinding`、`providerKeyRef`、`billing/cost summary`、`release/audit` 关联，是 Portal / Billing / Audit 的业务事实源。

Runtime Bridge metadata 责任字段按合同表达为：workspace、run、artifact、resourceBinding、providerKeyRef、billing/cost summary、release/audit。

Langfuse session/trace 是 optional observability attachment，负责 trace/session 可视化、模型调用耗时、usage、debug、错误链路，不承担 Portal 事实源角色，不是结算真相源，不决定余额、扣费、资源状态、文件归属、释放状态。

Langfuse 也不是 Portal session、run、artifact 或 billing 的业务事实源。

trace.medopl.cn 是 Langfuse admin/ops console（管理员/运维原生观测台）入口。

客户侧 trace 浏览仍在 Portal 的“会话轨迹”页面。

trace.medopl.cn 是管理员/运维原生观测台，不承担 Portal/结算事实源角色，也不是客户默认 trace 页面。

Runtime Bridge 先清洗，再投递 Langfuse。Langfuse 只接收 sanitized trace/session metadata。Portal 只读取 sanitized projection。

sanitized projection adapter 的输入为 Runtime Bridge 已清洗 metadata + Langfuse trace/session 摘要。

Portal “会话轨迹”展示合并后的业务化摘要，不能把 Langfuse 原始 trace 当成客户默认页面。

Portal 可展示的 Langfuse projection 只能是：

- `traceId`
- `sessionId`
- `runId`
- `status`
- `latencyMs`
- `usage summary`
- `cost estimate`
- `traceUrl`
- `tags`

换成字段摘要即：traceId、sessionId、runId、status、latencyMs、usage summary、cost estimate、traceUrl、tags。

Langfuse 不能保存 raw prompt / raw completion / raw API key / bearer token / launchToken / runtimeToken / objectKey / storageKey / localPath / signedUrl。

Portal projection 不能暴露 raw prompt、raw input、raw output、raw completion、provider key、token、object path、signed URL 或任何可还原敏感内容的请求/响应片段。

Langfuse 部署、ClickHouse、真实 API key、真实 trace source 后续单独授权；当前分支不改 runtime 实现，不接真实 Langfuse。

trace.medopl.cn 的真实部署、Ingress/TLS、LB、DNS、Langfuse secret、ClickHouse 等仍需后续单独授权。

projection 中的 traceUrl 必须静态严格校验 URL origin，不能用字符串前缀匹配。

## Canonical Metadata

Runtime Bridge canonical metadata 必须保持业务事实闭环：

- `workspace`
- `run`
- `artifact`
- `resourceBinding`
- `providerKeyRef`
- `billing/cost summary`
- `release/audit`

Langfuse 只接收清洗后的 trace/session metadata，不得把用户、账单、文件、资源、审计变成它的真相源。

Langfuse 不能成为用户、账单、文件、资源、审计的真相源。

## Sanitized Projection

Portal 的 sanitized projection 允许保留的字段仅限：

- `traceId`
- `sessionId`
- `runId`
- `status`
- `latencyMs`
- `usageSummary`
- `costEstimate`
- `traceUrl`
- `tags`

projection 中不得出现 raw prompt、raw input、raw output、raw completion、raw API key、provider key、bearer token、launchToken、runtimeToken、object path、objectKey、storageKey、localPath、signedUrl 或 presignedUrl。

## Deferred Authorization

以下能力后续单独授权：

- Langfuse 部署
- ClickHouse
- 真实 API key
- 真实 trace source

## Non-goals

- 不改业务代码。
- 不改 Portal UI。
- 不改 Runtime Bridge 实现。
- 不改 Gateway / deploy / `.sentrux` / adapters / one-person-lab upstream。
- 不读取 secret。
- 不调用真实 Langfuse / 真实云 API。
- 不运行 build/push/kubectl/live-test。

<!-- v22-langfuse-observability-metadata-contract:start -->
```json
{
  "contract": "v22_langfuse_observability_metadata_boundary",
  "version": 1,
  "runtimeBridgeCanonicalSource": {
    "canonicalFor": [
      "Portal",
      "Billing",
      "Audit"
    ],
    "metadataResponsibilities": [
      "workspace",
      "run",
      "artifact",
      "resourceBinding",
      "providerKeyRef",
      "billing/cost summary",
      "release/audit"
    ]
  },
  "langfuseObservabilityAttachment": {
    "attachmentKind": "optional observability attachment",
    "sourceOfTruth": false,
    "adminConsoleUrl": "https://trace.medopl.cn",
    "customerTraceSurface": "Portal 会话轨迹",
    "customerDefaultLangfuseUi": false,
    "portalCanonicalSource": false,
    "billingTruth": false,
    "responsibleFor": [
      "trace/session 可视化",
      "模型调用耗时",
      "usage",
      "debug",
      "错误链路"
    ],
    "notCanonicalFor": [
      "Portal",
      "run",
      "artifact",
      "billing",
      "Portal session",
      "用户",
      "账单",
      "文件",
      "资源",
      "审计",
      "余额",
      "扣费",
      "资源状态",
      "文件归属",
      "释放状态"
    ]
  },
  "langfuseConsole": {
    "consoleRole": "admin/ops console",
    "adminConsoleUrl": "https://trace.medopl.cn",
    "customerTraceSurface": "Portal 会话轨迹",
    "customerDefaultLangfuseUi": false,
    "portalCanonicalSource": false,
    "billingTruth": false
  },
  "sanitizationPipeline": {
    "runtimeBridgeSanitizesBeforeLangfuse": true,
    "langfuseReceives": "sanitized trace/session metadata",
    "portalReads": "sanitized projection",
    "adapter": "sanitized projection adapter",
    "adapterInput": "Runtime Bridge 已清洗 metadata + Langfuse trace/session 摘要",
    "portalBusinessSummarySurface": "Portal 会话轨迹"
  },
  "portalSanitizedProjection": {
    "allowedFields": [
      "traceId",
      "sessionId",
      "runId",
      "status",
      "latencyMs",
      "usageSummary",
      "costEstimate",
      "traceUrl",
      "tags"
    ]
  },
  "traceUrlOriginValidation": {
    "requiredOrigin": "https://trace.medopl.cn",
    "urlParserRequired": true,
    "stringPrefixMatchingAllowed": false,
    "invalidOriginRejected": true
  },
  "forbiddenData": [
    "raw prompt",
    "raw completion",
    "raw API key",
    "bearer token",
    "launchToken",
    "runtimeToken",
    "objectKey",
    "storageKey",
    "localPath",
    "signedUrl"
  ],
  "langfusePersistenceForbidden": [
    "raw prompt",
    "raw completion",
    "raw API key",
    "bearer token",
    "launchToken",
    "runtimeToken",
    "objectKey",
    "storageKey",
    "localPath",
    "signedUrl"
  ],
  "portalProjectionForbiddenData": [
    "raw prompt",
    "raw input",
    "raw output",
    "raw completion",
    "raw API key",
    "provider key",
    "bearer token",
    "launchToken",
    "runtimeToken",
    "object path",
    "objectKey",
    "storageKey",
    "localPath",
    "signedUrl",
    "presignedUrl"
  ],
  "deferredAuthorization": [
    "trace.medopl.cn 真实部署",
    "Ingress/TLS",
    "LB",
    "DNS",
    "Langfuse secret",
    "Langfuse 部署",
    "ClickHouse",
    "真实 API key",
    "真实 trace source"
  ],
  "nonGoals": [
    "不改业务代码",
    "不改 Portal UI",
    "不改 Runtime Bridge 实现",
    "不改 Gateway / deploy / .sentrux / adapters / one-person-lab upstream",
    "不读取 secret",
    "不调用真实 Langfuse / 真实云 API",
    "不运行 build/push/kubectl/live-test"
  ]
}
```
<!-- v22-langfuse-observability-metadata-contract:end -->

### spec:v22-managed-environment-open-boundary

Former leaf id: `v22-managed-environment-open-boundary`
Former title: v22 Managed Environment Open Boundary Contract

本合同定义 MedOPL v22 MVP 闭环第二段：用户在 Portal 开通托管运行环境，选择套餐和文件空间，平台后台生成资源绑定，并开始预扣费/冻结。

## Product Boundary

用户主叙事必须是：

- 用户开通“托管运行环境”。
- 用户选择“套餐”和“文件空间”。
- 用户看到“托管运行环境状态 / 工作空间 / 文件空间 / 余额 / 预扣费”。

不得把 CVM、COS、K8s、TKE 或云资源控制台作为用户主语言。

后台实现可以表达 platform-managed CVM / COS / runtime、tenant、user、workspace、resourceBinding、billingAccount、auditTag 和 costAllocationTag。这些字段只属于平台内部合同、计费、隔离和审计边界。

## Preconditions

- 开通前必须检查账号、工作空间、套餐、文件空间、余额 / 冻结金额、用户自己的 gflabtoken provider key 和资源授权边界。
- 开通托管运行环境必须要求用户已绑定自己的 gflabtoken provider key；没有 `providerKeyRef` 时返回 `provider_key_required`。
- 不读取 `/home/dev/.secrets/medopl/secrets.env.txt`。
- 不调用真实云 API。
- 不泄露 raw API key、`launchToken` 或 `runtimeToken`。

## Plans

MVP 只支持两个默认套餐：

- `starter_2c4g_10gb`
- `pro_8c16g_100gb`

套餐边界：

- `storageBackend = cos_standard_workspace_quota`
- `basePrice = null`
- `pendingProductApproval = true`

本轮不写正式价格，不扩展自定义套餐实现。

MVP 不暴露 `custom` active 套餐。普通用户开通与查询只允许 `starter_2c4g_10gb`、`pro_8c16g_100gb`。

## Open Flow

1. 用户调用 Portal 后端开通“托管运行环境”。
2. 请求必须显式包含 `workspaceId`、`planId` 和 `fileSpaceGb`。
3. Portal 后端先检查账号、工作空间、套餐、文件空间、余额 / 冻结金额、用户自己的 gflabtoken provider key 和资源授权边界；缺少 `providerKeyRef` 时返回 `provider_key_required`。
4. Portal 后端只生成平台内部合同状态，不调用真实云 API。
5. 后台创建 platform-managed CVM / COS / runtime 表达的内部资源记录。
6. 后台生成 `resourceBinding`。
7. `resourceBinding` 必须绑定 tenant、user、workspace、billingAccount、auditTag 和 costAllocationTag。
8. 开通后进入预扣费/冻结状态。
9. API response 和 canonical state 只暴露用户可理解的托管环境、工作空间、文件空间、套餐、余额、预扣费状态；`tenantId`、`resourceBindingId`、`userId`、`billingAccountId`、`auditTag`、`costAllocationTag` 等 binding/audit 原值只能留在后端 store、admin/ops internal surface 或审计证据中，不能作为普通用户公开字段。

缺失开通参数时必须稳定失败：

- 缺 `workspaceId` 返回 `workspace_required`。
- 缺 `planId` 返回 `plan_required`。
- 缺 `fileSpaceGb` 返回 `file_space_required`。

不得使用用户当前任务、`default`、默认套餐或套餐容量补齐缺失的开通参数。

## Canonical State Contract

开通后 canonical state 必须表达：

```json
{
  "managedEnvironmentEnabled": true,
  "workspace": {
    "workspaceId": "workspace id",
    "status": "active"
  },
  "fileSpace": {
    "capacityGb": 100,
    "storageBackend": "cos_standard_workspace_quota",
    "status": "active"
  },
  "preauth": {
    "status": "pending_product_approval",
    "amountCents": 0
  },
  "selectedPlan": {
    "id": "starter_2c4g_10gb or pro_8c16g_100gb",
    "storageBackend": "cos_standard_workspace_quota",
    "basePrice": null,
    "pendingProductApproval": true
  }
}
```

## Managed Resource Binding Plan View

Portal 工作空间可以展示 `managed resource binding plan / mock snapshot`，用于把“托管运行环境”的区域、计算/文件空间规格、状态、价格审批状态和审计模式呈现给普通用户。

该视图是 managed resource binding 的计划摘要，不代表真实资源已创建，不调用真实腾讯云 API，不读取真实 COS、TKE、CVM、kubeconfig、SecretId/SecretKey、token 或任何本地 secret。Portal payload 只暴露业务对象：

```json
{
  "managedEnvironment": "托管运行环境",
  "regionLabel": "硅谷一区",
  "planSpec": "8核 / 16GB 内存 / 100GB 文件空间",
  "status": "active",
  "estimatedCost": {
    "amount": 0,
    "currency": "CNY",
    "source": "contract_snapshot_fixture",
    "status": "mock_snapshot",
    "billingTruth": false,
    "chargeApplied": false
  },
  "quoteSource": "mock/tencent-readonly-quote-provider",
  "quoteStatus": "mock_snapshot",
  "quoteSnapshotId": "quote-snapshot-v22-pro-8c16g-100gb",
  "resourcePlan": {
    "planMode": "dry_run",
    "regionLabel": "硅谷一区",
    "planSpec": "8核 / 16GB 内存 / 100GB 文件空间",
    "estimatedCost": {
      "amount": 0,
      "currency": "CNY",
      "source": "contract_snapshot_fixture",
      "status": "mock_snapshot",
      "billingTruth": false,
      "chargeApplied": false
    },
    "resourceSteps": [
      "准备托管运行环境",
      "分配文件空间",
      "准备运行网络边界",
      "登记账单和审计边界"
    ],
    "approvalRequired": true
  },
  "releasePolicy": {
    "status": "not_released",
    "stopBillingConfirmWithinMinutes": 120
  },
  "auditStatus": {
    "status": "audit_pending",
    "policy": "T+1"
  },
  "snapshot": {
    "source": "mock_snapshot_provider",
    "label": "managed resource binding plan / mock snapshot",
    "realResourceCreated": false
  }
}
```

普通用户界面只使用“托管运行环境、区域、计算资源、文件空间、价格待审批、正式售价未定价、审计模式、状态”等产品语言，不把 CVM、COS、K8s、TKE 或云资源控制台作为主语言。

普通用户 view 与 admin/ops internal view 必须拆分：

- 普通用户 view：只读产品态摘要，不暴露 internal 标识或云对象原值。
- admin/ops internal view：可在排障详情查看 `tenantId`、`resourceBindingId`、`serverPlanId`、`runId`、`implementationKind`、`planId`、cloud object id（bucket/prefix/object 等）及其他内部字段。

`resourcePlan` 来自 `dry-run/tencent resource plan provider`，只生成不会执行的资源创建计划。`resourceSteps` 只能使用“准备托管运行环境”“分配文件空间”“准备运行网络边界”“登记账单和审计边界”等产品语言，不把 CVM、COS、K8s 或 TKE 当普通用户主语言。`realResourceCreated` 和 `chargeApplied` 不属于 `resourcePlan` 顶层字段；真实资源未创建通过 `snapshot.realResourceCreated=false` 表达，未真实扣费通过 `estimatedCost.chargeApplied=false` 或现有费用估算边界表达。

后续真实腾讯云接入路线必须按阶段推进：

`mock/snapshot provider -> readonly/tencent quote provider -> dry-run/tencent plan provider -> TKE bootstrap preflight when no TKE foundation exists -> readonly/tencent inventory provider -> authorized/tencent create/release provider -> authorized/tencent deploy provider -> canary / QA / status update`

等价 provider 路线：`mock/snapshot -> readonly/tencent quote -> dry-run/tencent plan -> TKE bootstrap preflight when no TKE foundation exists -> readonly/tencent inventory -> authorized/tencent create/release -> authorized/tencent deploy -> canary / QA / status update`。

真实接入另开 feat/* 并单独授权。替换点是 provider adapter，不重做 Portal 用户闭环；真实创建、释放、报价、Ingress/TLS、kubeconfig、SecretId/SecretKey、token 和真实云资源操作均不属于当前合同层级。

本分支允许的最小 Portal frontend 展示范围：

- Portal 工作空间 payload 输出 `managedResourceBindingPlan`。
- Portal 工作空间普通用户页面展示托管运行环境的区域、计算/文件空间规格、状态、价格审批状态和审计模式。
- 前端只消费 `managedResourceBindingPlan` 里的业务字段，不展示或传递真实云对象、provider 内部字段、密钥或内部存储字段。

## Non-goals

- 不创建、绑定或释放真实腾讯云资源。
- 不调用真实腾讯云、COS、Langfuse 或 one-person-lab API。
- 不改 OPL Gateway、Runtime Bridge、deploy、`.sentrux`、`adapters` 或 one-person-lab upstream。
- 不暴露 SecretId/SecretKey、kubeconfig、token、raw API Key、objectKey/storageKey/localPath/signedUrl 或 provider raw cost internals。
- 不把 CVM、COS、K8s 或 TKE 作为普通用户主语言。
- 不运行 build/push/kubectl/live-test。

### spec:v22-mvp-managed-opl-loop

Former leaf id: `v22-mvp-managed-opl-loop`
Former title: v22 MVP Managed OPL Loop Contract

本合同定义 MedOPL v22 MVP 的托管 OPL 科研闭环。MedOPL 是面向 AI 小白科研用户的 OPL 科研托管平台，不是云资源控制台。

## Product Narrative

用户主叙事必须围绕科研工作流，而不是云资源管理：

- 科研工作台
- 托管运行环境
- 工作空间
- 文件空间
- 套餐
- 余额
- 任务
- 输出文件
- 运行轨迹
- 停止使用 / 释放托管环境

后台实现可以使用 CVM、COS、runtime、resourceBinding、billingAccount 和 auditTag。它们只能作为后台实现、计费、隔离和审计边界，不能成为用户主叙事。CVM、COS、TKE、K8s 和云资源控制台不得成为 MVP 用户侧产品语言。

Langfuse 只作为后续 trace metadata 来源，不进入 MVP 主产品叙事。

## Scope

- 默认套餐只引用 `starter_2c4g_10gb` 和 `pro_8c16g_100gb`。
- 本合同不扩展自定义套餐实现。
- Portal 登录不需要 gflabtoken API Key。
- 每个用户使用自己的 gflabtoken API Key 作为模型调用凭证；OPL entry/preflight 或工作台 provider 绑定面必须能收用户自己的 key，已绑定用户不要求重复输入。
- gflabtoken.cn 网站本身不进入 MedOPL 用户主流程。
- Portal 可以展示“gflabtoken 模型调用密钥是否已绑定”状态，但 API Key 不是 Portal 普通登录字段。
- raw API Key 只能进入后端密钥边界，不能返回前端、不能写日志、不能进 git；用户侧只看到 `providerKeyRef` 和 bound status。
- OPL Web 使用 clean upstream one-person-lab：`https://github.com/gaofeng21cn/one-person-lab`。
- 不修改 upstream 源码，不 import upstream 内部模块。

## Contract Data

<!-- v22-mvp-managed-opl-loop-contract:start -->
```json
{
  "contract": "v22_mvp_managed_opl_loop",
  "version": 1,
  "productNarrative": {
    "audience": "AI 小白科研用户",
    "category": "OPL 科研托管平台",
    "notCloudConsole": true,
    "primaryStatement": "MedOPL 是面向 AI 小白科研用户的 OPL 科研托管平台，不是云资源控制台。"
  },
  "userVisibleConcepts": [
    "科研工作台",
    "托管运行环境",
    "工作空间",
    "文件空间",
    "套餐",
    "余额",
    "任务",
    "输出文件",
    "运行轨迹",
    "停止使用 / 释放托管环境"
  ],
  "forbiddenUserNarrative": [
    "CVM",
    "COS",
    "K8s",
    "TKE",
    "云资源控制台"
  ],
  "backendImplementationBoundary": {
    "allowedBackendTerms": [
      "CVM",
      "COS",
      "runtime",
      "resourceBinding",
      "billingAccount",
      "auditTag"
    ],
    "userNarrativeAllowed": false,
    "cloudConsoleShownToUser": false,
    "tkeUserNarrativeAllowed": false
  },
  "defaultPlans": [
    "starter_2c4g_10gb",
    "pro_8c16g_100gb"
  ],
  "secretBoundary": {
    "provider": "gflabtoken",
    "providerCredentialOwner": "user",
    "portalLoginRequiresProviderKey": false,
    "oplEntryRequiresProviderKey": true,
    "oplEntryAllowsBoundUserWithoutReentry": true,
    "managedRunRequiresProviderKey": true,
    "inputLocation": "OPL entry/preflight 或工作台 provider 绑定面",
    "gflabtokenSiteInUserMainFlow": false,
    "rawKeyBackendOnly": true,
    "publicFields": [
      "providerKeyRef",
      "boundStatus"
    ]
  },
  "upstreamBoundary": {
    "repository": "https://github.com/gaofeng21cn/one-person-lab",
    "cleanUpstream": true,
    "modifySource": false,
    "importInternalModules": false
  },
  "billingBoundary": {
    "reconcileWithinBillingDay": true,
    "stopBillingConfirmationWithinMinutesAfterRelease": 120,
    "auditTPlusOne": true,
    "stopChargingAfterRelease": true
  },
  "auditingAndCleanup": {
    "postReleaseProtectionBoundary": true,
    "dataCleanupAudited": true,
    "langfuseMvpNarrative": false,
    "langfuseFutureTraceMetadataSourceOnly": true
  },
  "mvpLoop": [
    {
      "id": 1,
      "name": "平台创建 1 名用户",
      "userFacing": false,
      "requiredEvidence": [
        "tenant user exists",
        "workspace owner role exists"
      ]
    },
    {
      "id": 2,
      "name": "平台给用户充值额度",
      "userFacing": false,
      "requiredEvidence": [
        "billing account exists",
        "balance ledger top-up exists"
      ]
    },
    {
      "id": 3,
      "name": "用户登录 portal.medopl.cn",
      "userFacing": true,
      "requiredEvidence": [
        "Portal login session exists",
        "Portal login does not require gflabtoken API Key",
        "user sees 科研工作台"
      ]
    },
    {
      "id": 4,
      "name": "用户进入工作空间并上传文件 / 提任务",
      "userFacing": true,
      "requiredEvidence": [
        "workspace opens",
        "file upload or task intent is available",
        "workspace context is bound"
      ]
    },
    {
      "id": 5,
      "name": "用户进入 OPL 工作台，并在 OPL entry/preflight 绑定自己的 gflabtoken API Key",
      "userFacing": true,
      "requiredEvidence": [
        "OPL Web entry opens",
        "Portal session or OPL entry session is accepted",
        "workspace context is bound",
        "provider key accepted by backend secret boundary",
        "providerKeyRef returned",
        "raw API key is not returned"
      ]
    },
    {
      "id": 6,
      "name": "用户在 Portal 开通托管运行环境，选择套餐和文件空间",
      "userFacing": true,
      "requiredEvidence": [
        "selected plan is starter_2c4g_10gb or pro_8c16g_100gb",
        "file space quota selected",
        "hosted runtime requested"
      ]
    },
    {
      "id": 7,
      "name": "平台后台代开通 CVM / 存储 / runtime，但用户侧不展示云资源控制台",
      "userFacing": false,
      "requiredEvidence": [
        "backend resourceBinding exists",
        "backend billingAccount exists",
        "backend auditTag exists",
        "user surface hides cloud console"
      ]
    },
    {
      "id": 8,
      "name": "Portal 展示托管运行环境、工作空间、文件空间、余额、预扣费/冻结金额",
      "userFacing": true,
      "requiredEvidence": [
        "hosted runtime status visible",
        "workspace visible",
        "file space visible",
        "balance visible",
        "preauth or frozen amount visible"
      ]
    },
    {
      "id": 9,
      "name": "账单日内核对；释放后 120min 内完成停止计费确认；审计 T+1",
      "userFacing": true,
      "requiredEvidence": [
        "billing reconciles within billing day",
        "release stop-billing confirmation within 120 minutes",
        "audit completes T+1"
      ]
    },
    {
      "id": 10,
      "name": "OPL Web 使用 clean upstream one-person-lab，不修改源码，不 import upstream 内部模块",
      "userFacing": true,
      "requiredEvidence": [
        "upstream repository is https://github.com/gaofeng21cn/one-person-lab",
        "Gateway boundary is used",
        "no upstream source modification",
        "no upstream internal import"
      ]
    },
    {
      "id": 11,
      "name": "用户在 opl.medopl.cn 可发送信息、上传文件、用文件跑任务、下载输出",
      "userFacing": true,
      "requiredEvidence": [
        "message sent",
        "file uploaded",
        "task runs with file",
        "output file downloadable"
      ]
    },
    {
      "id": 12,
      "name": "Portal 可看到 workspace 文件、账单、session trace metadata",
      "userFacing": true,
      "requiredEvidence": [
        "workspace files visible",
        "billing visible",
        "session trace metadata visible"
      ]
    },
    {
      "id": 13,
      "name": "用户停止使用 / 释放托管环境后停止扣费",
      "userFacing": true,
      "requiredEvidence": [
        "release requested",
        "runtime marked released",
        "billing stops after release"
      ]
    },
    {
      "id": 14,
      "name": "后续资源与数据清理进入保护/审计边界",
      "userFacing": false,
      "requiredEvidence": [
        "cleanup protection boundary entered",
        "data cleanup audit event exists",
        "resource cleanup audit event exists"
      ]
    }
  ]
}
```
<!-- v22-mvp-managed-opl-loop-contract:end -->

## Smoke Boundary

`tests/smoke/smoke-test-v22-mvp-managed-opl-loop-contract.mjs` 是纯本地 contract 校验。它只读取本文件中的 JSON 契约块，不读取 secrets，不调用真实云 API，不执行 build、push、kubectl 或 live-test。

### spec:v22-opl-deployment-ownership-release-plan-boundary

Former leaf id: `v22-opl-deployment-ownership-release-plan-boundary`
Former title: v22 OPL Deployment Ownership Release Plan Boundary

本合同定义 Package D 下的 OPL deployment ownership / release plan 子边界。它只回答一件事：

```text
Package D 在 build/push/kubectl 之前，如何证明 release plan 中每个 Portal / Gateway / Runtime Bridge / Runtime Agent target 属于本次发布，且允许被本次发布更新。
```

本合同不授权 build/push/kubectl；does not authorize build/push/kubectl。不读取 secret，不调用真实云，不修改 deploy，不修改 upstream，不创建/删除/扩缩容 TKE node pool，不创建/删除 COS storage。

## Contract Level

- Level 1: [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop)。MedOPL 托管 OPL SaaS 主合同。
- Level 2: [spec:v22-cloud-onboarding-workflow-boundary](#spec-v22-cloud-onboarding-workflow-boundary) 和 [spec:v22-authorized-tencent-deploy-execution-boundary](#spec-v22-authorized-tencent-deploy-execution-boundary)。Cloud onboarding 与 Package D deploy 执行边界。
- Level 3: [spec:v22-real-opl-file-run-artifact-canary-boundary](#spec-v22-real-opl-file-run-artifact-canary-boundary)。OPL lane 产出 Runtime Agent / run / artifact projection 和 `resourceBindingId/workspace runtime identity`。
- Level 4: 本合同。Package D release plan ownership 子合同，用来连接 OPL lane 的运行身份与 Package D 的 deploy target owner guard。

本合同是 Package D 的执行子合同，不替代 Package D 合同，不放宽 Package D 的 fail-closed 边界。

## Subscription Package

本合同订阅：

- [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop)
- [spec:v22-cloud-onboarding-workflow-boundary](#spec-v22-cloud-onboarding-workflow-boundary)
- [spec:v22-authorized-tencent-deploy-execution-boundary](#spec-v22-authorized-tencent-deploy-execution-boundary)
- [spec:v22-production-cloud-topology-boundary](#spec-v22-production-cloud-topology-boundary)
- [spec:v22-portal-opl-context-backflow-boundary](#spec-v22-portal-opl-context-backflow-boundary)
- [spec:v22-real-opl-file-run-artifact-canary-boundary](#spec-v22-real-opl-file-run-artifact-canary-boundary)
- [spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary](#spec-v22-runtime-bridge-session-run-file-provider-keyref-boundary)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)

## Product Truth

MedOPL 是 `platform-provisioned / customer-dedicated` 的 OPL SaaS 托管科研工作台，不是云资源控制台。普通用户不看 TCR、TKE、Kubernetes、namespace、workload、container、image digest 或 kubectl。

OPL lane only provides `resourceBindingId/workspace runtime identity`、`billingMetadataRef`、`usageMetadataRef`、run/artifact projection 和 Runtime Agent endpoint binding status。OPL lane 不提供 `ownerRef`、`operationId` 或 K8s labels，不决定 namespace、workload、container、rollout、digest verify、owner labels 或 rollback evidence。这些属于 Package D / deploy lane。

## Target Classes

Package D release plan 必须给每个 target 显式声明 `targetClass`。

### `platform_service_target`

适用：

- Portal API / Portal frontend delivery image。
- OPL Web Gateway。
- Runtime Bridge / shared Runtime Bridge。
- Portal/Gateway/Runtime Bridge/trace 这组运行面中，trace surface 只能作为 smoke surface；除非有本仓库 image target metadata、source root / build recipe boundary、workload 和 owner guard，不得默认作为 image target。

必填 owner guard：

- `targetClass=platform_service_target`
- `ownerRef`
- `operationId`
- `component`
- `repository`
- `imageTargetRef`
- `sourceRoot`
- `namespace`
- `workload`
- `container`
- `expectedVersionMarker`

`platform_service_target` 不强制 `workspaceId/resourceBindingId`。共享平台服务不能被伪装成某个 workspace 的专属资源。

### `workspace_runtime_target`

适用：

- workspace 专属 Runtime Agent。
- workspace 专属 runtime workload。
- 任何代表租户计算能力、存储挂载或 workspace runtime capacity 的 workload。

必填 owner guard：

- `targetClass=workspace_runtime_target`
- `ownerRef`
- `operationId`
- `workspaceId`
- `resourceBindingId`
- `component`
- `repository`
- `imageTargetRef`
- `sourceRoot`
- `namespace`
- `workload`
- `container`
- `expectedVersionMarker`

`workspace_runtime_target` 必须同时能被 Portal resource binding 和 Kubernetes metadata 证明。缺失、冲突或不一致时 fail-closed。

## Release Plan Shape

release plan 顶层：

- `runId`
- `versionTag`，禁止 `latest`
- `namespace`，单一 namespace；跨 namespace 必须拆分为多个 release plan
- `targets[]`
- `runtimeSmokeTargets[]`

每个 `targets[]` 还必须满足对应 target class 的 owner guard。`k8s-app`、`qcloud-app`、deployment 名字、namespace、IP、创建时间或人工记忆不能证明归属。

最小平台服务 target：

```json
{
  "component": "opl-web-gateway",
  "targetClass": "platform_service_target",
  "repository": "opl-web-gateway",
  "imageTargetRef": "opl-web-gateway-service-image",
  "sourceRoot": "services/opl-web-gateway",
  "namespace": "platform-namespace",
  "workload": "opl-web-gateway",
  "container": "opl-web-gateway",
  "ownerRef": "platform-release-owner",
  "operationId": "deploy-operation-id",
  "expectedVersionMarker": "unique-version-marker"
}
```

最小 workspace runtime target：

```json
{
  "component": "opl-runtime-agent",
  "targetClass": "workspace_runtime_target",
  "repository": "opl-runtime-agent",
  "imageTargetRef": "opl-runtime-bridge-service-image",
  "sourceRoot": "services/opl-runtime-bridge",
  "namespace": "workspace-namespace",
  "workload": "workspace-runtime-agent",
  "container": "runtime-agent",
  "ownerRef": "workspace-runtime-owner",
  "operationId": "deploy-operation-id",
  "workspaceId": "workspace-id",
  "resourceBindingId": "resource-binding-id",
  "expectedVersionMarker": "unique-version-marker"
}
```

## Module Split

当前 v22 D1 只认以下自有模块：

| component | default target class | source | default role |
| --- | --- | --- | --- |
| `portal` | `platform_service_target` | `services/portal` | Portal API + frontend delivery |
| `opl-web-gateway` | `platform_service_target` | `services/opl-web-gateway` | clean OPL WebUI gateway/proxy |
| `opl-runtime-bridge` | `platform_service_target` | `services/opl-runtime-bridge` | shared Runtime Bridge / Runtime Agent relay |

`opl-runtime-bridge` 只有在 release plan 显式声明 `workspace_runtime_target`，并提供 `workspaceId/resourceBindingId` 时，才能作为 workspace runtime target。

## Validation Path

D1 验证路径：

1. 合同 smoke 确认本合同是 Package D Level 4 子合同，且订阅 OPL Runtime Agent 合同。
2. 本地合同 gate 验证 `platform_service_target` 不强制 `workspaceId/resourceBindingId`。
3. 本地合同 gate 验证 `workspace_runtime_target` 必须提供 `workspaceId/resourceBindingId`。
4. 本地合同 gate 验证 `ownerRef/operationId` 缺失时 fail-closed。
5. 本地合同 gate 验证只有 `k8s-app/qcloud-app` 时 fail-closed。
6. 本地合同 gate 验证 runtime smoke coverage 必须覆盖每个 pushed component。
7. zero-compat cleanup 已删除 Package D runner executable surface；未来真实 deploy runner 必须重新授权并建立新的 v22 boundary。

通过 D1 只能说明 release plan ownership gate 可用；不代表 TCR push、kubectl rollout、runtime smoke 或真实云 deploy 已完成。

## Non-Goals

- 不读取 deploy secret now。
- 不读取 kubeconfig now。
- 不运行 build/push/kubectl now。
- 不调用真实云。
- 不修改 deploy / `.sentrux` / adapters / upstream。
- 不创建、删除、释放或扩缩容 TKE node pool。
- 不创建、删除、清空或扩容 COS bucket/prefix/object。
- 不把 `trace.medopl.cn` 默认建模为本仓库 image target。
- 不把平台共享服务伪装成 workspace runtime。

## Contract Data

<!-- v22-opl-deployment-ownership-release-plan-contract:start -->
```json
{
  "contract": "v22_opl_deployment_ownership_release_plan_boundary",
  "level": 4,
  "parentContract": "spec:v22-authorized-tencent-deploy-execution-boundary",
  "package": "Package D",
  "doesNotAuthorizeBuildPushKubectl": true,
  "doesNotReadSecretNow": true,
  "doesNotReadKubeconfigNow": true,
  "targetClasses": {
    "platform_service_target": {
      "requiresWorkspaceBinding": false,
      "requiredOwnerGuard": [
        "ownerRef",
        "operationId"
      ]
    },
    "workspace_runtime_target": {
      "requiresWorkspaceBinding": true,
      "requiredOwnerGuard": [
        "ownerRef",
        "operationId",
        "workspaceId",
        "resourceBindingId"
      ]
    }
  },
  "moduleSplit": [
    "portal",
    "opl-web-gateway",
    "opl-runtime-bridge"
  ],
  "forbiddenOwnershipProof": [
    "k8s-app",
    "qcloud-app",
    "deployment name",
    "namespace",
    "IP",
    "creation time",
    "manual memory"
  ],
  "runnerGate": {
    "executableSurfaceDeleted": true,
    "futureRunnerRequiresNewV22Boundary": true,
    "smoke": "tests/future-authorized/cloud/future-authorized-test-v22-opl-deployment-ownership-release-plan-contract.mjs",
    "modesCovered": [
      "local-contract",
      "local-owner-guard"
    ]
  }
}
```
<!-- v22-opl-deployment-ownership-release-plan-contract:end -->

### spec:v22-opl-entry-preflight-auth-boundary

Former leaf id: `v22-opl-entry-preflight-auth-boundary`
Former title: v22 OPL Entry Preflight Auth Boundary Contract

本合同定义 MedOPL v22 的 OPL Web entry/preflight 最小认证闭环。它覆盖 `opl.medopl.cn` 进入 OPL 工作台前的账号校验、Portal session / workspace launch、Gateway preflight 和用户自己的 gflabtoken 后端密钥边界。本合同不修改 one-person-lab upstream，不 import upstream 内部模块。

## Product Truth

- MedOPL 有两种进入 OPL Web 的路径。
- 路径 1：从 Portal SaaS 后台进入。
- `portal.medopl.cn -> Portal 工作空间 / “进入 OPL 工作台”按钮 -> Gateway launch / preflight -> clean upstream one-person-lab Web`
- 路径 2：直接访问 OPL 工作台。
- `opl.medopl.cn -> OPL Gateway entry -> MedOPL 账号/密码 preflight -> clean upstream one-person-lab Web`
- 两条路径最终进入同一套 Gateway / preflight / launch 逻辑。
- portal.medopl.cn 登录不需要 gflabtoken API Key。
- Portal 普通登录页不需要 API Key。
- opl.medopl.cn 登录 / 进入 OPL 工作台需要用户自己的 gflabtoken API Key。
- OPL 登录页输入顺序：账号/邮箱、密码、gflabtoken API Key。
- API Key 放在密码下面，只进入后端密钥边界。
- API Key 只出现在 opl.medopl.cn entry/preflight 的密码下面。
- OPL preflight 可以绑定用户自己的 gflabtoken API Key；已绑定用户不要求重复输入。
- opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key。
- 已绑定则显示“已绑定”，不要求重复输入。
- 从 Portal 进入时可复用 Portal session / workspace / launch context。
- 从 OPL 直接进入时需要 MedOPL 账号/密码/gflabtoken API Key，已绑定可显示“已绑定”。
- 用户已绑定时，entry/preflight 可以显示“已绑定”，不要求重复输入；后端复用已有 `providerKeyRef`，不回放 raw API Key。
- gflabtoken.cn 网站本身不进入 MedOPL 用户主流程。
- raw API Key 只能进入后端密钥边界，不能返回前端、不能写日志、不能进 git。
- raw API Key 只进入后端密钥边界。
- one-person-lab 是 clean upstream；不得修改源码，不得 import 内部模块。

## Entrypoint Alias

用户可见入口必须指向 OPL Gateway entry/preflight alias，不暴露 internal path：

```text
用户可见入口：GET /opl/entry/preflight
用户可见入口：POST /opl/entry/preflight
```

内部实现可以保留 /internal/opl/auth/login，但用户合同、表单 action 和产品入口必须指向 OPL Gateway entry/preflight alias。该入口属于 MedOPL Gateway / SSO / Auth Bridge 的 OPL entry/preflight 边界，不是 Portal 普通登录页。`/login` 只能保留账号/邮箱和密码，不得出现 gflabtoken API Key 字段。

用户可见入口不是 /internal/opl/auth/login。/internal/opl/auth/login 只能是 internal implementation path。用户可见入口必须是 Portal “进入 OPL 工作台”或 /opl/entry/preflight。

## Preflight Form

OPL entry/preflight 登录表单默认必须包含：

1. `email` 或 `account`
2. `password`
3. `apiKey`

未绑定用户的 `apiKey` 是必填字段；已绑定用户可以显示“已绑定”，不要求重复输入。用户可见名称为 `gflabtoken API Key`；表单不得引导用户进入 `gflabtoken.cn` 网站主流程。

Gateway / preflight / launch 边界必须满足：

- OPL Gateway 通过显式 `OPL_UPSTREAM_URL` 配置代理 clean upstream one-person-lab Web。
- 未配置 `OPL_UPSTREAM_URL` 时，Gateway 必须返回稳定错误 `opl_upstream_url_required`，不得兜底到旧 v19/v20/v21 direct path、direct upstream path 或硬编码本地 upstream。
- Gateway 只代理 upstream HTML/健康响应，并注入公开启动上下文；公开上下文只包含 `workspaceId`、`sessionId`/`launchStatus`、`providerBound`、`providerKeyRef` 和 Portal return URL。
- launchToken/runtimeToken 不进 URL query。
- launchToken/runtimeToken 不进 localStorage/sessionStorage。
- raw API Key、bearer token、objectKey、localPath、signedUrl 不进入 upstream、URL、response、log、localStorage 或 sessionStorage。
- Gateway 不写 raw API Key 到 localStorage/sessionStorage。
- Gateway 不 import one-person-lab 内部模块。

## Binding Flow

1. 用户在 `opl.medopl.cn` entry/preflight 输入账号/邮箱和密码，或从 Portal 复用 Portal session / workspace / launch context。
2. 平台先校验 MedOPL 账号密码。
3. 未提交 API Key 且没有已绑定记录时，workbench entry 返回 `provider_api_key_required`。
4. 提交 API Key 成功后，raw API Key 只写入 `providerSecretStore`。
5. 后端写入 provider key binding 时，用户侧只返回 `providerKeyRef`、`providerBound` 和 `boundStatus`。
6. 用户已绑定时，entry/preflight 可以显示“已绑定”，不要求重复输入；后端复用已有 `providerKeyRef`，不回放 raw API Key。
7. OPL 启动 response 不得包含 raw API Key、`providerApiKey`、`apiKey`、`providerSecret` 或 `rawProviderKey` 字段。

## Non-goals

- 不改 Portal 普通登录页为 API Key 登录。
- 不实现新的重复 OPL 登录入口。
- 不改 one-person-lab upstream。
- 不 import one-person-lab 内部模块。
- 不改 deploy、`.sentrux` 或 `adapters`。
- 不读取 secret。
- 不调用真实云 API。
- 不运行 build/push/kubectl/live-test。
- 不把 raw API Key 写入 localStorage、sessionStorage、log、response 或 git。

## Smoke

`tests/contract/contract-test-v22-node-portal-backend-physical-removal.mjs` 和 `tests/contract/runtime-bridge/contract-test-v22-runtime-gate-contract.mjs` 是当前本地合同 gate。它们只检查 Go-owned preflight/launch/API surface、Runtime Bridge public surface 和 Node backend physical removal，不读取 `/home/dev/.secrets/medopl/secrets.env.txt`，不调用真实云 API，不执行 build、push、kubectl 或 live-test。

### spec:v22-opl-work-message-file-run-boundary

Former leaf id: `v22-opl-work-message-file-run-boundary`
Former title: v22 OPL Work Message File Run Boundary Contract

本合同定义 MedOPL v22 MVP 闭环第三段：用户进入 OPL 科研工作台，发送信息、上传文件、用文件跑任务，并下载输出文件。

## Product Boundary

用户主叙事必须是：

- 用户进入 OPL 科研工作台。
- 用户发送信息。
- 用户上传文件。
- 用户用文件跑任务。
- 用户下载输出文件。

不得把 CVM、COS、K8s、TKE 或云资源控制台作为用户主语言。

## Upstream Boundary

OPL Web 来自 clean upstream one-person-lab：

```text
https://github.com/gaofeng21cn/one-person-lab
```

平台边界：

- `sourceModified=false`。
- 不修改 upstream 源码。
- 不 import upstream 内部模块。
- 不在 upstream 目录写 Portal、Gateway、Runtime Bridge 或 Runtime Agent 代码。
- 通过 OPL Web Gateway / Runtime Bridge / Runtime Agent 合同边界接入。

## Preconditions

- OPL run 必须先检查 provider readiness；每个用户使用自己的 gflabtoken API Key 作为模型调用凭证。
- 未绑定用户自己的 gflabtoken provider key 时，run 必须返回 `provider_key_required`。
- OPL run 必须要求已开通托管运行环境，并存在 active `resourceBinding`。
- 未开通托管运行环境时，run 必须返回 `managed_environment_required`。
- 运行合同只使用 `providerKeyRef`，不得泄露 raw API key。
- 不读取 `/home/dev/.secrets/medopl/secrets.env.txt`。
- 不调用真实云 API。
- 不运行 build/push/kubectl/live-test。

## Work Flow

1. 用户从 `opl.medopl.cn` 或 Portal “进入 OPL 工作台”进入 OPL 科研工作台；session 创建请求必须显式包含 entrypoint 来源。
2. 平台创建 OPL session contract，内部绑定 workspace、tenant、user、`resourceBinding` 和 `providerKeyRef`。普通用户 response 不返回 `resourceBindingId`、`tenantId`、`runId` 或后台审计标签原值。
3. 用户上传文件后，平台生成 workspace file reference。
4. 用户用 workspace file reference 发起 run contract。
5. Runtime Agent 合同生成 artifact reference / output file reference。
6. 用户下载输出时，API 只返回文件引用，不返回内部 storage key、local path、signed URL 或存储密钥。

## Trace Metadata

MVP trace metadata 只允许包含：

- `sessionId`
- `workspaceId`
- `providerKeyRef`
- artifact reference 列表
- timestamps

public trace metadata 不得包含 raw prompt、raw API key、`launchToken`、`runtimeToken`、`resourceBindingId`、`tenantId`、`runId` 或未脱敏 `auditTag`。内部 trace store 可使用后台 ID 做审计归因，但不得透出普通用户 response。Langfuse 只能作为后续 trace metadata 来源，不进入 MVP 主产品叙事。

以下 token 在 OPL active surface 视为 retired/forbidden：

- retired resource-order identifier family（包括 snake/camel/kebab 旧字段族）
- `opencost-pending`
- `launch_token` URL query 语义
- 未脱敏 `promptPreview`

## Public References

- workspace file reference 是用户上传文件的公开引用，不等于 COS key 或本地路径。
- artifact reference 是输出文件的公开引用，不等于 COS key 或本地路径。
- download response 只能返回 output file reference、workspace reference 和文件状态；不得返回 resourceBinding、内部 storage key、local path 或 signed URL。

## Non-goals

- 不在本合同内实现 frontend；Portal frontend 改动必须由对应 UI leaf、Figma source 和 frontend surface eval 授权。
- 不修改 one-person-lab upstream。
- 不调用真实云 API。
- 不读取 secrets。
- 不运行 build/push/kubectl/live-test。
- 不改 deploy、`.sentrux` 或 `adapters`。

### spec:v22-portal-admin-ops-surface-boundary

Former leaf id: `v22-portal-admin-ops-surface-boundary`
Former title: v22 Portal Admin / Ops Surface Boundary

这是 Portal 管理员/运维 role surface 合同，不实现新 UI。

本合同定义 MedOPL v22 同一个 Portal 应用里的管理员/运维页面边界。管理员/运维 surface 属于同一套登录、同一套 UI shell 下的 role-based surface，不是第二个产品，也不是普通用户工作台。

## 定位

管理员入口是同一个 Portal 应用里的 `/admin/*` role surface，只能 admin role 访问。普通用户导航和路由不能出现 admin 入口，普通用户不能看到 admin/ops 入口和全局数据。

管理员页面/API 独立分区。普通用户 surface 和管理员/运维 surface 严格分离。借鉴 Sub2API 的 role-based Web app 模式：同一个 Web 产品中按角色隔离页面、API、导航和操作权限，不复制外部代码。

角色真相由 `spec:v22-portal-user-surface-boundary` 和 `spec:v22-portal-admin-ops-surface-boundary` 共同定义。`spec:v22-saas-portal-opl-ops-surface-boundary` 是更宽的 Portal、OPL 和管理台共享界面总述，不替代这两份 role surface 合同。

账号 / 工作空间 是 UI 主语言。租户 / 运行环境 不是 UI 主叙事；`tenantId`、`environmentId`、`resourceBindingId` 只能作为内部标签、对账标签或审计字段。

## 管理员/运维可见内容

管理员/运维可见：

- 账号列表和状态
- 工作空间列表和归属账号
- 工作台资源套餐、CPU、内存、文件空间、并发、队列
- 当前运行中的 session/run/task
- 文件空间用量和 7 天保护期占用
- 费用估算、冻结金额、T+1 对账状态
- 分账标签：resourceBindingId、cloudOperationId、billingAttributionId、workspaceId、accountId、serverPlanId、tenantId、environmentId、runId；旧 resource-order 标识不得作为 tag 或兼容归属 alias
- 审计事件、异常、释放失败、账单异常
- 公告管理入口

这些能力用于查看、归因、排障、审计和运营。当前 admin surface 允许已接入的本地 Portal 管理动作：用户查看、Portal 本地账户充值、Portal 本地账本退款、用户启用/禁用、用户软删除、公告新建/编辑/发布/下线/置顶/删除、对当前 billing ops 事实源中的本地账单运营项写入处理状态/异常标记/备注。`/admin/ops`、真实账单审批、高风险站点设置和真实资源/真实扣费仍保持只读或 disabled 产品态；Portal 本地账户充值/本地账本退款/账单运营备注不替代真实扣费链路。

## 管理员/运维也不能看到/不能操作

管理员/运维也不能看到或操作：

- SecretId / SecretKey / token / raw API Key / kubeconfig
- objectKey / storageKey / cosPrefix / storageBackend / signedUrl
- 未授权真实云创建/释放/修改
- 未授权真实扣费

真实腾讯云控制台式操作、真实资源创建/释放/修改、真实扣费路径不属于当前合同授权。Portal 本地余额充值、退款和公告管理只属于 Portal 本地管理动作，不代表真实支付通道或真实云资源变更。

## 当前 MVP 与后续真实资源边界

当前 MVP 阶段：

- 允许已接入的本地 Portal 管理动作，不伪造未接入动作。
- 不创建真实资源。
- 不真实扣费。
- 不调用真实腾讯云/COS/Langfuse/one-person-lab。
- 不读取 secret。
- 不改 deploy / .sentrux / adapters / upstream。
- 不改 Gateway / Runtime Bridge，除非后续合同明确授权。

后续真实资源接入必须另开 `feat/*` 和 authorized implementation 合同，并单独授权 secret、真实云 API、真实资源创建/释放、真实扣费路径、deploy 和 live-test。

## Cleanup / 防污染规则

repo-tracked contracts/docs/scripts/tests 是 truth。tmux session、agent 对话、本地状态、临时日志不进仓库。

并行写任务必须用独立 worktree。根工作区只用于规划、审查、吸收、push、清理。

one-person-lab 防污染边界继续生效：

- 不把 upstream 内部逻辑写进 Portal。
- 不 import upstream 内部模块。
- 不让历史 v19/v20/v21 路线不得重新成为 v22 主线。
- 旧入口、旧云控制台叙事、旧资源管理路线不得重新成为 v22 主线。

Cleanup 要清掉旧入口、旧文案、旧 API 暴露和权限绕过。清理动作必须有对应合同或 smoke 守住，不靠本地对话、tmux session 或临时日志作为真相。

## Contract Data

<!-- v22-portal-admin-ops-surface-contract:start -->
```json
{
  "contract": "v22_portal_admin_ops_surface_boundary",
  "version": 1,
  "samePortalApp": true,
  "sameLoginAndShell": true,
  "roleSurface": "admin_ops",
  "adminRoutePrefix": "/admin/*",
  "adminRoleOnly": true,
  "userNavigationShowsAdminEntry": false,
  "localPortalAdminActionsEnabled": true,
  "readonlyOpsAndCloudMvp": true,
  "realCloudMutation": false,
  "localPortalAccountingActionsEnabled": true,
  "visibleContent": [
    "账号列表和状态",
    "工作空间列表和归属账号",
    "工作台资源套餐",
    "CPU",
    "内存",
    "文件空间",
    "并发",
    "队列",
    "当前运行中的 session/run/task",
    "文件空间用量",
    "7 天保护期占用",
    "费用估算",
    "冻结金额",
    "T+1 对账状态",
    "分账标签",
    "审计事件",
    "异常",
    "释放失败",
    "账单异常",
    "公告管理入口"
  ],
  "costAllocationTags": [
    "resourceBindingId",
    "cloudOperationId",
    "billingAttributionId",
    "accountId",
    "runId",
    "serverPlanId",
    "tenantId",
    "workspaceId",
    "environmentId",
    "retiredResourceOrderIdentifiersForbidden"
  ],
  "forbiddenVisibilityAndActions": [
    "SecretId",
    "SecretKey",
    "token",
    "raw API Key",
    "kubeconfig",
    "objectKey",
    "storageKey",
    "cosPrefix",
    "storageBackend",
    "signedUrl",
    "未授权真实云创建/释放/修改",
    "未授权真实扣费"
  ],
  "localPortalAdminActions": [
    "查看用户详情",
    "Portal 本地账户充值",
    "Portal 本地账本退款",
    "启用用户",
    "禁用用户",
    "软删除用户",
    "新建公告",
    "编辑公告",
    "发布公告",
    "下线公告",
    "置顶公告",
    "删除公告",
    "标记当前 billing ops 事实源中的本地账单运营项"
  ],
  "readonlyOrDisabledProductStates": [
    "/admin/ops",
    "真实账单审批",
    "高风险站点设置",
    "真实待处理事项审批",
    "真实云资源操作",
    "真实扣费"
  ],
  "currentMvp": {
    "callsRealTencentCloud": false,
    "callsRealCos": false,
    "callsRealLangfuse": false,
    "callsRealOnePersonLab": false,
    "createsRealResources": false,
    "realBillingMutation": false
  },
  "futureAuthorizationRequired": [
    "feat/*",
    "authorized implementation 合同",
    "secret",
    "真实云 API",
    "真实资源创建/释放",
    "真实扣费路径"
  ],
  "forbiddenPaths": [
    "deploy",
    ".sentrux",
    "adapters",
    "upstream"
  ],
  "uiPrimaryLanguage": [
    "账号",
    "工作空间"
  ],
  "notUiPrimaryNarrative": [
    "租户",
    "运行环境"
  ],
  "cleanupAndPollutionGuard": {
    "repoTrackedTruth": [
      "contracts",
      "docs",
      "scripts",
      "tests"
    ],
    "localStateNotTruth": [
      "tmux session",
      "agent 对话",
      "本地状态",
      "临时日志"
    ],
    "parallelWriteTasksUseIndependentWorktree": true,
    "rootWorkspaceUse": [
      "规划",
      "审查",
      "吸收",
      "push",
      "清理"
    ],
    "doNotWriteUpstreamInternalLogicIntoPortal": true,
    "legacyRoutesMustNotBecomeV22Mainline": [
      "旧入口",
      "旧云控制台叙事",
      "旧资源管理路线",
      "历史 v19/v20/v21 路线"
    ]
  }
}
```
<!-- v22-portal-admin-ops-surface-contract:end -->

## Non-goals

- 不实现新 UI。
- 不改 Portal 代码。
- 不读取 secret。
- 不调用真实云。
- 不创建、绑定、释放或修改真实资源。
- 不真实扣费。
- 不改 deploy / .sentrux / adapters / upstream。
- 不运行 build/push/kubectl/live-test。

### spec:v22-portal-figma-make-ui-implementation-boundary

Former leaf id: `v22-portal-figma-make-ui-implementation-boundary`
Former title: v22 Portal Figma Make UI Implementation Boundary

本合同是 Portal 前端技术栈与 Figma Make UI 吸收的 L4 实现叶子合同。它只授权 Portal frontend 层的技术栈与 UI 实现收敛，不改变 v22 主产品真相，不授权真实云、secret、upstream、deploy、build/push、kubectl 或 live-test。

模型记录：`gpt-5.4`

## 合同目的

本轮不新开 v26。v22 Portal 继续是 MedOPL 的 SaaS 控制面：用户购买托管 OPL 科研工作台、计算能力、文件空间和运行环境，平台负责开通、隔离、计费、审计和释放。

本合同授权把 Portal 全体前端技术栈从历史 Vue / Pinia 方向收敛为 React + Vite + TypeScript + react-router + shadcn/Radix + lucide。这里的“Portal 全体前端技术栈”包括普通用户 Portal 和管理员 Portal；当前 Figma Make ZIP 覆盖普通用户和管理员 Portal active route。

## Figma Make 吸收边界

当前可吸收 Figma Make 文件：

- fileKey: `pjLYKml89XFsf8BMNOJ3CV`
- title: MedOPL Portal UI Design
- implementation source: Figma Make ZIP
- zip path: `/mnt/c/Users/Administrator/Downloads/MedOPL+Portal+UI+Design+(1).zip`
- extracted path: `/tmp/medopl-figma-make-source-admin`

本轮的唯一 Portal UI source-of-truth 是上述 Figma Make ZIP，不再按上一轮“合同重组后自行实现的 React shell”作为 UI 事实源继续补丁式吸收。验收以 ZIP 文件树、active route、API adapter、typecheck/build 和本地预览为准。

当前可吸收的普通用户路由：

- `/overview`
- `/resources`
- `/workspace`
- `/trace`
- `/billing`
- `/opl-launch`

当前可吸收的管理员路由：

- `/admin/dashboard`
- `/admin/users`
- `/admin/alerts`
- `/admin/billing-ops`
- `/admin/audit`
- `/admin/system`
- `/admin/ops`

上一轮 ZIP residue 不再进入 active frontend，具体 retired path 由 `tests/health/health-check-v22-archive-smoke-contract-physical-retirement-gate.mjs` 统一列出。当前管理员 UI 以新 ZIP 的 `src/app/pages/admin/*` 为准，必须挂载 active route、进入管理员导航，并通过 `RoleContext` 读取后端 `/api/me` 的角色投影控制导航显示。RoleContext 不是安全边界；真实 admin 权限继续由 `/api/admin/*` 后端校验和 403 裁定。

## 清退边界

本轮不是只做故事线清退，而是同时做合同 current-truth 清退、Portal frontend 旧代码清退和物理清退。合同层要把旧目标栈、历史 UI evidence、旧 admin residue 完成声明、上一轮非 ZIP 1:1 的 React shell 从当前事实源移除；代码层要把 retired frontend surface gate 中列出的旧 frontend 路径从 `services/portal/frontend/**` 清退，并用 Figma Make ZIP React/Vite UI 接替普通用户和管理员 Portal。

本轮清退的旧 frontend surface：

- 历史 Vue SPA 实现。
- `/packages` 普通用户路由。
- `/advanced/servers` 旧高级服务器路由。
- 历史 `/runtime`、`/tasks`、`/opl` 兼容入口。
- Vue/Pinia 作为 Portal frontend 目标技术栈的合同文案。
- Figma 只能回写历史前端框架或不得引入 React/shadcn 的历史文案。

## API 接入边界

Figma Make UI 不能停留在静态 mock。普通用户 6 个页面必须接现有 Portal API adapter：

- `/overview`: `fetchOverview()` 与 `fetchMyResources()`，对应 `/api/overview` 和 `/api/platform-provisioned-resources`。
- `/resources`: `fetchMyResources()`，对应 `/api/platform-provisioned-resources`。
- `/workspace`: `fetchWorkspacePage()`，对应 `/api/workspace`。
- `/trace`: `fetchSessionTraces()`，对应 `/api/session-traces`。
- `/billing`: `fetchBillingSummary()` 与 `fetchBillingDetails()`，对应 `/api/billing/summary` 和 `/api/billing/details`。
- `/opl-launch`: `fetchOplLaunchStatus()`、`fetchOplBootstrap()`、`bindOplSession()`，对应 `/api/opl/launch-status/{launchId}`、`/api/opl/bootstrap` 和 `/api/opl/sessions/bind`。

管理员页面必须接现有 `/api/admin/*` adapter：

- `/admin/dashboard`: `fetchAdminOverview()`，对应 `/api/admin/overview`。
- `/admin/users`: `fetchAdminUsers()`，对应 `/api/admin/users`；用户查看、Portal 本地账户充值、Portal 本地账本退款、启用/禁用和软删除必须接现有本地 Portal admin action。
- `/admin/alerts`: `fetchAdminAlerts()` 与 `fetchAnnouncements()`，对应 `/api/admin/alerts` 和 `/api/announcements`；公告新建、编辑、发布/下线、置顶和删除必须接现有本地 Portal admin action。
- `/admin/billing-ops`: `fetchAdminBillingOps()`，对应 `/api/admin/billing-ops`。
- `/admin/audit`: `fetchAdminAudit()`，对应 `/api/admin/audit`。
- `/admin/system`: `fetchAdminSystem()`，对应 `/api/admin/system`。
- `/admin/ops`: `fetchAdminOps()`，对应 `/api/admin/ops`；该后端 API 在默认未启用运维 surface 时允许返回 `404 ops_surface_disabled`，前端必须把它映射成“平台托管运维入口未启用”的产品态，而不是 generic error 或伪成功。

API 接入只允许走 `services/portal/frontend/src/api/portal/*.ts` 和 `goControlPlaneClient` 的 `/api` baseURL，或走已有 `/portal/admin/*` HTML form action 的本地 Portal 管理端点；本轮不改 Portal 后端服务语义，不伪造成功态，不把 raw key、runtime token、objectKey、localPath 或 signedUrl 渲染到页面。

## 生命周期与文案边界

普通用户主语言继续使用：

- 托管科研工作台
- 运行环境
- 计算资源
- 文件空间
- 工作空间
- 任务与结果
- 账单与审计
- 余额
- 冻结金额
- 进入 OPL

存储生命周期固定为：

- 释放计算资源：停止计费并中断任务，文件空间继续保留，不触发保护期。
- 删除存储资源 / 文件空间：触发 7 天保护期，之后删除所有文件且无法恢复。
- 文件保留：随文件空间保留。

账单页可使用“核对已接入”“已核对”“实时同步”表达当前账单核对状态，但不得把 OpenCost、Langfuse、云账单原始字段或 trace metadata 写成普通用户的账单真相源。

## Secret 和浏览器边界

Portal frontend 不得把以下字段写入 localStorage、sessionStorage、URL query、全局 JS state、日志、evidence 或 git：

- raw API key
- bearer token
- launchToken
- runtimeToken
- provider secret
- SecretId
- SecretKey
- kubeconfig
- objectKey
- localPath
- signedUrl
- presignedUrl

Portal 普通用户页面最多展示 `providerKeyRef`、绑定状态和一次性输入态。raw key 输入和后端密钥边界继续由 token/provider key 合同和 OPL entry/preflight 合同约束。

## 部署边界

本轮默认部署模式是本地可预览部署：

- 安装 Portal frontend 依赖。
- 执行 typecheck/build。
- 启动 Vite dev 或 preview server。
- 提供本地 URL 给用户验收。

真实线上部署、build/push、kubectl、live-test、真实云资源操作和 secret-backed release 均必须另行取得明确授权，不得因本合同自动放行。

## Contract Data

<!-- v22-portal-figma-make-ui-implementation-contract:start -->
```json
{
  "contract": "v22_portal_figma_make_ui_implementation_boundary",
  "version": 2,
  "model": "gpt-5.4",
  "contractRole": "portal_frontend_stack_and_figma_make_implementation_leaf",
  "scope": {
    "portalFrontendOnly": true,
    "changesProductTruth": false,
    "callsRealCloud": false,
    "readsSecrets": false,
    "modifiesUpstream": false,
    "modifiesDeploy": false,
    "allowsPortalFrontendDependencyChange": true
  },
  "figmaMake": {
    "fileKey": "pjLYKml89XFsf8BMNOJ3CV",
    "currentCoverage": "user_portal_and_admin_portal",
    "singleUiSourceOfTruth": "figma_make_zip",
    "implementationSource": "figma_make_react_vite_zip_source",
    "sourceArtifact": {
      "zipPath": "/mnt/c/Users/Administrator/Downloads/MedOPL+Portal+UI+Design+(1).zip",
      "extractedPath": "/tmp/medopl-figma-make-source-admin"
    },
    "importsResidueCopiedToActiveFrontend": false,
    "adminConsoleCopiedAsUnroutedResidue": false,
    "activeAdminRouteMounted": true,
    "activeAdminRoutes": [
      "/admin/dashboard",
      "/admin/users",
      "/admin/alerts",
      "/admin/billing-ops",
      "/admin/audit",
      "/admin/system",
      "/admin/ops"
    ]
  },
  "portalFrontendStack": {
    "appliesToWholePortalFrontend": true,
    "required": [
      "React",
      "Vite",
      "TypeScript",
      "react-router",
      "shadcn/Radix",
      "lucide-react"
    ],
    "retiredTargetStack": [
      "Vue",
      "Pinia"
    ]
  },
  "userRoutes": [
    "/overview",
    "/resources",
    "/workspace",
    "/trace",
    "/billing",
    "/opl-launch"
  ],
  "adminRoutes": [
    "/admin/dashboard",
    "/admin/users",
    "/admin/alerts",
    "/admin/billing-ops",
    "/admin/audit",
    "/admin/system",
    "/admin/ops"
  ],
  "retiredFrontendRoutes": [
    "/packages",
    "/advanced/servers",
    "/runtime",
    "/tasks",
    "/opl"
  ],
  "physicalRetirement": {
    "contractCurrentTruthRetired": true,
    "oldVueSpaFilesRemoved": true,
    "oldVisualWorkbenchRemoved": true,
    "oldScreenshotBaselinesRemoved": true,
    "oldContractReorganizedReactUiRemoved": true,
    "oldAdminConsoleResidueRemoved": true,
    "figmaImportsResidueExcluded": true,
    "replacementUi": "figma_make_zip_user_admin_physical_source_absorption"
  },
  "apiIntegration": {
    "staticMockOnlyUiAllowed": false,
    "baseUrl": "/api",
    "adapterDirectory": "services/portal/frontend/src/api/portal",
    "requiredAdapters": [
      "overview",
      "resources",
      "workspace",
      "traces",
      "billing",
      "opl",
      "commercial",
      "sessions",
      "admin"
    ],
    "userRouteApiCoverage": {
      "/overview": [
        "/api/overview",
        "/api/platform-provisioned-resources"
      ],
      "/resources": [
        "/api/platform-provisioned-resources"
      ],
      "/workspace": [
        "/api/workspace"
      ],
      "/trace": [
        "/api/session-traces"
      ],
      "/billing": [
        "/api/billing/summary",
        "/api/billing/details"
      ],
      "/opl-launch": [
        "/api/opl/launch-status/{launchId}",
        "/api/opl/bootstrap",
        "/api/opl/sessions/bind"
      ]
    },
    "adminRouteApiCoverage": {
      "/admin/dashboard": [
        "/api/admin/overview"
      ],
      "/admin/users": [
        "/api/admin/users"
      ],
      "/admin/alerts": [
        "/api/admin/alerts"
      ],
      "/admin/billing-ops": [
        "/api/admin/billing-ops"
      ],
      "/admin/audit": [
        "/api/admin/audit"
      ],
      "/admin/system": [
        "/api/admin/system"
      ],
      "/admin/ops": [
        "/api/admin/ops"
      ]
    },
    "adminRouteActionCoverage": {
      "/admin/users": [
        "/portal/admin/recharge",
        "/portal/admin/ledger-adjust",
        "/portal/admin/toggle-user",
        "/portal/admin/delete-user"
      ],
      "/admin/alerts": [
        "/portal/admin/announcements/save",
        "/portal/admin/announcements/toggle",
        "/portal/admin/announcements/delete"
      ]
    },
    "adminRouteProductStates": {
      "/admin/ops": {
        "defaultDisabledStatus": 404,
        "defaultDisabledError": "ops_surface_disabled",
        "frontendMustRenderProductState": "平台托管运维入口未启用",
        "genericErrorForDisabledSurfaceAllowed": false,
        "fakeSuccessForDisabledSurfaceAllowed": false
      }
    }
  },
  "adminOpsUi": {
    "currentFigmaCoverage": true,
    "activeFrontendRoutes": true,
    "roleBoundaryStillApplies": true,
    "roleContextSecurityBoundary": false,
    "backendRoleProjectionRequired": true,
    "mockOnlyActionsAllowed": false,
    "localPortalAdminActionsEnabled": true,
    "opsSurfaceMayBeDisabledByBackend": true,
    "disabledProductStateRequired": true
  },
  "lifecycle": {
    "storageDeletionProtectionDays": 7,
    "releaseComputeTriggersStorageProtection": false,
    "fileRetentionCopy": "随文件空间保留"
  },
  "browserSecretHygiene": {
    "rawApiKeyInPublicState": false,
    "launchOrRuntimeTokenInPublicState": false,
    "storagePathOrSignedUrlInPublicState": false
  },
  "deployment": {
    "defaultMode": "local_preview_only",
    "trueProductionDeployRequiresSeparateAuthorization": true
  },
  "verificationCommands": [
    "node tests/regression/portal/regression-test-v22-portal-figma-make-interaction-readiness.mjs",
    "node tests/regression/portal/regression-test-v22-admin-ops-console-boundary.mjs",
    "git diff --check",
    "npm --prefix services/portal/frontend run typecheck",
    "npm --prefix services/portal/frontend run build"
  ]
}
```
<!-- v22-portal-figma-make-ui-implementation-contract:end -->

## 非目标

- 不修改 Portal 后端业务语义。
- 不绕过后端 admin 权限校验；RoleContext 只控制导航显示，不作为安全边界。
- 不读取 secret。
- 不调用真实腾讯云、COS、Langfuse、one-person-lab 或外部生产 API。
- 不修改 one-person-lab upstream。
- 不修改 deploy、`.sentrux` 或 `adapters`。
- 不执行真实线上部署、build/push、kubectl 或 live-test。

### spec:v22-portal-files-billing-trace-boundary

Former leaf id: `v22-portal-files-billing-trace-boundary`
Former title: v22 Portal Files Billing Trace Boundary Contract

本合同定义 MedOPL v22 MVP 闭环第四段：Portal 可展示用户工作空间文件、账单摘要和 session trace metadata。

## Product Boundary

用户主叙事必须是：

- 用户在 Portal 看到工作空间文件。
- 用户在 Portal 看到账单摘要和预扣费/冻结状态。
- 用户在 Portal 看到运行轨迹。
- 用户不需要理解 CVM、COS、K8s 或 TKE。

后台实现可以保留 `resourceBinding`、`providerKeyRef`、`auditTag` 和计费状态字段，但它们只作为平台内部合同、计费和审计边界。

## Canonical State Surface

Portal canonical state 必须能输出：

- `workspaceFiles`
- `outputFiles`
- `artifacts`
- `billingSummary`
- `freeze`
- `preauth`
- `sessionTraceMetadata`
- `managedEnvironment`
- `resourceBinding`

workspace file reference 和 artifact reference 是公开文件引用，不等于内部存储 key、对象 key、本地路径或签名 URL。

## File Space Management Surface

文件空间属于 workspace，和运行环境生命周期分离。托管运行环境释放、停止计费和审计不等于立即清空文件空间。

Portal workspace payload 可以输出 `fileSpace` 业务视图：

- `capacityGb` / `usedGb`
- `retentionDays: 7`
- `currentFolderRef`
- `folders`: `folderRef`、`name`、`parentFolderRef`、`path`、`status`
- `files`: `fileRef`、`name`、`folderRef`、`kind`、`source`、`runId`、`sessionId`、`artifactRef`、`sizeBytes`、`status`、`deletedAt`、`retentionUntil`
- `selectedFileRefs`
- `actions`
- `deletePolicy`

普通删除不需要二次确认，删除后进入 7 天保护期。永久删除和清空文件空间需要二次确认。输出文件必须继续通过 `runId`、`sessionId` 和 `artifactRef` 关联运行轨迹。

`fileSpace` 只表达 Portal 用户文件空间管理合同，不执行真实 COS 操作，不返回内部存储 key、对象 key、本地路径、签名 URL、云厂商凭据或 raw provider key。

本分支允许最小 Portal frontend 文件空间展示，用于呈现文件空间、文件夹、输入文件、输出文件、运行轨迹、保护期、批量下载和批量删除入口；真实 COS API、signed URL、拖拽、文件预览、协作权限、真实生命周期 worker 和 OPL Web 内部文件选择器深度接入仍需后续单独授权。

## Billing Summary

`billingSummary` 必须区分：

- `balance`：用户余额。
- `frozen`：冻结金额。
- `preauth`：预扣费状态。
- `estimatedUsage`：运行中的估算用量。
- `pendingReconciliation`：pending reconciliation / T+1 核对状态。
- `releaseStopBillingStatus`：尚未释放时必须为 `none`。

本合同不写正式价格，不把云成本价当 MedOPL 售卖价。

## Trace Metadata Whitelist

`sessionTraceMetadata` 只能包含：

- `sessionId`
- `workspaceId`
- `resourceBindingId`
- `providerKeyRef`
- artifact refs
- timestamps
- `status`
- `auditTag`

不得包含：

- raw prompt
- raw API key
- `launchToken`
- `runtimeToken`
- 内部存储密钥
- storage key / object key / local path / signed URL

Langfuse 只作为后续 trace metadata source，不进入 MVP 主产品叙事。

## Non-goals

- 不改 OPL Gateway。
- 不改 Runtime Bridge。
- 不改 deploy、`.sentrux` 或 `adapters`。
- 不修改 one-person-lab upstream。
- 不读取 `/home/dev/.secrets/medopl/secrets.env.txt`。
- 不调用真实云 API。
- 不运行 build/push/kubectl/live-test。

### spec:v22-portal-opl-connection-boundary

Former leaf id: `v22-portal-opl-connection-boundary`
Former title: v22 Portal-OPL Connection Boundary Contract

本合同定义 MedOPL v22 中 Portal 与 clean upstream OPL Web 的连接闭环。它只定义 Portal、OPL Web Gateway、Runtime Bridge / Runtime Agent 之间的边界，不修改 one-person-lab upstream，不 import upstream 内部模块，不读取 secret，不调用真实云 API，不运行 build/push/kubectl/live-test。

## Product Truth

MedOPL 的 OPL 连接闭环不是“能打开 OPL 页面”就完成。闭环必须是：

1. Portal 发起进入 OPL。
2. Gateway 打开 clean upstream OPL。
3. OPL 获取 MedOPL 公开上下文。
4. OPL session 绑定到 Portal 用户、tenant、workspace 和 runtime session。
5. OPL 发消息、上传文件或发起 run。
6. Runtime Agent 生成 run record、artifact reference、trace metadata 和 billing metadata。
7. Portal 按 workspace/session/run 展示文件、账单和运行轨迹。

one-person-lab upstream 只能作为 clean upstream 工作台。Portal 账号、密钥、资源绑定、计费、审计、trace 和腾讯云逻辑不得写进 upstream。

## Required Interfaces

Portal-OPL 连接闭环至少需要以下接口。路径名称表达合同角色；实现必须按 Runtime Bridge / Runtime Agent 边界收敛。已退役路径不得作为兼容解释、内部保留理由、用户入口、合同入口或后续新实现入口。

```text
POST /api/opl/launch
GET /runtime-bridge/api/opl/bootstrap
POST /runtime-bridge/api/opl/sessions/bind
POST /runtime-bridge/api/opl/messages
GET /runtime-bridge/api/opl/messages/{messageId}/status
POST /runtime-bridge/api/opl/files
POST /runtime-bridge/api/opl/runs
GET /runtime-bridge/api/opl/runs/{runId}/status
GET /runtime-bridge/api/opl/runs/{runId}/artifacts
GET /runtime-bridge/api/opl/artifacts/{artifactRef}
```

Portal 对 Runtime Bridge 的代理面必须与 Runtime Bridge 稳定接口对齐，至少包含：

```text
GET /api/opl/bootstrap
POST /api/opl/sessions/bind
POST /api/opl/messages
GET /api/opl/messages/{messageId}/status
POST /api/opl/files
POST /api/opl/runs
GET /api/opl/runs/{runId}/status
GET /api/opl/runs/{runId}/artifacts
GET /api/opl/artifacts/{artifactRef}
```

现有 Runtime Bridge `/api/opl-launch/*` 可以作为当前实现路径，但它必须语义映射到 Runtime Bridge / Runtime Agent 边界。旧 `/api/runtime-sessions` 和 `/api/runtime-sessions/{id}/runs` 不得成为 v22 新主路径。

## Identity And Ownership Fields

Portal-OPL 连接闭环中的公开或后端归属对象必须能表达：

- `portalUserId`
- `tenantId`
- `workspaceId`
- `workspaceSessionId`
- `oplSessionId`
- `runtimeSessionId`
- `resourceBindingId`
- `runId`
- `traceId`
- `providerKeyRef`
- `providerBound`
- `artifactRef`

这些字段的用户可见性不同：普通用户界面可以讲“工作空间、任务、文件、运行轨迹”，但 `tenantId`、`resourceBindingId`、内部 trace / billing tags 只属于后台隔离、计费、审计和运维边界。

## Workspace Binding Is Required

workspace 绑定是必需项，不是可选装饰字段。原因是：

- 文件归属：输入文件、输出文件、artifact reference 必须归属到 workspace。
- 运行归属：runId 必须归属到 workspace、runtimeSession 和 resourceBinding。
- 计费归属：usage、preauth、freeze、cost summary 必须挂到 billing account 和 workspace。
- 审计归属：trace、release、T+1 audit 必须能回到 tenant、workspace 和 resourceBinding。
- 隔离归属：不同用户、tenant 和 workspace 的 OPL session、文件和 run 不得串读。

没有 workspaceId 的 OPL session 或 run 必须失败，不能隐式落到 default workspace 或 legacy task-space。缺少 workspaceId 时应返回稳定错误，例如 `workspace_required`；缺少 active resource binding 时 run 必须失败。

## Launch And Bootstrap

`POST /api/opl/launch` 由 Portal 发起。它必须检查 Portal session、workspace、Gateway / upstream entry 状态和用户自己的 provider binding，并创建服务端 launch session。managed environment / resource binding 状态不得作为 workbench entry 的阻塞条件；它们只阻塞 managed run。

Portal launch response 可以返回：

- `ok`
- `launchId`
- `openUrl`
- `launchStatus`
- `workspaceId`
- `providerBound`
- `providerKeyRef`

Portal launch response 不得返回 raw API key、bearer token、launchToken、runtimeToken、objectKey、localPath、signedUrl 或 provider secret。

`GET /runtime-bridge/api/opl/bootstrap` 由 Gateway / OPL 通过 httpOnly cookie 或服务端 launch session 获取公开上下文。bootstrap 只允许包含公开上下文：

- `portalUserId`
- `tenantId`
- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `oplSessionId`
- `providerBound`
- `providerKeyRef`
- `canStartRun`
- `launchStatus`
- Portal return URL

bootstrap 不含 raw key、token 或内部存储路径。

## Token And Secret Boundary

launchToken/runtimeToken 只能保存在 httpOnly cookie 或服务端 launch session，不得暴露给 OPL/browser public state。

必须满足：

- launchToken/runtimeToken 不得进入 URL query。
- launchToken/runtimeToken 不得进入 localStorage/sessionStorage。
- raw gflabtoken API key 不得进入 upstream、browser public state、response、log、evidence 或 git。
- OPL/browser public state 不得持有 raw API key、bearer token、objectKey、localPath、signedUrl。
- Gateway 必须拒绝 URL query 中的 apiKey、providerApiKey、launchToken、runtimeToken 或 bearer token 类字段。
- Runtime Agent 只能接收 `providerKeyRef`，不得接收 raw API key。

## Session Binding

`POST /runtime-bridge/api/opl/sessions/bind` 用于把 upstream OPL 的 session 与 MedOPL launch context 绑定。

请求可以包含：

- `oplSessionId`
- `clientSessionState`
- message / run capability hints

请求不得要求 OPL 回传 raw API key。直接访问 `opl.medopl.cn` 时处理 MedOPL 账号密码，并收取或复用用户自己的 gflabtoken provider key。Portal 发起进入 OPL 时复用 Portal session / launch session 和后端 provider binding。

session bind 成功后，平台必须能得到以下关系：

```text
portalUserId + tenantId + workspaceId + workspaceSessionId + runtimeSessionId + resourceBindingId + oplSessionId
```

## Runtime Bridge Decoupling And Anti-Corruption Boundary

Portal 只依赖 MedOPL 稳定接口，不得依赖 one-person-lab upstream 内部 API、DOM、store、数据库 schema 或内部 session model。

Gateway / Runtime Bridge 是 anti-corruption layer。它负责把 upstream OPL 的页面、路由、事件或接口变化翻译成 MedOPL 稳定合同。upstream OPL 更新只允许改 Gateway/Runtime Bridge 映射层，不能改 Portal billing、workspace、resourceBinding、provider secret 或 audit 的核心合同。

不同 API 必须低耦合演进：

- Portal launch API 只创建 MedOPL launch session，不调用 upstream 内部 API。
- Gateway bootstrap API 只暴露 MedOPL public context，不透传 upstream private state。
- session bind API 只接受 normalized OPL session identity，不要求 Portal 理解 upstream session model。
- OPL message/file/run 事件必须先归一化为 MedOPL canonical event，再进入 Runtime Agent、文件空间、trace 或 billing 边界。
- artifact projection API 只返回 MedOPL artifact/output file reference，不透传 upstream 或存储后端路径。

bootstrap 和 Runtime Bridge status 必须能表达：

- `runtimeBridgeContractVersion`
- `capabilities`
- `supportedEvents`

`capabilities` 至少区分 message、file upload、run start、run status、artifact list、artifact download。`supportedEvents` 至少区分 session bound、message created、file referenced、run started、run updated、artifact created。

如果 upstream OPL 缺少某个能力、能力版本不兼容或映射层尚未实现，Runtime Bridge 必须显式返回 `capability_not_supported`，不能隐式兜底、伪装成功或把未知 upstream shape 直接写入 Portal 状态。

真实 upstream 能力必须先由 canary 分类，不能从 fake Product API fixture 推断：

- `real_http_product_api`: 真实 upstream HTTP Product API endpoint 存在，可直接由 Gateway/Runtime Bridge 访问。
- `mapped_to_acp_runtime`: 真实 upstream 没有对应 HTTP endpoint，但存在公开 ACP/CLI runtime 边界，可由 Runtime Bridge 映射。
- `capability_not_supported`: 真实 upstream 不存在、返回不兼容，或映射层尚未完成；Runtime Bridge 必须显式返回该状态。

2026-05-10 的 `/home/dev/projects/one-person-lab` 主仓 canary 结论是：`opl web` 已 retired，主仓没有 `/api/opl/system`、`/api/opl/messages`、`/api/opl/sessions` HTTP Product API；`opl session runtime --acp` 可作为 bootstrap/session bind 的公开映射面；`workspace_list`、无 secret 的真实 message prompt 和 WebUI 文件上传暂不支持或未验证。

2026-05-10 的真实 WebUI canary 结论是：独立 OPL/AionUI WebUI 可作为真实浏览器工作台进程启动，`GET /`、`GET /api/auth/status`、`GET /api/auth/user` 可真实访问；Gateway 指向该 WebUI 后可代理页面、注入 launch script、拒绝 secret query，并代理 WebSocket bridge。该 WebUI 的真实 session 协议是 WebSocket bridge，`create-conversation`、`database.get-user-conversations`、`database.get-conversation-messages` 已完成真实 session 创建和数据库回读。`/api/opl/system`、`/api/opl/sessions`、`/api/opl/messages` 在该 WebUI 上只是通用 `/api` catch-all 的 200 placeholder，不是 Product API；discovery 当时只能证明 `chat.send.message` 进入 WebUI/ACP 启动路径，不能证明 AI reply，因此必须标为 `capability_not_supported`。

历史授权 provider message live canary 脱敏 evidence 结论是：在用户显式授权 `REAL_OPL_PROVIDER_MESSAGE_CANARY=1`、`OPL_PROVIDER_SECRET_FILE` 和真实 WebUI 来源后，Portal -> Gateway -> Runtime Bridge -> clean OPL WebUI bridge -> provider message 曾观测到真实 assistant reply，并以 `capabilitySource=mapped_to_webui_bridge` 回流 Portal message status 与 Portal session trace。该 evidence 只证明当次授权路径的 provider message/reply，不证明 `/api/opl/*` HTTP Product API、真实 WebUI file upload、run/artifact、真实云 runtime 或 Langfuse 已上线；后续再次执行必须重新授权。

2026-05-10 的真实 WebUI Runtime Bridge flow 结论是：Runtime Bridge 可以在 `OPL_RUNTIME_MODE=webui` 下通过 `OPL_WEBUI_BRIDGE_URL`/`OPL_WEB_URL` 连接真实 OPL/AionUI WebUI WebSocket bridge；launch 阶段创建真实 WebUI conversation，bootstrap 从 WebUI database 回读 session，并在 Runtime Bridge state 写入 `opl_webui_bridge_session_created` 和 `opl_session_bound`。该模式仍必须把 `/api/opl/*` HTTP Product API 分类为 `capability_not_supported`；message reply 在未授权真实 provider canary 时返回 `provider_authorization_required`、`deferred_authorization` 或 `capability_not_supported`，run 在没有真实 Runtime Agent relay 时返回明确失败，不能生成伪 run/artifact 成功。

每个 API 的验收不得只检查 HTTP 200/201/202。必须同时证明真实访问和真实回流：

- `GET /runtime-bridge/api/opl/bootstrap` 必须访问 upstream/Product API 的 health、system、engines、modules、agents、workspaces、sessions、progress 和 artifacts 边界；返回值必须来自这些访问结果和 Runtime Bridge state projection，不能只本地构造。
- 当真实 upstream 没有 HTTP Product API 而只有 ACP/CLI 边界时，bootstrap 必须证明 `initialize`、`session_list`、`session_ledger` 等公开 ACP 命令被真实访问，并对缺失或不兼容能力返回 `capability_not_supported`。
- `POST /runtime-bridge/api/opl/sessions/bind` 必须更新 runtime session 的 `oplSessionId`、workspace、tenant、resourceBinding 和 provider binding 关系，并写入 `opl_session_bound` 事件。
- `POST /runtime-bridge/api/opl/messages` 必须把 normalized message 发到 OPL Product API 或公开 ACP/runtime 边界，并把 message request、reply、message artifact 和 trace 写回 Runtime Bridge state。
- `GET /runtime-bridge/api/opl/messages/{messageId}/status` 必须读取前序 message 写入的 request/reply/trace 状态，不能返回静态成功。
- `POST /runtime-bridge/api/opl/files` 必须新增 workspace-scoped input artifact record，并返回该 record 的 public `fileRef`。
- `POST /runtime-bridge/api/opl/runs` 必须调用 Runtime Agent relay/API 边界，并把 run record、runtime artifact、session ledger entry 和 trace 写回 Runtime Bridge state。
- `GET /runtime-bridge/api/opl/runs/{runId}/status`、`GET /runtime-bridge/api/opl/runs/{runId}/artifacts` 和 `GET /runtime-bridge/api/opl/artifacts/{artifactRef}` 必须读取前序 run/file 产生的 state record，且按 launch/session/workspace 鉴权。
- Portal frontend 只能通过 Go backend `/api/opl/*` 读取 OPL launch/bootstrap/session/message/file/run/artifact projection；Node Portal backend 不得作为代理、shell、facade、typed API owner 或 current verification owner。
- Go backend `/api/opl/*` 必须用当前用户的 `launchId` 换取后端 launch token，跨用户 `launchId` 必须拒绝，成功响应必须来自 Runtime Bridge 回流而不是 Portal 本地伪造。
- Runtime Bridge state 写入必须能保留并发 message/file/run 回流，不得因为异步写入互相覆盖、读到半写 JSON 或用最后写入覆盖前序状态。

禁止事项：

- 禁止 Portal 直接追踪 upstream route、DOM selector、frontend store、database schema 或 internal session model。
- 禁止 Runtime Agent 直接依赖 upstream UI 事件原始 shape。
- 禁止把 upstream raw event、raw prompt、raw file path 或 raw response 原样写入 Portal trace / billing / audit。
- 禁止为适配 upstream 更新而修改 one-person-lab upstream 源码。

## Messages, Files, Runs

OPL 工作流通过 Runtime Bridge / Runtime Agent 边界接入：

- `POST /runtime-bridge/api/opl/messages` 记录 OPL message metadata，不保存 raw prompt 到公开 trace。
- `GET /runtime-bridge/api/opl/messages/{messageId}/status` 返回 message 的 sanitized 进度，不暴露 launch token、raw prompt 或 provider secret。
- `POST /runtime-bridge/api/opl/files` 生成 workspace file reference，不返回 objectKey、localPath、signedUrl。
- `POST /runtime-bridge/api/opl/runs` 使用 workspace file reference 发起 run。
- `GET /runtime-bridge/api/opl/runs/{runId}/status` 和 `GET /runtime-bridge/api/opl/runs/{runId}/artifacts` 必须按 launch/session/workspace 鉴权后返回。
- `GET /runtime-bridge/api/opl/artifacts/{artifactRef}` 只返回当前 launch/session/workspace 可见的 artifact projection。

run 必须执行以下 gate：

- 每个用户使用自己的 gflabtoken API Key 作为模型调用凭证；未绑定用户自己的 gflabtoken provider key 时，run 返回 `provider_key_required`。
- 未开通托管运行环境或缺少 active `resourceBindingId` 时，run 返回 `managed_environment_required`。
- 缺少 Runtime Agent identity 或 endpoint 时，run 返回 `platform_isolated_runtime_agent_required`。
- Runtime Agent 只能接收 `providerKeyRef`，不得接收 raw API key。

run 成功后必须生成 `runId`，并把 `traceId`、`workspaceId`、`runtimeSessionId`、`resourceBindingId`、`providerKeyRef`、artifact refs 和 sanitized usage/cost summary 写回 Portal 可投影状态。

## Current Productionization Boundary Status

- productionization_status: contract_refresh_only
- absorbed_canary_fact: local Runtime Agent HTTP API relay full-loop
- absorbed_canary_fact: WebUI bridge negative no-fake-success gates
- absorbed_canary_fact: provider message reply is message-only
- not_production_truth: real cloud runtime is not上线
- not_production_truth: COS billing reconciliation is not上线
- not_production_truth: Langfuse / trace.medopl.cn is not deployed
- not_production_truth: one-person-lab upstream HTTP Product API is not available
- production implementation must not treat local canary evidence as deployment evidence

当前可吸收事实只说明 Portal / Gateway / Runtime Bridge / Runtime Agent HTTP API 本地 relay 的接口形状、workspace-scoped fileRef、run/artifact projection、no-fake-success gate 和 message reply canary 边界已被本地或授权 canary 证明。它不说明真实云 runtime、真实 COS 账单、生产部署、Langfuse 或 `trace.medopl.cn` 已上线。后续 production implementation 必须继续把这些事实作为输入边界，而不是把 canary evidence 当作生产部署证据。

## Artifact And Portal Projection

输出文件只以 `artifactRef` 或 `outputFileRef` 回到 Portal。

公开 artifact / output file projection 只允许包含：

- `artifactRef`
- `outputFileRef`
- `runId`
- `sessionId`
- `workspaceId`
- `resourceBindingId`
- `providerKeyRef`
- `kind`
- `name`
- `relativePath`
- `sizeBytes`
- `contentType`
- sanitized status / timestamps

不得包含 objectKey、storageKey、localPath、signedUrl、presignedUrl、raw API key、launchToken、runtimeToken 或 bearer token。

## Acceptance

本合同的闭环验收点：

1. Portal 点击“进入 OPL 工作台”后打开 clean upstream OPL。
2. bootstrap 不含 raw key、token 或内部存储路径。
3. OPL session 绑定到 `portalUserId`、`tenantId`、`workspaceId`、`runtimeSessionId` 和 `resourceBindingId`。
4. bootstrap、message、file、run、status、artifact API 都有真实访问和真实状态回流证据，不接受只返回 200/201/202。
5. 没有用户自己的 gflabtoken `providerKeyRef` 时不能 start run，返回 `provider_key_required`。
6. 未开通 runtime / resourceBinding 时不能 start run，返回 `managed_environment_required`。
7. start run 后平台生成 `runId`。
8. 输出文件只以 `artifactRef` 或 `outputFileRef` 回到 Portal。
9. Portal 能按 workspace、session 和 run 看到任务、文件、trace 和账单状态。
10. 真实 OPL canary 必须输出接口事实：哪些 HTTP Product API 真实存在，哪些能力映射到 ACP/CLI，哪些能力暂不支持；fake upstream smoke 只能证明合同实现，不能证明 one-person-lab 主仓真实 API 存在。

## Non-goals

- 不修改 one-person-lab upstream。
- 不 import upstream 内部模块。
- 不接真实云资源开通。
- 不读取 secret、kubeconfig、SecretId、SecretKey、SSH private key 或 `.env`。
- 不调用真实腾讯云、COS、Langfuse、one-person-lab 或外部生产 API。
- 不运行 build/push/kubectl/live-test。
- 不修改 deploy、`.sentrux` 或 `adapters`。
- 不把 `user_owned`、旧 resource-order、旧 runner/provisioner、OpenCost 或 Langfuse 主叙事恢复成 v22 主路径。

## Smoke

本合同由本地 smoke 固化：

```text
node tests/smoke/smoke-test-v22-portal-opl-connection-contract.mjs
node tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-state-store-atomic-flow.mjs
node tests/contract/runtime-bridge/contract-test-v22-runtime-gate-contract.mjs
```

这些 smoke 只检查 repo-tracked 合同、索引、本地 Portal/Gateway/Runtime Bridge contract shape 和本地 MVP suite，不读取 secret，不调用真实云，不运行 live-test，不修改 upstream。

真实 upstream capability classification 的历史 evidence 只保留为 `.runtime/real-opl-canary/evidence.json` 脱敏记录和合同状态；对应真实 upstream runner 不属于 active repo executable surface。后续如果要重新验证 `/home/dev/projects/one-person-lab` 的公开 CLI/ACP 边界，必须单独开 future-authorized boundary，不修改 upstream，不读取 secret，不调用真实云，不把 fixture Product API 当真实接口结论。

真实 WebUI canary 的历史 evidence 只保留为 `.runtime/real-opl-webui-canary/evidence.json` 脱敏记录和合同状态；对应真实 WebUI runner 不属于 active repo executable surface。后续如果要重新启动或连接独立 OPL/AionUI WebUI，必须单独授权 WebUI 来源，不修改 WebUI/upstream，不读取 secret，不调用真实云，不把 HTTP 200 placeholder 当真实 Product API。

`tests/future-authorized/cloud/future-authorized-test-v22-real-opl-webui-runtime-bridge-flow.mjs` 暂保留为显式 WebUI 来源下的 Runtime Bridge boundary proof；它不进入默认 MVP suite，不能作为默认产品入口、live-test 或 production deploy evidence。运行它必须有明确 `OPL_REAL_WEBUI_DIR` 或 `OPL_REAL_WEBUI_URL`，证据只保存在 `.runtime/real-opl-webui-runtime-bridge-flow`，不进 git。

### spec:v22-portal-opl-context-backflow-boundary

Former leaf id: `v22-portal-opl-context-backflow-boundary`
Former title: v22 Portal-OPL Context Backflow Boundary Contract

本合同定义 MedOPL v22 中 Portal 与 clean upstream OPL WebUI 之间的 context/backflow 闭环。它回答三件事：

1. Portal 怎么打通 OPL。
2. OPL 怎么拿到 Portal / MedOPL 上下文。
3. OPL 产生的 session、message 和能力状态怎么反馈给 Portal。

本合同不实现真实云 runtime，不部署 Langfuse，不修改 one-person-lab upstream，不 import upstream 内部模块，不读取 secret，不调用真实云 API，不运行 build/push/kubectl/live-test，不修改 deploy、`.sentrux` 或 `adapters`。

## Contract Level

合同分级如下：

- Level 1: [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop)。一级主合同，定义 MedOPL 托管 OPL SaaS 用户主闭环。
- Level 2: [spec:v22-portal-opl-connection-boundary](#spec-v22-portal-opl-connection-boundary) 和 [spec:v22-upstream-opl-boundary](#spec-v22-upstream-opl-boundary)。二级段合同，定义 Portal-OPL 连接和 upstream clean 边界。
- Level 3: 本合同。Portal-OPL context/backflow execution contract，细化 launch、Gateway、bootstrap、session bind、message backflow、capability registry、Portal projection、下游 runtime gate 和下游 Langfuse session trace boundary。

本合同是三级执行合同，不替代一级主合同和二级段合同。

## Subscription Package

本合同订阅以下合同包：

- [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop)
- [spec:v22-portal-opl-connection-boundary](#spec-v22-portal-opl-connection-boundary)
- [spec:v22-upstream-opl-boundary](#spec-v22-upstream-opl-boundary)
- [spec:v22-opl-work-message-file-run-boundary](#spec-v22-opl-work-message-file-run-boundary)
- [spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary](#spec-v22-runtime-bridge-session-run-file-provider-keyref-boundary)
- [spec:v22-portal-files-billing-trace-boundary](#spec-v22-portal-files-billing-trace-boundary)
- [spec:v22-token-provider-boundary](#spec-v22-token-provider-boundary)
- [spec:v22-langfuse-observability-metadata-boundary](#spec-v22-langfuse-observability-metadata-boundary)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)

规范路径为：

- `docs/active/README.md`
- `docs/active/README.md`

## Product Truth

当前分支的 Primary Scope 是：

```text
Portal
  -> Gateway
  -> clean OPL WebUI
  -> Runtime Bridge bootstrap/session/message backflow
  -> Portal projection
```

产品真相：

```text
Portal 是 SaaS control plane。
Gateway 是 clean OPL WebUI entry/proxy。
Runtime Bridge 是 OPL context/backflow anti-corruption layer。
Runtime Bridge / Runtime Agent is the downstream canonical source for run, artifact, ledger, trace, and billing metadata.
Langfuse is not the canonical source; it is an optional sanitized session trace attachment.
one-person-lab upstream remains clean.
```

Portal 不理解 OPL 内部协议。Gateway 不成为业务真相源。Runtime Bridge 只负责上下文、能力注册、事件归一和 Portal projection，不伪造业务成功。Runtime Bridge / Runtime Agent 是下游 runtime 事实源；This contract does not implement cloud runtime。Langfuse 只接收清洗后的 session/trace metadata；This contract does not deploy Langfuse。

## Complete Portal-OPL Link Validation Path

完整开发验收必须沿着 [portal-opl-context-backflow-validation-path.md](../history/README.md) 执行。该链路从 discovery baseline 开始，依次验证 Portal launch、Gateway proxy、OPL context bootstrap、session binding、message backflow、Portal projection、下游 runtime gate、下游 Langfuse session trace boundary 和性能对比。

任何实现分支如果只通过本地 fake Product API 或只返回 200/201/202，不能宣称完成真实 Portal-OPL context/backflow 闭环。

## Stable API Surface

Portal 与 Runtime Bridge 的核心稳定接口固定为：

```text
POST /api/opl/launch
GET /runtime-bridge/api/opl/bootstrap
GET /runtime-bridge/api/opl/status
POST /runtime-bridge/api/opl/sessions/bind
POST /runtime-bridge/api/opl/messages
GET /runtime-bridge/api/opl/messages/{messageId}/status
```

以下接口属于下游 intent / projection 边界，可以在本合同中声明 gate，但不要求当前分支实现真实 runtime：

```text
POST /runtime-bridge/api/opl/files
POST /runtime-bridge/api/opl/runs
GET /runtime-bridge/api/opl/runs/{runId}/status
GET /runtime-bridge/api/opl/runs/{runId}/artifacts
GET /runtime-bridge/api/opl/artifacts/{artifactRef}
```

Portal 代理接口必须只映射到 Runtime Bridge 稳定边界。Portal 不能直接依赖 one-person-lab route、WebSocket event shape、DOM、frontend store、database schema 或 internal session model。

## Module Boundaries

### Portal SaaS Control Plane

Portal 负责 SaaS 产品控制面：

- 用户、租户、workspace、套餐、余额、托管环境、资源绑定和账单状态。
- OPL launch 入口。
- 当前用户与 `launchId`、workspace、resource binding 的授权校验。
- OPL context/backflow projection 展示。

Portal 输入：

- Portal session。
- `workspaceId`。
- `providerKeyRef` bound status。
- runtime/resource binding 状态。

Portal 输出：

- `launchId`。
- `openUrl`。
- public launch status。
- 通过 `/api/opl/*` 代理返回的 Runtime Bridge projection。

Portal 禁止：

- 保存或透出 raw API key、bearer token、`launchToken`、`runtimeToken`。
- 依赖 OPL WebUI 内部 state 或 DB schema。
- 用本地 fake state 代替 Runtime Bridge 回流。

### Gateway Entry And Secret Boundary

Gateway 负责 clean OPL WebUI 入口和安全反代：

- 通过 `OPL_UPSTREAM_URL` 指向真实 clean OPL WebUI。
- 代理 HTML、静态资源和 WebSocket bridge。
- 使用 httpOnly cookie 或服务端 launch session 关联 MedOPL context。
- 注入最小公开上下文：`workspaceId`、`runtimeSessionId`、`providerBound`、`providerKeyRef`、Portal return URL。
- 拒绝 URL query 中的 `apiKey`、`providerApiKey`、`launchToken`、`runtimeToken` 或 bearer token 类字段。

Gateway 不负责：

- run 成功与否。
- artifact 归属。
- billing truth。
- Langfuse trace truth。
- upstream protocol interpretation。

### OPL Context Bootstrap

OPL Context Bootstrap 负责让 clean OPL WebUI 获取 MedOPL public context。

输入：

- httpOnly cookie 或服务端 launch session。
- Gateway 转发的 bootstrap 请求。

输出：

- `portalUserId`
- `tenantId`
- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- optional `oplSessionId`
- `providerBound`
- `providerKeyRef`
- `canStartRun`
- `launchStatus`
- Portal return URL
- `runtimeBridgeContractVersion`
- capability registry

禁止：

- 不返回 raw API key。
- 不返回 bearer token。
- 不返回 `launchToken` 或 `runtimeToken`。
- 不返回 `objectKey`、`storageKey`、`localPath`、`signedUrl` 或 `presignedUrl`。
- 不把 OPL private state 透传给 Portal。

### Runtime Bridge Capability Registry

Runtime Bridge 必须暴露 capability registry，并在 bootstrap/status 中返回：

```json
{
  "runtimeBridgeContractVersion": "v22.portal-opl-context-backflow.v1",
  "upstreamProfile": "webui_bridge",
  "capabilities": {
    "contextBootstrap": { "status": "supported", "source": "gateway_runtime_bridge" },
    "session": { "status": "supported", "source": "webui_bridge" },
    "messageBackflow": { "status": "capability_not_supported", "source": "webui_bridge", "reason": "reply_not_verified" },
    "fileIntent": { "status": "requires_downstream_runtime_boundary", "source": "portal_workspace_file_store" },
    "runIntent": { "status": "requires_runtime_agent", "source": "runtime_bridge" },
    "langfuseSessionTrace": { "status": "deferred_authorization", "source": "trace.medopl.cn" }
  },
  "supportedEvents": [
    "context_bootstrapped",
    "session_bound",
    "message_created",
    "message_reply_observed",
    "downstream_runtime_gate_evaluated",
    "session_trace_metadata_projected"
  ]
}
```

capability 状态允许：

- `supported`
- `mapped_to_webui_bridge`
- `mapped_to_acp_runtime`
- `requires_downstream_runtime_boundary`
- `requires_runtime_agent`
- `deferred_authorization`
- `capability_not_supported`
- `provider_key_required`
- `managed_environment_required`
- `platform_isolated_runtime_agent_required`

Runtime Bridge 必须按能力独立失败。message 不支持不能影响 session bind；run intent 缺 Runtime Agent 不能让 bootstrap 失败；Langfuse 未部署不能让 Portal-OPL context/backflow 失败；upstream route 变化只能影响对应 capability mapping。

### Runtime Bridge Session Binding

Session binding 把 upstream OPL session 归一化到 MedOPL runtime session：

输入：

- `oplSessionId`
- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `resourceBindingId`
- `providerKeyRef`
- capability hints

允许 upstream 边界：

- WebUI WebSocket bridge `create-conversation`
- WebUI database readback through bridge event
- ACP/CLI public runtime session command
- future real HTTP Product API

输出：

- normalized `oplSessionId`
- `opl_session_bound` event
- session capability snapshot
- launch/bootstrap projection

验收：

- conversation/session 必须来自真实 upstream 或公开 runtime 边界。
- Runtime Bridge state 必须写入 `portalUserId + tenantId + workspaceId + workspaceSessionId + runtimeSessionId + resourceBindingId + oplSessionId`。
- 没有 workspace 或 runtime session 时返回稳定 gate error。

### Runtime Bridge Message Relay

Message Relay 在本合同里只负责 Portal-OPL message backflow：把 OPL message intent 送入真实 OPL/agent/provider 边界，并把明确 message 状态回流写入 Runtime Bridge state。

输入：

- `workspaceId`
- `runtimeSessionId`
- `oplSessionId`
- `clientMessageId`
- sanitized message metadata
- `providerKeyRef`

允许 upstream 边界：

- WebUI WebSocket bridge
- ACP/CLI public command
- future real HTTP Product API

输出：

- `messageId`
- `status`: `accepted`、`running`、`completed`、`failed`、`capability_not_supported`
- reply metadata when verified
- optional `traceId`
- sanitized usage summary when available

禁止：

- 不保存 raw prompt 到公开 trace。
- 不从任意 DB message 猜 reply。
- 不把 HTTP 200 当 reply 成功。
- 不暴露 raw provider key、bearer token、`launchToken` 或 `runtimeToken`。

验收：

- `POST /runtime-bridge/api/opl/messages` 后，真实 OPL/agent/provider 边界被访问，或明确返回 gate error。
- `GET /runtime-bridge/api/opl/messages/{messageId}/status` 读取同一 message 的 state。
- `completed` 必须有明确 reply event、reply payload 或同 conversation 的可验证 assistant reply 回流。
- 无 provider、无 reply event 或超时时返回 `provider_key_required`、`capability_not_supported` 或 `upstream_reply_timeout`。

### Runtime Bridge Backflow Projection

Runtime Bridge Backflow Projection 负责把 OPL 事件归一成 Portal 可读状态：

- `context_bootstrapped`
- `opl_session_created`
- `opl_session_bound`
- `message_created`
- `message_reply_observed`
- `capability_not_supported`
- `downstream_runtime_gate_evaluated`
- `session_trace_metadata_projected`

Projection 必须绑定：

- `portalUserId`
- `tenantId`
- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `resourceBindingId`
- `oplSessionId`
- `providerKeyRef`

Projection 禁止包含：

- raw prompt
- raw completion
- raw API key
- bearer token
- `launchToken`
- `runtimeToken`
- `objectKey`
- `storageKey`
- `localPath`
- `signedUrl`
- `presignedUrl`

### Downstream Runtime Boundary

Runtime 源是需要管理的下游边界，但不是本合同的当前实现主体。

OPL 产生 run/file intent 时，Runtime Bridge 可以归一化 intent，但真实 run、artifact、ledger、trace 和 billing metadata 必须进入 Runtime Bridge / Runtime Agent。Runtime Bridge / Runtime Agent is the downstream canonical source。

本合同要求：

- Runtime Bridge 不能直接生成伪 run 成功。
- Runtime Bridge 不能直接生成伪 artifact 成功。
- 没有 Runtime Agent identity/endpoint 时返回 `platform_isolated_runtime_agent_required`。
- 未绑定 provider key 时返回 `provider_key_required`。
- 未开通 runtime/resource binding 时返回 `managed_environment_required`。
- This contract does not implement cloud runtime。

真实云 runtime、真实 Runtime Agent endpoint、真实计算/存储资源、真实部署和真实云 API 调用必须另开授权分支。

### Downstream Langfuse Session Trace Boundary

Langfuse 的 session/trace 字段规范归入本 Portal-OPL 链路管理，但 Langfuse 基础设施部署不属于本合同当前实现。

`trace.medopl.cn` 是后续 Langfuse admin/ops console 目标域。客户默认 trace 页面仍在 Portal 会话轨迹。

Langfuse 可以接收清洗后的：

- `traceId`
- `sessionId`
- `oplSessionId`
- `workspaceSessionId`
- `runId`
- `messageId`
- `status`
- `latencyMs`
- usage summary
- cost estimate
- tags
- strict-origin-validated trace URL

Langfuse 不能用于：

- message 成功的唯一依据。
- run 成功的唯一依据。
- artifact 真相源。
- billing 真相源。
- raw prompt、raw completion、raw key 或 token 存储点。

This contract does not deploy Langfuse。`trace.medopl.cn` 的真实部署、Ingress/TLS、LB、DNS、Langfuse secret、ClickHouse、真实 API key 和真实 trace source 需要后续单独授权。

### Error Gates And No-Fake-Success

所有 API 必须用稳定 gate error 表达缺失条件：

- `workspace_required`
- `provider_key_required`
- `managed_environment_required`
- `platform_isolated_runtime_agent_required`
- `capability_not_supported`
- `upstream_reply_timeout`
- `upstream_capability_incompatible`
- `runtime_bridge_state_conflict`

禁止用以下方式掩盖未闭环能力：

- HTTP 200/201/202 但没有真实访问证据。
- 本地生成 reply 冒充 OPL/agent/provider reply。
- 本地生成 run/artifact 冒充 Runtime Agent output。
- 从任意 DB message 猜 assistant reply。
- 从 Langfuse trace 反推业务成功。
- 用默认 workspace、默认 provider、默认 runtime、隐式 resource binding 兜底。

### Performance Canary

性能验收必须比较三类链路：

- direct OPL WebUI baseline。
- Gateway + Runtime Bridge。
- Gateway + Runtime Bridge + downstream runtime gate。

必须记录：

- Portal launch -> OPL bootstrap p50/p95。
- session create 到 DB readback p50/p95。
- OPL event -> Runtime Bridge projection -> Portal query p50/p95。
- Runtime Bridge state write p50/p95。
- Gateway proxy overhead p50/p95。
- WebSocket bridge reconnect/error overhead。

初始目标：

- session class extra p95 target <= 300ms。
- Portal-OPL context/backflow extra overhead target <= 5% for non-runtime operations。
- Gateway/Runtime Bridge 错误率不得高于 direct OPL WebUI baseline。

这些目标是后续 canary 验收预算，不代表当前已实测完成。

## Absorption Gate

B 窗口吸收实现分支前必须确认：

1. 合同订阅包完整，且本合同被识别为 Level 3 执行合同。
2. one-person-lab upstream remains clean。
3. Portal、Gateway、Runtime Bridge、downstream Runtime boundary 和 downstream Langfuse boundary 的职责没有互相污染。
4. capability registry 能表达每个 API 的真实支持状态。
5. Portal launch、OPL context bootstrap、session bind、message backflow 和 Portal projection 有真实访问和真实回流证据，或明确 gate error。
6. Runtime 只作为下游 canonical boundary；没有授权时不实现云 runtime，不伪造 run/artifact。
7. Langfuse 只作为 `trace.medopl.cn` session trace attachment；没有授权时不部署、不读 secret、不接真实 Langfuse。
8. raw prompt、raw completion、raw API key、bearer token、`launchToken`、`runtimeToken`、`objectKey`、`storageKey`、`localPath`、`signedUrl`、`presignedUrl` 未进入 public response、browser state、log、evidence 或 git。
9. 完整链路按 [portal-opl-context-backflow-validation-path.md](../history/README.md) 验证。

## Non-goals

- 不修改 one-person-lab upstream。
- 不 import upstream 内部模块。
- 不往 upstream 目录写 Portal、Gateway、Runtime Bridge 或 Runtime Agent 代码。
- 不实现真实云 runtime。
- 不部署 Langfuse 或 `trace.medopl.cn`。
- 不接真实云资源开通。
- 不读取 secret、kubeconfig、SecretId、SecretKey、SSH private key 或 `.env`。
- 不调用真实腾讯云、COS、Langfuse 或外部生产 API。
- 不运行 build/push/kubectl/live-test。
- 不修改 deploy、`.sentrux` 或 `adapters`。
- 不恢复 `user_owned`、旧 resource-order、旧 runner/provisioner、OpenCost 或 Langfuse 主叙事。

## Smoke

本合同由以下 smoke 固化：

```text
node tests/smoke/smoke-test-v22-portal-opl-connection-contract.mjs
```

### spec:v22-portal-structure-failure-isolation-boundary

Former leaf id: `v22-portal-structure-failure-isolation-boundary`
Former title: v22 Portal Structure / Failure Isolation Boundary

这是 Portal 结构治理 / failure isolation 三级合同，不实现 UI，不改业务代码。

本合同只定义 Portal 线内部的工程边界：后端 route/dispatcher、payload/DTO builder、frontend view/composable、frontend API module 和 Portal smoke 应如何分层。它不定义新的产品主叙事，不替代普通用户、管理员/运维、files/billing/trace 等既有 surface 合同。

## 合同层级

本合同是 `tier_3_structure_governance`：

- 一级主合同仍是 `spec:v22-mvp-managed-opl-loop` 和 `spec:v22-saas-portal-opl-ops-surface-boundary`。
- 二级 Portal surface 合同仍是 `spec:v22-portal-user-surface-boundary`、`spec:v22-portal-admin-ops-surface-boundary` 和 `spec:v22-portal-files-billing-trace-boundary`。
- 本合同只把这些 Portal 产品边界落成代码治理边界和 failure isolation 验收口径。

本合同 scope 是 `portal_only`。接云和接 OPL 是外部能力边界，不在本合同中实现。

## 分支意图与模型记录

本合同分支意图：

- 新增 Portal 三级结构治理合同。
- 新增只读 contract smoke。
- 更新合同索引。
- 不修改 Portal 业务代码。

模型记录：`gpt-5.4`。

## 订阅合同包

本合同订阅：

- `docs/specs/README.md`
- `docs/specs/README.md`
- `docs/specs/README.md`
- `docs/specs/README.md`
- `docs/specs/README.md`
- `docs/active/README.md`
- `docs/active/README.md`

## Portal 后端 route / dispatcher 边界

Portal 后端应按 surface/domain 拆 route/dispatcher 边界：

- user
- admin
- ops
- billing
- workspace
- packages
- resources
- trace

route handler 只承担：

- auth
- role
- request parsing
- service/store call
- DTO response

Portal route handler 不承担：

- cloud create/release implementation
- OPL runtime implementation
- secret reading
- raw provider key handling

真实云资源创建/释放、真实扣费、真实 OPL runtime 执行都必须留在接云或接 OPL 合同和授权边界内。Portal 可以展示已清洗 projection、状态、计划、审计、错误态和空态，但不能把外部实现揉进 Portal。

## Backend implementation eval template

未来任何 Portal 后端实现 leaf 都必须先订阅本模板，并在自己的分支内补充 route smoke、payload/domain contract smoke、`npm --prefix services/portal run check` 或同等 Node 22 ESM 语法检查，以及 workflow gate。

模板固定的后端路径是：

- route
- app payload
- domain
- state/persistence

route 层只能处理 auth、role、request parsing、service/store call 和 DTO response，不得直接 import state/persistence 作为业务快捷路径。app payload / DTO builder 只能组合、裁剪和格式化已传入数据，不得做 IO、读 secret、调用外部服务或 role authorization。domain 层不得恢复 `user_owned` primary path、`resource-order` primary path、OpenCost 主路径或 Langfuse 主路径。state/persistence 层不得生成用户产品文案、route response、云控制台语言，且不得执行缺少 step-local auth record 的真实云/live 操作。

缺字段必须合同化 fail-closed 或显式错误态；不得用 implicit default、silent fallback 或 shim/adapter compatibility 让 smoke 伪通过。

## Payload / DTO builder 边界

Portal payload / DTO builder 应按 payload 家族拆分：

- overview
- users
- groups
- billing
- system
- ops
- audit
- packages
- workspace
- resources

builder 必须是纯 builder：只组合、裁剪和格式化已传入的数据，不做 IO，不读取 secret，不调用外部服务，不做 role authorization。

单个 builder 或单个 domain payload 出错时，失败必须尽量局部化。套餐 payload 的失败不能拖垮 Portal shell；admin payload 的失败不能拖垮普通用户 surface；单个 domain 的失败不能变成整个 web 崩溃。

## Frontend view / adapter 边界

Portal frontend page 应保留：

- template
- local wiring

以下逻辑应进入 Portal API adapter：

- query state
- loader
- formatter
- action handler

普通用户、admin 和 ops 页面不得共享会造成角色数据泄漏的状态。普通用户页面不能因为 admin/ops API、全局数据或运营 payload 失败而白屏。

## Frontend API module 边界

Portal frontend API module 是前端到后端合同的映射层，不承载业务决策。

页面默认不得依赖大型 `@/api/portal` barrel 聚合所有 Portal API。页面应按域直引：

- billing
- packages
- workspace
- resources
- trace
- admin/users
- admin/system
- ops

barrel 可以作为兼容入口存在，但不应成为页面默认引入方式，也不能让无关 domain 被同一聚合节点绑定。

## Portal smoke 分层

Portal 线 smoke 应分层：

- portal contract smoke
- portal role-boundary smoke
- portal payload/failure-isolation smoke
- portal browser smoke

这些 smoke 默认不读 secret、不调用真实云、不运行 live-test。需要真实外部系统、secret、build/push、kubectl、live-test 或真实云操作时，必须另开分支并单独授权。

## Failure isolation 要求

Portal 必须按低耦合目标治理：

- package surface failure must not crash Portal shell
- admin payload failure must not crash user surface
- single domain failure must remain local
- Portal shell must render auth and error states

本合同不要求用临时兜底、启发式补救或伪通过掩盖真实缺参。错误态和空态必须是合同化状态，而不是吞异常。

## 授权边界

本合同不允许：

- 调用真实云。
- 读取 secret。
- 修改 OPL Gateway。
- 修改 Runtime Bridge。
- 修改 deploy。
- 修改 one-person-lab upstream。
- 修改 `.sentrux`。
- 修改 `adapters`。
- build/push。
- kubectl。
- live-test。

禁止泄漏或进入 frontend 持久化、日志、evidence、git 的敏感数据包括：

- SecretId
- SecretKey
- token
- raw API Key
- bearer token
- launchToken
- runtimeToken
- kubeconfig
- objectKey
- storageKey
- localPath
- signedUrl

## Contract Data

<!-- v22-portal-structure-failure-isolation-contract:start -->
```json
{
  "contract": "v22_portal_structure_failure_isolation_boundary",
  "version": 1,
  "level": "tier_3_structure_governance",
  "scope": "portal_only",
  "model": "gpt-5.4",
  "definesProductNarrative": false,
  "replacesRoleSurfaceContracts": false,
  "callsRealCloud": false,
  "readsSecrets": false,
  "modifiesOplGateway": false,
  "modifiesRuntimeBridge": false,
  "modifiesDeploy": false,
  "modifiesUpstream": false,
  "requiredSurfaces": [
    "backend_routes_dispatcher",
    "backend_implementation_eval_template",
    "payload_dto_builders",
    "frontend_views_composables",
    "frontend_api_modules",
    "portal_smoke_layers"
  ],
  "backendRoutesDispatcher": {
    "routeGroups": [
      "user",
      "admin",
      "ops",
      "billing",
      "workspace",
      "packages",
      "resources",
      "trace"
    ],
    "handlerResponsibilities": [
      "auth",
      "role",
      "request_parsing",
      "service_or_store_call",
      "dto_response"
    ],
    "forbiddenResponsibilities": [
      "cloud_create_release_implementation",
      "opl_runtime_implementation",
      "secret_reading",
      "raw_provider_key_handling"
    ]
  },
  "backendImplementationEvalTemplate": {
    "templateKind": "backend_implementation_gate",
    "runtime": "node_22_esm",
    "requiredForFutureBackendChanges": true,
    "layerFlow": [
      "route",
      "app_payload",
      "domain",
      "state_persistence"
    ],
    "requiredVerificationCommands": [
      "node tests/regression/portal/regression-test-v22-portal-structure-failure-isolation-contract.mjs",
      "npm --prefix services/portal run check",
      "node tests/contract/contract-test-v22-product-engineering-loop-index.mjs",
      "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk"
    ],
    "routeLayer": {
      "allowedResponsibilities": [
        "auth",
        "role",
        "request_parsing",
        "service_or_store_call",
        "dto_response"
      ],
      "forbiddenDirectImports": [
      ],
      "forbiddenMissingFieldBehaviors": [
        "implicit_default",
        "silent_fallback",
        "shim_adapter_compatibility"
      ]
    },
    "appPayloadLayer": {
      "allowedResponsibilities": [
        "compose_passed_data",
        "trim_fields",
        "format_dto"
      ],
      "forbiddenEffects": [
        "io",
        "secret_reading",
        "external_service_call",
        "role_authorization"
      ],
      "missingFieldPolicy": "fail_closed_or_explicit_error_state"
    },
    "domainLayer": {
      "allowedResponsibilities": [
        "business_rules",
        "contract_field_validation",
        "state_adapter_call"
      ],
      "forbiddenPrimaryPaths": [
        "user_owned_primary_path",
        "resource_order_primary_path",
        "opencost_main_path",
        "langfuse_main_path"
      ]
    },
    "statePersistenceLayer": {
      "allowedResponsibilities": [
        "state_read",
        "state_write",
        "migration_only_legacy_record"
      ],
      "forbiddenResponsibilities": [
        "route_response_building",
        "user_facing_product_copy",
        "cloud_console_language",
        "live_cloud_call_without_auth_record"
      ]
    }
  },
  "payloadDtoBuilders": {
    "builderFamilies": [
      "overview",
      "users",
      "groups",
      "billing",
      "system",
      "ops",
      "audit",
      "packages",
      "workspace",
      "resources"
    ],
    "pureBuildersOnly": true,
    "forbiddenBuilderEffects": [
      "io",
      "secret_reading",
      "external_service_call",
      "role_authorization"
    ]
  },
  "frontendViewsComposables": {
    "viewResponsibilities": [
      "template",
      "local_wiring"
    ],
    "composableResponsibilities": [
      "query_state",
      "loader",
      "formatter",
      "action_handler"
    ],
    "roleStateLeakageAllowed": false
  },
  "frontendApiModules": {
    "usesLargePortalBarrelAsPageDefault": false,
    "domainModules": [
      "billing",
      "packages",
      "workspace",
      "resources",
      "trace",
      "admin/users",
      "admin/system",
      "ops"
    ],
    "carriesBusinessDecisions": false
  },
  "portalSmokeLayers": {
    "layers": [
      "portal_contract_smoke",
      "portal_role_boundary_smoke",
      "portal_payload_failure_isolation_smoke",
      "portal_browser_smoke"
    ],
    "callsRealCloud": false,
    "readsSecrets": false,
    "liveTestAllowedByDefault": false
  },
  "failureIsolation": {
    "packageSurfaceFailureMustNotCrashPortalShell": true,
    "adminPayloadFailureMustNotCrashUserSurface": true,
    "singleDomainFailureMustRemainLocal": true,
    "portalShellMustRenderAuthAndErrorStates": true
  },
  "forbiddenPaths": [
    "deploy",
    ".sentrux",
    "adapters",
    "one-person-lab upstream"
  ],
  "forbiddenSensitiveData": [
    "SecretId",
    "SecretKey",
    "token",
    "raw API Key",
    "bearer token",
    "launchToken",
    "runtimeToken",
    "kubeconfig",
    "objectKey",
    "storageKey",
    "localPath",
    "signedUrl"
  ],
  "subscribedContracts": [
    "docs/specs/README.md",
    "docs/specs/README.md",
    "docs/specs/README.md",
    "docs/specs/README.md",
    "docs/specs/README.md",
    "docs/active/README.md",
    "docs/active/README.md"
  ],
  "currentPortalCodeShape": {
    "characterizationOnly": true,
    "modifiesPortalBusinessCode": false,
    "runsLiveTest": false,
    "readsSecrets": false,
    "backendRoutesDispatcher": {
      "dispatcherFile": "services/medopl-go-backend/internal/server/router.go",
      "dispatcherMustReference": [
        "createPortalApiV22CloudOperationsRoutes",
        "createPlatformProvisionedResourceRoutes"
      ],
      "currentRouteFiles": [
      ]
    },
    "backendAppPayloadBuilders": {
      "payloadEntryFile": "services/medopl-go-backend/internal/server/handlers/portal_projection.go",
      "payloadEntryMustReference": [
        "createBillingPayloadBuilders",
        "createOverviewPayloadBuilder",
        "createWorkspacePayloadBuilder"
      ],
      "currentAppPayloadFiles": [
      ]
    },
    "backendDomainModules": {
      "currentDomainFiles": [
      ]
    },
    "backendStatePersistence": {
      "currentStateFiles": [
      ]
    },
    "frontendViewsComposables": {
      "currentViewFiles": [
        "services/portal/frontend/src/app/pages/Overview.tsx",
        "services/portal/frontend/src/app/pages/RuntimeEnvironment.tsx",
        "services/portal/frontend/src/app/pages/Workspace.tsx",
        "services/portal/frontend/src/app/pages/BillingAudit.tsx",
        "services/portal/frontend/src/app/pages/TasksResults.tsx",
        "services/portal/frontend/src/app/pages/OPLEntry.tsx"
      ],
      "currentComposableFiles": [
        "services/portal/frontend/src/app/data/portal*Model.ts",
        "services/portal/frontend/src/app/data/portalQuery.ts",
        "services/portal/frontend/src/app/components/ui/utils.ts"
      ],
      "coreViewComposableImports": [
        {
          "viewFile": "services/portal/frontend/src/app/pages/Overview.tsx",
          "composableImport": "usePortalQuery"
        },
        {
          "viewFile": "services/portal/frontend/src/app/pages/RuntimeEnvironment.tsx",
          "composableImport": "usePortalQuery"
        },
        {
          "viewFile": "services/portal/frontend/src/app/pages/Workspace.tsx",
          "composableImport": "usePortalQuery"
        },
        {
          "viewFile": "services/portal/frontend/src/app/pages/BillingAudit.tsx",
          "composableImport": "usePortalQuery"
        },
        {
          "viewFile": "services/portal/frontend/src/app/pages/TasksResults.tsx",
          "composableImport": "usePortalQuery"
        },
        {
          "viewFile": "services/portal/frontend/src/app/pages/OPLEntry.tsx",
          "composableImport": "usePortalQuery"
        }
      ]
    },
    "frontendApiModules": {
      "currentApiModuleFiles": [
        "services/portal/frontend/src/api/client.ts",
        "services/portal/frontend/src/api/portal.ts",
        "services/portal/frontend/src/api/portal/overview.ts",
        "services/portal/frontend/src/api/portal/resources.ts",
        "services/portal/frontend/src/api/portal/workspace.ts",
        "services/portal/frontend/src/api/portal/billing.ts",
        "services/portal/frontend/src/api/portal/traces.ts",
        "services/portal/frontend/src/api/portal/admin.ts",
        "services/portal/frontend/src/api/portal/opl.ts",
        "services/portal/frontend/src/api/portal/common.ts",
        "services/portal/frontend/src/api/portal/commercial.ts",
        "services/portal/frontend/src/api/portal/lab.ts",
        "services/portal/frontend/src/api/portal/public.ts",
        "services/portal/frontend/src/api/portal/server-plans.ts",
        "services/portal/frontend/src/api/portal/sessions.ts",
        "services/portal/frontend/src/api/portal/types.ts"
      ]
    },
    "portalSmokeLayers": {
      "currentSmokeFiles": [
        "tests/regression/portal/regression-test-v22-portal-structure-failure-isolation-contract.mjs",
        "tests/regression/portal/regression-test-v22-portal-role-surface-boundaries.mjs",
        "tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs",
        "tests/regression/portal/regression-test-v22-portal-web-route-alignment.mjs",
        "tests/regression/portal/regression-test-v22-portal-ui-design-quality-audit.mjs",
        "tests/regression/portal/regression-test-v22-portal-runtime-suite.mjs"
      ]
    },
    "knownFutureRefactorRisks": [
      "portal_runtime_composition_root_is_large",
      "route_to_state_direct_import_exists",
      "domain_contains_payload_and_provider_bridge_modules",
      "app_layer_mixes_orchestration_and_view_model_payloads",
      "frontend_api_barrel_exists_but_not_page_default",
      "admin_ops_frontend_is_future_same_stack_leaf",
      "retired_resource_order_schema_store_physically_deleted",
      "retired_user_owned_public_route_deleted",
      "old_vue_visual_workbench_removed_from_current_gate"
    ]
  }
}
```
<!-- v22-portal-structure-failure-isolation-contract:end -->

## Non-goals

- 不实现新 UI。
- 不改 Portal 业务代码。
- 不改 OPL Gateway。
- 不改 Runtime Bridge。
- 不读取 secret。
- 不调用真实云。
- 不创建、绑定、释放或修改真实资源。
- 不真实扣费。
- 不改 deploy / .sentrux / adapters / upstream。
- 不运行 build/push/kubectl/live-test。

### spec:v22-portal-ui-design-quality-audit-boundary

Former leaf id: `v22-portal-ui-design-quality-audit-boundary`
Former title: v22 Portal UI Design Quality Audit Boundary

本合同只定义边界和评价标准，不规定具体审美解法。它用于回答：Portal 是否真的把 MedOPL 的主线表达成一个现代 SaaS 工作台，而不是只证明 route、DOM anchor、fixture 和截图存在。

本合同不实现 UI，不修改 `services/*`，不读取 secret，不调用真实云，不修改 upstream，不运行 build/push/kubectl/live-test。后续真正改 Portal UI 时，必须另开实现 leaf，并订阅本合同、`spec:v22-saas-control-plane-user-experience-boundary` 和 `spec:v22-portal-workbench-management-ui-composition-boundary`。

模型记录：`gpt-5.4`。

## 审计目的

Portal 是 OPL 的 SaaS 控制面。UI design quality audit 要审计 Portal 是否让用户在进入后快速理解：

- 我买的是什么服务？
- 我的 OPL 工作台现在能不能用？
- 如果不能用，还缺哪一步？
- 下一步应该点哪里？
- 我的文件、任务、结果在哪里？
- 我的余额、预扣费、冻结金额、停止计费状态是否正常？
- 我什么时候应该释放计算资源但保留文件空间？

这些问题来自主线合同。审计不得把 Portal 评成科研聊天界面，不得重做 OPL chatbot，不得把 Portal 做成云资源控制台。用户购买的是托管 OPL 科研工作台服务，不是 CVM、COS、TKE、节点池或 K8s 控制台权限。

## Rubric 分层

硬约束用于阻断污染和基础可用性退化。任何硬约束失败，都不能只靠视觉分数或截图基准通过：

- 主线问题必须可从页面信息架构、状态、空态、操作区和账单摘要中得到回答。
- Portal / OPL 职责必须清晰：Portal 负责准备、管理、进入、回流、计费、审计和释放；OPL 负责科研执行、chatbot、agent、文件理解和结果生成。
- 普通用户页面不得恢复云资源控制台语言。
- 不得重做 OPL chatbot。
- 普通用户、管理员和运维 surface 不能越权串台。
- raw API key、token、launchToken、runtimeToken、objectKey、localPath、signedUrl 不进入浏览器持久化状态、日志、evidence 或 git。
- 关键页面在桌面和移动视口不能横向溢出，关键文本不能互相遮挡。
- ready、empty、loading、error、disabled、pending、success 和 failure 状态必须有可审计覆盖。
- 审计报告只写 `.runtime/portal-ui-design-quality/report.json`，不进 git。

软评分用于形成审计报告，不直接锁定某一种视觉实现：

- 现代 SaaS 工作台的信息层级是否清楚。
- 工作台是否适合扫描、比较和重复操作。
- 用户是否能明确感知自己购买的是托管 OPL 科研工作台服务。
- 下一步动作是否稳定、具体、可点击。
- 页面气质是否像科研工作台，而不是营销页、云控制台或散装资源面板。
- 信息密度、留白、表格、卡片、列表、状态标签和操作区是否平衡。
- 中文文案是否直接、可信、面向 AI 小白科研用户。

软评分只能指导后续 UI 实现 leaf，不得写死布局、颜色、字体、动效、组件库或组件形态。合同审计只回答边界和质量标准，具体审美解法留给 UI 实现阶段。

## 外部 UI/UX 参考边界

允许在审计报告和后续 UI implementation leaf 中参考外部 UI/UX best practices、web design guidelines、frontend development guidelines 或 UI UX Pro 类设计经验，但只能作为表达质量参考：信息层级、可扫描性、留白密度、状态表达、操作区清晰度、响应式无溢出、文案可信度和现代 SaaS 工作台质感。

内容语义必须由 v22 合同固定。外部设计参考不得改变用户购买的服务、Portal/OPL 职责、账单/冻结/释放/文件/任务/结果状态、角色可见边界、secret/browser hygiene、no-cloud-console language、OPL chatbot 边界或 Cloud lane 授权边界。`vercel-react-best-practices` 一类资料可以贡献通用前端质量原则，但不得把本 audit leaf 本身变成 UI implementation leaf。Portal 前端技术栈迁移的授权只来自 `spec:v22-portal-figma-make-ui-implementation-boundary`，并被限制在 Portal frontend、Figma Make 吸收、本地验证和本地可预览部署边界内。

## 与现有 UI 合同关系

本合同不替代 UI composition 合同。分工如下：

- `spec:v22-saas-control-plane-user-experience-boundary` 定义用户体验主线问题。
- `spec:v22-portal-workbench-management-ui-composition-boundary` 定义 UI 分层、Figma Make ZIP surface gate 和统一验证入口。
- 本合同定义 design quality audit 的评价标准、报告形态和 runtime evidence 边界。
- `DESIGN.md` 是 Portal UI 重构的设计执行源，用于把合同和 Figma Make implementation leaf 转成产品气质、信息架构、组件、文案、视觉和 Figma Make ZIP 吸收规则；它不替代本合同、UI composition 合同、Figma Make ZIP source-of-truth 或 smoke，也不授权修改后端、真实云、deploy、upstream 或 secret 边界。

旧截图回归只能证明“和 baseline 一致”，不能证明 baseline 本身足够好；它已不再是当前 Portal UI completion evidence。当前实现 leaf 以 React route/surface eval、typecheck、build 和本地预览作为完成证据；如果后续重新引入截图回归，必须先有 `.runtime/portal-ui-design-quality/report.json` 审计证据说明哪些硬约束仍通过、哪些软评分改善，以及为什么这是有意改版而不是偶然漂移。

## 审计证据和后续 handoff

本 leaf 产出的审计证据只证明合同、rubric、报告 schema 和后续 implementation handoff 已被定义并可被 gate 检查；当前 implementation leaf 的执行证据由 React route/surface eval、typecheck、build 和本地预览承接。运行时报告路径固定为 `.runtime/portal-ui-design-quality/report.json`，报告不进 git。

审计报告必须覆盖七个主线问题、全部硬约束、全部软评分轴、surface/typecheck/build 证据来源、表达质量发现、产品语义边界检查和后续 UI implementation leaf handoff。

后续 UI implementation leaf handoff 必须作为独立 leaf 处理。它可以在单独授权和 manifest allowlist 下修改 `services/portal/frontend/**` 以及 Portal frontend package/lockfile，但不得默认开放 Portal 后端、非 Portal frontend 依赖、deploy、adapters、`.sentrux`、upstream、secret 或真实云路径。它必须继续订阅本合同、UI composition 合同和 SaaS control-plane UX 合同，并把实现验证与 truth writeback 明确写入下一 leaf。

## Implementation Truth Writeback

`leaf-portal-figma-make-react-ui-implementation` 在当前分支执行本 handoff，范围保持在 Portal frontend、Portal frontend package/lockfile、当前 design-quality gate 和订阅 truth writeback 文档内。Portal 全体前端技术栈由 implementation leaf 固定为 React + Vite + TypeScript + shadcn/Radix + lucide，覆盖普通用户 Portal 和后续 Admin / Ops Portal；当前完成的 UI surface：

- `overview`: 说明托管 OPL 科研工作台服务、工作台可用性、下一步动作、运行环境、文件任务结果和账单摘要。
- `resources`: 说明托管运行环境、文件空间、释放计算资源和删除存储资源的 7 天保护期。
- `workspace`: 展示文件空间、任务、输出结果和托管环境计划。
- `trace`: 展示任务运行轨迹、输出回流和费用关联，不暴露外部 trace 直链。
- `billing`: 展示余额、冻结金额、运行费用和账本审计。
- `opl-launch`: 展示 OPL 启动阶段，不暴露 providerKeyRef、runtime token 或 raw key。
- `services/portal/frontend/src/app/**` 已按 Figma Make ZIP 复制为 React user Portal route 和 surface source；`services/portal/frontend/src/app/data/portal*Model.ts` 与 `services/portal/frontend/src/app/data/portalQuery.ts` 已接现有 `/api/*`。

仍不属于本 leaf 的后续事项：Portal backend services、Node 22 ESM layering、billing preauth/ledger/release T+1 后端闭环、真实云、release readiness、deploy、build/push/kubectl、live-test、secret-backed canary 和 upstream OPL 修改。B 吸收本分支后，cursor 是否推进到 `backend-product-node22-esm-layering` 必须继续由 `tests/fixtures/v22/goal-current.json`、gap matrix 和 B review 规则决定；本实现分支不提前声明全局 cursor 完成。

## 验收方式

本合同的合同级验收入口是：

```bash
node tests/regression/portal/regression-test-v22-portal-ui-design-quality-audit.mjs
```

Portal UI design quality audit 的现有执行证据由 Figma Make ZIP surface 组、React typecheck 和 build 承接：

```bash
node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs
npm --prefix services/portal/frontend run typecheck
npm --prefix services/portal/frontend run build
```

本合同 smoke 只读取 repo-tracked 文档和 manifest，不读取 secret，不调用真实云，不执行 build/push/kubectl/live-test，不修改 upstream。

## Contract Data

<!-- v22-portal-ui-design-quality-audit-contract:start -->
```json
{
  "contract": "v22_portal_ui_design_quality_audit_boundary",
  "version": 2,
  "model": "gpt-5.4",
  "contractRole": "boundary_and_rubric_only",
  "scope": {
    "implementsUi": false,
    "prescribesSpecificAestheticSolution": false,
    "callsRealCloud": false,
    "readsSecrets": false,
    "modifiesUpstream": false,
    "modifiesServices": false,
    "migratesFrontendStack": false
  },
  "referenceBoundaries": [
    "external_ui_ux_best_practices_reference_only",
    "content_semantics_fixed_by_v22_contracts",
    "frontend_stack_migration_authorized_only_by_figma_make_implementation_leaf",
    "portal_wide_react_vite_typescript_shadcn_radix_lucide_stack",
    "audit_leaf_does_not_implement_ui"
  ],
  "mainlineQuestions": [
    "我买的是什么服务？",
    "我的 OPL 工作台现在能不能用？",
    "如果不能用，还缺哪一步？",
    "下一步应该点哪里？",
    "我的文件、任务、结果在哪里？",
    "我的余额、预扣费、冻结金额、停止计费状态是否正常？",
    "我什么时候应该释放计算资源但保留文件空间？"
  ],
  "hardRubric": [
    "mainline_questions_answered",
    "portal_opl_responsibility_boundary",
    "no_cloud_console_language_for_normal_users",
    "no_opl_chatbot_reimplementation",
    "role_surface_boundary",
    "secret_browser_hygiene",
    "responsive_no_overflow",
    "state_coverage",
    "audit_report_runtime_only"
  ],
  "softRubric": [
    "modern_saas_information_hierarchy",
    "workbench_scanability",
    "service_clarity",
    "next_action_clarity",
    "research_workspace_feel",
    "visual_density_balance",
    "copy_tone_quality"
  ],
  "auditOutput": {
    "reportPath": ".runtime/portal-ui-design-quality/report.json",
    "committedToGit": false
  },
  "baselinePolicy": {
    "intentionalRedesignCanUpdateScreenshots": true,
    "requiresAuditEvidenceBeforeBaselineUpdate": true
  },
  "auditEvidenceSchema": {
    "reportPath": ".runtime/portal-ui-design-quality/report.json",
    "reportType": "portal_ui_design_quality_audit_evidence",
    "reportCommittedToGit": false,
    "requiredSections": [
      "mainlineQuestionAnswerability",
      "hardRubricVerdicts",
      "softRubricScores",
      "surfaceAndVisualEvidenceSources",
      "expressionQualityFindings",
      "productSemanticBoundaryCheck",
      "futureImplementationLeafHandoff"
    ],
    "requiredMainlineQuestionVerdicts": [
      "我买的是什么服务？",
      "我的 OPL 工作台现在能不能用？",
      "如果不能用，还缺哪一步？",
      "下一步应该点哪里？",
      "我的文件、任务、结果在哪里？",
      "我的余额、预扣费、冻结金额、停止计费状态是否正常？",
      "我什么时候应该释放计算资源但保留文件空间？"
    ],
    "requiredHardRubricVerdicts": [
      "mainline_questions_answered",
      "portal_opl_responsibility_boundary",
      "no_cloud_console_language_for_normal_users",
      "no_opl_chatbot_reimplementation",
      "role_surface_boundary",
      "secret_browser_hygiene",
      "responsive_no_overflow",
      "state_coverage",
      "audit_report_runtime_only"
    ],
    "requiredSoftRubricScores": [
      "modern_saas_information_hierarchy",
      "workbench_scanability",
      "service_clarity",
      "next_action_clarity",
      "research_workspace_feel",
      "visual_density_balance",
      "copy_tone_quality"
    ],
    "evidenceSources": [
      "node tests/regression/portal/regression-test-v22-portal-ui-design-quality-audit.mjs",
      "node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs",
      "npm --prefix services/portal/frontend run typecheck",
      "npm --prefix services/portal/frontend run build"
    ],
    "findingScope": "expression_quality_only_not_product_semantics",
    "baselineUpdateGate": {
      "requiresReportBeforeScreenshotBaselineUpdate": true,
      "reportPath": ".runtime/portal-ui-design-quality/report.json"
    }
  },
  "futureImplementationLeafHandoff": {
    "leafIntent": "portal_figma_make_react_ui_implementation",
    "allowedFiles": [
      "services/portal/frontend/**",
      "DESIGN.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "tests/fixtures/v22/goal-current.json",
      "docs/history/README.md",
      "docs/active/README.md",
      "tests/fixtures/v22/agent-verify-manifest.json",
      "docs/active/README.md",
      "tests/regression/portal/regression-test-v22-portal-ui-design-quality-audit.mjs",
      "tests/regression/portal/regression-test-v22-portal-figma-make-interaction-readiness.mjs",
      "tests/regression/portal/regression-test-v22-portal-runtime-suite.mjs",
      "services/portal/frontend/package.json",
      "services/portal/frontend/package-lock.json"
    ],
    "verificationCommands": [
      "node tests/regression/portal/regression-test-v22-portal-figma-make-interaction-readiness.mjs",
      "node tests/regression/portal/regression-test-v22-portal-ui-design-quality-audit.mjs",
      "node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs",
      "npm --prefix services/portal/frontend run typecheck",
      "npm --prefix services/portal/frontend run build",
      "node tests/health/health-check-v22-contract-conflict-boundary.mjs",
      "node tests/contract/contract-test-v22-current-state-index-loop.mjs",
      "node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs",
      "node tests/contract/contract-test-v22-product-engineering-loop-index.mjs",
      "git diff --check -- docs/specs docs tests scripts services/portal/frontend"
    ],
    "truthWritebackTarget": [
      "docs/specs/README.md",
      "docs/specs/README.md",
      "DESIGN.md",
      "docs/specs/README.md",
      "tests/fixtures/v22/goal-current.json",
      "docs/history/README.md",
      "docs/active/README.md",
      "docs/active/README.md"
    ],
    "stopConditions": [
      "requires_backend_services_change",
      "requires_non_portal_frontend_dependency_change",
      "requires_secret_or_live_cloud",
      "requires_deploy_build_push_kubectl_or_live_test",
      "changes_product_semantics_instead_of_expression_quality",
      "updates_screenshot_baseline_without_runtime_audit_report"
    ],
    "forbiddenAllowedFilePatterns": [
      "services/portal/**/backend_or_api_except_frontend",
      "non_portal_frontend_package_or_dependency_files",
      "deploy/*",
      "adapters/*",
      ".sentrux/*",
      "upstream/*",
      "secret-like paths",
      "true cloud runners"
    ],
    "forbiddenVerificationCommandPatterns": [
      "build/push/kubectl",
      "deploy",
      "live-test",
      "live-cloud",
      "secret-read",
      "dependency-upgrade"
    ]
  },
  "validationCommands": [
    "node tests/regression/portal/regression-test-v22-portal-ui-design-quality-audit.mjs",
    "node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs",
    "npm --prefix services/portal/frontend run typecheck",
    "npm --prefix services/portal/frontend run build"
  ]
}
```
<!-- v22-portal-ui-design-quality-audit-contract:end -->

### spec:v22-portal-user-surface-boundary

Former leaf id: `v22-portal-user-surface-boundary`
Former title: v22 Portal User Surface Boundary

这是 Portal 普通用户 role surface 合同，不实现新 UI。

本合同定义 MedOPL v22 Portal 普通用户页面边界。它不推翻既有 Portal UI MVP，也不是重新冻结 UI；`docs/active/README.md` 仍只是阶段快照，是否修改 UI 由当前分支意图和订阅合同决定。

## 定位

MedOPL 是同一个 Portal 应用、同一套登录、同一套 UI shell。普通用户 surface 和管理员/运维 surface 严格分离，管理员页面/API 独立分区。普通用户不能看到 admin/ops 入口、全局数据或管理操作。
普通用户不能看到全局数据。

本合同只整理普通用户 role-based surface 边界，不复制外部代码。借鉴 Sub2API 的 role-based Web app 模式：同一个 Web 产品内按角色拆分 surface，而不是拆成两个产品。

角色真相由 `spec:v22-portal-user-surface-boundary` 和 `spec:v22-portal-admin-ops-surface-boundary` 共同定义。`spec:v22-saas-portal-opl-ops-surface-boundary` 是更宽的 Portal、OPL 和管理台共享界面总述，不替代这两份 role surface 合同。

## 普通用户入口

普通用户入口包括：

- Portal 总览
- 工作空间
- 工作台资源/套餐
- 文件空间
- 运行轨迹
- 账单/余额/充值
- 进入 OPL 工作台

这些入口只面向用户自己的科研工作台闭环，不提供管理员/运维入口。

## 普通用户可见内容

普通用户可见：

- 自己的账号状态
- 自己的工作空间
- 自己的套餐、CPU/内存/文件空间、并发/队列
- 自己的任务、输出文件、运行轨迹
- 自己的费用估算、余额、充值状态
- gflabtoken 模型调用密钥绑定状态；Portal 普通登录不提供 raw API Key 输入

账号 / 工作空间 是 UI 主语言。租户 / 运行环境 不是 UI 主叙事；`tenantId`、`environmentId`、`resourceBindingId` 只能作为内部标签、对账标签或审计字段。

## 普通用户不可见内容

普通用户不可见：

- 管理员/运维入口
- 全局账号列表
- 其他账号/其他工作空间
- 全局运行任务
- 全局费用、冻结、T+1 对账
- 审计异常、释放失败、账单异常总览
- 公告管理
- CVM / COS / K8s / TKE / 节点池 / 服务器编号 / 云资源清单
- tenantId / resourceBindingId / cloudOperationId / billingAttributionId / accountId / retired resource-order identifiers / serverPlanId / runId 等后台归因标签
- tenantId / resourceBindingId / serverPlanId / runId / implementationKind / planId / cloud object id（bucket/prefix/object）等后台归因或排障原值
- SecretId / SecretKey / token / raw API Key / kubeconfig / objectKey / storageKey / cosPrefix / storageBackend / signedUrl

Portal 普通用户不能有运维视角，也不能通过旧入口、旧 API 暴露或权限绕过看到 admin/ops 数据。

## Cleanup / 防污染规则

repo-tracked contracts/docs/scripts/tests 是 truth。tmux session、agent 对话、本地状态、临时日志不进仓库。

并行写任务必须用独立 worktree。根工作区只用于规划、审查、吸收、push、清理。

one-person-lab 防污染边界继续生效：

- 不把 upstream 内部逻辑写进 Portal。
- 不 import upstream 内部模块。
- 不让历史 v19/v20/v21 路线不得重新成为 v22 主线。
- 旧入口、旧云控制台叙事、旧资源管理路线不得重新成为 v22 主线。

Cleanup 要清掉旧入口、旧文案、旧 API 暴露和权限绕过。清理动作必须有对应合同或 smoke 守住，不靠本地对话、tmux session 或临时日志作为真相。

## Contract Data

<!-- v22-portal-user-surface-contract:start -->
```json
{
  "contract": "v22_portal_user_surface_boundary",
  "version": 1,
  "samePortalApp": true,
  "sameLoginAndShell": true,
  "roleSurface": "user",
  "implementsUi": false,
  "portalProvidesRawApiKeyInput": false,
  "entryPoints": [
    "Portal 总览",
    "工作空间",
    "工作台资源/套餐",
    "文件空间",
    "运行轨迹",
    "账单/余额/充值",
    "进入 OPL 工作台"
  ],
  "visibleContent": [
    "自己的账号状态",
    "自己的工作空间",
    "自己的套餐",
    "CPU/内存/文件空间",
    "并发/队列",
    "自己的任务",
    "输出文件",
    "运行轨迹",
    "费用估算",
    "余额",
    "充值状态",
    "gflabtoken 模型调用密钥已绑定/未绑定状态"
  ],
  "invisibleContent": [
    "管理员/运维入口",
    "全局账号列表",
    "其他账号/其他工作空间",
    "全局运行任务",
    "全局费用、冻结、T+1 对账",
    "审计异常、释放失败、账单异常总览",
    "公告管理",
    "CVM",
    "COS",
    "K8s",
    "TKE",
    "节点池",
    "服务器编号",
    "云资源清单",
    "tenantId",
    "resourceBindingId",
    "cloudOperationId",
    "billingAttributionId",
    "accountId",
    "retired resource-order identifiers",
    "serverPlanId",
    "runId",
    "implementationKind",
    "planId",
    "cloud object id",
    "SecretId",
    "SecretKey",
    "token",
    "raw API Key",
    "kubeconfig",
    "objectKey",
    "storageKey",
    "cosPrefix",
    "storageBackend",
    "signedUrl"
  ],
  "uiPrimaryLanguage": [
    "账号",
    "工作空间"
  ],
  "notUiPrimaryNarrative": [
    "租户",
    "运行环境"
  ],
  "cleanupAndPollutionGuard": {
    "repoTrackedTruth": [
      "contracts",
      "docs",
      "scripts",
      "tests"
    ],
    "localStateNotTruth": [
      "tmux session",
      "agent 对话",
      "本地状态",
      "临时日志"
    ],
    "parallelWriteTasksUseIndependentWorktree": true,
    "rootWorkspaceUse": [
      "规划",
      "审查",
      "吸收",
      "push",
      "清理"
    ],
    "doNotWriteUpstreamInternalLogicIntoPortal": true,
    "legacyRoutesMustNotBecomeV22Mainline": [
      "旧入口",
      "旧云控制台叙事",
      "旧资源管理路线",
      "历史 v19/v20/v21 路线"
    ]
  }
}
```
<!-- v22-portal-user-surface-contract:end -->

## Non-goals

- 不实现新 UI。
- 不改 Portal 代码。
- 不读取 secret。
- 不调用真实云。
- 不改 deploy / .sentrux / adapters / upstream。
- 不运行 build/push/kubectl/live-test。

### spec:v22-portal-workbench-management-ui-composition-boundary

Former leaf id: `v22-portal-workbench-management-ui-composition-boundary`
Former title: v22 Portal Workbench Management UI Composition Boundary

本合同固定 Portal UI 的产品边界、分层规则、禁词、Figma Make ZIP surface gate 和统一验证入口。它不替代 role surface 合同和结构治理合同，也不继续承载每个页面、组件和 API shape 的细节。

本合同 v12 的核心变化是继续瘦身并收敛到当前 Figma Make ZIP 普通用户和管理员 Portal：页面结构和组件实现以 ZIP 源码为准，API shape 由 `src/app/data/portal*Model.ts`、`src/app/data/portalQuery.ts` 和 `src/api/portal/*` 承接，surface smoke 读取 ZIP 文件树、active routes、layout、data model/API wiring 和旧文件物理删除状态执行检查。历史 UI evidence 不再是当前完成证据；旧路径防回归统一由 retired frontend surface gate 承接。

`leaf-portal-figma-make-react-ui-implementation` 把当前普通用户和管理员 Portal 的可执行 UI truth 收敛到 Figma Make ZIP：6 个用户路由必须回答“用户买了什么托管科研工作台服务、当前能不能进入 OPL、环境套餐算力存储释放状态、文件任务结果在哪里以及下一步点哪里”；7 个管理员路由必须展示管理总览、用户管理、公告与待处理事项、账单处理、审计记录、站点设置和服务状态。对应 route、surface、页面结构和 primitive 由 `services/portal/frontend/src/app/**` 承接；API 接入由 per-surface `services/portal/frontend/src/app/data/portal*Model.ts`、`services/portal/frontend/src/app/data/portalQuery.ts` 和 `services/portal/frontend/src/api/portal/*` 承接。`/admin/users` 和 `/admin/alerts` 允许接入现有本地 Portal 管理动作；`/admin/ops` 是已挂载服务状态页面，但后端默认可返回 `404 ops_surface_disabled`；前端必须展示明确 disabled 产品态，不能渲染 generic error 或伪成功。

## 合同职责

本合同只负责：

- 产品边界：Portal 是工作台和管理台，不是云资源控制台。
- UI 分层规则：route entry、page shell、layout、ZIP page component、Portal data model、API module、ZIP surface smoke。
- 禁词和主叙事：工作台、管理台、账单、余额、冻结金额、累计消费、今日消费、计算资源、文件空间、任务执行、运行轨迹。
- Figma Make ZIP app root：`services/portal/frontend/src/app`。
- 统一验证入口：`node tests/contract/contract-test-v22-node-portal-backend-physical-removal.mjs`。
- ZIP surface gate 入口：`node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs`。

本合同不再负责：

- 逐条列出所有 surface 组件。
- 逐条列出所有 API response key。
- 逐条列出所有 DOM selector。
- 用长篇执行矩阵替代可执行测试。

上述细节必须进入 ZIP source、Portal API adapter 和 smoke。

## 设计参考和工程框架

Portal UI 的工程框架由本合同和 `spec:v22-portal-figma-make-ui-implementation-boundary` 分层固定：本合同继续负责 UI composition 和 smoke 入口；当前实现 leaf 授权 Portal 全体前端技术栈收敛为 React + Vite + TypeScript + react-router + shadcn/Radix + lucide。历史 Vue / Pinia 代码只作为待清退实现，不再是目标技术栈。

`DESIGN.md` 是 Portal UI 重构的设计执行源，用于把本合同、role surface 合同、SaaS control-plane UX 合同和 Figma Make implementation leaf 转成产品气质、信息架构、组件系统、文案规则、视觉规则、Figma Make ZIP 吸收流程和重构 slice。`DESIGN.md` 不替代本合同，不替代 Figma Make ZIP source-of-truth，不替代 smoke，也不授权修改 Portal 后端、Gateway、Runtime Bridge、deploy、`.sentrux`、adapters、upstream、secret、真实云、build/push/kubectl 或 live-test。

Sub2API 只作为工程化验证模式参考：顶层 route、账号密码登录、role-based surface、token/primitive、layout、common、业务组件、view 组装、store/composable 和 build/test/browser 校验。不得复制 Sub2API 代码、路由、鉴权、存储结构或产品名词。

`nextlevelbuilder/ui-ux-pro-max-skill` 只作为设计 pattern 参考，用于信息层级、card/list/table 选择、配色字体气质和 anti-pattern 检查。它不引入外部框架，不替代本合同的 Portal 架构，不改变工作台/管理台主叙事。

## UI 分层规则

Portal UI 必须按以下层级落到代码和 eval：

- route entry：公开首页、登录页、注册页由后端渲染；登录后工作台和管理台由 SPA route 承接；旧 `/portal/app/*` 已删除且不得恢复为兼容入口。
- page shell：`src/app/components/Layout.tsx` 只负责应用壳、导航、顶部栏和滚动边界。
- ZIP page component：`src/app/pages/*` 保持 Figma Make 页面结构，并只增加必要的 Portal API query wiring。
- shared UI component：`src/app/components/ui/*` 保持 Figma Make / shadcn-Radix primitives。
- Portal data model：`src/app/data/portal*Model.ts` 承担 per-surface loader、formatter 和 API payload 到页面 model 的映射；`src/app/data/portalQuery.ts` 承担统一 query/error boundary。
- API module：`src/api/portal/*` 只承担 HTTP 和类型映射。
- ZIP surface smoke：`tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs` 固定 ZIP 文件树、route、layout、API adapter、禁词、secret hygiene 和旧文件清退。

## 可执行 Surface Gate

Portal UI 的可执行事实源是 Figma Make ZIP 与复制后的 app root：

```text
/mnt/c/Users/Administrator/Downloads/MedOPL+Portal+UI+Design+(1).zip
/tmp/medopl-figma-make-source-admin
services/portal/frontend/src/app
services/portal/frontend/src/app/data/portal*Model.ts
services/portal/frontend/src/app/data/portalQuery.ts
```

surface smoke 必须检查：

- `src/app` 文件树与 ZIP `src/app` 一致，只允许额外存在当前 Portal data model/query 文件，并按 retired frontend surface gate 排除已退役 ZIP residue。
- `src/styles` 文件树与 ZIP `src/styles` 一致。
- active routes 包含 `/overview`、`/resources`、`/workspace`、`/trace`、`/billing`、`/opl-launch` 和 `/admin/dashboard`、`/admin/users`、`/admin/alerts`、`/admin/billing-ops`、`/admin/audit`、`/admin/system`、`/admin/ops`。
- 已退役管理员 console residue 不得存在于 active frontend。
- 每个 active page 通过 `usePortalQuery` 调用对应 `load*Model`。
- per-surface Portal data model 调用现有 `/api/*` adapter，页面通过 `usePortalQuery` 消费对应 `load*Model`。
- `/admin/ops` 对 `ops_surface_disabled` 有明确产品态映射。
- retired frontend surface gate 证明历史 UI 路径、旧 harness 入口和上一轮根级 React shell 物理不存在。
- 当前实现 leaf 的视觉验收由 React route DOM 锚点、typecheck、build 和本地预览承接；Playwright 默认预览入口必须指向当前 React route；任何截图类回归重新启用都必须另开 leaf 并写明 design quality audit evidence。

## 文案边界

用户侧主语言是：

- 工作台
- 计算资源
- 任务执行
- 文件空间
- 账单
- 余额
- 冻结金额
- 累计消费
- 今日消费
- 输入文件
- 输出文件
- 运行轨迹

管理侧主语言是：

- 管理台
- 平台总览
- 用户管理
- 资源管理
- 任务记录
- 账单管理
- 审计记录
- 站点设置
- 服务状态

UI 不使用：

- 客户工作台
- 平台管理台
- 商业化
- 商业
- SaaS 总览
- 运维面
- 运营总台
- 告警中心
- 账务
- 使用统一账号登录

UI 不使用斜杠组合词表达一个字段；需要两个含义时拆成两个字段。状态展示必须映射成用户可理解文案，不能把 raw status、内部枚举或后台字段直接作为可见主语言。

## 合同降权规则

为避免合同继续膨胀，UI 相关合同分工如下：

- role surface 合同只管普通用户和管理台的角色边界。
- structure/failure isolation 合同只管 Portal 模块边界和 failure isolation。
- shared surface 合同只管 Portal、OPL 和管理台共享产品语义。
- 本 composition 合同只管 Portal UI 执行入口、分层规则和 ZIP surface gate 入口。
- 具体页面、组件、API shape 和缺口必须进入 ZIP source、Portal adapter 或后续专门 UI leaf，不再散落在合同正文。

## 验收方式

正式验收入口统一为：

```bash
node tests/contract/contract-test-v22-node-portal-backend-physical-removal.mjs
```

关键分组：

```bash
node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs
node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs
node tests/regression/portal/regression-test-v22-portal-local-api-action-browser.mjs
```

`surface` 分组必须读取 ZIP source、React app 和 Portal adapter 并检查：

- route 是否存在。
- ZIP 文件树是否一致。
- 禁词是否出现在可见文案中。
- API adapter 是否调用现有 `/api/*`。
- 管理员 route 存在且导航展示由 `/api/me` 角色投影控制；RoleContext 不是安全边界。
- `/admin/ops` route 存在，但默认后端 `404 ops_surface_disabled` 必须显示为“平台托管运维入口未启用”产品态。
- 浏览器能真实打开首页、登录页、当前 6 个普通用户 Portal 路由和当前 7 个管理员 Portal 路由，并能看到关键 DOM 锚点。
- `.runtime/portal-surface-eval/report.json` 能生成结构化报告；该报告不进 git。

## Product Goal Characterization

`leaf-frontend-product-evalset-gap` 曾把 Vue 时代的 Portal UI evalset characterization 写成前端产品事实源；本轮 `leaf-portal-figma-make-react-ui-implementation` 将当前可执行事实源收敛为 React/Figma Make ZIP 普通用户和管理员 Portal。

- `node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs`
- `node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs`

The current surface smoke proves 6 ordinary user routes, 7 admin routes, ZIP file-tree parity, layout navigation, Portal API adapter ownership, forbidden copy, browser secret hygiene, retired file physical checks and runtime report generation. Retired UI evidence is no longer current Portal completion evidence.

This characterization does not change Portal UI implementation, does not upgrade dependencies, does not run deploy/live/cloud/build/push/kubectl, does not read secrets, and does not modify upstream one-person-lab.

## 分支边界

本分支只处理 Portal 工作台和管理台的 Figma Make ZIP absorption、UI composition、surface smoke、页面命名、API adapter wiring、架构边界和测试入口统一。

本分支不处理 Go 后端迁移，不接真实云，不读取 secret，不修改 upstream，不修改 deploy，不执行 build/push、kubectl 或 live-test。

模型记录：`gpt-5.4`。

## Contract Data

<!-- v22-portal-workbench-management-ui-composition-contract:start -->
```json
{
  "contract": "v22_portal_workbench_management_ui_composition_boundary",
  "version": 11,
  "model": "gpt-5.4",
  "scope": {
    "portalOnly": true,
    "implementsUi": true,
    "callsRealCloud": false,
    "readsSecrets": false,
    "modifiesUpstream": false,
    "modifiesDeploy": false
  },
  "contractRole": "ui_boundary_and_zip_surface_eval_entrypoint",
  "uiImplementationSource": {
    "kind": "figma_make_zip",
    "contract": "docs/specs/README.md",
    "zipPath": "/mnt/c/Users/Administrator/Downloads/MedOPL+Portal+UI+Design+(1).zip",
    "extractedPath": "/tmp/medopl-figma-make-source-admin",
    "appRoot": "services/portal/frontend/src/app",
    "userRoutes": [
      "/overview",
      "/resources",
      "/workspace",
      "/trace",
      "/billing",
      "/opl-launch"
    ],
    "adminRoutes": [
      "/admin/dashboard",
      "/admin/users",
      "/admin/alerts",
      "/admin/billing-ops",
      "/admin/audit",
      "/admin/system",
      "/admin/ops"
    ],
    "adminConsoleCopiedAsUnroutedResidue": false,
    "activeAdminRouteMounted": true,
    "adminOpsDefaultProductState": {
      "routeMounted": true,
      "backendDisabledStatus": 404,
      "backendDisabledError": "ops_surface_disabled",
      "frontendDisabledCopy": "平台托管运维入口未启用"
    }
  },
  "surfaceSmoke": {
    "smoke": "tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs",
    "runtimeReportPath": ".runtime/portal-surface-eval/report.json",
    "runtimeReportCommitted": false
  },
  "uiArchitecture": {
    "method": "figma_make_zip_routes_with_portal_api_adapter",
    "layers": [
      "route_entry",
      "page_shell",
      "page_layout",
      "zip_page_component",
      "portal_api_adapter",
      "api_module",
      "zip_surface_smoke"
    ],
    "pageRole": "zip_page_with_portal_api_wiring",
    "surfaceFactsLiveInZipSource": true,
    "apiShapeFactsLiveInPortalApiAdapter": true,
    "visualWorkbenchFactsLiveInCurrentGate": false,
    "screenshotRegressionFactsLiveInCurrentGate": false
  },
  "copyArchitecture": {
    "rawStatusVisible": false,
    "slashSeparatedUiCopyAllowed": false,
    "forbiddenUiTerms": [
      "客户工作台",
      "平台管理台",
      "商业化",
      "商业",
      "SaaS 总览",
      "运维面",
      "运营总台",
      "告警中心",
      "账务",
      "使用统一账号登录"
    ]
  },
  "contractDemotion": {
    "roleSurfaceContractsOwn": "role_boundary_only",
    "structureContractOwns": "module_boundary_and_failure_isolation_only",
    "sharedSurfaceContractOwns": "shared_product_semantics_only",
    "compositionContractOwns": "ui_boundary_and_zip_surface_eval_entrypoint",
    "surfaceAndApiDetailsOwn": "figma_make_zip_and_portal_api_adapter"
  },
  "runtimeSmokeEntrypoint": "tests/regression/portal/regression-test-v22-portal-runtime-suite.mjs",
  "validationGroups": [
    "contract",
    "surface",
    "architecture",
    "api",
    "build",
    "browser"
  ]
}
```
<!-- v22-portal-workbench-management-ui-composition-contract:end -->

## Non-goals

- 不迁移 Portal 后端到 Go。
- 不调用真实云。
- 不读取 secret。
- 不创建、释放或修改真实资源。
- 不接真实支付。
- 不修改 one-person-lab upstream。
- 不修改 deploy、`.sentrux` 或 `adapters`。

### spec:v22-pricing-snapshot-boundary

Former leaf id: `v22-pricing-snapshot-boundary`
Former title: v22 Pricing Snapshot Boundary Contract

本合同定义 MedOPL v22 默认套餐的 pricing snapshot 边界。它只记录平台托管套餐的产品待审批状态和内部成本快照结构，不发布 MedOPL 售卖价。

## Scope

- v22 默认套餐只包含 `starter_2c4g_10gb` 和 `pro_8c16g_100gb`。
- 资源由平台开通，区域固定为 `na-siliconvalley`，可用区固定为 `na-siliconvalley-1`。
- 存储后端固定为 `cos_standard_workspace_quota`，操作系统固定为 `ubuntu_22_04`。
- 云账单模式固定为 `pay_as_you_go`。

## Product Approval Boundary

- `basePrice` 是 MedOPL 对客户售卖价字段。本轮产品审批未完成，因此必须为 `null`。
- `pendingProductApproval` 必须为 `true`，用于阻止前端、API、文档或测试把套餐展示为正式售卖价。
- 前端、API、文档、smoke 不得硬编码正式售卖价、小时价、按量单价或任何可被解释为当前可售价格的数值。
- `costSnapshot` 只允许表达内部云成本快照，不是客户价格，不得写入 `basePrice`，也不得作为 MedOPL 售卖价来源。
- 腾讯云成本价只能作为内部成本评审输入；不允许把腾讯云成本价当 MedOPL 售卖价。

## Contract Data

<!-- v22-pricing-snapshot-contract:start -->
```json
{
  "contract": "v22_pricing_snapshot_boundary",
  "version": 1,
  "computeProvisioningModel": {
    "tenantNodePoolCreatedByPackageC": true,
    "sharedUserComputePoolSupported": false,
    "userBuysNodePool": false
  },
  "plans": [
    {
      "id": "starter_2c4g_10gb",
      "compute": {
        "cpuCores": 2,
        "memoryGb": 4,
        "isolationMode": "tenant_node_pool",
        "userBuysNodePool": false
      },
      "storage": {
        "capacityGb": 10
      },
      "storageBackend": "cos_standard_workspace_quota",
      "region": "na-siliconvalley",
      "zone": "na-siliconvalley-1",
      "os": "ubuntu_22_04",
      "cloudBillingMode": "pay_as_you_go",
      "basePrice": null,
      "pendingProductApproval": true,
      "costSnapshot": {
        "kind": "provider_cost_snapshot",
        "provider": "tencent_cloud",
        "region": "na-siliconvalley",
        "zone": "na-siliconvalley-1",
        "billingMode": "pay_as_you_go",
        "currency": null,
        "providerCostAmount": null,
        "capturedAt": null,
        "usage": "internal_cost_review_only",
        "mayPopulateBasePrice": false
      }
    },
    {
      "id": "pro_8c16g_100gb",
      "compute": {
        "cpuCores": 8,
        "memoryGb": 16,
        "isolationMode": "tenant_node_pool",
        "userBuysNodePool": false
      },
      "storage": {
        "capacityGb": 100
      },
      "storageBackend": "cos_standard_workspace_quota",
      "region": "na-siliconvalley",
      "zone": "na-siliconvalley-1",
      "os": "ubuntu_22_04",
      "cloudBillingMode": "pay_as_you_go",
      "basePrice": null,
      "pendingProductApproval": true,
      "costSnapshot": {
        "kind": "provider_cost_snapshot",
        "provider": "tencent_cloud",
        "region": "na-siliconvalley",
        "zone": "na-siliconvalley-1",
        "billingMode": "pay_as_you_go",
        "currency": null,
        "providerCostAmount": null,
        "capturedAt": null,
        "usage": "internal_cost_review_only",
        "mayPopulateBasePrice": false
      }
    }
  ]
}
```
<!-- v22-pricing-snapshot-contract:end -->

## Smoke Boundary

`tests/smoke/smoke-test-v22-pricing-plan-contract.mjs` 是纯本地 contract 校验。它只读取本文件中的 JSON 契约块，不读取 `/home/dev/.secrets/medopl/secrets.env.txt`，不调用真实云 API，不执行 build、push、kubectl 或 live-test。

### spec:v22-production-cloud-topology-boundary

Former leaf id: `v22-production-cloud-topology-boundary`
Former title: v22 Production Cloud Topology Boundary

本合同定义 MedOPL v22 production cloud topology contract。当前只是合同，不代表已部署，不代表已接入，不代表已验证。

本合同只描述生产云拓扑中已购买或准备使用的资源角色，以及这些资源后续进入 readonly inventory 和 deploy plan 时必须携带的边界信息。它不读取 secret，不调用真实云，不创建、删除或修改任何资源。

## Scope

production cloud topology contract 只回答：

- MedOPL v22 生产环境计划使用哪些云资源类别。
- 这些云资源在平台架构中的职责是什么。
- 哪些拓扑维度必须进入后续 readonly inventory 和 deploy plan。
- 哪些云控制台语言不得进入普通用户产品语言。

当前只是合同：

- 不代表已部署。
- 不代表已接入。
- 不代表已验证。
- 不代表 Portal / Gateway / Runtime Bridge / worker 已在这些资源上运行。
- 不代表真实 CLB、TKE、COS、CBS、NAT、PostgreSQL 已通过 MedOPL 自动化管理。

## Resource Roles

生产云资源角色如下：

| Resource | Contract Role | Boundary |
| --- | --- | --- |
| CLB | portal/opl/gateway 入口 | 承担 `portal.medopl.cn`、`opl.medopl.cn`、Gateway 等入口流量分发边界；当前合同不创建监听器、不配置证书、不验证域名。 |
| TKE | Portal/Gateway/Runtime/worker 承载层 | 承载 Portal、OPL Gateway、Runtime Bridge、worker 和后续后台任务；当前合同不 kubectl，不创建 namespace，不部署 workload。 |
| COS | workspace file space object storage / 文件空间事实源 | 承载用户文件空间、输入文件、输出文件和 artifact 正文；COS object body 不进入 Portal canonical truth，不在普通用户 payload、日志、evidence 或 git 暴露 bucket、objectKey、storageKey、signedUrl 或 raw response。 |
| CBS | TKE 节点盘/必要持久卷 | 用于 TKE 节点盘或必要持久卷；CBS 不作为普通用户文件空间主叙事，普通用户仍只看到文件空间、容量、保护期、批量下载和批量删除。 |
| NAT | TKE 私网出公网、拉镜像、访问模型/API/云 API | 为私网内 TKE workload 出公网提供边界，用于拉镜像、访问模型/API 或后续授权云 API；当前合同不配置路由表、不验证出网。 |
| PostgreSQL | Portal canonical store、账本、资源绑定、审计、文件索引 | 承担 Portal canonical store、钱包/账本、资源绑定、审计事件、文件索引和合同态业务数据；PostgreSQL 不是普通用户可见云数据库。 |

这些资源属于生产基础设施拓扑，不等于用户购买的“文件空间主叙事”或“云控制台清单”。普通用户产品语言不展示 CLB/TKE/COS/CBS/NAT/PostgreSQL。

TKE 内部节点池必须区分资源角色：

- platform service node pool：承载 Portal、OPL Gateway、Runtime Bridge、trace、billing、system 等平台服务。
- tenant node pool：由 MedOPL 在租户或工作台开通时创建并绑定，只承载该租户、工作台或明确账号组 runtime。

平台服务不得调度到 tenant node pool。用户 workload 不得调度到 platform service node pool。tenant node pool 必须参考 Kubernetes 官方多租户模型，用 Namespace、RBAC、ResourceQuota、LimitRange、NetworkPolicy、Pod Security、admission policy、taint、label、nodeSelector、toleration 和 Portal resource binding 硬隔离。

## User Product Language Boundary

普通用户页面只表达：

- 工作台资源。
- 托管运行环境。
- 文件空间。
- 输入文件和输出文件。
- 预计费用。
- 释放策略。
- 审计状态。
- 保护期。
- 批量下载和批量删除。

普通用户产品语言不展示：

- CLB/TKE/COS/CBS/NAT/PostgreSQL。
- Kubernetes、node pool、节点池、云资源清单、服务器编号。
- VPC、subnet、security group、route table、load balancer listener。
- objectKey、storageKey、localPath、signedUrl、cosPrefix、storageBackend。
- SecretId、SecretKey、token、raw API Key、kubeconfig。

管理员 / 运维页面可以在受控审计和对账区域展示必要的后台拓扑摘要，但不得把 raw cloud response、secret、kubeconfig、signed URL 或可直接定位用户文件的内部存储字段写入 Portal payload、日志、evidence 或 git。

## Future Readonly Inventory And Deploy Plan Dimensions

后续 readonly inventory 和 deploy plan 必须显式记录并校验以下拓扑维度：

- region。
- VPC。
- subnet。
- security group。
- route table / NAT route summary。
- CLB listener / domain / certificate binding summary。
- TKE cluster / namespace / workload class summary。
- COS bucket / prefix / metadata-only file-space summary。
- CBS disk / persistent volume summary。
- PostgreSQL instance summary。
- resource tag。
- cost allocation。

这些维度只能作为后续只读盘点、部署计划、成本归因和审计输入。它们不能被启发式推断为账号或工作空间归属；归属仍必须以 Portal ledger + resource tag / cost allocation 双重校验为准。

缺失 region、VPC、subnet、security group、resource tag 或 cost allocation 时，后续 readonly inventory 和 deploy plan 必须 fail-closed，进入 admin 审计队列，而不是默认补齐或按名称/创建时间/IP/规格推断。

## Relationship To Existing Tencent Contracts

本合同位于 Tencent Provider 合同包之前置拓扑层。它不替代以下合同：

- `spec:v22-tencent-readonly-inventory-boundary`
- `spec:v22-authorized-tencent-create-release-boundary`
- `spec:v22-authorized-tencent-create-release-implementation-boundary`
- `spec:v22-authorized-tencent-create-release-execution-boundary`

production cloud topology 只定义“资源类别与职责”。readonly inventory 定义“如何只读盘点并脱敏输出”。authorized create/release 定义“何时允许真实创建或释放”。三者必须分离。

TKE bootstrap preflight 位于 production cloud topology 和 Package C live mutation 之间。它只把缺失的 TKE foundation 转成 operator checklist 和后续需要回填的 env 字段，不替代 readonly inventory、deploy plan 或 authorized create/release。

## Non-Goals

本合同明确非目标：

- 不改 deploy。
- 不 kubectl。
- 不 build/push。
- 不调用真实云。
- 不读取 secret。
- 不创建/删除资源。
- 不创建、修改或删除 CLB、TKE、COS、CBS、NAT、PostgreSQL。
- 不配置 VPC、subnet、security group、route table、listener、certificate 或 resource tag。
- 不运行 live-test。
- 不改 `.sentrux`、`adapters`、`upstream`。
- 不实现 provider adapter。
- 不改变普通用户 Portal UI 文案或业务语义。

真实云 inventory、deploy plan、资源创建/释放、kubectl、build/push、secret 读取和 live-test 必须另开 feat/* 并由用户在当前会话单独授权。

## Contract Data

<!-- v22-production-cloud-topology-contract:start -->
```json
{
  "contract": "v22_production_cloud_topology_boundary",
  "version": 1,
  "contractOnly": true,
  "deployed": false,
  "connected": false,
  "verified": false,
  "callsRealCloud": false,
  "readsSecret": false,
  "createsOrDeletesResources": false,
  "changesDeploy": false,
  "usesKubectl": false,
  "runsBuildPush": false,
  "resourceRoles": {
    "CLB": "portal/opl/gateway 入口",
    "TKE": "Portal/Gateway/Runtime/worker 承载层",
    "COS": "workspace file space object storage / 文件空间事实源",
    "CBS": "TKE 节点盘/必要持久卷，不作为普通用户文件空间主叙事",
    "NAT": "TKE 私网出公网、拉镜像、访问模型/API/云 API",
    "PostgreSQL": "Portal canonical store、账本、资源绑定、审计、文件索引",
    "platform service node pool": "Portal/OPL Gateway/Runtime Bridge/trace/billing/system 平台服务池",
    "tenant node pool": "租户或工作台开通时由 MedOPL 创建并绑定，只能由绑定 resourceBindingId 或账号组调度"
  },
  "schedulingIsolation": {
    "platformServicesMustNotScheduleToTenantNodePool": true,
    "userWorkloadMustNotScheduleToPlatformServiceNodePool": true,
    "tenantNodePoolRequiredPerWorkspace": true,
    "tenantNodePoolRequiresNamespaceRbacResourceQuotaLimitRangeNetworkPolicyPodSecurity": true,
    "tenantNodePoolRequiresTaintLabelNodeSelectorToleration": true,
    "sharedUserComputePoolSupported": false
  },
  "ordinaryUserProductLanguageHides": [
    "CLB",
    "TKE",
    "COS",
    "CBS",
    "NAT",
    "PostgreSQL"
  ],
  "ordinaryUserProductLanguageAllows": [
    "工作台资源",
    "托管运行环境",
    "文件空间",
    "预计费用",
    "释放策略",
    "审计状态"
  ],
  "futureReadonlyInventoryAndDeployPlanDimensions": [
    "region",
    "VPC",
    "subnet",
    "security group",
    "COS bucket / prefix metadata-only summary",
    "CBS disk / persistent volume summary",
    "PostgreSQL instance summary",
    "resource tag",
    "cost allocation"
  ],
  "mustFailClosedOnMissingTopologyOrAllocationTags": true
}
```
<!-- v22-production-cloud-topology-contract:end -->

### spec:v22-tke-bootstrap-preflight-boundary

Former leaf id: `v22-tke-bootstrap-preflight-boundary`
Former title: v22 TKE Bootstrap Preflight Boundary

本合同定义 Package C live create/release 之前的 TKE bootstrap preflight。当前只是本地 dry-run checklist，不代表 TKE、NAT、CBS、COS、PostgreSQL、namespace、workload 或 node pool 已创建。

## Purpose

TKE bootstrap preflight 用于回答“当前没有 TKE 时，下一步应该先开哪些云底座，以及开完后哪些字段可以进入 Package C mutation env”。

Runner:

- `tests/support/cloud-prework/v22-tke-bootstrap-preflight-plan.js`
- `tests/future-authorized/cloud/future-authorized-test-v22-tke-bootstrap-preflight-local-gate.mjs`

该 runner 只允许在 `--dry-run --confirm-no-real-cloud` 下生成 `.runtime/v22-cloud-bootstrap/<operation-id>-preflight.json`。它拒绝 `--secret-file`、`--live`、`--execute`、`--apply`、`--mutate`、`--deploy`、`--kubectl`、`--build` 和 `--push`。当前 runner 不读取 `package-c-mutation.env`，不读取 mutation secret，不调用腾讯云，不写 Portal ledger，不扣费，不读取 COS object body。

## Required Foundation Shape

- one TKE cluster in the target region and VPC.
- platform service node pool for Portal, Gateway, Runtime Bridge, worker and platform services.
- tenant node pools are created by Package C per tenant or workspace during authorized lifecycle execution.
- PostgreSQL / COS / CBS are the required data plane for Portal canonical store, file space and node or volume storage.
- Redis is not required by the current production data plane.

Kubernetes controls must include Namespace, RBAC, ResourceQuota, LimitRange, NetworkPolicy, Pod Security, admission policy, taints/tolerations, node selector and labels. The preflight follows the Kubernetes official multi-tenancy model as a local contract lower bound; it does not create those controls.

## Required Env Outputs

After TKE is created and readonly inventory observes the cluster and platform service node pool, the operator may fill only these Package C mutation fields for the next authorization request:

- `TENCENT_MUTATION_TKE_CLUSTER_ID`
- `TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID`

Filling these fields does not authorize live mutation. Package C live create/release still requires explicit current-session authorization, mutation secret allowlist, API allowlist, budget, evidence sink and rollback owner.

## Contract Data

<!-- v22-tke-bootstrap-preflight-contract:start -->
```json
{
  "contract": "v22_tke_bootstrap_preflight_boundary",
  "version": 1,
  "planMode": "dry_run",
  "productionReady": false,
  "callsRealCloud": false,
  "readsSecret": false,
  "usesKubectl": false,
  "runsDeploy": false,
  "runsBuildPush": false,
  "createsOrDeletesResources": false,
  "clusterModel": "unified_tke_cluster_with_tenant_node_pools",
  "requiredNodePools": [
    "platform_service_pool"
  ],
  "tenantNodePools": "created_by_package_c_per_tenant_or_workspace",
  "sharedUserComputePoolRequired": false,
  "premiumDedicatedPoolRequired": false,
  "requiredDataPlane": [
    "PostgreSQL",
    "COS",
    "CBS"
  ],
  "redisRequired": false,
  "requiredMutationEnvFields": [
    "TENCENT_MUTATION_TKE_CLUSTER_ID",
    "TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID"
  ]
}
```
<!-- v22-tke-bootstrap-preflight-contract:end -->

### spec:v22-real-opl-capability-canary-boundary

Former leaf id: `v22-real-opl-capability-canary-boundary`
Former title: v22 Real OPL Capability Canary Boundary Contract

本合同定义 MedOPL v22 中真实 OPL 能力 canary 的边界。它回答一件事：

```text
Portal 和 OPL 已经打通 context/backflow 骨架后，如何逐项验证真实 message、file、run、artifact、runtime 和 observability 能力是否能进入真实 OPL/agent/provider/runtime 边界并回流 Portal。
```

本合同不替代 [spec:v22-portal-opl-context-backflow-boundary](#spec-v22-portal-opl-context-backflow-boundary)。前者定义 Portal-OPL 连接骨架，本合同定义剩余真实 OPL 能力 canary 和后续 productionization handoff。message reply 的 provider 细分执行合同是 [spec:v22-real-opl-provider-message-canary-boundary](#spec-v22-real-opl-provider-message-canary-boundary)。file/run/artifact 的细分执行合同是 [spec:v22-real-opl-file-run-artifact-canary-boundary](#spec-v22-real-opl-file-run-artifact-canary-boundary)。

## Contract Level

合同分级如下：

- Level 1: [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop)。一级主合同，定义 MedOPL 托管 OPL SaaS 用户主闭环。
- Level 2: [spec:v22-portal-opl-connection-boundary](#spec-v22-portal-opl-connection-boundary)、[spec:v22-upstream-opl-boundary](#spec-v22-upstream-opl-boundary) 和 [spec:v22-opl-work-message-file-run-boundary](#spec-v22-opl-work-message-file-run-boundary)。二级段合同，定义 Portal-OPL 连接、clean upstream 和 OPL 工作流业务边界。
- Level 3: 本合同。Real OPL capability canary execution contract，细化真实 WebUI/ACP/Runtime 能力发现、message reply、file、run、artifact、observability、Portal projection、错误 gate 和吸收标准。

本合同是三级执行合同，不替代一级主合同和二级段合同。

## Subscription Package

本合同订阅以下合同包：

- [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop)
- [spec:v22-portal-opl-connection-boundary](#spec-v22-portal-opl-connection-boundary)
- [spec:v22-portal-opl-context-backflow-boundary](#spec-v22-portal-opl-context-backflow-boundary)
- [spec:v22-real-opl-provider-message-canary-boundary](#spec-v22-real-opl-provider-message-canary-boundary)
- [spec:v22-real-opl-file-run-artifact-canary-boundary](#spec-v22-real-opl-file-run-artifact-canary-boundary)
- [spec:v22-upstream-opl-boundary](#spec-v22-upstream-opl-boundary)
- [spec:v22-opl-work-message-file-run-boundary](#spec-v22-opl-work-message-file-run-boundary)
- [spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary](#spec-v22-runtime-bridge-session-run-file-provider-keyref-boundary)
- [spec:v22-portal-files-billing-trace-boundary](#spec-v22-portal-files-billing-trace-boundary)
- [spec:v22-token-provider-boundary](#spec-v22-token-provider-boundary)
- [spec:v22-trace-metadata-boundary](#spec-v22-trace-metadata-boundary)
- [spec:v22-langfuse-observability-metadata-boundary](#spec-v22-langfuse-observability-metadata-boundary)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)

规范路径为：

- `docs/active/README.md`
- `docs/active/README.md`
- `docs/delivery/README.md`
- `docs/delivery/README.md`
- `docs/delivery/README.md`
- `docs/delivery/README.md`

## Product Truth

产品真相：

```text
Portal is the SaaS control plane.
Gateway is the clean OPL WebUI entry/proxy.
Runtime Bridge is the anti-corruption layer for OPL context, capability discovery, event mapping, and Portal projection.
Runtime Bridge / Runtime Agent is the downstream canonical source for run, artifact, ledger, trace, and billing metadata.
Langfuse is an optional sanitized observability attachment.
one-person-lab upstream remains clean.
```

真实 OPL 能力 canary 的目标不是证明所有能力已上线，而是把每项真实能力裁定清楚：

- 真实存在并可回流 Portal。
- 可通过 WebUI bridge 映射。
- 可通过 ACP runtime 映射。
- 需要 Runtime Agent。
- 需要 provider 授权。
- 需要真实云/runtime 授权。
- 当前 upstream 不支持。

任何能力没有真实证据时，必须显式 gate，不得用 fake Product API、placeholder 200、fixture reply 或本地假 run 代替真实结论。

## Primary Scope

本合同 Primary Scope 是：

```text
Portal
  -> Gateway
  -> clean OPL WebUI
  -> Runtime Bridge capability discovery
  -> real OPL WebUI bridge / ACP runtime / Runtime Agent boundary
  -> Runtime Bridge normalized state
  -> Portal projection
```

本合同覆盖：

- 真实 OPL WebUI / ACP capability discovery。
- Portal launch 后 OPL 获取 MedOPL public context。
- 真实 OPL session / conversation 创建和回流。
- message intent 是否进入真实 OPL/agent/provider，并是否产生 assistant reply。
- file upload / file reference 是否能形成 workspace-scoped fileRef。
- run intent 是否进入真实 Runtime Bridge / Runtime Agent boundary。
- artifact / output file 是否形成 artifactRef 或 outputFileRef 并回流 Portal。
- sanitized trace / billing metadata 是否可形成 Portal projection。
- 不支持、缺授权、缺 runtime、缺 provider、upstream 变化时的明确 gate error。

## Non-goals

本合同不做以下事项：

- 不修改 one-person-lab upstream。
- 不 import upstream 内部模块。
- 不在 upstream 目录写 Portal、Gateway、Runtime Bridge、Runtime 或 Langfuse 代码。
- 不读取 raw secret、kubeconfig、SecretId、SecretKey、SSH private key 或 `.env`。
- 不调用真实腾讯云、COS、TKE、K8s 或其他真实云 mutation API。
- 不 build/push/kubectl/live-test。
- 不修改 `deploy/*`、`.sentrux/*` 或 `adapters/*`。
- 不部署 `trace.medopl.cn`。
- 不部署 Langfuse、ClickHouse、Ingress、DNS 或 TLS。
- 不把 Langfuse 当成 Portal、run、artifact、billing 或 file 的 canonical source。
- 不把 fake Product API、fixture Runtime Agent relay 或 placeholder 200 当成真实 OPL 能力上线证据。

## Authorization Boundary

默认授权只允许：

- 本地读取 v22 active surface。
- 启动本地真实 OPL WebUI canary 进程。
- 使用 `OPL_REAL_WEBUI_DIR` 或 `OPL_REAL_WEBUI_URL` 指向用户授权的真实 WebUI canary 来源。
- 使用本地 canary evidence 写入 `.runtime`。
- 读取公开 WebUI/ACP/API/CLI 边界返回的非 secret 元数据。
- 更新合同、recovery 状态、smoke 和 active surface 中的 Runtime Bridge/Gateway/Portal productionized 映射代码。

需要用户单独授权后才能做：

- 使用真实 provider key 或 raw API key 触发真实模型调用。
- 使用真实 Runtime Agent endpoint。
- 使用真实云 runtime、腾讯云资源、COS、TKE、K8s、kubectl 或 live-test。
- 部署 Langfuse 或 `trace.medopl.cn`。
- 读取 secret 文件、`.env`、kubeconfig 或任何外部生产 token。
- 修改 upstream、deploy、`.sentrux` 或 adapters。

## Canonical Identity Map

真实 OPL 能力 canary 必须固定 ID 归属。以下字段必须显式生成、绑定或 gate：

| 字段 | Canonical owner | 说明 |
| --- | --- | --- |
| `tenantId` | Portal | 租户边界，Portal canonical |
| `portalUserId` | Portal | 用户边界，Portal canonical |
| `workspaceId` | Portal | workspace 边界，Portal canonical |
| `launchId` | Portal / Gateway | 进入 OPL 的一次性 launch 关联，不进入 URL query |
| `workspaceSessionId` | Portal / Runtime Bridge | Portal workspace session projection |
| `runtimeSessionId` | Runtime Bridge | runtime session 归一化 ID |
| `resourceBindingId` | Portal / Runtime Bridge | 托管运行环境资源绑定 ID |
| `providerKeyRef` | Portal / Runtime Bridge secret boundary | provider 绑定引用，不是 raw API key |
| `oplSessionId` | OPL WebUI / ACP / Runtime Bridge | OPL session 归一化 ID |
| `oplConversationId` | OPL WebUI bridge | WebUI conversation ID |
| `clientMessageId` | OPL WebUI / Portal client | 幂等 message intent ID |
| `messageId` | Runtime Bridge | Runtime Bridge message projection ID |
| `replyMessageId` | OPL / Runtime Bridge | assistant reply projection ID |
| `fileRef` | Portal / Runtime Bridge | workspace-scoped file reference |
| `runId` | Runtime Bridge / Runtime Agent | run canonical ID |
| `artifactRef` | Runtime Bridge / Runtime Agent | 输出 artifact public reference |
| `outputFileRef` | Portal / Runtime Bridge | 输出文件 public reference |
| `traceId` | Runtime Bridge | sanitized trace metadata ID |
| `billingMetadataRef` | Runtime Bridge / Portal billing projection | 账单元数据引用，不是账单真相外泄 |

所有 projection 必须绑定 `tenantId + portalUserId + workspaceId`。message、file、run、artifact 和 trace 还必须绑定 session 或 run 维度，避免跨 workspace、跨 session 或跨用户串读。

## Capability Registry

Runtime Bridge 必须以 capability registry 暴露真实能力裁定。允许状态如下：

- `supported`: 真实能力已验证并可通过稳定 projection 回流。
- `mapped_to_webui_bridge`: 真实能力通过 WebUI bridge 映射。
- `mapped_to_acp_runtime`: 真实能力通过公开 ACP runtime 映射。
- `requires_runtime_agent`: 需要 Runtime Agent 才能完成。
- `deferred_authorization`: 能力需要用户或运维单独授权。
- `capability_not_supported`: 当前真实 upstream 不支持或未验证。
- `provider_key_required`: 需要 `providerKeyRef` 或用户授权 provider key。
- `managed_environment_required`: 需要已开通托管运行环境。
- `runtime_authorization_required`: 需要真实 Runtime Agent / 真实云 runtime 授权。
- `upstream_unavailable`: 真实 upstream 不可访问。
- `upstream_reply_timeout`: message 已进入 upstream，但未观测到 reply。
- `runtime_bridge_mapping_failed`: upstream shape 变化或映射失败。
- `trace_sink_not_configured`: trace sink 未配置或未授权。

capability registry 至少覆盖：

```json
{
  "contextBootstrap": "supported",
  "sessionBackflow": "mapped_to_webui_bridge",
  "messageReply": "capability_not_supported",
  "fileUpload": "capability_not_supported",
  "runIntent": "requires_runtime_agent",
  "artifactBackflow": "requires_runtime_agent",
  "observabilityProjection": "trace_sink_not_configured"
}
```

真实 canary 发现新事实后，必须更新合同和 status，而不是让代码隐式兼容。

## Discovery And Canary Evidence Boundary

canary evidence 只允许写入 `.runtime`，不得进入 git。evidence 允许包含：

- upstream version / commit / package metadata。
- canary command 名称和脱敏 exit status。
- capability registry snapshot。
- sanitized endpoint path。
- sanitized WebSocket event type。
- sanitized timing metadata。
- sanitized status/error code。

evidence 禁止包含：

- raw prompt。
- raw completion。
- raw API key。
- bearer token。
- `launchToken`。
- `runtimeToken`。
- `objectKey`。
- `storageKey`。
- `localPath`。
- `signedUrl`。
- `presignedUrl`。
- kubeconfig、SecretId、SecretKey、SSH private key 或 `.env` 内容。

## Message Reply Canary

message reply canary 的目标是证明 message 真正进入 OPL/agent/provider，并形成可查询回流。

message reply 的 provider 级细分验收以 [spec:v22-real-opl-provider-message-canary-boundary](#spec-v22-real-opl-provider-message-canary-boundary) 和 `docs/delivery/README.md` 为准。该细分合同只证明真实 message/reply/provider 边界，不证明 file、run、artifact、真实云 runtime 或 Langfuse 已上线。

请求必须携带：

- `tenantId`
- `portalUserId`
- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `oplSessionId` 或 `oplConversationId`
- `clientMessageId`
- `providerKeyRef`

成功必须返回：

- `messageId`
- `status`
- `replyMessageId`
- sanitized reply metadata
- optional `traceId`
- capability source，例如 `mapped_to_webui_bridge`

失败必须返回明确 gate：

- 无 provider 时返回 `provider_key_required`。
- 未开通托管环境时返回 `managed_environment_required`。
- upstream 不可达时返回 `upstream_unavailable`。
- reply 未观测到时返回 `upstream_reply_timeout` 或 `capability_not_supported`。
- upstream shape 变化时返回 `runtime_bridge_mapping_failed`。

不得返回 raw prompt、raw completion、raw API key、bearer token、`launchToken` 或 `runtimeToken`。

## File Capability Canary

file capability canary 的目标是证明文件能力是否可形成 workspace-scoped fileRef。

成功必须返回：

- `fileRef`
- `workspaceId`
- `workspaceSessionId`
- `source`
- `status`
- sanitized file metadata，例如 file name、size、content type

失败必须返回明确 gate：

- upstream 不支持文件上传时返回 `capability_not_supported`。
- 需要 Runtime Agent 时返回 `requires_runtime_agent`。
- 需要托管环境时返回 `managed_environment_required`。
- storage boundary 未授权时返回 `deferred_authorization`。

公开 response 禁止包含 `objectKey`、`storageKey`、`localPath`、`signedUrl`、`presignedUrl` 或内部 bucket/path。

## Runtime Agent And Run Canary

Runtime Agent And Run Canary 的目标是证明 run intent 是否进入真实 Runtime Bridge / Runtime Agent boundary。Runtime Bridge / Runtime Agent is the downstream canonical source for run、artifact、ledger、trace 和 billing metadata。

成功必须返回：

- `runId`
- `status`
- `workspaceId`
- `runtimeSessionId`
- `resourceBindingId`
- `providerKeyRef`
- `traceId`
- `billingMetadataRef`
- sanitized runtime metadata

失败必须返回明确 gate：

- 无 provider 时返回 `provider_key_required`。
- 未开通托管环境时返回 `managed_environment_required`。
- 未配置 Runtime Agent 时返回 `requires_runtime_agent`。
- 需要真实 runtime 授权时返回 `runtime_authorization_required`。

本合同默认不调用真实云 runtime。真实云 runtime、真实 Runtime Agent endpoint、真实计算/存储资源和真实部署必须单独授权。

## Artifact Backflow Canary

artifact backflow canary 的目标是证明 run 输出能形成 Portal 可查询的 public reference。

成功必须返回：

- `artifactRef` 或 `outputFileRef`
- `runId`
- `workspaceId`
- `runtimeSessionId`
- `resourceBindingId`
- `providerKeyRef`
- `status`
- sanitized artifact metadata

公开 response 禁止包含 `objectKey`、`storageKey`、`localPath`、`signedUrl`、`presignedUrl`、runtime 私有路径或 storage secret。

artifact 必须能通过 Portal 按 `workspace/session/run` 查询，不能只存在于 Runtime Agent 私有状态里。

## Observability Canary

Observability Canary 的目标是证明 session/message/run metadata 能形成 sanitized projection。Langfuse is an optional sanitized observability attachment，不是 Portal、billing、file、artifact 或 run 的 canonical source。

成功必须返回：

- `traceId`
- `sessionId` 或 `workspaceSessionId`
- `oplSessionId`
- `messageId` 或 `runId`
- `status`
- `latencyMs`
- sanitized usage summary
- sanitized cost estimate
- tags

`trace.medopl.cn` 是后续 Langfuse admin/ops console 目标域。真实部署、DNS、TLS、Ingress、Langfuse secret、ClickHouse 和真实 trace source 必须单独授权。

Langfuse 未配置时必须返回 `trace_sink_not_configured` 或 `deferred_authorization`，不得影响 Portal-OPL context、session 或 message gate 的独立判断。

## Portal Projection Canary

Portal projection canary 的目标是证明 Portal 能按 workspace/session/run 查询状态、文件、trace 和 billing metadata。

Portal 只能通过稳定 `/api/opl/*` 或已定义 Portal API 查询 Runtime Bridge projection。Portal 禁止直接依赖：

- one-person-lab route。
- WebSocket event shape。
- DOM。
- frontend store。
- upstream database schema。
- upstream internal session model。

Portal projection 必须覆盖：

- launch status。
- bootstrap context。
- capability registry。
- session binding。
- message status。
- fileRef status。
- run status。
- artifact/output reference。
- trace metadata。
- billing metadata reference。

## Error Gates And No-Fake-Success

本合同禁止 fake success。以下情况必须返回明确错误，不得返回 200 假成功：

- `provider_key_required`
- `managed_environment_required`
- `runtime_authorization_required`
- `requires_runtime_agent`
- `upstream_unavailable`
- `upstream_reply_timeout`
- `runtime_bridge_mapping_failed`
- `capability_not_supported`
- `trace_sink_not_configured`
- `deferred_authorization`

HTTP status 必须表达业务失败类别。若网关或 Runtime Bridge 使用 202 表达异步 accepted，response 必须包含 `status=queued|running` 和后续查询 URL/ID；不得把 `queued` 伪装成 `succeeded`。

## Absorption Gate

本合同对应分支进入 B 窗口前必须满足：

1. 明确声明订阅本合同包和模型记录。当前 lane 分支名为 `feat/v22-real-opl-capability-canary`，模型记录为 `gpt-5.4`。
2. `node tests/regression/opl/regression-test-v22-real-opl-capability-contract-gate.mjs` 通过。
3. `node tests/smoke/smoke-test-v22-portal-opl-connection-contract.mjs` 通过。
4. `node tests/smoke/smoke-test-v22-portal-opl-connection-contract.mjs` 通过。
5. `node tests/contract/contract-test-v22-mvp-contract-suite.mjs` 通过，或明确记录未运行原因。
6. canary 事实已回写合同、status 和 validation path。
7. message/file/run/artifact/observability 未完成真实 canary 时，必须在状态矩阵标记为未完成或需授权。
8. 没有修改 one-person-lab upstream。
9. 没有读取 secret，没有调用真实云，没有 build/push/kubectl/live-test，没有修改 deploy、`.sentrux` 或 adapters。
10. `git diff --check -- docs/specs docs tests scripts` 通过。

### spec:v22-real-opl-file-run-artifact-canary-boundary

Former leaf id: `v22-real-opl-file-run-artifact-canary-boundary`
Former title: v22 Real OPL File Run Artifact Canary Boundary Contract

本合同定义 MedOPL v22 中真实 OPL file/run/artifact canary 的边界。它回答一件事：

```text
Portal 已能进入 clean OPL WebUI、绑定 session，并已通过授权 provider message reply canary 后，如何继续验证文件上传或文件 intent 是否形成 workspace-scoped fileRef、run 是否进入 Runtime Agent boundary、artifact/output 是否回流 Portal。
```

本合同不替代 [spec:v22-real-opl-capability-canary-boundary](#spec-v22-real-opl-capability-canary-boundary)。前者定义真实 OPL capability canary 总链路，本合同只细化 file、run、artifact、trace projection 和 billing metadata handoff 的执行边界。

## Contract Level

合同分级如下：

- Level 1: [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop)。一级主合同，定义 MedOPL 托管 OPL SaaS 用户主闭环。
- Level 2: [spec:v22-portal-opl-connection-boundary](#spec-v22-portal-opl-connection-boundary)、[spec:v22-upstream-opl-boundary](#spec-v22-upstream-opl-boundary) 和 [spec:v22-opl-work-message-file-run-boundary](#spec-v22-opl-work-message-file-run-boundary)。二级段合同，定义 Portal-OPL 连接、clean upstream 和 OPL 工作流业务边界。
- Level 3: [spec:v22-real-opl-capability-canary-boundary](#spec-v22-real-opl-capability-canary-boundary) 和本合同。`spec:v22-real-opl-capability-canary-boundary` 是真实 OPL 能力 canary 总合同；本合同是 file/run/artifact 三级执行合同，细化每个 step gate、真实证据、Portal projection 和吸收标准。

本合同是三级执行合同，不改一级主线叙事，不扩大二级 Portal-OPL 边界授权，也不把未验证能力标记为已上线。

## Subscription Package

本合同订阅以下合同包：

- [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop)
- [spec:v22-portal-opl-connection-boundary](#spec-v22-portal-opl-connection-boundary)
- [spec:v22-portal-opl-context-backflow-boundary](#spec-v22-portal-opl-context-backflow-boundary)
- [spec:v22-real-opl-capability-canary-boundary](#spec-v22-real-opl-capability-canary-boundary)
- [spec:v22-real-opl-provider-message-canary-boundary](#spec-v22-real-opl-provider-message-canary-boundary)
- [spec:v22-upstream-opl-boundary](#spec-v22-upstream-opl-boundary)
- [spec:v22-opl-work-message-file-run-boundary](#spec-v22-opl-work-message-file-run-boundary)
- [spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary](#spec-v22-runtime-bridge-session-run-file-provider-keyref-boundary)
- [spec:v22-portal-files-billing-trace-boundary](#spec-v22-portal-files-billing-trace-boundary)
- [spec:v22-token-provider-boundary](#spec-v22-token-provider-boundary)
- [spec:v22-trace-metadata-boundary](#spec-v22-trace-metadata-boundary)
- [spec:v22-langfuse-observability-metadata-boundary](#spec-v22-langfuse-observability-metadata-boundary)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)

规范路径为：

- `docs/active/README.md`
- `docs/active/README.md`
- `docs/delivery/README.md`
- `docs/delivery/README.md`
- `docs/delivery/README.md`

## Product Truth

产品真相：

```text
Portal is the SaaS control plane.
Gateway is the clean OPL WebUI entry/proxy.
Runtime Bridge is the anti-corruption layer for file intent, run intent, artifact backflow, gate errors, and Portal projection.
Runtime Bridge / Runtime Agent is the downstream canonical source for run, artifact, ledger, trace, and billing metadata.
云服务/COS 是真实账单与存储事实源。
Langfuse is an optional sanitized observability attachment.
one-person-lab upstream remains clean.
```

本合同只定义 canary 和后续 productionization handoff。真实 file/run/artifact 只有在可观测到对应事实时才能标记为成功：

- file 成功必须有 workspace-scoped `fileRef`。
- run 成功必须进入 Runtime Bridge / Runtime Agent boundary，并返回 `runId/status/traceId`。
- artifact 成功必须有 `artifactRef` 或 `outputFileRef` 回流 Portal。
- trace 成功必须是 sanitized Portal projection；Langfuse 只是可选附件。
- billing 成功只能表达 `billingMetadataRef`、`usageMetadataRef` 或 `resourceBindingId` 等可对账 metadata；不能声称真实 billing/cost 已闭环。

任何步骤没有真实证据时，必须返回明确 gate。不得使用 fake Product API、fixture Runtime Agent relay、placeholder 200、前端 DOM 变化或本地假 run 伪装真实成功。

## Primary Scope

本合同 Primary Scope 是：

```text
Portal launch
  -> Gateway clean OPL WebUI
  -> Runtime Bridge bootstrap/session bind
  -> real OPL file upload or file intent
  -> workspace-scoped fileRef
  -> run intent
  -> Runtime Bridge / Runtime Agent gate
  -> runId/status/traceId
  -> artifactRef or outputFileRef
  -> Portal projection by workspace/session/run
```

本合同覆盖：

- 复用已证明的 Portal launch、Gateway、clean OPL WebUI、session bind 和 provider message baseline。
- file upload 或 file intent 是否能形成 workspace-scoped `fileRef`。
- Runtime Bridge 是否能把真实 OPL/WebUI/ACP file shape 映射成稳定 file projection。
- run intent 是否进入 Runtime Bridge / Runtime Agent boundary。
- run 是否返回 `runId/status/traceId/billingMetadataRef/usageMetadataRef` 或明确 gate。
- artifact/output 是否形成 `artifactRef` 或 `outputFileRef`。
- Portal 是否能按 `workspaceId + workspaceSessionId + runId` 查询 file、run、artifact、trace 和 billing metadata reference。
- Langfuse / `trace.medopl.cn` 是否仅作为 sanitized observability attachment 处理。

## Non-goals

本合同不做以下事项：

- 不修改 one-person-lab upstream。
- 不 import upstream 内部模块。
- 不在 upstream 目录写 Portal、Gateway、Runtime Bridge、Runtime 或 Langfuse 代码。
- 不读取 raw API key、`.env`、kubeconfig、SecretId、SecretKey、SSH private key 或外部生产 token。
- 不调用真实云 mutation，不创建、删除、释放、扩缩容或改标签真实云资源。
- 不调用 COS mutation，不清空 bucket，不读取对象正文，不暴露 object key。
- 不 build/push/kubectl/live-test。
- 不修改 `deploy/*`、`.sentrux/*` 或 `adapters/*`。
- 不部署 Langfuse。
- 不部署 `trace.medopl.cn`、ClickHouse、DNS、TLS 或 Ingress。
- 不实现 COS 真实账单结算。
- 不把 `/api/opl/*` placeholder 当 Product API。
- 不把 Langfuse 当成 file、run、artifact、billing 或 Portal session 的 canonical source。
- 不把 fake Product API、本地 fake Runtime Agent relay、placeholder 200、fixture artifact 或 local-only output 当成真实 OPL file/run/artifact 成功证据。

## Authorization Boundary

默认授权只允许：

- 读取和修改 v22 active surface 中的合同、recovery 文档和 v22 smoke。
- 复用已经证明的真实 OPL WebUI session / provider message canary 事实。
- 启动或连接用户明确授权的本地真实 OPL WebUI canary 来源。
- 通过公开 HTTP/WebSocket/ACP/CLI 边界读取脱敏非 secret 元数据。
- 把 canary evidence 写入 `.runtime`。
- 在缺少 file、Runtime Agent、cloud、storage 或 Langfuse 授权时验证 gate。

需要用户单独授权后才能做：

- 读取或输入真实 provider raw API key。
- 使用真实 Runtime Agent endpoint。
- 使用真实云 runtime、腾讯云资源、COS、TKE、K8s 或 kubectl。
- 调用真实云 mutation 或 COS mutation。
- 部署 Langfuse 或 `trace.medopl.cn`。
- 读取 secret 文件、`.env`、kubeconfig、SecretId、SecretKey 或外部生产 token。
- 运行 build/push/kubectl/live-test。
- 修改 one-person-lab upstream、deploy、`.sentrux` 或 adapters。

## Canonical Identity Map

真实 file/run/artifact canary 必须固定以下 ID 归属：

| 字段 | Canonical owner | 说明 |
| --- | --- | --- |
| `tenantId` | Portal | 租户边界 |
| `portalUserId` | Portal | 用户边界 |
| `workspaceId` | Portal | workspace 边界 |
| `launchId` | Portal / Gateway | 一次进入 OPL 的 launch 关联，不进入 URL query |
| `workspaceSessionId` | Portal / Runtime Bridge | Portal workspace session projection |
| `runtimeSessionId` | Runtime Bridge | runtime session 归一化 ID |
| `resourceBindingId` | Portal / Runtime Bridge | 托管运行环境绑定 ID |
| `providerKeyRef` | Portal / Runtime Bridge secret boundary | provider 绑定引用，不是 raw API key |
| `oplSessionId` | OPL WebUI / ACP / Runtime Bridge | OPL session 归一化 ID |
| `oplConversationId` | OPL WebUI bridge | WebUI conversation ID |
| `fileRef` | Portal / Runtime Bridge | workspace-scoped file reference |
| `runId` | Runtime Bridge / Runtime Agent | run canonical ID |
| `traceId` | Runtime Bridge / Portal | sanitized trace metadata ID |
| `artifactRef` | Runtime Bridge / Runtime Agent | 输出 artifact public reference |
| `outputFileRef` | Portal / Runtime Bridge | 输出文件 public reference |
| `billingMetadataRef` | Runtime Bridge / Portal billing projection | 账单元数据引用，不是账单事实本身 |
| `usageMetadataRef` | Runtime Bridge / Portal billing projection | 用量元数据引用，不是云账单本身 |
| `ownerRef` | Package D / deploy lane | Kubernetes/deploy owner reference，不由 OPL lane 生成或解释 |
| `operationId` | Package D / cloud operation lane | 部署或云操作执行 ID，不由 OPL lane 生成或解释 |
| K8s labels | Package D / deploy lane | deploy owner labels，不由 OPL lane 生成或解释 |

`fileRef`、`runId`、`artifactRef`、`outputFileRef`、`traceId`、`billingMetadataRef` 和 `usageMetadataRef` 必须绑定同一组 `tenantId + portalUserId + workspaceId + workspaceSessionId + runtimeSessionId`。run 与 artifact 还必须绑定 `resourceBindingId`。无法绑定时返回 `runtime_bridge_mapping_failed`。

## Step Gates

每个 step 必须有 gate。gate 的作用不是兜底，而是把真实状态裁定清楚，避免 HTTP 200 假成功。

通用 gate：

- `capability_not_supported`: 真实 upstream、WebUI bridge、ACP runtime 或 Runtime Agent 未提供该能力。
- `runtime_bridge_mapping_failed`: 真实返回 shape 变化、ID 绑定缺失或 projection 无法归一化。
- `upstream_unavailable`: 真实 OPL WebUI/ACP/API/CLI 来源不可达。
- `deferred_authorization`: 能力需要用户、运维或真实外部系统单独授权。
- `managed_environment_required`: 需要已开通托管运行环境。
- `requires_runtime_agent`: 需要 Runtime Agent 才能完成。
- `runtime_authorization_required`: 需要真实 Runtime Agent endpoint 或真实云 runtime 授权。
- `trace_sink_not_configured`: trace sink 或 Langfuse attachment 未配置。

业务 gate：

- `file_upload_capability_not_supported`
- `file_ref_not_observed`
- `workspace_file_scope_missing`
- `storage_authorization_required`
- `run_not_observed`
- `artifact_not_observed`
- `output_file_ref_not_observed`
- `portal_projection_missing`

no fake 200 规则：

- 同步失败必须返回失败 HTTP status 和明确 `error`。
- 异步 accepted 可以返回 202，但 response 必须包含 `status=queued|running`、`runId` 或后续查询 ID/URL。
- `queued`、`running`、`gated` 或 `unsupported` 不得伪装成 `succeeded`。
- Runtime Bridge 不得生成伪 `fileRef`、伪 `runId`、伪 `artifactRef`、伪 `outputFileRef`、伪 `billingMetadataRef` 或伪 `usageMetadataRef`。

## File Upload Gate

file upload gate 的目标是证明真实 OPL file upload 或 file intent 是否能形成 workspace-scoped `fileRef`。

成功必须返回：

- `fileRef`
- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `source`
- `status`
- sanitized file metadata，例如 file name、size、content type、hash reference

失败必须返回：

- upstream 不支持文件上传时返回 `file_upload_capability_not_supported` 或 `capability_not_supported`。
- 已提交文件 intent 但未观测到 `fileRef` 时返回 `file_ref_not_observed`。
- `fileRef` 未绑定 workspace/session 时返回 `workspace_file_scope_missing`。
- 需要存储授权时返回 `storage_authorization_required`。
- 需要 Runtime Agent 时返回 `requires_runtime_agent`。
- 需要外部授权时返回 `deferred_authorization`。

公开 response 禁止包含 `objectKey`、`storageKey`、`localPath`、`signedUrl`、`presignedUrl`、内部 bucket/path 或对象正文。

## Run Gate

run gate 的目标是证明 run intent 是否进入真实 Runtime Bridge / Runtime Agent boundary。

成功必须返回：

- `runId`
- `status=queued|running|succeeded|failed`
- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `resourceBindingId`
- `providerKeyRef`
- `traceId`
- `billingMetadataRef` 或 `usageMetadataRef`
- sanitized runtime metadata

失败必须返回：

- 未开通托管运行环境时返回 `managed_environment_required`。
- 未配置 Runtime Agent 时返回 `requires_runtime_agent`。
- 需要真实 runtime 授权时返回 `runtime_authorization_required`。
- intent 未进入 Runtime Agent boundary 时返回 `run_not_observed`。
- upstream 不可达时返回 `upstream_unavailable`。
- 映射失败时返回 `runtime_bridge_mapping_failed`。

本合同默认不调用真实云 runtime。真实云 runtime、真实 Runtime Agent endpoint、真实计算/存储资源和真实部署必须单独授权。

## Artifact Output Gate

artifact output gate 的目标是证明 run 输出能形成 Portal 可查询的 public reference。

成功必须返回：

- `artifactRef` 或 `outputFileRef`
- `runId`
- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `resourceBindingId`
- `status`
- sanitized artifact metadata

失败必须返回：

- run 已完成但未观测到 artifact 时返回 `artifact_not_observed`。
- output file reference 未观测到时返回 `output_file_ref_not_observed`。
- output 未绑定 workspace/session/run 时返回 `runtime_bridge_mapping_failed`。
- 需要 Runtime Agent 时返回 `requires_runtime_agent`。
- 需要真实 runtime 授权时返回 `runtime_authorization_required`。

公开 response 禁止包含 `objectKey`、`storageKey`、`localPath`、`signedUrl`、`presignedUrl`、runtime 私有路径、storage secret 或对象正文。

## Trace Projection Gate

trace projection gate 的目标是证明 session/file/run/artifact metadata 能形成 sanitized Portal projection。

成功必须返回：

- `traceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `runId` 或 `fileRef`
- `status`
- `latencyMs`
- sanitized event names
- sanitized usage summary reference

Langfuse 未配置时必须返回 `trace_sink_not_configured` 或 `deferred_authorization`，不得影响 file、run、artifact 的独立业务 gate。

## Portal Projection Gate

Portal projection gate 的目标是证明 Portal 能按 workspace/session/run 查询状态、文件、trace 和 billing metadata。

Portal 只能通过稳定 `/api/opl/*` 或已定义 Portal API 查询 Runtime Bridge projection。Portal 禁止直接依赖：

- one-person-lab route。
- WebSocket event shape。
- DOM。
- frontend store。
- upstream database schema。
- upstream internal session model。

成功必须覆盖：

- fileRef status。
- run status。
- artifact/output reference。
- trace metadata。
- billing metadata reference。
- workspace/session/run 归属。

若 Runtime Bridge 已观测到 file/run/artifact 但 Portal 不能按 `workspaceId + workspaceSessionId + runId` 查询，必须返回 `portal_projection_missing`，不得只把 Runtime Bridge 内部状态当成用户闭环。

## Billing Metadata Boundary

云服务/COS 是真实账单与存储事实源。OPL file/run/artifact 分支只负责把 runtime 侧可对账元数据安全传回 Portal。

OPL 分支只传 `billingMetadataRef`、`usageMetadataRef` 或 `resourceBindingId`。允许的 public metadata 包括：

- resource binding reference。
- usage summary reference。
- billing metadata reference。
- run duration summary。
- storage/file size summary。
- cost allocation tag reference。

禁止：

- 声称真实 billing/cost 已闭环。
- 声称 COS 账单已核对。
- 返回云账号、bucket 私有路径、object key、signed URL、SecretId、SecretKey 或 token。
- 用本地估算替代云账单事实。

真实 COS 账单、云账单、T+1 对账、冻结/扣费和成本核对由云服务链路负责，不由本 OPL 适配分支伪造。

## Production Runtime Agent Binding

Production Runtime Agent binding 是 OPL lane 对 Package D 和云服务 lane 的上游输入，不是 deploy 实现。OPL lane 只产出运行身份与 run/artifact projection：

- workspace identity: `workspaceId`、`workspaceSessionId`、`runtimeSessionId`。
- runtime identity: `resourceBindingId`、`providerKeyRef`、Runtime Agent endpoint binding status。
- file projection: workspace-scoped `fileRef`。
- run projection: `runId`、`status`、`traceId`、`billingMetadataRef`、`usageMetadataRef`。
- artifact projection: `artifactRef` 或 `outputFileRef`。

`resourceBindingId/workspace runtime identity` 是 OPL lane 交给下游 lane 的唯一资源绑定上下文。OPL lane 不提供 `ownerRef`、`operationId` 或 K8s labels，不决定 namespace、workload、container、rollout、digest verify、owner labels 或 rollback evidence。这些属于 Package D / deploy lane 和云服务 lane 的合同。

Production Runtime Agent binding 允许 config-only / fake Runtime Agent endpoint binding 来验证公开 HTTP API relay；默认不读取 secret、不调用真实云、不 build/push/deploy、不 kubectl、不修改 one-person-lab upstream。未配置 Runtime Agent endpoint 时必须返回 `requires_runtime_agent`。Runtime Agent 未返回 artifact 时必须返回 `artifact_not_observed` 或 `output_file_ref_not_observed`。Runtime Bridge 不得伪造 `fileRef`、`runId`、`artifactRef`、`outputFileRef`、`billingMetadataRef` 或 `usageMetadataRef`。

## Current Productionization Boundary Status

- productionization_status: contract_refresh_only
- absorbed_local_canary: runtime_agent_http_api_full_loop
- absorbed_local_canary: webui_file_run_artifact_no_fake_success_gate
- absorbed_authorized_canary: provider_message_reply_only
- production_truth_blocked_until: stable Runtime Agent endpoint binding
- production_truth_blocked_until: authorized cloud runtime lane
- production_truth_blocked_until: COS billing reconciliation lane
- production_truth_blocked_until: authorized Langfuse attachment lane
- OPL production branch may consume only `resourceBindingId`, `billingMetadataRef`, `usageMetadataRef`, `fileRef`, `runId`, `artifactRef`, and `outputFileRef`
- OPL production branch must not emit `ownerRef`, `operationId`, K8s labels, deploy owner labels, raw provider key, launchToken, runtimeToken, objectKey, storageKey, localPath, signedUrl, or presignedUrl

当前 refresh 只把已吸收 canary facts 分流给后续 production branch。`runtime_agent_http_api_full_loop` 证明的是本地独立 Runtime Agent HTTP API relay shape；`webui_file_run_artifact_no_fake_success_gate` 证明未验证 file/run/artifact 不会伪成功；`provider_message_reply_only` 只证明授权 message/reply。它们都不是真实云 runtime、COS 账单、Langfuse 或 deploy evidence。

## Langfuse Attachment Boundary

Langfuse is an optional sanitized observability attachment。`trace.medopl.cn` 是后续 Langfuse admin/ops console 目标域，不是本合同默认部署目标。

允许发送到 Langfuse 的内容只包括 sanitized metadata：

- `tenantId` / `workspaceId` / session/run/message/file public reference。
- status。
- gate code。
- latency metadata。
- capability source。
- usage metadata reference。

禁止发送：

- raw API key。
- bearer token。
- raw prompt。
- raw completion。
- object key。
- signed URL。
- local path。
- upstream database row。
- secret file path。

Langfuse 未部署时，Portal session trace 仍以 Portal canonical projection 为准。

## Canary Evidence Boundary

canary evidence 只允许写入 `.runtime`，不得进入 git。evidence 允许包含：

- canary command 名称和脱敏 exit status。
- capability registry snapshot。
- sanitized endpoint path。
- sanitized WebSocket event type。
- sanitized timing metadata。
- sanitized gate code。
- sanitized file/run/artifact public reference。

evidence 禁止包含：

- raw prompt。
- raw completion。
- raw API key。
- bearer token。
- `launchToken`。
- `runtimeToken`。
- `objectKey`。
- `storageKey`。
- `localPath`。
- `signedUrl`。
- `presignedUrl`。
- kubeconfig、SecretId、SecretKey、SSH private key 或 `.env` 内容。

## Productionization Handoff

canary 发现的事实必须回写合同、status 和 validation path。后续 production implementation 只能基于已验证事实推进：

- 真实 fileRef 已观测到，才能实现 productionized file projection。
- 真实 Runtime Agent run 已观测到，才能实现 productionized run relay。
- 真实 artifact/output 已观测到，才能实现 productionized artifact projection。
- 真实 Langfuse 或 `trace.medopl.cn` 已授权部署后，才能实现 productionized observability attachment。
- 真实云账单/COS 账单已进入云服务合同后，才能把 billing metadata ref 接到真实账单核对。

未验证能力必须保留 gate，不得转成隐式成功。

## Absorption Gate

本合同对应分支进入 B 窗口前必须满足：

1. 明确声明订阅本合同包和模型记录。当前开发分支为 `feat/v22-real-opl-file-run-artifact-canary`，模型记录为 `gpt-5.3-codex`。
2. `node tests/regression/opl/regression-test-v22-real-opl-file-run-artifact-contract-gate.mjs` 通过。
3. Runtime Agent HTTP API proof 已证明 Portal -> Gateway -> Runtime Bridge -> Runtime Agent HTTP API -> workspace-scoped `fileRef` -> `runId/status/traceId` -> `artifactRef` / `outputFileRef` -> Portal workspace/session/run trace projection 的本地 proof 闭环；该 proof 不进入默认 MVP suite，也不是 production deploy evidence。
4. `node tests/regression/opl/regression-test-v22-real-opl-file-run-artifact-gates.mjs` 通过，证明 `OPL_RUNTIME_MODE=webui` 且未配置 Runtime Agent API 时 file/run/artifact 不会伪成功：file 返回 `file_upload_capability_not_supported`，run 返回 queryable `requires_runtime_agent` gated run，artifact 返回 `artifact_not_observed` / `output_file_ref_not_observed`。该 smoke 只是负向保护，不满足完整闭环吸收标准。
5. Runtime Agent API relay full-loop smoke 必须证明 Runtime Agent canary server 实际收到 file upload/intake 和 run dispatch HTTP 请求；Runtime Bridge/Portal public response、Portal trace、canary evidence 和 git 不包含 raw API key、bearer token、`launchToken`、`runtimeToken`、`objectKey`、`storageKey`、`localPath`、`signedUrl` 或 `presignedUrl`。
6. `node tests/regression/opl/regression-test-v22-real-opl-capability-contract-gate.mjs` 通过。
7. `node tests/regression/opl/regression-test-v22-real-opl-provider-message-contract-gate.mjs` 通过。
8. `node tests/contract/contract-test-v22-mvp-contract-suite.mjs` 通过，或明确记录未运行原因。
9. file/run/artifact/trace/billing metadata 未完成 Runtime Agent API full-loop canary 时，不可吸收；真实云 runtime、COS 账单、Langfuse / `trace.medopl.cn` 未完成时，必须在状态矩阵标记为未上线或需单独授权。
10. 没有修改 one-person-lab upstream。
11. 没有读取 secret，没有调用真实云，没有 build/push/kubectl/live-test，没有修改 deploy、`.sentrux` 或 adapters。
12. `git diff --check -- docs/specs docs tests scripts services/opl-runtime-bridge services/portal` 通过。
13. secret/path scan 不发现 raw key、token、本机 secret path、object key、signed URL 或 `.env` 内容。

### spec:v22-real-opl-provider-message-canary-boundary

Former leaf id: `v22-real-opl-provider-message-canary-boundary`
Former title: v22 Real OPL Provider Message Canary Boundary Contract

本合同定义 MedOPL v22 中真实 OPL provider message reply canary 的边界。它只回答一件事：

```text
Portal 已能进入 clean OPL WebUI 并绑定 session 后，如何验证一条真实 message 是否进入 OPL/agent/provider 边界、是否产生 assistant reply，并以可查询状态和 session trace 回流 Portal。
```

本合同是 [spec:v22-real-opl-capability-canary-boundary](#spec-v22-real-opl-capability-canary-boundary) 的 message reply 细分合同，不替代一级主合同、二级 Portal-OPL 连接合同或三级真实 OPL capability canary 合同。

## Contract Level

合同分级如下：

- Level 1: [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop)。一级主合同，定义 MedOPL 托管 OPL SaaS 用户主闭环。
- Level 2: [spec:v22-portal-opl-connection-boundary](#spec-v22-portal-opl-connection-boundary)、[spec:v22-upstream-opl-boundary](#spec-v22-upstream-opl-boundary) 和 [spec:v22-opl-work-message-file-run-boundary](#spec-v22-opl-work-message-file-run-boundary)。二级段合同，定义 Portal-OPL 连接、clean upstream 和 OPL 工作流业务边界。
- Level 3: [spec:v22-portal-opl-context-backflow-boundary](#spec-v22-portal-opl-context-backflow-boundary) 和 [spec:v22-real-opl-capability-canary-boundary](#spec-v22-real-opl-capability-canary-boundary)。三级执行合同，定义 Portal-OPL context/backflow 骨架和真实 OPL capability canary 总链路。
- Level 4: 本合同。Real OPL provider message canary execution contract，细化 provider key gate、真实 message send、reply observation、Runtime Bridge normalization、Portal projection、session trace、Langfuse attachment boundary、错误 gate 和吸收标准。

本合同是四级细分执行合同。它只能向上服从一级、二级、三级合同，不能扩大授权或把未验证能力标记为已上线。

## Subscription Package

本合同订阅以下合同包：

- [spec:v22-mvp-managed-opl-loop](#spec-v22-mvp-managed-opl-loop)
- [spec:v22-portal-opl-connection-boundary](#spec-v22-portal-opl-connection-boundary)
- [spec:v22-portal-opl-context-backflow-boundary](#spec-v22-portal-opl-context-backflow-boundary)
- [spec:v22-real-opl-capability-canary-boundary](#spec-v22-real-opl-capability-canary-boundary)
- [spec:v22-upstream-opl-boundary](#spec-v22-upstream-opl-boundary)
- [spec:v22-opl-work-message-file-run-boundary](#spec-v22-opl-work-message-file-run-boundary)
- [spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary](#spec-v22-runtime-bridge-session-run-file-provider-keyref-boundary)
- [spec:v22-portal-files-billing-trace-boundary](#spec-v22-portal-files-billing-trace-boundary)
- [spec:v22-token-provider-boundary](#spec-v22-token-provider-boundary)
- [spec:v22-trace-metadata-boundary](#spec-v22-trace-metadata-boundary)
- [spec:v22-langfuse-observability-metadata-boundary](#spec-v22-langfuse-observability-metadata-boundary)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)
- [../history/README.md](../history/README.md)

规范路径为：

- `docs/active/README.md`
- `docs/active/README.md`
- `docs/delivery/README.md`
- `docs/delivery/README.md`
- `docs/delivery/README.md`

## Product Truth

产品真相：

```text
Portal is the SaaS control plane.
Gateway is the clean OPL WebUI entry/proxy.
Runtime Bridge is the anti-corruption layer for message intent, provider/reply evidence, normalized status, and Portal projection.
Runtime Bridge / Runtime Agent remains the downstream canonical source for run, artifact, ledger, trace, and billing metadata.
Langfuse is an optional sanitized observability attachment.
one-person-lab upstream remains clean.
```

真实 provider message canary 只证明 message/reply 这一段。它不证明 file、run、artifact、真实云 runtime、生产部署或 Langfuse 已上线。

历史授权 live canary 脱敏 evidence：

- 在当次用户授权 `REAL_OPL_PROVIDER_MESSAGE_CANARY=1`、`OPL_PROVIDER_SECRET_FILE` 和 `OPL_REAL_WEBUI_DIR` 后，Portal -> Gateway -> Runtime Bridge -> clean OPL WebUI bridge -> gflab provider message 链路曾观测到真实 assistant reply。
- 当次 message reply capability 状态为 `mapped_to_webui_bridge`。
- Portal message status 和 Portal session trace 已能回流同一组 `messageId`、`replyMessageId`、`messageTraceId`、`providerInvocationRef` 和 `capabilitySource=mapped_to_webui_bridge`。
- 脱敏 evidence 只写 `.runtime/real-opl-provider-message-live-canary/evidence.json`，不得进入 git。
- 该事实仍不代表真实 file upload、workspace-scoped fileRef、run、artifact/output、真实云 runtime、生产部署或 Langfuse 已上线。

一条 message 只有满足以下条件，才能标记为真实 reply 闭环：

- message intent 绑定同一个 `tenantId + portalUserId + workspaceId + workspaceSessionId + runtimeSessionId`。
- message intent 进入真实 OPL WebUI bridge、ACP runtime 或公开 provider/agent 边界。
- canary 观测到 provider invocation evidence 或明确 gate。
- canary 观测到同一 conversation/message 的 assistant reply，或明确 timeout/not-supported gate。
- Runtime Bridge 生成稳定 `messageId/status/replyMessageId/messageTraceId`。
- Portal 可以通过 `/api/opl/messages/{messageId}/status` 和 `/api/session-traces` 查询。

任何无法证明真实 provider/reply 的情况，必须返回明确 gate，不得使用 fake Product API、fixture reply、placeholder 200 或本地假 message 当成真实 provider 成功。

## Primary Scope

本合同 Primary Scope 是：

```text
Portal launch
  -> Gateway clean OPL WebUI
  -> Runtime Bridge bootstrap/session bind
  -> real OPL session/conversation
  -> provider key gate
  -> message intent
  -> real OPL/agent/provider boundary
  -> assistant reply observation
  -> Runtime Bridge normalized message state
  -> Portal message status
  -> Portal session trace
```

本合同覆盖：

- provider readiness discovery，但默认不读取 raw provider key。
- `providerKeyRef` 绑定状态检查。
- message request identity map。
- OPL WebUI bridge / ACP runtime / provider boundary 观测点。
- assistant reply 与 `clientMessageId`、`oplConversationId`、`messageId` 的关联。
- Runtime Bridge message state normalization。
- Portal message status projection。
- Portal canonical session trace projection。
- Langfuse sanitized attachment 的边界。
- 不支持、缺 provider、缺授权、upstream 不可达、reply timeout、映射失败时的明确 gate。

## Non-goals

本合同不做以下事项：

- 不修改 one-person-lab upstream。
- 不 import upstream 内部模块。
- 不在 upstream 目录写 Portal、Gateway、Runtime Bridge、Runtime 或 Langfuse 代码。
- 不读取 raw API key、`.env`、kubeconfig、SecretId、SecretKey、SSH private key 或外部生产 token。
- 不把 raw provider key 写入 sessionStorage、localStorage、全局 JS state、日志、evidence 或 git。
- 不调用真实腾讯云、COS、TKE、K8s 或真实云 runtime。
- 不 build/push/kubectl/live-test。
- 不修改 `deploy/*`、`.sentrux/*` 或 `adapters/*`。
- 不部署 `trace.medopl.cn`。
- 不部署 Langfuse、ClickHouse、DNS、TLS 或 Ingress。
- 不证明 file upload、workspace-scoped fileRef、run、artifact/output、billing truth 或真实 Runtime Agent 已上线。
- 不把 fake Product API、本地 fake Runtime Agent relay、placeholder 200、fixture reply 或前端 DOM 变化当成真实 provider reply 证据。

## Authorization Boundary

默认授权只允许：

- 读取 v22 active surface。
- 更新合同、recovery 文档和 v22 smoke。
- 启动或连接用户明确授权的本地真实 OPL WebUI canary 来源。
- 通过公开 HTTP/WebSocket/ACP/CLI 边界读取脱敏非 secret 元数据。
- 把 canary evidence 写入 `.runtime`。
- 在缺少 provider key 或真实授权时验证 gate，而不是触发真实模型调用。

需要用户单独授权后才能做：

- 读取或输入真实 provider raw API key。
- 使用真实 `providerKeyRef` 触发模型调用。
- 调用真实外部 provider、真实 OPL provider、真实云 runtime 或真实 Runtime Agent endpoint。
- 读取 secret 文件、`.env`、kubeconfig、SecretId、SecretKey 或外部生产 token。
- 部署 Langfuse 或 `trace.medopl.cn`。
- 运行 build/push/kubectl/live-test。
- 修改 one-person-lab upstream、deploy、`.sentrux` 或 adapters。

## Provider Key Boundary

provider key 的 canonical 形态是 `providerKeyRef`。它是后端密钥边界中的引用，不是 raw API key。

允许出现在 public response、Portal projection 和 evidence 中的 provider 字段：

- `providerBound`
- `providerKeyRef`
- `providerStatus`
- `providerInvocationRef`
- `providerModelRef`
- `providerAuthorizationStatus`

禁止出现：

- raw API key。
- bearer token。
- provider request authorization header。
- raw prompt。
- raw completion。
- launchToken。
- runtimeToken。
- secret store path。
- `.env` 内容。

没有 `providerKeyRef` 时，message canary 必须返回 `provider_key_required`。有 `providerKeyRef` 但未授权真实调用时，必须返回 `provider_authorization_required` 或 `deferred_authorization`。不得因为有 `providerKeyRef` 就伪造 provider invocation。

## Canonical Message Identity Map

真实 provider message canary 必须固定以下 ID 归属：

| 字段 | Canonical owner | 说明 |
| --- | --- | --- |
| `tenantId` | Portal | 租户边界 |
| `portalUserId` | Portal | 用户边界 |
| `workspaceId` | Portal | workspace 边界 |
| `launchId` | Portal / Gateway | 一次进入 OPL 的 launch 关联，不进入 URL query |
| `workspaceSessionId` | Portal / Runtime Bridge | Portal workspace session projection |
| `runtimeSessionId` | Runtime Bridge | runtime session 归一化 ID |
| `resourceBindingId` | Portal / Runtime Bridge | 托管运行环境绑定 ID，可为空但必须显式表达 |
| `providerKeyRef` | Portal / Runtime Bridge secret boundary | provider 绑定引用 |
| `oplSessionId` | OPL WebUI / ACP / Runtime Bridge | OPL session 归一化 ID |
| `oplConversationId` | OPL WebUI bridge | WebUI conversation ID |
| `clientMessageId` | Portal / OPL client | 幂等 message intent ID |
| `messageId` | Runtime Bridge | Runtime Bridge message projection ID |
| `replyMessageId` | OPL / Runtime Bridge | assistant reply projection ID |
| `traceId` | Runtime Bridge | sanitized trace metadata ID |
| `messageTraceId` | Runtime Bridge / Portal trace | message 级 trace projection ID |
| `providerInvocationRef` | Runtime Bridge / provider boundary | 脱敏 provider invocation evidence reference |

`messageId`、`replyMessageId`、`messageTraceId` 和 `providerInvocationRef` 必须绑定同一组 `tenantId + portalUserId + workspaceId + workspaceSessionId + runtimeSessionId + oplConversationId + clientMessageId`。无法绑定时返回 `runtime_bridge_mapping_failed`。

## Message Send Contract

message send canary 的入口必须是稳定 Runtime Bridge/Portal projection，而不是 Portal 直接依赖 upstream 内部 route、DOM、frontend store 或 database schema。

请求必须携带或可从 launch/session 绑定中解析：

- `tenantId`
- `portalUserId`
- `workspaceId`
- `launchId`
- `workspaceSessionId`
- `runtimeSessionId`
- `oplSessionId` 或 `oplConversationId`
- `clientMessageId`
- `providerKeyRef`

请求可以包含 prompt intent，但 raw prompt 不得写入公开 response、日志、evidence 或 git。canary evidence 只能记录脱敏 prompt metadata，例如 length、hash prefix、content type、message role 和 timing。

成功的 send accepted response 必须包含：

- `messageId`
- `status=queued|running|succeeded`
- `clientMessageId`
- `oplConversationId` 或 `oplSessionId`
- `statusUrl`
- `providerKeyRef`
- `messageTraceId` 或 pending trace reference

如果使用 202 表达异步 accepted，必须返回后续查询 ID/URL，且不能把 `queued` 或 `running` 伪装成 `succeeded`。

## Reply Observation Contract

reply observation 必须证明以下至少一种真实来源：

- OPL WebUI bridge 观测到同一 `oplConversationId` 的 assistant reply event。
- ACP runtime 观测到同一 `clientMessageId` 或 conversation 的 assistant reply。
- 公开 provider/agent boundary 返回脱敏 invocation evidence，并可映射到 assistant reply。

成功返回必须包含：

- `messageId`
- `status=succeeded`
- `replyMessageId`
- `clientMessageId`
- `oplConversationId` 或 `oplSessionId`
- `providerInvocationRef`
- `messageTraceId`
- sanitized reply metadata，例如 role、token usage summary、latencyMs、modelRef、finish status

reply metadata 禁止包含 raw completion。若只能看到 provider invocation 但没有 reply，必须返回 `provider_invocation_not_observed` 或 `upstream_reply_timeout`，不能标记为 `succeeded`。

## Runtime Bridge Normalization Contract

Runtime Bridge 必须把 upstream/WebUI/ACP/provider 的 shape 归一化成稳定 message state。Portal 不得依赖真实 upstream shape。

稳定 message state 至少包含：

- `messageId`
- `status`
- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `oplSessionId`
- `oplConversationId`
- `clientMessageId`
- `replyMessageId`
- `providerKeyRef`
- `providerInvocationRef`
- `messageTraceId`
- `capabilitySource`
- `error` 或 `gate`
- `createdAt`
- `updatedAt`

`capabilitySource` 允许值：

- `mapped_to_webui_bridge`
- `mapped_to_acp_runtime`
- `supported_provider_boundary`

如果 upstream shape 变化导致无法稳定映射，必须返回 `runtime_bridge_mapping_failed`，并只记录脱敏 shape summary，不记录 raw payload。

## Portal Projection And Session Trace

Portal projection 必须通过以下稳定入口查询：

- `POST /api/opl/messages`
- `GET /api/opl/messages/{messageId}/status`
- `GET /api/session-traces?workspaceId=...&sessionId=...`
- `GET /api/session-traces?workspaceId=...&messageId=...`
- `GET /api/session-traces/{traceId}`

Portal message status 必须能表达：

- accepted/queued。
- running。
- succeeded with `replyMessageId`。
- failed/gated with explicit error code。
- timing metadata。
- `messageTraceId`。

Portal session trace 必须能按 workspace/session/message 查询到：

- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `oplSessionId` 或 `oplConversationId`
- `messageId`
- `replyMessageId`
- `providerKeyRef`
- `providerInvocationRef`
- `messageTraceId`
- status。
- sanitized latency/usage/cost metadata。

Portal session trace 是 MedOPL canonical projection。Langfuse 不是 Portal、billing、message、file、run 或 artifact 的 canonical source。

## Langfuse Attachment Boundary

Langfuse is an optional sanitized observability attachment。

当 Langfuse 或 `trace.medopl.cn` 未部署、未配置或未授权时，message canary 必须仍然能返回 Portal canonical session trace，或返回 `trace_sink_not_configured` 表示外部 trace sink 不可用。不得因为 Langfuse 未部署而伪造 message 成功或失败。

允许发送到 Langfuse 的字段仅限脱敏 metadata：

- `tenantId`
- `workspaceId`
- `workspaceSessionId`
- `messageId`
- `replyMessageId`
- `providerKeyRef`
- `providerInvocationRef`
- `messageTraceId`
- status。
- latency。
- usage summary。
- cost estimate。
- capability source。
- sanitized tags。

禁止发送 raw prompt、raw completion、raw API key、bearer token、launchToken、runtimeToken、objectKey、storageKey、localPath、signedUrl、presignedUrl、secret path 或 `.env` 内容。

## Authorized Provider Message Boundary

默认合同 smoke 只验证合同、gate 和本地 projection，不读取 secret、不调用真实 provider。历史授权 provider message live evidence 只作为 `.runtime/real-opl-provider-message-live-canary/evidence.json` 脱敏记录存在；对应 live runner 已退出 active repo executable surface。后续真实 provider message reply canary 必须重新开 future-authorized boundary，不能从默认 suite、合同 gate 或 README 直接运行历史 runner。

授权变量含义：

- `REAL_OPL_PROVIDER_MESSAGE_CANARY=1`: 允许本次 canary 读取指定 provider secret，并触发真实 OPL/WebUI/provider message 调用。
- `OPL_PROVIDER_SECRET_FILE`: 只允许读取用户明确授权的 provider secret 文件。脚本只能解析 allowlist key，不能打印路径内容或 raw key。
- `OPL_REAL_WEBUI_DIR`: 启动本地真实 OPL WebUI dist-server 来源。
- `OPL_REAL_WEBUI_URL`: 使用已启动的真实 OPL WebUI URL；与 `OPL_REAL_WEBUI_DIR` 二选一。

live canary 必须走真实 Portal -> Gateway -> Runtime Bridge -> WebUI bridge 路径：

```text
Portal /api/opl/launch
  -> Portal backend secret store writes raw key and exposes providerKeyRef only
  -> Gateway opens clean WebUI
  -> Runtime Bridge creates/binds OPL conversation
  -> POST /api/opl/messages
  -> Runtime Bridge maps to WebUI bridge chat.send.message
  -> Runtime Bridge observes assistant reply by same conversation readback/event
  -> GET /api/opl/messages/{messageId}/status
  -> GET /api/session-traces?workspaceId=...&messageId=...
```

live canary success evidence 必须包含 `messageId`、`replyMessageId`、`messageTraceId`、`providerInvocationRef`、`capabilitySource=mapped_to_webui_bridge` 和 Portal session trace projection。evidence 只写 `.runtime/real-opl-provider-message-live-canary/evidence.json`，只允许记录 key fingerprint、prompt/reply 长度、hash prefix、ID、状态和 timing metadata。

live canary 不进入默认 `tests/contract/contract-test-v22-mvp-contract-suite.mjs`，因为它需要真实 provider key、真实 provider 调用授权和真实 WebUI canary 来源。

历史授权 live canary 脱敏结果：

```json
{
  "status": "succeeded",
  "capabilitySource": "mapped_to_webui_bridge",
  "replyLength": 25,
  "streamEventCount": 16
}
```

## Error Gates And No-Fake-Success

本合同禁止 fake success。以下情况必须返回明确 gate，不得返回 200 假成功；本合同的验收关键词是 no fake 200：

- `provider_key_required`: 没有 `providerKeyRef`。
- `provider_authorization_required`: 有 provider binding，但本次真实调用未授权。
- `provider_invocation_not_observed`: message intent 已进入 OPL 侧候选路径，但没有可证明的 provider invocation。
- `upstream_unavailable`: 真实 OPL WebUI/ACP/provider 边界不可达。
- `upstream_reply_timeout`: message 已进入上游边界，但未在预算时间内观测到 assistant reply。
- `runtime_bridge_mapping_failed`: upstream shape 变化或 ID 绑定不完整，无法生成稳定 projection。
- `capability_not_supported`: 当前真实 upstream 不支持或未验证 message reply。
- `trace_sink_not_configured`: Langfuse 或外部 trace sink 未配置。
- `deferred_authorization`: 需要用户或运维单独授权。

HTTP status 必须表达业务失败类别。若因异步处理返回 202，response 必须包含 `status=queued|running`、`messageId` 和 status URL；不得把 pending 状态写成 succeeded。

公开 response、日志、evidence 和 git 都不得包含 raw prompt、raw completion、raw API key、bearer token、launchToken、runtimeToken、sessionStorage、localStorage 或 secret 内容。

## Canary Evidence Boundary

canary evidence 只允许写入 `.runtime`，不得进入 git。

允许记录：

- sanitized command name。
- upstream version / commit / package metadata。
- capability source。
- sanitized endpoint path。
- sanitized WebSocket event type。
- `messageId`、`clientMessageId`、`replyMessageId`、`messageTraceId`。
- `providerInvocationRef`。
- timing metadata。
- status/error code。
- prompt length/hash prefix。
- reply length/hash prefix。

禁止记录：

- raw prompt。
- raw completion。
- raw API key。
- bearer token。
- provider authorization header。
- launchToken。
- runtimeToken。
- sessionStorage dump。
- localStorage dump。
- objectKey。
- storageKey。
- localPath。
- signedUrl。
- presignedUrl。
- `.env`、SecretId、SecretKey、kubeconfig 或 SSH private key。

## Productionization Handoff

canary 成功不自动等于 productionized Runtime Bridge。进入正式实现前必须：

1. 把真实 provider message reply 发现回写本合同、[spec:v22-real-opl-capability-canary-boundary](#spec-v22-real-opl-capability-canary-boundary)、[status-matrix.md](../history/README.md) 和 [mvp-contract-acceptance.md](../history/README.md)。
2. 明确 message reply capability 状态：`supported`、`mapped_to_webui_bridge`、`mapped_to_acp_runtime`、`supported_provider_boundary`、`provider_key_required`、`provider_authorization_required`、`deferred_authorization` 或 `capability_not_supported`。
3. 把 canary-only evidence、临时脚本输出和 `.runtime` 数据留在本地，不进入 git。
4. 如需 productionized Runtime Bridge 映射，另开实现分支，补正式 smoke，不依赖 `.runtime` 临时 evidence。
5. 如需真实 provider key、真实 Runtime Agent、真实云 runtime 或 Langfuse 部署，另行取得用户授权。

## Absorption Gate

本合同对应分支进入 B 窗口前必须满足：

1. 明确声明订阅本合同包和模型记录。当前 lane 分支名为 `feat/v22-real-opl-provider-message-canary-contract`，模型记录为 `gpt-5.4`。
2. `node tests/regression/opl/regression-test-v22-real-opl-provider-message-contract-gate.mjs` 通过。
3. `node tests/regression/opl/regression-test-v22-real-opl-capability-contract-gate.mjs` 通过。
4. `node tests/smoke/smoke-test-v22-portal-opl-connection-contract.mjs` 通过。
5. `node tests/contract/contract-test-v22-mvp-contract-suite.mjs` 通过，或明确记录未运行原因。
6. 合同索引、阶段状态和验证链路已更新。
7. 默认合同 smoke 未使用 raw provider key，未调用真实 provider，未读取 secret，未调用真实云；授权 live canary 必须明确记录 `REAL_OPL_PROVIDER_MESSAGE_CANARY=1` 和脱敏 evidence path。
8. 未修改 one-person-lab upstream、deploy、`.sentrux` 或 adapters。
9. `git diff --check -- docs/specs docs tests scripts` 通过。

### spec:v22-release-stop-billing-audit-boundary

Former leaf id: `v22-release-stop-billing-audit-boundary`
Former title: v22 Release Stop Billing Audit Boundary Contract

本合同定义 MedOPL v22 MVP 闭环最后一段：用户停止使用 / 释放托管运行环境后，停止扣费，进入 120min 停止计费确认，并在 T+1 进入审计状态。

## Product Boundary

用户主叙事必须是：

- 用户停止使用 / 释放托管运行环境。
- 扣费停止。
- Portal 显示停止计费确认状态。
- Portal 显示审计状态。
- 用户不需要理解 CVM、COS、K8s 或 TKE。

后台实现可以保留 `resourceBinding`、`billingStoppedAt`、`billingStopConfirmBy`、`auditTag` 和审计状态字段，但这些只属于平台内部合同、计费和审计边界。

## Release Flow

- 未开通托管运行环境时不能释放，返回 `managed_environment_required`。
- 已释放环境不能重复释放，返回 `managed_environment_already_released`。
- 释放请求必须显式包含 `workspaceId`。
- `resourceBinding` 状态按合同记录：
  - `release_requested`
  - `billing_stop_confirming`
  - `billing_stopped`
  - `audit_pending`
  - T+1 后进入 `audit_ready` 或 `audited`
- `billingStoppedAt` 必须等于 `releasedAt`。
- `billingStopConfirmBy` 必须等于 `releasedAt + 120min`。
- T+1 审计准备时间必须等于 `releasedAt + 1 day`。

本轮不执行真实资源删除，不调用真实云 API，只表达平台内部合同/状态闭环。

## Billing Summary

`billingSummary` 必须区分：

- `active billing`
- `stop billing confirming`
- `billing stopped`
- `audit pending`
- `audited`

释放后不再新增运行计费；新的 run 必须被 managed environment gate 拦截。

## File Protection

释放后 workspaceFiles 和 artifacts 必须进入保护/清理边界：

- 状态为 `retention_protected`。
- 保留公开 file reference / artifact reference。
- 不立即硬删除。
- 后续清理必须走审计边界。

## Security Boundary

API response 和 canonical state 不得泄露：

- raw API key
- raw prompt
- `resourceBinding` / `resourceBindingId` / `billingAttributionId` 等后台归因原值
- `launchToken`
- `runtimeToken`
- 内部存储密钥
- storage key / object key / local path / signed URL

## Non-goals

- 不在本合同内实现 frontend；Portal frontend 改动必须由对应 UI leaf、Figma source 和 frontend surface eval 授权。
- 不改 OPL Gateway。
- 不改 Runtime Bridge。
- 不改 deploy、`.sentrux` 或 `adapters`。
- 不修改 one-person-lab upstream。
- 不读取 `/home/dev/.secrets/medopl/secrets.env.txt`。
- 不调用真实云 API。
- 不运行 build/push/kubectl/live-test。

### spec:v22-resource-plan-boundary

Former leaf id: `v22-resource-plan-boundary`
Former title: v22 Resource Plan Boundary Contract

本合同定义 MedOPL v22 的资源套餐边界。

## Product Shape

MedOPL 提供托管 runtime、计算和存储能力。用户选择套餐或扩展能力，不直接配置 CVM、COS、K8s。

用户不购买节点池；节点池是平台供给库存。套餐表达的是 compute allocation、任务并发、文件空间、隔离等级和计费/审计策略。普通用户界面不得把节点、节点池、TKE、COS bucket 或云控制台对象作为购买对象。

## Default Plans

| 套餐 ID | 计算 | 存储 | 默认并发 |
| --- | --- | --- |
| `starter_2c4g_10gb` | 2c4gb | 10GB | 1 |
| `pro_8c16g_100gb` | 8c16gb | 100GB | 2 |

`starter_2c4g_10gb` 与 `pro_8c16g_100gb` 是 v22 默认套餐的唯一标准命名。不得再使用“默认套餐 1/2”命名。

## Extensions

MVP active surface 仅开放两档标准套餐。以下扩展能力属于 future-authorized 产品边界，不能作为当前普通用户 active UI、API 或 smoke 正路径：

- 叠加计算资源。
- 叠加存储容量。
- 自定义套餐。

所有后续叠加和自定义资源都必须先进入 billing、quota、audit 合同边界，并经过单独产品审批；当前 active source 不保留 `custom` 套餐开通 route、action 或默认套餐项。

## Isolation Modes

资源套餐必须显式声明 `isolationMode`：

- `tenant_node_pool`：默认套餐和后续叠加计算都使用由 Package C 创建或绑定的 tenant node pool。每个 tenant node pool 只能绑定一个 `resourceBindingId` 或一个明确租户/账号组，并且必须配套独立 namespace、ResourceQuota、LimitRange、admission policy、resourceBinding、审计标签、taint、label、nodeSelector 和 toleration。超过 allocation 的 workload 必须 fail-closed。

普通用户仍不直接管理节点池；Portal 对普通用户只展示计算资源、套餐、任务并发、状态和费用/审计语言。

## Runtime Requirement

资源套餐不等同于默认 runtime。租户必须明确开通 runtime 后，才能使用平台托管 runtime 跑任务。未开通 runtime 的租户不能跑托管 runtime 任务。

## Binding Requirement

每个 active 套餐资源都必须绑定 tenant、user、workspace、resource binding、billing account、audit tag / cost allocation tag。后续叠加资源和自定义资源进入 future-authorized 边界前不得作为 active route、action 或默认 smoke 正路径。

### spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary

Former leaf id: `v22-runtime-bridge-session-run-file-provider-keyref-boundary`
Former title: v22 Runtime Bridge Session Run File ProviderKeyRef Boundary Contract

本合同定义 OPL 工作台到 Runtime Bridge 的最小本地合同：session 绑定、run 提交、文件引用、artifact 引用和 `providerKeyRef` 透传。它只覆盖 `platform-provisioned / customer-dedicated` 托管工作台边界，不接真实云，不修改 one-person-lab upstream。

## Product Boundary

用户主路径是：

- 用户从 `opl.medopl.cn` 进入 OPL 科研工作台。
- OPL Web 通过 httpOnly cookie 或服务端 launch session 拉取 bootstrap；launch token 不得进入 URL query、localStorage、sessionStorage 或 browser public state。
- OPL Web 绑定工作台 session，并只把 provider 绑定结果传成 `providerKeyRef`。
- OPL Web 用 workspace file reference 发起 Runtime Bridge run。
- Runtime Bridge 返回 run record 和公开 artifact reference。

不得把 CVM、COS、K8s、TKE 或云资源控制台作为用户主语言。

## Runtime Bridge Endpoints

公开入口保持在 Runtime Bridge 边界：

```text
POST /api/opl-launch/tokens
GET  /api/opl-launch/bootstrap
POST /api/opl-launch/sessions/bind
POST /api/opl-launch/runs
GET  /api/opl-launch/runs/{runId}/status
GET  /api/opl-launch/runs/{runId}/artifacts
POST /api/opl-launch/messages
GET  /api/opl-launch/messages/{messageId}/status
```

旧入口 `/api/runtime-sessions` 和 `/api/runtime-sessions/{id}/runs` 保持 retired，不得作为 v22 新主路径。

以下 token 在 active surface 视为 retired/forbidden：

- retired resource-order identifier family（包括 snake/camel/kebab 旧字段族）
- `opencost-pending`
- `launch_token` URL query 语义
- 未脱敏 `promptPreview`

## Session Contract

OPL session 绑定必须满足：

- 输入可包含 `oplSessionId`、`provider=gflabtoken`、`source=user_input` 和一次性 raw API key。
- raw API key 只能进入 Runtime Bridge 后端 provider secret store。
- Runtime Bridge 对外只返回 `providerKeyRef`、`providerConfigured`、`providerConfigStatus` 和普通 session identity。
- session 必须绑定 `tenantId`、`portalUserId`、`workspaceId`、`workspaceSessionId`、`runtimeSessionId` 和 `resourceBindingId`。
- response、trace、evidence 和 git 不得包含 raw API key、bearer token、`launchToken` 或 `runtimeToken`。

## Run Contract

`POST /api/opl-launch/runs` 必须满足：

- 请求必须通过 httpOnly cookie 或服务端 launch session 完成授权，并命中同一个 `runtimeSessionId`；launch token 不得通过 URL query 传递。
- run 只接受 `mode=full_runtime`。
- 缺少 `resourceBindingId`、`computeInstanceId` 或 `storageBucketId` 时返回 `RESOURCE_BINDING_REQUIRED`。
- 缺少 Runtime Agent identity/endpoint 时返回 `PLATFORM_PROVISIONED_RUNTIME_AGENT_REQUIRED`。
- Runtime Bridge 传给 Runtime Agent 的 provider 信息只能是 `providerKeyRef`，不得传 raw API key。
- Runtime Bridge 持久化 run 时必须保留 `traceId`、`workspaceId`、`runtimeSessionId`、`resourceBindingId` 和 `providerKeyRef`。
- Runtime Agent 返回的 ledger entry 必须经过 Runtime Bridge 白名单净化，不得把 `ledgerEntries[].rawPayload` 原样保存。

当前分支只定义本地合同和 mock Runtime Agent relay 小闭包；不接真实云、不创建真实运行节点、不调用真实 Runtime Agent。

## File And Artifact Contract

输入文件和输出文件必须使用公开引用：

- OPL Web 传入 workspace file reference，例如 `fileRefs=["workspace-file-ref-..."]`。
- Runtime Bridge response 只能返回公开 artifact reference。
- 公开 artifact shape 只允许包含 `artifactId`、`artifactRef`、`runId`、`workspaceId`、`resourceBindingId`、`providerKeyRef`、`kind`、`name`、`relativePath`、`sizeBytes` 和 `contentType`。
- `storageKey`、`objectKey`、`localPath`、`signedUrl`、`presignedUrl` 和 runtime 私有路径只能留在后端状态边界，不得进入公开 response。
- session ledger 可以记录公开 `artifactRef`，不得记录 raw key 或 token。
- session ledger 不得保存 Runtime Agent 的 `rawPayload` 原文或基于原文的 `payloadHash`；只能保存白名单后的安全 ledger metadata。

## Trace And Ledger Boundary

trace / ledger metadata 允许包含：

- `ledgerEntryId`
- `tenantId`
- `portalUserId`
- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `sessionId`
- `resourceBindingId`
- `runId`
- `traceId`
- `providerKeyRef`
- artifact reference list
- usage / cost summary
- status / event type / timestamps
- sanitized metadata

trace / ledger metadata 不得包含 raw prompt、raw API key、`launchToken`、`runtimeToken`、bearer token、internal storage key、local path 或 signed URL。

Runtime Bridge ledger 净化规则是白名单规则：

- `ledgerEntryId` 由 Runtime Bridge 本地生成；`sessionId`、`runId`、`traceId`、`workspaceId`、`resourceBindingId`、`providerKeyRef` 来自已验证的 runtime/session/run context 或公开 id。
- `artifactRefs` 只能来自 Runtime Bridge 生成的公开 artifact reference。
- `usage` 只保留非负数值摘要，例如 input/output/total token count。
- `costSummary` 只保留三位货币代码和非负数值摘要。
- `status` 和 `eventType` 只保留 Runtime Bridge 允许集合中的枚举值。
- `metadata` 只保留 Runtime Bridge 明确允许的安全字段，例如 `publicStatus`。
- `rawPayload`、raw prompt、raw API key、`providerApiKey`、`apiKey`、`launchToken`、`runtimeToken`、bearer token、`objectKey`、`storageKey`、`localPath`、`signedUrl`、`presignedUrl` 和 internal storage key 必须被丢弃。

## Upstream Boundary

one-person-lab upstream 必须保持 clean：

- 不修改 upstream 源码。
- 不 import upstream 内部模块。
- 不在 upstream 目录写 Portal、Gateway、Runtime Bridge 或 Runtime Agent 代码。
- 通过 Gateway、Runtime Bridge、Runtime Agent、API/CLI 等公开边界适配。

## Non-goals

- 不实现真实云资源开通。
- 不调用真实云 API。
- 不读取 secret。
- 不运行 build/push/kubectl/live-test。
- 不改 deploy、`.sentrux`、`adapters` 或 upstream。
- 不改 UI 文案。
- 不把全局 Sentrux 阈值作为本合同目标。

## Smoke

本合同由本地 smoke 固化：

```text
node tests/smoke/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs
```

该 smoke 只使用本地 mock `runtimeAgentRelay` 和内存 state，不读取 `/home/dev/.secrets/medopl/secrets.env.txt`，不调用真实云 API，不启动真实 Runtime Agent。

### spec:v22-saas-control-plane-user-experience-boundary

Former leaf id: `v22-saas-control-plane-user-experience-boundary`
Former title: v22 SaaS Control Plane User Experience Boundary

本合同固定 MedOPL 与 One Person Lab 的产品关系：MedOPL 是 One Person Lab 的 SaaS 控制面和托管交付平台，让 clean upstream OPL 从需要部署、配置和维护的科研工作台，变成开箱即用、可购买、可管理、可计费、可审计、可释放的托管服务。

本合同只定义产品真相和 Portal 用户体验边界，不实现 UI，不修改 `services/*`，不读取 secret，不调用真实云，不修改 upstream，不运行 build/push/kubectl/live-test。后续 Portal UI 改版必须订阅本合同，再由 `spec:v22-portal-workbench-management-ui-composition-boundary`、`spec:v22-portal-figma-make-ui-implementation-boundary` 和对应 frontend surface gate 承接具体页面、组件、文案和验收。

模型记录：`gpt-5.4`。

## 产品关系

MedOPL 不是独立科研聊天产品，不重做 OPL chatbot，也不是云资源控制台。

MedOPL 的价值是把 One Person Lab SaaS 化：

- 平台创建账号、管理余额和套餐。
- 平台提供计算资源、文件空间和工作空间生命周期。
- 平台负责开通、隔离、计费、审计、释放和停止计费。
- 平台通过 Gateway、Runtime Bridge 和 Runtime Agent 把 Portal 上下文安全带入 OPL。
- 平台把 OPL session、run、artifact、trace、账单和审计状态回流到 Portal。

用户购买的是托管 OPL 科研工作台服务，不是 CVM、COS、K8s、TKE、节点池或云资源控制台权限。

## Portal 用户体验真相

Portal 是 OPL 的 SaaS 控制面。它必须让用户知道自己买的是什么东西、接受的是什么服务，以及这个服务当前是否可用。

Portal 必须帮助用户回答：

- 我买的是什么服务？
- 我的 OPL 工作台现在能不能用？
- 如果不能用，还缺哪一步？
- 下一步应该点哪里？
- 我的文件、任务、结果在哪里？
- 我的余额、预扣费、冻结金额、停止计费状态是否正常？
- 我什么时候应该释放计算资源但保留文件空间？

这些问题是 Portal 工作台首页、空状态、操作按钮、导航、结果回流和账单摘要的上游产品真相。Portal 不回答科研问题，不复制 OPL 的 chatbot，不把科研执行体验搬到 Portal。

## 职责边界

### Portal 负责

Portal 负责准备、管理、进入、回流、计费、审计和释放，包括：

- 账号和登录态。
- 套餐、余额、预扣费和冻结金额。
- 计算资源、文件空间和工作空间状态。
- gflabtoken 模型调用密钥绑定状态和 OPL preflight 入口。
- 进入 OPL 工作台。
- OPL session、run、artifact、trace 的回流展示。
- 账单、审计、释放和停止计费状态。

### OPL 负责

OPL 负责科研执行，包括：

- chatbot。
- agent。
- 科研任务执行。
- 文件理解。
- 结果生成。
- 工作台内交互体验。

### Gateway / Runtime Bridge / Runtime Agent 负责

- 统一入口、preflight、launch 和上下文注入。
- providerKeyRef、workspace、resource binding、file/run/artifact/trace 的安全投影。
- no-fake-success gate。
- 不把 raw API key、launchToken、runtimeToken、bearer token、objectKey、localPath 或 signedUrl 写入 URL、浏览器持久化状态、日志、evidence 或 git。

## Portal 不得做

- 重做 OPL chatbot。
- 成为云资源控制台。
- 要求普通用户理解 CVM/COS/K8s/TKE。
- 把 raw API key、launchToken、runtimeToken、bearer token 写入浏览器持久化状态、日志、evidence 或 git。

## 验收方式

本合同的本地验收入口是：

```bash
node tests/smoke/smoke-test-v22-saas-control-plane-user-experience-boundary.mjs
```

该 smoke 只读取 repo-tracked 文档，不读取 secret，不调用真实云，不执行 build/push/kubectl/live-test，不修改 upstream。

## Contract Data

<!-- v22-saas-control-plane-user-experience-contract:start -->
```json
{
  "contract": "v22_saas_control_plane_user_experience_boundary",
  "version": 1,
  "model": "gpt-5.4",
  "scope": {
    "portalIsSaasControlPlane": true,
    "portalReimplementsOplChatbot": false,
    "portalIsCloudConsole": false,
    "modifiesServices": false,
    "callsRealCloud": false,
    "readsSecrets": false,
    "modifiesUpstream": false
  },
  "userQuestions": [
    "我买的是什么服务？",
    "我的 OPL 工作台现在能不能用？",
    "如果不能用，还缺哪一步？",
    "下一步应该点哪里？",
    "我的文件、任务、结果在哪里？",
    "我的余额、预扣费、冻结金额、停止计费状态是否正常？",
    "我什么时候应该释放计算资源但保留文件空间？"
  ],
  "portalResponsibilities": [
    "账号和登录态",
    "套餐、余额、预扣费和冻结金额",
    "计算资源、文件空间和工作空间状态",
    "gflabtoken 模型调用密钥绑定状态和 OPL preflight 入口",
    "进入 OPL 工作台",
    "OPL session、run、artifact、trace 的回流展示",
    "账单、审计、释放和停止计费状态"
  ],
  "oplResponsibilities": [
    "chatbot",
    "agent",
    "科研任务执行",
    "文件理解",
    "结果生成",
    "工作台内交互体验"
  ],
  "portalMustNot": [
    "重做 OPL chatbot",
    "成为云资源控制台",
    "要求普通用户理解 CVM/COS/K8s/TKE",
    "把 raw API key、launchToken、runtimeToken、bearer token 写入浏览器持久化状态、日志、evidence 或 git"
  ],
  "downstreamImplementationContract": "spec:v22-portal-workbench-management-ui-composition-boundary",
  "currentUiImplementationSource": "docs/specs/README.md",
  "smoke": "tests/smoke/smoke-test-v22-saas-control-plane-user-experience-boundary.mjs"
}
```
<!-- v22-saas-control-plane-user-experience-contract:end -->

### spec:v22-saas-portal-opl-ops-surface-boundary

Former leaf id: `v22-saas-portal-opl-ops-surface-boundary`
Former title: v22 Portal OPL 管理台共享界面合同

本合同固定 MedOPL v22 的 Portal、OPL Web、管理台共享产品表面、用户角色、多租户后台边界和腾讯云分账标签边界。

本合同是共享产品表面合同，不单独实现 UI。Portal 可运行 UI、组件组合、路由入口和验证链路由 `spec:v22-portal-workbench-management-ui-composition-boundary` 承接；本合同不得再声明“本轮不做 UI”作为全局事实。

## 产品定位

MedOPL 是面向 AI 小白科研用户的 OPL 托管科研工作台。

普通用户不需要理解云厂商控制台或工程后台。

它包含：

- Portal 工作台
- OPL Web 科研工作台
- 管理台
- 平台代开通计算和存储
- 账单、余额、审计和管理
- one-person-lab clean upstream

用户开通的是托管运行环境和文件空间；腾讯云资源池、资源标签和内部绑定只属于后台实现、计费、审计和运维边界。

## 使用人群

MVP 只定义两类使用人群：

- AI 小白科研用户
- 管理人员

不要把“租户/课题组管理员”作为 MVP 独立角色。多租户是后台边界，不是当前 MVP 用户角色。

## AI 小白科研用户 Portal 界面

AI 小白科研用户在 Portal 必须能看到：

- 余额
- 钱花在哪里
- 会话数
- 任务数
- 科研任务进度
- 托管运行环境状态
- 文件空间状态
- 输入文件
- 输出文件
- 工作空间文件夹
- 运行轨迹
- 账单摘要
- 停止计费状态、审计状态
- 进入 OPL 工作台的入口

Portal 面向 AI 小白科研用户时不得把云厂商资源池、工程后台字段或原始分账标签作为主语言。

## AI 小白科研用户 OPL 工作台界面

AI 小白科研用户在 OPL Web 必须能做：

- 使用统一 MedOPL 账号登录
- 绑定自己的 gflabtoken 模型调用密钥
- 发消息
- 上传文件
- 用文件跑任务
- 下载输出文件

OPL Web 入口通过 MedOPL Gateway、SSO 和 Auth Bridge 完成统一身份。gflabtoken API Key 不是 Portal 普通登录字段；原始密钥只进入后端密钥边界，用户侧只看到 `providerKeyRef` 和 bound status。

MedOPL 有两种进入 OPL Web 的路径：

- 路径 1：从 Portal 工作台进入。
- `portal.medopl.cn -> Portal 工作空间、“进入 OPL 工作台”按钮 -> Gateway launch 和 preflight -> clean upstream one-person-lab Web`
- 路径 2：直接访问 OPL 工作台。
- `opl.medopl.cn -> OPL Gateway entry -> MedOPL 账号、密码 preflight -> clean upstream one-person-lab Web`

两条路径最终进入同一套 Gateway、preflight 和 launch 逻辑。从 Portal 进入时可复用 Portal session、workspace、launch context 和后端 provider binding；从 OPL 直接进入时需要 MedOPL 账号、密码和用户自己的 gflabtoken API Key，已绑定用户不要求重复输入。

用户可见入口不是 /internal/opl/auth/login；/internal/opl/auth/login 只能是 internal implementation path。用户可见入口必须是 Portal “进入 OPL 工作台”或 /opl/entry/preflight。

launchToken/runtimeToken 不进 URL query，launchToken/runtimeToken 不进 localStorage/sessionStorage。Gateway 不写 raw API Key 到 localStorage/sessionStorage，Gateway 不 import one-person-lab 内部模块。

## 管理台

管理人员在 Portal 管理台必须能看到：

- 用户管理摘要
- 工作空间摘要
- 资源管理摘要
- 任务记录摘要
- 账单管理摘要
- 审计记录摘要
- 站点设置摘要
- 服务状态摘要
- 分账标签状态
- 任务失败
- 账单日内核对状态
- 120min 停止计费确认状态
- T+1 审计状态
- 异常账单、异常资源

管理台可以在排障详情中展示后台标识、腾讯云标签映射、COS bucket/prefix/object 和异常归因；这些不进入 AI 小白科研用户主叙事，也不作为管理台一级页面和默认摘要的标题语言。管理台一级页面和默认摘要必须优先使用用户管理、工作空间、资源管理、任务记录、账单管理、审计记录、站点设置和服务状态。

## 后台多租户边界

后台必须保持：

- `tenantId`
- `userId`
- `workspaceId`
- `resourceBindingId`
- `cloudOperationId`
- `billingAttributionId`
- `accountId`
- `billingAccountId`
- `runId`
- `serverPlanId`
- 旧 resource-order 标识不得作为后台归因字段或兼容 alias

这些字段用于隔离、计费、审计、运维，不作为 AI 小白用户主语言。

## 腾讯云分账标签

当前腾讯云分账标签主字段为：

- `resourcebindingid`
- `cloudoperationid`
- `billingattributionid`
- `accountid`
- `runid`
- `serverplanid`
- `workspaceid`
- `tenantid`

旧 resource-order 标识不得作为 fixed key、optional key 或兼容归属 alias。上述标签用于腾讯云账单核对、COS 存储桶列表、成本归因和审计。普通用户不直接操作这些标签；管理人员可以在管理台查看标签映射和异常。

## 腾讯云资源边界

腾讯云是后台资源池，不是用户主界面。

用户开通的是：

- 托管运行环境
- 文件空间

后台代开通：

- CVM
- COS、文件空间
- runtime

普通用户不能被引导去配置 CVM、COS、K8s、TKE。

## 账号和 provider 边界

MedOPL 账号密码与 OPL Web 账号密码统一。用户从 `opl.medopl.cn` 进入时，通过 MedOPL Gateway、SSO 和 Auth Bridge 完成统一身份。

每个用户使用自己的 gflabtoken API Key 作为模型调用凭证。它不是 Portal 普通登录字段；原始密钥只进入后端密钥边界，前端只展示 `providerKeyRef` 和 bound status。

## upstream 边界

one-person-lab 是 clean upstream：

- 不得修改 upstream 源码。
- 不得 import upstream 内部模块。
- OPL entry 和 preflight 属于 MedOPL Gateway、SSO 和 Auth Bridge。

## AI 小白科研用户禁用主语言

普通用户界面不得把以下作为主语言：

- CVM
- COS bucket
- K8s
- TKE
- retired resource-order identifiers
- raw billing tags
- raw provider API key
- `launchToken`
- `runtimeToken`
- 内部存储密钥
- one-person-lab upstream 内部模块

## 产品验收效果

AI 小白用户进入 Portal 后能回答：

- 我还有多少钱？
- 我的钱花在哪里？
- 我有几个会话？
- 我有几个任务？
- 我的科研任务跑到哪一步？
- 我的托管运行环境是否可用？
- 我的文件空间是什么状态？
- 我的输入文件和输出文件在哪里？
- 我从哪里进入 OPL 工作台？
- 我的 gflabtoken 模型调用密钥是否已绑定？
- 我释放环境后是否停止扣费？
- 账单核对和审计是否完成？

管理人员进入管理台后能回答：

- 哪个 account、workspace、resourceBinding、cloudOperation、billingAttribution、run、serverPlan 产生了费用？
- 腾讯云账单标签是否完整？
- COS 对象是否有正确 accountid、workspaceid、resourcebindingid、cloudoperationid、billingattributionid、runid、serverplanid 归因？
- 哪些任务失败？
- 哪些停止计费还在 120min 确认中？
- 哪些审计是 T+1 pending 或 ready？
- 哪些资源或账单异常？

## Contract Data

<!-- v22-saas-portal-opl-ops-surface-contract:start -->
```json
{
  "contract": "v22_saas_portal_opl_ops_surface_boundary",
  "version": 2,
  "implementationBoundary": {
    "thisContractImplementsUiDirectly": false,
    "portalUiImplementationContract": "spec:v22-portal-workbench-management-ui-composition-boundary",
    "mustNotClaimNoUiWhenCompositionImplementsUi": true
  },
  "productPositioning": {
    "statement": "MedOPL 是面向 AI 小白科研用户的 OPL 托管科研工作台。",
    "notCloudConsole": true,
    "includes": [
      "Portal 工作台",
      "OPL Web 科研工作台",
      "管理台",
      "平台代开通计算和存储",
      "账单、余额、审计和管理",
      "one-person-lab clean upstream"
    ]
  },
  "personas": {
    "mvpRoles": [
      "AI 小白科研用户",
      "管理人员"
    ],
    "tenantAdminIndependentRole": false,
    "multiTenantIsBackendBoundary": true
  },
  "portalBeginnerSurface": {
    "mustShow": [
      "余额",
      "钱花在哪里",
      "会话数",
      "任务数",
      "科研任务进度",
      "托管运行环境状态",
      "文件空间状态",
      "输入文件",
      "输出文件",
      "工作空间文件夹",
      "运行轨迹",
      "账单摘要",
      "停止计费状态、审计状态",
      "进入 OPL 工作台的入口"
    ],
    "cloudConsoleShown": false
  },
  "oplWebBeginnerSurface": {
    "entrypoint": "opl.medopl.cn",
    "mustDo": [
      "使用统一 MedOPL 账号登录",
      "绑定自己的 gflabtoken 模型调用密钥",
      "发消息",
      "上传文件",
      "用文件跑任务",
      "下载输出文件"
    ]
  },
  "managementSurface": {
    "primaryPageLanguage": [
      "用户管理",
      "工作空间",
      "资源管理",
      "任务记录",
      "账单管理",
      "审计记录",
      "站点设置",
      "服务状态"
    ],
    "rawBackendTermsAllowedOnlyInDiagnosticDetail": true,
    "mustShow": [
      "用户管理摘要",
      "工作空间摘要",
      "资源管理摘要",
      "任务记录摘要",
      "账单管理摘要",
      "审计记录摘要",
      "站点设置摘要",
      "服务状态摘要",
      "分账标签状态",
      "任务失败",
      "账单日内核对状态",
      "120min 停止计费确认状态",
      "T+1 审计状态",
      "异常账单、异常资源"
    ]
  },
  "backendMultiTenantBoundary": {
    "fields": [
      "tenantId",
      "userId",
      "workspaceId",
      "resourceBindingId",
      "cloudOperationId",
      "billingAttributionId",
      "accountId",
      "billingAccountId",
      "runId",
      "serverPlanId",
      "retiredResourceOrderIdentifiersForbidden"
    ],
    "usedFor": [
      "隔离",
      "计费",
      "审计",
      "运维"
    ],
    "beginnerUserPrimaryLanguage": false
  },
  "tencentCostAllocationTags": {
    "fixedKeys": [
      "resourcebindingid",
      "cloudoperationid",
      "billingattributionid",
      "accountid",
      "runid",
      "serverplanid",
      "workspaceid",
      "tenantid"
    ],
    "usedFor": [
      "腾讯云账单核对",
      "COS 存储桶列表",
      "成本归因",
      "审计"
    ],
    "beginnerUserDirectOperation": false,
    "managementCanInspectMappingAndAnomalies": true
  },
  "cloudResourceBoundary": {
    "tencentCloudIsBackendPool": true,
    "userBuys": [
      "托管运行环境",
      "文件空间"
    ],
    "backendProvisioning": [
      "CVM",
      "COS、文件空间",
      "runtime"
    ],
    "forbiddenBeginnerConfiguration": [
      "CVM",
      "COS",
      "K8s",
      "TKE"
    ]
  },
  "accountAndApiKeyBoundary": {
    "medoplAccountUnifiedWithOplWeb": true,
    "identityPath": "MedOPL Gateway、SSO 和 Auth Bridge",
    "providerCredentialOwner": "user",
    "gflabtokenInputLocation": "OPL entry/preflight 或工作台 provider 绑定面",
    "apiKeyIsPortalLoginField": false,
    "managedRunRequiresApiKey": true,
    "rawApiKeyBackendOnly": true,
    "beginnerVisibleName": "gflabtoken 模型调用密钥",
    "frontendPublicFields": [
      "providerKeyRef",
      "bound status"
    ]
  },
  "upstreamBoundary": {
    "repository": "https://github.com/gaofeng21cn/one-person-lab",
    "cleanUpstream": true,
    "modifySource": false,
    "importInternalModules": false,
    "entryPreflightOwnedBy": "MedOPL Gateway、SSO 和 Auth Bridge"
  },
  "forbiddenBeginnerUserNarrative": [
    "CVM",
    "COS bucket",
    "K8s",
    "TKE",
    "retired resource-order identifiers",
    "raw billing tags",
    "raw provider API key",
    "launchToken",
    "runtimeToken",
    "内部存储密钥",
    "one-person-lab upstream 内部模块"
  ],
  "productEffectQuestions": {
    "beginnerUserCanAnswer": [
      "我还有多少钱？",
      "我的钱花在哪里？",
      "我有几个会话？",
      "我有几个任务？",
      "我的科研任务跑到哪一步？",
      "我的托管运行环境是否可用？",
      "我的文件空间是什么状态？",
      "我的输入文件和输出文件在哪里？",
      "我从哪里进入 OPL 工作台？",
      "我的 gflabtoken 模型调用密钥是否已绑定？",
      "我释放环境后是否停止扣费？",
      "账单核对和审计是否完成？"
    ],
    "managementCanAnswer": [
      "哪个 account、workspace、resourceBinding、cloudOperation、billingAttribution、run、serverPlan 产生了费用？",
      "腾讯云账单标签是否完整？",
      "COS 对象是否有正确 accountid、workspaceid、resourcebindingid、cloudoperationid、billingattributionid、runid、serverplanid 归因？",
      "哪些任务失败？",
      "哪些停止计费还在 120min 确认中？",
      "哪些审计是 T+1 pending 或 ready？",
      "哪些资源或账单异常？"
    ]
  },
  "nonGoals": [
    "本合同不单独实现 UI",
    "不复制 Sub2API 代码、路由、鉴权或存储结构",
    "不读取 /home/dev/.secrets/medopl/secrets.env.txt",
    "不调用真实云 API",
    "不运行 build/push/kubectl/live-test"
  ]
}
```
<!-- v22-saas-portal-opl-ops-surface-contract:end -->

## Non-goals

- 本合同不单独实现 UI；Portal UI 实现由 `spec:v22-portal-workbench-management-ui-composition-boundary` 承接。
- 不复制 Sub2API 代码、路由、鉴权或存储结构。
- 不改 frontend、Gateway、Runtime Bridge、deploy、`.sentrux`、adapters 或 one-person-lab upstream。
- 不读取 `/home/dev/.secrets/medopl/secrets.env.txt`。
- 不调用真实云 API。
- 不运行 build/push/kubectl/live-test。

### spec:v22-smoke-eval-boundary

Former leaf id: `v22-smoke-eval-boundary`
Former title: v22 Smoke / Eval Boundary

本合同定义 MedOPL v22 的 smoke / eval 分层语义。它不新增产品能力，不接云，不读取 secret，不授权 build/push/deploy/kubectl/live-test，只收敛本地验证入口和命名真相。

所有 suite 默认不得读取 secret，不得调用真实云，不得 build/push/deploy/kubectl/live-test。真实云、secret、部署、kubectl、live-test 或真实外部 canary 只能在单独授权合同和 step-local authorization 下执行。

## 主线定义

Smoke 只代表极小关键路径，不等于所有 v22 eval。v22 仓库里所有 `tests/**/*.mjs` 都是 repo-local eval gate 文件；只有 `health-check` 和 `smoke-golden` 两层可以被称为 smoke。

当前 `tests/**/*.mjs` 文件名暂不机械重命名，避免制造无业务价值的大 diff。语义权威来自 `scripts/v22-test-classification.mjs` 里的 `tier + surface + entryKind + authorization + contractRefs` 元数据和 `scripts/v22-verify.mjs` suite 入口。

## Tier

| Tier | 语义 | 默认策略 |
| --- | --- | --- |
| `health-check` | 极小仓库控制面与零兼容生命体征。用于快速确认当前分支没有破坏 gate 体系本身。 | 可以默认跑，数量必须很小。 |
| `smoke-golden` | 小型关键用户路径。覆盖托管 OPL SaaS 最核心 loop，但不做全量回归。 | 可以作为 PR/B review 阻断信号，数量必须受限。 |
| `contract-local` | 合同、DTO、禁词、状态矩阵、workflow、manifest 和边界断言。 | 本地确定性 gate，不等于 smoke。 |
| `local-regression` | Portal / OPL / Runtime Bridge 本地闭环和更宽功能回归。 | 可默认进入 local deterministic regression，但不叫 smoke。 |
| `real-cloud-readiness` | mock/snapshot、readonly quote、dry-run plan 和 readonly inventory 的本地 readiness gate。 | 可作为接云前置本地 gate 运行；不授权 secret、真实云、deploy、kubectl、live-test 或外部 mutation。 |
| `future-authorized` | Cloud mutation / live / deploy / canary / Package D / Tencent create-release 等后续授权验证。 | 默认不跑；需要 step-local authorization。 |
| `retired` | 已退役或历史入口。 | 必须为 0。 |

## Surface

| Surface | 范围 |
| --- | --- |
| `control-plane` | 合同、workflow、verify runner、分类、zero-compat、repo zoning、goal state。 |
| `portal` | Portal 普通用户和管理员本地 UI/API/domain eval。 |
| `opl` | OPL Gateway、Portal-OPL connection、OPL work/message/file/run 本地 eval。 |
| `runtime-bridge` | Runtime Bridge / Runtime Agent / run-file-providerKeyRef 本地 eval。 |
| `cloud` | Tencent/cloud/live/deploy/future-authorized 边界 eval。 |
| `archive` | 历史退役入口；active repo 中不应存在 retired eval。 |

## Entry Kind

| Entry kind | 语义 |
| --- | --- |
| `atomic` | 单个可执行 eval gate。它可以属于 health、golden、contract-local、local-regression、real-cloud-readiness 或 future-authorized。 |
| `suite-wrapper` | suite 聚合入口，例如 golden smoke suite 或 legacy MVP/local-regression wrapper；它不应被当作业务 eval 数量本身。 |
| `gate-self-test` | gate/runner 自检壳，用于验证 gate 体系本身，不代表业务功能闭环。 |

## Authorization

| Authorization | 语义 |
| --- | --- |
| `none` | 本地 deterministic eval，不授权 secret、真实云、deploy、kubectl、live-test 或真实外部 canary。 |
| `future-authorized` | 仅代表未来授权 lane 的本地边界可见性；默认 suite 不执行真实云、secret、deploy、kubectl、live-test。 |

## Golden Smoke 收录条件

`smoke-golden` 只能包含：

- MedOPL 托管 OPL SaaS 的关键用户路径。
- 本地 deterministic 命令。
- 无 secret 读取。
- 无真实云调用。
- 无 build/push/deploy/kubectl/live-test。
- 失败可以阻断 B 吸收。
- 能用少量脚本证明主链路仍然可解释：账号/余额、套餐/资源计划、托管环境、Portal-OPL connection、Runtime Bridge session/run/file/providerKeyRef、文件/账单/trace、释放停止计费。

`smoke-golden` 不得包含：

- Cloud / Tencent / live / deploy / Package D / canary runner。
- 大范围 Portal UI 回归。
- 大范围 OPL / Runtime Bridge 回归。
- 历史清退证明。
- 纯文档扫描集合。
- flaky、依赖外部状态、需要 secret 或真实资源的命令。

## Suite 入口

| Suite | 命令 | 语义 |
| --- | --- | --- |
| health | `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk` | 最小仓库控制面生命体征。 |
| smoke | `node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk` | 小型 golden smoke。 |
| local-contract | `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk` | 合同和控制面本地 gate。 |
| local-regression | `node scripts/v22-verify.mjs suite local-regression --base origin/recovery/platform-v22-trunk` | Portal / OPL / Runtime Bridge 本地 deterministic 回归。 |
| real-cloud-readiness | `node scripts/v22-verify.mjs suite real-cloud-readiness --base origin/recovery/platform-v22-trunk` | 只跑 mock/snapshot、readonly quote、dry-run plan 和 readonly inventory 的本地 readiness gate；不授权真实云或 secret。 |
| cloud-future-authorized | `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk` | 只做 mutation/deploy/live/canary 等未来授权边界可见性，不授权执行真实云。 |
| mvp | `node scripts/v22-verify.mjs suite mvp --base origin/recovery/platform-v22-trunk` | 旧兼容入口，语义收敛为 local deterministic regression，不再称为纯 smoke。 |

## 门禁

- 新增 `tests/**/*.mjs` 必须有 category、tier、surface、entryKind、authorization、contractRefs。
- `health-check` 数量必须不超过 `HEALTH_CHECK_MAX`。
- `smoke-golden` 数量必须在 `SMOKE_GOLDEN_MIN` 和 `SMOKE_GOLDEN_MAX` 之间。
- `future-authorized` 不得进入默认 local deterministic suite。
- `future-authorized` 必须显式标记 authorization，不能只靠文件名里的 local/readonly/dry-run 推断授权状态。
- `real-cloud-readiness` 不得混入 mutation、deploy、kubectl、build/push、live-test 或真实云 create/release gate。
- `suite-wrapper` 和 `gate-self-test` 必须显式列出，不能混入 atomic 业务 eval 统计。
- `retired` 必须为空。
- `smoke-golden` 和 `health-check` 不得包含 cloud/tencent/authorized/deploy/package-d/live/canary 语义。

## 非目标

- 不重命名全部 `tests/**/*.mjs` 文件。
- 不删除 active Portal / OPL / Runtime Bridge 本地 eval。
- 不接真实云。
- 不读取 secret、`.env`、kubeconfig、token 或 SSH key。
- 不执行 build/push/deploy/kubectl/live-test。
- 不修改 one-person-lab upstream。

### spec:v22-tenant-resource-binding-boundary

Former leaf id: `v22-tenant-resource-binding-boundary`
Former title: v22 Tenant Resource Binding Boundary Contract

本合同定义 MedOPL v22 的租户资源绑定边界。

## Required Binding

开通 runtime、compute、storage 后，所有资源必须绑定到：

- tenant
- user
- workspace
- resource binding
- billing account
- audit tag / cost allocation tag

## Binding Scope

绑定用于确认：

- 资源属于哪个租户。
- 哪个用户触发或使用该资源。
- 资源服务哪个 workspace。
- 资源如何进入 billing、quota、audit。
- 成本如何通过 audit tag / cost allocation tag 归因。

## Lifecycle

资源生命周期必须保持绑定：

1. 开通前校验 tenant、user、workspace、billing account。
2. 开通时创建 resource binding。
3. 使用中记录 audit tag / cost allocation tag。
4. 余额不足时关联冻结金额。
5. 7 天冻结保护期结束后，按绑定清理数据和资源。
6. 用户删除或释放资源后，停止扣费并保留审计证据。

## Prohibited State

v22 不允许：

- 无 tenant 的 runtime、compute、storage。
- 无 billing account 的资源。
- 无 audit tag / cost allocation tag 的资源。
- 让用户直接通过 CVM、COS、K8s 配置绕过 Portal 资源绑定。

### spec:v22-tencent-dry-run-resource-plan-provider-boundary

Former leaf id: `v22-tencent-dry-run-resource-plan-provider-boundary`
Former title: v22 Tencent Dry-Run Resource Plan Provider Boundary

本合同定义 v22 `dry-run/tencent resource plan provider` 的接口边界。该 provider 基于现有 readonly quote provider 和 managed resource binding plan，生成“不会执行的资源创建计划”。

当前层级不调用真实腾讯云 API，不创建、绑定、释放真实资源，不真实扣费。

## Purpose

dry-run provider 用于把 readonly quote 的区域、规格和预计费用，整理成 Portal / 运维可审计的资源计划业务对象。它只描述计划，不执行计划。

Package C dry-run runner:

- `tests/support/cloud-prework/v22-tencent-create-release-dry-run-plan.js`
- `tests/future-authorized/cloud/future-authorized-test-v22-tencent-resource-lifecycle-dry-run-plan-local-gate.mjs`

该 runner 只允许在 `--dry-run --confirm-no-real-cloud` 下生成 `.runtime/v22-cloud-lifecycle/<operation-id>-dry-run.json`。它拒绝 `--secret-file`、`--live`、`--execute`、`--apply`、`--mutate`、`--deploy`、`--kubectl`、`--build` 和 `--push`。当前 runner 不读取 `package-c-mutation.env`，不读取 mutation secret，不调用腾讯云，不写 Portal ledger，不扣费，不读取 COS object body。

Provider 输出字段白名单：

```json
{
  "resourcePlanId": "dry-run-plan-rb-v22-example",
  "resourceBindingId": "rb-v22-example",
  "planMode": "dry_run",
  "regionLabel": "硅谷一区",
  "planSpec": "8核 / 16GB 内存 / 100GB 文件空间",
  "estimatedCost": {
    "amount": 0,
    "currency": "CNY",
    "source": "contract_snapshot_fixture",
    "status": "mock_snapshot",
    "billingTruth": false,
    "chargeApplied": false
  },
  "resourceSteps": [
    "准备托管运行环境",
    "分配文件空间",
    "准备运行网络边界",
    "登记账单和审计边界"
  ],
  "approvalRequired": true,
  "releasePolicy": {
    "status": "not_released",
    "releasedAt": "",
    "billingStopConfirmBy": "",
    "stopBillingConfirmWithinMinutes": 120,
    "protection": "文件和输出进入保护/审计边界"
  },
  "auditStatus": {
    "status": "audit_pending",
    "auditReadyAt": "2026-05-09T08:00:00.000Z",
    "policy": "T+1"
  },
  "riskNotes": [
    "dry-run 只生成不会执行的资源创建计划",
    "真实腾讯云接入必须另开 feat/* 并单独授权",
    "当前不创建、绑定、释放真实资源，不真实扣费"
  ]
}
```

`resourcePlan` 顶层字段必须严格限于上述白名单。realResourceCreated 不属于 resourcePlan 顶层字段；chargeApplied 不属于 resourcePlan 顶层字段。

真实资源未创建必须通过 `managedResourceBindingPlan.snapshot.realResourceCreated=false` 表达；未真实扣费必须通过 `estimatedCost.chargeApplied=false` 或现有费用估算边界表达。dry-run 不得声称真实资源已创建，不得触发真实扣费。

## Resource Steps Language

`resourceSteps` 只能使用用户 / 运维可审计的产品语言，例如：

- 准备托管运行环境
- 分配文件空间
- 准备运行网络边界
- 登记账单和审计边界

普通用户主语言不得出现 CVM、COS、K8s、TKE、Kubernetes 或云资源控制台。后台实现可以在后续授权阶段映射到真实 provider adapter，但不得把云内部对象暴露到 Portal 普通用户 payload。

## Data Source

当前 dry-run provider 只能使用：

- contract/mock/snapshot 数据
- readonly/tencent quote provider 输出
- managed resource binding plan 里的业务字段

当前不得读取 secret、kubeconfig、token、SecretId、SecretKey、SSH private key 或 `.env`；不得调用真实腾讯云、COS、Langfuse、one-person-lab 或外部生产 API。

## Forbidden Response Fields

Provider response 和 Portal payload 不得包含：

- SecretId / SecretKey
- kubeconfig
- token / bearer token
- raw API Key
- provider raw cost internals
- CVM / COS / K8s / TKE 内部对象
- objectKey / storageKey / localPath / signedUrl

## Adapter Route

后续真实腾讯云接入路线保持：

`mock/snapshot -> readonly/tencent quote -> dry-run/tencent plan -> TKE bootstrap preflight when no TKE foundation exists -> readonly/tencent inventory -> authorized/tencent create/release -> authorized/tencent deploy -> canary / QA / status update`

真实腾讯云 SDK、真实 SecretId/SecretKey、真实报价、真实创建、真实绑定、真实释放、真实扣费、真实账单核对、deploy、build/push、kubectl 和 live-test 必须另开 feat/* 并单独授权。

### spec:v22-tencent-readonly-inventory-boundary

Former leaf id: `v22-tencent-readonly-inventory-boundary`
Former title: v22 Tencent Readonly Inventory Boundary

本合同定义 v22 `readonly/tencent inventory` 边界。默认未授权路径不读取 secret、不调用真实腾讯云 / COS / TKE / CVM / 账单 API。本分支范围是 Tencent official SDK readonly 连接：允许把 SDK dependency diff、loader/provider/client 和 readonly smoke 落成可审分支；真实 readonly live 仍只能在用户明确授权下执行，证据只进入 `.runtime` 脱敏 report。

该合同属于 Tencent Provider 合同包，阶段位置是：

`mock/snapshot -> readonly/tencent quote -> dry-run/tencent plan -> TKE bootstrap preflight when no TKE foundation exists -> readonly/tencent inventory -> authorized/tencent create/release -> authorized/tencent deploy -> canary / QA / status update`

## 阶段边界

readonly inventory 只做真实云只读盘点，用来验证云上事实和 Portal 账本是否一致。

它不代表后续不能创建、删除、释放、扩缩容、改标签。创建、删除、释放、扩缩容、改标签属于后续 authorized create/release 阶段，必须另开 feat/* 并单独授权。

readonly inventory 通过后，只能说明后续 create/release 可以进入授权评估；它不能自动执行真实云 mutation，不能自动读取 mutation secret，不能自动释放资源，不能真实扣费。

## Purpose

readonly inventory 要验证：

- 云上有哪些 MedOPL 资源。
- 资源标签是否完整。
- 资源是否能映射到账号、工作空间、resourceBindingId、cloudOperationId / billingAttributionId。
- 是否存在孤儿资源、标签缺失、标签冲突、区域不一致。
- 是否支持后续 T+1 对账和 create/release 安全执行。

inventory 结果只能进入管理员 / 运维审计和后续授权评估，不得成为普通用户云控制台视图。

## Secret 文件模型

允许未来使用 git 外 readonly inventory allowlist secret 文件：

```text
<git-outside-readonly-inventory-secret-file>
```

但 secret 读取必须是 allowlist_only，不允许“一读全读”。readonly inventory 阶段只允许读取以下 key：

- RUN_TENCENT_READONLY_INVENTORY
- TENCENT_READONLY_SECRET_ID
- TENCENT_READONLY_SECRET_KEY
- TENCENT_READONLY_REGIONS
- TENCENT_READONLY_ALLOWED_APIS
- TENCENT_READONLY_COS_METADATA_PROBES（optional，格式为 `region:bucket:object-key`，仅用于 metadata-only HEAD）
- TENCENT_READONLY_ACCOUNT_ID 或等价只读账号标识

明确禁止读取或使用：

- TENCENT_MUTATION_SECRET_ID
- TENCENT_MUTATION_SECRET_KEY
- RUN_TENCENT_CREATE_RELEASE
- LANGFUSE_SECRET_KEY
- GITHUB_TOKEN
- DATABASE_URL
- SSH_PRIVATE_KEY
- kubeconfig
- raw API Key
- 任何非 readonly inventory allowlist 的 key

当前分支的默认 smoke 不读取真实 secret 文件，不验证真实 secret 文件是否存在，不打印 secret 路径内容。任何真实 readonly live 必须单独授权，并且只允许读取 readonly allowlist key。

## API allowlist

readonly inventory 后续授权阶段只允许 Describe / List / Get / Head 类 API，例如：

- 账号身份摘要，只输出脱敏账号标识。
- CVM 实例列表、状态、标签。
- TKE 集群 / namespace / node pool 只读摘要和标签。
- COS bucket 列表、bucket 标签、prefix 用量摘要。
- COS object metadata / HEAD，用于验证文件存在和归属，不读取对象正文。
- Tencent tag resources 只读查询。
- 账单 / 费用只读摘要，如后续单独授权。

禁止 API：

- Create*
- Delete*
- Modify*
- Run*
- Terminate*
- Attach*
- Detach*
- PutBucket*
- PutObject*
- DeleteObject*
- Update*
- Tag mutation
- 权限、策略、bucket policy 修改

readonly inventory 不允许使用任何可能创建、删除、释放、扩缩容、改标签、改权限或改变 bucket policy 的 API。API allowlist 必须显式配置；缺少 allowlist 时 fail-closed。

## COS 对账边界

readonly inventory 不读取 COS 对象正文，不下载用户文件，不打印用户文件内容。

允许读取 bucket / prefix / object metadata、用量摘要、账单明细和资源标签，用于归属校验、文件存在性校验和 T+1 对账。

objectKey、storageKey、cosPrefix、signedUrl 不得进入普通用户 payload、日志或 evidence。管理员 / 运维输出也只能看到脱敏摘要、计数、状态和审计队列项，不能看到可直接定位或下载用户文件的内部存储字段。

`TENCENT_READONLY_COS_METADATA_PROBES` 只能作为 git 外 readonly env 的输入参数使用。runner 可以用它调用 `headObject` 证明对象 metadata 可读，但 report/stdout/evidence 只能输出 `cos-metadata-probe-N` 这类引用、metadata 是否观察到、是否读取正文=false；不得输出 bucket、object key、prefix 或 signed URL。

## 输出边界

inventory 输出只能是脱敏摘要：

- accountMasked
- region
- resourceType
- resourceStatus
- tagCompleteness
- portalMappingStatus
- orphanResourceCount
- missingTagCount
- conflictCount
- auditQueueItems

不得输出：

- SecretId / SecretKey
- token
- kubeconfig
- objectKey / storageKey / cosPrefix / signedUrl
- CVM instance raw full object
- COS object 正文
- bucket policy
- provider raw response 全量

输出必须默认 redacted。任何 raw provider response、raw cloud object、raw billing object 只能留在后端受控调试边界，且必须另行授权；不得进入 Portal payload、日志、evidence 或 git。

## 映射规则

readonly inventory 必须用 Portal 账本 + 云标签双重校验：

- accountId / portal account
- workspaceId
- resourceBindingId
- cloudOperationId
- billingAttributionId
- accountId
- serverPlanId
- runId 可为空
- resource type
- region
- 旧 resource-order 标识不得作为 required tag、optional tag 或归属 alias

不能只靠资源名称、创建时间、IP、规格推断归属。

归属缺失或冲突必须 fail-closed，进入 admin 审计队列。inventory 不得用默认账号、默认 workspace、最近创建时间、IP 段或规格相似度补齐归属。

## 用户删除 / 释放安全

readonly inventory 必须证明后续 release/delete 只能作用于用户自己的资源：

- 删除计算资源前必须证明 resourceBindingId、workspaceId、accountId 一致。
- 删除存储资源/文件空间前必须证明 storage entitlement 和 workspaceId 一致。
- 释放计算资源不得删除文件空间。
- 删除文件空间才进入 7 天保护期。

inventory 通过不能直接触发删除或释放；它只为 authorized create/release 阶段提供只读证据。任何不一致、缺失或冲突都必须阻断 mutation 授权并进入 admin 审计队列。

## 当前分支 Non-Goals

- 不读取真实 secret 文件。
- 不调用真实腾讯云/COS/TKE/CVM/账单 API。
- 不创建、删除、释放、扩缩容、改标签、改权限。
- 不真实扣费。
- 不运行 build/push/kubectl/live-test。
- 不修改 deploy/.sentrux/adapters/upstream/Gateway/Runtime Bridge。
- 不实现真实 inventory provider。
- 不新增 Portal UI。

## Implementation Note: SDK Client Wrapper

SDK adapter 属于 readonly inventory 实现层，不是 create/release。当前分支不读取 secret、不运行真实云盘点。

SDK 只能隐藏在 thin client wrapper 里。业务层只允许使用 inventory client interface，不能暴露 Tencent SDK raw client 或通用 call(apiName, params)。

SDK wrapper 仍必须遵守 allowlist_only、Describe/List/Get/Head only、COS metadata only/no object body、fail-closed ownership 和 redacted contract-whitelisted output。它不允许 Create/Delete/Modify/Run/Terminate 等 mutation API。

## Official SDK Provider Strategy

readonly inventory 的 future authorized provider candidate = Tencent official SDK wrapper。当前 trunk 默认路径仍是合同级、本地 smoke 和 fail-closed gate；业务层只允许依赖 v22 自己的 readonly inventory interface，不直接依赖 Tencent SDK raw client。

hand-rolled TC3 = diagnostic/reference only, not future authorized default readonly live path。TC3 production/default path 已退场；当前 runner 不支持 `tencent-tc3-readonly` sdk-mode，不支持 `--enable-real-fetch`，不能作为 create/release provider，也不能扩大 mutation 权限。

official SDK wrapper 仍必须 obey readonly allowlist、secret allowlist、redaction、RUN gate、no raw SDK exposure。它只能暴露现有语义接口：

- describeAccount
- describeRegions
- describeCvmInstances
- describeTkeClusters
- describeCosBuckets
- describeCosMetadata
- describeBillingSummary
- describeTagResources

禁止 raw SDK client 泄露到业务层。禁止通用 call(apiName, params)。禁止 mutation API。SDK raw response 不得进入 stdout/report/Portal payload。

新增或升级 tencentcloud-sdk-nodejs / cos-nodejs-sdk-v5 依赖必须有用户授权，并由 B 审查 package diff。Package A SDK dependency diff 属于 cloud-lane candidate 事实，不得写成 trunk 默认会自动打云的事实；默认合同 smoke 不读 secret、不打云。当前 cloud-lane candidate 将 SDK 放在 repo root cloud tooling 依赖，Portal package 不拥有 Tencent/COS SDK。

## Implementation Note: Official SDK Dependency Loader

official SDK dependency loader 属于 readonly inventory 实现层，只负责把 `tencentcloud-sdk-nodejs` / `cos-nodejs-sdk-v5` package shape 包成 `createTencentReadonlyInventoryOfficialSdkModules` 可消费的 factories。

loader 不读取 process.env，不 source env，不暴露 raw SDK client。runner 只有在 `--live-readonly`、`--confirm-current-session-authorization`、`--sdk-mode tencent-official-sdk-readonly`、`--enable-official-sdk-loader`、RUN gate 开启、regions 非空且 readonly API allowlist 通过后，才允许读取用户授权的 readonly secret 文件、加载 official SDK package 并调用真实只读 SDK。默认未显式开启时必须 fail-closed，不加载 SDK package，不打云。

loader 不暴露 raw SDK client，不暴露通用 call(apiName, params)，不暴露 Create/Delete/Modify/Run/Terminate/Put/Update/Attach/Detach/Tag mutation。SDK raw response、endpoint、authorization header、SecretId/SecretKey、token、objectKey/storageKey/cosPrefix/signedUrl 不得进入 stdout、report、Portal payload 或 evidence。

Implementation shape note: `tencentcloud-sdk-nodejs` covers the readonly account/CVM/TKE/billing/tag client shapes used by this inventory path, but does not provide COS bucket/object metadata access. Full cloud connection therefore requires `cos-nodejs-sdk-v5` or a dedicated COS implementation path. COS bucket list is metadata-only; COS object metadata HEAD requires explicit metadata probes and must fail closed with sanitized blockers when probes are missing. The runner never reads COS object bodies.

## COS SDK Dependency Decision

`cos-nodejs-sdk-v5` is part of the future authorized SDK dependency package for the cloud connection loop. Package A root dependency installation is cloud-lane candidate evidence, not a default unauthorized live execution path.

Before a full readonly cloud report can be accepted, shape smoke must prove:

- `tencentcloud-sdk-nodejs` can load STS / CVM / TKE / billing / tag client shapes.
- `cos-nodejs-sdk-v5` can support bucket list, bucket/prefix metadata or equivalent metadata-only file-space evidence.
- COS object bodies are not read.
- bucket policy, objectKey, storageKey, cosPrefix and signedUrl do not enter stdout, report, Portal payload, evidence or git.

If `cos-nodejs-sdk-v5` is not installed, COS shape is unavailable, or explicit metadata probes are missing, the official readonly path can still run a non-COS account/TKE/billing/tag report, but it cannot mark the full storage/file-space connection complete.

cleanup 策略：

- official SDK readonly live 已跑通并由 B closeout 接受。
- TC3 已从 future authorized default candidate 退场。
- TC3 只可保留为 isolated diagnostic / provenance reference。
- TC3 不能作为 create/release 或默认 readonly live 主路径。

cloud-lane candidate 已记录 SDK dependency / loader / readonly client 连接形状；默认未授权状态仍是 `defaultExecutable=false`、`readsSecretNow=false`。调用真实 readonly 云 API 只能发生在用户当前会话显式授权的 live readonly 路径中，且只证明 readonly connection 可生成脱敏审计摘要；它不证明 Portal canonical mapping 已完成，不允许 mutation 自动推进。本合同不改 create/release mutation 边界、不读取 mutation secret、不执行 mutation、不改 deploy、不 kubectl、不 merge、不 push。

## Live Readonly Authorization Note

live readonly 只允许读取用户当前会话明确授权的 git 外 readonly inventory secret 文件，且只允许读取 `TENCENT_READONLY_*` allowlist key。必须要求 `RUN_TENCENT_READONLY_INVENTORY=1`，并且只允许调用 check-config 已通过的 Describe/List/Get/Head 类 API。

禁止 Create/Delete/Modify/Run/Terminate/Put/Update/Attach/Detach/Tag mutation。输出只能写 `.runtime/v22-tencent-readonly-inventory/*.json`，stdout 只打印脱敏摘要；不写 git，不写 docs，不贴 raw response。

live readonly 不创建、不删除、不释放、不扩缩容、不改标签、不扣费。权限/限流/region 错误只进入安全 audit summary。真实 live run 必须由用户在当前会话单独授权后执行。

runner 只有在 `--sdk-mode tencent-official-sdk-readonly`、`--enable-official-sdk-loader`、`RUN_TENCENT_READONLY_INVENTORY=1`、allowlist 通过、用户单独授权执行时，才允许加载 official SDK package 并调用真实只读 SDK。默认 smoke 和 CI 不运行真实云。

Package B authorized readonly evidence can close only when explicit COS metadata probes are configured, the official SDK run returns `ok: true`, stdout/report remain redacted, blockers are empty, and boundary flags prove `callsMutationApi=false` and `readsCosObjectBody=false`. This evidence remains a readonly connection audit summary only; it does not complete Portal ledger mapping, does not inventory every COS object, does not authorize create/release, and does not prove production cloud is online.

`--sdk-mode tencent-real-readonly` 只保留为 dependency-injected SDK modules 的兼容测试入口，用来证明 runner 的 readonly gate、regions、API allowlist、redaction 和 mutation rejection；它不能作为 future authorized provider candidate，不能加载 raw SDK package，不能绕过 official SDK dependency loader 合同。

TC3 readonly modules 不再是 readonly inventory live client implementation。runner 不支持 `tencent-tc3-readonly` sdk-mode，不支持 `--enable-real-fetch`，也不会把 `globalThis.fetch` 注入 TC3 modules。历史 TC3 只能作为 provenance / diagnostic reference，不能进入 production path、future authorized default path 或 create/release provider。

## Contract Data

<!-- v22-tencent-readonly-inventory-contract:start -->
```json
{
  "contract": "v22_tencent_readonly_inventory_boundary",
  "version": 1,
  "providerPackage": "Tencent Provider",
  "stage": "readonly/tencent inventory",
  "route": "mock/snapshot -> readonly/tencent quote -> dry-run/tencent plan -> readonly/tencent inventory -> authorized/tencent create/release",
  "futureAuthorizedProviderCandidate": "tencent_official_sdk_wrapper",
  "tc3ProviderStrategy": "diagnostic_reference_only",
  "officialSdkWrapperExposesOnlyReadonlyInventoryInterface": true,
  "rawSdkClientExposedToBusinessLayer": false,
  "genericApiCallExposed": false,
  "sdkRawResponseAllowedInStdoutReportOrPortalPayload": false,
  "newSdkDependencyRequiresUserAuthorizationAndPackageDiffReview": true,
  "requiredSdkDependencies": [
    "tencentcloud-sdk-nodejs",
    "cos-nodejs-sdk-v5"
  ],
  "contractBranchInstallsSdkDependency": false,
  "cloudLaneCandidateInstallsSdkDependency": true,
  "installedSdkDependencies": [
    {
      "name": "tencentcloud-sdk-nodejs",
      "version": "4.1.245"
    },
    {
      "name": "cos-nodejs-sdk-v5",
      "version": "2.15.4"
    }
  ],
  "fullCosConnectionRequiresCosNodejsSdkV5": true,
  "removeTc3BeforeOfficialSdkLivePass": false,
  "tc3AllowedAsCreateReleaseProvider": false,
  "changesCreateReleaseMutationBoundary": false,
  "defaultExecutable": false,
  "implementsRealCloudCallNow": false,
  "readsSecretNow": false,
  "authorizedReadonlyLiveCapable": true,
  "defaultUnauthorizedPathFailsClosed": true,
  "requiresCurrentSessionExplicitAuthorization": true,
  "authorizedReadonlyLiveReport": {
    "path": ".runtime/v22-tencent-readonly-inventory/<authorized-run-id>.json",
    "redactedOnly": true,
    "provesReadonlyConnectionOnly": true,
    "doesNotProvePortalCanonicalMappingComplete": true,
    "doesNotAuthorizeMutation": true
  },
  "futureSecretFileAllowed": true,
  "futureSecretFile": "<git-outside-readonly-inventory-secret-file>",
  "secretLoadMode": "allowlist_only",
  "forbidsReadAllSecretFile": true,
  "allowedReadonlySecretKeys": [
    "RUN_TENCENT_READONLY_INVENTORY",
    "TENCENT_READONLY_SECRET_ID",
    "TENCENT_READONLY_SECRET_KEY",
    "TENCENT_READONLY_REGIONS",
    "TENCENT_READONLY_ALLOWED_APIS",
    "TENCENT_READONLY_COS_METADATA_PROBES",
    "TENCENT_READONLY_ACCOUNT_ID"
  ],
  "forbiddenSecretKeys": [
    "TENCENT_MUTATION_SECRET_ID",
    "TENCENT_MUTATION_SECRET_KEY",
    "RUN_TENCENT_CREATE_RELEASE",
    "LANGFUSE_SECRET_KEY",
    "GITHUB_TOKEN",
    "DATABASE_URL",
    "SSH_PRIVATE_KEY",
    "kubeconfig",
    "raw API Key"
  ],
  "allowedApiVerbs": [
    "Describe",
    "List",
    "Get",
    "Head"
  ],
  "forbiddenApiVerbs": [
    "Create",
    "Delete",
    "Modify",
    "Run",
    "Terminate",
    "Attach",
    "Detach",
    "PutBucket",
    "PutObject",
    "DeleteObject",
    "Update",
    "TagMutation",
    "PolicyMutation"
  ],
  "allowsCosMetadataAndUsageRead": true,
  "forbidsCosObjectBodyRead": true,
  "allowsBillingSummaryReadAfterSeparateAuthorization": true,
  "outputRedactionRequired": true,
  "allowedOutputFields": [
    "accountMasked",
    "region",
    "resourceType",
    "resourceStatus",
    "tagCompleteness",
    "portalMappingStatus",
    "orphanResourceCount",
    "missingTagCount",
    "conflictCount",
    "auditQueueItems"
  ],
  "forbiddenOutputFields": [
    "SecretId",
    "SecretKey",
    "token",
    "kubeconfig",
    "objectKey",
    "storageKey",
    "cosPrefix",
    "signedUrl",
    "cvmInstanceRawFullObject",
    "cosObjectBody",
    "bucketPolicy",
    "providerRawResponse"
  ],
  "requiresPortalLedgerAndCloudTagMatch": true,
  "requiredOwnershipTags": [
    "accountId",
    "workspaceId",
    "resourceBindingId",
    "cloudOperationId",
    "billingAttributionId",
    "serverPlanId",
    "resourceType",
    "region",
    "retiredResourceOrderIdentifiersForbidden"
  ],
  "runIdMayBeNull": true,
  "forbidsOwnershipInferenceByNameTimeIpOrSpec": true,
  "failClosedOnMissingOrConflictingOwnership": true,
  "createReleaseMayProceedAfterInventoryPass": true,
  "inventoryPassDoesNotExecuteMutation": true,
  "computeReleaseDeletesFileSpace": false,
  "fileSpaceDeleteTriggersRetentionDays": 7
}
```
<!-- v22-tencent-readonly-inventory-contract:end -->

### spec:v22-tencent-readonly-quote-provider-boundary

Former leaf id: `v22-tencent-readonly-quote-provider-boundary`
Former title: v22 Tencent Readonly Quote Provider Boundary

本合同定义 v22 腾讯云 `readonly/tencent quote provider` 的接口边界。当前只做 interface、mock adapter、合同和 smoke，不读取 secret，不调用真实腾讯云 API。

## Purpose

该 provider 为后续真实腾讯云价格/规格读取做接口准备。它只输出 Portal 可消费的普通业务对象：

```json
{
  "regionLabel": "硅谷一区",
  "planSpec": "8核 / 16GB 内存 / 100GB 文件空间",
  "estimatedCost": {
    "amount": 0,
    "currency": "CNY",
    "source": "contract_snapshot",
    "status": "mock_snapshot",
    "billingTruth": false,
    "chargeApplied": false
  },
  "quoteSource": "mock/tencent-readonly-quote-provider",
  "quoteStatus": "mock_snapshot",
  "quoteSnapshotId": "quote-snapshot-v22-pro-8c16g-100gb"
}
```

## Current Adapter

当前 adapter 是 mock/snapshot adapter：

- 只能使用 contract/mock/snapshot 数据。
- 不创建、绑定或释放资源。
- 不做真实扣费。
- 不调用真实腾讯云、COS、Langfuse 或 one-person-lab API。
- 不读取 `/home/dev/.secrets/medopl/secrets.env.txt` 或任何本地 secret。
- 不读取 SecretId、SecretKey、kubeconfig、token、raw API Key。

## Forbidden Response Fields

Provider response 不得包含：

- SecretId / SecretKey
- kubeconfig
- token / bearer token
- raw API Key
- provider raw cost internals
- CVM / COS / K8s / TKE 内部对象
- objectKey / storageKey / localPath / signedUrl

普通用户 payload 仍只能看到托管运行环境、区域、规格、预计费用、状态等产品语言，不出现云控制台主语言。

## Adapter Route

后续真实腾讯云接入路线保持：

`mock/snapshot -> readonly/tencent quote -> dry-run/tencent plan -> TKE bootstrap preflight when no TKE foundation exists -> readonly/tencent inventory -> authorized/tencent create/release -> authorized/tencent deploy -> canary / QA / status update`

等价阶段名：`mock/snapshot provider -> readonly/tencent quote provider -> dry-run/tencent plan provider -> TKE bootstrap preflight when no TKE foundation exists -> readonly/tencent inventory provider -> authorized/tencent create/release provider -> authorized/tencent deploy provider -> canary / QA / status update`

真实腾讯云 readonly 接入、SDK 选择、API 凭据读取、限流、重试、审计日志和真实 quote source 均必须另开 feat/* 并单独授权。

### spec:v22-tencent-tc3-diagnostic-cleanup-plan

Former leaf id: `v22-tencent-tc3-diagnostic-cleanup-plan`
Former title: v22 Tencent TC3 Diagnostic Cleanup Plan

本记录定义 hand-rolled TC3 的 cleanup closeout：TC3 production/default path 已退场，只保留静态 diagnostic / provenance 角色；本 cleanup 不读取 secret、不调用真实云、不修改 official SDK implementation、不改 create/release。

## 背景

v22 provider strategy 的 future authorized provider candidate 是 Tencent official SDK wrapper；当前 trunk 默认路径仍是合同级、本地 smoke 和 fail-closed gate。

hand-rolled TC3 当前降级为 diagnostic/reference only。它可以继续作为诊断和参考实现存在，但不能重新成为 future authorized default readonly live path，不能成为 create/release provider，也不能扩大 mutation 权限。

official SDK readonly live 已跑通并由 B closeout 接受。

TC3 production path cleanup 已执行：runner 不支持 `tencent-tc3-readonly` sdk-mode，也不支持 `--enable-real-fetch`。

## 退场条件

TC3 production path cleanup 启动条件已满足：

- official SDK wrapper 合并。
- official SDK 依赖合并。
- official SDK readonly live 成功生成脱敏 report。
- B 审查确认 future authorized provider candidate 不再依赖 TC3。

cleanup 后，TC3 只能保持 diagnostic/reference only，不能删除，也不能把它恢复为 future authorized default readonly live path。

## Cleanup 内容

本 cleanup 分支处理以下内容：

- runner 不支持 tencent-tc3-readonly sdk-mode。
- TC3 smoke 已退为静态 diagnostic contract。
- TC3 live bridge 不在生产路径或 future authorized default path。
- 历史 TC3 只保留为 provenance / diagnostic reference。

cleanup 分支必须证明 future authorized provider candidate 仍是 Tencent official SDK wrapper，业务层仍只依赖 v22 readonly inventory interface，TC3 没有被 create/release 或默认 readonly live 主路径继续引用。

## 保留 / 删除策略

后续保留策略：

- 保留静态 TC3 diagnostic contract，用于防止 TC3 回到 default path。
- 不保留 TC3 live bridge 或相关 production path。
- 若后续删除全部 TC3 诊断引用，必须另开 cleanup 分支并证明 official SDK readonly live 已覆盖当前诊断价值。

具体删除历史/诊断引用仍需另开 cleanup 分支；本分支只关闭 production/default path。

## 非目标

- 不读 secret。
- 不调用真实云。
- 不改 official SDK implementation。
- 不改 create/release。
- 不安装 SDK 依赖。
- 不删除历史/provenance 文字。
- 不删除静态 TC3 diagnostic contract。

## 验收

本 cleanup 分支只通过静态合同 smoke 验收：

```bash
node tests/future-authorized/cloud/future-authorized-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs
node tests/contract/contract-test-v22-mvp-contract-suite.mjs
git diff --check -- docs/specs scripts
```

## Contract Data

<!-- v22-tencent-tc3-diagnostic-cleanup-plan:start -->
```json
{
  "contract": "v22_tencent_tc3_diagnostic_cleanup_plan",
  "version": 1,
  "tc3CurrentRole": "diagnostic_reference_only",
  "cleanupExecuted": true,
  "tc3ProductionPathRetired": true,
  "runnerSupportsTencentTc3Readonly": false,
  "tc3SmokePolicy": "static_diagnostic_contract",
  "callRealCloudNow": false,
  "readSecretNow": false,
  "changesOfficialSdkImplementation": false,
  "changesCreateRelease": false,
  "futureAuthorizedProviderCandidate": "tencent_official_sdk_wrapper"
}
```
<!-- v22-tencent-tc3-diagnostic-cleanup-plan:end -->

### spec:v22-token-provider-boundary

Former leaf id: `v22-token-provider-boundary`
Former title: v22 Token Provider Boundary Contract

本合同定义 MedOPL v22 的 API token 业务和密钥边界。

## Provider

MedOPL 的 OpenAI-compatible API 中转站 base URL 是：

```text
https://gflabtoken.cn/v1
```

商业目标之一是销售 token/API 使用额度。

## OPL Entry / User Provider Binding

MedOPL 托管运行环境、文件空间、账单、审计和 Gateway / Runtime Bridge；模型调用凭证由每个用户提供自己的 gflabtoken API Key：

- portal.medopl.cn 登录不需要 gflabtoken API Key。
- opl.medopl.cn entry/preflight 或工作台 provider 绑定面接收用户自己的 gflabtoken API Key。
- 如果用户已绑定，可以显示“已绑定”，不要求重复输入。
- gflabtoken.cn 网站本身不进入 MedOPL 用户主流程。
- Portal 可以展示“是否已绑定”状态。
- API Key 不是 Portal 普通登录字段。
- raw API Key 只能进入后端密钥边界，不能返回前端、不能写日志、不能进 git。

绑定后：

- 前端最多保留一次性输入态、`providerKeyRef` 和 bound status。
- 后端对 Portal 和 OPL 运行边界暴露引用状态，不暴露 raw key。

## Forbidden Storage

以下内容不能写入 sessionStorage、localStorage、global JS state、log、evidence 或 git：

- raw API Key
- bearer token
- launchToken
- runtimeToken
- secret

## Runtime Use

托管 runtime 任务必须使用用户自己的 gflabtoken `providerKeyRef` 访问后端密钥边界。未开通 runtime 的租户可以绑定 API key，但不能因此获得托管 runtime 执行能力；没有 `providerKeyRef` 时必须返回 `provider_key_required`。

### spec:v22-trace-metadata-boundary

Former leaf id: `v22-trace-metadata-boundary`
Former title: v22 Trace Metadata Boundary Contract

本合同定义 MedOPL v22 的 session trace metadata 边界。

## Purpose

Portal 可以保留必要 session trace metadata，用于：

- 轨迹跟踪
- 审计
- 排障
- workspace 和 run 状态关联

## Allowed Metadata

允许保留的 metadata 必须是最小必要集合，例如：

- tenant id
- user id
- workspace id
- session id
- run id
- resource binding id
- billing account id
- audit tag / cost allocation tag
- timestamp
- status
- artifact reference

## Forbidden Data

metadata 不能包含：

- raw prompt
- raw input
- raw output
- raw completion
- raw API key
- provider key
- bearer token
- launchToken
- runtimeToken
- secret
- object path
- objectKey
- storageKey
- localPath
- signedUrl
- presignedUrl
- 可还原敏感内容的完整请求或响应正文

## Langfuse

Langfuse 可以作为后续 session trace metadata 来源，但不是当前 v22 主产品叙事。具体接入必须单独设计，并继续满足本合同的最小化和脱敏边界。

### spec:v22-upstream-opl-boundary

Former leaf id: `v22-upstream-opl-boundary`
Former title: v22 Upstream OPL Boundary Contract

本合同定义 MedOPL v22 与 one-person-lab upstream 的边界。

## Upstream

one-person-lab 是 clean upstream：

```text
https://github.com/gaofeng21cn/one-person-lab
```

## Rules

- upstream 目录只读/clean。
- 不修改 upstream 源码。
- 不写 MedOPL 代码进 upstream。
- 不在 upstream 目录写 Portal、Gateway、Runtime Bridge 代码。
- 不 import upstream 内部模块。
- 不把 Portal 账号、计费、资源开通、密钥管理或审计逻辑写进 upstream。
- 不把 Portal 账号、计费、资源、gflabtoken、trace、Langfuse、腾讯云逻辑写进 upstream。
- Portal / Gateway / Runtime Bridge / Runtime Agent / Langfuse / 腾讯云逻辑不得写进 upstream。

## Adaptation

upstream 更新后，平台拉取更新，并通过以下公开边界适配：

- OPL Web Gateway
- Runtime Bridge
- Runtime Agent
- API/CLI
- 反向代理边界

只能通过 OPL Web Gateway、Runtime Bridge / Runtime Agent、公开 API/CLI 或反向代理边界接入。

## Real Main-Repo Canary Findings

截至 2026-05-10，本地真实 canary 对 `/home/dev/projects/one-person-lab` 主仓验证结果如下：

- `opl web` 真实执行返回 `cli_usage_error`，`retired=true`；主仓当前不提供可启动的本地 Product API Web 进程。
- 主仓当前没有暴露 `/api/opl/system`、`/api/opl/messages`、`/api/opl/sessions` 这类 HTTP Product API endpoint；这些 endpoint 只能通过未来独立 WebUI/Product API provider 或 Gateway/Runtime Bridge 映射层接入，不能由 fake Product API smoke 代替真实结论。
- `opl session runtime --acp` 是当前可验证的公开 CLI/ACP 边界；canary 已验证 `initialize`、`session_list`、`session_ledger` 可访问。
- `workspace_list` 虽出现在 ACP command list 中，但隔离 canary 返回 `invalid_payload`；在映射层完成并验证前必须标记为 `capability_not_supported`。
- OPL Web Gateway 配置 `OPL_UPSTREAM_URL` 指向不可用真实 Web 时必须 fail closed，不得回退到旧端口、旧 workbench 或 fake upstream。
- Runtime Bridge 可在 `OPL_RUNTIME_MODE=acp`、`OPL_ACP_RUNTIME_DIR=/home/dev/projects/one-person-lab` 下通过真实 ACP runtime 完成 bootstrap 和 session bind，并写回 Runtime Bridge state。

上述结论只证明主仓真实 canary 边界；不证明独立 OPL WebUI、真实浏览器交互、真实 provider key 调用或生产部署已完成。

## Real WebUI Canary Findings

截至 2026-05-10，本地真实 WebUI canary 对已构建的 OPL/AionUI WebUI 运行态验证结果如下：

- 真实 WebUI 进程可启动为独立 Web server；`GET /` 返回 One Person Lab Web app HTML，`GET /api/auth/status` 和 `GET /api/auth/user` 可在 `OPL_WEBUI_AUTH_MODE=none` 的隔离 canary 环境返回真实用户上下文。
- WebUI 的 `/api/opl/system`、`/api/opl/sessions`、`/api/opl/messages` 虽然 `GET` 返回 200，但源码与 canary 均证明它们命中通用 `/api` catch-all，只返回 `API endpoint - bridge integration working`；这不是 Product API，必须分类为 `capability_not_supported`，不能被 Gateway/Runtime Bridge 当成真实 Product API。
- WebUI 的真实业务协议是 browser WebSocket bridge，而不是 `/api/opl/*` HTTP Product API；canary 已通过 `create-conversation`、`database.get-user-conversations` 和 `database.get-conversation-messages` 验证真实 session 创建和数据库回读。
- OPL Web Gateway 指向真实 WebUI 后可代理 HTML、注入 launch script、拒绝 secret query，并可代理 WebSocket bridge 完成 session 创建和数据库回读。
- Runtime Bridge 在 `OPL_RUNTIME_MODE=webui` 下可通过 WebSocket bridge 创建真实 WebUI conversation，并把 session 创建和 database 回读投影到 MedOPL bootstrap/state；该映射属于 Gateway/Runtime Bridge anti-corruption layer，不修改 WebUI/upstream 源码。
- 2026-05-10 discovery 阶段只证明 `chat.send.message` 能进入 WebUI WebSocket bridge 并触发后端 agent 启动路径；当时未配置可用 provider/agent 登录，必须标记为 `capability_not_supported`。
- 历史授权 provider message live canary 脱敏 evidence 曾观察到，在用户显式授权 `REAL_OPL_PROVIDER_MESSAGE_CANARY=1`、`OPL_PROVIDER_SECRET_FILE` 和真实 WebUI 来源后，message reply 可按 `mapped_to_webui_bridge` 回流 Portal message status 与 Portal session trace。该 evidence 只证明当次授权路径的 message/reply，不证明 HTTP Product API、真实 WebUI file upload、run/artifact、真实云 runtime、生产部署或 Langfuse 已上线；后续再次执行必须重新授权。

上述结论只证明真实 WebUI 进程、页面、认证上下文、WebSocket session bridge、Gateway proxy、Runtime Bridge session bridge，以及历史授权 canary 下的 provider message reply 曾可接通；不证明 HTTP Product API、真实 WebUI 文件上传、run/artifact、真实云 runtime、生产部署或 Langfuse 已上线；后续再次执行必须重新授权。

## Local Gateway Proxy

v22 本地最小代理链路必须满足：

- OPL Gateway 通过 `OPL_UPSTREAM_URL` 显式配置 clean upstream one-person-lab Web。
- 不硬编码 v19/v20/v21 upstream 路径，不使用旧 direct upstream path 作为默认值。
- 未配置 `OPL_UPSTREAM_URL` 时，Gateway 返回稳定错误 `opl_upstream_url_required`，不得降级到本地旧端口、旧目录或 legacy route。
- Gateway 只代理 upstream HTML 或健康响应，并注入公开启动上下文。
- 注入/暴露给 upstream 的公开上下文只包含 `workspaceId`、`sessionId`/`launchStatus`、`providerBound`、`providerKeyRef` 和 Portal return URL。
- raw API Key、launchToken、runtimeToken、bearer token、objectKey、localPath、signedUrl 不进入 upstream、URL query、response、log、localStorage 或 sessionStorage。
- launchToken/runtimeToken/apiKey 不得通过 URL query 传递；Gateway 必须拒绝这类 query。
- Gateway 可以使用 httpOnly cookie 或服务端状态保存 launch context。
- 本地 proxy smoke 只验证合同和本地 fixture，不部署、不调用真实云 API，不修改 upstream。

## Product Entry

用户不能通过 direct upstream path 作为 v22 产品入口。用户可见入口必须是 Portal “进入 OPL 工作台”或 /opl/entry/preflight。

MedOPL 有两种进入 OPL Web 的路径：

- 路径 1：从 Portal SaaS 后台进入。
- `portal.medopl.cn -> Portal 工作空间 / “进入 OPL 工作台”按钮 -> Gateway launch / preflight -> clean upstream one-person-lab Web`
- 路径 2：直接访问 OPL 工作台。
- `opl.medopl.cn -> OPL Gateway entry -> MedOPL 账号/密码 preflight -> clean upstream one-person-lab Web`

两条路径最终进入同一套 Gateway / preflight / launch 逻辑。该逻辑必须保持 MedOPL 的 tenant、workspace、runtime availability、resource binding 和 token provider boundary，不绕过 Portal 控制面。

用户可见入口不是 /internal/opl/auth/login。/internal/opl/auth/login 只能是 internal implementation path。

### spec:v22-user-credit-provider-boundary

Former leaf id: `v22-user-credit-provider-boundary`
Former title: v22 User Credit Provider Key Boundary Contract

本合同定义 MedOPL v22 MVP 托管 OPL 闭环第一段：平台准备用户、给用户充值、绑定用户自己的 gflabtoken provider key，并输出 canonical state readiness。

## Product Boundary

MedOPL 是面向 AI 小白科研用户的 OPL 科研托管平台，不是云资源控制台。本合同只覆盖用户、余额、用户自己的 gflabtoken provider key readiness 和托管运行环境开通前置条件，不开通 CVM/COS/TKE，不调用真实云 API，不进入 OPL Gateway、Runtime Bridge、deploy 或 one-person-lab upstream。

## Entry Truth

- portal.medopl.cn 登录不需要 gflabtoken API Key。
- opl.medopl.cn entry/preflight 或工作台 provider 绑定面接收用户自己的 gflabtoken API Key。
- 如果用户已绑定，可以显示“已绑定”，不要求重复输入。
- gflabtoken.cn 网站本身不进入 MedOPL 用户主流程。
- Portal 可以展示“是否已绑定”状态，但 API Key 不是 Portal 普通登录字段。
- 后端可以保留 provider key binding 能力，但用户可见入口必须属于 OPL entry/preflight，不属于 Portal 普通登录。

## Flow

1. 平台创建或准备 1 名用户。
2. 平台给该用户充值额度。
3. 用户登录 `portal.medopl.cn`；Portal 登录不要求 gflabtoken API Key。
4. 用户进入 `opl.medopl.cn` 时使用 MedOPL 账号密码，并提交或复用自己的 gflabtoken API Key；已绑定时展示“已绑定”。
5. raw API Key 只能进入后端密钥边界，不能返回前端、不能写日志、不能进 git。
6. API response / canonical state 只暴露 `providerKeyRef` 和 bound status。
7. canonical state 输出 `identity`、`tenant`、`balance`、`providerBound`、`providerKeyRef`、`readyForManagedEnvironment`。
8. 缺少用户自己的 gflabtoken `providerKeyRef` 时，托管运行环境 readiness / open 和 managed run 必须返回 `provider_key_required`。

## Secret Boundary

- raw API Key 只能写入后端 `providerSecretStore`。
- Portal API response、canonical state、日志、evidence 和 git 不得包含 raw API Key。
- Portal API response、canonical state、日志、evidence 和 git 不得包含 `launchToken`、`runtimeToken`、bearer token 或 provider secret。
- 用户侧只可见 `providerKeyRef`、`providerBound` 和 bound status。

## Canonical State Contract

`/api/canonical-state` 和 `/api/state` 必须返回：

```json
{
  "identity": "current user public identity",
  "tenant": "current tenant public identity",
  "balance": "wallet and ledger summary",
  "providerBound": true,
  "providerKeyRef": "backend secret reference only",
  "readyForManagedEnvironment": true
}
```

当用户自己的 provider key 未绑定时：

```json
{
  "providerBound": false,
  "providerKeyRef": "",
  "readyForManagedEnvironment": false,
  "readiness": {
    "ready": false,
    "reason": "provider_key_required"
  }
}
```

## API Surface

本轮最小 Go control-plane API 小闭包：

- `POST /api/v22/users/prepare`
  - Go control-plane local RC 准备用户、tenant、默认 workspace 和 wallet projection。
  - 响应只返回 public projection，不返回 raw provider key、token 或 provider secret。
- `POST /api/v22/users/credit`
  - Go control-plane local RC 给用户充值额度 projection，并保留账务 owner 语义。
  - 响应只返回 public balance / ledger projection。
- `POST /api/v22/provider-key`
  - Go control-plane provider key binding 能力，用于接收用户自己的 gflabtoken API Key。
  - 该能力不是 Portal 普通登录字段，也不改变 portal.medopl.cn 登录不需要 gflabtoken API Key 的规则。
  - raw API Key 只进入后端密钥边界。
  - 响应只返回 `providerKeyRef`、`providerBound` 和 bound status。
- `POST /api/v22/managed-environment/readiness`
  - 未绑定用户自己的 provider key 时返回 428 和 `provider_key_required`。
- `POST /api/v22/managed-environment/open`
  - Go control-plane local RC 打开托管环境 projection，返回 launch、Gateway、resourceBinding 和 providerKeyRef 的 public projection。

Legacy Node Portal paths `POST /api/v22/users/prepare`、`POST /api/v22/users/credit`、`POST /api/v22/provider-key`、`POST /api/v22/managed-environment/readiness`、`POST /api/v22/managed-environment/open`、`POST /api/v22/managed-environment/release` 和 `/api/v22/opl-work/*` 已从 active Node code surface 物理清退。它们不能作为当前 Portal control-plane truth、Node/Go 双控制面、real-cloud readiness evidence 或 production API 入口。

## Non-goals

- 不在本合同内实现 frontend；Portal frontend 改动必须由对应 UI leaf、Figma source 和 frontend surface eval 授权。
- 不改 OPL Gateway。
- 不改 Runtime Bridge。
- 不改 deploy、`.sentrux` 或 `adapters`。
- 不修改 one-person-lab upstream。
- 不读取 `/home/dev/.secrets/medopl/secrets.env.txt`。
- 不调用真实云 API。
- 不运行 build/push/kubectl/live-test。
