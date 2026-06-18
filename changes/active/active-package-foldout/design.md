# active-package-foldout Design

## Architecture

`changes/active` remains the authoring baton surface. Completed packages move to `changes/archive/YYYY-MM-DD-<id>` and keep their seven lifecycle files as provenance.

## Data Flow

1. `git mv` moves completed packages into `changes/archive`.
2. Archived closeouts use `Status: archived` and an archive target pointing at their own path.
3. `contract-test-v22-change-package-lifecycle.mjs` validates archived package shape and durable spec sync.
4. `v22-workflow-gate` validates archive packages without re-validating deleted active paths.

## Failure Modes

- Missing durable spec requirement blocks archive lifecycle.
- Deleted active paths without archive targets still fail review.
- Current machine-consumed active packages stay active until their owners close them.

## Surface Impact

- source: `scripts/workflow-gate/git-diff.mjs`
- tests: review secret hygiene and change lifecycle gates
- specs: `specs/framework/spec.md`
- changes: completed packages move from active to archive
