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
node tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-official-sdk-wrapper-local-gate.mjs
npm run test:real-cloud-readiness
npm run gate:review
git diff --check -- scripts tests package.json package-lock.json docs changes
```

Authorized readonly attempt:

```bash
node scripts/v22-tencent-readonly-inventory-runner.mjs \
  --live-readonly \
  --confirm-current-session-authorization \
  --enable-official-sdk-loader \
  --sdk-mode tencent-official-sdk-readonly \
  --secret-file /home/dev/.secrets/medopl/v22/readonly-inventory.env \
  --report-dir .runtime/v22-tencent-readonly-inventory
```

Expected current result:

- official SDK packages load only after `--enable-official-sdk-loader`.
- readonly SDK calls may run only for Describe/List/Get/Head style APIs after allowlist validation.
- no mutation.
- redacted blocker report if SDK packages, readonly API permission, TKE/COS/billing/tag access or COS metadata probe evidence is incomplete.
- with an explicit COS metadata probe, the authorized run may complete with `ok: true`, `blockers: []` and sanitized resource type summaries only.
- stdout blocker summaries must expose only `code`, `operation` and optional `region`; raw provider error messages, COS bucket names and object keys stay out of stdout.
- report remains under `.runtime` and out of git.
