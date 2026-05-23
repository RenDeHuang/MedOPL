# local-golden-path-release-candidate Eval Plan

## Required Commands

```bash
node tests/local-rc/local-rc-test-v22-provider-key-message-backflow.mjs
npm run verify:golden-path
npm run verify:current
npm run verify:contract
npm run verify:review
npm --prefix services/portal run check
```

## Evidence Level

- local provider-key-bound message proof
- local contract proof
- local golden path proof

## Can Claim

- Local Portal, OPL Gateway and Runtime Bridge can complete a provider-key-bound message backflow path.
- Runtime Bridge can project a reply artifact/trace shape for the local RC path.
- Missing provider config remains fail-closed.
- Public response surfaces use `providerKeyRef` and do not expose raw provider key.

## Cannot Claim

- Production provider readiness.
- Real cloud resource lifecycle.
- Production deploy, kubectl rollout, build/push or live-test completion.
- Production billing or production trace evidence.
- Upstream OPL source modification.
