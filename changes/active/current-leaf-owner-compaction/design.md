# current-leaf-owner-compaction Design

## Architecture

`current_leaf` remains a compact machine cursor boundary: id, stage, problem, verification commands, allowed files, forbidden files, forbidden operations and writeback targets. Package D readiness and production launch gap projections remain top-level owner payloads.

## Data Flow

The verify runner resolves the active leaf from `agent-verify-manifest.json` and compares command/boundary fields against `goal-current.json`. Tests that need Package D plan truth read `goal-current.package_d_deploy_readiness_plan` directly instead of reading a duplicated copy under `current_leaf`.

## Failure Modes

- If a future edit re-adds large owner payloads under `current_leaf`, the current-state index loop fails.
- If a consumer still reads `current_leaf.package_d_deploy_readiness_plan`, its test fails after this compaction.
- If top-level owner payloads are deleted without migrating consumers, future-authorized Package D gates fail.

## Surface Impact

- source: none
- docs: no product/runtime prose change
- specs: `specs/framework/spec.md`
- tests: `tests/contract/contract-test-v22-current-state-index-loop.mjs`, `tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`, `tests/fixtures/v22/goal-current.json`
