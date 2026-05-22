# History Truth

Owner: `MedOPL`
Purpose: `history_evidence_index`
State: `active`
Machine boundary: 本文是历史和证据入口，不是 current truth。当前事实看 `docs/active/README.md`；合同看 `docs/specs/README.md`；机器 cursor 和 verify manifest 看 `tests/fixtures/v22/*`。

## Scope

History 承接：

- agent-run evidence 摘要
- landing gate / landed / post-push records 摘要
- cleanup closeout
- superseded stage boards 摘要
- provenance and cleanup summaries

## Agent Run Schema

每条 agent-run 摘要必须记录：

- date
- run_type
- branch
- base trunk HEAD
- model
- subagents and model
- subscribed truth/spec/policy files
- commits
- verification commands and result
- landing gate result when landed
- non-goals
- risk notes
- next recommendation

landed 后的记录还必须补齐：

- landed_commit
- landing_gate_result
- post_push_verification
- post_merge_closeout
- next_cursor

`ready_for_landing_review` 只能出现在未 landed 的 authoring branch handoff 中。landing gate 已 ff-only merge 并 push 后，history 摘要必须改为 `landed / pushed / post-push verified`。历史细节不再展开成独立 `agent-runs/` 文件；详细证据以 git history 和 landing gate 输出为准。

## Tombstone Map

| Cleanup path or pattern | Cleanup reason | Current owner | Must not return as |
| --- | --- | --- | --- |
| distributed contract leaf docs | distributed contract leaves were absorbed into single specs truth | `docs/specs/README.md` | current contract leaf tree, compatibility alias, default verification input |
| recovery process docs | recovery process docs were absorbed into active/history taxonomy | `docs/active/README.md`, `docs/history/README.md` | current truth tree, agent-run archive tree, stage board |
| legacy root product doc | product truth moved into taxonomy views | `docs/product/README.md`, `docs/active/README.md` | second product truth or root entrypoint |
| legacy root architecture doc | architecture truth moved into runtime/source/specs views | `docs/runtime/README.md`, `docs/source/README.md`, `docs/specs/README.md` | second architecture truth |
| legacy root status doc | current status moved into active truth and machine cursor | `docs/active/README.md`, `tests/fixtures/v22/goal-current.json` | second current status board |
| legacy root invariants doc | durable invariants moved into policies/specs | `docs/policies/README.md`, `docs/specs/README.md` | root governance doc |
| legacy root decisions doc | decisions are now summarized by landed run history | `docs/history/README.md` | rolling decision log that overrides current truth |
| legacy root vibe-coding doc | agent workflow discipline moved into policies and AGENTS | `AGENTS.md`, `docs/policies/README.md` | default workflow entrypoint |
| `scripts/smoke-test-*` | eval files moved to `tests/**`, scripts reduced to runner/classifier/workflow | `tests/**`, `scripts/v22-verify.mjs` | repo-local eval location, compatibility script family |

## Current Run Summaries

详细过程证据以 git history 为准。本文件只保当前可审摘要，不再保 shadow archive。

### 2026-05-22 feat/v22-backend-go-convergence-program stage-1

Status: `ready_for_landing_review`

Branch: `feat/v22-backend-go-convergence-program`

Base trunk HEAD: `82bbf09e3bdfd2d2f4f746353ec9b9fa3cc5eb7f`

Model:

- controller: `gpt-5 runtime`
- subagent Sartre: `gpt-5.4`, read-only docs taxonomy and backend convergence program placement review.
- subagent Poincare: `gpt-5.4`, read-only current backend responsibility drift review.
- subagent Lagrange: `gpt-5.4`, read-only Go backend active-surface and gate design review.
- subagent Kuhn: `gpt-5.4`, read-only Step 4/5 responsibility inventory and migration-map design.
- subagent McClintock: `gpt-5.4`, read-only Step 8-10 Go scaffold, Ent/Postgres and Redis boundary design.

Scope:

- Register the backend Go convergence authoring lane without replacing the current `real-cloud-authorization-boundary` product cursor.
- Define `services/medopl-go-backend` as the future canonical backend target while keeping `services/portal` as the migration-period active implementation.
- Align runtime and source views on the target structure: Portal Control Plane -> Workflow Boundary -> Runtime Broker / OPL Bridge -> Agent Runtime -> Cloud / Billing / Audit Workers.
- Keep the 7 phases as compact machine truth, spec anchor, registered tests and history summary; do not restore old contracts, recovery docs or smoke script families.

Commits:

- `6b0f6fc docs(v22): register backend go convergence program`
- `6c384b6 docs(v22): define go backend convergence boundary`
- `79fe703 docs(v22): align backend convergence runtime and source views`

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/specs/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`

Verification before landing review:

- `node tests/contract/contract-test-v22-backend-go-convergence-program.mjs`
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`
- `node scripts/v22-verify.mjs package backend-go-convergence --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs current --branch feat/v22-backend-go-convergence-program --base origin/recovery/platform-v22-trunk --dry-run --json`
- `git diff --check -- docs tests scripts package.json`

Non-goals:

- No business service migration in stage 1.
- No production Go backend claim.
- No secret read, live cloud call, build/push, kubectl, deploy or live-test.
- No upstream, deploy, `.sentrux`, `adapters`, `infra` or `.runtime` edits.
- No restored `docs/contracts/**`, `docs/recovery/**`, old stage board or `scripts/smoke-test-*`.

Risk notes:

- Current Node Portal remains heavier than the target structure; stage 2 must make that drift machine-readable before implementation.
- `services/medopl-go-backend` is still a future target and must enter active surface only through manifest, registered tests, workflow review and package verification.

Landing gate recommendation:

- Continue authoring branch to stage 2 before asking for final branch landing. If landing gate reviews stage 1 in isolation, the diff is local docs/tests/fixtures only and does not advance the product cursor.

Next recommendation:

- Proceed to stage 2: classify current Portal, Gateway and Runtime Bridge responsibilities, then map Node files to Go target modules before touching service behavior.

### 2026-05-22 feat/v22-backend-go-convergence-program stage-2

Status: `ready_for_landing_review`

Branch: `feat/v22-backend-go-convergence-program`

Base trunk HEAD: `82bbf09e3bdfd2d2f4f746353ec9b9fa3cc5eb7f`

Model:

- controller: `gpt-5 runtime`
- subagent Kuhn: `gpt-5.4`, read-only Step 4/5 responsibility inventory and migration-map design.
- subagent McClintock: `gpt-5.4`, read-only Step 8-10 Go scaffold, Ent/Postgres and Redis boundary design.

Scope:

- Classify all active backend `.mjs` files under `services/portal/src`, `services/opl-web-gateway/src` and `services/opl-runtime-bridge/src`.
- Add a machine-readable backend inventory fixture covering 180 active backend source files.
- Add a machine-readable Node-to-Go migration map covering risky `misplaced` and `delete-later` files.
- Register both gates in the test lane registry, current/local-contract/review suites and backend convergence package.

Commits:

- `ad7d7ec docs(v22): classify backend responsibilities for go convergence`
- `ee32f0d docs(v22): map node backend files to go target modules`

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/specs/README.md`
- `docs/source/README.md`
- `docs/delivery/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `tests/fixtures/v22/backend-go-convergence/backend-inventory.json`
- `tests/fixtures/v22/backend-go-convergence/migration-map.json`

Verification before landing review:

