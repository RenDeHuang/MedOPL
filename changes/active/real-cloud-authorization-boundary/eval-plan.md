# real-cloud-authorization-boundary Eval Plan

## Required Commands

```bash
node tests/contract/contract-test-v22-change-package-lifecycle.mjs
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

## Cannot Claim

- Real cloud, deploy, kubectl, build/push, live-test or production release is authorized.
- Provider credentials, cloud resources, billing reconciliation or runtime deployment have been verified.
- Local dry-run evidence proves live behavior.
