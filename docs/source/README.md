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

active surface、OPL entry、upstream clean、zero-compat、禁止恢复旧入口和当前 source surface 统一见 `docs/active/README.md`。旧分散 active-surface 文档不得恢复为 current active-surface 入口。

source cleanup 完成后仍必须经过 landing gate 和 post-merge closeout，不能把清退分支直接写成稳定 current truth。
