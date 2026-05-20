# Policies Truth

Owner: `MedOPL`
Purpose: `policy_truth`
State: `taxonomy_skeleton`
Machine boundary: 本文是人读政策入口。稳定协作纪律仍由 `AGENTS.md` 约束；合同和 verify gate 仍是机器检查边界。

## Stable Rules

- 未授权不得读取 secret、raw provider key、token、kubeconfig、SSH private key 或云凭据。
- 未授权不得真实云调用、build/push、kubectl、deploy 或 live-test。
- 未授权不得修改 `deploy/*`、`.sentrux/*`、`adapters/*` 或 one-person-lab upstream。
- `docs/recovery/agent-runs/*` 是 evidence，不是 product truth。
- `scripts/v22-verify.mjs` 是默认 agent-facing verification 入口。

## Smoke / Eval Policy

`scripts/smoke-test-v22-*` 当前是 repo-local eval 文件族。只有 `health-check` 和 `smoke-golden` 可以被称为 smoke。`contract-local` 与 `local-regression` 是 eval；`future-authorized` 只表示未来授权边界可见性，不授权真实云。

## Physical Retirement Policy

文件可物理清退前必须同时满足：

1. 替代 truth 已写入目标 taxonomy。
2. 活引用已迁移，`rg old/path` 只剩历史或清退说明。
3. gate 证明旧路径不能恢复为 current truth、default verify 或 compatibility alias。

## Current Sources

- `AGENTS.md`
- `docs/contracts/v22-smoke-eval-boundary.md`
- `docs/recovery/agent-runs/README.md`
- `docs/recovery/agent-runs/schema.md`
- `docs/recovery/v22-contract-smoke-eval-index-compaction-index.md`
- `scripts/v22-smoke-classification.mjs`

## Migration Status

本 README 是 policy skeleton。`AGENTS.md`、contracts、recovery policy/index 文件本轮不删除；后续分支可逐步把人读政策吸收到本 README。

