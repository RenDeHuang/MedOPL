# workflow-gate-module-split Proposal

Status: authoring
Branch: cleanup/v22-workflow-gate-module-split
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL governance
Affected plane: Framework

## Why

`scripts/v22-workflow-gate.mjs` 已增长到 900+ 行，入口、git diff、policy、change package 校验、命令引用校验和 report 渲染混在一起，超出薄入口边界，也让 gate 自测只能盯 monolith 字符串。

## Goals

- 把 `scripts/v22-workflow-gate.mjs` 拆成薄 CLI + `scripts/workflow-gate/*.mjs` 模块。
- 保持 `evaluateReview`、`evaluateCheckpoint`、`findMissingLocalCommandReferences` 等既有导出继续可用。
- 保持 review/checkpoint/start 语义不变，只收薄结构，不进入新商业化实现。
- 同步 gate 自测、文档说明和 change package，使 workflow gate 的 owner surface 与当前结构一致。

## Non-Goals

- 不改 review policy、secret hygiene 规则、cleanup 授权规则或推荐命令语义。
- 不新增 deploy、kubectl、build/push、live-test、真实云或 secret 读取能力。
- 不修改 `.sentrux/*`、`deploy/*`、`adapters/*`、`infra/*` 或 one-person-lab upstream。

## Golden Path Impact

- no-impact: 这是 workflow gate 结构治理，不改 golden path 运行时行为。
- affected steps: control-plane governance、change package review、checkpoint report。
- required golden path eval: `node tests/health/health-check-v22-workflow-gate.mjs`、`node tests/health/health-check-v22-workflow-command-reference-gate.mjs`、`node tests/contract/contract-test-v22-review-secret-hygiene-gate.mjs`、`npm run test:health`、`npm run test:contract`。

## Authorization Boundary

- No secret read.
- No real cloud, deploy, kubectl, build/push or live-test.
- Allowed write surface is limited to the workflow gate source, subscribed tests, fixture path references, framework/source docs and this change package.

## Subscribed Truth

- AGENTS.md
- TASTE.md
- changes/README.md
- specs/framework/spec.md
- docs/source/README.md
- scripts/v22-workflow-gate.mjs
- tests/health/health-check-v22-workflow-gate.mjs
- tests/health/health-check-v22-workflow-command-reference-gate.mjs
- tests/contract/contract-test-v22-review-secret-hygiene-gate.mjs
- tests/contract/contract-test-v22-diff-scoped-sensitive-hygiene.mjs
- tests/contract/contract-test-v22-framework-workflow-convergence.mjs
- tests/contract/contract-test-v22-root-verify-workflow-entrypoints.mjs
