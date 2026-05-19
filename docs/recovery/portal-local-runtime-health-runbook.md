# Portal Local Runtime Health Runbook

This runbook is for local Portal UI health checks only. It does not authorize secret reading, real cloud calls, build/push, kubectl, deploy, live-test, upstream edits, or committing `.runtime`.

## Purpose

When the Portal UI is blank, stale, or visibly broken in local development, first distinguish:

- code regression: repo-tracked source or contract behavior is wrong;
- local runtime drift: old processes, wrong ports, stale Vite/Tailwind state, backend not running, or a changed local runtime root.

Do not treat local blank UI as a product regression until the runtime process, ports, backend API, and local seed root are checked.

## Expected Local Ports

- Vite frontend: `5173`
- Portal backend: `17080`

Check both before changing code:

```bash
lsof -nP -iTCP:5173 -sTCP:LISTEN
lsof -nP -iTCP:17080 -sTCP:LISTEN
```

If another stale process owns a port, stop that local process and restart the intended Portal services. Do not kill unrelated user processes unless ownership is clear.

## Local Startup Order

Start the backend first, then the Vite frontend:

```bash
PORT=17080 npm --prefix services/portal run start
npm --prefix services/portal/frontend run dev -- --host 127.0.0.1 --port 5173
```

Keep both terminals visible while testing. Backend startup errors explain many frontend blank states because the frontend depends on `/portal/api/*` responses.

## Route And API Health Checks

After both processes are up, verify the shell and API endpoints:

```bash
curl -i http://127.0.0.1:5173/overview
curl -i http://127.0.0.1:17080/portal/api/me
curl -i http://127.0.0.1:17080/portal/api/overview
```

Expected result: each endpoint returns HTTP `200`. If `/overview` returns `200` but the page is visually blank, inspect the browser console and Vite terminal before editing source. If either API endpoint fails, debug the backend first.

## Common Drift Patterns

### Old Vite stale process

Symptoms:

- Browser shows old UI after source changes.
- `/overview` serves successfully but rendered content does not match current code.
- Vite terminal logs do not update when files change.

Diagnosis:

```bash
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

Resolution: stop the stale Vite process that owns `5173`, then restart the frontend from this worktree.

### Tailwind preflight path cache

Symptoms:

- Layout appears unstyled or partially reset.
- Class changes do not appear after restart.
- Vite is serving the right route, but generated styles look stale.

Diagnosis path:

1. Confirm the frontend was started from this worktree.
2. Confirm Vite logs include the current `services/portal/frontend` path.
3. Restart the frontend after stopping the old Vite process.
4. If the browser still shows stale CSS, clear the browser tab cache for the local origin and reload.

Do not patch CSS to compensate for stale Tailwind preflight or path cache. Once the current frontend process and cache are clean, reproduce the issue before changing code.

### Backend ECONNREFUSED

Symptoms:

- Browser console or Vite proxy reports `ECONNREFUSED`.
- `/overview` loads the shell but data panels are empty or erroring.
- `curl http://127.0.0.1:17080/portal/api/me` fails.

Diagnosis:

```bash
lsof -nP -iTCP:17080 -sTCP:LISTEN
curl -i http://127.0.0.1:17080/portal/api/me
curl -i http://127.0.0.1:17080/portal/api/overview
```

Resolution: start or restart the Portal backend on `17080`, then reload the Vite page. Treat API shape errors as code issues only after the backend is reachable and returning current worktree responses.

## PORTAL_RUNTIME_ROOT And Local Seed Data

`PORTAL_RUNTIME_ROOT` selects the local runtime state root used by the Portal backend. Changing it can make seeded workspaces, users, files, billing rows, or traces appear missing because the backend is looking at a different local state directory.

This does not mean repo data was cleared. Before opening a data-loss or regression leaf, record:

```bash
printf 'PORTAL_RUNTIME_ROOT=%s\n' "${PORTAL_RUNTIME_ROOT:-}"
```

Runtime roots and generated evidence belong under `.runtime` or another local scratch path and must not be committed.

## Regression Decision

Classify as local runtime drift when:

- `5173` is owned by an old Vite process;
- `17080` is not listening;
- API calls fail with connection errors;
- the active `PORTAL_RUNTIME_ROOT` changed from the previous run;
- the browser is serving stale CSS or stale JS from local cache.

Classify as code regression only after:

- Vite is running from the current worktree on `5173`;
- Portal backend is running from the current worktree on `17080`;
- `/overview`, `/portal/api/me`, and `/portal/api/overview` are verified;
- stale browser and Tailwind/Vite cache explanations are ruled out;
- the bad behavior is reproducible from a clean local restart.

## Git Hygiene

- Do not commit `.runtime`.
- Do not commit logs that contain tokens, raw API keys, signed URLs, object keys, storage keys, local paths, or cloud credentials.
- Do not use this runbook as authorization for real cloud, deploy, kubectl, live-test, build/push, upstream, `deploy/*`, `.sentrux/*`, `adapters/*`, or `infra/*` work.
