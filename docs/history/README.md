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

- latest landed branch: `chore/v22-trunk-cloud-rc-current-closeout`
- latest landed commit: `12358872adee43977ae26771703e5840c8f619a0`
- next cursor: `opl-webui-runtime-production-slice`
- machine owner: `tests/fixtures/v22/goal-current.json`
- verify manifest: `tests/fixtures/v22/agent-verify-manifest.json`

## Archive Pointers

- change archive: retired; do not use as long-term database
- active change packages: retired; do not use as current source of truth
- evidence index: `docs/evidence/README.md`
- delivery closeout policy: `docs/delivery/README.md`
- production goal runner RC: `feat/v22-production-goal-runner` mapped cloud authorization operation classes to initial `cloud:goal:*` entries; current active entrypoint is the single `cloud:goal -- --operation <operation_class>` runner, with Goal B dry-run plan remaining local/no-cloud.
- production goal runner receipt hardening: `feat/v22-goal-real-runner-receipts` / `a584d2ee07c866eb9a125c31674b69fb79c18fb7` keeps Goal A readonly inventory secret-file gated, adds Goal C/D/E/F external runner interfaces, writes owner receipt pointers only through the authorized executor, and requires receipt manifests to bind `operation_class`, `runner_id` and the current authorization run. This is runner/receipt infrastructure, not production completion.
- cloud goal preflight gate: `feat/v22-cloud-goal-preflight` / `93771d950b9838302621010125d1487136c6feb2` adds `cloud:goal:preflight` as a safe Goal A-F readiness check for required env, path and external runner inputs. It does not read secrets, call cloud APIs, write `.runtime` evidence or satisfy production owner receipts.
- Portal UI grammar and bias gates: `feat/v22-portal-ui-grammar-and-bias-gates` / `a783cc24d15ee15b502a64fa9ae2adc7083897d8` folds MedOPL resource-control UI grammar, semantic tokens, Figma-code mapping and user-surface bias guards into existing `DESIGN.md`, page-state contract, theme tokens and current frontend/regression lanes. It adds no docs files, top-level scripts, health tests, Storybook or Figma/raw evidence.
- Portal resource-control UI secondary development: `feat/v22-phase2-portal-ui-secondary-development` / `951fd5a501642834927b3c7b64a15660c1652f5f` adds repo-native resource-control components to Portal pages for runtime, plans, storage and billing/audit projections, keeps release mutation as future/disabled, and folds verification into existing frontend/regression/run-plan/landing gates. It adds no docs files, top-level scripts, health tests, Figma dumps, screenshots or raw evidence.
- Cloud deploy shape run verification: `feat/v22-phase3-cloud-deploy-shape` / `12f6219322e74df7bfd87b35b553d9ec637aea26` uses existing deploy manifest, GitHub rollout workflow, release image workflow, rollout helper and cloud shape gates to prove cloud-deployable shape only. It does not read secrets, call Tencent Cloud, run kubectl, build/push images, deploy, live-test or satisfy production owner receipts.
- GitHub/TKE external preconditions: `feat/v22-phase4-github-tke-preconditions` folds externally confirmed GitHub workflows, self-hosted Tencent runner labels, production environment presence, TKE node labels and `medopl` namespace readiness into current truth. It commits only a summary, not raw `gh` output, tokens, kubeconfig, cloud payloads or production receipts.
- Goal A readonly inventory: `feat/v22-goal-a-readonly-inventory-receipt` executed `readonly_inventory` through the active cloud authorization pack with a user-provided secret-file and Tencent official readonly SDK mode. Raw evidence remains in `.runtime`; git only records the redacted pointer summary and cannot claim mutation, deploy, live-test or production receipts.
- Goal C storage lifecycle: `feat/v22-goal-c-storage-lifecycle-receipts` executed `storage_lifecycle` through the active cloud authorization pack with authorized COS `PutObject -> HeadObject -> DeleteObject` probe and accepted storage/release owner receipt pointers. Raw evidence remains in `.runtime`; git only records redacted pointers and cannot claim runtime, deploy, live-test or production completion.
- Goal D runtime provisioning: `feat/v22-goal-d-runtime-provisioning-receipt` executed `tenant_runtime_provisioning` through the active cloud authorization pack with the Tencent official TKE SDK, observed the configured cluster and node pool, and accepted the runtime owner receipt pointer. Raw evidence remains in `.runtime`; git only records redacted pointers and cannot claim runtime workload deploy, kubectl, image push, live-test or production completion.
- Goal E OPL-Webui consumer canary: `feat/v22-goal-e-opl-webui-consumer-receipt` executed `live_test` through the active cloud authorization pack, observed HTTPS 200 for OPL-Webui and MedOPL Portal public URLs, and accepted the OPL-Webui consumer receipt pointer. Raw evidence remains in `.runtime`; git only records redacted pointers and cannot claim runtime task completion, deploy, build/push, billing/audit writeback or production completion.
- Portal A+/production UI hardening: `feat/v22-portal-a-plus-production-ui-hardening` freezes production-ready claim gates and A+/S UI floors in existing Portal contracts, consumes them through current frontend/regression tests, removes user-visible engineering status terms, and keeps Release fail-closed until owner receipt exists.
- Goal F cloud release candidate wiring: `feat/v22-goal-f-production-receipt-manifest` / `90a89b75b2a4613719ce9c424367fb35ed51495c` wires Release Image and Cloud Rollout through build/push, runtime, storage, billing/audit, kubectl, deploy, live-test and receipt-manifest lanes. Current trunk `12358872adee43977ae26771703e5840c8f619a0` reran Release Image run `27911002260` and Cloud Rollout run `27911028428`; both succeeded and the Cloud Rollout uploaded the `medopl-production-receipt-manifest` redacted artifact. This is cloud release candidate evidence only. The redacted manifest stays as GitHub Actions artifact / `.runtime` pointer evidence and is not committed to git; production complete and full OPL-Webui product E2E remain unclaimed.

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
