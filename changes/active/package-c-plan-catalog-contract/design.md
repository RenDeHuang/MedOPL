# package-c-plan-catalog-contract Design

## Architecture

Package C owns the canary runner and cloud-prework support under `tests/support/cloud-prework/`. The canary no longer treats cloud params as a free-form compute SKU input. Instead, it reads a repo-tracked allowlist fixture and normalizes the requested plan into compute, workspace storage and TKE node fields.

## Data Flow

1. The non-secret cloud params JSON provides fixed environment fields and `planId`.
2. `package-c-live-canary-cloud-params.js` resolves `planId` against `tests/support/cloud-prework/package-c-live-canary-plan-catalog-allowlist.json`.
3. The normalized payload writes redacted evidence with `workspaceStorageGb`, `nodeInstanceType` and `systemDisk` as separate fields.
4. The live runner uses only the normalized `nodeInstanceType` when constructing `CreateNodePool`.

## Failure Modes

- Unknown plans fail closed.
- Mismatched `--server-plan-id` and cloud params `planId` fail closed.
- Raw `instanceType` or `nodeInstanceType` in cloud params fails closed.
- Public IP enabled fails closed.

## Surface Impact

- source: Package C cloud-prework helpers and Go lab package catalog.
- tests: future-authorized Package C gates and smoke plan contracts.
- docs: product, specs and delivery truth.
- evidence: prepare-only `.runtime` evidence shape only; no git-tracked raw provider response.
