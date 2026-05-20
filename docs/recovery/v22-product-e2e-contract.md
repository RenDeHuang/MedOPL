# MedOPL v22 Product E2E Contract

This contract defines the top-level product loop that every future implementation, cleanup, refactor, and release readiness slice must preserve.

## Top-Level Product Loop

1. 平台创建 1 名用户。
2. 给用户充值额度。
3. 用户分别登录 portal.medopl.cn 与 opl.medopl.cn。
4. Portal 登录不需要 gflabtoken API Key。
5. OPL 登录 / 进入 OPL 工作台需要 gflabtoken API Key，输入框在密码下面，灰度说明来源于 gflabtoken。
6. 用户在 Portal 开通托管运行环境，选择计算规格/套餐和文件空间。
7. 用户侧看到托管运行环境、工作空间、文件空间、余额、预扣费/冻结金额；不得把 CVM/COS/K8s/云控制台作为普通用户主语言。
8. 后台可有 CVM/COS/runtime/resourceBinding/billingAccount/auditTag，但只作为后台实现和 admin/ops 事实。
9. 账单日内核对，释放后 120 分钟内完成停止计费确认，审计 T+1。
10. OPL Web 使用 clean upstream：https://github.com/gaofeng21cn/one-person-lab，不修改 upstream 源码，不 import upstream 内部模块。
11. 用户在 opl.medopl.cn 可发送信息、上传文件、用文件跑任务、下载输出文件。
12. Portal 可看到 workspace 文件、对应账单、session 对话轨迹。
13. 用户释放托管运行环境后停止扣费，并有审计记录。

## Product Truth

- MedOPL is `platform-provisioned / customer-dedicated`.
- User-facing language: `开箱即用 SaaS 托管科研工作台`.
- Negative language: `不是云资源控制台`; `不是用户自配云资源`.
- `portal.medopl.cn 登录不需要 gflabtoken API Key`.
- `opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key`.
- `API Key 输入框放在 OPL 登录页密码下面`.
- `Portal 可以展示“是否已绑定”状态`.
- `API Key 不是 Portal 普通登录字段`.
- `raw API Key 只能进入后端密钥边界`.

## Contract Subscription

- `docs/contracts/v22-mvp-managed-opl-loop.md`
- `docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md`
- `docs/contracts/v22-opl-entry-preflight-auth-boundary.md`
- `docs/contracts/v22-portal-opl-connection-boundary.md`
- `docs/contracts/v22-upstream-opl-boundary.md`
- `docs/contracts/v22-opl-work-message-file-run-boundary.md`
- `docs/contracts/v22-runtime-bridge-session-run-file-provider-keyref-boundary.md`
- `docs/contracts/v22-portal-files-billing-trace-boundary.md`
- `docs/contracts/v22-release-stop-billing-audit-boundary.md`
- `docs/contracts/v22-cloud-onboarding-workflow-boundary.md`
- `docs/recovery/status-matrix.md`
- `docs/recovery/mvp-contract-acceptance.md`

## Eval Boundary

Default local eval:

- `node tests/contract/smoke-test-v22-product-goal-harness.mjs`
- `node tests/contract/smoke-test-v22-mvp-contract-suite.mjs`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- docs/recovery scripts`

Authorized external canary evidence is not production truth. canary 事实不能自动变 production truth，必须回写合同/status，并等待 productionized 分支吸收。

## Forbidden Boundary

- 不改 services/*
- 不改 deploy/adapters/.sentrux/.env.demo.template
- 不跑 live-test
- 不读 secret
- 不 build/push/kubectl
- 不改 upstream one-person-lab
- 不升级依赖

Cloud lane 授权边界 remains separate. clean upstream one-person-lab remains mandatory.
