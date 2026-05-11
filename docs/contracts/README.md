# v22 合同索引

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

- [v22-mvp-managed-opl-loop.md](./v22-mvp-managed-opl-loop.md): MVP 托管 OPL 用户闭环主合同，定义从平台创建用户、充值、登录 Portal、在 OPL entry/preflight 输入或确认 gflabtoken 模型调用密钥、开通托管运行环境、进入 OPL 科研工作台、产出文件到释放环境和审计的 contract-level 主路径。portal.medopl.cn 登录不需要 gflabtoken API Key；opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key。
- [v22-saas-portal-opl-ops-surface-boundary.md](./v22-saas-portal-opl-ops-surface-boundary.md): Portal SaaS、OPL Web、平台运维视图/运维面的共享界面合同，固定普通用户中文产品语言、OPL 双入口、运维可见边界、多租户后台边界和腾讯云分账标签边界。路径 1：从 Portal SaaS 后台进入；路径 2：直接访问 OPL 工作台；两条路径最终进入同一套 Gateway / preflight / launch 逻辑。

## 用户闭环段合同

- pricing snapshot: [v22-pricing-snapshot-boundary.md](./v22-pricing-snapshot-boundary.md)
- user credit provider key: [v22-user-credit-provider-key-boundary.md](./v22-user-credit-provider-key-boundary.md)
- managed environment open / managed resource binding plan view: [v22-managed-environment-open-boundary.md](./v22-managed-environment-open-boundary.md)
- Portal-OPL connection: [v22-portal-opl-connection-boundary.md](./v22-portal-opl-connection-boundary.md)
- opl work message file run: [v22-opl-work-message-file-run-boundary.md](./v22-opl-work-message-file-run-boundary.md)
- runtime bridge session/run/file/providerKeyRef: [v22-runtime-bridge-session-run-file-provider-keyref-boundary.md](./v22-runtime-bridge-session-run-file-provider-keyref-boundary.md)
- portal files billing trace: [v22-portal-files-billing-trace-boundary.md](./v22-portal-files-billing-trace-boundary.md)
- release stop billing audit: [v22-release-stop-billing-audit-boundary.md](./v22-release-stop-billing-audit-boundary.md)

## 共享边界合同

