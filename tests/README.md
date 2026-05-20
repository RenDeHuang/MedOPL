# Tests Taxonomy

Owner: `MedOPL`
Purpose: `tests_taxonomy_skeleton`
State: `taxonomy_skeleton`
Machine boundary: 本文是目标测试目录说明。当前可执行 eval 仍在 `scripts/smoke-test-v22-*`，分类权威仍是 `scripts/v22-smoke-classification.mjs`。

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

## Current Compatibility

本分支不迁移测试文件。当前统计来自 `scripts/v22-smoke-classification.mjs`：

- `health-check`: 6
- `smoke-golden`: 11
- `contract-local`: 25
- `local-regression`: 62
- `future-authorized`: 48

## Migration Rule

后续 tests 迁移必须先改 classification source，再改 suite wrapper，再改 `docs/recovery/v22-agent-verify-manifest.json` 和 `scripts/v22-verify.mjs` 命令引用，最后移动文件。禁止只移动文件而不迁 runner / gate 引用。

