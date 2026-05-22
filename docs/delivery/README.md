# Delivery Truth

Owner: `MedOPL`
Purpose: `delivery_truth`
State: `active`
Machine boundary: 本文是人读交付入口。当前执行 cursor、branch overrides 和 suite commands 以 `tests/fixtures/v22/goal-current.json` 与 `tests/fixtures/v22/agent-verify-manifest.json` 为准。

## Current Cursor

当前 product cursor 是 `real-cloud-authorization-boundary`。pre-cloud 9 个 product slides 已完成本地闭环；current verify、product-engineering-loop suite、workflow review 和 local-contract 继续作为本地 pre-cloud 防回归 bundle 运行。真实云、secret、deploy、kubectl、build/push 和 live-test 仍是单独授权边界。

最近 landed 的 `feat/v22-slide-09-precloud-readiness` 已关闭 pre-cloud readiness 本地闭环，并把临时 slide baton 折叠为 history summary；默认 current bundle 仍保留 slide-01 storage regression、slide-02 runtime real API regression、slide-03 account/wallet/billing regression、slide-04 workspace/files regression、slide-05 resource lifecycle regression、slide-06 OPL entry runtime regression、slide-07 run/artifact/trace regression 和 slide-08 admin ops regression 作为防回归命令。

后续真实云工作不得继承 slide authority；必须先单独确认授权边界，再按清退生命周期由 eval、implementation、verify、landing gate 和 post-merge closeout 推进 cursor。

## Default Verification

```bash
node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
```

## Framework Entry Commands

```bash
npm run test:fast
npm run test:lanes
npm run test:health
npm run test:smoke
npm run test:contract
npm run test:regression
npm run gate:contract
npm run gate:review
npm run closeout:check
```

`test:fast` 是 slide 开发前置防膨胀入口：repo hygiene、repo bloat、line budget、lane registry、product-loop preflight 和 health gate 必须同时通过。`test:lanes` 是测试生命周期入口，专门防止 repo-local eval 游离、重复 wrapper 和 smoke 命名污染。

## Cloud / Deploy Sequence

Cloud delivery must keep this order:

```text
mock/snapshot provider
-> readonly quote
-> dry-run plan
-> readonly inventory
-> authorized create/release
-> authorized deploy
-> canary / QA / status update
```

Readonly and mutation lanes must use separate authorization, secret allowlists, runners and evidence. Evidence with real secrets or live cloud responses stays in `.runtime` and does not enter git.

## Authoring Record Discipline

Each authoring branch or cleanup branch records:

- branch and base trunk HEAD
- subscribed truth/spec/policy files
- step commits
- verification commands and results
- subagent roles and models
- landing gate recommendation
- post-merge closeout expectation and target truth files
- non-goals and forbidden operations not performed

The durable human summary is `docs/history/README.md`; detailed proof remains in git history and command output.

## Backend Go Convergence Authoring Lane

`feat/v22-backend-go-convergence-program` 是后端收敛 authoring lane。它不接管当前 `real-cloud-authorization-boundary` product cursor，不授权 secret、真实云、deploy、kubectl、build/push 或 live-test。

该 lane 的交付方式是每个 step 一个 commit，并且每个 step 都按 `truth -> gap -> eval -> implementation/cleanup -> verify -> landing gate -> post-merge closeout -> next cursor` 执行。7 阶段只作为 compact machine block、spec anchor、registered tests 和 landed history summary 存在，不恢复旧合同目录、旧 recovery 目录、root stage docs 或 `scripts/smoke-test-*`。

Authoring verification:

```bash
node scripts/v22-verify.mjs current --branch feat/v22-backend-go-convergence-program --base origin/recovery/platform-v22-trunk --dry-run --json
node scripts/v22-verify.mjs package backend-go-convergence --base origin/recovery/platform-v22-trunk
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
```
