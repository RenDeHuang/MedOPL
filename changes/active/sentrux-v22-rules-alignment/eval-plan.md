# sentrux-v22-rules-alignment Eval Plan

## Required Commands

```bash
node tests/contract/contract-test-v22-sentrux-rules-alignment-boundary.mjs
node tests/contract/contract-test-v22-change-package-lifecycle.mjs
node tests/contract/contract-test-v22-test-lane-registry.mjs
npm run verify -- --json
npm run gate:review -- --json
sentrux gate .
sentrux check .
git diff --check -- docs specs changes tests scripts package.json
```

## Evidence Level

- local contract proof
- local structural gate evidence

## Can Claim

- The Sentrux v22 rules alignment blocker is represented as a repo-native local boundary.
- `sentrux gate .` passes and confirms no structural regression against the saved baseline.
- `.sentrux/rules.toml` is updated to the v22 active source model.
- `sentrux check .` passes.
- Repository structure satisfies `.sentrux/rules.toml` for the current local graph.

## Cannot Claim

- Production, real-cloud, deploy, kubectl, build/push or live-test readiness.
- Future source changes will continue to satisfy `.sentrux/rules.toml` without rerunning Sentrux.
- `.sentrux/*` edits beyond `.sentrux/rules.toml` are authorized.