- `node tests/contract/contract-test-v22-backend-responsibility-inventory.mjs`
- `node tests/contract/contract-test-v22-node-to-go-migration-map.mjs`
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`
- `node scripts/v22-verify.mjs package backend-go-convergence --base origin/recovery/platform-v22-trunk --json`
- `git diff --check -- docs tests scripts package.json`

Non-goals:

- No service behavior change in stage 2.
- No production Go backend claim.
- No secret read, live cloud call, build/push, kubectl, deploy or live-test.
- No upstream, deploy, `.sentrux`, `adapters`, `infra` or `.runtime` edits.
- No restored `docs/contracts/**`, `docs/recovery/**`, old stage board or `scripts/smoke-test-*`.

Risk notes:

- Inventory and migration map expose current responsibility drift but do not fix it yet.
- Stage 3 must turn the highest-risk drift into explicit gates before implementation: Portal long task truth, cloud mutation, memory launch status, billing/audit aggregation and runtime bridge token/secret boundaries.

Landing gate recommendation:

- Continue authoring branch to stage 3 before final landing so the inventory can immediately drive enforcement gates.

Next recommendation:

- Proceed to stage 3: add contract/regression gates for Portal long task mutation boundaries, then introduce a workflow facade in Node Portal without changing user-visible API contracts.

### 2026-05-22 feat/v22-backend-go-convergence-program stage-3

Status: `ready_for_landing_review`

Branch: `feat/v22-backend-go-convergence-program`

Base trunk HEAD: `82bbf09e3bdfd2d2f4f746353ec9b9fa3cc5eb7f`

Model:

- controller: `gpt-5 runtime`
- subagent Carver: `gpt-5.4`, read-only Step 7 Node Portal workflow facade minimal-boundary review.

Scope:

- Gate the dangerous Node Portal responsibility drift before broad migration: Portal long task mutation, cloud operation mutation, in-memory OPL launch truth, billing/audit aggregation and Runtime Bridge token/secret boundaries.
- Introduce `services/portal/src/services/portal-workflow-facade.service.mjs` as the migration-period command handoff facade.
- Route OPL launch, OPL native login launch, lab package activate/upgrade cloud bridge calls and v22 cloud operation mutation routes through the workflow facade without changing user-visible API paths, DTOs or cookie semantics.
- Update backend responsibility inventory and Node-to-Go migration map so the new facade is a tracked workflow boundary and future Go target maps to `internal/domain/workflow + internal/service/workflow`.

Commits:

- `5a883d9 docs(v22): align portal user provider status contract`
- `3a68e60 test(v22): gate portal long task mutation boundaries`
- `3ad6607 refactor(v22): introduce node portal workflow facade boundary`

Contract subscription:

- `AGENTS.md`
- `docs/active/README.md`
- `docs/specs/README.md`
- `docs/source/README.md`
- `docs/delivery/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `tests/fixtures/v22/backend-go-convergence/backend-inventory.json`
- `tests/fixtures/v22/backend-go-convergence/migration-map.json`

Verification before landing review:

- `node tests/contract/contract-test-v22-portal-long-task-mutation-boundaries.mjs`
- `node tests/contract/contract-test-v22-node-portal-workflow-facade-boundary.mjs`
- `node tests/contract/contract-test-v22-backend-responsibility-inventory.mjs`
- `node tests/contract/contract-test-v22-node-to-go-migration-map.mjs`
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`
- `node tests/regression/runtime-bridge/regression-test-v22-portal-runtime-bridge-api-local-flow.mjs`
- `node tests/regression/opl/regression-test-v22-opl-entry-preflight-auth-flow.mjs`
- `node tests/regression/portal/regression-test-v22-portal-runtime-suite.mjs --group all`
- `node scripts/v22-verify.mjs package backend-go-convergence --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `npm --prefix services/portal run check`
- `git diff --check -- docs tests scripts package.json services/portal/src`

B review pack:

- `git diff --stat`: 25 files changed from trunk at stage handoff, including Stage 1-3 docs/tests/fixtures and the Step 7 Portal facade implementation.
- `git show --name-only --oneline HEAD`: `3ad6607 refactor(v22): introduce node portal workflow facade boundary`.
- Secret hygiene: review gate reported no secret-like paths and no secret-like added lines.
- Pollution check: no `deploy/*`, `.sentrux/*`, `adapters/*`, `infra/*`, upstream, `.runtime/*`, secret path, real cloud, build/push, kubectl, deploy or live-test operation.
- Product narrative check: no restored `user_owned`, `resource-order`, old runner/provisioner, OpenCost or Langfuse primary narrative.
- Fake success check: workflow facade preserves executor result; business failure results mark command state failed without converting the public result to success.
- Landing recommendation: continue authoring branch to Stage 4 before final branch landing; B can review Stage 3 as ff-only absorbable if asked.

Non-goals:

- No Temporal, LangGraph or durable engine dependency in Stage 3.
- No Go backend scaffold yet.
- No production backend claim.
- No user-visible API contract change.
- No secret read, live cloud call, build/push, kubectl, deploy or live-test.
- No upstream, deploy, `.sentrux`, `adapters`, `infra` or `.runtime` edits.
- No restored `docs/contracts/**`, `docs/recovery/**`, old stage board or `scripts/smoke-test-*`.

Risk notes:

- Node Portal still owns migration-period execution of the facade; durable semantics are intentionally behind the facade and not claimed by Stage 3.
- Existing OPL launch in-memory status remains visible and gated as migration debt; the new facade prevents further route-level expansion before the Go workflow boundary lands.
- Stage 4 must introduce the Go service as future canonical target without claiming production replacement and without connecting to real Postgres or Redis by default.

Next recommendation:

- Proceed to Stage 4: scaffold `services/medopl-go-backend`, add Ent/Postgres schema baseline and enforce Redis volatile-only boundaries with Go tests and manifest/package gates.

### 2026-05-22 feat/v22-backend-go-convergence-program stage-4

Status: `ready_for_landing_review`

Branch: `feat/v22-backend-go-convergence-program`

Base trunk HEAD: `82bbf09e3bdfd2d2f4f746353ec9b9fa3cc5eb7f`

Model:

- controller: `gpt-5 runtime`
- subagent Bacon: `gpt-5.4`, read-only Stage 4 Step 8-10 Go scaffold, Ent/Postgres and Redis boundary review.
- subagent Cicero: `gpt-5.4`, read-only Step 9 Ent/Postgres contract compliance review.
- subagent Descartes: `gpt-5.4`, read-only Step 9 Go schema quality and pollution-risk review.
- subagent Aquinas: `gpt-5.4`, read-only Step 9 schema/migration consistency re-review.
- subagent Linnaeus: `gpt-5.4`, read-only Step 9 codegen and migration consistency re-review.
- subagent Socrates: `gpt-5.4`, read-only Step 9 final review after Ent codegen gate was added.
- subagent Sagan: `gpt-5.4`, read-only Step 10 Redis volatile-only boundary review.
- subagent Feynman: `gpt-5.4`, read-only Step 10 TTL fail-closed re-review.

Scope:

- Scaffold `services/medopl-go-backend` as a future canonical backend target with Go 1.22, Gin, `cmd/server`, config loading, server/router wiring and deterministic `/health`, `/version` and `/config/check` handlers.
- Add an Ent/PostgreSQL baseline for `tenant`, `user`, `workspace`, `run`, `artifact`, `file`, `billing_event` and `workflow_execution` without connecting to real PostgreSQL.
- Keep PostgreSQL as canonical truth direction and keep SQL baseline deterministic/repeatable while avoiding empty-string absence encoding and secret/blob locator fields.
- Add a volatile repository boundary for session/cache/queue/lock only, backed by a local memory implementation for tests; no real Redis client and no `internal/repository/redis` truth source.
- Register Go service surface, Ent/Postgres and Redis volatile boundary gates in test classification, manifest suites, branch override and backend convergence package.

Commits:

- `13cd7e6 feat(go): scaffold medopl go backend`
- `369f35d feat(go): add ent postgres schema baseline`
- `1bb9869 feat(go): add redis volatile state boundary`

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/specs/README.md`
- `docs/source/README.md`
- `docs/runtime/README.md`
- `docs/delivery/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-test-classification.mjs`
- `services/medopl-go-backend/**`

Verification before landing review:

- `node tests/contract/contract-test-v22-go-backend-service-surface.mjs`
- `node tests/contract/contract-test-v22-go-backend-ent-postgres-boundary.mjs`
- `node tests/contract/contract-test-v22-go-backend-redis-volatile-boundary.mjs`
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`
- `GOROOT=/tmp/medopl-go-toolchain/root/usr/lib/go-1.22 PATH=/tmp/medopl-go-toolchain/root/usr/lib/go-1.22/bin:$PATH GOMODCACHE=/tmp/medopl-go-modcache GOCACHE=/tmp/medopl-go-buildcache go test ./...` from `services/medopl-go-backend`
- `node scripts/v22-verify.mjs package backend-go-convergence --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- docs tests scripts package.json services/medopl-go-backend`

B review pack:

- `git diff --stat`: Stage 4 adds Go backend scaffold, Ent schema baseline, deterministic SQL baseline, volatile session/cache/queue/lock boundary and registered contract gates.
- `git show --name-only --oneline HEAD`: `1bb9869 feat(go): add redis volatile state boundary`.
- Secret hygiene: review gate reported no secret-like paths and no secret-like added lines.
- Pollution check: no `deploy/*`, `.sentrux/*`, `adapters/*`, `infra/*`, upstream, `.runtime/*`, secret path, real cloud, build/push, kubectl, deploy or live-test operation.
- Product narrative check: no restored `user_owned`, `resource-order`, old runner/provisioner, OpenCost or Langfuse primary narrative.
- Fake success check: Ent contract now runs real `ent generate` in a temporary Go module; volatile store rejects non-positive TTL and missing keys instead of creating permanent short-state.
- Dependency check: Ent generator dependencies are locked for codegen verification; no `github.com/redis/go-redis`, `pgx`, `lib/pq` or runtime Postgres client was introduced.
- Landing recommendation: Stage 4 is ff-only absorbable by B review if the full branch is selected for landing; authoring can continue to Stage 5 before final landing.

Non-goals:

- No real PostgreSQL connection or migration execution.
- No real Redis connection or Redis client dependency.
- No production Go backend replacement claim.
- No Temporal, LangGraph or durable engine dependency.
- No user-visible API or UI change.
- No secret read, live cloud call, build/push, kubectl, deploy or live-test.
- No upstream, deploy, `.sentrux`, `adapters`, `infra` or `.runtime` edits.
- No restored `docs/contracts/**`, `docs/recovery/**`, old stage board or `scripts/smoke-test-*`.

Risk notes:

- Go backend is still a future canonical target, not the active production backend.
- SQL baseline and Ent schema are intentionally local contract surfaces until a real migration lane is authorized.
- Volatile store is local deterministic boundary proof only; production Redis wiring remains a later explicit implementation behind the same session/cache/queue/lock interfaces.
- Ent codegen verification uses `GOPROXY=https://goproxy.cn,direct` and `GOSUMDB=sum.golang.google.cn` in the contract test to keep dependency checksum verification reproducible in this environment.

Next recommendation:

- Proceed to Stage 5: implement Go run/file/artifact domain contracts and runtime broker interface without connecting to real OPL, without fake success and without moving Portal business truth into runtime integration.

### 2026-05-22 feat/v22-backend-go-convergence-program stage-5

Status: `ready_for_landing_review`

Branch: `feat/v22-backend-go-convergence-program`

Base trunk HEAD: `82bbf09e3bdfd2d2f4f746353ec9b9fa3cc5eb7f`

Model:

- controller: `gpt-5 runtime`
- subagent Leibniz: `gpt-5.4`, read-only Runtime Bridge / Portal run-file-artifact field and pollution-risk review for Step 11/12.
- subagent Meitner: `gpt-5.4`, read-only Step 11 Go run/file/artifact domain contract review.
- subagent Maxwell: `gpt-5.4`, read-only Step 12 Runtime Broker interface review; returned FAIL on runtime agent and mode gates.
- subagent Chandrasekhar: `gpt-5.4`, read-only Step 12 re-review; returned FAIL on upstream domain/service endpoint consistency, then closed after controller fixed and verified the blocker.

Scope:

- Add Go `run_request`, `run_execution`, `run_artifact` and `file_ref` domain contracts with repository/service boundaries.
- Keep run creation pending; `succeeded` requires observed artifact and cannot be fabricated.
- Add `internal/integration/runtimebroker` interface and deterministic local adapter for session bind, run submit/status, artifact listing and public artifact projection.
- Enforce `providerKeyRef`, `resourceBindingId`, `computeInstanceId`, `storageBucketId`, `runtimeAgentId`, `runtimeAgentEndpoint` and `mode=full_runtime` before managed run acceptance.
- Register Stage 5 contract gates in test lane registry, current/local-contract/review suites and backend convergence package.

Commits:

- `a876412 feat(go): implement run file artifact domain contracts`
- `0262f07 feat(go): add runtime broker integration interface`

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/specs/README.md`
- `docs/runtime/README.md`
- `docs/source/README.md`
- `docs/delivery/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-test-classification.mjs`
- `services/medopl-go-backend/**`
- `services/portal/src/integrations/runtime-bridge-client.mjs`
- `services/opl-runtime-bridge/src/runtime-bridge-runs.mjs`
- `services/opl-runtime-bridge/src/runtime-bridge-routes.mjs`

Verification before landing review:

- `node tests/contract/contract-test-v22-go-backend-run-file-artifact-domain.mjs`
- `node tests/contract/contract-test-v22-go-backend-runtime-broker-interface.mjs`
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`
- `GOROOT=/tmp/medopl-go-toolchain/root/usr/lib/go-1.22 PATH=/tmp/medopl-go-toolchain/root/usr/lib/go-1.22/bin:$PATH GOMODCACHE=/tmp/medopl-go-modcache GOCACHE=/tmp/medopl-go-buildcache go test ./...` from `services/medopl-go-backend`
- `node scripts/v22-verify.mjs package backend-go-convergence --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- docs tests scripts package.json services/portal/src services/medopl-go-backend`

B review pack:

- `git diff --stat`: Stage 5 adds Go domain/service/repository contracts for run/file/artifact, Runtime Broker interface/local adapter, Go tests, contract gates and manifest registrations.
- `git show --name-only --oneline HEAD`: `0262f07 feat(go): add runtime broker integration interface`.
- Contract review: Step 11/12 both used eval-first RED, then implementation, then package verification.
- Secret hygiene: review gate reported no secret-like paths and no secret-like added lines.
- Pollution check: no `deploy/*`, `.sentrux/*`, `adapters/*`, `infra/*`, upstream, `.runtime/*`, secret path, real cloud, build/push, kubectl, deploy or live-test operation.
- Product narrative check: no restored `user_owned`, `resource-order`, old runner/provisioner, OpenCost or Langfuse primary narrative.
- Fake success check: run creation is pending, Runtime Broker missing runtime agent is gated, non-`full_runtime` mode is rejected and `succeeded` requires observed artifact.
- Dependency check: no real HTTP, OPL, PostgreSQL, Redis or cloud client dependency was introduced.
- Landing recommendation: Stage 5 is ff-only absorbable by B review if the full branch is selected for landing; authoring can continue to Stage 6 before final landing.

Non-goals:

- No real Runtime Bridge HTTP client.
- No real OPL call.
- No real PostgreSQL or Redis connection.
- No workflow facade durable engine, Temporal or LangGraph dependency.
- No commercial package or UI decision.
- No production Go backend replacement claim.
- No secret read, live cloud call, build/push, kubectl, deploy or live-test.
- No upstream, deploy, `.sentrux`, `adapters`, `infra` or `.runtime` edits.

Risk notes:

- Runtime Broker local adapter is a deterministic contract adapter only; production bridge wiring must land behind the same interface in a later authorized step.
- The Go backend remains future canonical target, not current production replacement.
- Step 12 tightened Step 11 run request validation so Runtime Agent ID and endpoint are both required before managed run acceptance.

Next recommendation:

- Proceed to Stage 6: add Go workflow facade command/state/idempotency model, then route long-task entrypoints through workflow facade without changing Portal/Runtime/Cloud contracts.

### 2026-05-22 fix/v22-user-owned-gflabtoken-provider-keys

Status: `landed / pushed / post-push verified`

Branch: `fix/v22-user-owned-gflabtoken-provider-keys`

Base trunk HEAD: `98b7990706161ec10f3a6923bd880b31e866a5f5`

handoff_commit: `83dc7f669de0b109c4cc5b8f437d06d659aa5802`

Model:

- controller: `gpt-5.4`
- subagents: none

Scope:

- Correct provider truth: MedOPL does not provide a platform default model key or unified provider credential.
- Require each user to provide their own gflabtoken API Key for OPL entry/preflight, workbench provider binding and managed run provider access.
- Keep `portal.medopl.cn` login independent from gflabtoken API Key.
- Keep raw API Key inside the backend secret boundary; public surfaces expose only `providerKeyRef`, bound status and `providerMode=user_gflabtoken`.
- Preserve `provider_key_required` for managed readiness/open/run when the user has no provider key reference.

Contract subscription:

- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `services/portal/src/app/portal-auth-runtime-handler.mjs`
- `services/portal/src/domain/opl-work-flow.mjs`
- `services/portal/src/domain/portal-api-payloads.mjs`
- `services/portal/src/domain/user-credit-provider-key-flow.mjs`
- `tests/regression/opl/regression-test-v22-opl-work-message-file-run-flow.mjs`
- `tests/regression/portal/regression-test-v22-saas-portal-opl-ops-surface-contract.mjs`
- `tests/smoke/smoke-test-v22-managed-environment-open-flow.mjs`
- `tests/smoke/smoke-test-v22-mvp-managed-opl-loop-contract.mjs`
- `tests/smoke/smoke-test-v22-portal-opl-connection-contract.mjs`
- `tests/smoke/smoke-test-v22-user-credit-provider-key-flow.mjs`

Non-goals:

- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream, deploy, adapters, `.sentrux`, infra or `.runtime` edits.
- No new platform provider credential, fallback provider, compatibility alias or provider-key bypass.
- No cursor advancement beyond `real-cloud-authorization-boundary`.

Verification before landing review:

- `npm run test:lanes`
- `npm run test:fast`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `npm --prefix services/portal run check`
- `npm run repo:bloat`
- `git diff --check -- docs tests scripts services package.json .github AGENTS.md TASTE.md`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`

Next recommendation:

- Continue at `real-cloud-authorization-boundary`; before any real provider/cloud execution, explicitly authorize secret access, live provider calls, deploy/build/kubectl/live-test boundaries and evidence handling.

landed_commit: `83dc7f669de0b109c4cc5b8f437d06d659aa5802`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run test:lanes` passed.
- `npm run test:fast` passed.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` passed with no findings.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json` passed.
- `npm --prefix services/portal run check` passed.
- `npm run repo:bloat` passed.
- `git diff --check -- docs tests scripts services package.json .github AGENTS.md TASTE.md` passed.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json` passed.
- forbidden path diff empty.
- added-lines secret value scan empty.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-05-22 feat/v22-slide-09-precloud-readiness

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-slide-09-precloud-readiness`

Base trunk HEAD: `0037df7ac22f9fda158ecf75f611c88a88662aea`

handoff_commit: `97a4af3f7dd53e96f1e5cade8073b0e70fa6cd73`

Model:

- controller: `gpt-5.4`
- subagent Kuhn: `gpt-5.4`, read-only slide-09 diff and closeout boundary review.

Scope:

- Close slide-09 pre-cloud readiness gate.
- Extend the product-engineering-loop gate so it validates both open and closed states.
- Keep the final current verification bundle local-only; do not authorize real cloud execution.
- Collapse the temporary product slide baton from active machine truth into a closed summary and this history summary.
- Remove the temporary `product-engineering-loop-index` branch override after slide loop closeout.

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`

Non-goals:

- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream, deploy, adapters, `.sentrux`, infra or `.runtime` edits.
- No per-slide docs, `docs/slides/*`, shadow archive or unregistered tests.
- No product service implementation in the closeout commit.

Verification before landing review:

- `node tests/contract/contract-test-v22-product-engineering-loop-index.mjs`
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`
- `npm run test:lanes`
- `npm run test:fast`
- `npm --prefix services/portal run check`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- AGENTS.md TASTE.md docs tests scripts services package.json .github`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`

Next recommendation:

- Start `real-cloud-authorization-boundary` only after explicit authorization for secret access, provider operations, deploy/build/kubectl/live-test boundaries and evidence handling.

landed_commit: `97a4af3f7dd53e96f1e5cade8073b0e70fa6cd73`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node tests/contract/contract-test-v22-product-engineering-loop-index.mjs` passed before landing while the loop was still open.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` passed before landing.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json` passed before landing while cursor still pointed to slide-09.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json` passed before landing.
- repo bloat audit passed; no per-slide docs, shadow archive or unregistered tests were added.
- forbidden path diff empty.
- added-lines secret value scan empty.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-05-22 feat/v22-slide-08-admin-ops

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-slide-08-admin-ops`

Base trunk HEAD: `91fc4e85ea9f868af783e12150b86a9efb1506bb`

handoff_commit: `9b9e8e91e8aee7bf4f1c219b73b18c64b30bb900`

Model:

- controller: `gpt-5.4`
- subagent Mencius: Codex explorer, read-only slide-08 diff and boundary review.

Scope:

- Close slide-08 admin ops local projection loop.
- Split admin ops frontend data mapping into `portalAdminOpsSurface.ts` to keep `portalAdapters.ts` under line budget.
- Preserve `/admin/ops` backend payload as the source of admin operation rows, ops exceptions, cost allocation tags and future-authorized states.
- Render audit-backed local operation rows, ops exception summaries and disabled/future-authorized boundaries on the AdminOps page.
- Register the new admin ops local projection regression in lane registry, current suite and product loop machine cursor.

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`

Non-goals:

- No slide-09 implementation.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream, deploy, adapters, `.sentrux`, infra or `.runtime` edits.
- No per-slide docs, `docs/slides/*`, shadow archive or unregistered tests.

Verification before landing review:

- `node tests/regression/portal/regression-test-v22-admin-ops-console-boundary.mjs`
- `node tests/regression/portal/regression-test-v22-admin-ops-disabled-product-state.mjs`
- `node tests/regression/portal/regression-test-v22-admin-ops-local-projection-view.mjs`
- `node tests/regression/portal/regression-test-v22-portal-admin-shared-helper-structure.mjs`
- `npm --prefix services/portal run check`
- `npm --prefix services/portal run frontend:typecheck`
- `npm run test:fast`
- `npm run test:lanes`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- AGENTS.md TASTE.md docs tests scripts services package.json .github`

Next recommendation:

- Continue with `slide-09-precloud-readiness` on `leaf-precloud-readiness-closure`; keep slide-01 through slide-08 regressions in the current verify bundle as guards, then collapse the product loop to history summary and `real-cloud-authorization-boundary`.

landed_commit: `9b9e8e91e8aee7bf4f1c219b73b18c64b30bb900`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` passed before closeout.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json` passed before closeout while cursor still pointed to slide-08.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json` passed before closeout.
- `npm run test:fast`, `npm run test:lanes`, portal check and frontend typecheck passed before landing.
- repo bloat audit passed; no per-slide docs, shadow archive or unregistered tests were added.
- forbidden path diff empty.
- added-lines secret value scan empty.

post_merge_closeout: `completed`

next_cursor: `leaf-precloud-readiness-closure`

### 2026-05-22 feat/v22-slide-07-run-artifact-trace

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-slide-07-run-artifact-trace`

Base trunk HEAD: `7bd0f6eb5338bb2a7b8c94351762a5ec101f8cf6`

handoff_commit: `eec977b4e654837df0ea02c13c48437e587aa548`

Model:

- controller: `gpt-5.4`
- subagent Hooke: `gpt-5.4-mini`, read-only slide-07 runtime trace owner surface review.
- subagent Halley: `gpt-5.4-mini`, read-only slide-07 Portal trace display review.
- subagent Chandrasekhar: `gpt-5.4`, review of frontend fallback truth and product boundary.

Scope:

- Close slide-07 run/artifact/trace metadata backflow local loop.
- Expose owner-scoped runtimeTrace summaries in Portal trace payloads.
- Filter explicit non-owner artifact/trace records from public payloads.
- Keep public payloads free of runId, internalRunId, internal owner ids, token, storage key and private path fields.
- Remove frontend fallback truth for runtimeTrace status and artifact status.

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`

Non-goals:

- No slide-08 implementation.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream, deploy, adapters, `.sentrux`, infra or `.runtime` edits.
- No per-slide docs, `docs/slides/*`, shadow archive or unregistered tests.

Verification before landing review:

- `node tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-state-store-atomic-flow.mjs`
- `node tests/regression/portal/regression-test-v22-portal-session-trace-view.mjs`
- `node tests/regression/portal/regression-test-v22-portal-trace-file-linkage.mjs`
- `node tests/regression/opl/regression-test-v22-real-opl-file-run-artifact-gates.mjs`
- `npm --prefix services/portal run check`
- `npm --prefix services/portal run frontend:typecheck`
- `npm run test:fast`
- `npm run test:lanes`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- AGENTS.md TASTE.md docs tests scripts services package.json .github`

Next recommendation:

- Continue with `slide-08-admin-ops` on `leaf-admin-ops-closure`; keep slide-01 through slide-07 regressions in the current verify bundle as guards.

landed_commit: `eec977b4e654837df0ea02c13c48437e587aa548`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` passed before closeout.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json` passed before closeout while cursor still pointed to slide-07.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json` passed before closeout.
- repo bloat audit passed; no per-slide docs, shadow archive or unregistered tests were added.
- forbidden path diff empty.
- added-lines secret value scan empty.

post_merge_closeout: `completed`

next_cursor: `leaf-admin-ops-closure`

### 2026-05-22 feat/v22-slide-06-opl-entry-runtime

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-slide-06-opl-entry-runtime`

Base trunk HEAD: `9a54215a729d857894e117c71beda9d548e3368b`

handoff_commit: `abc1071eecd7d75f8b436e12502382098ace98d3`

Model:

- controller: `gpt-5.4`
- subagent Godel: `gpt-5.4`, read-only slide-06 OPL entry runtime owner surface review.

Scope:

- Close slide-06 OPL entry/runtime local loop.
- Keep top-level Portal `launchId` as the only frontend proxy handle for `/portal/api/opl/*`.
- Remove nested launch id exposure from public launch payloads while keeping workspaceSession, runtimeSession and providerKeyRef visible.
- Keep raw provider key, launch token and runtime token backend-only.

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`

Non-goals:

- No slide-07 implementation.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream, deploy, adapters, `.sentrux`, infra or `.runtime` edits.
- No per-slide docs, `docs/slides/*`, shadow archive or unregistered tests.

Verification before landing review:

- `node tests/regression/runtime-bridge/regression-test-v22-portal-runtime-bridge-api-local-flow.mjs`
- `node tests/regression/opl/regression-test-v22-opl-entry-preflight-auth-flow.mjs`
- `node tests/regression/opl/regression-test-v22-opl-web-gateway-launch.mjs`
- `node tests/regression/opl/regression-test-v22-provider-secret-boundary-contract.mjs`
- `node tests/smoke/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs`
- `node tests/smoke/smoke-test-v22-portal-opl-connection-contract.mjs`
- `npm run test:fast`
- `npm run test:lanes`
- `npm --prefix services/portal run check`
- `npm --prefix services/portal run frontend:typecheck`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- AGENTS.md TASTE.md docs tests scripts services package.json .github`

Next recommendation:

- Continue with `slide-07-run-artifact-trace` on `leaf-run-artifact-trace-closure`; keep slide-01 through slide-06 regressions in the current verify bundle as guards.

landed_commit: `abc1071eecd7d75f8b436e12502382098ace98d3`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` passed before closeout.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json` passed before closeout while cursor still pointed to slide-06.
- repo bloat audit passed; no per-slide docs, shadow archive or unregistered tests were added.
- forbidden path diff empty.
- added-lines secret value scan empty.

post_merge_closeout: `completed`

next_cursor: `leaf-run-artifact-trace-closure`

### 2026-05-22 feat/v22-slide-05-resource-lifecycle

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-slide-05-resource-lifecycle`

Base trunk HEAD: `78493d47baf9c2409eb45f8bf54e627a9886247f`

handoff_commit: `b0ac1b31a85e2ab63827640544e04af6723a4122`

Model:

- controller: `gpt-5.4`
- subagent Sagan: `gpt-5.4`, read-only slide-05 resource lifecycle owner surface review.

Scope:

- Close slide-05 resource lifecycle local loop.
- Project managed environment `releasePolicy`, `stopBilling` and `auditStatus` into UI-safe resource payloads and RuntimeEnvironment display.
- Keep compute release separate from file-space retention; stop-billing checks stay in the 120 minute window and T+1 audit remains explicit.
- Keep `user_owned` and `resource-order` from returning as primary product routes.

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`

Non-goals:

- No slide-06 implementation.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream, deploy, adapters, `.sentrux`, infra or `.runtime` edits.
- No per-slide docs, `docs/slides/*`, shadow archive or unregistered tests.

Verification before landing review:

- `node tests/regression/portal/regression-test-v22-managed-resource-binding-plan-view.mjs`
- `node tests/regression/portal/regression-test-v22-retire-legacy-resource-user-surface.mjs`
- `node tests/smoke/smoke-test-v22-release-stop-billing-audit-flow.mjs`
- `node tests/smoke/smoke-test-v22-resource-plan-contract.mjs`
- `npm run test:fast`
- `npm run test:lanes`
- `npm --prefix services/portal run check`
- `npm --prefix services/portal run frontend:typecheck`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- AGENTS.md TASTE.md docs tests scripts services package.json .github`

Next recommendation:

- Continue with `slide-06-opl-entry-runtime` on `leaf-opl-entry-runtime-closure`; keep slide-01 storage, slide-02 runtime real API, slide-03 account/wallet/billing, slide-04 workspace/files and slide-05 resource lifecycle regressions in the current verify bundle as guards.

landed_commit: `b0ac1b31a85e2ab63827640544e04af6723a4122`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` passed before closeout.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json` passed before closeout while cursor still pointed to slide-05.
- repo bloat audit passed; no per-slide docs, shadow archive or unregistered tests were added.
- forbidden path diff empty.
- added-lines secret value scan empty.

post_merge_closeout: `completed`

next_cursor: `leaf-opl-entry-runtime-closure`

### 2026-05-22 feat/v22-slide-04-workspace-files

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-slide-04-workspace-files`

Base trunk HEAD: `96ae303417e337468df125580312714dd9582c49`

handoff_commit: `44c917fbd16952cb043d24d97a0211cc2d8fd9b2`

Model:

- controller: `gpt-5.4`
- subagent Hilbert: `gpt-5.4`, read-only slide-04 workspace/files owner surface review.

Scope:

- Close slide-04 workspace/files local loop.
- Project fileSpace folders, selected file refs, actions, delete policy and 7-day protection semantics into the Workspace UI model.
- Keep objectKey, localPath, signedUrl and object-store implementation details out of frontend product truth.
- Keep line budget green by splitting file-space view helpers out of the already large Portal adapter file.

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`

Non-goals:

- No slide-05 implementation.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream, deploy, adapters, `.sentrux`, infra or `.runtime` edits.
- No per-slide docs, `docs/slides/*`, shadow archive or unregistered tests.

Verification before landing review:

- `node tests/regression/portal/regression-test-v22-portal-file-space-management.mjs`
- `node tests/regression/portal/regression-test-v22-workspace-storage-public-response.mjs`
- `npm run test:fast`
- `npm run test:lanes`
- `npm --prefix services/portal/frontend run typecheck`
- `npm --prefix services/portal run check`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- AGENTS.md TASTE.md docs tests scripts services package.json .github`

Next recommendation:

- Continue with `slide-05-resource-lifecycle` on `leaf-resource-lifecycle-closure`; keep slide-01 storage, slide-02 runtime real API, slide-03 account/wallet/billing and slide-04 workspace/files regressions in the current verify bundle as guards.

landed_commit: `44c917fbd16952cb043d24d97a0211cc2d8fd9b2`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` passed.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json` passed before closeout while cursor still pointed to slide-04.
- `node scripts/v22-landing-closeout.mjs check --trunk-ref origin/recovery/platform-v22-trunk --json` failed before closeout with `non_closeout_commits_after_latest_landed`, then this closeout commit reconciled history and cursor state.
- repo bloat audit passed; no per-slide docs, shadow archive or unregistered tests were added.
- forbidden path diff empty.
- added-lines secret value scan empty.

post_merge_closeout: `completed`

next_cursor: `leaf-resource-lifecycle-closure`

### 2026-05-22 feat/v22-slide-03-account-wallet-billing

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-slide-03-account-wallet-billing`

Base trunk HEAD: `e0bcdc1b04a870fcc2656c7f96f11e61f056d23b`

handoff_commit: `525546b7fb5c4483edeb3f21db4cd7a675996540`

Model:

- controller: `gpt-5.4`
- subagent Descartes: `gpt-5.4-mini`, read-only slide-03 account/wallet/billing owner surface review.

Scope:

- Close slide-03 account/wallet/billing local loop.
- Make Billing payload ledger use the same owner scope as wallet summary.
- Keep backend owner identifiers inside backend query logic while exposing only UI-safe account scope text to Portal frontend.
- Add and register `tests/regression/portal/regression-test-v22-account-wallet-billing-closure.mjs`.

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`

Non-goals:

- No slide-04 implementation.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream, deploy, adapters, `.sentrux`, infra or `.runtime` edits.
- No per-slide docs, `docs/slides/*`, shadow archive or unregistered tests.

Verification before landing review:

- `node tests/regression/portal/regression-test-v22-account-wallet-billing-closure.mjs`
- `node tests/regression/portal/regression-test-v22-portal-cost-balance-trace-linkage.mjs`
- `npm run test:fast`
- `npm run test:lanes`
- `npm --prefix services/portal/frontend run typecheck`
- `npm --prefix services/portal run check`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- AGENTS.md TASTE.md docs tests scripts services package.json .github`

Next recommendation:

- Continue with `slide-04-workspace-files` on `leaf-workspace-files-closure`; keep slide-01 storage, slide-02 runtime real API and slide-03 account/wallet/billing regressions in the current verify bundle as guards.

landed_commit: `525546b7fb5c4483edeb3f21db4cd7a675996540`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` passed
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json` failed before closeout because history and goal-current still pointed to slide-02, which is the expected post-merge closeout trigger.
- `node scripts/v22-landing-closeout.mjs check --trunk-ref origin/recovery/platform-v22-trunk --json` failed before closeout with `non_closeout_commits_after_latest_landed`, then this closeout commit reconciled history and cursor state.
- forbidden path diff empty
- added-lines secret value scan empty

post_merge_closeout: `completed`

next_cursor: `leaf-workspace-files-closure`

### 2026-05-22 feat/v22-slide-02-portal-api-real-data

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-slide-02-portal-api-real-data`

Base trunk HEAD: `1c64d21e7233692f88c0e9c0ca4ff6abc0f89f0b`

handoff_commit: `5c3f83585c78a5fdb48ed31741719658a4e8d1d6`

Model:

- controller: `gpt-5.4`
- subagent Hypatia: `gpt-5.4-mini`, read-only slide-02 owner surface and bloat risk review.

Scope:

- Close slide-02 Portal API real data wiring for RuntimeEnvironment.
- Wire RuntimeEnvironment package catalog, subscription and entitlement state through typed Portal lab API clients.
- Remove `active-missing-ui` adjudication for lab API clients after those APIs became active UI dependencies.
- Add regression coverage for runtime real API data closure and register it in the portal regression lane and current verify bundle.

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`

Non-goals:

- No slide-03 implementation.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream, deploy, adapters, `.sentrux`, infra or `.runtime` edits.
- No per-slide docs, `docs/slides/*`, shadow archive or unregistered tests.

Verification before landing review:

- `node tests/regression/portal/regression-test-v22-portal-runtime-real-api-data-closure.mjs`
- `node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs`
- `node tests/regression/portal/regression-test-v22-portal-local-api-action-closure.mjs`
- `npm --prefix services/portal run check`
- `npm --prefix services/portal/frontend run typecheck`
- `npm run test:fast`
- `npm run test:lanes`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `git diff --check -- AGENTS.md TASTE.md docs tests scripts services package.json .github`

Next recommendation:

- Continue with `slide-03-account-wallet-billing` on `leaf-account-wallet-billing-closure`; keep slide-01 storage regression and slide-02 runtime real API regression in the current verify bundle as guards.

landed_commit: `5c3f83585c78a5fdb48ed31741719658a4e8d1d6`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run test:fast` passed
- `npm run test:lanes` passed
- `npm --prefix services/portal/frontend run typecheck` passed
- `npm --prefix services/portal run check` passed
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` passed
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json` passed
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json` passed
- `node scripts/v22-repo-bloat-audit.mjs --json` passed
- forbidden path diff empty
- added-lines secret value scan empty

post_merge_closeout: `completed`

next_cursor: `leaf-account-wallet-billing-closure`

### 2026-05-22 feat/v22-slide-01-data-truth

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-slide-01-data-truth`

Base trunk HEAD: `7fb7ab0e698a982d4604b13c48be22798e4f2cbb`

handoff_commit: `de71ca446da703358dd998489fb555fba622ea68`

Model:

- controller: `gpt-5.4`
- subagent Hypatia: `gpt-5.4-mini`, read-only closeout gate impact review.

Scope:

- Close slide-01 data truth for local production storage.
- Remove the `postgres_redis` JSON business snapshot mirror from Portal PostgreSQL persistence.
- Keep Redis limited to coordination/session state and prove it does not hold business truth.
- Add regression coverage that `portal-db.json` is not created in `postgres_redis` positive closure.
- Harden landing closeout so latest landed history must match trunk head when manifest requires trunk-head sync.

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`

Non-goals:

- No slide-02 implementation.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream, deploy, adapters, `.sentrux`, infra or `.runtime` edits.
- No per-slide docs, `docs/slides/*`, shadow archive or unregistered tests.

Verification before landing review:

- `node tests/regression/portal/regression-test-v22-portal-storage-mode-local-closure.mjs`
- `npm --prefix services/portal run check`
- `npm run test:fast`
- `npm run test:lanes`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `git diff --check -- AGENTS.md TASTE.md docs tests scripts services package.json .github`

Next recommendation:

- Continue with `slide-02-portal-api-real-data` on `leaf-portal-api-real-data-closure`; keep slide-01 storage regression in the current verify bundle as a guard.

landed_commit: `de71ca446da703358dd998489fb555fba622ea68`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node tests/regression/portal/regression-test-v22-portal-storage-mode-local-closure.mjs` passed
- `npm --prefix services/portal run check` passed
- `npm run test:fast` passed
- `npm run test:lanes` passed
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` passed
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json` passed
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json` passed
- forbidden path diff empty
- added-lines secret value scan empty

post_merge_closeout: `completed`

next_cursor: `leaf-portal-api-real-data-closure`

### 2026-05-22 cleanup/v22-pre-slide-bloat-guardrails

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-pre-slide-bloat-guardrails`

Base trunk HEAD: `4d27cfab8545dc767749955231557e7d9b7ede16`

handoff_commit: `ee27d378ea81d1d2629b65fe332bacb24a12acaf`

Model:

- controller: `gpt-5.4`
- subagents: none

Scope:

- Add root `test:fast` and `test:lanes` package entrypoints and CI wiring.
- Extend repo bloat guardrails to forbid per-slide docs, subslide docs and unregistered tests while keeping docs truth on the existing README taxonomy.
- Add `subtask_surfaces` to the product engineering loop machine fixture so slide subtasks can be tracked without creating permanent slide documentation trees.
- Document the pre-slide requirement to run fast/lane gates before slide authoring commits.

Contract subscription:

- `docs/policies/README.md`
- `docs/delivery/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-repo-bloat-audit.mjs`
- `package.json`
- `.github/workflows/verify.yml`

Non-goals:

- No product implementation.
- No PostgreSQL/Redis closure claim.
- No services, deploy, adapters, `.sentrux`, infra, upstream or `.runtime` edits.
- No secret read, real cloud, build/push, kubectl, deploy or live-test.

Verification before landing review:

- `npm run test:fast`
- `npm run test:lanes`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `git diff --check -- AGENTS.md TASTE.md docs tests scripts services package.json .github`

Next recommendation:

- Continue `leaf-portal-postgres-redis-local-production-data-closure`; each product slide authoring branch should run `npm run test:fast` and `npm run test:lanes` before commit to keep docs/tests/scripts from expanding into per-slide archives.

landed_commit: `ee27d378ea81d1d2629b65fe332bacb24a12acaf`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- test:fast passed
- test:lanes passed
- workflow gate review passed
- local-contract suite passed
- current verify passed
- diff check and added-lines secret scan passed

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`
### 2026-05-21 cleanup/v22-agents-lifecycle-alignment

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-agents-lifecycle-alignment`

Base trunk HEAD: `e501945474e68451f6a3824f2e6e8aae05bd746f`

handoff_commit: `60761fffe1dd8ecc3ec3b123d48e5e747e9dc4df`

Model:

- controller: `gpt-5.4`
- subagents: none

Scope:

- Slim root `AGENTS.md` into stable agent collaboration constraints, docs lifecycle entrypoints, verification entrypoints, worktree/subagent model recording rules and authorization red lines.
- Add root `TASTE.md` for long-lived MedOPL engineering taste: managed OPL SaaS, clean upstream, consumer-first contract, single truth, no false pass, and layered docs governance.
- Move mutable project fact lookup back to docs reading order, source, tests, fixtures, manifest, runner and package scripts.

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/README.md`
- `docs/active/README.md`
- `docs/history/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`

Non-goals:

- No product implementation.
- No PostgreSQL/Redis closure claim.
- No services, deploy, adapters, `.sentrux`, infra, upstream or `.runtime` edits.
- No secret read, real cloud, build/push, kubectl, deploy or live-test.

Verification before landing review:

- `node tests/contract/contract-test-v22-framework-workflow-convergence.mjs`
- `node tests/contract/contract-test-v22-full-taxonomy-cleanup.mjs`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `git diff --check -- AGENTS.md TASTE.md docs tests scripts services package.json .github`

Next recommendation:

- Keep the business cursor on `leaf-portal-postgres-redis-local-production-data-closure`; future governance updates should keep `AGENTS.md` thin and write durable product facts to the relevant docs lifecycle owner or machine truth surface.

landed_commit: `60761fffe1dd8ecc3ec3b123d48e5e747e9dc4df`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- framework workflow convergence gate passed
- full taxonomy cleanup gate passed
- workflow gate review passed
- local-contract suite passed
- current verify passed
- diff check and added-lines secret scan passed

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`
### 2026-05-21 cleanup/v22-test-lifecycle-cleanup-gate

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-test-lifecycle-cleanup-gate`

Base trunk HEAD: `2f39cfac6f4c269e697b525b950f171d15fa1502`

Model:

- controller: `gpt-5.4`
- subagents: none

Scope:

- Add the active test lifecycle cleanup gate: `tests/contract/contract-test-v22-test-lifecycle-cleanup.mjs`.
- Extend `scripts/v22-test-classification.mjs` so each active test registry entry has `ownerSurface` and `lifecycleRole`.
- Make `tests/README.md`, `tests/fixtures/v22/agent-verify-manifest.json` and `tests/fixtures/v22/goal-current.json` declare direct test cleanup: active tests require lane owner and current owner surface; compat-only, alias-only and historical-proof tests cannot remain active.
- Register the gate in current, local-contract, review and the cleanup branch override.
- Directly remove the stale future-authorized cloud resource aggregate wrapper that referenced missing old test paths instead of active registered tests.

Test Lifecycle Rules:

- Active tests must have a lane owner through `TEST_LANE_REGISTRY`.
- Active tests must prove a current owner surface through `ownerSurface`.
- `lifecycleRole` is limited to `current-owner`, `negative-retirement-guard`, `suite-wrapper` and `future-authorized-boundary`.
- Old alias, wrapper, facade or compat-only tests are deleted after active callers migrate.
- Historical proof and closeout evidence stay in history summary and git history, not active tests.
- Duplicate aggregate tests must be merged or deleted.

Contract subscription:

- `AGENTS.md`
- `docs/history/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-test-classification.mjs`

Non-goals:

- No product implementation.
- No PostgreSQL/Redis closure claim.
- No concrete business test cleanup beyond the stale aggregate wrapper removed by this gate branch.
- No services, deploy, adapters, `.sentrux`, infra, upstream or `.runtime` edits.
- No secret read, real cloud, build/push, kubectl, deploy or live-test.
- No git push or merge from the authoring branch.

Verification before landing review:

- `node tests/contract/contract-test-v22-test-lifecycle-cleanup.mjs`
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`
- `node scripts/v22-verify.mjs current --branch cleanup/v22-test-lifecycle-cleanup-gate --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs review --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs package contract-gate --base origin/recovery/platform-v22-trunk --json`
- `git diff --check -- docs tests scripts package.json .github`

Landing review packet:

- Review branch: `cleanup/v22-test-lifecycle-cleanup-gate`.
- Review base: `2f39cfac6f4c269e697b525b950f171d15fa1502`.
- Review focus: active test lifecycle owner metadata, direct cleanup policy, stale suite-wrapper deletion, branch override, no services/forbidden-surface changes and no business cursor advancement.
- Landing rule: landing operator may fresh review, ff-only merge to `recovery/platform-v22-trunk`, push, then run `node scripts/v22-landing-closeout.mjs generate --branch cleanup/v22-test-lifecycle-cleanup-gate --landed-commit <landed_branch_head> --trunk-ref origin/recovery/platform-v22-trunk ...` or an equivalent closeout commit for this branch.

Next recommendation:

- After landing gate and post-merge closeout, continue `leaf-portal-postgres-redis-local-production-data-closure`; future product slide work must keep active tests owner-scoped and delete old compat-only tests instead of preserving historical proof as active eval.

landed_commit: `d26b8742882801a37d0f4be195ed60d5851c9aa4`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- node scripts/v22-verify.mjs current --branch cleanup/v22-test-lifecycle-cleanup-gate --base origin/recovery/platform-v22-trunk --json passed
- node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json passed
- node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json passed
- node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk passed
- git diff --check -- docs tests scripts package.json .github passed
- forbidden path diff empty
- added-lines secret value scan empty

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`
### 2026-05-21 feat/v22-product-engineering-loop-index

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-product-engineering-loop-index`

Base trunk HEAD: `f3d2cacb1724a52e50aff96109dca1841e1fc7b2`

Model:

- controller: `gpt-5.4`
- subagents: none

Scope:

- Add the Product Engineering Loop index for `precloud-product-slides-closure`.
- Make the 10 pre-cloud product slides machine-readable in `tests/fixtures/v22/goal-current.json`.
- Register the product-engineering-loop gate in current, local-contract, review, docs-engineering-loop, root package scripts and CI.
- Keep product implementation untouched; this branch indexes the lifecycle and gates only.

Product Engineering Loop:

- The loop uses the existing OPL-style truth surfaces: `docs/active/README.md`, `tests/fixtures/v22/goal-current.json`, `tests/fixtures/v22/agent-verify-manifest.json`, and this history file.
- It forbids per-slide markdown docs, compatibility layers, fallback paths and shadow archives.
- Each future slide must run `inventory -> classify -> absorb truth -> retire stale surface -> eval -> implementation -> verify -> commit`.
- The collapse policy is explicit: while open, the 10-slide list is only an active baton in `goal-current.json`; after all slides close, `product_engineering_loop.slides` and the temporary branch override must be removed from current truth, leaving only a closed summary, landed commit, history summary and next cursor.

Contract subscription:

- `AGENTS.md`
- `docs/active/README.md`
- `docs/history/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-test-classification.mjs`
- `package.json`
- `.github/workflows/verify.yml`

Non-goals:

- No services implementation.
- No PostgreSQL/Redis closure claim.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream modification.
- No new slide markdown files.

Next recommendation:

- After landing, run slide-01-data-truth as the first product implementation commit on the same product-engineering lifecycle.

landed_commit: `d8ba4a828f8ee4a9989c6b6ce0befd64a396fee3`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- node scripts/v22-verify.mjs current --branch feat/v22-product-engineering-loop-index --base origin/recovery/platform-v22-trunk --json passed
- node scripts/v22-verify.mjs suite product-engineering-loop --base origin/recovery/platform-v22-trunk --json passed
- node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json passed
- node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk passed
- git diff --check -- docs tests scripts package.json .github passed
- forbidden path diff empty
- added-lines secret value scan empty

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`
### 2026-05-21 cleanup/v22-engineering-flow-closure

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-engineering-flow-closure`

Base trunk HEAD: `c8e519e171403f3a5876c3e2a98795c020450234`

Model:

- controller: `gpt-5.4`
- subagent Aristotle: `gpt-5.4-mini`, read-only repo bloat / workflow command reference / registry risk review.

Scope:

- Add a repo bloat audit gate to keep OPL-style taxonomy from regrowing uncontrolled.
- Add workflow local command reference integrity checking for current package/workflow/manifest/docs entrypoints.
- Register both gates in health, local-contract, repo-hygiene and docs-engineering-loop verification surfaces.
- Add `npm --prefix services/portal ci` before CI regression so clean runners can execute Portal local regression dependencies such as `pg`.
- Keep scripts as control-plane runners only; no `scripts/smoke-test-*` returned.
- Keep business cursor unchanged on `leaf-portal-postgres-redis-local-production-data-closure`.

Contract subscription:

- `AGENTS.md`
- `docs/active/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/history/README.md`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `tests/fixtures/v22/goal-current.json`
- `scripts/v22-verify.mjs`
- `scripts/v22-workflow-gate.mjs`
- `scripts/v22-test-classification.mjs`
- `scripts/v22-repo-hygiene.mjs`
- `scripts/v22-repo-bloat-audit.mjs`
- `scripts/v22-line-budget.mjs`
- `package.json`
- `.github/workflows/verify.yml`

Verification before handoff:

- `node tests/health/health-check-v22-workflow-command-reference-gate.mjs`: pass.
- `node tests/health/health-check-v22-repo-bloat-audit-gate.mjs`: pass.
- `node scripts/v22-repo-bloat-audit.mjs --json`: pass.
- `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs`: pass.
- `node tests/contract/contract-test-v22-full-taxonomy-cleanup.mjs`: pass.
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: pass.
- `node scripts/v22-verify.mjs suite repo-hygiene --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs current --branch cleanup/v22-engineering-flow-closure --base origin/recovery/platform-v22-trunk --json`: pass after `npm --prefix services/portal ci`.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `node scripts/v22-landing-closeout.mjs check --trunk-ref origin/recovery/platform-v22-trunk --json`: pass.
- `git diff --check -- docs tests scripts package.json .github services/portal/src`: pass.

Repo bloat audit snapshot:

- docs markdown: `11 / 16`.
- scripts files: `8 / 8`.
- tests mjs: `99 / 110`.
- tests/regression/portal: `29 / 32`.
- tests/future-authorized/cloud: `20 / 24`.
- services/portal: `243 / 260` files, `1846153 / 2000000` bytes.

Structural health note:

- `sentrux check .`: fail, quality signal `0.63` below required `0.69`.
- Violations: modularity `0.7062 < 0.8000`, depth `0.5333 < 0.7000`, and `services/portal/src/app/portal-runtime.mjs` fan-out `16`.
- This is a repo health risk for the next Portal closure branch, not a scope item for this control-plane gate branch.

Non-goals:

- No push, no merge, no ff-only absorb.
- No services implementation changes.
- No deploy, build/push, kubectl, live-test or real cloud operation.
- No upstream, `deploy/*`, `.sentrux/*`, `adapters/*` or `infra/*` edits.

Next recommendation:

- B should fresh review this branch, rerun docs-engineering-loop and current entrypoint, then decide whether to ff-only land.
- A later Portal refactor branch should split `services/portal/src/app/portal-runtime.mjs` fan-out before adding broad Portal surface files.

landed_commit: `f1272a607589fe55fccf59c3dc7fa7574d62030f`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- node scripts/v22-verify.mjs current --branch cleanup/v22-engineering-flow-closure --base origin/recovery/platform-v22-trunk --json passed after npm --prefix services/portal ci
- node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json passed
- node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk passed
- node scripts/v22-repo-bloat-audit.mjs --json passed
- node tests/health/health-check-v22-workflow-command-reference-gate.mjs passed
- git diff --check -- docs tests scripts package.json .github services/portal/src passed
- forbidden path diff empty
- added-lines secret value scan empty

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`
### 2026-05-21 cleanup/v22-opl-framework-workflow-convergence

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-opl-framework-workflow-convergence`

Base trunk HEAD: `054fa6fd9d5c676245b3830d5ed19acf24aaf9a3`

Model:

- controller: `gpt-5.5` runtime; authoring worktree branch records allowed future native subagent models explicitly.
- subagent Meitner: `gpt-5.4-mini`, read-only current workflow/governance wording audit.
- subagent Lovelace: `gpt-5.4-mini`, read-only package / CI / manifest / closeout entrance audit.

Commits:

- `188c94a docs(v22): converge workflow on landing protocol`
- `21ebebc test(v22): rename landing and cleanup gates`
- `f3378ad ci(v22): expose framework repo verification gates`
- final handoff commit: records this authoring branch summary and landing review packet.

Scope:

- Clear current workflow docs from window-era language into authoring branch / landing gate / post-merge closeout.
- Physically clear current machine entrypoints from `absorb` / governance `retirement` names into landing / cleanup entrypoints.
- Add framework repo package and CI entrypoints: `test:*`, `gate:contract`, `closeout:check`.
- Keep business cursor on `leaf-portal-postgres-redis-local-production-data-closure`.

Contract subscription:

- `AGENTS.md`
- `docs/README.md`
- `docs/active/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `docs/history/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-verify.mjs`
- `scripts/v22-workflow-gate.mjs`
- `scripts/v22-test-classification.mjs`
- `scripts/v22-landing-closeout.mjs`
- `.github/workflows/verify.yml`
- `package.json`

Verification before handoff:

- `node tests/contract/contract-test-v22-framework-workflow-convergence.mjs`: pass.
- `node tests/contract/contract-test-v22-landing-closeout-automation.mjs`: pass.
- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`: pass.
- `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs`: pass.
- `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs`: pass.
- `node tests/contract/contract-test-v22-root-verify-workflow-entrypoints.mjs`: pass.
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: pass.
- `node tests/contract/contract-test-v22-current-development-lines.mjs`: pass.
- `node tests/health/health-check-v22-workflow-gate.mjs`: pass.
- `node scripts/v22-verify.mjs current --branch cleanup/v22-opl-framework-workflow-convergence --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs package contract-gate --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- AGENTS.md docs tests scripts package.json .github`: pass.

Non-goals:

- No PostgreSQL/Redis implementation.
- No services business code change.
- No product cursor advancement.
- No secret read, real cloud, build/push, kubectl, deploy or live-test.
- No upstream modification.
- No compatibility layer, old contracts/recovery tree or old `scripts/smoke-test-*` restoration.

Landing review packet:

- Review branch: `cleanup/v22-opl-framework-workflow-convergence`.
- Review base: `054fa6fd9d5c676245b3830d5ed19acf24aaf9a3`.
- Review focus: framework landing protocol wording, landing closeout script rename, cleanup lifecycle gate rename, manifest branch override, package/CI entrypoints, no services/forbidden-surface changes, and no business cursor advancement.
- Suggested landing commands: `node scripts/v22-verify.mjs current --branch cleanup/v22-opl-framework-workflow-convergence --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs package contract-gate --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`, and `git diff --check -- AGENTS.md docs tests scripts package.json .github`.

Next recommendation:

- After landing and post-merge closeout, continue the product cursor `leaf-portal-postgres-redis-local-production-data-closure`.

Landing gate packet:

- Review branch: `cleanup/v22-opl-framework-workflow-convergence`.
- Review base: `054fa6fd9d5c676245b3830d5ed19acf24aaf9a3`.
- Review focus: framework workflow protocol, landing closeout schema, package/CI entrypoints, manifest branch override, no services/forbidden-surface changes, and no business cursor advancement.
- Verify: run `node scripts/v22-verify.mjs current --branch cleanup/v22-opl-framework-workflow-convergence --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs package contract-gate --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`, and `git diff --check -- AGENTS.md docs tests scripts package.json .github`.
- Landing rule: landing operator may fresh review, ff-only merge to `recovery/platform-v22-trunk`, push, then run `node scripts/v22-landing-closeout.mjs generate --branch cleanup/v22-opl-framework-workflow-convergence --landed-commit <landed_branch_head> --trunk-ref origin/recovery/platform-v22-trunk ...` or an equivalent closeout commit for this branch.

Risk notes:

- `scripts/v22-landing-closeout.mjs generate` writes docs/history, docs/active and goal-current only; it does not push, merge, deploy, read secrets or call cloud.
- `scripts/v22-landing-closeout.mjs generate` rejects invalid / unknown landed commits, old trunk commits, unknown branches, branch/handoff mismatches and post-push trunk reachability failures when `--trunk-ref` is provided.
- `last_landed_commit` records the landed authoring branch commit. A later closeout commit cannot self-reference its own future SHA; the closeout gate therefore checks that the landed commit is reachable from trunk and that no reachable handoff remains `ready_for_landing_review`.

Next recommendation:

- After landing gate and post-merge closeout, return to `leaf-portal-postgres-redis-local-production-data-closure`.

landed_commit: `d473ca70a19f134303a1835580fa1d55b66f7679`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- node scripts/v22-verify.mjs current --branch cleanup/v22-opl-framework-workflow-convergence --base origin/recovery/platform-v22-trunk --json passed
- node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json passed
- node scripts/v22-verify.mjs package contract-gate --base origin/recovery/platform-v22-trunk --json passed
- node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk passed
- git diff --check -- AGENTS.md docs tests scripts package.json .github passed
- forbidden path diff empty
- added-lines secret value scan empty

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`
### 2026-05-21 cleanup/v22-opl-loop-event-automation-and-ci-closure

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-opl-loop-event-automation-and-ci-closure`

Base trunk HEAD: `583da292aa32bf021697171f5b5cea1cfc693baf`

Model:

- controller: `gpt-5.4` declared for repository workflow policy
- subagent Hume: `gpt-5.4`, read-only OPL docs/software engineering loop comparison
- subagent Harvey: `gpt-5.4`, read-only post-merge closeout / machine cursor / history drift audit
- subagent Sartre: `gpt-5.4`, read-only package / CI / test lane / manifest consistency audit

Commits:

- `658cd1b test(v22): automate post-merge loop closeout`
- `ff0b15d ci(v22): harden engineering loop entrypoints`
- final handoff commit: records this A branch summary and B review packet.

Scope:

- Close the absorbed `cleanup/v22-opl-docs-engineering-loop-closure` truth to `583da292aa32bf021697171f5b5cea1cfc693baf`.
- Add `scripts/v22-landing-closeout.mjs` so B can generate and check post-merge closeout instead of hand-editing history and fixtures.
- Add `contract-test-v22-landing-closeout-automation.mjs` and wire it into current, local-contract, review and history-closeout gates.
- Remove hardcoded latest absorbed commit assumptions from lifecycle/index-loop gates; the gates now parse the latest absorbed history section and check trunk reachability.
- Harden package / CI / manifest / test-lane consistency so root scripts, package suites, workflow jobs and registry suites cannot drift independently.
- Keep the business cursor on `leaf-portal-postgres-redis-local-production-data-closure`.

Contract subscription:

- `AGENTS.md`
- `docs/README.md`
- `docs/active/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/history/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-verify.mjs`
- `scripts/v22-workflow-gate.mjs`
- `scripts/v22-test-classification.mjs`
- `scripts/v22-landing-closeout.mjs`
- `.github/workflows/verify.yml`
- `package.json`

Verification before handoff:

- `node tests/contract/contract-test-v22-landing-closeout-automation.mjs`: pass.
  - Covers invalid SHA, unknown SHA, wrong old trunk commit, unknown branch, missing required field, pre-absorb trunk reachability failure and valid branch/handoff dry-run success.
- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`: pass.
- `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs`: pass.
- `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs`: pass.
- `node tests/contract/contract-test-v22-root-verify-workflow-entrypoints.mjs`: pass.
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: pass.
- `node tests/contract/contract-test-v22-full-taxonomy-cleanup.mjs`: pass.
- `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite repo-hygiene --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs review --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- docs tests scripts package.json .github`: pass.

Non-goals:

- No PostgreSQL/Redis implementation.
- No services business code change.
- No product cursor advancement.
- No secret read, real cloud, build/push, kubectl, deploy or live-test.
- No upstream modification.
- No compatibility layer, old contracts/recovery tree or old `scripts/smoke-test-*` restoration.

B review packet:

- Review branch: `cleanup/v22-opl-loop-event-automation-and-ci-closure`.
- Review base: `583da292aa32bf021697171f5b5cea1cfc693baf`.
- Review focus: closeout automation, dynamic trunk/history/current consistency, package/CI/manifest/registry alignment, no services/forbidden-surface changes, and no business cursor advancement.
- Verify: run `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs review --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`, and `git diff --check -- docs tests scripts package.json .github`.
- Absorb rule: only B may fresh review, ff-only merge to `recovery/platform-v22-trunk`, push, then run `node scripts/v22-landing-closeout.mjs generate --branch cleanup/v22-opl-loop-event-automation-and-ci-closure --absorbed-commit <absorbed_branch_head> --trunk-ref origin/recovery/platform-v22-trunk ...` or an equivalent closeout commit for this branch.

Risk notes:

- `scripts/v22-landing-closeout.mjs generate` writes docs/history, docs/active and goal-current only; it does not push, merge, deploy, read secrets or call cloud.
- `scripts/v22-landing-closeout.mjs generate` rejects invalid / unknown absorbed commits, old trunk commits, unknown branches, branch/handoff mismatches and post-push trunk reachability failures when `--trunk-ref` is provided.
- `last_landed_commit` records the absorbed A branch commit. A later closeout commit cannot self-reference its own future SHA; the closeout gate therefore checks that the absorbed commit is reachable from trunk and that no reachable handoff remains `ready_for_landing_review`.
- `verify:docs-engineering-loop` is now a manifest-backed package suite instead of an unregistered shell chain.

Next recommendation:

- After B absorbs this branch and records post-push closeout, return to `leaf-portal-postgres-redis-local-production-data-closure`.

landed_commit: `2fe61b26714b237bc323aa3245128d1b0140d332`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json: pass
- node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --dry-run --json: pass
- node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk: pass
- git diff --check -- docs tests scripts package.json .github: pass

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`

### 2026-05-21 cleanup/v22-opl-docs-engineering-loop-closure

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-opl-docs-engineering-loop-closure`

Base trunk HEAD: `c66d8d86b05d0673d320d6798d9b4192deb8d4cd`

Model:

- controller: `gpt-5.4`
- subagent Heisenberg: `gpt-5.4`, read-only docs portfolio/lifecycle audit
- subagent Mencius: `gpt-5.4`, read-only tests/scripts/test-lane/secret/repo-hygiene audit
- subagent Erdos: `gpt-5.4`, read-only current development lines audit
- subagent Gibbs: `gpt-5.4`, read-only repo hygiene and line-budget audit
- subagent Carson: `gpt-5.4`, read-only package scripts and GitHub verify workflow audit
- subagent Socrates: `gpt-5.4`, read-only history handoff audit

Commits:

- `6c15846 docs(v22): close OPL docs portfolio lifecycle`
- `a3737eb docs(v22): register current development lines`
- `25bbfdd test(v22): add explicit test lane registry`
- `146b2e1 test(v22): harden review secret hygiene gate`
- `3ca9334 test(v22): add repo hygiene line budget gate`
- `358a768 ci(v22): add root verification entrypoints`
- final handoff commit: records this A branch summary and B review packet.

Scope:

- Close the OPL-style docs portfolio lifecycle with a machine-checked document ledger and one current truth path.
- Register current development lines without advancing the business cursor.
- Replace test classification inference with explicit test lane registry coverage.
- Harden review secret hygiene so B review checks forbidden paths, secret-like paths and effective added lines.
- Add repo hygiene and line-budget gates with an explicit baseline for existing oversized service files.
- Add root `package.json` scripts and GitHub verify workflow as standard engineering entrypoints that wrap existing v22 verify/gate commands.

Contract subscription:

- `AGENTS.md`
- `docs/README.md`
- `docs/active/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `docs/history/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-verify.mjs`
- `scripts/v22-test-classification.mjs`
- `scripts/v22-workflow-gate.mjs`

Verification before handoff:

- `node tests/contract/contract-test-v22-root-verify-workflow-entrypoints.mjs`: pass.
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: pass.
- `node scripts/v22-verify.mjs package root-verify --base origin/recovery/platform-v22-trunk --json`: pass.
- `npm run verify:repo-hygiene`: pass.
- `node scripts/v22-verify.mjs suite repo-hygiene --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- docs tests scripts package.json .github`: pass.

Non-goals:

- No PostgreSQL/Redis implementation.
- No services business code change.
- No product cursor advancement.
- No secret read, real cloud, build/push, kubectl, deploy or live-test.
- No upstream modification.
- No resurrection of retired contract, recovery or legacy script entrypoints.
- No compatibility alias or second current truth.

B review packet:

- Review branch: `cleanup/v22-opl-docs-engineering-loop-closure`.
- Review base: `c66d8d86b05d0673d320d6798d9b4192deb8d4cd`.
- Review focus: docs portfolio lifecycle, current development lines, explicit test lane registry, review secret hygiene, repo hygiene/line budget, root package scripts, GitHub verify workflow, and no services/forbidden-surface changes.
- Verify: run `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs package root-verify --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`, and `git diff --check -- docs tests scripts package.json .github`.
- Absorb rule: only B may fresh review, ff-only merge to `recovery/platform-v22-trunk`, push, and run post-push verification.

Risk notes:

- `tests/fixtures/v22/line-budget-baseline.json` intentionally locks three pre-existing oversized service files; future growth fails until those files are split or the baseline is explicitly reviewed.
- Root `package.json` and `.github/workflows/verify.yml` are local verification entrypoints only. They do not add build, deploy, kubectl, live-test, future-authorized or true-cloud execution.
- Business cursor remains `leaf-portal-postgres-redis-local-production-data-closure`; this branch only hardens the loop that will govern that implementation.

Next recommendation:

- After B absorbs and records post-push closeout, return to `leaf-portal-postgres-redis-local-production-data-closure` as the next product implementation leaf.

landed_commit: `583da292aa32bf021697171f5b5cea1cfc693baf`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json: pass
- node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json: pass
- node scripts/v22-verify.mjs package root-verify --base origin/recovery/platform-v22-trunk --json: pass
- node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk: pass
- git diff --check -- docs tests scripts package.json .github: pass
- forbidden diff and added-lines secret scan: pass

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`

### 2026-05-21 cleanup/v22-post-merge-closeout-and-gate-integrity

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-post-merge-closeout-and-gate-integrity`

Base trunk HEAD: `2e644fc774e567db9418e3d13942e1598434433e`

Model:

- controller: `gpt-5.5` runtime; repository policy for future native subagents remains `gpt-5.4`, `gpt-5.3-codex`, or `gpt-5.4-mini`.
- subagents: none.

Commits:

- `bcf97e8 docs(v22): close current index loop absorb truth`
- `a57ac0c test(v22): gate workflow command references`
- final closeout commit: records this A handoff.

Scope:

- Close the absorbed `cleanup/v22-current-state-index-loop-normalization` truth to `2e644fc774e567db9418e3d13942e1598434433e`.
- Align `docs/active/README.md`, this history summary, and `tests/fixtures/v22/goal-current.json` on the same latest absorbed commit.
- Harden workflow start templates so every referenced `tests/**/*.mjs` command must point at an existing tracked test file.
- Replace stale workflow template commands that referenced retired tests with current existing gates.
- Add this cleanup branch override to the verify manifest without changing the business cursor.

Contract subscription:

- `AGENTS.md`
- `docs/active/README.md`
- `docs/history/README.md`
- `docs/policies/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-verify.mjs`
- `scripts/v22-workflow-gate.mjs`

Verification before handoff:

- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`: pass.
- `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs`: pass.
- `node tests/health/health-check-v22-workflow-gate.mjs`: pass.
- `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- docs tests scripts`: pass.

