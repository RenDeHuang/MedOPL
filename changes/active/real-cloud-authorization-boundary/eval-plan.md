# real-cloud-authorization-boundary Eval Plan

## Required Commands

```bash
node tests/contract/contract-test-v22-change-package-lifecycle.mjs
node tests/contract/contract-test-v22-real-cloud-authorization-boundary.mjs
node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --dry-run --json
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
git diff --check -- docs changes specs tests scripts
```

## Evidence Level

- future-authorized boundary
- local contract proof

## Can Claim

- The real-cloud authorization cursor has a repo-native change package.
- Default verification remains local-only and dry-run for future-authorized cloud boundaries.
- Explicit authorization is required before sensitive operations.
- The post-boundary cloud sequence is repo-native and remains `mock/snapshot provider -> readonly quote -> dry-run plan -> readonly inventory -> authorized create/release -> authorized deploy -> canary / QA / status update`.
- Future authorization must name operation class, target environment, secret allowlist, API allowlist, budget, evidence sink and rollback owner before any sensitive operation runs.

## Cannot Claim

- Real cloud, deploy, kubectl, build/push, live-test or production release is authorized.
- Provider credentials, cloud resources, billing reconciliation or runtime deployment have been verified.
- Local dry-run evidence proves live behavior.

## Required Future Sequence

```text
mock/snapshot provider
-> readonly quote
-> dry-run plan
-> readonly inventory
-> authorized create/release
-> authorized deploy
-> canary / QA / status update
```
