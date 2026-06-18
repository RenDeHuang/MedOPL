# gateway-launch-bridge-split Spec Delta

Target specs:

- specs/source/spec.md

## ADDED

- `source:gateway-launch-bridge-carrier-split` `services/opl-web-gateway/src/launch-client-script.mjs` must remain a thin public entrypoint while launch bridge browser-script generation is split into owner-scoped carrier modules under `services/opl-web-gateway/src/launch-client-script/**`.

## MODIFIED

- `source:active-services` is extended with a gateway source-structure requirement: launch bridge carrier internals live in explicit source modules instead of a monolithic string template file.

## REMOVED

- Line-budget baseline ownership for `services/opl-web-gateway/src/launch-client-script.mjs`.
- Monolithic launch bridge carrier ownership inside one 1000+ line browser script template file.

## CANNOT-CLAIM

- This package does not change launch runtime behavior, runtime bridge authorization, commercial readiness, billing readiness, deploy readiness, real cloud readiness, kubectl authorization, build/push authorization or live-test authorization.

## EVALS

- `node tests/regression/opl/regression-test-v22-opl-gateway-upstream-proxy-local.mjs`
- `node tests/regression/opl/regression-test-v22-opl-web-gateway-launch.mjs`
- `npm run test:health`
- `npm run test:contract`
- `npm run line:budget`
- `git diff --check`
