# local-golden-path-release-candidate Eval Plan

## Required Commands

```bash
node tests/local-rc/local-rc-test-v22-provider-bound-message-backflow.mjs
npm run verify:golden-path
npm run verify:current
npm run verify:contract
npm run verify:review
npm --prefix services/portal run check
```

## Completed Local RC Commands

```bash
node tests/contract/contract-test-v22-test-lane-registry.mjs
node tests/contract/contract-test-v22-test-lifecycle-cleanup.mjs
node tests/health/health-check-v22-smoke-classification-gate.mjs
node tests/health/health-check-v22-smoke-eval-boundary.mjs
node tests/health/health-check-v22-repo-bloat-audit-gate.mjs
node scripts/v22-verify.mjs suite local-rc-authorized --base origin/recovery/platform-v22-trunk --dry-run --json
git diff --check -- docs specs scripts tests
node tests/local-rc/local-rc-test-v22-provider-bound-message-backflow.mjs
```

Results:

- registry/lifecycle/classification/eval-boundary gates: pass.
- repo bloat gate: pass with `testsMjsFiles=111`.
- local RC eval: pass when run with the user-authorized local provider credential in process env; observed local Portal, Gateway and Runtime Bridge on isolated temporary loopback ports; OPL upstream URL was `http://127.0.0.1:18130`.
- no raw provider key was printed, persisted to git or reported.

## Evidence Level

- local provider-bound message proof
- local contract proof
- local golden path proof

## Can Claim

- Local Portal, OPL Gateway and Runtime Bridge can complete a provider-bound message backflow path.
- Runtime Bridge can project a reply artifact/trace shape for the local RC path.
- Missing provider config remains fail-closed.
- Public response surfaces use `providerKeyRef` and do not expose raw provider key.

## Cannot Claim

- Production provider readiness.
- Real cloud resource lifecycle.
- Production deploy, kubectl rollout, build/push or live-test completion.
- Production billing or production trace evidence.
- Upstream OPL source modification.
