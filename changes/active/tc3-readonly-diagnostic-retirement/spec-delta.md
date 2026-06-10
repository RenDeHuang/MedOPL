Owner: `MedOPL`
Purpose: `spec_delta`
State: `active_change`
Machine boundary: Specs and future-authorized tests are the machine-readable boundary.

# Spec Delta

## Target Specs

- `spec:v22-tencent-tc3-diagnostic-cleanup-plan`
- `spec:v22-tencent-readonly-inventory-boundary`
- `specs/operations/spec.md`
- `specs/runtime/spec.md`

Changes:

- TC3 cleanup state moves from planned to executed for production/default readonly path.
- `runnerSupportsTencentTc3Readonly` is fixed to `false`.
- `tc3ProductionPathRetired` is fixed to `true`.
- `tc3SmokePolicy` becomes `static_diagnostic_contract`.
- Tencent official SDK wrapper remains the future authorized provider candidate.

This does not change Package C create/release or Package D deploy.
