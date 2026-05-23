# figma-portal-ui-absorption Spec Delta

Target specs:

- specs/product/spec.md
- specs/source/spec.md

## ADDED

- No durable requirement is added by opening this package; it executes the already landed `product:golden-path-productization-roadmap` and `source:figma-ui-repo-native-absorption` requirements.

## MODIFIED

- `product:golden-path-productization-roadmap` now has `figma-portal-ui-absorption` as the current executable package.
- `source:figma-ui-repo-native-absorption` moves from roadmap item to active implementation cursor and must stay repo-native.

## REMOVED

- No durable requirement is removed in this package.

## CANNOT-CLAIM

- Cannot claim Figma UI has landed until repo source changes, typed API wiring and evals pass.
- Cannot claim provider key reuse, OPL entry real launch, Go backend takeover or real-cloud authorization has landed.
- Cannot claim real cloud, deploy, kubectl, build/push, live-test or production billing is authorized.

## EVALS

- `npm --prefix services/portal/frontend run typecheck`
- `node tests/regression/portal/regression-test-v22-portal-figma-make-interaction-readiness.mjs`
- `node tests/regression/portal/regression-test-v22-portal-frontend-surface-composables.mjs`
- `node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs`
- `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
