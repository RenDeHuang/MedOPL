# Source Truth

Owner: `MedOPL`
Purpose: `source_surface_truth_view`
State: `hard_compacted_view`
Machine boundary: 本文是 source surface 视角入口，不是第二份 current truth。实际允许写入范围仍由 `AGENTS.md`、contracts、branch manifest 和 landing gate 裁定；authoring branch 必须先按当前 truth / gap / eval 声明写入范围。

## Active Source Surface

当前 v22 active service surface：

- `services/portal`
- `services/opl-web-gateway`
- `services/opl-runtime-bridge`

Backend convergence target surface：

- `services/medopl-go-backend` is the future canonical backend target, not current production backend.

`services/medopl-go-backend` 只能在 backend Go convergence authoring lane 和后续显式 landing gate 中进入 active surface。它进入前必须同时有 source、tests、fixtures、manifest、workflow review 和 package verification；不能只靠目录存在或 prose claim 成为 canonical truth。

迁移期源码边界：

- `services/portal` 是 Node Portal active implementation；它不再扩张长任务编排、cloud mutation、billing mutation、audit reconciliation 或 runtime launch truth。
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
