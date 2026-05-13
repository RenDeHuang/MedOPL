# MedOPL v22 Current vs Ideal Gap Matrix

Every gap below is part of the product-goal harness, not a free-form roadmap. Each gap must have an eval. 每个 gap 必须有 eval；没有 eval 的 gap 不得实现，状态只能是 needs_eval，下一步只能是 write_eval_shell。

Allowed status values: `open`, `in_progress`, `needs_eval`, `gated`, `cleaned`, `deferred_authorized`.

## Gap Field Schema

Every gap entry must contain:

- id:
- current_fact:
- ideal_state:
- problem:
- dependency:
- status:
- next_leaf_step:
- eval:
- allowed_files:
- forbidden_files:
- truth_writeback_target:
- B_absorb_criteria:

## Gap Entries

### Gap: legacy-cleanup-user-owned

- id: legacy-cleanup-user-owned
- current_fact: default entry and primary path have been retired into platform-provisioned semantics; retained `user_owned` is legacy alias only.
- ideal_state: no new implementation, doc, eval, or product language treats `user_owned` as user-owned cloud resource configuration.
- problem: prevent user-owned meaning from returning through active docs or tests.
- dependency: default-entry cleanup and user_owned primary path retirement absorbed.
- status: cleaned
- next_leaf_step: monitor_only_after_B_absorb
- eval: `node scripts/smoke-test-v22-default-entry-narrative-gate.mjs`
- allowed_files: `docs/recovery/*`, `scripts/smoke-test-v22-*`
- forbidden_files: `services/*`, `deploy/*`, `adapters/*`, `.sentrux/*`, `.env.demo.template`, upstream one-person-lab
- truth_writeback_target: `docs/recovery/status-matrix.md`, `docs/recovery/v22-goal-state.md`
- B_absorb_criteria: B reruns eval, confirms no `user_owned` primary meaning, then ff-only absorbs and pushes before cursor moves.

### Gap: legacy-cleanup-resource-order

- id: legacy-cleanup-resource-order
- current_fact: resource-order route tombstones, billing/payload rewrite, store/admin/frontend third slice, store/Postgres/schema characterization, and fourth-slice active runtime persistence retirement are complete. Resource-order remains only retired/tombstone/migration-only in store/Postgres/schema surfaces.
- ideal_state: managed environment/resource binding/billing/audit is the only active resource attribution path.
- problem: prevent resource-order persistence from returning as active runtime truth while retaining migration-only legacy tables/collections until a later schema-drop/archive leaf proves it is safe.
- dependency: route, billing/payload, store/admin/frontend cleanup absorbed.
- status: cleaned
- next_leaf_step: monitor_only_after_B_absorb
- eval: `node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs`; store/Postgres/schema retired-active-runtime facts are covered by `node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs` and dedicated static gate `node scripts/smoke-test-v22-resource-order-store-postgres-characterization.mjs`
- allowed_files: `services/portal/src/state/portal-resource-order-store.mjs`, `services/portal/src/state/portal-store-schema.mjs`, `services/portal/src/state/portal-store-postgres-persistence.mjs`, `services/portal/src/state/portal-store-postgres-write-snapshot-helpers.mjs`, `services/portal/src/state/portal-store-runtime-connections.mjs`, `services/portal/src/state/portal-store-storage-bootstrap.mjs`, `services/portal/src/app/portal-store-runtime.mjs`, `services/portal/src/state/portal-store-db-delegates.mjs`, relevant v22 smoke and recovery docs for monitoring or a future dedicated schema-drop/archive leaf
- forbidden_files: `deploy/*`, `adapters/*`, `.sentrux/*`, `.env.demo.template`, upstream one-person-lab, unrelated frontend
- truth_writeback_target: `docs/recovery/legacy-cleanup-backlog.md`, `docs/recovery/repo-zoning.md`, `docs/recovery/v22-goal-state.md`
- B_absorb_criteria: B confirms the characterization gate now describes retired active runtime behavior, resource binding replacement path stays green, no route success path returns, no active runtime resource-order store/Postgres read/write remains, and fourth-slice implementation did not run real DB/cloud operations.

### Gap: legacy-cleanup-secret-hygiene

