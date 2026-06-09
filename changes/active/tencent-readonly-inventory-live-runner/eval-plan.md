Owner: `MedOPL`
Purpose: `eval_plan`
State: `active_change`
Machine boundary: Commands below are the verification entrypoints.

# Eval Plan

Target specs:

- `spec:v22-tencent-readonly-inventory-boundary`
- `spec:v22-production-cloud-topology-boundary`

Run:

```bash
node tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-live-runner-local-gate.mjs
npm run test:real-cloud-readiness
npm run gate:review
```

Authorized readonly attempt:

```bash
node scripts/v22-tencent-readonly-inventory-runner.mjs \
  --live-readonly \
  --confirm-current-session-authorization \
  --sdk-mode tencent-official-sdk-readonly \
  --secret-file /home/dev/.secrets/medopl/v22/readonly-inventory.env \
  --report-dir .runtime/v22-tencent-readonly-inventory
```

Expected current result if SDK packages are absent:

- no cloud call.
- no mutation.
- redacted blocker report with `tencentcloud_sdk_missing` and/or `cos_sdk_missing`.
- report remains under `.runtime` and out of git.
