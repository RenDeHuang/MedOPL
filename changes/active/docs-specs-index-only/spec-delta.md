# docs-specs-index-only Spec Delta

Target specs:

- specs/framework/spec.md
- specs/product/spec.md
- specs/runtime/spec.md
- specs/source/spec.md

## ADDED

- `framework:docs-specs-index-only`: `docs/specs/README.md` is a human contract index only; durable requirements live in root domain specs, source, tests, fixtures, manifest, runner or CLI/API behavior.

## MODIFIED

- `framework:repo-native-change-lifecycle`: tests must not parse narrative Markdown prose or fenced JSON as stable machine truth.
- `product:managed-opl-service`, `runtime:bridge-projection` and `source:go-control-plane-mvp-takeover`: dependent tests now read durable owner surfaces instead of `docs/specs/README.md` prose.

## REMOVED

- Machine reliance on fenced JSON and long prose blocks inside `docs/specs/README.md`.

## CANNOT-CLAIM

- Full product spec compaction is complete.
- Runtime behavior, real cloud, deploy, billing, production readiness or UI behavior changed.

## EVALS

- `node tests/contract/contract-test-v22-docs-portfolio-lifecycle.mjs`
- `node tests/contract/contract-test-v22-mvp-contract-suite.mjs`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `npm run verify`
