# Source Truth

Owner: `MedOPL`
Purpose: `source_surface_truth_view`
State: `hard_compacted_view`
Machine boundary: 本文是 source surface 视角入口，不是第二份 current truth。实际允许写入范围仍由 `AGENTS.md`、contracts、branch manifest 和 landing gate 裁定；authoring branch 必须先按当前 truth / gap / eval 声明写入范围。

当前被 tests/runner 直接消费的大型机器 owner payload 已拆到 root `contracts/**`；`tests/fixtures/v22/goal-current.json` 只保 machine cursor 与这些合同的引用字段，不再充当巨型 owner payload 仓库。

## Active Source Surface

当前 v22 active service surface：

- `services/portal/frontend`
- `services/medopl-go-backend`
- `services/opl-web-gateway`
- `services/opl-runtime-bridge`

Go / pre-cloud deployment surface：

- `services/medopl-go-backend` is the local pre-cloud SaaS backend deployment surface before real-cloud readiness.
- `services/portal/frontend` is the Portal frontend deployment surface.
- `scripts/v22-local-services.mjs` owns the repo-native local service plan, start/stop/status/logs lifecycle, local URL health probe and dry-run RC verification for Portal frontend, Go backend, OPL Web Gateway, Runtime Bridge and external clean OPL WebUI. PID and logs stay under `.runtime/local-services`; clean OPL WebUI is only an external endpoint and is never started or stopped by MedOPL. It does not read secrets, deploy, kubectl, build/push or call real cloud.
- `tests/support/cloud-prework` owns bounded Tencent/TKE pre-cloud test support for readonly inventory, Package C dry-run planning, TKE bootstrap preflight, Package C live runner state-machine evidence, the gated Package C PostgreSQL ledger sink support path, Package D Kubernetes API server-side dry-run / bootstrap / run-scoped Job preflight runners, Package D private image publish runners, the repo-native Package D production deploy plan/apply runner and the Production Launch Gap 01 / Gap 02 / Gap 03 contract runners. Package C planning models tenant node pool lifecycle per tenant or workspace; TKE bootstrap preflight only records the unified cluster and platform service node pool foundation. Package D cloud runners are future-authorized entrypoints for later authorized Kubernetes API connectivity, `kubectl apply --server-side --dry-run=server`, bootstrap apply, preflight Job execution and production deploy apply through reviewed manifest shapes; the production launch bootstrap, operation and ledger runners are contract/local-gate only for first admin / tenant / workspace seed, Portal -> Go backend -> Package C operation shape, ResourceBinding / CloudOperation write/read shape, providerKeyRef boundary and redacted evidence. Local tests use fake inputs and fake kubectl/docker only. These support modules are not default `scripts/` control-plane entrypoints; they remain guarded by future-authorized tests, explicit authorization flags and `.runtime` evidence sinks.
- `services/medopl-go-backend/internal/domain/controlplane`, `internal/repository/controlplane`, `internal/repository/memory`, `migrations/0001_baseline.sql` and `ent/schema/{resourcebinding,cloudoperation}.go` own the current PostgreSQL `resource_bindings` / `cloud_operations` ledger lower bound for Package C tenant node pool lifecycle. The repository contract now exposes create resource binding, append cloud operation event, node pool id update, lifecycle status update, released, failed and cleanupRequired writes; the memory implementation is the local/dry-run contract store. `tests/support/cloud-prework/v22-package-c-live-canary-live-runner.js` now projects the authorized tenant node pool lifecycle into the same ResourceBinding / CloudOperation status vocabulary for `.runtime` evidence and can call an injected ledger sink for repository write wiring. `tests/support/cloud-prework/package-c-postgres-ledger-sink.js` adds gated PostgreSQL execution sink support and CLI modes for prepare-only plus explicit live canary write/read/cleanup: both use the root `pg` driver dependency and require `RUN_MEDOPL_POSTGRES_LEDGER_EXECUTION=1`, allowlisted local DB env keys, schema/write-permission preflight and redacted `.runtime` evidence; live canary also requires `RUN_TENCENT_CREATE_RELEASE_EXECUTION=0`, a dedicated authorized ledger env file, existing tenant/workspace parent rows, canary-scoped `resourceBindingId`, post-write readback and cleanup readback-absent confirmation. This source surface records canonical ownership / billing truth in MedOPL ledger shape, not Tencent `tke:nodepool` tags. It does not implement Portal self-service opening, an authorized successful real PostgreSQL canary run, billing/audit ledger, workspace quota, deploy, kubectl or new Tencent mutation.

