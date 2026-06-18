# docs-history-summary-only Closeout

Status: ready_for_landing_review

## Commits

- this commit: compact history archive and decouple tests from history prose

## Verification

- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`: pass
- `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs`: pass
- `node tests/contract/contract-test-v22-landing-closeout-automation.mjs`: pass
- `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`: pass
- `node tests/contract/contract-test-v22-docs-portfolio-lifecycle.mjs`: pass
- `npm run test:health`: pass
- `npm run test:contract`: pass
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass

## Can Claim

- `docs/history/README.md` is compressed from 8477 lines to 44 lines.
- Closeout machine state is now represented in `goal-current.json.latest_landed_closeout`.
- Local-contract tests no longer depend on long history Markdown run sections.

## Cannot Claim

- Runtime behavior, deploy, billing, public access or production readiness changed.
- `agent-verify-manifest.json` is compacted.
- docs/specs, Go handlers or workflow gate source are compacted.

## Plan Completion Audit

- functional: done
- code_cleanup: done
- docs_foldback: done
- verification: done
- retired_entrypoints: done
- cannot_claim: done

## Cleanup Result

- deleted: landed-run prose database from `docs/history/README.md`.
- folded: latest landed closeout fields into `tests/fixtures/v22/goal-current.json.latest_landed_closeout`.
- retained: archive packages, git history, evidence docs, active change packages and existing verify manifest.
- reason: retained surfaces are current machine/source/provenance owners with active consumers.
- next: compact `agent-verify-manifest.json`, compact docs/specs, split Go handlers and split workflow gate in scoped packages.

## Archive Target

- changes/archive/2026-06-18-docs-history-summary-only