- token/provider key: [v22-token-provider-boundary.md](./v22-token-provider-boundary.md), [v22-user-credit-provider-key-boundary.md](./v22-user-credit-provider-key-boundary.md), [v22-opl-entry-preflight-auth-boundary.md](./v22-opl-entry-preflight-auth-boundary.md)。API Key 输入框放在 OPL 登录页密码下面；Portal 可以展示“是否已绑定”状态，但 API Key 不是 Portal 普通登录字段；gflabtoken.cn 网站本身不进入 MedOPL 用户主流程。
- resource plan: [v22-resource-plan-boundary.md](./v22-resource-plan-boundary.md)
- tenant/resource binding: [v22-tenant-resource-binding-boundary.md](./v22-tenant-resource-binding-boundary.md), [v22-managed-environment-open-boundary.md](./v22-managed-environment-open-boundary.md)
- managed resource binding plan / mock snapshot: [v22-managed-environment-open-boundary.md](./v22-managed-environment-open-boundary.md)。当前只展示托管运行环境计划摘要，不代表真实资源已创建；后续真实腾讯云接入路线为 `mock/snapshot provider -> readonly/tencent quote provider -> dry-run/tencent plan provider -> readonly/tencent inventory provider -> authorized/tencent create/release provider`，真实接入另开 feat/* 并单独授权。
- readonly/tencent quote provider: [v22-tencent-readonly-quote-provider-boundary.md](./v22-tencent-readonly-quote-provider-boundary.md)。当前只定义 interface 和 mock adapter，输出 `regionLabel`、`planSpec`、`estimatedCost`、`quoteSource`、`quoteStatus`、`quoteSnapshotId`，不读取 secret，不调用真实腾讯云 API。
- dry-run/tencent resource plan provider: [v22-tencent-dry-run-resource-plan-provider-boundary.md](./v22-tencent-dry-run-resource-plan-provider-boundary.md)。当前只基于 readonly quote 和 managed resource binding plan 生成不会执行的资源创建计划，输出 `resourcePlanId`、`resourceBindingId`、`planMode`、`resourceSteps`、`approvalRequired`、`releasePolicy`、`auditStatus`、`riskNotes` 等业务字段；`realResourceCreated` 和 `chargeApplied` 不属于 `resourcePlan` 顶层字段。
- readonly/tencent inventory: [v22-tencent-readonly-inventory-boundary.md](./v22-tencent-readonly-inventory-boundary.md)。当前只定义真实云只读盘点合同，用来验证云上事实和 Portal 账本是否一致；未来 secret 文件只能 allowlist_only 读取 readonly inventory keys，不允许“一读全读”；仅允许 Describe/List/Get/Head 类只读 API，不读取 COS 对象正文，不调用 mutation API，不创建、删除、释放、扩缩容或改标签。
- production cloud topology: [v22-production-cloud-topology-boundary.md](./v22-production-cloud-topology-boundary.md)。当前只是合同，定义 CLB / TKE / CBS / NAT / Redis / PostgreSQL 在 MedOPL v22 生产拓扑中的角色；不代表已部署、已接入或已验证，不读取 secret，不调用真实云，不改 deploy，不 kubectl，不 build/push，不创建/删除资源。普通用户产品语言不展示这些云资源名；region/VPC/subnet/security group/resource tag/cost allocation 后续进入 readonly inventory 和 deploy plan。
- cloud onboarding workflow: [v22-cloud-onboarding-workflow-boundary.md](./v22-cloud-onboarding-workflow-boundary.md)。该 repo-tracked cloud onboarding workflow 合同把 official SDK provider strategy、wrapper、dependency loader、check-config、default gate、user-authorized readonly live、report review、TC3 cleanup、dry-run create/release、mutation wrapper、authorized live、deploy、Portal production integration 和 canary/QA/status update 定成业务推进顺序；它不替代 AGENTS.md，AGENTS.md 管 A/B/C/D 纪律和授权红线，本合同管业务推进顺序、阶段状态、blocker 回流和下一步任务包。
- authorized/tencent create/release: [v22-authorized-tencent-create-release-boundary.md](./v22-authorized-tencent-create-release-boundary.md)。当前只定义真实创建/释放前的授权边界，覆盖基础套餐、Pro 套餐、自定义规格、共享 TKE 集群、namespace/quota、node pool class、COS 文件空间、7 天保护期、文件夹管理、T+1 分账标签和失败审计；7 天保护期只由存储资源 / 文件空间删除或独立欠费保留策略触发；不读取 secret，不调用真实腾讯云 API，不创建或释放真实资源。
- authorized/tencent create/release implementation: [v22-authorized-tencent-create-release-implementation-boundary.md](./v22-authorized-tencent-create-release-implementation-boundary.md)。当前只定义后续真实 create/release implementation 前的授权、风控、失败回滚、费用保护和审计合同；默认风控上限不是默认开通规格，计算资源和存储资源生命周期分离，且风控可由 Portal 管理员按账号修改；不读取 secret，不调用真实腾讯云 API，不创建或释放真实资源。
- authorized/tencent create/release execution: [v22-authorized-tencent-create-release-execution-boundary.md](./v22-authorized-tencent-create-release-execution-boundary.md)。当前只收敛真实变更资源执行前的 gate、mutation secret allowlist、资源生命周期、Portal ledger + 云标签双重校验、风控 override、冻结金额、120 分钟核对、T+1 COS 对账、回滚和 admin 审计边界；readonly inventory 与 create/release mutation gate、secret 和 runner/bridge 必须分离；本合同不读取 mutation secret，不调用真实云，不执行真实 create/release。
- authorized/tencent deploy execution: [v22-authorized-tencent-deploy-execution-boundary.md](./v22-authorized-tencent-deploy-execution-boundary.md)。Package D 合同，定义 TCR 镜像、push 唯一 test tag、digest verify、kubectl deploy dry-run、指定 namespace/workload/container rollout、runtime smoke 和 rollback evidence 边界；Package D 不授权 Package C 的资源生命周期动作，不创建、删除、释放或扩缩容 TKE node pool，不创建、删除、清空或扩容 COS bucket/prefix/object，不允许误删、误停或误改别人的节点和存储。
- real resource contract alignment smoke: [../../scripts/smoke-test-v22-real-resource-contract-alignment.mjs](../../scripts/smoke-test-v22-real-resource-contract-alignment.mjs)。该 smoke 守住基础套餐、Pro 套餐、自定义规格、任务并发、计算资源和存储资源生命周期分离，以及普通用户主语言边界，防止真实资源接入前恢复旧口径。
- billing freeze/preauth: [v22-billing-freeze-boundary.md](./v22-billing-freeze-boundary.md), [v22-release-stop-billing-audit-boundary.md](./v22-release-stop-billing-audit-boundary.md)
- trace metadata: [v22-trace-metadata-boundary.md](./v22-trace-metadata-boundary.md), [v22-portal-files-billing-trace-boundary.md](./v22-portal-files-billing-trace-boundary.md), [v22-langfuse-observability-metadata-boundary.md](./v22-langfuse-observability-metadata-boundary.md)
- Langfuse 观测附件: [v22-langfuse-observability-metadata-boundary.md](./v22-langfuse-observability-metadata-boundary.md)。该合同只定义 sanitized trace/session metadata 边界，不代表 Langfuse 部署、ClickHouse、真实 API key 或真实 trace source 已接入。
- runtime bridge session/run/file/providerKeyRef: [v22-runtime-bridge-session-run-file-provider-keyref-boundary.md](./v22-runtime-bridge-session-run-file-provider-keyref-boundary.md)
- Portal-OPL connection: [v22-portal-opl-connection-boundary.md](./v22-portal-opl-connection-boundary.md)。Portal 发起进入 OPL、Gateway bootstrap、OPL session bind、message/file/run、artifact projection、workspace/session/run 归属、token 不进 URL/browser state 和 clean upstream 边界由该合同统一固定。它不修改 one-person-lab upstream，不读取 secret，不调用真实云。
- Portal-OPL context/backflow: [v22-portal-opl-context-backflow-boundary.md](./v22-portal-opl-context-backflow-boundary.md)。该三级执行合同把 Portal SaaS control plane、Gateway entry/proxy、OPL context bootstrap、Adapter capability/backflow projection、downstream Runtime gate 和 downstream Langfuse `trace.medopl.cn` session trace boundary 拆开；它不修改 one-person-lab upstream，不实现真实云 runtime，不部署 Langfuse，不允许 200 假成功。
- Real OPL capability canary: [v22-real-opl-capability-canary-boundary.md](./v22-real-opl-capability-canary-boundary.md)。该三级执行合同把真实 OPL WebUI/ACP/Runtime 能力发现、message reply、file、run、artifact、observability 和 Portal projection 的 canary 验证拆开；它只定义真实能力裁定、错误 gate、canary evidence 和 productionization handoff。当前 provider message reply 子链路已通过授权 live canary，但不代表真实文件上传、真实 Runtime Agent、真实云 runtime 或 Langfuse 已上线。
- Real OPL provider message canary: [v22-real-opl-provider-message-canary-boundary.md](./v22-real-opl-provider-message-canary-boundary.md)。该四级细分执行合同只定义真实 provider message reply canary 的 provider key gate、message send、reply observation、Adapter normalization、Portal message status、Portal session trace、Langfuse attachment boundary 和 no fake 200；默认 smoke 不读取 raw provider key、不调用真实 provider；授权 live canary 已证明真实 assistant reply 可按 `mapped_to_webui_bridge` 回流 Portal。
- upstream one-person-lab clean boundary: [v22-upstream-opl-boundary.md](./v22-upstream-opl-boundary.md), [v22-opl-work-message-file-run-boundary.md](./v22-opl-work-message-file-run-boundary.md)。upstream 目录只读/clean；Portal / Gateway / Runtime / Langfuse / 腾讯云逻辑不得写进 upstream；只能通过 Gateway、Adapter、Runtime Agent、公开 API/CLI、WebSocket bridge 或反向代理边界接入。OPL Gateway 本地 proxy 通过 `OPL_UPSTREAM_URL` 显式接入 clean upstream；未配置时返回 `opl_upstream_url_required`，不兜底到旧 v19/v20/v21 direct path 或硬编码 upstream。真实 WebUI canary 已确认独立 WebUI 页面、auth context、Gateway proxy、WebSocket session bridge 和 Adapter session bridge 可接通，但 `/api/opl/*` 是 catch-all placeholder，不是 Product API；授权 provider message live canary 已确认 message AI reply 可回流；file upload 和 run/artifact 回流仍需单独 agent/runtime canary。
- pricing snapshot: [v22-pricing-snapshot-boundary.md](./v22-pricing-snapshot-boundary.md)

## 界面/运维合同

- 普通用户 Portal 中文产品语言: [v22-saas-portal-opl-ops-surface-boundary.md](./v22-saas-portal-opl-ops-surface-boundary.md), [v22-portal-files-billing-trace-boundary.md](./v22-portal-files-billing-trace-boundary.md)
- Portal role surface 边界: [v22-portal-user-surface-boundary.md](./v22-portal-user-surface-boundary.md), [v22-portal-admin-ops-surface-boundary.md](./v22-portal-admin-ops-surface-boundary.md)。MedOPL 是同一个 Portal 应用、同一套登录、同一套 UI shell；普通用户 surface 和管理员/运维 surface 严格分离，管理员页面/API 使用独立分区，普通用户不能看到 admin/ops 入口、全局数据或管理操作。这两份合同是 Portal 角色真相；[v22-saas-portal-opl-ops-surface-boundary.md](./v22-saas-portal-opl-ops-surface-boundary.md) 是更宽的 Portal / OPL / 运维共享界面总述，不替代 role surface 合同。
- Portal 结构治理 / failure isolation: [v22-portal-structure-failure-isolation-boundary.md](./v22-portal-structure-failure-isolation-boundary.md)。这是 Portal 三级结构治理合同，只定义 Portal 后端 route/dispatcher、payload/DTO builder、frontend view/composable、frontend API module 和 smoke 分层边界；不定义新产品主叙事，不替代 role surface 合同，不调用真实云，不改 OPL Gateway / Runtime Bridge。
- Portal customer / ops UI composition: [v22-portal-customer-ops-ui-composition-boundary.md](./v22-portal-customer-ops-ui-composition-boundary.md)。这是 Portal 四级 UI composition 合同，固定用户侧 `MedOPL 总览 / 托管环境 / 任务运行 / 账单 / 文件空间` 和管理侧 `平台总览 / 用户管理 / 托管资源管理 / 任务会话 / 账单 / 审计` 的页面任务、业务组件、DTO/API 来源、文案词库、失败隔离和验证链路；它不实现 UI，不替代 role surface 合同，不调用真实云，不改 OPL Gateway / Runtime Bridge。
- OPL Web entry/preflight: [v22-saas-portal-opl-ops-surface-boundary.md](./v22-saas-portal-opl-ops-surface-boundary.md), [v22-opl-entry-preflight-auth-boundary.md](./v22-opl-entry-preflight-auth-boundary.md), [v22-upstream-opl-boundary.md](./v22-upstream-opl-boundary.md), [v22-opl-work-message-file-run-boundary.md](./v22-opl-work-message-file-run-boundary.md)。用户可见入口必须是 Portal “进入 OPL 工作台”或 /opl/entry/preflight；/internal/opl/auth/login 只能是 internal implementation path，不是用户入口。Gateway local proxy 只注入 `workspaceId`、`sessionId`/`launchStatus`、`providerBound`、`providerKeyRef` 和 Portal return URL；raw API Key、launchToken、runtimeToken、bearer token、objectKey、localPath、signedUrl 不进入 upstream、URL query 或浏览器持久化存储。
- 平台运维可见边界: [v22-saas-portal-opl-ops-surface-boundary.md](./v22-saas-portal-opl-ops-surface-boundary.md), [v22-tenant-resource-binding-boundary.md](./v22-tenant-resource-binding-boundary.md), [v22-release-stop-billing-audit-boundary.md](./v22-release-stop-billing-audit-boundary.md)
- Admin / Ops Console 边界: [v22-admin-ops-console-boundary.md](./v22-admin-ops-console-boundary.md)。该合同只定义管理员/运维界面边界，不实现 UI，不调用真实云，不读取 secret；普通用户资源页不得恢复云控制台或运维语义。
- 腾讯云分账标签后台边界: [v22-saas-portal-opl-ops-surface-boundary.md](./v22-saas-portal-opl-ops-surface-boundary.md), [v22-tenant-resource-binding-boundary.md](./v22-tenant-resource-binding-boundary.md), [v22-pricing-snapshot-boundary.md](./v22-pricing-snapshot-boundary.md)

## 相关合同

- [v22-canonical-user-loop.md](./v22-canonical-user-loop.md): canonical user loop 的早期/共享参考合同，阅读时以 v22 主合同和各段边界合同为当前执行入口。

## 合同包模板

### Portal / UI 合同包

适用于 Portal dashboard、资源状态、账单、文件、trace 页面和普通用户中文产品语言。

订阅：

- [v22-mvp-managed-opl-loop.md](./v22-mvp-managed-opl-loop.md)
- [v22-saas-portal-opl-ops-surface-boundary.md](./v22-saas-portal-opl-ops-surface-boundary.md)
- [v22-portal-user-surface-boundary.md](./v22-portal-user-surface-boundary.md)
- [v22-portal-admin-ops-surface-boundary.md](./v22-portal-admin-ops-surface-boundary.md)
- [v22-portal-files-billing-trace-boundary.md](./v22-portal-files-billing-trace-boundary.md)
- [v22-portal-structure-failure-isolation-boundary.md](./v22-portal-structure-failure-isolation-boundary.md)
- [v22-portal-customer-ops-ui-composition-boundary.md](./v22-portal-customer-ops-ui-composition-boundary.md)
- [../recovery/status-matrix.md](../recovery/status-matrix.md)
- [../recovery/active-surface.md](../recovery/active-surface.md)

### OPL Entry / Gateway 合同包

适用于 OPL entry/preflight、Gateway alias、Portal 进入 OPL 工作台、直接访问 OPL 工作台和 gflabtoken API Key 输入边界。

订阅：

- [v22-mvp-managed-opl-loop.md](./v22-mvp-managed-opl-loop.md)
- [v22-portal-opl-connection-boundary.md](./v22-portal-opl-connection-boundary.md)
- [v22-opl-entry-preflight-auth-boundary.md](./v22-opl-entry-preflight-auth-boundary.md)
- [v22-saas-portal-opl-ops-surface-boundary.md](./v22-saas-portal-opl-ops-surface-boundary.md)
- [v22-token-provider-boundary.md](./v22-token-provider-boundary.md)
- [v22-upstream-opl-boundary.md](./v22-upstream-opl-boundary.md)
- [../recovery/status-matrix.md](../recovery/status-matrix.md)

### Runtime Bridge 合同包

适用于 OPL session bind、run、message、file reference、artifact reference、providerKeyRef 透传和 Runtime Agent relay。

订阅：

- [v22-mvp-managed-opl-loop.md](./v22-mvp-managed-opl-loop.md)
- [v22-portal-opl-connection-boundary.md](./v22-portal-opl-connection-boundary.md)
- [v22-portal-opl-context-backflow-boundary.md](./v22-portal-opl-context-backflow-boundary.md)
- [v22-runtime-bridge-session-run-file-provider-keyref-boundary.md](./v22-runtime-bridge-session-run-file-provider-keyref-boundary.md)
- [v22-opl-work-message-file-run-boundary.md](./v22-opl-work-message-file-run-boundary.md)
- [v22-token-provider-boundary.md](./v22-token-provider-boundary.md)
- [v22-trace-metadata-boundary.md](./v22-trace-metadata-boundary.md)
- [../recovery/status-matrix.md](../recovery/status-matrix.md)

### Portal-OPL Context Backflow 合同包

适用于 Portal 打通 clean OPL WebUI、OPL 获取 MedOPL public context、session/message 事件回流 Portal、capability registry、downstream runtime gate、downstream Langfuse `trace.medopl.cn` session trace boundary 和性能 canary。该合同包是三级执行合同包，不实现真实云 runtime，不部署 Langfuse。

订阅：

- [v22-mvp-managed-opl-loop.md](./v22-mvp-managed-opl-loop.md)
- [v22-portal-opl-connection-boundary.md](./v22-portal-opl-connection-boundary.md)
- [v22-portal-opl-context-backflow-boundary.md](./v22-portal-opl-context-backflow-boundary.md)
- [v22-upstream-opl-boundary.md](./v22-upstream-opl-boundary.md)
- [v22-opl-work-message-file-run-boundary.md](./v22-opl-work-message-file-run-boundary.md)
- [v22-runtime-bridge-session-run-file-provider-keyref-boundary.md](./v22-runtime-bridge-session-run-file-provider-keyref-boundary.md)
- [v22-portal-files-billing-trace-boundary.md](./v22-portal-files-billing-trace-boundary.md)
- [v22-token-provider-boundary.md](./v22-token-provider-boundary.md)
- [v22-langfuse-observability-metadata-boundary.md](./v22-langfuse-observability-metadata-boundary.md)
- [../recovery/status-matrix.md](../recovery/status-matrix.md)
- [../recovery/mvp-contract-acceptance.md](../recovery/mvp-contract-acceptance.md)
- [../recovery/portal-opl-context-backflow-validation-path.md](../recovery/portal-opl-context-backflow-validation-path.md)

### Real OPL Capability Canary 合同包

适用于真实 OPL WebUI/ACP/Runtime 能力发现、message reply canary、file capability canary、Runtime Agent / run canary、artifact/output backflow canary、observability metadata canary、Portal projection negative gates 和 productionization handoff。该合同包是三级执行合同包，不修改 one-person-lab upstream，不读取 secret，不调用真实云，不部署 Langfuse，不允许 fake 200。

订阅：

- [v22-mvp-managed-opl-loop.md](./v22-mvp-managed-opl-loop.md)
- [v22-portal-opl-connection-boundary.md](./v22-portal-opl-connection-boundary.md)
- [v22-portal-opl-context-backflow-boundary.md](./v22-portal-opl-context-backflow-boundary.md)
- [v22-real-opl-capability-canary-boundary.md](./v22-real-opl-capability-canary-boundary.md)
- [v22-real-opl-provider-message-canary-boundary.md](./v22-real-opl-provider-message-canary-boundary.md)
- [v22-upstream-opl-boundary.md](./v22-upstream-opl-boundary.md)
- [v22-opl-work-message-file-run-boundary.md](./v22-opl-work-message-file-run-boundary.md)
- [v22-runtime-bridge-session-run-file-provider-keyref-boundary.md](./v22-runtime-bridge-session-run-file-provider-keyref-boundary.md)
- [v22-portal-files-billing-trace-boundary.md](./v22-portal-files-billing-trace-boundary.md)
- [v22-token-provider-boundary.md](./v22-token-provider-boundary.md)
- [v22-trace-metadata-boundary.md](./v22-trace-metadata-boundary.md)
- [v22-langfuse-observability-metadata-boundary.md](./v22-langfuse-observability-metadata-boundary.md)
- [../recovery/status-matrix.md](../recovery/status-matrix.md)
- [../recovery/mvp-contract-acceptance.md](../recovery/mvp-contract-acceptance.md)
- [../recovery/portal-opl-context-backflow-validation-path.md](../recovery/portal-opl-context-backflow-validation-path.md)
- [../recovery/real-opl-capability-canary-validation-path.md](../recovery/real-opl-capability-canary-validation-path.md)
- [../recovery/real-opl-provider-message-canary-validation-path.md](../recovery/real-opl-provider-message-canary-validation-path.md)

### Real OPL Provider Message Canary 合同包

适用于真实 OPL provider message reply canary 的 provider key gate、真实 message intent、provider invocation evidence、assistant reply observation、Adapter normalized message state、Portal message status、Portal session trace projection、Langfuse optional attachment boundary 和 no fake 200。该合同包是 Real OPL Capability Canary 的四级细分执行合同；默认合同 smoke 不修改 one-person-lab upstream、不读取 secret、不调用真实 provider、不调用真实云、不部署 Langfuse。真实 provider key 和真实模型调用必须通过 `REAL_OPL_PROVIDER_MESSAGE_CANARY=1`、`OPL_PROVIDER_SECRET_FILE`、`OPL_REAL_WEBUI_DIR` 或 `OPL_REAL_WEBUI_URL` 单独授权，并且 live canary 不进入默认 MVP suite。当前授权 live canary 已通过，message reply capability 为 `mapped_to_webui_bridge`；这不代表 file/run/artifact、真实云 runtime 或 Langfuse 已上线。

订阅：

- [v22-mvp-managed-opl-loop.md](./v22-mvp-managed-opl-loop.md)
- [v22-portal-opl-connection-boundary.md](./v22-portal-opl-connection-boundary.md)
- [v22-portal-opl-context-backflow-boundary.md](./v22-portal-opl-context-backflow-boundary.md)
- [v22-real-opl-capability-canary-boundary.md](./v22-real-opl-capability-canary-boundary.md)
- [v22-real-opl-provider-message-canary-boundary.md](./v22-real-opl-provider-message-canary-boundary.md)
- [v22-upstream-opl-boundary.md](./v22-upstream-opl-boundary.md)
- [v22-opl-work-message-file-run-boundary.md](./v22-opl-work-message-file-run-boundary.md)
- [v22-runtime-bridge-session-run-file-provider-keyref-boundary.md](./v22-runtime-bridge-session-run-file-provider-keyref-boundary.md)
- [v22-portal-files-billing-trace-boundary.md](./v22-portal-files-billing-trace-boundary.md)
- [v22-token-provider-boundary.md](./v22-token-provider-boundary.md)
- [v22-trace-metadata-boundary.md](./v22-trace-metadata-boundary.md)
- [v22-langfuse-observability-metadata-boundary.md](./v22-langfuse-observability-metadata-boundary.md)
- [../recovery/status-matrix.md](../recovery/status-matrix.md)
- [../recovery/mvp-contract-acceptance.md](../recovery/mvp-contract-acceptance.md)
- [../recovery/portal-opl-context-backflow-validation-path.md](../recovery/portal-opl-context-backflow-validation-path.md)
- [../recovery/real-opl-capability-canary-validation-path.md](../recovery/real-opl-capability-canary-validation-path.md)
- [../recovery/real-opl-provider-message-canary-validation-path.md](../recovery/real-opl-provider-message-canary-validation-path.md)

### Langfuse / Trace 合同包

适用于 Langfuse 观测附件、sanitized projection、Portal 会话轨迹、trace metadata 和非 canonical source 边界。

订阅：

- [v22-mvp-managed-opl-loop.md](./v22-mvp-managed-opl-loop.md)
- [v22-langfuse-observability-metadata-boundary.md](./v22-langfuse-observability-metadata-boundary.md)
- [v22-trace-metadata-boundary.md](./v22-trace-metadata-boundary.md)
- [v22-portal-files-billing-trace-boundary.md](./v22-portal-files-billing-trace-boundary.md)
- [../recovery/status-matrix.md](../recovery/status-matrix.md)

### Resource / Billing / Audit 合同包

适用于套餐、托管环境开通、资源绑定、预扣费、冻结金额、释放停止计费、审计状态。

订阅：

- [v22-mvp-managed-opl-loop.md](./v22-mvp-managed-opl-loop.md)
- [v22-managed-environment-open-boundary.md](./v22-managed-environment-open-boundary.md)
- [v22-resource-plan-boundary.md](./v22-resource-plan-boundary.md)
- [v22-pricing-snapshot-boundary.md](./v22-pricing-snapshot-boundary.md)
- [v22-tenant-resource-binding-boundary.md](./v22-tenant-resource-binding-boundary.md)
- [v22-billing-freeze-boundary.md](./v22-billing-freeze-boundary.md)
- [v22-release-stop-billing-audit-boundary.md](./v22-release-stop-billing-audit-boundary.md)
- [../recovery/status-matrix.md](../recovery/status-matrix.md)

### Tencent Provider 合同包

适用于 readonly/tencent quote provider、dry-run/tencent resource plan provider、readonly/tencent inventory、authorized/tencent create/release boundary、mock adapter、套餐估算、quote snapshot、不会执行的资源创建计划、真实云只读盘点和后续真实腾讯云接入前的授权边界。阶段路线：`mock/snapshot -> readonly/tencent quote -> dry-run/tencent plan -> readonly/tencent inventory -> authorized/tencent create/release`。

订阅：

- [v22-mvp-managed-opl-loop.md](./v22-mvp-managed-opl-loop.md)
- [v22-managed-environment-open-boundary.md](./v22-managed-environment-open-boundary.md)
- [v22-tencent-readonly-quote-provider-boundary.md](./v22-tencent-readonly-quote-provider-boundary.md)
- [v22-tencent-dry-run-resource-plan-provider-boundary.md](./v22-tencent-dry-run-resource-plan-provider-boundary.md)
- [v22-production-cloud-topology-boundary.md](./v22-production-cloud-topology-boundary.md)
- [v22-tencent-readonly-inventory-boundary.md](./v22-tencent-readonly-inventory-boundary.md)
- [v22-cloud-onboarding-workflow-boundary.md](./v22-cloud-onboarding-workflow-boundary.md)
- [v22-authorized-tencent-create-release-boundary.md](./v22-authorized-tencent-create-release-boundary.md)
- [v22-authorized-tencent-create-release-implementation-boundary.md](./v22-authorized-tencent-create-release-implementation-boundary.md)
- [v22-authorized-tencent-create-release-execution-boundary.md](./v22-authorized-tencent-create-release-execution-boundary.md)
- [v22-authorized-tencent-deploy-execution-boundary.md](./v22-authorized-tencent-deploy-execution-boundary.md)
- [v22-pricing-snapshot-boundary.md](./v22-pricing-snapshot-boundary.md)
- [v22-resource-plan-boundary.md](./v22-resource-plan-boundary.md)
- [../recovery/status-matrix.md](../recovery/status-matrix.md)

真实腾讯云 API、真实 SecretId/SecretKey、真实资源创建/释放、deploy、build/push、kubectl 和 live-test 必须另开 feat/* 并单独授权。

readonly inventory 的 official Tencent SDK wrapper 是 production default provider strategy；TC3 仅作为 diagnostic/reference，不能作为默认 readonly live 主路径或 create/release provider。新增官方 SDK 依赖必须另开 feat/* 并经 package diff 审查。

[v22-tencent-tc3-diagnostic-cleanup-plan.md](./v22-tencent-tc3-diagnostic-cleanup-plan.md) 是 TC3 diagnostic cleanup plan。它规定 official SDK wrapper 合并、official SDK 依赖合并、official SDK readonly live 成功生成脱敏 report、B 审查确认 production default 不再依赖 TC3 之后，才能另开 cleanup 分支让 runner production default 不再使用 `tencent-tc3-readonly`，并将 TC3 smoke 改为 diagnostic fixture 或删除、让 TC3 live bridge 从生产路径退场。本计划当前不删除 TC3、不读 secret、不调用真实云、不改 official SDK implementation、不改 create/release。

### Cleanup 合同包

适用于退役 `user_owned`、`resource-order`、旧 runner/provisioner、OpenCost/Langfuse 主叙事、旧 v19/v20/v21 路线。

订阅：

- [v22-mvp-managed-opl-loop.md](./v22-mvp-managed-opl-loop.md)
- [../recovery/status-matrix.md](../recovery/status-matrix.md)
- [../recovery/active-surface.md](../recovery/active-surface.md)
- [../recovery/archive-policy.md](../recovery/archive-policy.md)
- 与被退役路径相关的分支合同

cleanup 分支必须证明：退役后每个核心域只剩一个正式入口。
