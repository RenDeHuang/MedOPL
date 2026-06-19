# ai-runtime-contract Closeout

Status: authoring

## Commits

- pending

## Verification

- `node tests/contract/contract-test-v22-ai-mvp-readiness-audit.mjs`: passed after registering a no-authorization AI MVP readiness audit across MVP suite, pre-cloud RC, local Portal/OPL delivery RC, AI Runtime Contract, Runtime Bridge local E2E proofs, real-cloud authorization blocker and repo health context
- `node tests/contract/runtime-bridge/contract-test-v22-ai-runtime-contract.mjs`: passed after cannot-claim boundary review and source-owned MCP-compatible shape projection coverage
- `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`: passed
- `node tests/contract/contract-test-v22-spec-eval-traceability.mjs`: passed
- `node tests/smoke/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs`: passed after file/artifact handler owner wiring and runtime-agent relay owner extraction
- `node tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-state-store-atomic-flow.mjs`: passed
- `node tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-launch-mutation-owner-isolation.mjs`: passed after adding Runtime Bridge HTTP helper, contract payload, launch bootstrap projection, message dispatch, file/artifact handler and runtime-agent relay owners
- `node tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-launch-mutation-owner-isolation.mjs`: passed after extracting `runtime-bridge-public-artifacts.mjs` so MCP-compatible shapes, message payloads, file handlers and run API share artifact projection without importing the full run API
- `node tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-local-fake-probe.mjs`: passed after dynamic route matching now passes the configured `dynamicHandlers` list and artifact detail remains covered
- `node tests/regression/portal/regression-test-v22-portal-package-surface-isolation.mjs`: passed after Portal composition root and page action owner cleanup
- `node tests/regression/portal/regression-test-v22-portal-figma-make-interaction-readiness.mjs`: passed after admin model owner split and OPL entry view-state assertions moved to model ownership
- `node tests/regression/portal/regression-test-v22-portal-frontend-surface-composables.mjs`: passed after admin model consolidation, Workspace file view-state owner extraction and AdminUsers filter/wallet payload owner extraction
- `node tests/regression/portal/regression-test-v22-portal-package-surface-isolation.mjs`: passed after retiring unused Figma/shadcn UI source files from the active Portal frontend surface
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: passed with the launch mutation owner isolation regression registered in `local-regression`
- `node tests/health/health-check-v22-smoke-classification-gate.mjs`: passed with 90 classified entries and 29 local-regression entries
- `npm --prefix services/portal/frontend run typecheck`: passed
- `npm run verify:golden-path -- --json`: passed
- `npm run local:services:verify`: passed in dry-run mode
- `npm run local:services:check:dry-run`: passed
- `node tests/contract/contract-test-v22-precloud-deployable-rc.mjs`: passed
- `npm --prefix services/portal run check`: passed
- `npm --prefix services/portal run frontend:typecheck`: passed
- `npm run test:contract -- --json`: passed
- `npm run test:regression -- --json`: passed
- `npm run test:health -- --json`: passed
- `npm run test:smoke -- --json`: passed
- `node tests/health/health-check-v22-line-budget-gate.mjs`: passed after retiring the `runtime-bridge-routes.mjs` line-budget baseline; only `services/opl-web-gateway/src/launch-client-script.mjs` remains locked as an oversized baseline file
- `node scripts/v22-line-budget.mjs`: passed with `runtime-bridge-routes.mjs` under 1000 lines
- `npm run test:contract -- --json`: passed
- `npm run verify -- --json`: passed
- Prior Sentrux diagnostics were retained as repo health context only; Sentrux is no longer a current active truth gate for this package.

## Current Structure Recovery Notes

