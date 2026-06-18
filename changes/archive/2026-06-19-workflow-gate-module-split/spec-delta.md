# workflow-gate-module-split Spec Delta

Target specs:

- specs/framework/spec.md

## ADDED

- `framework:repo-native-change-lifecycle` 的 workflow gate source 可以由稳定 CLI 入口和 owner-scoped helper modules 组成；`scripts/v22-workflow-gate.mjs` 负责公开导出与 CLI surface，复杂逻辑进入 `scripts/workflow-gate/*.mjs`。

## MODIFIED

- `framework:structured-closeout-audit` 与 `framework:opl-style-development-discipline-convergence` 的 owner surface 仍然是 `scripts/v22-workflow-gate.mjs`，但其实现不再要求 monolithic file。

## REMOVED

- 对 workflow gate monolith 结构的隐式依赖。

## CANNOT-CLAIM

- 本次拆分不证明 workflow governance 已收缩 scripts 文件预算，也不证明 repo bloat policy 已为 helper modules 授权。
- 本次拆分不改变 runtime behavior、landing protocol、deploy/readiness 或任何商业化能力。

## EVALS

- `node tests/health/health-check-v22-workflow-gate.mjs`
- `node tests/health/health-check-v22-workflow-command-reference-gate.mjs`
- `node tests/contract/contract-test-v22-review-secret-hygiene-gate.mjs`
- `node tests/contract/contract-test-v22-diff-scoped-sensitive-hygiene.mjs`
- `npm run test:health`
- `npm run test:contract`
- `npm run repo:bloat`
- `git diff --check`
