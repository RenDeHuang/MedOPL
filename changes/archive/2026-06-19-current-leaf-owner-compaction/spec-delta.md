# current-leaf-owner-compaction Spec Delta

Target specs:

- specs/framework/spec.md

## ADDED

- `framework:current-leaf-owner-compaction` The current machine cursor keeps `current_leaf` as leaf metadata and verification boundary state only; owner payloads such as Package D readiness plans and production launch gap maps live at their top-level owner surfaces and must not be duplicated under `current_leaf`.

## MODIFIED

- None.

## REMOVED

- Duplicate `current_leaf.package_d_deploy_readiness_plan` and `current_leaf.production_launch_goal_gap_map` payloads from `tests/fixtures/v22/goal-current.json`.

## CANNOT-CLAIM

- This package does not remove the canonical top-level Package D readiness plan or production launch gap map.
- This package does not compact `agent-verify-manifest.json`.
- This package does not compact docs/specs, docs/history, Go handlers or workflow gate source.
- This package does not prove runtime behavior or production readiness.

## EVALS

- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`
- `node tests/cloud/cloud-test-v22-tencent-deploy-execution-config-local-gate.mjs`
- `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs`
- `node tests/contract/contract-test-v22-real-cloud-authorization-boundary.mjs`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `npm run verify`
