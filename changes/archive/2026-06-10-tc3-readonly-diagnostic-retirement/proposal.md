Owner: `MedOPL`
Purpose: `proposal`
State: `archived_change`
Machine boundary: `docs/specs/README.md` and `tests/future-authorized/cloud/future-authorized-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs` define the executable cleanup contract.

# TC3 Readonly Diagnostic Retirement Proposal

Status: archived
Branch: cleanup/v22-tc3-readonly-diagnostic-retirement
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Operations
Affected plane: Operations

Retire hand-rolled TC3 from the active/default readonly cloud path after Package B accepted the official SDK readonly live evidence.

## Non-Goals

- Do not delete historical/provenance TC3 references.
- Do not authorize Package C mutation.
- Do not authorize deploy, kubectl, build/push or live-test.
- Do not claim production cloud is online.

## Golden Path Impact

- preserves: TC3 cleanup changes only cloud prework governance.
- affected steps: real-cloud readiness and future authorized readonly inventory.
- required golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`.

## Authorization Boundary

- Authorized now: repo-local docs/specs/tests cleanup only.
- Not authorized: secret reads, real cloud calls, mutation, deploy, kubectl, build/push, kubeconfig reads, SDK implementation changes or create/release changes.

## Target Specs

- `operations:tencent-tc3-diagnostic-cleanup-plan`

## Proposed Change

- Mark TC3 production/default path as retired.
- Prove the readonly inventory runner does not expose `tencent-tc3-readonly`, `--enable-real-fetch` or TC3 live bridge flags.
- Keep TC3 only as static diagnostic/provenance contract.
- Keep Tencent official SDK wrapper as the future authorized provider candidate.

## Cannot Claim

- TC3 historical/provenance references are deleted.
- Package C mutation is authorized.
- Deploy, kubectl, build/push or live-test is authorized.
- Production cloud is online.