landed_commit: `c66d8d86b05d0673d320d6798d9b4192deb8d4cd`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass with temporary ignored `node_modules` symlink in the B worktree; symlink removed after verification.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass; post-push workflow gate `ok:true`.
- `git diff --check -- docs tests scripts`: pass.
- forbidden diff and secret scan: pass, no findings.

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`

Non-goals:

- No PostgreSQL/Redis implementation.
- No services business code change.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream modification.
- No compatibility layer or old contracts/recovery/scripts resurrection.

B review result:

- Review branch: `cleanup/v22-post-merge-closeout-and-gate-integrity`.
- Review base: `2e644fc774e567db9418e3d13942e1598434433e`.
- Review focus: latest absorbed commit closeout, workflow start-template test reference integrity, manifest branch override, no services/forbidden-surface changes, and no business cursor advancement.
- Verify: run `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`, and `git diff --check -- docs tests scripts`.
- Absorbed by B with ff-only merge, pushed to `origin/recovery/platform-v22-trunk`, post-push verification recorded above.

Next recommendation:

- Continue OPL-style docs/software engineering loop closure before running the product cursor `leaf-portal-postgres-redis-local-production-data-closure`.

### 2026-05-21 cleanup/v22-current-state-index-loop-normalization

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-current-state-index-loop-normalization`

