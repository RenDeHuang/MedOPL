# Agent Run: cleanup/v22-docs-taxonomy-skeleton

## meta

- schema_version: 1
- leaf_id: cleanup-v22-docs-taxonomy-skeleton
- run_kind: cleanup
- status: pending_b_review
- model: gpt-5.4
- branch: cleanup/v22-docs-taxonomy-skeleton
- base_trunk_head: 3f0772cc33722aa05696e5b209ecfd0cf6c7be7c
- commit_sha: pending_B_review
- absorbed_commit: none
- supersedes: none
- superseded_by: none
- branch_override_id: docs-taxonomy-skeleton

## goal

Create the first OPL-style docs/tests taxonomy skeleton for MedOPL v22: one lifecycle directory, one `README.md` truth, plus a target `tests/README.md`. This branch does not move or delete old `docs/contracts/**`, `docs/recovery/**`, `docs/recovery/agent-runs/**` or `tests/**/*.mjs` files because the current audit found active references and delete-ready remains zero for this first skeleton cut.

## subagents_and_models

- Carver: `gpt-5.4`, read-only audit of `docs/contracts/**` grouping into product/specs/runtime/policies/delivery.
- Wegener: `gpt-5.4`, read-only audit of `docs/recovery/**` and `docs/recovery/agent-runs/**` grouping into active/delivery/policies/history/references.
- Carson: `gpt-5.4`, read-only audit of `scripts/v22-verify.mjs`, `scripts/v22-test-classification.mjs` and `tests/**/*.mjs` for future `tests/**` taxonomy.

## contract_subscription

- `AGENTS.md`
- `docs/contracts/README.md`
- `docs/contracts/v22-smoke-eval-boundary.md`
- `docs/recovery/status-matrix.md`
- `docs/recovery/mvp-contract-acceptance.md`
- `docs/recovery/v22-goal-current.json`
- `docs/recovery/v22-agent-verify-manifest.json`
- `docs/recovery/agent-runs/README.md`
- `docs/recovery/agent-runs/schema.md`
- `scripts/v22-verify.mjs`
- `scripts/v22-test-classification.mjs`

## allowed_write_scope

- `docs/README.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `docs/public/README.md`
- `docs/references/README.md`
- `docs/history/README.md`
- `tests/README.md`
- `docs/recovery/v22-agent-verify-manifest.json`
- `docs/recovery/agent-runs/2026-05-20-cleanup-v22-docs-taxonomy-skeleton.md`
- `tests/contract/smoke-test-v22-docs-taxonomy-skeleton.mjs`
- `tests/contract/smoke-test-v22-mvp-contract-suite.mjs`
- `scripts/v22-test-classification.mjs`

## forbidden_scope

- no secret read
- no real cloud call
- no upstream modification
- no services implementation
- no `deploy/*`, `.sentrux/*`, `adapters/*`, `infra/*`, one-person-lab upstream changes
- no build/deploy/kubectl/live-test
- no PostgreSQL/Redis implementation
- no admin business closure implementation
- no Portal UI visual/layout/information-architecture change
- no physical deletion of `docs/contracts/**`, `docs/recovery/**`, `docs/recovery/agent-runs/**` or `tests/**/*.mjs`
- A window does not ff-only absorb and does not git push

## implementation_summary

- Added top-level `docs/README.md` as the lifecycle taxonomy index.
- Added target directory README skeletons for `active`, `product`, `runtime`, `specs`, `policies`, `delivery`, `source`, `public`, `references` and `history`.
- Added `tests/README.md` to define the future test taxonomy before moving any executable tests.
- Marked old contract, recovery, agent-run and smoke/eval paths as blocked-retain until replacement truth, reference migration and gates exist.
- Added `tests/contract/smoke-test-v22-docs-taxonomy-skeleton.mjs` to enforce one README per new target directory, blocked-retain existence, branch override wiring and changed-file scope.
- Added a `docs-taxonomy-skeleton` branch override so `v22-verify current` does not run the future PostgreSQL/Redis product leaf on this cleanup branch.
- Added the new gate to `local-contract` and to `scripts/v22-test-classification.mjs` as `default/local-contract`, `contract-local`, `control-plane`, `atomic`, `none`.
- Updated the legacy local-regression runner's branch-override allowlist to recognize this cleanup override without changing its underlying regression script set.

## eval_first_changes

- RED: Without a branch override, `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json` would execute the current PostgreSQL/Redis product cursor instead of the scoped docs cleanup.
- GREEN target: add a manifest override named `docs-taxonomy-skeleton` that runs only docs taxonomy, classification, agent-run, agent-verify and workflow gates.
- RED: A new `tests/**/*.mjs` gate must be explicitly classified or the classification gate fails.
- GREEN target: classify the new gate and keep it out of health/smoke golden paths.
- RED: The legacy local-regression runner rejects unknown branch override suite ids.
- GREEN target: add `docs-taxonomy-skeleton` to that runner's existing allowlist and include the change in this branch's allowed scope.

## blocker_review_and_fix_log

- Contracts auditor found `docs/contracts/**` still has active machine-boundary references, so direct physical deletion is blocked.
- Recovery auditor found `docs/recovery/v22-goal-current.json`, `docs/recovery/v22-agent-verify-manifest.json`, `docs/recovery/status-matrix.md`, `docs/recovery/mvp-contract-acceptance.md` and `docs/recovery/agent-runs/{README.md,schema.md}` are active references, so direct recovery deletion is blocked.
- Scripts auditor found `v22-verify` and smoke classification are path-bound, so moving tests before updating runner/classifier/manifest would break verification.
- The implementation therefore only creates taxonomy skeletons and a gate, with delete-ready remaining zero in this branch.

## verification_commands

- `node tests/contract/smoke-test-v22-docs-taxonomy-skeleton.mjs`
- `node tests/health/smoke-test-v22-smoke-classification-gate.mjs`
- `node tests/health/smoke-test-v22-smoke-eval-boundary.mjs`
- `node tests/contract/smoke-test-v22-agent-run-record-gate.mjs`
- `node tests/contract/smoke-test-v22-agent-verify-entrypoint.mjs`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-regression --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- docs tests scripts`
- forbidden surface diff check
- added-lines secret value scan

## b_review_result

pending_B_review

## post_absorb_verification

not_applicable_yet

## runtime_notes

No UI, Portal backend, PostgreSQL, Redis, OPL, real cloud, upstream, deploy or live runtime was started for this cleanup branch.

## non_goals

- No PostgreSQL/Redis implementation.
- No services implementation.
- No true cloud, deploy, kubectl, live-test or build/push.
- No secret read.
- No upstream modification.
- No Portal UI change.
- No physical deletion or path movement of `docs/contracts/**`, `docs/recovery/**`, `docs/recovery/agent-runs/**` or `tests/**/*.mjs`.
- No claim that this skeleton completes final OPL-style physical cleanup.

## next_leaf

Recommended next cleanup leaf: `cleanup/v22-tests-taxonomy` or `cleanup/v22-contracts-into-specs`, after B review decides whether to absorb this skeleton branch.
