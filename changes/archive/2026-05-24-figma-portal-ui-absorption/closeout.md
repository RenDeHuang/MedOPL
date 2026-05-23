# figma-portal-ui-absorption Closeout

Status: archived

## Commits

- `cf7cf01` absorbed the Figma Make React shell into repo-native Portal frontend source.
- `c280268` absorbed the Figma Make admin UI surface.
- `1a0acd7` aligned the frontend API surface after UI absorption.
- `816f743` later closed the provider key reuse gap that was explicitly outside this package.

## Verification

- `npm --prefix services/portal/frontend run typecheck`: pass.
- `node tests/regression/portal/regression-test-v22-portal-figma-make-interaction-readiness.mjs`: pass.
- `node tests/regression/portal/regression-test-v22-portal-frontend-surface-composables.mjs`: pass.
- `node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs`: pass.
- `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.

## Can Claim

- Figma Make is no longer the implementation truth for the Portal UI; repo-native frontend source and local evals are the implementation truth.
- The productization cursor can move to `portal-typed-api-contract`.

## Cannot Claim

- Cannot claim provider key reuse, OPL entry real launch, Go backend takeover or real-cloud authorization has landed.
- Cannot claim real cloud, deploy, kubectl, build/push, live-test or production billing is authorized.
- Cannot claim external Figma Make remains a runtime dependency or production evidence source.

## Archive Target

- changes/archive/2026-05-24-figma-portal-ui-absorption

## History Handoff

- docs/history/README.md

## Next Owner

- MedOPL Platform for `portal-typed-api-contract`.
