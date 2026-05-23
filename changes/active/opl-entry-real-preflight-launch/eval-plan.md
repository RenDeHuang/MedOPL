# opl-entry-real-preflight-launch Eval Plan

## Required Commands

```bash
node tests/regression/opl/regression-test-v22-opl-entry-preflight-auth-flow.mjs
node tests/regression/opl/regression-test-v22-opl-web-gateway-launch.mjs
node tests/regression/opl/regression-test-v22-provider-secret-boundary-contract.mjs
node tests/regression/portal/regression-test-v22-portal-figma-make-interaction-readiness.mjs
node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs
npm --prefix services/portal/frontend run typecheck
npm --prefix services/portal run check
node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json
node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
git diff --check -- docs specs changes tests scripts package.json services/portal/frontend/src services/portal/src services/opl-web-gateway/src services/opl-runtime-bridge/src
```

## Evidence Level

- local frontend proof
- local contract proof
- local golden path smoke evidence

## Can Claim

- The package can claim local OPL entry preflight / launch UI contract alignment only after required local evals pass.

## Cannot Claim

- No production evidence, real cloud authorization, provider live proof, deploy, kubectl, build/push, live-test or Go backend takeover.
