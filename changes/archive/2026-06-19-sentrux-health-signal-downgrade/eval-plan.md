# sentrux-health-signal-downgrade Eval Plan

## Required Commands

```bash
node tests/contract/contract-test-v22-validate-active-platform.mjs
node tests/contract/contract-test-v22-ai-mvp-readiness-audit.mjs
node tests/health/health-check-v22-workflow-gate.mjs
node tests/contract/contract-test-v22-test-lane-registry.mjs
node tests/contract/contract-test-v22-change-package-lifecycle.mjs
```

## Evidence Level

- local contract proof
- local health gate proof

## Cannot Claim

- Sentrux health signal proves production or runtime readiness.
- Real cloud, deploy, kubectl, build/push, live-test or secret access is authorized.
