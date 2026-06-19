# Source Truth

Owner: `MedOPL`
Purpose: `source_surface_truth_view`
State: `hard_compacted_view`
Machine boundary: 本文是 source surface 视角入口，不是第二份 current truth。实际允许写入范围仍由 `AGENTS.md`、contracts、branch manifest 和 landing gate 裁定；authoring branch 必须先按当前 truth / gap / eval 声明写入范围。

当前被 tests/runner 直接消费的大型机器 owner payload 已收薄到 root `contracts/**` 小型 consumer-first 合同；`tests/fixtures/v22/goal-current.json` 只保 machine cursor 与这些合同的引用字段，不再充当巨型 owner payload 仓库。

## Large File Asset Triage

长文件只作为扫描信号，不自动等于拆分或删除。清退顺序必须先判断 owner surface、machine consumer、test lane、lifecycle role 和 current-truth 归属；active caller 迁移完成前不得物理删除，被当前 owner surface 替代后不得保留旧过渡入口。

当前 `>=500` 行 git-tracked 文件分类：

| File | Lines | owner type | consumer / lane | action |
| --- | ---: | --- | --- | --- |
| `services/portal/frontend/package-lock.json` | 6311 | generated dependency lock | npm install / frontend build | keep_durable_asset |
| `package-lock.json` | 1353 | generated dependency lock | root package scripts | keep_durable_asset |
| `tests/smoke/smoke-test-v22-managed-user-loop-contract.mjs` | 884 | smoke current-owner test | smoke lane | split_owner |
| `services/medopl-go-backend/internal/server/handlers/controlplane_test.go` | 873 | backend source/test owner | Go control-plane tests / handlers | split_owner |
| `DESIGN.md` | 743 | human design source | design review / product UI alignment | keep_durable_asset |
| `tests/fixtures/v22/goal-current.json` | 670 | machine fixture | verify / landing closeout / current-state gates | keep_durable_asset |
| `services/medopl-go-backend/internal/service/controlplane/service.go` | 677 | backend source/test owner | Go control-plane tests / handlers | split_owner |
| `services/portal/frontend/src/app/pages/Workspace.tsx` | 653 | active Portal page | frontend route / regression gates | split_owner |
| `services/portal/frontend/src/app/pages/admin/AdminUsers.tsx` | 651 | active Portal page | frontend route / regression gates | split_owner |
| `tests/fixtures/v22/agent-verify-manifest.json` | 646 | machine fixture | verify / landing closeout / current-state gates | keep_durable_asset |
| `scripts/v22-local-services.mjs` | 563 | stable repo CLI | package scripts / local orchestration gates | split_owner |
| `services/portal/frontend/src/app/pages/OPLEntry.tsx` | 557 | active Portal page | frontend route / regression gates | split_owner |
| `services/medopl-go-backend/internal/server/handlers/controlplane_production_contracts.go` | 551 | backend source/test owner | Go control-plane tests / handlers | split_owner |
| `services/opl-runtime-bridge/src/runtime-bridge-launch.mjs` | 546 | runtime bridge source | runtime-bridge regression gates | split_owner |
| `services/portal/frontend/src/app/pages/Overview.tsx` | 533 | active Portal page | frontend route / regression gates | split_owner |
| `services/portal/frontend/src/app/pages/TasksResults.tsx` | 521 | active Portal page | frontend route / regression gates | split_owner |
| `services/portal/frontend/src/app/pages/BillingAudit.tsx` | 509 | active Portal page | frontend route / regression gates | split_owner |
| `tests/regression/opl/regression-test-v22-opl-web-gateway-launch.mjs` | 503 | regression gate | registered regression lane | keep_durable_asset |
| `services/opl-runtime-bridge/src/opl-client.mjs` | 502 | runtime bridge source | runtime-bridge regression gates | split_owner |

Immediate cleanup order:

1. Keep file count as pressure only; block only on missing owner, consumer, lifecycle or registry.
2. Keep root `contracts/**` consumer-first and small; oversized Package D / production launch payloads have been physically retired from active contracts.
3. Keep future-authorized cloud as a small explicit boundary lane; deleted one-off cloud gates must not return as current truth.
4. Split active backend/frontend/runtime files by owner boundary; do not treat active product/source pages as historical cleanup candidates.
5. Keep lockfiles and stable human design source unless their owner changes; they are not cleanup targets merely because they are long.

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
- `tests/support/cloud-prework` owns only bounded Tencent/TKE pre-cloud test support that still has active consumers: readonly inventory support, Tencent official SDK readonly adapter shape, Package C dry-run create/release plan and TKE bootstrap preflight plan. Package D deploy/external access runners, production-launch runners, CLB diagnostics, Package C live canary runner and PostgreSQL live ledger sink support are physically retired from the active source surface.
- `services/medopl-go-backend/internal/domain/controlplane`, `internal/repository/controlplane`, `internal/repository/memory`, `migrations/0001_baseline.sql` and `ent/schema/{resourcebinding,cloudoperation}.go` own the current PostgreSQL `resource_bindings` / `cloud_operations` ledger lower bound for tenant runtime lifecycle. The repository contract exposes create resource binding, append cloud operation event, node pool id update, lifecycle status update, released, failed and cleanupRequired writes; the memory implementation is the local/dry-run contract store. This source surface records canonical ownership / billing truth in MedOPL ledger shape. It does not implement authorized successful real PostgreSQL canary execution, production billing reconciliation, deploy, kubectl or new Tencent mutation.

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
- `services/opl-web-gateway/src/launch-client-script.mjs` 是 gateway launch bridge browser script 的稳定 public entrypoint；carrier 细节拆分到 `services/opl-web-gateway/src/launch-client-script/**`，避免把 direct entry shell、provider key panel、portal API client、native bridge 和 telemetry 长期堆叠在一个千行模板文件里。
- `services/opl-runtime-bridge` 继续作为 Runtime Bridge / Runtime Agent integration boundary；它不是 billing ledger truth 或 cloud inventory truth。容器默认 state root 是 `/tmp/medopl-runtime/.runtime`，Package D manifest 必须通过非 secret env 和 writable volume 保持该路径可写，不能默认写 `/.runtime`。
- `real-cloud-authorization-boundary` 仍是单独 Operations cursor；本地 Portal/OPL delivery source 不能授权 secret、真实云、deploy、kubectl、build/push 或 live-test。

Backend physical removal gate：

- `tests/contracts/contract-test-v22-node-portal-backend-physical-removal.mjs` 是当前机器入口，验证 `services/portal/src` 不存在、Portal frontend 只走 Go `/api`、旧 Node facade/gate/fixture 不回到 manifest。
- `tests/governance/governance-test-v22-backend-go-convergence-program.mjs` 只验证 Go takeover 已关闭、本地控制面 owner 是 `services/medopl-go-backend`、real-cloud 仍停在授权边界；不再依赖 backend inventory 或 migration-map fixture。

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
