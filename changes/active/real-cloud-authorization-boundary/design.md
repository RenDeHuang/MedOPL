# real-cloud-authorization-boundary Design

## Architecture

The package is a control-plane artifact for the Operations plane. It does not add runtime code. It connects the active cursor to `specs/operations/spec.md`, `docs/policies/README.md`, `docs/evidence/README.md` and local deterministic evals.

## Data Flow

1. `docs/active/README.md` points to this open change package.
2. `spec-delta.md` names the durable operations requirement and any future spec delta.
3. `eval-plan.md` defines local-only verification and the future-authorized dry-run entry.
4. Authorized live evidence, if later approved, must go to an approved evidence sink and only leave a sanitized summary in git.

## Failure Modes

- Missing explicit authorization fails closed.
- Secret-like content in the package fails closed.
- A live or production claim without matching evidence fails closed.
- Real-cloud commands remain out of scope for default verification.

## Surface Impact

- source: none
- docs: `docs/active/README.md`
- specs: `specs/operations/spec.md`
- tests: existing change lifecycle, workflow and future-authorized gates only
