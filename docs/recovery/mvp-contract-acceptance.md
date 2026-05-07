# v22 MVP Contract Acceptance

本报告收口 MedOPL v22 MVP contract/API 主闭环的当前验收状态。当前完成层级是 **contract-level + Portal API/domain 小闭包**，不是完整真实上线。

## Acceptance Scope

- 以 `recovery/platform-v22-trunk` 上的 v22 contract、Portal API/domain 小闭包和本地 smoke 为验收对象。
- 本报告只确认合同级状态闭环、密钥边界、资源绑定边界、计费/冻结/释放/审计状态表达和用户主叙事。
- 本报告不确认真实云资源、真实部署、真实 upstream 拉取运行、真实价格审批或完整前端体验。

## 已完成 contract-level 能力

以下能力已在 v22 contract 和 smoke 中完成合同级验收：

- pricing snapshot contract
- MVP managed OPL loop contract
- user credit provider key flow
- managed environment open flow
- OPL work message/file/run flow
- Portal files/billing/trace flow
- release stop billing audit flow

## 当前完成层级

当前已完成的是 `contract-level + Portal API/domain 小闭包`：

- MedOPL 产品语言已收敛为面向 AI 小白科研用户的 OPL 科研托管平台，不是云资源控制台。
- 默认套餐边界已收敛到 `starter_2c4g_10gb` 和 `pro_8c16g_100gb`。
- pricing snapshot 与 MedOPL 售卖价保持分离，`basePrice = null`，`pendingProductApproval = true`。
- 用户、充值、gflabtoken provider key 绑定、canonical state readiness 已具备合同级闭环。
- 托管运行环境开通要求显式 `workspaceId`、`planId`、`fileSpaceGb`，不做隐式兜底。
- OPL 工作流合同覆盖发送信息、上传文件、用文件跑任务、生成输出文件引用和下载引用。
- Portal 后端/API 可表达 workspace 文件、输出文件、账单摘要、冻结/预扣费和 session trace metadata。
- 释放托管环境后可表达停止扣费确认、T+1 审计和文件保护/清理边界。
- raw API key、raw prompt、`launchToken`、`runtimeToken` 和内部存储密钥不得出现在 API response 或 canonical state。

该层级不是完整真实上线，不代表用户已经可以通过生产 Portal frontend 完整操作，不代表 Gateway、Runtime Bridge、one-person-lab、云资源和真实 trace source 已完成生产联通。

## 尚未完成真实上线能力

以下能力尚未完成，不能在本报告中视为已上线：

- Portal frontend MVP UI
- Gateway / Runtime Bridge 真实联通
- one-person-lab 实际拉取/部署/运行接入
- 真实云资源开通
- 真实价格审批
- Langfuse 真实 trace source 接入
- cleanup 删除 v19/v20/v21 旧路线

## 验收边界

- 本轮不写业务代码。
- 本轮不改 frontend、Gateway、Runtime Bridge、deploy、`.sentrux`、adapters 或 one-person-lab upstream。
- 本轮不读取 `/home/dev/.secrets/medopl/secrets.env.txt`。
- 本轮不调用真实云 API。
- 本轮不运行 build/push/kubectl/live-test。

## 总 smoke

`scripts/smoke-test-v22-mvp-contract-suite.mjs` 作为 v22 MVP contract acceptance suite，串联运行以下 smoke，并输出 `ok: true` 与 passed smoke 名称：

- `scripts/smoke-test-v22-pricing-plan-contract.mjs`
- `scripts/smoke-test-v22-mvp-managed-opl-loop-contract.mjs`
- `scripts/smoke-test-v22-user-credit-provider-key-flow.mjs`
- `scripts/smoke-test-v22-managed-environment-open-flow.mjs`
- `scripts/smoke-test-v22-opl-work-message-file-run-flow.mjs`
- `scripts/smoke-test-v22-portal-files-billing-trace-flow.mjs`
- `scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs`
