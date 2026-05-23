# repo-native-change-lifecycle Eval Plan

## Required Commands

```bash
node tests/contract/contract-test-v22-change-package-lifecycle.mjs
node tests/contract/contract-test-v22-spec-eval-traceability.mjs
node tests/contract/contract-test-v22-test-lane-registry.mjs
node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs
node tests/health/health-check-v22-workflow-gate.mjs
node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --dry-run --json
git diff --check -- docs specs changes tests scripts
```

## Evidence Level

- local contract proof
- local workflow gate proof

## Can Claim

- Repo-native change package lifecycle is defined and locally gated.
- Durable domain specs exist and include requirement-to-eval traceability.
- Workflow review can fail closed when formal engineering changes have no active change package.

## Cannot Claim

- OpenSpec CLI is installed or required.
- Real cloud, deploy, kubectl, build/push, live-test or production evidence is authorized.
- Existing product/runtime behavior changed.

