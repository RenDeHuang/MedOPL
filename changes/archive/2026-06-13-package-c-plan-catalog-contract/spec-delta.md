# package-c-plan-catalog-contract Spec Delta

Target specs:

- specs/product/spec.md
- specs/operations/spec.md

## ADDED

- `product:starter-2c4g-10gb-plan-catalog` defines Starter as 2C4G compute, 10GB workspace storage and one task concurrency.
- `operations:package-c-plan-catalog-allowlist` requires Package C live canary cloud params to derive node instance type, workspace storage quota and node system disk from a plan catalog allowlist.

## MODIFIED

- Starter storage remains 10GB in current product/spec/test truth while TKE node system disk remains 50GB.
- Package C canary validates Starter through catalog-derived `SA5.MEDIUM4`, `CloudBSSD` and 50GB node system disk instead of temporary `SA5.MEDIUM2`.
- User upgrades are allowed only after the target shape exists in the MedOPL plan catalog allowlist.

## REMOVED

- Arbitrary `instanceType` and `nodeInstanceType` input is not accepted in Package C non-secret cloud params.
- Workspace storage must not be interpreted as TKE node system disk.

## CANNOT-CLAIM

- This package does not authorize real Tencent mutation.
- This package does not deploy workloads, run kubectl, build/push images or run Package D.
- This package does not prove production billing, production runtime or production deploy readiness.

## EVALS

- `node tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-readiness-local-gate.mjs`
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-live-runner-local-gate.mjs`
- `node tests/smoke/smoke-test-v22-pricing-plan-contract.mjs`
- `node tests/smoke/smoke-test-v22-resource-plan-contract.mjs`
- `node tests/smoke/smoke-test-v22-mvp-user-loop-contract.mjs`
- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk`
