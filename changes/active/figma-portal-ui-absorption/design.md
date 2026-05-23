# figma-portal-ui-absorption Design

## Boundary

Figma Make provides visual and information architecture input. Repo truth must be React/Vite source, typed API adapters, route wiring and local eval evidence.

## Data Flow

Portal frontend pages read typed API helpers under `services/portal/frontend/src/api/portal/**`, normalize data through app adapters, and render golden path states without raw provider keys or launch/runtime tokens in browser storage.

## Surface Impact

Allowed implementation surfaces are `services/portal/frontend/src/**` and narrow Portal API shell files needed for typed UI data. Gateway, Runtime Bridge, upstream OPL, deploy, infra and cloud lanes are out of scope.

## Failure Modes

- External Figma prototype remains ahead of repo source.
- UI renders mock readiness instead of API-backed state.
- Visual update breaks golden path navigation or mobile layout.
- Frontend stores provider secrets or runtime tokens.

## Eval Strategy

Run frontend typecheck, Figma/readiness regressions, API surface alignment checks and golden path suite before any closeout claim.
