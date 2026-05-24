# go-control-plane-mvp-takeover Review

## Self Review

- rules/status/evidence separation: pass. `docs/active/README.md` only carries current cursor/blocker/verification; product/runtime/source/spec truth stays in owner files.
- spec-to-eval traceability: pass. Go takeover is present in `specs/source/spec.md`, `specs/runtime/spec.md`, manifest, test registry and current bundle.
- code cleanup boundary: pass. Node `/portal/api/lab-*` is now a 410 retired shell and no longer serves lab package/subscription business writes.
- secret hygiene: pass. No secret-like value, provider key, kubeconfig, token or live provider response was read or committed.
- false production claim check: pass. Local Go proof is not written as production backend replacement, real-cloud readiness, deploy, kubectl, build/push or live-test evidence.

## Independent Review

- reviewer: Codex native explorer subagent `Epicurus`
- model: `gpt-5.4-mini`
- result: blocker=0 after review blocker fixes.
- blockers: 0
- reviewed scope: `origin/recovery/platform-v22-trunk..HEAD`
- residual risk: static review only; runtime assurance comes from the actual `current` bundle recorded in closeout.

### 2026-05-24 local RC parity review

- reviewer: Codex native explorer subagent `Dirac`
- model: `gpt-5.4-mini`
- result: blocker=0.
- reviewed scope: `origin/recovery/platform-v22-trunk..HEAD`
- residual risks found: `Resources()` had global memory projection risk; `Release()` could synthesize a released projection for a missing resource in deterministic local proof.
- action: fixed in Go control-plane code. Resources are workspace-scoped, and release now fails closed with `resource_not_found` for missing or wrong-workspace resources.

### 2026-05-24 health / Node route retirement review

- reviewer: Codex native review subagent `Nietzsche`
- model: `gpt-5.4-mini`
- result: blocker found, then fixed locally.
- blockers found:
  - health suite did not include the Go local RC parity guards.
  - Node Portal `provider-key` / `managed-environment/open` / `managed-environment/readiness` route still held control-plane business logic.
- action: health now runs `contract-test-v22-go-backend-service-surface.mjs` and `regression-test-v22-portal-runtime-real-api-data-closure.mjs`; Node provider/open route is a `410 node_v22_provider_open_retired` shell and is no longer registered by `portal-api.routes.mjs`.

### 2026-05-24 final route retirement review

- reviewer: Codex native review subagent `Aquinas`
- model: `gpt-5.4-mini`
- result: blocker found, then fixed locally.
- blockers found:
  - Node Portal provider/open retired shell parsed malformed JSON before returning 410.
  - `golden-path` suite did not directly run the Node route retirement guard.
- red evidence before fix:
  - `node tests/contract/contract-test-v22-node-portal-workflow-facade-boundary.mjs` failed on malformed JSON body.
  - `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs` failed because `golden-path` lacked the route-retirement guard command.
- action: retired shell now ignores request body and always returns 410 for the retired Node v22 provider/open paths; `golden-path` now runs `contract-test-v22-node-portal-workflow-facade-boundary.mjs` after golden smoke.

### 2026-05-24 final verification review

- reviewer: Codex native review subagent `Avicenna`
- model: `gpt-5.4-mini`
- result: blocker=0.
- reviewed scope: current uncommitted diff.
- confirmed:
  - Node retired provider/open shell no longer reads or parses request body and returns stable 410.
  - `golden-path` suite includes the Node route retirement guard.
  - `current`, `review` and `health` still cover Go local RC parity.
  - docs keep local proof separate from production truth.
- nit accepted for future package, not this Node-retirement blocker: Go readiness remains a POST handler that reads optional JSON/query `workspaceId` by current API contract.
