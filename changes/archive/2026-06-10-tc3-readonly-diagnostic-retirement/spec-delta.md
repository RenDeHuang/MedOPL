Owner: `MedOPL`
Purpose: `spec_delta`
State: `archived_change`
Machine boundary: `specs/operations/spec.md` and future-authorized tests are the machine-readable boundary.

# Spec Delta

Target specs:

- `specs/operations/spec.md`

## ADDED

- `operations:tencent-tc3-diagnostic-cleanup-plan`: TC3 is retired from the production/default readonly path and remains only static diagnostic/provenance context.

## MODIFIED

- TC3 cleanup state moves from planned to executed for production/default readonly path.
- `runnerSupportsTencentTc3Readonly` is fixed to `false`.
- `tc3ProductionPathRetired` is fixed to `true`.
- `tc3SmokePolicy` becomes `static_diagnostic_contract`.
- Tencent official SDK wrapper remains the future authorized provider candidate.

## REMOVED

- TC3 live bridge support is removed from the default/future-authorized readonly provider path.

## CANNOT-CLAIM

This does not change Package C create/release or Package D deploy.

## EVALS

- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs`
- `node tests/cloud/cloud-test-v22-tencent-official-sdk-provider-strategy-contract.mjs`
- `npm run test:real-cloud-readiness`
