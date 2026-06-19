# History Archive

Owner: `MedOPL`
Purpose: `history_archive_index`
State: `active_summary`
Machine boundary: 本文是人读历史入口和 provenance/tombstone pointer，不是 current truth、closeout database 或机器接口。当前事实看 `docs/active/README.md`；机器 cursor、latest landed closeout、next cursor 和 verify bundle 看 `tests/fixtures/v22/goal-current.json` 与 `tests/fixtures/v22/agent-verify-manifest.json`；详细证据看 git history、`changes/archive/` 和 runtime evidence。

## Scope

History 只保留短索引：

- landed / post-merge closeout 的人读指针
- retired route / cleanup tombstone
- provenance 指向 `changes/archive/` 与 git history
- 不保存完整 run log、长阶段板、ready_for_landing_review 段落或可被脚本解析的 Markdown run database

## Latest Machine Cursor

- latest landed branch: `cleanup/v22-owner-consumer-lifecycle-gates`
- latest landed commit: `767f2de8a35df9615e6f3533dd0518e58ca275e4`
- next cursor: `real-cloud-authorization-boundary`
- machine owner: `tests/fixtures/v22/goal-current.json`
- verify manifest: `tests/fixtures/v22/agent-verify-manifest.json`

## Archive Pointers

- change archive: `changes/archive/`
- active change packages: `changes/active/`
- evidence index: `docs/evidence/README.md`
- delivery closeout policy: `docs/delivery/README.md`

## Tombstone Map

| Retired surface | Current owner | Must not return as |
| --- | --- | --- |
| `docs/contracts/**` | `docs/specs/README.md`, `specs/*/spec.md` | distributed contract truth, compatibility alias, default verification input |
| `docs/recovery/**` | `docs/active/README.md`, `docs/history/README.md` | current truth tree, agent-run archive tree, stage board |
| legacy root product / architecture / status / invariants / decisions docs | `docs/{product,runtime,source,policies,active}/README.md` and `specs/*/spec.md` | second truth owner or root entrypoint |
| `scripts/smoke-test-*` | `tests/**`, `scripts/v22-verify.mjs` | repo-local eval location or compatibility script family |
| long landed run sections in this file | `tests/fixtures/v22/goal-current.json`, `changes/archive/`, git history | machine closeout database or prose-locked test fixture |

## Current Rule

Scripts and tests must not parse this Markdown as a stable interface. They may assert this file stays a short archive index and points to the machine owners above.
