# golden-path-first-class Eval Plan

## Required Commands

```bash
node tests/contract/contract-test-v22-change-package-lifecycle.mjs
node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs
node tests/contract/contract-test-v22-golden-smoke-suite.mjs
node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk --json
node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json
npm --prefix services/portal run check
node tests/regression/portal/regression-test-v22-portal-runtime-suite.mjs --group all
git diff --check -- docs specs changes tests scripts services/portal/src package.json
```

## Evidence Level

- local smoke evidence
- local contract proof
- local regression proof
- local source structure metric

## Can Claim

- Default repo verification starts from the MedOPL golden path health surface.
- Governance gates remain active guardrails after golden path health.
- Change packages must declare Golden Path Impact.
- `portal-runtime.mjs` has a first source-debt extraction with local checks.

## Cannot Claim

- Cannot claim production runtime, production billing, real cloud, deploy, kubectl, build/push or live-test readiness.
- Cannot claim local smoke is live evidence.
- Cannot claim the source debt program is complete.
