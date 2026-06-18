# docs-history-summary-only Spec Delta

Target specs:

- specs/framework/spec.md

## ADDED

- `framework:docs-history-summary-only` The history README is a compact human archive index only. Latest landed closeout machine state must live in `tests/fixtures/v22/goal-current.json.latest_landed_closeout`; scripts and tests must not parse Markdown run sections, fixed headings or landed-run prose from `docs/history/README.md`.

## MODIFIED

- `framework:structured-closeout-audit` Closeout automation reads and writes structured closeout state in the machine cursor fixture. `docs/history/README.md` may be updated as a short human pointer, but it is not the closeout database.

## REMOVED

- Long landed-run sections from `docs/history/README.md`.
- Test assertions that require each archive change id, product loop closeout, local RC closeout or framework baseline to be restated as history prose.

## CANNOT-CLAIM

- This package does not remove historical evidence from git history or `changes/archive/`.
- This package does not compact `agent-verify-manifest.json`.
- This package does not prove runtime behavior, production readiness, billing, public access or commercial completion.

## EVALS

- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`
- `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs`
- `node tests/contract/contract-test-v22-landing-closeout-automation.mjs`
- `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`
- `node tests/contract/contract-test-v22-docs-portfolio-lifecycle.mjs`
- `npm run test:health`
- `npm run test:contract`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