- id: legacy-cleanup-secret-hygiene
- current_fact: workflow gate has path-level secret-like checks; reusable local diff-scoped sensitive hygiene eval now proves changed-files / added-lines scanning without reading real secret-like paths.
- ideal_state: B always runs changed-files / added-lines diff-scoped secret scan before absorb; full-repo secret scan is read-only audit only.
- problem: secret hygiene can degrade if B relies only on broad scans or path names.
- dependency: product-goal harness absorbed.
- status: gated
- next_leaf_step: monitor_only_after_B_absorb
- eval: `node scripts/smoke-test-v22-diff-scoped-sensitive-hygiene.mjs`
- allowed_files: `scripts/smoke-test-v22-*`, `docs/recovery/*`
- forbidden_files: `.env*`, secret files, kubeconfig, `deploy/*`, `adapters/*`, `.sentrux/*`
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, `docs/recovery/status-matrix.md`
- B_absorb_criteria: B confirms changed-files / added-lines diff-scoped sensitive hygiene scan is mandatory, path-level fail-closed checks still block secret-like paths, and no secret content is read.

### Gap: legacy-cleanup-legacy-scripts

- id: legacy-cleanup-legacy-scripts
- current_fact: v19/v20/v21/live-test scripts remain archive/reference, not default validation; `scripts/smoke-test-v22-legacy-script-archive-boundary.mjs` now gates default docs and MVP suite against legacy script re-entry.
- ideal_state: default execution line uses only v22 local smoke unless a canary is explicitly authorized.
- problem: old scripts can re-enter AI context as default truth.
- dependency: secret hygiene eval shell absorbed; archive boundary gate exists and is runnable locally.
- status: gated
- next_leaf_step: monitor_only_after_B_absorb
- eval: `node scripts/smoke-test-v22-legacy-script-archive-boundary.mjs`
- allowed_files: `docs/recovery/*`, `scripts/smoke-test-v22-legacy-script-archive-boundary.mjs`, branch-scoped harness allowlist updates
- forbidden_files: `scripts/live-test-*`, `scripts/smoke-test-v19-*`, `scripts/smoke-test-v20*`, `scripts/smoke-test-v21-*` unless archiving is explicitly scoped
- truth_writeback_target: `docs/recovery/legacy-cleanup-backlog.md`, `docs/recovery/v22-goal-state.md`
- B_absorb_criteria: B verifies MVP suite does not include old scripts and no live-test is run.

### Gap: architecture-refactor-portal-layering

- id: architecture-refactor-portal-layering
- current_fact: Portal structure/failure isolation contract exists and now characterizes the current backend route/app/domain/state and frontend view/composable/API module anchors. Current code shape includes a large backend composition root, some route-to-state direct imports, domain modules that include payload/provider bridge semantics, frontend API barrel retained as non-page-default, harness renderer as a cross-domain registry, and admin views that partly call admin API directly.
- ideal_state: backend route -> app payload -> domain -> state/persistence and frontend view/composable/API module boundaries are enforceable by characterization gates.
- problem: refactors can move behavior without proving contract parity.
- dependency: cleanup of resource-order store/Postgres/schema should land first for related surfaces.
- status: gated
- next_leaf_step: monitor_only_after_B_absorb
- eval: `node scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs`
- allowed_files: `docs/contracts/v22-portal-structure-failure-isolation-boundary.md`, `docs/recovery/*`, `scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs`, branch-scoped harness allowlist updates; future implementation refactor branches under `services/portal/**` must be separate leaf steps
- forbidden_files: `deploy/*`, `adapters/*`, `.sentrux/*`, `.env.demo.template`, upstream one-person-lab
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, `docs/contracts/v22-portal-structure-failure-isolation-boundary.md`
- B_absorb_criteria: B reruns characterization gate and confirms no product behavior drift.

### Gap: opl-connection-gateway-preflight-runtime-file-run-artifact-trace

