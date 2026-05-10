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
- user credit provider key flow
- managed environment open flow
- managed resource binding plan / mock snapshot view
- readonly/tencent quote provider mock boundary
- Portal frontend MVP UI
- Portal structure/failure isolation governance contract
- Portal-OPL connection boundary contract
- OPL entry/preflight auth flow
- OPL work message/file/run flow
- Runtime Bridge session/run/file/providerKeyRef flow
- Portal files/billing/trace flow
- release stop billing audit flow
- Langfuse observability metadata boundary

## 当前完成层级

当前已完成的是 `contract-level + Portal API/domain 小闭包 + Portal UI MVP 基础界面`：

- MedOPL 产品语言已收敛为面向 AI 小白科研用户的 OPL 科研托管平台，不是云资源控制台。
- v22 合同索引已建立，主合同、用户闭环段合同、共享边界合同、界面/运维合同和合同包模板已有明确入口。
- 默认套餐边界已收敛到 `starter_2c4g_10gb` 和 `pro_8c16g_100gb`。
- pricing snapshot 与 MedOPL 售卖价保持分离，`basePrice = null`，`pendingProductApproval = true`。
- 用户、充值、gflabtoken provider key 绑定、canonical state readiness 已具备合同级闭环；provider key 已从 Portal 普通登录/普通入口退场，进入 OPL entry/preflight 和后端密钥边界。
- 托管运行环境开通要求显式 `workspaceId`、`planId`、`fileSpaceGb`，不做隐式兜底。
- Portal UI MVP 已覆盖普通用户可见的余额、消费、托管运行环境、工作空间、文件空间、会话、任务、输入文件、输出文件、运行轨迹、账单、预扣费、冻结金额、停止计费和审计状态等基础表面。
- Portal 结构治理 / failure isolation 三级合同已定义后端 route/dispatcher、payload/DTO builder、frontend view/composable、frontend API module 和 Portal smoke 分层边界；该合同不代表真实云、真实 OPL 或真实部署已接入。
- OPL entry/preflight 合同已定义：`portal.medopl.cn` 登录不需要 gflabtoken API Key；`opl.medopl.cn` 登录 / 进入 OPL 工作台需要 gflabtoken API Key。
- OPL 工作流合同覆盖发送信息、上传文件、用文件跑任务、生成输出文件引用和下载引用。
- Runtime Bridge session/run/file/providerKeyRef 合同已定义，run、artifact、ledger、providerKeyRef 和敏感字段净化已有本地合同 smoke。
- `/home/dev/projects/one-person-lab` 主仓真实 canary 已确认：当前主仓 `opl web` retired，未暴露 `/api/opl/system`、`/api/opl/messages`、`/api/opl/sessions` HTTP Product API；`opl session runtime --acp` 可作为 Adapter bootstrap/session bind 的公开映射面。
- Portal 后端/API 可表达 workspace 文件、输出文件、账单摘要、冻结/预扣费和 session trace metadata。
- 释放托管环境后可表达停止扣费确认、T+1 审计和文件保护/清理边界。
- Langfuse observability metadata boundary 已定义为观测附件，不是 Portal canonical source，不是 billing truth。
- raw API key、raw prompt、bearer token、`launchToken`、`runtimeToken`、内部存储密钥、objectKey、localPath、signedUrl 不得出现在公开 response、Portal projection、日志、evidence 或 git。

该层级不是完整真实上线，不代表真实云资源、真实部署、独立 OPL WebUI/Product API、真实 provider key 调用、真实价格审批、真实账单核对、真实 Langfuse trace source 或生产 OPL E2E 已完成。

## 尚未完成真实上线能力

以下能力尚未完成，不能在本报告中视为已上线：

- Gateway / Runtime Bridge 生产联通，当前只到本地合同、本地 E2E smoke 和 `/home/dev/projects/one-person-lab` 主仓 canary 边界
- one-person-lab 实际拉取/部署/运行接入：已完成主仓本地 canary；尚未完成独立 OPL WebUI/Product API 接入、真实浏览器工作台接入和真实 provider key message prompt
- 真实云资源开通，包含后续真实腾讯云资源开通 / 释放
- 真实价格审批
- 真实账单核对
- Langfuse 真实 trace source 接入
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

是否修改 frontend、Gateway、Runtime Bridge、Portal domain、docs 或 smoke，由本次分支意图和订阅合同决定，不能从旧阶段快照推断。

## 总 smoke

`scripts/smoke-test-v22-mvp-contract-suite.mjs` 作为 v22 MVP contract acceptance suite，串联运行以下 smoke，并输出 `ok: true` 与 passed smoke 名称：

- `scripts/smoke-test-v22-pricing-plan-contract.mjs`
- `scripts/smoke-test-v22-mvp-managed-opl-loop-contract.mjs`
- `scripts/smoke-test-v22-user-credit-provider-key-flow.mjs`
- `scripts/smoke-test-v22-managed-environment-open-flow.mjs`
- `scripts/smoke-test-v22-opl-work-message-file-run-flow.mjs`
- `scripts/smoke-test-v22-opl-entry-preflight-auth-flow.mjs`
- `scripts/smoke-test-v22-portal-opl-connection-contract.mjs`
- `scripts/smoke-test-v22-opl-adapter-state-store-atomic-flow.mjs`
- `scripts/smoke-test-v22-portal-opl-adapter-api-local-flow.mjs`
- `scripts/smoke-test-v22-real-opl-canary.mjs`（单独真实 upstream canary，不并入默认纯本地 fixture suite）
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
