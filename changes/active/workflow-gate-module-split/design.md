# workflow-gate-module-split Design

## Architecture

`scripts/v22-workflow-gate.mjs` remains the public workflow gate CLI and export surface. Implementation logic moves into owner-scoped helper modules under `scripts/workflow-gate/` so the entrypoint stays thin and reviewable.

## Module Boundaries

- `change-package.mjs`: change package lifecycle and changed package detection.
- `command-reference.mjs`: local command reference extraction and validation.
- `git-diff.mjs`: git diff and branch comparison helpers.
- `policy.mjs`: review/checkpoint policy evaluation.
- `report.mjs`: human-readable report rendering.

## Data Flow

1. CLI args enter `scripts/v22-workflow-gate.mjs`.
2. The entrypoint resolves repo context and changed files through `git-diff.mjs`.
3. Policy and change package checks run in the helper owner surface.
4. Reports are rendered by `report.mjs`.
5. Existing package scripts and tests continue to call the same public CLI path.

## Failure Modes

- Unexpected helper directories fail the cleanup lifecycle scripts owner gate.
- Missing workflow gate command references fail the command reference gate.
- Secret-like changed paths fail the diff-scoped sensitive hygiene gate.
- Review/checkpoint policy drift fails the workflow gate health checks.

## Surface Impact

- source: `scripts/v22-workflow-gate.mjs`, `scripts/workflow-gate/*.mjs`
- tests: workflow gate health and contract tests
- specs: `specs/framework/spec.md`
- docs: `docs/source/README.md`
- change package: `changes/active/workflow-gate-module-split`
