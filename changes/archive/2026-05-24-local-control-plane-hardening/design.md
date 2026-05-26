# local-control-plane-hardening Design

## Architecture

This historical package kept the then-active local topology intact: Node Portal backend, React/Vite Portal frontend, OPL Web Gateway, Runtime Bridge, OPL upstream and the future Go backend target. Current trunk later supersedes that Node backend state through physical removal; read current backend ownership from `docs/source/README.md` / `specs/source/spec.md`.

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

- source at original landing time: Node Portal runtime files, `services/medopl-go-backend/**`, targeted scripts/tests only. Current trunk has physically removed the Node Portal backend tree.
- docs: only this change package, plus existing truth README/history closeout if accepted.
- specs: `specs/source/spec.md` and `specs/framework/spec.md` durable requirement rows only; no new spec directory.
- tests: local deterministic tests and gates only.
