# History Truth

Owner: `MedOPL`
Purpose: `history_evidence_index`
State: `taxonomy_skeleton`
Machine boundary: 本文是历史和证据入口，不是 current truth。当前 agent-run records 仍在 `docs/recovery/agent-runs/*`，直到后续引用迁移。

## Scope

History 最终承接：

- agent-run evidence
- B review / absorb / post-push records
- cleanup closeout
- superseded stage boards
- provenance and tombstone summaries

## Agent Runs

Agent-run records are evidence, not product truth. They record model, subagents, branch, allowed scope, forbidden scope, verification, B review result, post-absorb verification and non-goals.

Current evidence source:

- `docs/recovery/agent-runs/README.md`
- `docs/recovery/agent-runs/schema.md`
- `docs/recovery/agent-runs/*.md`

## Reading Rule

Use history to understand how a change was made. Use `docs/active/README.md`, `docs/product/README.md`, `docs/runtime/README.md`, `docs/specs/README.md`, `docs/policies/README.md`, `docs/delivery/README.md`, source and verify manifest to decide what is currently true.

## Migration Status

本 README 是 history skeleton。旧 `docs/recovery/agent-runs/*` 本轮不移动、不删除；后续分支应把摘要吸收到本 README，再迁引用。

