Owner: `MedOPL`
Purpose: `spec_delta`
State: `active_change`
Machine boundary: `real-cloud-readiness` manifest membership and runner behavior are machine-readable.

# Spec Delta

## Target Specs

- `spec:v22-tencent-readonly-inventory-boundary`
- `spec:v22-production-cloud-topology-boundary`
- `specs/operations/spec.md`
- `specs/runtime/spec.md`

`spec:v22-tencent-readonly-inventory-boundary` gains a minimal active runner local gate:

- `scripts/v22-tencent-readonly-inventory-runner.mjs`.
- `tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-live-runner-local-gate.mjs`.
- `tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-official-sdk-shape.mjs`.
- `tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-official-sdk-wrapper-local-gate.mjs`.

This does not change Package C or Package D:

- readonly inventory remains separate from create/release.
- mutation secret and deploy secret remain forbidden in the readonly runner.
- kubectl, build/push and deploy remain unauthorized.

Current live readiness state:

- local runner gate is implemented.
- Tencent/COS SDK dependencies are root cloud tooling dependencies; Portal packages do not own them.
- official SDK loader requires `--enable-official-sdk-loader` in addition to live readonly authorization.
- official SDK wrapper can call readonly account, TKE, billing, tag and COS metadata-only methods.
- optional `TENCENT_READONLY_COS_METADATA_PROBES` is allowed in the readonly env and is used only as `headObject` input; report/stdout must not emit bucket names or object keys.
- missing SDK dependencies, permission gaps or missing COS metadata probes produce a redacted blocker report instead of a false success.
- authorized official SDK readonly mode has passed with explicit COS metadata probe evidence, `blockers: []`, `callsMutationApi=false` and `readsCosObjectBody=false`.
- live stdout blocker output is restricted to `code`, `operation` and optional `region`; raw provider messages and raw cloud identifiers must not be emitted.

## CANNOT-CLAIM

- Portal ledger mapping completed.
- complete COS file-space inventory beyond explicit metadata probes.
- TKE node pool / namespace / workload inventory completed unless a future readonly report observes those resources.
- production cloud is online.
- create/release or deploy is authorized.
