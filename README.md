# MedOPL v22

MedOPL 是 One Person Lab 的开箱即用 SaaS 托管科研工作台，面向 AI 小白科研用户，同时服务平台运维人员进行账单、审计和运行状态治理。

普通用户看到的是科研托管平台，不是云资源控制台，不是用户自配云资源。产品主语言是科研工作台、托管运行环境、工作空间、文件空间、会话、任务、输入文件、输出文件、运行轨迹、余额、消费、账单、预扣费、冻结金额、停止计费和审计状态。

One Person Lab 是 clean upstream：不修改 upstream 源码，不 import upstream 内部模块。MedOPL 只通过 Gateway、Adapter、Runtime Agent、API/CLI 等公开边界接入。

当前完成层级是 contract-level + Portal API/domain + Portal UI MVP。它不代表真实云资源、Gateway、Runtime Bridge、one-person-lab upstream、真实价格审批、真实账单核对或真实部署已全部上线。

## Active Surface

- `services/portal`: Portal SaaS 科研托管平台控制面，包括 API/domain 小闭包和 Portal UI MVP。
- `services/opl-web-gateway`: OPL Web entry/preflight 与统一身份边界，当前不作为本分支修改范围。
- `services/opl-runtime-bridge`: Runtime Bridge / Runtime Agent 合同边界，当前不作为本分支修改范围。
- `docs/contracts`: v22 contract-level 产品、闭环和共享边界合同。
- `docs/recovery`: v22 recovery、active surface、验收和 GitHub handoff 文档。
- `scripts/smoke-test-v22-*`: v22 contract/API smoke。

## Contract Index

v22 合同目录见 [docs/contracts/README.md](./docs/contracts/README.md)。

核心入口：

- [docs/contracts/v22-mvp-managed-opl-loop.md](./docs/contracts/v22-mvp-managed-opl-loop.md)
- [docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md](./docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md)
- [docs/recovery/mvp-contract-acceptance.md](./docs/recovery/mvp-contract-acceptance.md)

## Default Entry

默认入口只表达 v22 托管工作台真相：用户从 Portal “进入 OPL 工作台”或访问 `/opl/entry/preflight`，两条路径都进入同一套 Gateway / preflight / launch 逻辑。默认路径不是 v19/v20/v21 appliance，不是 `user_owned`，不是 `resource-order`，不是旧 runner/provisioner，不把 `deploy/*` 或 `adapters/*` 作为默认入口，也不把 OpenCost/Langfuse 写成主产品叙事。

## Secret Hygiene

本仓库可能在同一台机器上与本地腾讯云 kubeconfig、token、API key、SecretId、SecretKey、GitHub token/PAT、SSH key、`/home/dev/.secrets/medopl/secrets.env.txt` 等凭据共存。

这些凭据只能在后续“真实云 / GitHub 配置 / 部署”被单独授权时本地读取使用，绝对不能进入 git 或 GitHub。

禁止提交：

- kubeconfig
- token / GitHub token / PAT
- API key / SecretId / SecretKey
- SSH private key
- `.env`、`.env.*`、`*.env`
- 本地 `github` 私有配置文件
- 任何包含真实凭据值的 README、docs、logs、commit message 或 evidence

GitHub handoff runbook 见 [docs/recovery/github-handoff.md](./docs/recovery/github-handoff.md)。

## Local Verification

当前 v22 contract/API smoke 入口：

```bash
node scripts/smoke-test-v22-default-entry-narrative-gate.mjs
node scripts/smoke-test-v22-mvp-contract-suite.mjs
node scripts/smoke-test-v22-saas-portal-opl-ops-surface-contract.mjs
npm --prefix services/portal run frontend:typecheck
```

本 README 不要求执行真实云 API、`git remote set-url`、push、build/push/kubectl/live-test。
