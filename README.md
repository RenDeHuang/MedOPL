# MedOPL v22

MedOPL 是 One Person Lab 的开箱即用 SaaS 托管科研工作台，面向 AI 小白科研用户，同时服务平台运维人员进行账单、审计和运行状态治理。

普通用户看到的是科研托管平台，不是云资源控制台，不是用户自配云资源。产品主语言是科研工作台、托管运行环境、工作空间、文件空间、会话、任务、输入文件、输出文件、运行轨迹、余额、消费、账单、预扣费、冻结金额、停止计费和审计状态。

One Person Lab 是 clean upstream：不修改 upstream 源码，不 import upstream 内部模块。MedOPL 只通过 OPL Web Gateway、Runtime Bridge / Runtime Agent、公开 API/CLI 和必要的内部 anti-corruption mapping 接入。

当前完成层级是 contract-level + Portal API/domain + Portal UI MVP。它不代表真实云资源、Gateway、Runtime Bridge、one-person-lab upstream、真实价格审批、真实账单核对或真实部署已全部上线。

## Active Surface

- `services/portal`: Portal SaaS 科研托管平台控制面，包括 API/domain 小闭包和 Portal UI MVP。
- `services/opl-web-gateway`: OPL Web entry/preflight 与统一身份边界，当前不作为本分支修改范围。
- `services/opl-runtime-bridge`: Runtime Bridge / Runtime Agent 合同边界，当前不作为本分支修改范围。
- `contracts/medopl-*.json`: consumer-first 产品、Portal、API、runtime、data-plane、billing、release 和 cloud boundary 机器合同。
- `docs/{active,product,runtime,specs,policies,delivery,source,public,references,history}/README.md`: OPL-style taxonomy truth。
- `tests/**/*.mjs`: v22 repo-local eval。只有 health 和 golden 才叫 smoke。
- `tests/fixtures/v22/{goal-current,agent-verify-manifest}.json`: 当前机器 cursor 和 verify manifest。
- `scripts/v22-verify.mjs`、`scripts/v22-test-classification.mjs`、`scripts/v22-workflow-gate.mjs`: 默认 runner / classifier / workflow gate。

## Contract Index

v22 人读合同和长期边界入口是 [docs/specs/README.md](./docs/specs/README.md)；机器可消费产品权威入口是 [contracts/README.md](./contracts/README.md)。

核心入口：

- [docs/active/README.md](./docs/active/README.md)
- [docs/specs/README.md](./docs/specs/README.md)
- [docs/delivery/README.md](./docs/delivery/README.md)
- [docs/history/README.md](./docs/history/README.md)

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

GitHub handoff 纪律见 [docs/policies/README.md](./docs/policies/README.md) 和 [docs/history/README.md](./docs/history/README.md)。

## Local Verification

当前 v22 验证入口以 `scripts/v22-verify.mjs` 为准。`mvp` 只是 legacy local-regression alias，不再作为默认 smoke 或默认 agent 入口：

```bash
node scripts/v22-verify.mjs active-platform
node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk
npm --prefix services/portal run frontend:typecheck
```

本 README 不要求执行真实云 API、`git remote set-url`、push、build/push/kubectl/live-test。
