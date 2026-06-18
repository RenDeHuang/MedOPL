# active-package-foldout Spec Delta

Target specs:

- specs/framework/spec.md

## ADDED

- `framework:active-package-foldout`: completed change packages must be moved from `changes/active/<id>` to `changes/archive/YYYY-MM-DD-<id>`; archive move review must validate the archive package and not the deleted active path.

## MODIFIED

- `framework:repo-native-change-lifecycle`: active package deletion paired with a matching archive package is a closeout move, not an incomplete active package.

## REMOVED

- Long-lived completed cleanup packages from `changes/active`.

## CANNOT-CLAIM

- This cleanup does not prove runtime behavior, production readiness, deploy, billing, live cloud or public access.

## EVALS

- `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`
- `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs`
- `node tests/contract/contract-test-v22-review-secret-hygiene-gate.mjs`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `npm run test:contract`
