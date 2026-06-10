Owner: `MedOPL`
Purpose: `design`
State: `archived_change`
Machine boundary: Runnable behavior lives in the runner, local gate, test classification registry and verify manifest.

# Package C Dry-Run Create Release Plan Design

## Architecture

The package adds a thin Operations-plane runner:

- input: explicit local dry-run CLI arguments.
- output: a redacted JSON plan under `.runtime/v22-cloud-lifecycle`.
- enforcement: fail closed on missing dry-run confirmation or any live/mutation/deploy/kubectl/build/push/secret-file argument.
- registry: `cloud-future-authorized` lane owns the local gate.

The runner is not a provider adapter and not a Portal API. It is a deterministic plan artifact that future authorized Package C execution can compare against.

## Data Flow

```text
CLI dry-run args
-> validate dry-run and no-real-cloud confirmation
-> reject forbidden live/mutation/deploy/kubectl/build/push/secret-file args
-> build workspace storage, compute, isolation and billing freeze plan
-> write .runtime/v22-cloud-lifecycle/<operation-id>-dry-run.json
-> print sanitized summary
```

## Failure Modes

- Missing `--dry-run` or `--confirm-no-real-cloud`: fail closed.
- Any forbidden live/mutation/deploy/kubectl/build/push/secret-file argument: fail closed.
- Missing required business IDs or region: fail closed.
- Sensitive output markers in stdout/stderr/report: local gate fails.

## Surface Impact

- source: `scripts/v22-tencent-create-release-dry-run-plan.mjs`.
- docs: `docs/specs/README.md` and this change package.
- specs: `specs/operations/spec.md`, `specs/runtime/spec.md`.
- tests: `tests/future-authorized/cloud/future-authorized-test-v22-tencent-resource-lifecycle-dry-run-plan-local-gate.mjs`.
- registry: `scripts/v22-test-classification.mjs`, `tests/fixtures/v22/agent-verify-manifest.json`.

## Boundaries

- The runner does not import Tencent SDKs.
- The runner does not read env files.
- Portal packages do not own Tencent or COS SDK dependencies.
- `.runtime` evidence is excluded from git.