- id: opl-connection-gateway-preflight-runtime-file-run-artifact-trace
- current_fact: local contracts prove Gateway/preflight/Runtime Bridge, selected file/run/artifact gates, and a local OPL productionization eval shell. Production connection is not fully live.
- ideal_state: Portal -> Gateway -> clean upstream OPL -> Runtime Agent -> file/run/artifact -> Portal trace works without fake 200.
- problem: canary facts must not become production truth without productionized branch absorption.
- dependency: OPL capability and file/run/artifact contracts.
- status: in_progress
- next_leaf_step: leaf-opl-connection-productionization-local-implementation
- eval: `node scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs`, `node scripts/smoke-test-v22-opl-productionization-eval-shell.mjs`, `node scripts/smoke-test-v22-real-opl-file-run-artifact-gates.mjs`, `node scripts/smoke-test-v22-real-opl-file-run-artifact-runtime-agent-api-loop.mjs`
- allowed_files: local OPL productionization implementation only under `services/portal/src/routes/opl.routes.mjs`, `services/portal/src/routes/portal-api-v22-opl-work.routes.mjs`, `services/portal/src/domain/opl-work-flow.mjs`, `services/opl-runtime-bridge/src/runtime-bridge-routes-http.mjs`, `services/opl-runtime-bridge/src/runtime-agent-http-relay.mjs`, `services/opl-runtime-bridge/src/runtime-bridge-runs.mjs`, `services/opl-runtime-bridge/src/runtime-bridge-messages.mjs`, `services/opl-runtime-bridge/src/runtime-bridge-launch-scope.mjs`, `services/opl-runtime-bridge/src/run-contract.mjs`, OPL productionization smokes, and scoped recovery truth writeback
- forbidden_files: upstream one-person-lab, `deploy/*` without authorization, raw provider key paths
- truth_writeback_target: `docs/recovery/real-opl-file-run-artifact-validation-path.md`, `docs/recovery/status-matrix.md`, `docs/recovery/v22-goal-state.md`
- B_absorb_criteria: B confirms clean upstream one-person-lab boundary, no fake success path, no Package D owner-field leakage, no raw secret/token/storage/path leakage, no canary-only production claim, and no secret/live/cloud/deploy/upstream operation.

### Gap: cloud-lane-mock-readonly-dry-run-authorized

- id: cloud-lane-mock-readonly-dry-run-authorized
- current_fact: Cloud lane contracts define mock -> readonly -> dry-run -> authorized create/release, with real operations separately authorized.
- ideal_state: production cloud lifecycle follows authorized gates, secret allowlists, billing checks, rollback, and audit without exposing cloud console language to users.
- problem: cloud facts and Portal product facts can be mixed if authorization boundaries are not explicit.
- dependency: cloud onboarding workflow boundary.
- status: deferred_authorized
- next_leaf_step: leaf-cloud-lane-readonly-status-audit
- eval: `node scripts/smoke-test-v22-cloud-onboarding-workflow-contract.mjs`
- allowed_files: cloud-lane contract/docs/smoke in a dedicated authorized branch
- forbidden_files: `deploy/*`, `.env*`, kubeconfig, true cloud runners unless explicitly authorized
- truth_writeback_target: `docs/recovery/cloud-onboarding-status-table.md`, `docs/recovery/v22-goal-state.md`
- B_absorb_criteria: B confirms no true cloud operation ran without authorization and any risky leaf step has step-local auth record, minimum spend, baseline, cleanup evidence, owner guard, and failure truth writeback.

truth writeback section:

