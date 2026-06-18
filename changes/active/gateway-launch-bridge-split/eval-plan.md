# gateway-launch-bridge-split Eval Plan

## Required Commands

```bash
node tests/regression/opl/regression-test-v22-opl-gateway-upstream-proxy-local.mjs
node tests/regression/opl/regression-test-v22-opl-web-gateway-launch.mjs
npm run test:health
npm run test:contract
npm run line:budget
git diff --check
```

## Evidence Level

- local source-structure proof
- local gateway regression proof
- local repo hygiene proof

## Can Claim

- Gateway launch bridge carrier ownership is split into owner-scoped generator modules while `portalLaunchClientScript()` remains the public source entrypoint.
- `services/opl-web-gateway/src/launch-client-script.mjs` no longer needs a line-budget baseline.

## Cannot Claim

- Runtime behavior changed beyond preserved existing launch-client behavior.
- Commercial rollout, billing readiness, deploy readiness, real cloud readiness, kubectl readiness, build/push readiness or live-test readiness is complete.
