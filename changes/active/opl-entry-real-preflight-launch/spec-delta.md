# opl-entry-real-preflight-launch Spec Delta

Target specs:

- specs/runtime/spec.md
- specs/source/spec.md

## ADDED

- `runtime:opl-entry-real-preflight-launch` defines Portal OPL entry as a backend-owned preflight / launch / Gateway readiness projection, not page-local readiness truth.
- `source:opl-entry-real-preflight-launch` defines OPLEntry frontend code as a typed API consumer of backend launch projections and providerKeyRef state.

## MODIFIED

- `source:portal-typed-api-contract` remains closed as the underlying typed API boundary for OPL entry data.

## REMOVED

- No durable requirement is removed in this package.

## CANNOT-CLAIM

- Cannot claim live provider message backflow or production WebUI evidence without separately authorized live proof.
- Cannot claim real cloud, deploy, kubectl, build/push, live-test or production billing is authorized.
- Cannot claim Go backend takeover has happened.

## EVALS

- `node tests/regression/opl/regression-test-v22-opl-entry-preflight-auth-flow.mjs`
- `node tests/regression/opl/regression-test-v22-opl-web-gateway-launch.mjs`
- `node tests/regression/opl/regression-test-v22-provider-secret-boundary-contract.mjs`
- `node tests/regression/portal/regression-test-v22-portal-figma-make-interaction-readiness.mjs`
- `npm --prefix services/portal/frontend run typecheck`
- `npm --prefix services/portal run check`
- `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
