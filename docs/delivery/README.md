# Delivery Truth

Owner: `MedOPL`
Purpose: `delivery_truth`
State: `active`
Machine boundary: 本文是人读交付入口。当前执行 cursor、branch overrides 和 suite commands 以 `tests/fixtures/v22/goal-current.json` 与 `tests/fixtures/v22/agent-verify-manifest.json` 为准。

## Current Cursor

当前 product cursor 是 `leaf-run-artifact-trace-closure`。它要求 run、artifact 和 trace metadata backflow 本地闭合，Portal 只能显示 owner-scoped real local state，不能泄漏 raw token、raw provider key 或后端存储细节。

最近 landed 的 `feat/v22-slide-06-opl-entry-runtime` 已关闭 Portal launch id、providerKeyRef、workspace session、runtime session 和 public launch payload 边界本地闭环；slide-07 必须继续保留 slide-01 storage regression、slide-02 runtime real API regression、slide-03 account/wallet/billing regression、slide-04 workspace/files regression、slide-05 resource lifecycle regression 和 slide-06 OPL entry runtime regression 作为防回归命令。

每个 product slide 仍按清退生命周期执行：先删除或吸收旧 fake/demo/alias surface，再由 eval、implementation、verify、landing gate 和 post-merge closeout 推进 cursor。

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