- Portal frontend pages and `Layout` now depend on their page/layout model owners for query hooks instead of importing `portalQuery` directly; the regression covers overview, resources, workspace, trace, billing, OPL entry, admin pages and layout surfaces.
- Runtime Bridge `runtime-bridge-routes.mjs` no longer owns message payload/status projection helpers; `runtime-bridge-message-payloads.mjs` owns completed-message payload, status payload, timing payload and message extra projection.
- Runtime Bridge now has `runtime-bridge-mcp-compatible-shapes.mjs` as a source-owned local shape-only MCP-compatible projection for runtimeTool, runtimeResource, runtimeRun, runtimeArtifact and runtimeApproval contract tests; it does not start a production MCP server or authorize external clients.
- `contract-test-v22-ai-mvp-readiness-audit.mjs` now records the current AI MVP readiness boundary as machine evidence: local MVP/RC/Runtime proofs are registered, real-cloud authorization remains blocked.
- `tests/fixtures/v22/goal-current.json` now records six-step AI MVP readiness as `local_ai_mvp_readiness_only`; it explicitly keeps `cloud_online_ready` false until the real-cloud authorization, mock/snapshot, readonly quote, dry-run, readonly inventory, authorized create/release, authorized deploy and canary/QA gates run under separate authorization.
- Runtime Bridge now has `runtime-bridge-public-artifacts.mjs` as the shared public artifact projection owner; `runtime-bridge-mcp-compatible-shapes.mjs`, `runtime-bridge-message-payloads.mjs`, `runtime-bridge-files.mjs` and `runtime-bridge-runs.mjs` import that owner instead of making shape-only projection depend on the full run API.
- Runtime Bridge now has `runtime-bridge-launch-lookup.mjs` as the shared launch lookup owner for `runtimeSessionByLaunch` and `runBelongsToLaunch`; `runtime-bridge-routes.mjs` and `runtime-bridge-files.mjs` no longer duplicate those launch/session ownership checks. This improved Sentrux quality from 7175 to 7177 without adding cycles or god files.
- Runtime Bridge `runtime-bridge-routes.mjs` no longer owns HTTP/config helpers, runtime contract payload projection, message dispatch state helpers, file/artifact handlers or runtime-agent relay implementation selection; `runtime-bridge-routes-http.mjs`, `runtime-bridge-contract-payloads.mjs`, `runtime-bridge-message-dispatch.mjs`, `runtime-bridge-files.mjs` and `runtime-bridge-runtime-agent-relay.mjs` own those boundaries.
- Runtime Bridge `runtime-bridge-launch.mjs` no longer owns bootstrap public projection helpers; `runtime-bridge-launch-bootstrap-payloads.mjs` owns public launch/runtime session/workspace/session/message/artifact/progress/run/run-action/trace/cost views.
- Portal admin model ownership is consolidated into `portalAdminOpsModel.ts` for dashboard/alerts/billing ops/audit/system/ops and `portalAdminUsersModel.ts` for users; retired per-page admin model files and `portalAdminSharedModel.ts` no longer exist.
- AdminUsers filtering and recharge/refund payload validation moved from the page into `portalAdminUsersModel.ts`; the page keeps UI input state and mutation wiring.
- Workspace file filtering and downloadable-output view state moved from the page into `portalWorkspaceModel.ts`; the page passes `searchQuery` and renders `buildWorkspaceViewState`.
- Runtime Bridge `runtime-bridge-routes.mjs` is now under the 1000-line line-budget limit, so its previous oversized baseline was retired from `tests/fixtures/v22/line-budget-baseline.json`.
- Two attempted Runtime state-store micro-boundary experiments were measured and stopped: legacy facade slimming and record context aggregation reduced import edges but did not improve Sentrux modularity. Retained Runtime changes are the message payload owner, file/artifact handler owner and runtime-agent relay owner because they improve source ownership without behavior regression.
- A third state-store facade retirement experiment was measured and stopped: removing `state-store.mjs` reduced a high fan-out test facade but lowered Sentrux quality from 7169 to 7167 and modularity from 0.7612 to 0.7593, so the facade was restored.
- A fourth Runtime mode-owner extraction experiment was measured and stopped: moving `isWebuiRuntimeMode` out of `runtime-bridge-routes-http.mjs` lowered Sentrux quality from 7175 to 7174 and modularity from 0.7612 to 0.7611, so the HTTP helper ownership was restored.
- A fifth Portal composition-root API owner experiment was measured and stopped: moving the `RoleProvider` current-user loader from `App.tsx` into `portalLayoutModel.ts` kept the regression and typecheck green but lowered Sentrux quality from 7175 to 7050 and added a `min_depth` violation, so the composition-root binding was restored.
- A sixth isolated Sentrux experiment was measured outside the worktree without sharing `.git`: coarse Runtime Bridge directory regrouping raised modularity only from 0.7605 to 0.7637, still below the old 0.8000 threshold; deleting tests/scripts or changing layer paths did not solve the threshold. Lowering the rule threshold in the isolated copy made `sentrux check .` pass, which confirmed the blocker was rule/baseline alignment rather than a functional regression. After explicit authorization, `.sentrux/rules.toml` now uses a v22 active source model and an evidence-backed baseline.
- Sentrux diagnostics confirm the current graph is directionally clean: cycles remain `0`, god files remain `0`, and `quality_signal=7171`; root-cause scoring identifies equality/modularity as the remaining structural pressure rather than layering inversion.
- Sentrux evidence is retained as optional repo health context, not current runtime truth.