Base trunk HEAD: `3ca2ee48f55bb154776c60605a497d9a2e7e1752`

Model:

- controller: `gpt-5.4`
- subagent Rawls: `gpt-5.4`, read-only OPL-style docs taxonomy / index-loop audit
- subagent Gauss: `gpt-5.4`, read-only goal-current / manifest / verify runner audit
- subagent Dewey: `gpt-5.4`, read-only product/runtime/source/data-boundary audit

Commits:

- `82891db docs(v22): tighten autonomous taxonomy index loop`
- `e14f055 docs(v22): close lifecycle absorb truth to latest trunk`
- `2123791 test(v22): gate current state index loop`
- `2e644fc docs(v22): record current state index loop run`

Scope:

- Normalize the OPL-style autonomous index loop: docs root -> active truth -> specs/policies -> delivery -> tests/fixtures/manifest -> verify -> history closeout -> next cursor.
- Replace empty product/runtime contract placeholders with concrete spec-anchor indexes.
- Close the absorbed `cleanup/v22-retirement-lifecycle-system-closure` truth to `3ca2ee48f55bb154776c60605a497d9a2e7e1752`.
- Add `contract-test-v22-current-state-index-loop.mjs` and wire it into current, local-contract, and history-closeout verification.
- Keep the business cursor on `leaf-portal-postgres-redis-local-production-data-closure`.

