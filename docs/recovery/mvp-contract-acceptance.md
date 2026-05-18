# v22 MVP Contract Acceptance

本报告收口 MedOPL v22 MVP contract/API 主闭环的当前阶段快照。阶段会随后续合同、smoke、真实 E2E 和 cleanup 推进而变化；Agent 不得根据过期聊天记忆判断当前阶段。

## Acceptance Scope

- 以 `recovery/platform-v22-trunk` 上的 v22 contract、Portal API/domain 小闭包、Portal UI MVP 基础界面和本地 smoke 为验收对象。
- 本报告只确认已通过本地合同和 smoke 固化的状态闭环、密钥边界、资源绑定边界、计费/冻结/释放/审计状态表达和用户主叙事。
- 本报告不确认真实云资源、真实部署、真实 upstream 生产运行、真实价格审批、真实账单核对或真实 Langfuse trace source。

## 已完成 contract-level 能力

以下能力已在 v22 contract 和 smoke 中完成合同级验收：

- pricing snapshot contract
- MVP managed OPL loop contract
- SaaS control plane user experience truth contract
- Portal UI design quality audit boundary
- user credit provider key flow
- managed environment open flow
- managed resource binding plan / mock snapshot view
- readonly/tencent quote provider mock boundary
- Portal frontend MVP UI
- Portal structure/failure isolation governance contract
- Portal-OPL connection boundary contract
- OPL entry/preflight auth flow
- OPL work message/file/run flow
- Runtime Bridge / Runtime Agent session/run/file/providerKeyRef flow
- Portal files/billing/trace flow
- release stop billing audit flow
- Langfuse observability metadata boundary

## 当前完成层级

当前已完成的是 `contract-level + Portal API/domain 小闭包 + Portal UI MVP 基础界面`：