## Plan Completion Audit

functional: partial
code_cleanup: done
docs_foldback: done
verification: partial
retired_entrypoints: done
cannot_claim: done

## Cleanup Result

deleted: none in this package closeout sync
folded: Sentrux wording is folded into repo health context instead of runtime readiness
retained: AI runtime contract remains active authoring work
reason: active runtime work is still not a production or real-cloud readiness claim
next: continue AI runtime contract through its own runtime bridge verification lane

## Can Claim

- AI Runtime Contract and MCP-compatible boundary have a repo-native active package, with local source-owned MCP-compatible shape projection.
- AI MVP readiness has a repo-native no-authorization audit contract that can claim local readiness evidence without upgrading it to production or real-cloud readiness.
- Six-step AI MVP readiness means `local_ai_mvp_readiness_only`, not direct online readiness.
- Runtime Bridge AI runtime adapter layer is the active runtime integration boundary.
- Portal API ownership is cleaner: page/components/context surfaces no longer import Portal API directly.
- Portal query ownership is cleaner: pages and layout use their model-owned hooks instead of importing the generic query hook directly.
- Portal frontend active UI surface is smaller: unused Figma fallback and unused shadcn/ui components are retired.
- Runtime Bridge routes and launch surfaces have thinner owner boundaries; `runtime-bridge-routes.mjs` is no longer a line-budget baseline exception and no longer owns file/artifact handlers or runtime-agent relay implementation selection.
- Runtime Bridge public artifact projection is now isolated from the run API, reducing avoidable coupling for MCP-compatible shape projection and file/message payload surfaces.
- Runtime Bridge launch lookup duplication is removed from routes/files and covered by the launch mutation owner isolation regression.
- This package keeps repo health context separate from runtime readiness claims.

## Cannot Claim

- Production MCP server, external MCP clients, real cloud, deploy, kubectl, build/push, live-test or production runtime readiness is authorized or verified.
- Six-step AI MVP readiness does not authorize real_cloud_ready, production_online, deploy_ready, secret_authorized or live_test_authorized claims.
- Any secret, provider credential, raw provider key, cloud resource, billing reconciliation or runtime deployment has been validated.
- Production, real-cloud or deploy readiness is implied by local repo health signals.

## Next Structure Cursor

- Continue Portal/Runtime modularity recovery as a dedicated structural lane. The next candidate should target coherent owner extraction from large active surfaces rather than additional state-store micro-facades.
- Prior Sentrux diagnostics remain archive provenance and optional repo health context, not source truth ownership for this active runtime package.
- Highest-risk size hotspots still include `services/portal/frontend/src/app/pages/admin/AdminUsers.tsx`, `services/opl-runtime-bridge/src/runtime-bridge-routes.mjs`, `services/opl-runtime-bridge/src/runtime-bridge-launch.mjs`, `services/portal/frontend/src/app/pages/Workspace.tsx`, `services/portal/frontend/src/app/pages/OPLEntry.tsx`, `services/portal/frontend/src/app/pages/Overview.tsx`, `services/portal/frontend/src/app/pages/TasksResults.tsx`, `services/portal/frontend/src/app/pages/BillingAudit.tsx`, `services/opl-runtime-bridge/src/opl-client.mjs` and `services/opl-runtime-bridge/src/opl-webui-bridge-client.mjs`.

## Archive Target

- changes/archive/YYYY-MM-DD-ai-runtime-contract

## History Handoff

- docs/history/README.md

## Next Owner

- MedOPL Runtime Bridge
