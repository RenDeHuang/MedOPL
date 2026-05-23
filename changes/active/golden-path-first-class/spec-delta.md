# golden-path-first-class Spec Delta

Target specs:

- `specs/product/spec.md`
- `specs/framework/spec.md`
- `specs/source/spec.md`

## ADDED

- `product:golden-path-default-spine` defines the default MedOPL product spine and requires golden path health to be the first default verification section.
- `framework:golden-path-impact-required` requires every change package to declare Golden Path Impact before implementation.
- `source:portal-runtime-fanout-debt` records `services/portal/src/app/portal-runtime.mjs` as an active source debt surface and requires local structure metrics before and after extraction.

## MODIFIED

- `framework:change-package-required` adds Golden Path Impact to the required package fields.
- `framework:repo-native-change-lifecycle` clarifies that governance gates are guardrails after golden path health, not the default narrative center.

## REMOVED

- No durable requirement is removed in this change.

## CANNOT-CLAIM

- Cannot claim production runtime, production billing, real cloud execution or deploy readiness from local golden path smoke.
- Cannot claim Sentrux Pro root-cause diagnostics are available in this repo.
- Cannot claim the first fan-out extraction fully resolves all Portal source debt.

## EVALS

- `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`
- `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs`
- `node tests/contract/contract-test-v22-golden-smoke-suite.mjs`
- `node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `npm --prefix services/portal run check`
- `node tests/regression/portal/regression-test-v22-portal-runtime-suite.mjs --group all`
- `git diff --check -- docs specs changes tests scripts services/portal/src package.json`
