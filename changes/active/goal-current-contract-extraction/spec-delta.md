# goal-current-contract-extraction Spec Delta

Target specs:

- specs/framework/spec.md

## ADDED

- `framework:goal-current-machine-contract-extraction` Current machine cursor keeps only current cursor, latest landed closeout, current leaf, verify bundle, next cursor and explicit refs to consumer-first machine contracts under `contracts/**`; large owner payloads move to dedicated machine contracts consumed by tests/runners.

## MODIFIED

- `framework:machine-cursor-compaction` now includes contract-ref enforcement for the extracted Package D and production launch owner payloads.

## REMOVED

- Top-level embedded `package_d_deploy_readiness_plan` and `production_launch_goal_gap_map` payloads from `tests/fixtures/v22/goal-current.json`.

## CANNOT-CLAIM

- This package does not prove runtime behavior, production readiness, deploy authorization, kubectl authorization or public access completion.
- This package does not compact every remaining large owner payload in `goal-current.json`.
- This package does not archive the extracted contracts into durable prose specs; they remain machine-consumed contracts.

## EVALS

- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`
- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`
- `npm run test:health`
- `npm run test:contract`
- `git diff --check`
