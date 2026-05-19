# 2026-05-19 Leaf Portal OPL File Run Artifact Closure

## leaf_id

leaf-portal-opl-file-run-artifact-closure

## goal

Close the local Portal to OPL file/run/artifact loop by wiring existing Portal OPL API clients into the React/Figma Portal action layer, keeping Gateway and Runtime Bridge as the clean boundary, and proving the result with repo-local eval gates.

## model

gpt-5.4

## subagents_and_models

- Controller / integration: `gpt-5.4`; responsibility: contract/eval coordination, implementation integration, verification, and final B handoff.
- Contract/eval auditor subagent: `gpt-5.4`; responsibility: read-only contract package and eval coverage audit.
- Portal frontend/API wiring auditor subagent: `gpt-5.4`; responsibility: read-only frontend API/page/adapter gap audit.
- Portal route + Runtime Bridge/Gateway auditor subagent: `gpt-5.4`; responsibility: read-only route and Runtime Bridge/Gateway boundary audit.
- Portal frontend/API wiring worker subagent: `gpt-5.4`; responsibility: attempted frontend wiring; closed after no timely progress report. Controller completed and verified the final implementation.

## branch

feat/v22-portal-opl-file-run-artifact-closure

## base_trunk_head

061956f6524dc1e02753f33b326cef9c2f3d390d

## commit_sha

pending_B_review

## contract_subscription

- `AGENTS.md`
- `docs/contracts/README.md`
- `docs/recovery/mvp-contract-acceptance.md`
- `docs/recovery/status-matrix.md`
- `docs/recovery/v22-goal-current.json`
- `docs/recovery/v22-agent-verify-manifest.json`
- `docs/recovery/v22-current-vs-ideal-gap-matrix.md`
- `docs/contracts/v22-mvp-managed-opl-loop.md`
- `docs/contracts/v22-saas-control-plane-user-experience-boundary.md`
- `docs/contracts/v22-portal-opl-connection-boundary.md`
- `docs/contracts/v22-opl-work-message-file-run-boundary.md`
- `docs/contracts/v22-runtime-bridge-session-run-file-provider-keyref-boundary.md`
- `docs/contracts/v22-portal-files-billing-trace-boundary.md`
- `docs/contracts/v22-portal-structure-failure-isolation-boundary.md`
- `docs/contracts/v22-smoke-eval-boundary.md`
- `docs/recovery/portal-local-runtime-health-runbook.md`

## allowed_write_scope

- `services/portal/frontend/src/api/portal/opl.ts`
- `services/portal/frontend/src/app/data/portalAdapters.ts`
- `services/portal/frontend/src/app/pages/Workspace.tsx`
- `services/portal/frontend/src/app/pages/TasksResults.tsx`
- `scripts/smoke-test-v22-portal-frontend-api-surface-alignment.mjs`
- `scripts/smoke-test-v22-portal-runtime-suite.mjs`
- `scripts/smoke-test-v22-agent-run-record-gate.mjs`
- `docs/recovery/v22-goal-current.json`
- `docs/recovery/v22-goal-state.md`
- `docs/recovery/v22-current-vs-ideal-gap-matrix.md`
- `docs/recovery/v22-agent-verify-manifest.json`
- `docs/recovery/status-matrix.md`
- `docs/recovery/agent-runs/2026-05-19-leaf-portal-opl-file-run-artifact-closure.md`

## forbidden_scope

- Do not read secrets; no secret.
- Do not call real cloud APIs; no real cloud.
- Do not modify upstream; no upstream.
- Do not modify `deploy/*`, `.sentrux/*`, `adapters/*`, `infra/*`, or one-person-lab upstream.
- Do not run build/push/kubectl/deploy/live-test.
- Do not commit `.runtime` or local runtime scratch files.
- Do not do PostgreSQL/Redis, true cloud, deployment, or admin new business closure in this leaf.
- Do not change Figma Portal UI visuals, layout, or information architecture.

## implementation_summary

- Activated the current leaf frontend API surface by requiring `createOplFileRef`, `startOplRun`, and `fetchOplArtifact` to be consumed rather than adjudicated as future-reserved.
- Added typed frontend payloads for OPL file reference creation, run start, and artifact projection.
- Extended `portalAdapters.ts` with UI-safe OPL action models:
  - workspace input files can create OPL file references and start an OPL run only when a real `launchId` is present, while the frozen `进入 OPL` CTA remains a route entry into `/opl-launch`;
  - trace/result rows can resolve an OPL artifact only when a real `launchId` and public `artifactRef` are present;
  - no raw provider key, launch token, runtime token, signed URL, object key, storage key, or local path is persisted in React state.
- Updated `/trace` so `查看结果` calls artifact projection before navigating to `/workspace`, while `查看详情` keeps the `/trace` route and shows a product-state message when no result has backflowed.
- Updated `/workspace` so existing OPL CTA slots retain their original `/opl-launch` navigation semantics; the local file/run API closure remains available through the adapter and is verified by runtime gates without changing the frozen page IA.
- Kept the canonical local closure on existing `/portal/api/opl/*` and Runtime Bridge/Gateway gates. The legacy `/portal/api/v22/opl-work/*` smoke remains a historical/local contract gate and is not used as the completion proof for this leaf.

## eval_first_changes

