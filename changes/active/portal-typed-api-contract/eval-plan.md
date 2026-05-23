# portal-typed-api-contract Eval Plan

## Required Commands

```bash
node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs
node tests/regression/portal/regression-test-v22-portal-runtime-real-api-data-closure.mjs
node tests/regression/portal/regression-test-v22-portal-local-api-action-closure.mjs
npm --prefix services/portal/frontend run typecheck
npm --prefix services/portal run check
node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json
node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
git diff --check -- docs specs changes tests scripts package.json services/portal/frontend/src services/portal/src
```

## Evidence Level

- local frontend proof
- local contract proof
- local golden path smoke evidence

## Can Claim

- The package can claim typed API contract alignment only after required local evals pass.

## Cannot Claim

- No production evidence, real cloud authorization, provider live proof or Go backend takeover.
