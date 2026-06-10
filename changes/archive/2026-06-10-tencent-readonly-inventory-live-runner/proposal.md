Owner: `MedOPL`
Purpose: `proposal`
State: `archived_change`
Machine boundary: `tests/support/cloud-prework/tencent-readonly-inventory-support.js` and `tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-live-runner-local-gate.mjs` define the runnable local gate. Real cloud evidence remains outside git under `.runtime`.

# Tencent Readonly Inventory Live Runner Proposal

Status: archived
Branch: feat/v22-readonly-inventory-live-runner
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Operations
Affected plane: Operations

Add a minimal authorized readonly inventory runner for the current `real-cloud-readiness` lane.

## Non-Goals

- Do not authorize create/release.
- Do not authorize deploy, kubectl, build/push or live-test.
- Do not read COS object bodies.
- Do not output raw provider responses.
- Do not claim production cloud is online.

## Golden Path Impact

- preserves: readonly inventory affects cloud prework only.
- affected steps: real-cloud readiness and future authorized inventory evidence.
- required golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`.

## Authorization Boundary

- Authorized now: read `/home/dev/.secrets/medopl/v22/readonly-inventory.env` allowlist keys for readonly inventory only.
- Authorized now: attempt `tencent-official-sdk-readonly` mode and write a redacted `.runtime` report.
- Not authorized: mutation, deploy, kubectl, build/push, kubeconfig reads, COS object body reads or raw provider response output.

## Target Specs

- `operations:tencent-readonly-inventory-boundary`

The runner must:

- fail closed unless current-session live readonly authorization flags are present.
- read only the readonly inventory allowlist keys from a git-outside env file.
- reject mutation/deploy/kubeconfig/DATABASE/Langfuse/GitHub secret keys.
- reject API allowlists containing mutation verbs.
- write only redacted reports under `.runtime/v22-tencent-readonly-inventory`.
- never call mutation APIs, kubectl, build, push or deploy.

This package does not authorize create/release, deploy, kubectl, build/push, COS object body reads, or production completion claims.

After authorized readonly execution passes, this package may claim only a redacted readonly cloud connection audit summary for the observed resource types.

## Cannot Claim

- production cloud is online.
- Portal ledger mapping completed.
- complete TKE node pool / namespace / workload inventory completed.
- complete COS file-space inventory beyond explicit metadata probes.
- create/release or deploy is authorized.
