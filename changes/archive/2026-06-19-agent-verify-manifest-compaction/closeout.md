# agent-verify-manifest-compaction Closeout

Status: archived

## Commits

- this commit: compact active verify manifest leaves

## Verification

- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`: pass
- `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs`: pass
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: pass
- `node scripts/v22-verify.mjs list --json`: pass
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --dry-run --json`: pass
- `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`: pass
- `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs`: pass
- `node tests/contract/contract-test-v22-root-verify-workflow-entrypoints.mjs`: pass
- `node tests/contract/contract-test-v22-spec-eval-traceability.mjs`: pass
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass
- `npm run verify`: pass

## Can Claim

- `agent-verify-manifest.json` now stores only the current cursor leaf.
- `agent-verify-manifest.json` shrank from 1980 lines to 685 lines.
- The current-state index loop gate now prevents historical leaves from returning to the active verify manifest.

## Cannot Claim

- `agent-verify-manifest.json` suite/package command duplication is fully compact.
- `docs/specs/README.md` is compact.
- `docs/history/README.md` is compact.
- Go handlers, workflow gate, runtime behavior, deploy, live cloud, billing or production readiness are complete.

## Plan Completion Audit

- functional: done
- code_cleanup: done
- docs_foldback: done
- verification: done
- retired_entrypoints: done
- cannot_claim: done

## Cleanup Result

- deleted: 13 closed historical leaf entries from `tests/fixtures/v22/agent-verify-manifest.json`.
- folded: historical leaf detail remains available through git history and archived change packages; the active manifest keeps only current execution truth.
- retained: suite/package/branch override command arrays, docs/specs, docs/history, Go handlers and workflow gate.
- reason: retained surfaces have separate owner packages or direct consumers.
- next: run docs/specs index-only foldback, docs/history summary-only foldback, Go handler split and workflow gate split in scoped packages.

## Archive Target

- changes/archive/2026-06-19-agent-verify-manifest-compaction
