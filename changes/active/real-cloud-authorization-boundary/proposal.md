# real-cloud-authorization-boundary Proposal

Status: authoring
Branch: real-cloud-authorization-boundary
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Operations
Affected plane: Operations

## Why

The current cursor is the real-cloud authorization boundary. MedOPL exists to provide platform-provisioned / customer-dedicated OPL runtime, cloud compute, file space, billing, audit and release. It does not own OPL research capability. Any secret access, provider operation, deploy, kubectl, build/push, live-test, production ledger write or true cloud mutation remains outside default authorization.

## Goals

- Keep the real-cloud authorization boundary as a repo-native active change package.
- Keep active cloud tests small: readonly inventory, Package C dry-run plan and TKE bootstrap preflight.
- Keep default verification local/dry-run/read-only and fail closed.
- Retire Package D, production-launch, CLB diagnostics and Package C live canary runners from active truth after caller migration.
- Require explicit authorization packets before any sensitive operation class.

## Non-Goals

- Do not read secrets, provider keys, kubeconfig, tokens or SSH private keys.
- Do not call real cloud, real OPL, provider APIs, COS or production APIs.
- Do not run build/push, kubectl, deploy or live-test.
- Do not restore deleted Package D, production-launch, CLB diagnostics or Package C live canary runners.
- Do not expose Portal through Ingress, LoadBalancer, DNS, TLS or public access in this package.

## Golden Path Impact

- defers: this package does not change the local golden path implementation.
- affected steps: real cloud authorization remains blocked after local golden path health.
- required golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`.

## Authorization Boundary

Every future sensitive operation must have a current-session authorization record with all of these fields before execution:

- `operation class`: readonly inventory, mutation create/release, build/push, deploy/kubectl, live-test/canary, rollback with side effect, or schema/data migration.
- `target environment`: account/project, region, namespace or endpoint scope, plus tenant/workspace/resource binding scope if applicable.
- `secret allowlist`: exact secret refs or local secret paths allowed for this operation.
- `API allowlist`: exact readonly, mutation, registry, deploy, kubectl or smoke operations allowed.
- `budget`: cost, resource, time and retry limits.
- `evidence sink`: `.runtime/<approved-run-id>` or another user-approved non-git sink, with only sanitized summaries allowed in git.
- `rollback owner`: the person or role allowed to decide stop/retry/rollback and required rollback evidence.

The first executable cloud sequence after this boundary remains:

```text
readonly inventory\n-> TKE bootstrap preflight\n-> dry-run plan\n-> explicit authorization packet\n-> authorized tenant runtime provisioning\n-> ledger / billing / audit writeback\n-> canary / QA / status update
```

## Subscribed Truth

- docs/active/README.md
- docs/policies/README.md
- docs/delivery/README.md
- docs/evidence/README.md
- docs/specs/README.md
- specs/operations/spec.md
- changes/README.md
