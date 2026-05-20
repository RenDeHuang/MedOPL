# Source Truth

Owner: `MedOPL`
Purpose: `source_surface_truth`
State: `taxonomy_skeleton`
Machine boundary: 本文是人读 source surface 摘要。实际允许写入范围仍由 `AGENTS.md`、contracts、branch manifest 和 B review 裁定。

## Active Source Surface

当前 v22 active service surface：

- `services/portal`
- `services/opl-web-gateway`
- `services/opl-runtime-bridge`

Current docs / eval surface during migration:

- `docs/product.md`
- `docs/architecture.md`
- `docs/contracts/v22-*`
- `docs/recovery/*`
- `scripts/smoke-test-v22-*`
- `scripts/v22-verify.mjs`
- `scripts/v22-smoke-classification.mjs`

## Forbidden Without Authorization

- `deploy/*`
- `.sentrux/*`
- `adapters/*`
- one-person-lab upstream
- build/push/kubectl/live-test/真实云资源操作
- secret-like paths

## Retired Source Semantics

`user_owned`、`resource-order`、旧 `med-autoscience-runner`、旧 `resource-provisioner`、OpenCost 主叙事和 Langfuse 主产品叙事不得恢复为 active source、默认入口、fixture、compat alias 或文档默认上下文。

## Migration Status

本 README 是 source taxonomy skeleton。它不扩大 active surface，不授权修改 services，也不替代 branch-level allowlist。

