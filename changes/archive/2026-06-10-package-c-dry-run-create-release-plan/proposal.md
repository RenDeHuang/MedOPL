Owner: `MedOPL`
Purpose: `proposal`
State: `archived_change`
Machine boundary: `tests/support/cloud-prework/v22-tencent-create-release-dry-run-plan.js`, `tests/cloud/cloud-test-v22-tencent-resource-lifecycle-dry-run-plan-local-gate.mjs`, `scripts/v22-test-classification.mjs` and `tests/fixtures/v22/agent-verify-manifest.json` define the runnable local gate. `.runtime` reports are local evidence and stay out of git.

# Package C Dry-Run Create Release Plan Proposal

Status: archived
Branch: `feat/v22-package-c-dry-run-create-release-plan`
Base trunk: `origin/recovery/platform-v22-trunk`
Affected plane: Operations

## Why

Package B proved a redacted readonly Tencent inventory path. Package C must now turn the production cloud vision into an auditable create/release plan before any mutation is authorized.

The first Package C step is intentionally dry-run only. It must prove the create/release plan shape, isolation controls and billing freeze semantics without reading mutation secrets, calling Tencent Cloud, writing Portal ledger state, running kubectl, deploying workloads or building/pushing images.

## Goals

- Add a Package C runner that emits a deterministic dry-run create/release plan under `.runtime/v22-cloud-lifecycle`.
- Register a local gate proving the runner rejects live, mutation, deploy, kubectl, build/push and secret-file arguments.
- Bind the gate to the `cloud-future-authorized` lane and durable specs.
- Preserve the current architecture target: shared cluster, layered isolation and premium dedicated pool support.

## Non-Goals

- Do not create, bind, resize or release real Tencent Cloud resources.
- Do not read mutation env files or provider keys.
- Do not write Portal ledger, apply charges or stop billing in production.
- Do not run kubectl, deploy, live-test, build images or push images.
- Do not reopen TC3 as an active provider path.

## Golden Path Impact

- improves: create/release gets a local, auditable dry-run plan before live authorization.
- affected steps: managed environment open, release/stop billing audit and future cloud lifecycle execution.
- required golden path eval: `npm run test:cloud-future-authorized`.

## Authorization Boundary

- Authorized now: local dry-run plan generation with `--dry-run --confirm-no-real-cloud`.
- Authorized now: write redacted local reports under `.runtime/v22-cloud-lifecycle`.
- Authorized now: commit and git push this branch to GitHub.
- Not authorized: reading mutation secrets, real cloud mutation, deploy, kubectl, build/push, live-test or production completion claims.

## Subscribed Truth

- `docs/active/README.md`
- `docs/specs/README.md`
- `docs/evidence/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `specs/operations/spec.md`
- `specs/runtime/spec.md`

## Can Claim

- Package C has a local dry-run create/release plan runner and gate after verification passes.

## Cannot Claim

- Package C live create/release is authorized.
- Production cloud is online.
- Portal ledger mapping or real billing mutation is complete.
- TKE node pools, namespaces, workloads, CBS, COS buckets or PostgreSQL have been provisioned by this package.