`services/medopl-go-backend` 必须通过 source、tests、fixtures、manifest、workflow review、package verification 和 pre-cloud deployable RC 进入 real-cloud-readiness；不能只靠目录存在或 prose claim 成为 production truth。当前 authoring branch 的 pre-cloud deployable RC 只覆盖 Portal frontend -> Go `/api`、provider/preflight/launch、workspace/file/run/artifact、billing/audit、resource projection、release/stop-billing 和 cloud connector fail-closed 的 deterministic local proof，不证明 live provider、真实 upstream OPL、real cloud 或 production billing。

Retirement surface：

- `services/portal/src` 已物理清退。Node Portal backend is not a deployable control plane, not a Portal frontend proxy target, not a typed API owner and not a current verification owner. It may appear only as a negative guard or historical path in docs/history/git history.
- Portal frontend lab typed API ownership is Go-only through `services/medopl-go-backend` and `/api/lab-*`; deleted Node lab routes must not be treated as frontend typed API truth, current backend truth, compatibility control plane or real-cloud readiness evidence.

## Productization Source Order

当前目标是完全现代化前后端分离。`services/portal/frontend` 是 React/Vite/TypeScript frontend；`services/medopl-go-backend` 是 Go control-plane / pre-cloud SaaS backend；`services/portal/src` 已物理清退，不是 active backend/API/server。后续 source order 是：

1. Figma Make UI 已归档为外部 design input；repo-native Portal frontend source 和本地 eval 才是实现 truth。
2. Portal typed API contract 已归档：Portal frontend 只能通过 typed API modules 读取 backend projection；不能让页面直接复制 mock readiness、mock billing、mock resource 或 mock OPL launch truth。
3. Provider key reuse 必须在后端 secret boundary 内完成；frontend 只持有 `providerKeyRef`、bound status 和一次性输入态。
4. OPL entry real preflight / launch 已归档为本地 projection truth：OPL entry UI 必须接真实 preflight / launch / providerKeyRef / Gateway readiness API，不得把 Figma prototype state 或 page-local fallback 写成 readiness truth。
5. Go backend 接管 MedOPL control-plane business truth；Node Gateway / Runtime Bridge 继续作为薄边界，但不能扩张成 billing ledger、cloud inventory 或 product truth。
6. Real-cloud readiness 只能在 pre-cloud deployable RC 通过后开启，不能让 Node Portal backend 作为 first-cloud control plane。

迁移期源码边界：