- MedOPL 产品语言已收敛为面向 AI 小白科研用户的 OPL 科研托管平台，不是云资源控制台。
- SaaS 控制面用户体验真相已收敛：MedOPL 是 One Person Lab 的 SaaS 控制面和托管交付平台；Portal 负责让用户知道自己买的是什么托管 OPL 工作台服务、工作台是否可用、还缺哪一步、下一步点哪里、文件/任务/结果在哪里，以及余额、预扣费、冻结金额和停止计费状态是否正常；OPL 继续负责 chatbot、agent、科研任务执行、文件理解、结果生成和工作台内交互体验。
- v22 合同索引已建立，主合同、用户闭环段合同、共享边界合同、界面/运维合同和合同包模板已有明确入口。
- v22 合同索引已将服务商品、用户体验、信息架构、生命周期、权限/角色、状态/数据源、操作风险、UI composition、交付/平台、运营/支持十层 truth 映射到现有合同和 Figma Make ZIP surface gate；后续会改变普通用户可见体验、OPL 入口、run/file/artifact 回流、资源/账单状态、真实云 projection 或管理台摘要的分支，必须订阅 SaaS 控制面用户体验 truth。
- 默认套餐边界已收敛到 `starter_2c4g_10gb` 和 `pro_8c16g_100gb`。
- pricing snapshot 与 MedOPL 售卖价保持分离，`basePrice = null`，`pendingProductApproval = true`。
- 用户、充值、gflabtoken provider key 绑定、canonical state readiness 已具备合同级闭环；provider key 已从 Portal 普通登录/普通入口退场，进入 OPL entry/preflight 和后端密钥边界。
- 托管运行环境开通要求显式 `workspaceId`、`planId`、`fileSpaceGb`，不做隐式兜底。
- Portal UI MVP 已覆盖普通用户可见的余额、消费、托管运行环境、工作空间、文件空间、会话、任务、输入文件、输出文件、运行轨迹、账单、预扣费、冻结金额、停止计费和审计状态等基础表面。
- Portal UI design quality audit boundary 已定义为边界和评价标准合同：它不实现 UI，不冻结具体审美解法，不替代 UI composition 合同；它把主线问题、Portal/OPL 职责、普通用户非云控制台语言、非 OPL chatbot、角色边界、secret/browser hygiene、响应式不溢出、状态覆盖和 runtime-only 审计报告作为硬约束，把现代 SaaS 工作台信息层级、可扫描性、服务清晰度、下一步动作清晰度、科研工作台感、信息密度平衡和文案质量作为软评分。当前 audit leaf 还固定了 audit evidence schema：`.runtime/portal-ui-design-quality/report.json` 必须覆盖七个主线问题、全部 hard/soft rubric、surface/typecheck/build 证据来源、表达质量发现、产品语义边界检查和后续 UI implementation leaf handoff；该 report 不进 git；旧 screenshot baseline 不再是当前 Portal UI 完成证据。
- Portal UI design quality implementation 已把 audit handoff 落到真实前端：overview 首屏现在回答托管科研工作台服务是什么、能否进入 OPL、环境/套餐/算力/存储/释放状态、Portal/OPL runtime 职责、文件/任务/结果链路和下一步动作。实现只改 Portal frontend、design-quality gate 和订阅 truth writeback；不改 Portal backend services、package/dependency、deploy、adapters、`.sentrux`、upstream、secret、live cloud、build/push/kubectl、deploy 或 live-test。后续 backend/cloud/release 仍由独立 leaf 处理。
- Portal 结构治理 / failure isolation 三级合同已定义后端 route/dispatcher、payload/DTO builder、frontend view/composable、frontend API module 和 Portal smoke 分层边界；该合同不代表真实云、真实 OPL 或真实部署已接入。
- OPL entry/preflight 合同已定义：`portal.medopl.cn` 登录不需要 gflabtoken API Key；`opl.medopl.cn` 登录 / 进入 OPL 工作台需要 gflabtoken API Key。
- OPL 工作流合同覆盖发送信息、上传文件、用文件跑任务、生成输出文件引用和下载引用。
- Runtime Bridge / Runtime Agent session/run/file/providerKeyRef 合同已定义，run、artifact、ledger、providerKeyRef 和敏感字段净化已有本地合同 smoke。`services/opl-runtime-bridge` 只是当前实现路径，不是产品主叙事或兼容层保留理由。
- Portal-OPL context/backflow 三级执行合同已定义，把 Portal SaaS control plane、Gateway entry/proxy、OPL context bootstrap、Runtime Bridge capability/backflow projection、downstream Runtime gate 和 downstream Langfuse `trace.medopl.cn` session trace boundary 拆开；该合同是 Portal 打通 OPL、OPL 获取上下文、OPL 事件反馈 Portal 的开发验收入口，不代表真实云 runtime、真实 Langfuse 部署或完整 run/artifact 回流已经完成。
- Real OPL capability canary 三级执行合同已定义，把真实 OPL WebUI/ACP/Runtime 能力发现、message reply、file、run、artifact、observability、Portal projection negative gates 和 productionization handoff 拆开；该合同是后续验证真实 OPL message/file/run/artifact/runtime/observability 全工作流的入口，不代表这些真实能力已经上线。
- Real OPL provider message canary 四级细分合同已定义，把真实 provider message reply 的 provider key gate、message send、reply observation、Runtime Bridge normalization、Portal message status、Portal session trace 和 Langfuse optional attachment boundary 拆开；默认合同 smoke 不读取 secret、不触发真实 provider；授权 live canary 需 `REAL_OPL_PROVIDER_MESSAGE_CANARY=1`、`OPL_PROVIDER_SECRET_FILE` 和 `OPL_REAL_WEBUI_DIR` 或 `OPL_REAL_WEBUI_URL`，并只写 `.runtime` 脱敏 evidence。当前授权 live canary 已证明真实 OPL WebUI bridge + gflab provider message 能返回 assistant reply，并以 `mapped_to_webui_bridge` 回流 Portal message status 与 Portal session trace。
- Real OPL file/run/artifact contract gate 已定义，把 file upload 或 file intent、workspace-scoped fileRef、run intent、Runtime Agent gate、run state projection、artifact/output backflow、Portal workspace/session/run 查询、trace metadata、billing metadata handoff 和 Langfuse optional attachment 拆开；每个 step 必须 gate，不能用 200 假成功。本地 Runtime Agent HTTP API proof 仅作为合同验证证据，不属于默认产品入口或 production deploy evidence；真实云 runtime、COS 账单或 Langfuse 部署仍未上线。
- Portal `/portal/api/opl/*` 代理已有本地合同 gate：它验证 Portal 后端登录、`POST /portal/api/opl/launch`、bootstrap、session bind、message、file、run、artifact projection 和 Vite OPL launch shell 可以打到 Runtime Bridge。该 gate 不代表默认产品入口、生产 Runtime Agent、真实 provider key message、真实云 runtime 或真实 OPL Product API 已上线。
- `/home/dev/projects/one-person-lab` 主仓真实 canary 已确认：当前主仓 `opl web` retired，未暴露 `/api/opl/system`、`/api/opl/messages`、`/api/opl/sessions` HTTP Product API；`opl session runtime --acp` 可作为 Runtime Bridge bootstrap/session bind 的公开映射面。
- 真实 OPL/AionUI WebUI canary 已确认：独立 WebUI 进程、页面、`/api/auth/status`、`/api/auth/user`、Gateway proxy、WebSocket session bridge 和 Runtime Bridge session bridge 可访问；`create-conversation` 与数据库回读可形成真实 session 回流；`/api/opl/*` 只是通用 `/api` catch-all 200 placeholder，不是 Product API；授权 provider message live canary 已证明 `chat.send.message` 能通过 WebUI bridge 形成真实 assistant reply 回流；run 在没有真实 Runtime Agent relay 时不能伪成功。
- Portal 后端/API 可表达 workspace 文件、输出文件、账单摘要、冻结/预扣费和 session trace metadata。
- 释放托管环境后可表达停止扣费确认、T+1 审计和文件保护/清理边界。
- Langfuse observability metadata boundary 已定义为观测附件，不是 Portal canonical source，不是 billing truth。
- raw API key、raw prompt、bearer token、`launchToken`、`runtimeToken`、内部存储密钥、objectKey、localPath、signedUrl 不得出现在公开 response、Portal projection、日志、evidence 或 git。

