# machine-cursor-manifest-compaction Spec Delta

Target specs:

- specs/framework/spec.md

## ADDED

- `framework:machine-cursor-compaction` The current machine cursor must keep release readiness as compact gating state and prevent large duplicated Package D or production launch projections from returning under `release_readiness_state`.

## MODIFIED

- None.

## REMOVED

- Duplicate `release_readiness_state.package_d_deploy_readiness_plan` and `release_readiness_state.production_launch_goal_gap_map` payloads from `tests/fixtures/v22/goal-current.json`.

## CANNOT-CLAIM

- This package does not fully compact `goal-current.json`.
- This package does not compact `agent-verify-manifest.json`.
- This package does not compact docs/specs, docs/history, Go handlers, or workflow gate source.
- This package does not prove runtime behavior or production readiness.

## EVALS

- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`
- `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs`
- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`
- `node tests/contract/contract-test-v22-real-cloud-authorization-boundary.mjs`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --dry-run --json`
- `npm run verify`
