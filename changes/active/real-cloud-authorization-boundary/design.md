# real-cloud-authorization-boundary Design

## Architecture

The package is a control-plane artifact for the Operations plane. It does not add runtime code. It connects the active cursor to `specs/operations/spec.md`, `docs/policies/README.md`, `docs/evidence/README.md`, root `contracts/**` and registered local evals.

## Data Flow

1. `docs/active/README.md` points to this open change package.
2. `spec-delta.md` names durable operations requirements and removed active surfaces.
3. `eval-plan.md` defines local-only verification and the future-authorized dry-run entry.
4. Authorized live evidence, if later approved, must go to an approved non-git evidence sink and only leave a sanitized summary in git.

## Cloud Gate Sequence

The package does not execute cloud work. It locks the order that must happen after separate authorization:

```text
readonly inventory\n-> TKE bootstrap preflight\n-> dry-run plan\n-> explicit authorization packet\n-> authorized tenant runtime provisioning\n-> ledger / billing / audit writeback\n-> canary / QA / status update
```

Readonly inventory, dry-run plan, mutation, deploy/kubectl and canary/live-test each require their own operation class, target environment, secret allowlist, API allowlist, budget, evidence sink and rollback owner. Passing one class never authorizes the next class.

## Failure Modes

- Missing explicit authorization fails closed.
- Secret-like content in the package fails closed.
- A live or production claim without matching evidence fails closed.
- Real-cloud commands remain out of scope for default verification.
- Deleted runner/test paths cannot be restored as compatibility aliases.

## Surface Impact

- source: no runtime source change required for this package.
- docs: `docs/active/README.md`, `docs/delivery/README.md`, `docs/source/README.md`.
- specs: `specs/operations/spec.md`, `specs/framework/spec.md`, `specs/runtime/spec.md`, `specs/product/spec.md`.
- tests: registered contracts/governance/cloud tests only; no deleted future-authorized directory.
