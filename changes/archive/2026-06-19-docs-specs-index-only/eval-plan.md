# docs-specs-index-only Eval Plan

## Required Commands

```bash
node tests/contract/contract-test-v22-docs-portfolio-lifecycle.mjs
node tests/contract/contract-test-v22-mvp-contract-suite.mjs
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
npm run verify
```

## Evidence Level

- local contract proof

## Can Claim

- `docs/specs/README.md` is index-only and no longer stores fenced JSON.
- The MVP contract suite no longer needs `docs/specs/README.md` prose as a machine database.

## Cannot Claim

- Full spec system is minimal.
- Runtime behavior, product behavior, production readiness, real cloud, deploy, kubectl, build/push or live-test changed.
