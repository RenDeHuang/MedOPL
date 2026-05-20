# Agent Run: cleanup/v22-monolith-agent-workflow-entrypoint-and-trace-normalization

## meta

- schema_version: 1
- leaf_id: cleanup-v22-monolith-agent-workflow-entrypoint-and-trace-normalization
- run_kind: cleanup
- status: pending_b_review
- model: gpt-5.4
- branch: cleanup/v22-monolith-agent-workflow-entrypoint-and-trace-normalization
- base_trunk_head: d35d65ed94cef7fac0493c21643e36a690f57e4c
- commit_sha: pending_B_review
- absorbed_commit: none
- supersedes: none
- superseded_by: none
- branch_override_id: monolith-agent-workflow-entrypoint-and-trace-normalization

## goal

Normalize the monolith agent workflow entrypoint and trace evidence layer after `d35d65ed94cef7fac0493c21643e36a690f57e4c` was absorbed. This branch keeps the product cursor at `leaf-portal-postgres-redis-local-production-data-closure`, records the previous absorb, clarifies that `v22-verify.mjs` is the default entrypoint, starts a schema for new agent-run records, fixes suite-wrapper metadata, and records that no files are delete-ready yet.

## subagents_and_models

- Bohr: `gpt-5.4`, read-only audit of default entrypoint references.
- Schrodinger: `gpt-5.4`, read-only audit of `docs/recovery/agent-runs/**` and record gate coverage.
- Nash: `gpt-5.4`, read-only audit of smoke/eval classification and suite-wrapper debt.
- Pasteur: `gpt-5.4`, read-only audit of contracts/recovery delete-ready and blocked-retain docs.

## contract_subscription

- `AGENTS.md`
- `README.md`
- `docs/status.md`
- `docs/vibe-coding.md`
- `docs/contracts/README.md`
- `docs/contracts/v22-smoke-eval-boundary.md`
- `docs/recovery/v22-goal-current.json`
- `docs/recovery/v22-agent-verify-manifest.json`
- `docs/recovery/v22-truth-repo-narrative-reference-unification-index.md`
- `docs/recovery/agent-runs/README.md`
- `docs/recovery/agent-runs/schema.md`
- `scripts/v22-verify.mjs`
- `scripts/v22-test-classification.mjs`
- `tests/contract/smoke-test-v22-agent-verify-entrypoint.mjs`
- `tests/health/smoke-test-v22-smoke-classification-gate.mjs`
- `tests/health/smoke-test-v22-smoke-eval-boundary.mjs`
- `tests/contract/smoke-test-v22-agent-run-record-gate.mjs`

## allowed_write_scope

- `README.md`
- `docs/recovery/mvp-contract-acceptance.md`
- `docs/recovery/v22-product-goal.md`
- `docs/recovery/v22-codex-goal-loop.md`
- `docs/recovery/v22-agent-verify-manifest.json`
- `docs/recovery/agent-runs/README.md`
- `docs/recovery/agent-runs/schema.md`
- `docs/recovery/agent-runs/2026-05-20-cleanup-v22-truth-repo-narrative-reference-unification.md`
- `docs/recovery/agent-runs/2026-05-20-cleanup-v22-monolith-agent-workflow-entrypoint-and-trace-normalization.md`
- `docs/recovery/v22-monolith-agent-workflow-entrypoint-and-trace-normalization-index.md`
- `scripts/v22-test-classification.mjs`
- `tests/health/smoke-test-v22-smoke-classification-gate.mjs`
- `tests/health/smoke-test-v22-smoke-eval-boundary.mjs`
- `tests/contract/smoke-test-v22-agent-verify-entrypoint.mjs`
- `tests/contract/smoke-test-v22-agent-run-record-gate.mjs`
- `tests/health/smoke-test-v22-contract-conflict-boundary.mjs`
- `tests/contract/smoke-test-v22-contract-smoke-eval-index-compaction.mjs`
- `tests/regression/portal/smoke-test-v22-observability-billing-narrative-boundary.mjs`
- `tests/contract/smoke-test-v22-truth-repo-narrative-reference-unification.mjs`
- `tests/health/smoke-test-v22-zero-compat-active-surface-gate.mjs`
- `tests/contract/smoke-test-v22-monolith-agent-workflow-entrypoint-and-trace-normalization.mjs`

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
- no physical deletion of still-referenced contracts, recovery docs, eval scripts, or evidence records
- A window does not ff-only absorb and does not git push

## implementation_summary

- Recorded that `d35d65ed94cef7fac0493c21643e36a690f57e4c` was B reviewed, ff-only absorbed, pushed, and post-push verified.
- Added directory-level agent-run README and schema for new records.
- Kept historical records as legacy evidence instead of rewriting all evidence in one large diff.
- Reframed root/recovery local verification text around `scripts/v22-verify.mjs`.
- Marked `tests/regression/portal/smoke-test-v22-portal-runtime-suite.mjs` and `tests/future-authorized/cloud/smoke-test-v22-cloud-resource-contract-suite.mjs` as suite wrappers.
- Added a branch-scoped verification bundle so this cleanup branch does not run the future PostgreSQL/Redis implementation leaf.
- Recorded no delete-ready files in this branch.

## eval_first_changes

- RED: `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json` initially ran the current PostgreSQL/Redis product leaf and failed in `tests/regression/portal/smoke-test-v22-portal-storage-mode-local-closure.mjs`; root cause was missing branch override for this cleanup branch.
- GREEN target: add branch override and a scoped cleanup gate for this branch.
- RED: smoke/eval metadata counted `portal-runtime-suite` and `cloud-resource-contract-suite` as atomic.
- GREEN target: classify both as `suite-wrapper` and update classification gates.
- RED: agent-runs lacked directory-level schema and status rules.
- GREEN target: add README/schema and make this new record schema-compliant.

## blocker_review_and_fix_log

- Entrypoint auditor found no delete-ready old entrypoint file; `mvp-contract-suite` remains referenced and must be retained as a legacy local-regression alias.
- Agent-run auditor found mixed historical structures and recommended README/schema plus a forward-looking schema gate instead of bulk rewriting all history.
- Smoke/eval auditor found two suite-wrapper classification bugs and no delete-ready scripts.
- Contracts/recovery auditor found no delete-ready docs; admin/cloud/program-board documents remain blocked-retain.

## verification_commands

- `node tests/contract/smoke-test-v22-monolith-agent-workflow-entrypoint-and-trace-normalization.mjs`
- `node tests/contract/smoke-test-v22-agent-run-record-gate.mjs`
- `node tests/contract/smoke-test-v22-agent-verify-entrypoint.mjs`
- `node tests/health/smoke-test-v22-smoke-classification-gate.mjs`
- `node tests/health/smoke-test-v22-smoke-eval-boundary.mjs`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- README.md docs/recovery scripts`
- added-lines secret value scan

## b_review_result

pending_B_review

## post_absorb_verification

not_applicable_yet

## runtime_notes

No UI, Portal backend, PostgreSQL, Redis, OPL, real cloud, or deploy runtime was started for this cleanup branch.

## non_goals

- No PostgreSQL/Redis implementation.
- No services implementation.
- No real cloud.
- No secret read.
- No upstream modification.
- No build/deploy/kubectl/live-test.
- No Portal UI change.
- No physical deletion of still-referenced files.

## next_leaf

`leaf-portal-postgres-redis-local-production-data-closure`
