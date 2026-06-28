# MedOPL v22

MedOPL 是 OPL-Webui 的商业资源控制面，面向需要 owner 创建或批准账号、充值/授信、套餐、托管计算资源、存储空间、费用核对与释放能力的用户，同时服务平台运维人员进行账单、审计和资源状态治理。

普通用户看到的是资源购买与计算资源管理 Portal，不是云资源控制台，不是用户自配云资源，不是 OPL-Webui 本体，也不是 ordinary chat 或科研执行主界面。产品主语言是账号、OPL workspace、计算资源、存储空间、套餐、任务并发、输入文件、输出文件、余额、消费、账单、预扣费、冻结金额、停止计费和审计状态。

One Person Lab 是 clean upstream：不修改 upstream 源码，不 import upstream 内部模块。MedOPL 只通过 OPL Web Gateway、Runtime Bridge / Runtime Agent、公开 API/CLI 和必要的内部 anti-corruption mapping 接入。

当前 current truth 是商业业务流复验：账号开通/批准、充值/授信、套餐、runtime/storage、upload/run/artifact、billing ledger、statement reconciliation、release/destroy/stop billing。Release Image、Cloud Rollout 和 receipt manifest 是 operations/release substrate；它们不定义用户产品主线，也不代表 external PSP、SLA/multi-region 或 unscoped full production 已完成。

## Active Surface

- `services/portal/frontend`: Portal 商业资源控制面前端。
- `services/medopl-go-backend`: MedOPL v22 business account、runtime/storage、billing/audit 和 release 控制面。
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

默认入口只表达 v22 资源控制面真相：用户从 Portal “进入 OPL”或访问 `/opl/entry/preflight`，两条路径都进入同一套 Gateway / preflight / launch 逻辑。默认路径不是 v19/v20/v21 appliance，不是 `user_owned`，不是 `resource-order`，不是旧 runner/provisioner，不把 `deploy/*` 或 `adapters/*` 作为默认入口，也不把 OpenCost/Langfuse 写成主产品叙事。

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
