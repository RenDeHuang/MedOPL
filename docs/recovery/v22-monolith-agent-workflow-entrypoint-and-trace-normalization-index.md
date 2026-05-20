# v22 Monolith Agent Workflow Entrypoint and Trace Normalization Index

This index records the A-window cleanup branch `cleanup/v22-monolith-agent-workflow-entrypoint-and-trace-normalization`.

It does not implement PostgreSQL/Redis, services code, cloud, deploy, upstream, or UI changes. It does not advance the product cursor. It normalizes agent workflow evidence and verification entrypoint language so future monolith cleanup can be reviewed without guessing which document or script is authoritative.

## Baseline

- base trunk: `d35d65ed94cef7fac0493c21643e36a690f57e4c`
- branch: `cleanup/v22-monolith-agent-workflow-entrypoint-and-trace-normalization`
- current cursor: `leaf-portal-postgres-redis-local-production-data-closure`
- risk class: `local_doc_eval`
- total subagents: `4`
- subagent model: `gpt-5.4`
- delete-ready files: `0`

## Contract Subscription

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

## Subagent Audit Summary

| Auditor | Model | Scope | Result |
| --- | --- | --- | --- |
| Entrypoint references | `gpt-5.4` | `README.md`, `AGENTS.md`, `docs/**`, `scripts/**` | `mvp-contract-suite` still appeared as default validation in root/recovery docs; `v22-agent-workflow.mjs` remained blocked-retain, not delete-ready. |
| Agent-run records | `gpt-5.4` | `docs/recovery/agent-runs/**`, agent-run gate | Directory lacked README/schema; records have mixed headings, pending/absorbed ambiguity, and only partial gate coverage. |
| Smoke/eval scripts | `gpt-5.4` | `tests/**/*.mjs`, classification, smoke/eval contract | `portal-runtime-suite` and `cloud-resource-contract-suite` are suite wrappers but were counted as atomic. |
| Contracts/recovery docs | `gpt-5.4` | `docs/contracts/**`, `docs/recovery/**` | No delete-ready docs; blocked-retain docs still have live references or authorization-boundary semantics. |

## Entrypoint Truth

- Default agent verification entrypoint: `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk`.
- Small smoke entrypoint: `node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk`.
- Local deterministic eval entrypoint: `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk`.
- Wider local regression entrypoint: `node scripts/v22-verify.mjs suite local-regression --base origin/recovery/platform-v22-trunk`.
- `tests/contract/smoke-test-v22-mvp-contract-suite.mjs` remains a legacy local-regression alias and is not the default smoke or default agent entrypoint.
- `scripts/v22-agent-workflow.mjs` remains blocked-retain / retire-candidate and is not current truth, not default verify, and not auto-merge/push automation.

## Smoke / Eval Truth

- `health-check`: small control-plane health.
- `smoke-golden`: small product golden path.
- `contract-local`: deterministic contract/control-plane eval.
- `local-regression`: wider local feature regression.
- `future-authorized`: classification-only visibility for future cloud/live/deploy/canary gates.
- `suite-wrapper`: aggregation script; it must not be counted as atomic business eval.

This branch records `tests/regression/portal/smoke-test-v22-portal-runtime-suite.mjs` and `tests/future-authorized/cloud/smoke-test-v22-cloud-resource-contract-suite.mjs` as suite wrappers. They are blocked-retain, not delete-ready.

## Agent-Run Truth

- Agent-run records are evidence, not product truth.
- New records must use `docs/recovery/agent-runs/schema.md`.
- Historical records remain legacy evidence until a dedicated schema migration leaf updates them.
- `d35d65ed94cef7fac0493c21643e36a690f57e4c` is recorded as absorbed in `docs/recovery/agent-runs/2026-05-20-cleanup-v22-truth-repo-narrative-reference-unification.md`.

## Delete-Ready

None.

Current blocked-retain candidates include:

- `tests/contract/smoke-test-v22-mvp-contract-suite.mjs`
- `scripts/v22-agent-workflow.mjs`
- `tests/regression/portal/smoke-test-v22-portal-runtime-suite.mjs`
- `tests/future-authorized/cloud/smoke-test-v22-cloud-resource-contract-suite.mjs`
- `docs/recovery/v22-program-board.md`
- `docs/recovery/v22-program-status-table.md`
- `docs/recovery/cloud-onboarding-execution-board.md`
- `docs/recovery/cloud-onboarding-status-table.md`
- `docs/recovery/cloud-onboarding-verification-matrix.md`
- `docs/contracts/v22-admin-ops-console-boundary.md`
- `docs/contracts/v22-tencent-tc3-diagnostic-cleanup-plan.md`

## Physical Retirement Rule

A future branch may physically delete a blocked-retain file only after all conditions are true:

1. Replacement authority exists in contracts, truth, index, eval, or agent-runs.
2. `README.md`, `AGENTS.md`, `docs/**`, `scripts/**`, and `docs/recovery/v22-agent-verify-manifest.json` no longer reference the file except in explicit retirement history.
3. A gate proves the file cannot be restored as current truth, default verify, or compatibility alias.
4. The deletion does not touch product boundary contracts, future-authorized cloud boundary, current truth, or B review evidence without explicit user confirmation.

## Non-Goals

- No PostgreSQL/Redis implementation.
- No services implementation.
- No secret read.
- No real cloud call.
- No upstream modification.
- No build/deploy/kubectl/live-test.
- No Portal UI visual/layout/information-architecture change.
- No physical deletion of still-referenced files.