该层级不是完整真实上线，不代表真实云资源、真实部署、独立 OPL WebUI/Product API、真实价格审批、真实账单核对、真实 Langfuse trace source 或生产 OPL E2E 已完成。真实 provider message/reply 的授权 canary 已通过，但 file、run、artifact、真实云 runtime、生产部署和 Langfuse 仍未上线。

## 尚未完成真实上线能力

以下能力尚未完成，不能在本报告中视为已上线：

- Gateway / Runtime Bridge / Runtime Agent 生产联通，当前只到本地合同、proof gate、`/home/dev/projects/one-person-lab` 主仓能力分类和真实 WebUI Runtime Bridge session bridge 边界
- one-person-lab 实际拉取/部署/运行接入：已完成主仓能力分类、独立 WebUI 边界验证、真实 WebUI Runtime Bridge session bridge 边界和授权真实 provider message reply canary；尚未完成 HTTP Product API 接入、WebUI 文件上传、run/artifact 和生产部署接入
- Portal `/portal/api/opl/*` runtime loop 默认 smoke 只证明本地合同形状和 no-fake-success 保护；授权 live canary 另行证明真实 WebUI provider message reply 可通过 Runtime Bridge 回流 Portal。上述结果都不代表真实 OPL 原生 Product API、真实云 runtime、COS 账单或生产部署已完成。
- Real OPL capability canary 当前已完成合同和完整验证链路定义，并已通过 provider message reply 子链路的授权 live canary；file/run/artifact 仍需在 future-authorized production boundary 下继续验证。真实云 runtime、COS 账单、Langfuse 部署和性能 canary 仍需按 `docs/recovery/real-opl-capability-canary-validation-path.md` 与 `docs/recovery/real-opl-file-run-artifact-validation-path.md` 单独验证。
- Real OPL provider message canary 当前已有单独授权 live evidence：真实 provider key 调用、provider invocation evidence、assistant reply observation、Portal message status projection 和 Portal session trace projection 已在本地真实 WebUI canary 中跑通。结果以 `.runtime/real-opl-provider-message-live-canary/evidence.json` 脱敏 evidence 为准；对应 live runner 已退出 active repo executable surface，后续真实 provider/live 验证必须重新开 future-authorized boundary。该 live evidence 不代表真实 file/run/artifact、真实云 runtime 或 Langfuse 部署已上线。
- Real OPL file/run/artifact canary 当前完成合同、完整验证链路定义和本地 Runtime Bridge gate 实现验证：`OPL_RUNTIME_MODE=webui` 下 file upload/fileRef、run/Runtime Agent 和 artifact/output 都不会伪成功，分别返回 `file_upload_capability_not_supported`、queryable `requires_runtime_agent` gated run、`artifact_not_observed` / `output_file_ref_not_observed`。OPL lane 当前只提供 `resourceBindingId/workspace runtime identity` 与 run/artifact projection，不提供 `ownerRef`、`operationId` 或 K8s labels。本合同不读取 secret、不调用真实云、不部署 Langfuse、不实现 COS 账单结算；真实云 runtime、COS 账单和 `trace.medopl.cn` 仍需单独授权链路。
- Leaf 6 OPL productionization contract refresh is contract_refresh_only：local Runtime Agent HTTP API proof is not production deploy evidence；WebUI bridge negative no-fake-success gate is not production deploy evidence；provider message reply canary remains message/reply only。后续 production implementation 必须继续把真实云 runtime、COS 账单核对、Langfuse / `trace.medopl.cn` 部署和 deploy owner 字段留在各自授权链路。
- 真实云资源开通，包含后续真实腾讯云资源开通 / 释放
- 真实价格审批
- 真实账单核对
- Langfuse 真实 trace source 接入
- `trace.medopl.cn` 的真实部署、DNS、TLS、Ingress、Langfuse secret 和 ClickHouse 接入
- deploy / build / push / kubectl / live-test
- cleanup 删除 v19/v20/v21 旧路线

## 阶段更新规则

每次新增真实能力、退役旧路线、改变授权边界或改变主合同状态，都必须更新本阶段快照。稳定工作纪律写在 `AGENTS.md` 和 `docs/vibe-coding.md`；阶段事实写在本文件和 `docs/recovery/status-matrix.md`。

