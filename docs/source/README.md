# Source Truth

Owner: `MedOPL`
Purpose: `source_surface_truth_view`
State: `hard_compacted_view`
Machine boundary: 本文是 source surface 视角入口，不是第二份 current truth。实际允许写入范围仍由 `AGENTS.md`、contracts、branch manifest 和 landing gate 裁定；authoring branch 必须先按当前 truth / gap / eval 声明写入范围。

## Active Source Surface

当前 v22 active service surface：

- `services/portal/frontend`
- `services/medopl-go-backend`
- `services/opl-web-gateway`
- `services/opl-runtime-bridge`

Go control-plane MVP takeover surface：

- `services/medopl-go-backend` is the local MVP takeover target before real-cloud readiness.

`services/medopl-go-backend` 必须通过 source、tests、fixtures、manifest、workflow review、package verification 和 Go local RC 进入 real-cloud-readiness；不能只靠目录存在或 prose claim 成为 production truth。当前 authoring branch 的 Go local RC parity 只覆盖 provider/preflight/launch、billing/audit、resource projection 和 release/stop-billing 的 deterministic local proof，不证明 live provider、真实 upstream OPL、real cloud 或 production billing。

Retirement surface：

- `services/portal/src` is a retirement surface for business truth. It may only remain as a temporary shell, local eval dependency or integration relay while Go MVP parity is being implemented. It must not retain Portal control-plane business truth, canonical store, provider binding, launch status, billing/audit, resource workflow or cloud operation authority.
- `services/portal/src/routes/lab-package.routes.mjs` lab package routes remain a retirement shell/local eval dependency for Node workflow-facade boundary checks only. Portal frontend lab typed API ownership is Go-only through `services/medopl-go-backend` and `/api/lab-*`; the Node route must not be treated as frontend typed API truth, current backend truth, compatibility control plane or real-cloud readiness evidence.

## Productization Source Order

当前目标是完全现代化前后端分离。`services/portal/frontend` 是 React/Vite/TypeScript frontend；`services/medopl-go-backend` 是 Go control-plane MVP takeover target；`services/portal/src` 是 Node Portal backend 清退对象，不是长期 active backend/API/server。后续 source order 是：

1. Figma Make UI 已归档为外部 design input；repo-native Portal frontend source 和本地 eval 才是实现 truth。
2. Portal typed API contract 已归档：Portal frontend 只能通过 typed API modules 读取 backend projection；不能让页面直接复制 mock readiness、mock billing、mock resource 或 mock OPL launch truth。
3. Provider key reuse 必须在后端 secret boundary 内完成；frontend 只持有 `providerKeyRef`、bound status 和一次性输入态。
4. OPL entry real preflight / launch 已归档为本地 projection truth：OPL entry UI 必须接真实 preflight / launch / providerKeyRef / Gateway readiness API，不得把 Figma prototype state 或 page-local fallback 写成 readiness truth。
5. Go backend 必须接管 MedOPL control-plane business truth；Node Gateway / Runtime Bridge 在迁移期可以继续作为薄边界，但不能扩张成 billing ledger、cloud inventory 或 product truth。
6. Real-cloud readiness 只能在 Go local RC 通过后开启，不能让 Node Portal backend 作为 first-cloud control plane。

迁移期源码边界：

- `services/portal/frontend` 是 active frontend implementation；它必须通过 typed API 读取 Go control-plane projection。
- `services/medopl-go-backend` 是 local MVP control-plane implementation；它承接 Portal typed API、providerKeyRef 边界、launch/preflight decision、billing/audit/resource workflow 和 release/stop billing，相关 local RC parity eval 必须在 manifest/test lane registry 中可追踪。
- `services/portal/src` 是 Node Portal backend retirement surface；它不再扩张长任务编排、cloud mutation、billing mutation、audit reconciliation、canonical store 或 runtime launch truth。
- Node Portal v22 control-plane routes and domains for `/portal/api/v22/users/*`, `/portal/api/v22/provider-key`, `/portal/api/v22/managed-environment/readiness`, `/portal/api/v22/managed-environment/open`, `/portal/api/v22/managed-environment/release` and `/portal/api/v22/opl-work/*` are physically retired from active code. 当前 owner 是 `services/medopl-go-backend` 的 `/api/v22/*` 和 `/api/opl/*`。
- `services/portal/src/app/portal-runtime.mjs` 只能作为迁移期 shell/eval dependency；不得重新直接 fan-out 到 product domain / presentation helpers，domain/presentation dependency assembly 归 `services/portal/src/app/portal-runtime-app-deps.mjs`，并在 Go parity 后清退。
- `services/opl-web-gateway` 继续作为 Gateway / clean upstream anti-corruption boundary，优先保持薄边界。
- `services/opl-runtime-bridge` 继续作为 Runtime Bridge / Runtime Agent integration boundary；它不是 billing ledger truth 或 cloud inventory truth。

Backend responsibility inventory：

- `tests/fixtures/v22/backend-go-convergence/backend-inventory.json` 是 Step 4 机器盘点入口。
- `tests/contract/contract-test-v22-backend-go-convergence-program.mjs` 验证该盘点覆盖 `services/portal/src`、`services/opl-web-gateway/src` 和 `services/opl-runtime-bridge/src` 的全部 `.mjs` active backend 文件。
- 盘点分类只允许 `correct-place`、`misplaced`、`migrate-later` 和 `delete-later`；高风险标签必须显式覆盖 Portal 长任务、cloud mutation、内存 launch truth、billing/audit 聚合和 runtime bridge token/secret 边界。

Node-to-Go migration map：

- `tests/fixtures/v22/backend-go-convergence/migration-map.json` 是 Step 5 机器迁移映射入口。
- `tests/contract/contract-test-v22-backend-go-convergence-program.mjs` 验证每个 `misplaced` / `delete-later` 文件至少有一个 migration node，关键 Portal -> Runtime Bridge、Runtime Bridge -> OPL / Runtime Agent、Portal -> Billing/Audit edge 都有 forbidden secret/token field。
- migration map 只能映射到 Go canonical backend 分层或保留明确 Node boundary；不得把 `user_owned`、`resource-order`、旧 runner/provisioner、OpenCost 或 Langfuse 主叙事恢复为目标节点。

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
- `scripts/v22-workflow-gate.mjs`

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
