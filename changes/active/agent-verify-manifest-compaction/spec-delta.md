# agent-verify-manifest-compaction Spec Delta

Target specs:

- specs/framework/spec.md

## ADDED

- `framework:agent-verify-manifest-current-leaf-only` The active verify manifest must store only the current cursor leaf; historical leaves must be retained through history/provenance, not active machine cursor state.

## MODIFIED

- `framework:machine-cursor-compaction` is extended by this cleanup package through the current-state index loop gate.

## REMOVED

- Closed historical leaf entries from `tests/fixtures/v22/agent-verify-manifest.json`.

## CANNOT-CLAIM

- This package does not fully compact suite, package or branch override command duplication.
- This package does not compact docs/specs or docs/history.
- This package does not split Go handlers or workflow gate source.
- This package does not prove runtime behavior, production readiness, cloud readiness or deploy readiness.

## EVALS

- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`
- `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs`
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`
- `node scripts/v22-verify.mjs list --json`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --dry-run --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `npm run verify`