- RED: `node scripts/smoke-test-v22-portal-frontend-api-surface-alignment.mjs` failed with `frontend_api_active_used_exports_must_be_consumed:["opl.ts:createOplFileRef","opl.ts:startOplRun","opl.ts:fetchOplArtifact"]`.
- GREEN: the same gate now reports all three OPL API clients under `activeUsedByFile.opl.ts`.
- Added `scripts/smoke-test-v22-portal-opl-api-runtime-loop.mjs` and `scripts/smoke-test-v22-portal-trace-file-linkage.mjs` to the surface bundle and current leaf verify manifest.
- Tightened `scripts/smoke-test-v22-agent-run-record-gate.mjs` so the current cursor requires this agent-run record in addition to the previously absorbed workspace record.

## blocker_review_and_fix_log

- Blocker: current truth declared the three OPL API clients as the current leaf binding, but frontend API surface alignment still treated them as future-reserved.
- Fix: converted them to required-used exports and wired them through `portalAdapters.ts`.
- Blocker: `/trace` had a static `/workspace` link for result viewing and a self-link for details, creating the appearance of action without actual artifact resolution.
- Fix: `查看结果` now calls `fetchOplArtifact` through the adapter when launch and artifact context exists, then navigates to `/workspace`; missing artifact context shows a product-state reason instead of becoming a dead action.
- Blocker: the first implementation changed the frozen `/workspace` `进入 OPL` CTA into direct run start, which changed the user-visible IA.
- Fix: restored `/workspace` `进入 OPL` as a stable `/opl-launch` route action; the file/run closure remains verified by `/portal/api/opl/*` runtime gates and the adapter action model.
- Blocker: frontend OPL API types exposed internal `resourceBindingId` / `runId` field names, and the zero-compat gate rejected them.
- Fix: narrowed `services/portal/frontend/src/api/portal/opl.ts` to a UI-safe public TypeScript contract and moved transient run projection access into the adapter without exposing those fields as frontend API surface types.
- Important: workspace file references used only `file.name`, losing subdirectory context.
- Fix: `createOplFileRef` now sends `relativePath` when present so local Runtime Bridge projection remains stable for nested files.
- Blocker: agent-run record gate only checked the previous absorbed workspace leaf.
- Fix: gate now checks this current leaf record when `current_cursor` is `leaf-portal-opl-file-run-artifact-closure`.

## verification_commands

Executed during this branch before commit:

```bash
node scripts/smoke-test-v22-portal-frontend-api-surface-alignment.mjs
node scripts/smoke-test-v22-portal-trace-file-linkage.mjs
node scripts/smoke-test-v22-portal-files-billing-trace-flow.mjs
node scripts/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs
node scripts/smoke-test-v22-portal-opl-api-runtime-loop.mjs
npm --prefix services/portal/frontend run typecheck
node scripts/smoke-test-v22-zero-compat-active-surface-gate.mjs
node scripts/smoke-test-v22-portal-figma-make-interaction-readiness.mjs
node scripts/smoke-test-v22-portal-runtime-suite.mjs --group browser
```

Full B handoff verification to run before absorb:

```bash
node scripts/smoke-test-v22-agent-run-record-gate.mjs
node scripts/smoke-test-v22-portal-frontend-api-surface-alignment.mjs
node scripts/smoke-test-v22-portal-opl-api-runtime-loop.mjs
node scripts/smoke-test-v22-portal-trace-file-linkage.mjs
node scripts/smoke-test-v22-opl-work-message-file-run-flow.mjs
node scripts/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs
node scripts/smoke-test-v22-portal-files-billing-trace-flow.mjs
node scripts/smoke-test-v22-portal-runtime-suite.mjs --group surface
node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json
node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json
npm --prefix services/portal/frontend run typecheck
npm --prefix services/portal run check
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
git diff --check
added-lines secret value scan
```

## b_review_result

pending_B_review

## runtime_notes

- This leaf uses local Portal, Gateway, Runtime Bridge and Vite smoke coverage only.
- `scripts/smoke-test-v22-portal-opl-api-runtime-loop.mjs` starts local fake product API, local upstream web, Runtime Bridge, Gateway, Portal and Vite, then verifies launch, bootstrap, session bind, message, file, run, artifact, trace projection and secret hygiene.
- `node scripts/smoke-test-v22-portal-runtime-suite.mjs --group browser` starts local Portal/Vite with Playwright and verifies account dialog, logout, backend CSV export, admin recharge/refund actions, announcement create/delete visibility, desktop/mobile overflow, and no captured console/request failures.
- If UI appears blank or broken during browser checks, first follow `docs/recovery/portal-local-runtime-health-runbook.md` to distinguish stale Vite/Tailwind/backend runtime drift from code regression.
- No `.runtime` evidence is committed.

## non_goals

- No real cloud.
- No secret read.
- No upstream modification.
- No build, image push, kubectl, deploy, or live-test.
- No PostgreSQL/Redis local production data closure.
- No admin new business closure.
- No Figma Portal UI visual/layout/information-architecture change.
- No production claim for real OPL file upload, real cloud runtime, COS billing reconciliation, or Langfuse deployment.

## next_leaf

After B review, ff-only absorb and push, open a small post-absorb truth branch to mark this leaf absorbed. The next implementation leaf should be selected from current contracts and gates; the strongest existing local candidate is PostgreSQL/Redis local production data closure via `scripts/smoke-test-v22-portal-storage-mode-local-closure.mjs`, unless B identifies an admin/business closure regression that should take priority.
