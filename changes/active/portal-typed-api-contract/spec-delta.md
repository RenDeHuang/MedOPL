# portal-typed-api-contract Spec Delta

Target specs:

- specs/source/spec.md

## ADDED

- `source:portal-typed-api-contract` defines the Portal frontend typed API modules and normalized adapters as the only frontend-owned boundary for backend control-plane projections.

## MODIFIED

- `source:figma-ui-repo-native-absorption` remains closed as a repo-native UI source rule; typed API contract is now the next executable package.

## REMOVED

- No durable requirement is removed in this package.

## CANNOT-CLAIM

- Cannot claim OPL entry real preflight / launch state is fully closed until that package lands.
- Cannot claim provider live evidence, real cloud, deploy, kubectl, build/push, live-test or production billing is authorized.
- Cannot claim Go backend takeover has happened.

## EVALS

- `node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs`
- `node tests/regression/portal/regression-test-v22-portal-runtime-real-api-data-closure.mjs`
- `node tests/regression/portal/regression-test-v22-portal-local-api-action-closure.mjs`
- `npm --prefix services/portal/frontend run typecheck`
- `npm --prefix services/portal run check`
- `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
