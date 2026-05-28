# portal-opl-refund-api-fix Design

## Architecture

The fix stays inside existing owners:

- Portal frontend owns route alias and OPL entry load order.
- Go backend owns local Portal ledger canonical balance mutation.
- Regression eval owns browser/API proof.

No new service, compatibility layer or fallback backend is added.

## Data Flow

1. `/portal/opl` redirects to `/opl-launch`.
2. OPL entry calls `/api/opl/entry/preflight`.
3. If provider binding is missing, the page renders the binding state without creating a launch.
4. If provider binding exists, the page creates launch, bootstrap and session bind as before.
5. Admin refund action posts `ledger-adjust` with `actionType=refund`.
6. Go backend stores a negative refund ledger row and applies that signed amount to balance.

## Failure Modes

- Missing provider binding stays user-blocking and visible in the OPL entry UI.
- Invalid refund amount fails closed through existing admin amount validation.
- Unknown admin action remains unsupported.
- Secret, launch token and raw provider key remain outside public payloads and git evidence.

## Surface Impact

- source: `services/portal/frontend/src/app/routes.tsx`, `services/portal/frontend/src/app/data/portalAdapters.ts`, `services/portal/frontend/src/api/portal/opl.ts`, `services/medopl-go-backend/internal/server/handlers/portal_projection.go`
- docs: archived change package and durable specs
- specs: `specs/runtime/spec.md`, `specs/operations/spec.md`
- tests: local Portal browser regression and Go server tests
