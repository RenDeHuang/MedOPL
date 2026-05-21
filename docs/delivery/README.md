# Delivery Truth

Owner: `MedOPL`
Purpose: `delivery_truth`
State: `active`
Machine boundary: 本文是人读交付入口。当前执行 cursor、branch overrides 和 suite commands 以 `tests/fixtures/v22/goal-current.json` 与 `tests/fixtures/v22/agent-verify-manifest.json` 为准。

## Current Cursor

当前 product cursor 是 `leaf-portal-postgres-redis-local-production-data-closure`。它要求 PostgreSQL 成为 Portal local production data canonical truth，Redis 只用于 session/cache/queue/lock；`PORTAL_STORAGE_MODE=postgres_redis` 缺连接或 schema 时必须 fail-closed，不得回退 JSON 文件或伪成功。

当前 framework workflow convergence 清退分支不实现 PostgreSQL/Redis，不推进业务 cursor。

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
npm run test:health
npm run test:smoke
npm run test:contract
npm run test:regression
npm run gate:contract
npm run gate:review
npm run closeout:check
```

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
