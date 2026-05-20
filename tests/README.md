# Tests Taxonomy

Owner: `MedOPL`
Purpose: `tests_taxonomy`
State: `active`
Machine boundary: 可执行 v22 eval 只放在 `tests/**/*.mjs`。分类权威是 `scripts/v22-test-classification.mjs`，执行权威是 `scripts/v22-verify.mjs`。

## Target Layout

```text
tests/
  health/
  smoke/
  contract/
  regression/
    portal/
    opl/
    runtime-bridge/
  future-authorized/
    cloud/
  fixtures/
  helpers/
```

## Semantics

- `health`: 仓库、runner、classification 和 gate 健康。
- `smoke`: 最小 product golden path。
- `contract`: 合同、DTO、manifest、禁词和边界断言。
- `regression/portal`: Portal 本地 UI/API/domain 回归。
- `regression/opl`: OPL Gateway、entry、message/file/run 本地回归。
- `regression/runtime-bridge`: Runtime Bridge / Runtime Agent 本地回归。
- `future-authorized/cloud`: cloud/live/deploy/canary/Tencent 等授权后验证；默认不执行。
- `fixtures` / `helpers`: 复用测试资产，不承载产品 truth。

## Current Counts

当前统计来自 `scripts/v22-test-classification.mjs`：

- `health-check`: 6
- `smoke-golden`: 11
- `contract-local`: 28
- `local-regression`: 62
- `future-authorized`: 48
- total: 155

## Hard Rule

- `scripts/smoke-test-v22-*` 已物理退役，不能恢复为 eval 入口。
- `scripts/` 只保留 runner、classifier、workflow 和 support utilities。
- 新 eval 必须落在 `tests/**`，并同步 `scripts/v22-test-classification.mjs`、suite wrapper 和 `docs/recovery/v22-agent-verify-manifest.json`。
