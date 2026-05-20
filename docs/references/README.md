# References Truth

Owner: `MedOPL`
Purpose: `references_index`
State: `taxonomy_skeleton`
Machine boundary: 本文是索引和参考入口，不是 current product truth、delivery cursor 或 machine gate。

## Scope

`docs/references/README.md` 最终承接：

- compaction indexes
- classification indexes
- gap / matrix 类索引
- 外部参考说明
- upstream 参考
- cleanup migration ledger

## Current Reference Sources

- `docs/recovery/v22-contract-smoke-eval-index-compaction-index.md`
- `docs/recovery/v22-contract-eval-compaction-index.md`
- `docs/recovery/v22-smoke-eval-physical-compaction-index.md`
- `docs/recovery/v22-repo-governance-physical-compaction-index.md`
- `docs/recovery/v22-monolith-agent-workflow-entrypoint-and-trace-normalization-index.md`
- `docs/recovery/v22-truth-repo-narrative-reference-unification-index.md`

## Rule

Reference documents may explain why a decision happened, but they do not override active truth, specs, policies, delivery cursor or source behavior. If a reference contains a current rule, that rule must be lifted into the relevant directory README, contract, source or verify gate.

## Migration Status

本 README 是 references skeleton。旧 recovery indexes 本轮不移动；后续分支迁移引用后再决定是否物理清退旧路径。

