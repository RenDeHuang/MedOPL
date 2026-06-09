Owner: `MedOPL`
Purpose: `closeout`
State: `active_change`
Machine boundary: This is not post-merge closeout until branch lands.

# Closeout

## Target Specs

- `spec:v22-tencent-readonly-inventory-boundary`
- `spec:v22-production-cloud-topology-boundary`

Implemented:

- readonly inventory runner local gate.
- fail-closed runner with current-session authorization flags.
- readonly env allowlist and mutation/deploy key rejection.
- redacted `.runtime` report generation.
- root cloud tooling dependencies for `tencentcloud-sdk-nodejs` and `cos-nodejs-sdk-v5`; Portal packages do not own SDK dependencies.
- official SDK loader gate via `--enable-official-sdk-loader`.
- dependency-injected official SDK readonly wrapper for account, TKE, billing, tag and COS metadata-only inventory.
- `real-cloud-readiness` suite registration.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-live-runner-local-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-official-sdk-wrapper-local-gate.mjs`: pass.
- `npm run test:real-cloud-readiness`: pass.
- `npm run gate:review`: pass.
- authorized official SDK mode with `/home/dev/.secrets/medopl/v22/readonly-inventory.env`: loaded root SDK dependencies, called readonly account/TKE/billing/tag/COS bucket APIs, wrote redacted `.runtime` report, and left `cos_metadata_probe_not_configured` as the only blocker.
- authorized fake readonly mode with `/home/dev/.secrets/medopl/v22/readonly-inventory.env`: pass, wrote redacted `.runtime` report and proved no mutation, COS object body read, kubectl, build or push.

## Cannot Claim

- Portal ledger mapping completed.
- COS metadata inventory completed without explicit metadata probes.
- create/release authorized.
- deploy/kubectl/build/push authorized.
- production cloud is online.
