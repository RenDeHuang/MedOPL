Owner: `MedOPL`
Purpose: `proposal`
State: `active_change`
Machine boundary: `docs/specs/README.md` and `tests/future-authorized/cloud/future-authorized-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs` define the executable cleanup contract.

# TC3 Readonly Diagnostic Retirement Proposal

Retire hand-rolled TC3 from the active/default readonly cloud path after Package B accepted the official SDK readonly live evidence.

## Authorization Boundary

- Authorized now: repo-local docs/specs/tests cleanup only.
- Not authorized: secret reads, real cloud calls, mutation, deploy, kubectl, build/push, kubeconfig reads, SDK implementation changes or create/release changes.

## Target Specs

- `spec:v22-tencent-tc3-diagnostic-cleanup-plan`
- `spec:v22-tencent-readonly-inventory-boundary`

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