Contract subscription:

- `AGENTS.md`
- `docs/README.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `docs/history/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-verify.mjs`
- `scripts/v22-workflow-gate.mjs`

post_push_verification:

- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`: pass.
- `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs`: pass.
- `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- docs tests scripts`: pass.


landed_commit: `2e644fc774e567db9418e3d13942e1598434433e`

landing_gate_result: `passed / ff-only landed / pushed`

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`

Non-goals:

- No PostgreSQL/Redis implementation.
- No services business code change.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream modification.
- No Figma UI visual/layout/information-architecture change.
- No compatibility layer or old contracts/recovery/scripts resurrection.

B review result:

- Review branch: `cleanup/v22-current-state-index-loop-normalization`.
- Review base: `3ca2ee48f55bb154776c60605a497d9a2e7e1752`.
- Review focus: docs root truth lookup, product/runtime spec-anchor indexes, latest absorbed commit closeout, new index-loop gate, manifest current/local-contract/history-closeout wiring, and no services/forbidden-surface changes.
- Verify: run `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`, and `git diff --check -- docs tests scripts`.
- Absorbed by B with ff-only merge, pushed to `origin/recovery/platform-v22-trunk`, post-push verification recorded above.

Next recommendation:

- Run the product cursor `leaf-portal-postgres-redis-local-production-data-closure`.

### 2026-05-20 cleanup/v22-retirement-lifecycle-system-closure

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-retirement-lifecycle-system-closure`