- leaf-resource-order-store-postgres-schema-implementation: active `portal-resource-order-store` is now fail-closed retired API surface; runtime connections, storage bootstrap, db delegates, and Postgres snapshot read/write no longer instantiate or call resource-order store or `resource_orders` / `resource_order_events` active queries/writers. Legacy tables, snapshot helper functions, and JSON migration collection keys remain migration-only/tombstone facts. Verification passed locally with resource-order characterization, resource-order retirement gate, Portal check, product-goal harness, default-entry gate, MVP suite, workflow review, scoped node --check, and diff whitespace check. Failure analysis classified initial branch allowlist failures as `eval_wrong` / `leaf2_branch_subscription_missing`; exact branch-scoped allowlists were updated, including `portal-store-storage-bootstrap.mjs` because it was part of active runtime bootstrap.
- leaf-secret-hygiene-diff-scan-eval-shell: `scripts/smoke-test-v22-diff-scoped-sensitive-hygiene.mjs` added a reusable local eval using a temporary git repo. It proves added-line sensitive-value detection, unchanged historical content exclusion, secret-like path content skipping, and workflow path-gate fail-closed behavior without reading real `.env`, secret, kubeconfig, token, or key files. The eval filename intentionally avoids `secret` to prevent the path-level fail-closed gate from treating the eval file itself as a secret-like path.
- leaf-legacy-scripts-archive-eval-shell: `scripts/smoke-test-v22-legacy-script-archive-boundary.mjs` is absorbed as the legacy script archive boundary eval. It checks README and `docs/vibe-coding.md` code blocks, enforces MVP suite references to `scripts/smoke-test-v22-*`, and verifies `docs/recovery/repo-zoning.md` archive/review-rewrite rows for v19/v20/v21/live-test/check legacy script families. No live-test was run, no legacy script was deleted or modified, and no service/deploy/adapter/upstream/package/secret path was touched.
- leaf-portal-layering-characterization-gate: `scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs` now validates `currentPortalCodeShape` in the Portal structure contract. It pins stable backend route/app/domain/state anchors, frontend view/composable/API anchors, smoke-layer files, and known future refactor risks without changing Portal business code. Future refactor truth recorded: `portal-runtime.mjs` is a large composition root, `platform-provisioned-resource.routes.mjs` still has route-to-state direct import shape, some domain modules include payload/provider bridge semantics, app layer mixes orchestration and view-model payload builders, `services/portal/frontend/src/api/portal.ts` remains a non-default barrel, `PortalComponentFixtureRenderer.vue` is a large cross-domain harness registry, admin views are not uniformly composable-based, and retired `resource-order` / `user-owned` tombstones remain controlled legacy guards.
- leaf-opl-connection-productionization-contract-refresh: `scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs` gates contract_refresh_only OPL productionization handoff status. Local Runtime Agent HTTP API relay full-loop and WebUI bridge no-fake-success gates are absorbed only as canary facts; provider message reply remains message/reply only. Real cloud runtime, COS billing reconciliation, Langfuse / `trace.medopl.cn`, one-person-lab HTTP Product API, deploy owner fields, Package D owner labels, raw provider key, tokens, object/storage keys, local paths, and signed URLs remain outside OPL production truth until separately authorized and productionized.
- next executable OPL leaf: `leaf-opl-connection-productionization-eval-shell` must create a local eval shell before any production implementation. It may only prove allowed OPL-lane production inputs and block canary-only production claims, fake success, raw secret/token/storage leakage, upstream modification, cloud/deploy owner-field leakage, and unauthorized cloud/deploy operations.
- leaf-opl-connection-productionization-eval-shell: `scripts/smoke-test-v22-opl-productionization-eval-shell.mjs` now provides the local eval shell for the next OPL production implementation. It reads only repo-tracked contracts/recovery/gates, asserts OPL projection inputs are limited to `resourceBindingId`, `billingMetadataRef`, `usageMetadataRef`, `fileRef`, `runId`, `artifactRef`, and `outputFileRef`, and fail-closes on Package D owner fields, raw key/token/storage/path leakage, fake success, upstream drift, and canary evidence promoted to production truth.
- leaf-opl-connection-productionization-eval-shell B absorbed on `6a939de05efa8967fa2b0bf8da3c53768471fc89`. The next executable OPL leaf is `leaf-opl-connection-productionization-local-implementation`: a local-only implementation slice that may productionize repo-local Portal/Adapter/Runtime Bridge projection boundaries, but must not read secret, call a live provider, call true cloud, build/push/kubectl, deploy, modify upstream, or claim real cloud/COS/Langfuse production truth.
- Authorization model: Global authorization 只授权 Codex 按 product-goal harness 连续推进 leaf steps；Global authorization 不等于直接授权所有未来 secret/live/cloud/kubectl/build/push/deploy 动作。
- No auth record means the risky step remains deferred_authorized.
- Cloud live baseline / cleanup / minimum spend policy requires desired/current baseline 应为 2，且测试后必须回到 2.
- cleanup evidence must prove created resources, released resources, remaining resources, baseline after cleanup, active operations count, and billing/reconciliation status.
- Owner guard: 任何无法证明 ownerRef/resourceBindingId/workspaceId/operationId 的资源，不得删除，只能记录 blocker。
- Failure truth writeback must record failed_step_id, failed_gate, attempt_count, failure_category, evidence_path, suspected_root_cause, whether_contract_wrong, whether_eval_wrong, whether_problem_should_split, whether_authorization_required, and next_recommended_action.

### Gap: frontend-product-vue-vite-ts-pinia

