# go-control-plane-mvp-takeover Design

## Architecture

`services/medopl-go-backend` becomes the local control-plane MVP backend. It exposes typed Portal APIs through Gin handlers, service interfaces and local repositories. `services/portal/frontend` remains a separated React/Vite frontend and calls the Go-owned API surface directly.

`services/portal/src` is treated as a retirement surface for business truth. Any retained Node code can only be temporary shell/relay code until migrated or deleted; it cannot own package, provider, launch, billing, audit, resource or release truth.

## Data Flow

1. Frontend requests typed API from the Go control-plane surface.
2. Go handler validates query/body input and fails closed on missing required fields.
3. Go service applies package/subscription/entitlement and workflow rules.
4. Repository records local deterministic state for MVP proof.
5. Golden path eval proves local behavior; real cloud readiness remains separate.

## Error Handling

- Missing `workspaceId`, `packageId` or idempotency input returns explicit client errors.
- Unknown package or unsupported transition returns explicit domain errors.
- No path returns `ok: true` unless state was actually produced by Go service/repository.
- Secret-like values and raw provider keys are not accepted by the public API payloads.

## Surface Impact

- docs/specs/source/runtime truth updates only where current backend ownership changes.
- Go code adds typed API packages without broad framework expansion.
- Frontend API client moves from Node Portal backend ownership to Go-owned API ownership.
- Node Portal backend cleanup follows inventory and migration map rather than ad hoc deletion.