Base trunk HEAD: `2a4254915f43186e312f406e5de31629c1c6700b`

landed_commit: `3ca2ee48f55bb154776c60605a497d9a2e7e1752`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs`: pass.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- docs tests scripts`: pass.

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`

Model:

- controller: `gpt-5.4`

Commits:

- `2d2ee07 docs(v22): codify retirement lifecycle rules`
- `42a2cbf test(v22): add retirement lifecycle gate`
- `82a1d4b test(v22): wire retirement lifecycle gate into verify manifest`
- final closeout commit: records hard retirement post-merge truth and this A handoff.

Scope:

- Codify the OPL-style retirement lifecycle as the default MedOPL v22 development loop.
- Add a machine gate that checks taxonomy truth, history closeout schema, retired-path protection, tests taxonomy, and manifest wiring.
- Record the post-merge closeout for `cleanup/v22-full-taxonomy-hard-retirement`.
- Keep the business cursor on `leaf-portal-postgres-redis-local-production-data-closure`.

Contract subscription:

- `AGENTS.md`
- `docs/active/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/history/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-verify.mjs`
- `scripts/v22-workflow-gate.mjs`

Non-goals:

- No PostgreSQL/Redis implementation.
- No services business code change.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream modification.
- No Figma UI visual/layout/information-architecture change.

Next recommendation:

- Run the product cursor `leaf-portal-postgres-redis-local-production-data-closure` after this index-loop normalization is reviewed.

### 2026-05-20 cleanup/v22-full-taxonomy-hard-retirement

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-full-taxonomy-hard-retirement`