- id: frontend-product-vue-vite-ts-pinia
- current_fact: Portal UI MVP exists; future frontend completion must preserve Vue 3 + Vite + TypeScript + Pinia contracts.
- ideal_state: user loop, admin, mobile/table usability, empty/loading/error states, and API contracts are eval-covered.
- problem: visual or API changes can ship without responsive or component-state verification.
- dependency: current Portal UI contracts.
- status: open
- next_leaf_step: leaf-frontend-product-evalset-gap
- eval: `node scripts/smoke-test-v22-portal-frontend-surface-composables.mjs`
- allowed_files: future frontend branch under `services/portal/frontend/**` plus evalset/smoke
- forbidden_files: `deploy/*`, `adapters/*`, `.sentrux/*`, `.env.demo.template`
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, Portal UI contracts
- B_absorb_criteria: B requires API contract, component states, mobile/table responsive evidence, and typecheck.

### Gap: backend-product-node22-esm-layering

- id: backend-product-node22-esm-layering
- current_fact: backend baseline uses Node 22 ESM and route/app/domain/state/persistence conventions across Portal services.
- ideal_state: every backend change has route smoke, payload/domain contract smoke, node --check or npm check, and workflow gate coverage.
- problem: route logic can bypass app/domain/state layering or hide missing fields behind fallback/shim.
- dependency: Portal structure contract.
- status: open
- next_leaf_step: leaf-backend-contract-eval-template
- eval: `node scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs`
- allowed_files: future backend branch under `services/portal/**` plus smoke
- forbidden_files: implicit fallback/shim, `user_owned` primary path, `resource-order` primary path, OpenCost/Langfuse main path
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, backend contracts
- B_absorb_criteria: B confirms route -> app payload -> domain -> state/persistence and no hidden fallback.

### Gap: billing-audit-preauth-ledger-release-t1

- id: billing-audit-preauth-ledger-release-t1
- current_fact: contract-level release stop billing and audit flow exists.
- ideal_state: preauth, ledger, release stop billing within 120 minutes, and T+1 audit are production-ready and traceable.
- problem: billing truth can be confused with trace metadata, Langfuse, or cloud raw facts.
- dependency: managed environment/resource binding and cloud lane facts.
- status: gated
- next_leaf_step: leaf-billing-audit-characterization
- eval: `node scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs`
- allowed_files: future billing branch and v22 billing smoke
- forbidden_files: OpenCost primary narrative, Langfuse billing truth, real cloud mutation without authorization
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, billing contracts
- B_absorb_criteria: B confirms release stops charging and audit record exists without treating observability as billing truth.

### Gap: release-readiness-authorized-deploy-only

- id: release-readiness-authorized-deploy-only
- current_fact: deploy/build/push/kubectl/live-test are outside default development and require explicit authorization.
- ideal_state: release readiness is evaluated only after contracts, local suite, secret scan, and authorized deploy plan pass.
- problem: deploy readiness can be falsely inferred from local smoke.
- dependency: product e2e, cloud lane, OPL connection, billing/audit.
- status: deferred_authorized
- next_leaf_step: leaf-release-readiness-auth-boundary
- eval: `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- allowed_files: docs/recovery and future authorized deploy contracts
- forbidden_files: `deploy/*`, build/push/kubectl/live-test without explicit authorization
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, deploy contracts
- B_absorb_criteria: B confirms release readiness does not execute deploy unless authorized.

### Gap: dependency-modernization-node24-vite-vitest-readiness

- id: dependency-modernization-node24-vite-vitest-readiness
- current_fact: current baseline is Node 22 ESM with Vue 3 + Vite + TypeScript + Pinia; this branch does not upgrade dependencies.
- ideal_state: Node 24 Active LTS migration readiness and Vite/Vitest modernization readiness are tracked as future eval-backed gaps.
- problem: dependency upgrades can mix with product harness and destabilize unrelated lanes.
- dependency: product-goal harness only records the future gap.
- status: needs_eval
- next_leaf_step: write_eval_shell
- eval: future dependency readiness characterization gate; no upgrade in this branch
- allowed_files: future dedicated modernization contract/eval branch
- forbidden_files: `package.json`, lockfiles, service dependency files in this harness branch
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, future modernization contract
- B_absorb_criteria: B confirms Node 24 / Vite / Vitest modernization 只作为 future gap，不在本分支升级。
