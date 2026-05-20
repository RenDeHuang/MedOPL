# Source Truth

Owner: `MedOPL`
Purpose: `source_surface_truth_view`
State: `hard_compacted_view`
Machine boundary: 本文是 source surface 视角入口，不是第二份 current truth。实际允许写入范围仍由 `AGENTS.md`、contracts、branch manifest 和 B review 裁定。

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

## Retired Source Semantics

`user_owned`、`resource-order`、旧 `med-autoscience-runner`、旧 `resource-provisioner`、OpenCost 主叙事和 Langfuse 主产品叙事不得恢复为 active source、默认入口、fixture、compat alias 或文档默认上下文。

## Current Truth Pointer

active surface、OPL entry、upstream clean、zero-compat、禁止恢复旧入口和当前 source surface 统一见 `docs/active/README.md`。旧分散 active-surface 文档不得恢复为 current active-surface 入口。