Base trunk HEAD: `365c2a676ed243ead64338d62ce2ec6262ce4767`

landed_commit: `2a4254915f43186e312f406e5de31629c1c6700b`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- AGENTS.md README.md DESIGN.md docs tests scripts services/portal/src`: pass.

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`

Model:

- controller: `gpt-5.4`
- subagent Kant: `gpt-5.4`, read-only recovery/truth audit
- subagent Nietzsche: `gpt-5.4`, read-only smoke/eval audit
- subagent Turing: `gpt-5.4`, read-only scripts/reference audit

Scope:

- Adopt OPL-style docs taxonomy as active truth.
- Absorb distributed contracts into `docs/specs/README.md`.
- Retire legacy recovery/docs/scripts/test fixtures that only carried stage history.
- Keep `scripts/sync-workspace-file-to-minio.ps1` because `services/portal/src/config/portal-config.mjs` still references it and this branch does not modify services.
- Keep current business cursor on `leaf-portal-postgres-redis-local-production-data-closure`; this cleanup does not claim PostgreSQL/Redis implementation.

Contract subscription:

- `AGENTS.md`
- `docs/active/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-verify.mjs`
- `scripts/v22-test-classification.mjs`
- `scripts/v22-workflow-gate.mjs`

Non-goals:

- No PostgreSQL/Redis implementation.
- No services business code change.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream modification.
- No Figma UI visual/layout/information-architecture change.

