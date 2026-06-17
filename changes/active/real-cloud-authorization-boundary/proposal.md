# real-cloud-authorization-boundary Proposal

Status: authoring
Branch: real-cloud-authorization-boundary
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Operations
Affected plane: Operations

## Why

The current cursor is the real-cloud authorization boundary. Pre-cloud local proof is closed, but any secret access, provider operation, deploy, kubectl, build/push, live-test or true cloud mutation remains outside default authorization. This boundary is not real-cloud readiness; it keeps the authorization contract repo-native so future agents do not rely on chat memory.

## Goals

- Record the future real-cloud authorization boundary as a repo-native change package.
- Define the subscribed truth, spec delta target and eval plan before any real-cloud work.
- Keep active truth limited to the current phase, cursor, blockers, next owner, cannot-claim and verification entry.
- Fail closed until explicit user authorization is provided for each sensitive operation class.
- Add the Production Launch Gap 01 local bootstrap contract for first admin identity shape, tenant bootstrap shape, workspace seed shape and providerKeyRef-only boundary without executing live bootstrap.
- Add the Production Launch Gap 02 local operation contract for Portal -> Go backend -> Package C operation shape, ResourceBinding requested/creating/ready state shape, providerKeyRef-only boundary and idempotency without executing Package C live.

## Non-Goals

- Do not read secrets, provider keys, kubeconfig, tokens or SSH private keys.
- Do not call real cloud, real OPL, provider APIs, Langfuse, COS or production APIs.
- Do not run build/push, kubectl, deploy or live-test.
- Do not change Portal, Gateway, Runtime Bridge or cloud runtime behavior.
- Do not expose Portal through Ingress, LoadBalancer, DNS, TLS or public access before the multi-tenant minimum launch closure.

## Golden Path Impact

- defers: this package does not change the local golden path implementation.
- affected steps: real cloud authorization remains the blocker after local golden path health.
- required golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`.

## Authorization Boundary

- No secret read unless explicitly authorized.
- No real cloud, deploy, kubectl, build/push or live-test unless explicitly authorized.
- Future authorization must name the operation class, target environment, evidence sink and rollback owner.
- Local dry-run or future-authorized eval evidence cannot be upgraded into live or production evidence.

Every future sensitive operation must have a current-session authorization record with all of these fields before execution:

- `operation class`: one of readonly quote/inventory, mutation create/release, build/push, deploy/kubectl, live-test/canary, rollback with side effect, or schema/data migration.
- `target environment`: account/project, region, namespace or endpoint scope, plus the exact tenant/workspace/resource binding scope if applicable.
- `secret allowlist`: the exact secret refs or local secret paths allowed for this operation; no source-env or read-all secret behavior.
- `API allowlist`: the exact readonly, mutation, registry, deploy, kubectl or smoke operations allowed.
- `budget`: cost, resource, time and retry limits; missing budget keeps the operation blocked.
- `evidence sink`: `.runtime/<approved-run-id>` or another user-approved non-git sink for raw evidence, with only sanitized summaries allowed in git.
- `rollback owner`: the person or role allowed to decide stop/retry/rollback, plus the rollback evidence required before expansion.

The first executable cloud sequence after this boundary remains:

```text
mock/snapshot provider
-> readonly quote
-> dry-run plan
-> readonly inventory
-> authorized create/release
-> Package D deploy readiness planning for platform pool and VPC PostgreSQL
-> authorized deploy
-> canary / QA / status update
```

Production Launch Gap 01 is limited to a local contract gate. It proves the bootstrap payload shape and redaction boundary, but it does not create the first admin, tenant, workspace or provider binding in a live system.

Production Launch Gap 02 is limited to a local contract gate. It proves the Portal -> Go backend -> Package C operation payload shape, runner boundary, state contract and redaction boundary, but it does not execute Package C live or write the production PostgreSQL ledger.

## Subscribed Truth

- docs/active/README.md
- docs/policies/README.md
- docs/delivery/README.md
- docs/evidence/README.md
- docs/specs/README.md
- specs/operations/spec.md
- changes/README.md
