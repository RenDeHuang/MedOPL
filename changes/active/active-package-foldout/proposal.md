# active-package-foldout Proposal

Status: authoring
Branch: cleanup/v22-opl-style-third-cleanout-integration
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Framework
Affected plane: Framework

## Why

`changes/active` still contained completed cleanup packages after the second cleanout. That contradicts the OPL-style lifecycle where active baton is short-lived and completed work moves to archive/provenance.

## Goals

- Move completed cleanup packages from `changes/active` to dated `changes/archive` packages.
- Keep only packages with current machine consumers or unresolved authoring state in `changes/active`.
- Fix workflow gate archive-move status handling so archived packages are validated at their archive owner path.

## Non-Goals

- Do not change runtime, billing, deploy, cloud or user-facing behavior.
- Do not execute build/push, kubectl, deploy, live-test or real cloud calls.
- Do not read secrets, kubeconfig, token, provider key or SSH private key.

## Golden Path Impact

- no-impact: this is lifecycle cleanup only.
- affected steps: change package governance, review gate.
- required golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`.

## Authorization Boundary

- No secret read.
- No real cloud, deploy, kubectl, build/push or live-test.
- Archive moves are limited to completed change packages and workflow gate status semantics.

## Subscribed Truth

- `AGENTS.md`
- `TASTE.md`
- `changes/README.md`
- `specs/framework/spec.md`
- `scripts/v22-workflow-gate.mjs`
- `scripts/workflow-gate/git-diff.mjs`
- `tests/contract/contract-test-v22-change-package-lifecycle.mjs`
