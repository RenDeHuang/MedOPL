# v22 Status

本文件是 v22 当前唯一人读状态入口。机器 current truth 写在 `docs/recovery/v22-goal-current.json`，验证入口写在 `docs/recovery/v22-agent-verify-manifest.json` 并由 `scripts/v22-verify.mjs` 执行。长期纪律写在 `AGENTS.md` 和 `docs/invariants.md`，合同边界写在 `docs/specs/README.md` 和具体 contracts。

active program: v22-contract-cleanup-and-drift-control

current phase: 先清合同-smoke-实现漂移，不接云

next phase: B 审核后再决定是否进入 future-authorized cloud lane

所有真实云动作均需 future-authorized 显式授权

## Current Program

- active program: v22-contract-cleanup-and-drift-control
- current phase: 先清合同-smoke-实现漂移，不接云
- next phase: B 审核后再决定是否进入 future-authorized cloud lane
- user authorization gate: 未进入 future-authorized 边界前，禁止任何 real cloud call
- canonical current truth: `docs/recovery/v22-goal-current.json`
- verify manifest: `docs/recovery/v22-agent-verify-manifest.json`
- gap/index matrix: `docs/recovery/v22-current-vs-ideal-gap-matrix.md`
- goal summary: `docs/recovery/v22-goal-state.md`
- eval entrypoint: `scripts/v22-verify.mjs`
- workflow contract: `docs/specs/README.md`（当前只作为 future-authorized lane 规则，不是本阶段执行入口）
- contract index: `docs/specs/README.md`
- local-contract suite: `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk`
- local workflow gate: `scripts/v22-workflow-gate.mjs`（B review/checkpoint guard，不是 current truth）
- retained future-authorized references: `docs/recovery/v22-program-board.md`, `docs/recovery/v22-program-status-table.md`, `docs/recovery/cloud-onboarding-execution-board.md`, `docs/recovery/cloud-onboarding-status-table.md`, `docs/recovery/cloud-onboarding-verification-matrix.md`, `scripts/v22-agent-workflow.mjs`

## Current Truth

- AGENTS governs collaboration discipline, allowed surfaces, and authorization red lines.
- contracts govern product and interface boundaries.
- `docs/recovery/v22-goal-current.json` governs current cursor, next leaf, current blockers, and last absorbed commit.
- `docs/recovery/v22-agent-verify-manifest.json` governs allowed files, forbidden surfaces, branch overrides, and verification commands.
- `scripts/v22-verify.mjs` is the default agent-facing eval entrypoint.
- cloud onboarding boards, program boards, and `scripts/v22-agent-workflow.mjs` are retained future-authorized / blocked-retain references until their live references are migrated; they are not the current active status source.

当前阶段是合同清退与本地 smoke 对齐阶段。真实云 live/create/release/deploy 都必须用户显式授权；在授权前只能进行 docs/specs/recovery/status 与本地 smoke/门禁收敛。

## Current Non-Goals

- No secret read.
- No real cloud call.
- No create/release mutation.
- No deploy, build, push, kubectl, or live-test.
- No upstream, deploy, `.sentrux`, `adapters`, build/push/kubectl/live-test, secret read, or real cloud operation in this cleanup branch.
- Active code physical retirement is limited to `services/portal`, `services/opl-web-gateway`, and `services/opl-runtime-bridge`, and only for contract-smoke-implementation drift cleanup.
