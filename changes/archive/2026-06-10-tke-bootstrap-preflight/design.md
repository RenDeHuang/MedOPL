Owner: `MedOPL`
Purpose: `design`
State: `archived_change`
Machine boundary: Runnable behavior lives in the runner, local gate, test classification registry and verify manifest.

# TKE Bootstrap Preflight Design

## Architecture

The package adds a thin Operations-plane preflight runner:

- input: explicit local dry-run CLI arguments.
- output: a redacted JSON preflight report under `.runtime/v22-cloud-bootstrap`.
- enforcement: fail closed on missing dry-run confirmation or any live/mutation/deploy/kubectl/build/push/secret-file argument.
- registry: `cloud-future-authorized` lane owns the local gate.

The runner is not a Tencent provider adapter and not a Portal API. It produces an operator checklist for cloud foundation setup before future Package C live mutation.

## Data Flow

```text
CLI dry-run args
-> validate dry-run and no-real-cloud confirmation
-> reject forbidden live/mutation/deploy/kubectl/build/push/secret-file args
-> build TKE cluster, node-pool, Kubernetes controls and data-plane checklist
-> write .runtime/v22-cloud-bootstrap/<operation-id>-preflight.json
-> print sanitized summary
```

## Failure Modes

- Missing `--dry-run` or `--confirm-no-real-cloud`: fail closed.
- Any forbidden live/mutation/deploy/kubectl/build/push/secret-file argument: fail closed.
- Missing operation, region, VPC or node-pool naming inputs: fail closed.
- Sensitive output markers in stdout/stderr/report: local gate fails.

## Surface Impact

- source: `tests/support/cloud-prework/v22-tke-bootstrap-preflight-plan.js`.
- docs: `docs/specs/README.md`, `docs/active/README.md`, `docs/delivery/README.md` and this change package.
- specs: `specs/operations/spec.md`, `specs/runtime/spec.md`.
- tests: `tests/cloud/cloud-test-v22-tke-bootstrap-preflight-local-gate.mjs`.
- registry: `scripts/v22-test-classification.mjs`, `tests/fixtures/v22/agent-verify-manifest.json`.

## Boundaries

- The runner does not import Tencent SDKs.
- The runner does not read env files.
- The runner does not read kubeconfig or secrets.
- `.runtime` evidence is excluded from git.