- `services/portal/frontend` 是 active frontend implementation；它必须通过 typed API 读取 Go control-plane projection。
- `services/medopl-go-backend` 是 pre-cloud SaaS backend implementation；它承接 Portal typed API、providerKeyRef 边界、launch/preflight decision、billing/audit/resource workflow、release/stop billing、Go `/healthz`/`/readyz` 和 cloud connector fail-closed API，相关 pre-cloud eval 必须在 manifest/test lane registry 中可追踪。
- Portal admin projection 的本地 RC 可变面（users、finance ledger、announcements）由 Go backend 的 `MEDOPL_PORTAL_STATE_ROOT` 持久化到 `.runtime/local-services/portal-state`。该状态只证明本地 Portal delivery 可抗 Router 重建；它不是真实云账本、production billing 或外部 provider truth。
- `services/portal/src` 已物理清退；它不得恢复为长任务编排、cloud mutation、billing mutation、audit reconciliation、canonical store 或 runtime launch truth。
- Node Portal v22 control-plane routes and domains for `/portal/api/v22/users/*`, `/portal/api/v22/provider-key`, `/portal/api/v22/managed-environment/readiness`, `/portal/api/v22/managed-environment/open`, `/portal/api/v22/managed-environment/release` and `/portal/api/v22/opl-work/*` are physically retired from active code. 当前 owner 是 `services/medopl-go-backend` 的 `/api/v22/*`、`/api/provider/*` 和 `/api/opl/*`。
- `services/portal/src/app/portal-runtime.mjs` 已物理删除，不得作为部署入口、typed API owner 或当前 verify owner。
- `services/opl-web-gateway` 继续作为 Gateway / clean upstream anti-corruption boundary，优先保持薄边界。
- `services/opl-runtime-bridge` 继续作为 Runtime Bridge / Runtime Agent integration boundary；它不是 billing ledger truth 或 cloud inventory truth。容器默认 state root 是 `/tmp/medopl-runtime/.runtime`，Package D manifest 必须通过非 secret env 和 writable volume 保持该路径可写，不能默认写 `/.runtime`。
- `real-cloud-authorization-boundary` 仍是单独 Operations cursor；本地 Portal/OPL delivery source 不能授权 secret、真实云、deploy、kubectl、build/push 或 live-test。

Backend physical removal gate：

- `tests/contract/contract-test-v22-node-portal-backend-physical-removal.mjs` 是当前机器入口，验证 `services/portal/src` 不存在、Portal frontend 只走 Go `/api`、旧 Node facade/gate/fixture 不回到 manifest。
- `tests/contract/contract-test-v22-backend-go-convergence-program.mjs` 只验证 Go takeover 已关闭、本地控制面 owner 是 `services/medopl-go-backend`、real-cloud 仍停在授权边界；不再依赖 backend inventory 或 migration-map fixture。

Current docs / eval surface during migration：

- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `docs/public/README.md`
- `docs/references/README.md`
- `docs/history/README.md`
- `tests/**/*.mjs`
- `tests/fixtures/v22/{goal-current,agent-verify-manifest}.json`
- `scripts/v22-verify.mjs`
- `scripts/v22-test-classification.mjs`
- `scripts/v22-workflow-gate.mjs` (stable CLI / public exports)
- `scripts/workflow-gate/*.mjs` (workflow gate helper modules for git diff, policy, change package validation, command reference checks and report rendering)
- `tests/support/cloud-prework/*` only when a subscribed cloud-prework test or explicit authorization package names the support module.

## Forbidden Without Authorization

- `deploy/*`
- `.sentrux/*`
- `adapters/*`
- `infra/*`
- one-person-lab upstream
- build/push/kubectl/live-test/真实云资源操作
- secret-like paths

## Cleanup Source Semantics

| Cleanup item | Must not return as |
| --- | --- |
| `user_owned` primary path | product mainline, code default, fixture, compat alias |
| `resource-order` primary path | product mainline, route, state model, fixture |
| 旧 `med-autoscience-runner` | active service, runtime bridge dependency, default task runner |
| 旧 `resource-provisioner` | active service, cloud lifecycle source, billing source |
| OpenCost 主叙事 | product billing truth, Portal ledger source |
| Langfuse 主产品叙事 | product trace truth, required production dependency |
| v19/v20/v21 OPL direct path / direct upstream path / internal path | user-visible entry, default OPL route, fixture |
| one-person-lab upstream internals | active source import, Portal/Gateway/Runtime Bridge implementation surface |

## Current Truth Pointer

active source surface、OPL entry、upstream clean、zero-compat、禁止恢复旧入口和当前 source surface 由本文、`docs/runtime/README.md` 和 `docs/specs/README.md` 持有。当前阶段、cursor、blocker 和 verification entry 才看 `docs/active/README.md`。旧分散 active-surface 文档不得恢复为 current active-surface 入口。

source cleanup 完成后仍必须经过 landing gate 和 post-merge closeout，不能把清退分支直接写成稳定 current truth。
