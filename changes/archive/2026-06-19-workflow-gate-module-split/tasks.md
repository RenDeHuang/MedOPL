# workflow-gate-module-split Tasks

## Tasks

- [x] Split git diff, policy, change package, command reference and report logic out of `scripts/v22-workflow-gate.mjs`.
- [x] Keep the public CLI path and existing exported API names stable for current callers.
- [x] Update workflow gate health/contract tests for the split layout.
- [x] Keep `scriptsFiles` as a top-level entrypoint budget and add a bounded helper-module budget.
- [x] Update framework/source docs and this change package.
- [x] Run local governance, contract, bloat and whitespace verification.

## Cleanup

- [x] Remove monolithic workflow gate internals from the public entrypoint.
- [x] Avoid adding compatibility aliases, duplicate CLIs or legacy smoke scripts.
- [x] Keep helper modules under one explicit owner directory.
