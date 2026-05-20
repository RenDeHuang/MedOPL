# Delivery Truth

Owner: `MedOPL`
Purpose: `delivery_truth`
State: `taxonomy_skeleton`
Machine boundary: 本文是人读交付入口。当前执行 cursor、branch overrides 和 suite commands 仍以 `docs/recovery/v22-goal-current.json` 与 `docs/recovery/v22-agent-verify-manifest.json` 为准。

## Current Cursor

当前 product cursor 是 `leaf-portal-postgres-redis-local-production-data-closure`。本 docs taxonomy skeleton 分支不实现 PostgreSQL/Redis，不推进业务 cursor。

## Default Verification

```bash
node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk
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

## Current Sources

- `docs/status.md`
- `docs/recovery/v22-goal-current.json`
- `docs/recovery/v22-agent-verify-manifest.json`
- `docs/recovery/mvp-contract-acceptance.md`
- `docs/specs/README.md`
- `docs/specs/README.md`
- `docs/specs/README.md`

## Migration Status

本 README 是 delivery skeleton。旧 recovery boards、program tables 和 cloud workflow contracts 本轮只索引不删除。

