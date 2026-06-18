# opl-style-development-discipline-convergence Design

## Architecture

The governance contract has two layers. `AGENTS.md` defines human and agent operating discipline, while `scripts/v22-landing-closeout.mjs` and `scripts/v22-workflow-gate.mjs` enforce structured closeout behavior that tests can execute.

The implementation avoids making narrative Markdown prose a stable machine API. Tests exercise runner output, generated closeout fields, and review gate findings.

## Data Flow

1. Agent reads `AGENTS.md`, `TASTE.md`, and lifecycle docs before formal changes.
2. `v22-landing-closeout generate` accepts completion audit and cleanup result inputs.
3. Generated `closeout.md` records machine-readable structured fields.
4. `v22-workflow-gate review` inspects changed files and blocks formal changes without a bound change package or modified closeouts without the structured audit sections.

## Failure Modes

- Missing change package fails review with `formal_change_without_active_change_package`.
- Modified closeout without structured audit fails review with `formal_change_package_missing_completion_audit`.
- Modified closeout without cleanup result fails review with `formal_change_package_missing_cleanup_result`.
- Existing historical closeouts are not mass-invalidated unless they are modified in a new diff.

## Surface Impact

- source: `scripts/v22-landing-closeout.mjs`, `scripts/v22-workflow-gate.mjs`
- docs: `AGENTS.md`, `changes/README.md`, this change package
- specs: `specs/framework/spec.md`
- tests: `tests/health/health-check-v22-workflow-gate.mjs`, `tests/health/health-check-v22-zero-compat-active-surface-gate.mjs`, `tests/contract/contract-test-v22-landing-closeout-automation.mjs`
