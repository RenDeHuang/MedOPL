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
- `docs/product.md`
- `docs/architecture.md`
- `docs/contracts/v22-*`
- `docs/recovery/*`
- `tests/**/*.mjs`
- `scripts/v22-verify.mjs`
- `scripts/v22-test-classification.mjs`

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

active surface、OPL entry、upstream clean、zero-compat、禁止恢复旧入口和当前 migration surface 统一见 `docs/active/README.md`。旧 `docs/recovery/active-surface.md` 已被吸收到 current truth，不得恢复为 current active-surface 入口。
