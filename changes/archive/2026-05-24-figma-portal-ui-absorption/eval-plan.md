# figma-portal-ui-absorption Eval Plan

## Required Commands

```bash
npm --prefix services/portal/frontend run typecheck
node tests/regression/portal/regression-test-v22-portal-figma-make-interaction-readiness.mjs
node tests/regression/portal/regression-test-v22-portal-frontend-surface-composables.mjs
node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs
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

- The package is correctly opened as the next productization cursor.
- The implementation, once landed, can claim only repo-native frontend absorption covered by these local checks.

## Cannot Claim

- Figma prototype is production truth before source absorption.
- Provider reuse, Go backend takeover or real cloud authorization has landed.
- Real cloud, deploy, kubectl, build/push, live-test or production billing is authorized.
