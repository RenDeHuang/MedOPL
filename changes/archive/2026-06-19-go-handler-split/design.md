# go-handler-split Design

## Architecture

The Go handler package remains the owner. This package only splits files inside `internal/server/handlers`; it does not introduce a new package, wrapper, alias or compatibility layer.

Control-plane ownership:

- `controlplane.go`: `ControlPlaneService`, request structs and `RegisterControlPlaneRoutes`.
- `controlplane_provider.go`: provider binding and preflight handlers.
- `controlplane_production_contracts.go`: production contract-only endpoints.
- `controlplane_opl.go`: user, managed environment, OPL workflow, artifact, billing and resource endpoints.
- `controlplane_helpers.go`: shared error/query/response helpers.

Portal projection ownership:

- `portal_projection.go`: local projection types, seed state, load and persist.
- `portal_projection_public.go`: public/user portal endpoints.
- `portal_projection_admin.go`: admin endpoint handlers.
- `portal_projection_payloads.go`: projection payload builders.
- `portal_projection_mutations.go`: admin state mutation methods.
- `portal_projection_helpers.go`: CSV and action parsing helpers.

## Test Surface

`contract-test-v22-go-backend-service-surface.mjs` reads all Go files in `internal/server/handlers` when checking route markers. This prevents a test from forcing the old monolithic filename back into the source structure.

## Failure Modes

- If route registration changes, the service-surface contract fails.
- If imports or package ownership drift, Go package tests fail.
- If long handlers are restored, line budget and review gates catch the regression.