## 使用方式

本文件是阶段快照，不是永久非目标清单。Agent 开工前必须读取 `AGENTS.md`、`docs/vibe-coding.md`、`docs/contracts/README.md`、`docs/recovery/status-matrix.md` 和本次订阅合同。

开工时必须声明：

- 当前主线已完成什么
- 本分支补什么
- 本分支不补什么
- 授权边界
- 验收命令

## 授权边界

除非当前任务明确授权，不得读 secret、kubeconfig、token、SecretId、SecretKey、SSH private key 或 `.env`；不得调用真实腾讯云、COS、Langfuse、one-person-lab 或外部生产 API；不得创建、绑定、释放真实云资源或真实扣费；不得运行 build/push/kubectl/live-test；不得修改 deploy、`.sentrux`、adapters 或 upstream。

是否修改 frontend、Gateway、Runtime Bridge / Runtime Agent、Portal domain、docs 或 smoke，由本次分支意图和订阅合同决定，不能从旧阶段快照推断。

## 默认本地 MVP suite

`scripts/smoke-test-v22-mvp-contract-suite.mjs` 作为默认本地 v22 MVP contract acceptance suite，只串联运行合同级、本地 fixture、fail-closed 和不读取 secret 的 smoke，并输出 `ok: true` 与 passed smoke 名称。该 suite 不读取 secret、不调用真实云、不运行真实 upstream/WebUI/provider live canary、不执行 build/push/kubectl、不执行真实 runtime smoke；任何需要真实外部系统的验证都必须进入 future-authorized boundary，不作为默认 active executable surface。

- `scripts/smoke-test-v22-pricing-plan-contract.mjs`
- `scripts/smoke-test-v22-saas-control-plane-user-experience-boundary.mjs`
- `scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs`
- `scripts/smoke-test-v22-mvp-managed-opl-loop-contract.mjs`
- `scripts/smoke-test-v22-user-credit-provider-key-flow.mjs`
- `scripts/smoke-test-v22-managed-environment-open-flow.mjs`
- `scripts/smoke-test-v22-opl-work-message-file-run-flow.mjs`
- `scripts/smoke-test-v22-opl-entry-preflight-auth-flow.mjs`
- `scripts/smoke-test-v22-portal-opl-connection-contract.mjs`
- `scripts/smoke-test-v22-portal-opl-context-backflow-contract.mjs`
- `scripts/smoke-test-v22-real-opl-capability-contract-gate.mjs`
- `scripts/smoke-test-v22-real-opl-provider-message-contract-gate.mjs`
- `scripts/smoke-test-v22-real-opl-file-run-artifact-contract-gate.mjs`
- `scripts/smoke-test-v22-real-opl-file-run-artifact-gates.mjs`
- `scripts/smoke-test-v22-runtime-bridge-state-store-atomic-flow.mjs`
- `scripts/smoke-test-v22-portal-runtime-bridge-api-local-flow.mjs`
- `scripts/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs`
- `scripts/smoke-test-v22-portal-runtime-startup-config.mjs`
- `scripts/smoke-test-v22-portal-dev-server-auth-proxy.mjs`
- `scripts/smoke-test-v22-portal-auth-landing-route.mjs`
- `scripts/smoke-test-v22-portal-web-route-alignment.mjs`
- `scripts/smoke-test-v22-portal-api-auth-boundary.mjs`
- `scripts/smoke-test-v22-portal-package-surface-isolation.mjs`
- `scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs`
- `scripts/smoke-test-v22-portal-files-billing-trace-flow.mjs`
- `scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs`
- `scripts/smoke-test-v22-langfuse-observability-metadata-contract.mjs`

## 授权外部 canary 边界

active repo 不保留真实 upstream/WebUI/provider/cloud/deploy 的默认可执行 runner。历史授权 canary / live / deploy evidence 只作为 `.runtime` 脱敏证据和合同状态记录存在，不作为当前命令、默认验证入口或完成态。未来如果需要真实外部验证，必须由用户重新授权，并在新 v22 boundary 下新增或恢复专用 runner；该 runner 不得自动进入默认本地 MVP suite。

- 真实 upstream / WebUI / provider message 验证：future-authorized boundary only；历史 evidence 只写 `.runtime`。
- 真实 Tencent readonly inventory：future-authorized boundary only；必须重新确认 secret allowlist、region/API scope 和 report path。
- 真实 resource lifecycle mutation：future-authorized boundary only；必须逐次确认 mutation secret、预算、scope、rollback 和 cleanup。
- 真实 deploy/build/push/kubectl/runtime smoke：future-authorized boundary only；必须逐次确认 registry、kubeconfig/secret、release plan、rollback 和 runtime smoke。
