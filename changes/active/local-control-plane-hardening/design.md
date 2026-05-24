# local-control-plane-hardening Design

## Architecture

This package keeps the active local topology intact: Node Portal backend, React/Vite Portal frontend, OPL Web Gateway, Runtime Bridge, OPL upstream and the future Go backend target. It does not replace the topology in one step. Instead it adds narrow gates and source changes that make the current local topology reliable before cloud authorization.

## Data Flow

- Local service readiness reads process and health projections only; it must not read secrets or call cloud.
- Portal workspace file projection stays in Node runtime code, but no longer shells out through a PowerShell helper path.
- Portal runtime assembly remains the server entry, while app dependencies, clients, route wiring, workspace operations and observability stay in focused modules.
- Go backend handoff remains contract-level / repo-local API readiness until a later package can prove production takeover with Go tests and explicit landing gates.

## Failure Modes

- If a localhost service belongs to another worktree, the local readiness check fails with the owning cwd.
- If the old MinIO helper is referenced by active source, the cleanup gate fails.
- If `portal-runtime.mjs` fan-out expands, the structure gate fails.
- If the Go toolchain is missing, the package records that limitation and cannot claim Go test evidence.

## Surface Impact

- source: `services/portal/src/**`, `services/medopl-go-backend/**`, targeted scripts/tests only.
- docs: only this change package, plus existing truth README/history closeout if accepted.
- specs: existing `docs/specs/README.md` anchors only if the implementation creates durable deltas.
- tests: local deterministic tests and gates only.
