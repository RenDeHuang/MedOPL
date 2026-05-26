# precloud-deployable-rc Design

## Architecture

The pre-cloud deployment has three API-connected surfaces:

- OPL Workbench deployment: clean upstream OPL behind OPL Web Gateway.
- MedOPL SaaS deployment: Portal frontend plus `services/medopl-go-backend`.
- Cloud Connector boundary: Go-owned fail-closed API stubs that do not execute real cloud operations.

Node remains allowed for frontend tooling only. Node Portal backend is not a deployable control plane, not a `/portal/api` proxy target and not a current verification owner.

## Data Flow

Portal frontend uses relative `/api` typed calls. Go backend owns providerKeyRef, preflight, managed environment intent, OPL launch/bootstrap/session, file/run/artifact projection, billing/resource/audit projection and release/stop-billing projection. OPL Gateway and Runtime Bridge remain API boundaries for upstream and runtime interactions. Cloud connector returns authorization-required state until the separate real-cloud package is opened.

## Failure Modes

- Missing provider key returns `provider_key_required`.
- Missing launch/resource IDs fail closed with stable public errors.
- Cloud connector mutation attempts return authorization-required and cannot create resources.
- Frontend proxy or package scripts that point to Node Portal backend fail the precloud deployable gate.
- Local proof cannot be upgraded into production truth.

## Surface Impact

- source: `services/medopl-go-backend`, `services/portal/frontend`, `services/portal/package.json`
- docs: `docs/active/README.md`, `docs/source/README.md`, `docs/runtime/README.md`, `docs/product/README.md`, `docs/delivery/README.md`, `docs/history/README.md`
- specs: `specs/runtime/spec.md`, `specs/source/spec.md`, `specs/operations/spec.md`
- tests: `tests/contract/contract-test-v22-precloud-deployable-rc.mjs`, manifest and test lane registry