Commits:

- `7516c29 cleanup(v22): retire eval smoke filename semantics`
- `89b57cd cleanup(v22): absorb contracts into specs truth`
- `78e4a7b cleanup(v22): retire recovery into taxonomy truth`
- `06f4d4e docs(v22): record full taxonomy hard retirement run`
- `5508387 fix(v22): allow authorized taxonomy smoke-name deletions`
- final closeout commit: records this post-fix trace update.

Verification before closeout:

- `node tests/regression/portal/regression-test-v22-portal-runtime-suite.mjs --group all`: pass.
- `node tests/contract/contract-test-v22-mvp-contract-suite.mjs`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite local-regression --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- AGENTS.md README.md DESIGN.md docs tests scripts`: pass.
- Added-lines secret value scan over `origin/recovery/platform-v22-trunk...HEAD` and `AGENTS.md README.md DESIGN.md docs tests scripts`: pass, no matches.
- Local-regression note: this isolated worktree has no installed `services/portal/frontend/node_modules/typescript`; final local-regression was re-run with temporary ignored symlinks to the main worktree's existing `services/portal/node_modules` and `services/portal/frontend/node_modules`, then those symlinks were removed before handoff.
- Retired-path scan for old recovery/contracts/root-doc/helper-script literals: only the hard-retirement self-test retains constructed legacy literals as a regression guard.

B review packet:

- Review branch: `cleanup/v22-full-taxonomy-hard-retirement`.
- Review base: `365c2a676ed243ead64338d62ce2ec6262ce4767`.
- Review focus: docs taxonomy hard retirement, `docs/specs/README.md` as single spec truth, `docs/active/README.md` as single current truth, `tests/fixtures/v22/*` as machine truth, and `scripts/` reduced to runner/classifier/workflow plus the service-referenced PowerShell helper.
- Verify: run `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs suite local-regression --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`, and `git diff --check -- AGENTS.md README.md DESIGN.md docs tests scripts`.
- Absorb rule: only B may fresh review, ff-only merge to `recovery/platform-v22-trunk`, push, and run post-push verification.

Risk notes:

- Large deletion diff is intentional. B should check that removed contract leaves are absorbed into `docs/specs/README.md`, removed recovery stage records are summarized here, and removed tests are no longer active manifest entries.
- `scripts/sync-workspace-file-to-minio.ps1` remains because services still reference it; removing it requires a service-surface branch.
- `local-regression` now runs `tests/regression/portal/regression-test-v22-portal-runtime-suite.mjs --group all`; that suite excludes build and true cloud operations.
- B review and absorb happened outside this A window; this lifecycle closure records the post-merge truth.

Next recommendation:

- Resume the current product cursor: `leaf-portal-postgres-redis-local-production-data-closure`.

## Reading Rule

Use history to understand how a change was made. Use active/specs/policies/delivery/source and verify fixtures to decide what is currently true.

When judging whether the current loop is closed, do not stop at one run summary. Check `docs/active/README.md`, `docs/delivery/README.md`, `tests/README.md`, `tests/fixtures/v22/goal-current.json`, and `tests/fixtures/v22/agent-verify-manifest.json` together.

### 2026-05-22 feat/v22-backend-go-convergence-program stage-6

Status: `ready_for_landing_review`

Branch: `feat/v22-backend-go-convergence-program`

Base trunk HEAD: `82bbf09e3bdfd2d2f4f746353ec9b9fa3cc5eb7f`

Model:

- controller: `gpt-5 runtime`
- subagent Volta: `gpt-5.4`, read-only Stage 6 Step 13/14 risk review before implementation.
- subagent Euclid: `gpt-5.4`, read-only Step 13 spec compliance review; returned FAIL on locator-like command fields, then closed after fix.
- subagent Harvey: `gpt-5.4`, read-only Step 13 code quality review; returned FAIL on idempotency, approval binding and store index invariants, then closed after fix.
- subagent Mendel: `gpt-5.4`, read-only Step 13 re-review after fixes; returned PASS.
- subagent Mill: `gpt-5.4`, read-only Step 14 review; returned FAIL because the first cut only added a parallel workflow command endpoint.
- subagent Galileo: `gpt-5.4`, read-only Step 14 re-review after action routes were added; returned PASS.

Scope:

- Add a Go workflow facade command model with `Command`, `Execution`, `ApprovalTask`, idempotent command creation and explicit pending/running/succeeded/failed/cancelled transitions.
- Keep workflow facade pure domain/service/repository: no Temporal, LangGraph, Redis client, Postgres client, HTTP client, runtime broker, cloud adapter, secret, token or object locator field.
- Make command idempotency safe for replay and write-race cases; semantic conflicts fail closed instead of returning an unrelated execution.
- Require approval tasks to bind the execution that belongs to the command, and keep memory workflow store command/idempotency indexes immutable on update.
- Route Go backend long-task actions through workflow facade by adding `/workflow/commands`, `/runtime/launch`, `/runs`, `/billing/freeze` and `/resources/release` as thin command handoff endpoints.
- Keep launch, run, billing freeze and release routes fixed to workflow command types and return `202/pending` only; they do not call `runfileartifact`, `runtimebroker`, cloud, billing or release implementations.
- Register workflow facade and routed command gates in test lane registry, current/local-contract/review suites and backend convergence package.

Commits:

- `b0d5d0b feat(go): add workflow facade command model`
- `8d3ba8c refactor: route launch run billing release through workflow facade`

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/specs/README.md`
- `docs/runtime/README.md`
- `docs/source/README.md`
- `docs/delivery/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-test-classification.mjs`
- `services/medopl-go-backend/**`

Verification before landing review:

- `node tests/contract/contract-test-v22-go-backend-workflow-facade-command-model.mjs`
- `node tests/contract/contract-test-v22-go-backend-workflow-routed-command-boundary.mjs`
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`
- `GOROOT=/tmp/medopl-go-toolchain/root/usr/lib/go-1.22 PATH=/tmp/medopl-go-toolchain/root/usr/lib/go-1.22/bin:$PATH GOMODCACHE=/tmp/medopl-go-modcache GOCACHE=/tmp/medopl-go-buildcache go test ./...` from `services/medopl-go-backend`
- `node scripts/v22-verify.mjs package backend-go-convergence --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- docs tests scripts package.json services/portal/src services/medopl-go-backend`

B review pack:

- `git diff --stat origin/recovery/platform-v22-trunk...HEAD`: branch currently spans 83 files and 8523 insertions / 52 deletions across Stage 1-6 docs, tests, fixtures, Node facade gates and Go backend target code.
- `git show --name-only --oneline HEAD`: `8d3ba8c refactor: route launch run billing release through workflow facade`.
- Contract review: Step 13 and Step 14 both used RED contract tests before implementation and subagent re-review after required fixes.
- Secret hygiene: review gate reported no secret-like paths and no secret-like added lines.
- Pollution check: no `deploy/*`, `.sentrux/*`, `adapters/*`, `infra/*`, upstream, `.runtime/*`, secret path, real cloud, build/push, kubectl, deploy or live-test operation.
- Product narrative check: no restored `user_owned`, `resource-order`, old runner/provisioner, OpenCost or Langfuse primary narrative.
- Fake success check: workflow action routes return only pending workflow executions; they do not call runtime, run, billing, cloud or release execution surfaces.
- Durable engine check: Temporal/LangGraph remain absent; future durable execution can replace implementation behind `internal/service/workflow` without changing routes or runtime/cloud contracts.
- Landing recommendation: Stage 6 is ff-only absorbable by B review if the full branch is selected for landing; authoring can continue to Stage 7 before final landing.

Non-goals:

- No Temporal, LangGraph or durable workflow engine.
- No real Runtime Bridge HTTP client.
- No real OPL call.
- No real PostgreSQL or Redis connection.
- No cloud resource mutation, billing mutation or release execution.
- No commercial package or UI decision.
- No production Go backend replacement claim.
- No secret read, live cloud call, build/push, kubectl, deploy or live-test.
- No upstream, deploy, `.sentrux`, `adapters`, `infra` or `.runtime` edits.

Risk notes:

- Go route wiring currently uses an in-memory workflow store for deterministic local proof; PostgreSQL-backed repository remains a later production implementation behind the same repository interface.
- The workflow facade is structural convergence, not production durable execution. It creates a clean replacement point for Temporal or another durable engine later.
- Node Portal remains migration-period active implementation; Stage 6 prevents new Go long-task entrypoints from bypassing workflow but does not claim full Node-to-Go production cutover.

Next recommendation:

- Proceed to Stage 7: define the commercial package model after structural convergence, then decide UI impact based on whether Portal already answers what the customer bought, whether it is usable, what is missing, where to click next, where results are and whether cost state is normal.
