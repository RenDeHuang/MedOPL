# portal-opl-refund-api-fix Spec Delta

Target specs:

- specs/runtime/spec.md
- specs/operations/spec.md

## ADDED

- `runtime:portal-opl-entry-alias-preflight`: `/portal/opl` must route to the Portal OPL entry surface, and OPL entry must run provider-binding preflight before creating a launch.
- `operations:refund-signed-ledger`: Portal admin refund ledger entries must be negative local ledger amounts and reduce the local account balance.

## MODIFIED

- none

## REMOVED

- none

## CANNOT-CLAIM

- This local fix does not prove real upstream OPL production behavior, live provider, real cloud, production runtime, production billing or deploy readiness.
- This local fix does not authorize secret read or true cloud mutation.

## EVALS

- `node tests/regression/portal/regression-test-v22-portal-local-api-action-browser.mjs`
- `go test ./...` from `services/medopl-go-backend`
- `npm --prefix services/portal/frontend run typecheck`
- `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
