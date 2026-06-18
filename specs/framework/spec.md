# Framework Spec

Owner: `MedOPL Platform`
Purpose: `framework_behavior_spec`
State: `active`
Human index: `docs/framework/README.md`, `docs/specs/README.md`

## Scope

Framework specs define owner boundary, surface budget, admission, readiness and four-plane governance.

| Requirement | Owner plane | Source surface | Required evals | Evidence level | Cannot claim |
| --- | --- | --- | --- | --- | --- |
| `framework:rules-before-status` | Framework | `docs/framework/README.md`, `docs/policies/README.md` | `node tests/contract/contract-test-v22-framework-truth-layering.mjs` | local contract proof | Current status can rewrite durable rules. |
| `framework:change-package-required` | Framework | `changes/README.md` | `node tests/contract/contract-test-v22-change-package-lifecycle.mjs` | local contract proof | Chat prompt alone is durable change context. |
| `framework:golden-path-impact-required` | Framework | `changes/README.md`, `docs/framework/README.md` | `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`; `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs` | local contract proof | Governance gate success can replace golden path health. |
| `framework:repo-native-change-lifecycle` | Framework | `changes/README.md`, `specs/README.md`, `scripts/v22-workflow-gate.mjs` | `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`; `node tests/contract/contract-test-v22-spec-eval-traceability.mjs`; `node tests/health/health-check-v22-workflow-gate.mjs` | local contract proof | OpenSpec CLI is installed or production operations are authorized. |
| `framework:opl-style-development-discipline-convergence` | Framework | `AGENTS.md`, `TASTE.md`, `changes/README.md`, `scripts/v22-workflow-gate.mjs` | `node tests/health/health-check-v22-zero-compat-active-surface-gate.mjs`; `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` | local governance proof | Agent discipline text alone proves cleanup, runtime behavior, production readiness or landing completion. |
| `framework:structured-closeout-audit` | Framework | `changes/README.md`, `scripts/v22-landing-closeout.mjs`, `scripts/v22-workflow-gate.mjs` | `node tests/contract/contract-test-v22-landing-closeout-automation.mjs`; `node tests/health/health-check-v22-workflow-gate.mjs` | local contract proof | Existing historical closeouts all satisfy the new structured shape. |
| `framework:machine-cursor-compaction` | Framework | `tests/fixtures/v22/goal-current.json`, `tests/fixtures/v22/agent-verify-manifest.json`, `tests/contract/contract-test-v22-current-state-index-loop.mjs` | `node tests/contract/contract-test-v22-current-state-index-loop.mjs`; `node tests/contract/contract-test-v22-test-lane-registry.mjs`; `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --dry-run --json` | local fixture contract proof | Current machine cursor compaction proves all machine truth, docs history, manifest duplication or long-file debt has been eliminated. |
| `framework:current-truth-localhost-claim-hygiene` | Framework | `docs/active/README.md`, `docs/delivery/README.md`, `changes/active/**/*.md`, `scripts/v22-repo-hygiene.mjs` | `node scripts/v22-repo-hygiene.mjs`; `node tests/health/health-check-v22-repo-hygiene-gate.mjs` | local hygiene proof | A fixed localhost port or stale local process is current trunk Portal evidence. |
| `framework:productization-roadmap-required` | Framework | `docs/delivery/README.md`, `changes/archive/2026-05-23-golden-path-productization-roadmap` | `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`; `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` | local contract proof | Chat memory can define the current productization order. |
| `framework:repo-health-contraction` | Framework | `scripts/v22-repo-bloat-audit.mjs`, `scripts/v22-line-budget.mjs`, `tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs`, `.sentrux/rules.toml` | `npm run repo:bloat`; `npm run line:budget`; `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs`; `sentrux check .` | local structural gate proof | Repo-health contraction proves production readiness, real cloud readiness, deploy authorization, kubectl authorization, build/push authorization or live-test authorization. |
