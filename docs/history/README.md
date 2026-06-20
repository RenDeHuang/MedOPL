# History Archive

Owner: `MedOPL`
Purpose: `history_archive_index`
State: `active_summary`
Machine boundary: 本文是人读历史入口和 provenance/tombstone pointer，不是 current truth、closeout database 或机器接口。当前事实看 `docs/active/README.md`；机器 cursor、latest landed closeout、next cursor 和 verify bundle 看 `tests/fixtures/v22/goal-current.json` 与 `tests/fixtures/v22/agent-verify-manifest.json`；详细证据看 git history 和 runtime evidence，`changes/` 不再是长期历史数据库。

## Scope

History 只保留短索引：

- landed / post-merge closeout 的人读指针
- retired route / cleanup tombstone
- provenance 指向 git history
- 不保存完整 run log、长阶段板、ready_for_landing_review 段落或可被脚本解析的 Markdown run database

## Latest Machine Cursor

- latest landed branch: `feat/v22-cloud-goal-preflight`
- latest landed commit: `93771d950b9838302621010125d1487136c6feb2`
- next cursor: `opl-webui-runtime-production-slice`
- machine owner: `tests/fixtures/v22/goal-current.json`
- verify manifest: `tests/fixtures/v22/agent-verify-manifest.json`

## Archive Pointers

- change archive: retired; do not use as long-term database
- active change packages: retired; do not use as current source of truth
- evidence index: `docs/evidence/README.md`
- delivery closeout policy: `docs/delivery/README.md`
- production goal runner RC: `feat/v22-production-goal-runner` maps cloud authorization operation classes to `cloud:goal:*`; Goal B dry-run plan is local/no-cloud.
- production goal runner receipt hardening: `feat/v22-goal-real-runner-receipts` / `a584d2ee07c866eb9a125c31674b69fb79c18fb7` keeps Goal A readonly inventory secret-file gated, adds Goal C/D/E/F external runner interfaces, writes owner receipt pointers only through the authorized executor, and requires receipt manifests to bind `operation_class`, `runner_id` and the current authorization run. This is runner/receipt infrastructure, not production completion.
- cloud goal preflight gate: `feat/v22-cloud-goal-preflight` / `93771d950b9838302621010125d1487136c6feb2` adds `cloud:goal:preflight` as a safe Goal A-F readiness check for required env, path and external runner inputs. It does not read secrets, call cloud APIs, write `.runtime` evidence or satisfy production owner receipts.

## Tombstone Map

| Retired surface | Current owner | Must not return as |
| --- | --- | --- |
| `docs/contracts/**` | `docs/specs/README.md`, `specs/*/spec.md` | distributed contract truth, compatibility alias, default verification input |
| `docs/recovery/**` | `docs/active/README.md`, `docs/history/README.md` | current truth tree, agent-run archive tree, stage board |
| legacy root product / architecture / status / invariants / decisions docs | `docs/{product,runtime,source,policies,active}/README.md` and `specs/*/spec.md` | second truth owner or root entrypoint |
| `scripts/smoke-test-*` | `tests/**`, `scripts/v22-verify.mjs` | repo-local eval location or compatibility script family |
| long landed run sections in this file | `tests/fixtures/v22/goal-current.json`, git history | machine closeout database or prose-locked test fixture |

## Current Rule

Scripts and tests must not parse this Markdown as a stable interface. They may assert this file stays a short archive index and points to the machine owners above.
