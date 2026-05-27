# local-portal-opl-delivery-rc Spec Delta

Target specs:

- specs/product/spec.md
- specs/runtime/spec.md
- specs/operations/spec.md

## ADDED

- `product:local-portal-delivery-rc` Portal local delivery must provide a repeatable non-cloud RC covering login/session, account credit, providerKeyRef binding, managed environment open, workspace file/task projection, run/artifact projection, billing/trace/audit and release/stop-billing local closure.
- `runtime:local-clean-opl-delivery-rc` OPL local delivery must keep upstream clean and integrate through Gateway and Runtime Bridge only; missing upstream capability must fail closed.
- `operations:local-release-orchestration` local release orchestration must expose plan/check/start/stop/status/logs without reading secrets, calling cloud, deploying, kubectl, build/push or modifying upstream.

## MODIFIED

- `operations:real-cloud-authorization-boundary` remains separate from this package and must not be used as implementation authorization for local Portal/OPL delivery.
- `runtime:clean-upstream-boundary` is narrowed for local RC: clean upstream can be configured as a local URL, but MedOPL still cannot own upstream internals or write upstream code.

## REMOVED

- No durable requirement is removed by this package.

## CANNOT-CLAIM

- This package cannot claim real cloud readiness, production deploy, live provider readiness, production billing or upstream production ownership.
- Local deterministic evidence cannot claim real OPL production behavior unless separately authorized and summarized as bounded evidence.
- Gateway and Runtime Bridge remain integration/runtime boundaries; they do not become SaaS product truth or billing ledger truth.

## EVALS

- `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`
- `node tests/contract/contract-test-v22-local-portal-opl-delivery-rc.mjs`
- `node scripts/v22-local-services.mjs check --dry-run --json`
- `npm run test:regression -- --json`
