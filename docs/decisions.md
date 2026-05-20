# v22 Decisions

This file records currently effective v22 decisions. AGENTS governs discipline, contracts govern boundaries, `docs/recovery/v22-goal-current.json` governs current cursor truth, `docs/recovery/v22-agent-verify-manifest.json` governs verification bundles, and `scripts/v22-verify.mjs` runs local evals.

References:

- `AGENTS.md`
- `docs/specs/README.md`
- `docs/recovery/v22-goal-current.json`
- `docs/recovery/v22-agent-verify-manifest.json`
- `docs/recovery/v22-current-vs-ideal-gap-matrix.md`
- `scripts/v22-verify.mjs`
- `scripts/v22-workflow-gate.mjs`

## Current Effective Decisions

- production default provider 使用 Tencent official SDK wrapper.
- TC3 保留为 diagnostic/reference.
- official SDK live report 通过后再 cleanup.
- cloud onboarding 保留为 future-authorized lane；`docs/specs/README.md`、cloud/program boards 和 `scripts/v22-agent-workflow.mjs` 只作为 blocked-retain 参考，不是当前 active program 或默认执行入口.
- 真实外部副作用串行.
- create/release 与 readonly 分离.
- create/release 另有独立合同和 RUN gate.

## Decision Notes

- The active status source is `docs/status.md` for humans and `docs/recovery/v22-goal-current.json` for machines.
- The current cursor is `leaf-portal-postgres-redis-local-production-data-closure`; cleanup branches may temporarily override verification through `docs/recovery/v22-agent-verify-manifest.json` without changing the product cursor.
- Cloud onboarding boards and `scripts/v22-agent-workflow.mjs` remain retained future-authorized references until their references migrate to `v22-verify + manifest + v22-cloud-harness-manifest`; they must not auto-run live operations, auto-merge, auto-push, read secrets, or call real cloud.
- Production deploy execution requires concrete deploy plan contracts and explicit user authorization before build, push, kubectl, registry access, or rollback.
