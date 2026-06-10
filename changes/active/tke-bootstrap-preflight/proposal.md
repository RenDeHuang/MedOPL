Owner: `MedOPL`
Purpose: `proposal`
State: `active_change`
Machine boundary: `scripts/v22-tke-bootstrap-preflight-plan.mjs`, `tests/future-authorized/cloud/future-authorized-test-v22-tke-bootstrap-preflight-local-gate.mjs`, `scripts/v22-test-classification.mjs` and `tests/fixtures/v22/agent-verify-manifest.json` define the runnable local gate. `.runtime` reports are local evidence and stay out of git.

# TKE Bootstrap Preflight Proposal

Status: authoring
Branch: `feat/v22-tke-bootstrap-preflight`
Base trunk: `origin/recovery/platform-v22-trunk`
Affected plane: Operations

## Why

Package C dry-run create/release is landed, but live Package C cannot start because there is no observed TKE cluster or node pool identifier. The repo must not accept fake TKE values or jump directly to live mutation.

This package adds a local-only bootstrap preflight that tells the operator what Tencent Cloud foundation must exist before Package C live mutation can be requested.

## Goals

- Add a deterministic TKE bootstrap preflight runner under `.runtime/v22-cloud-bootstrap`.
- Prove the runner rejects secret-file, live, execute, apply, mutate, deploy, kubectl, build and push arguments.
- Preserve the production target: shared cluster, layered isolation and premium dedicated pool as a later paid isolation phase.
- State exactly which Package C mutation env fields become fillable after readonly inventory observes TKE.
- Keep Redis non-required; the required production data plane remains PostgreSQL, COS and CBS.

## Non-Goals

- Do not create TKE, node pools, NAT gateway, CBS volumes, COS buckets, PostgreSQL instances, namespaces or workloads.
- Do not read mutation env files, provider keys, kubeconfig, tokens or secrets.
- Do not call Tencent Cloud, COS, PostgreSQL, kubectl, deploy, build/push or live-test.
- Do not claim production cloud readiness or Package C live create/release authorization.

## Golden Path Impact

- improves: future Package C live create/release gets a local, auditable foundation checklist before mutation authorization.
- affected steps: real-cloud authorization boundary, Package C dry-run create/release and future readonly inventory.
- required golden path eval: `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk`.

## Authorization Boundary

- Authorized now: local dry-run preflight generation with `--dry-run --confirm-no-real-cloud`.
- Authorized now: write redacted local reports under `.runtime/v22-cloud-bootstrap`.
- Authorized now: commit and git push this branch to GitHub.
- Not authorized: reading secrets, real cloud mutation, deploy, kubectl, build/push, live-test, live inventory or production completion claims.

## Subscribed Truth

- `docs/active/README.md`
- `docs/specs/README.md`
- `docs/delivery/README.md`
- `docs/evidence/README.md`
- `docs/policies/README.md`
- `docs/runtime/README.md`
- `specs/operations/spec.md`
- `specs/runtime/spec.md`

## Can Claim

- The repo has a local TKE bootstrap preflight gate after verification passes.
- Without TKE, the next cloud step is cloud foundation creation and readonly observation, not Package C live mutation.

## Cannot Claim

- TKE, NAT, CBS, COS or PostgreSQL has been created.
- Package C live mutation is authorized.
- Production cloud, production runtime, production billing or deploy is ready.
