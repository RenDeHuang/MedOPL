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

- latest landed branch: `recovery/platform-v22-trunk`
- latest landed commit: `75fab6bfa8e0fa0ce095fdf58605b4c698a5cf41`
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
- Portal UI/UX production hardening continuation: existing Portal UI contracts now make production UI claim depend on repo hygiene root default production dependency audit, frontend production dependency audit, browser accessibility regression, release owner readiness, observability / production deploy receipt and canary proof. The lane upgraded vulnerable frontend production dependencies, moved cloud SDKs to dev/tooling dependency scope for authorized runners, and keeps Release fail-closed until `release_owner_receipt`; it adds no phase package or new docs owner and still does not claim production complete.
- Goal F cloud release candidate wiring: `feat/v22-goal-f-production-receipt-manifest` / `90a89b75b2a4613719ce9c424367fb35ed51495c` wires Release Image and Cloud Rollout through build/push, runtime, storage, billing/audit, kubectl, deploy, live-test and receipt-manifest lanes. Current trunk `12358872adee43977ae26771703e5840c8f619a0` reran Release Image run `27911002260` and Cloud Rollout run `27911028428`; both succeeded and the Cloud Rollout uploaded the `medopl-production-receipt-manifest` redacted artifact. This is cloud release candidate evidence only. The redacted manifest stays as GitHub Actions artifact / `.runtime` pointer evidence and is not committed to git; production complete and full OPL-Webui product E2E remain unclaimed.
- Cloud RC / E2E canary hardening: `fix/v22-cloud-e2e-canary-gate` reran current trunk Release Image run `27911570626` and Cloud Rollout run `27911590272` on `d0adf57751efacce4e9867fdcbe78b1420bab71d`, then fixed the gate semantics discovered by log/public probing. Availability and `live_test` now fail closed unless public MedOPL Go API JSON and the runtime/storage/upload/run/artifact/billing/release/storage-destroy API canary pass. Receipt manifests generated by the cloud executor now claim `cloud_release_candidate`, not `production_complete`. Current external blocker remains public API routing for `portal.medopl.cn`; raw workflow logs and response bodies stay outside git.
- Rollout health gate hardening: `fix/v22-rollout-health-json` / `80988091fcad2910d85b9704e6af4eaaf0cc692b` makes post-rollout health checks require MedOPL Go backend JSON instead of accepting static HTML. GitHub `v22 verify` run `27912722404` and Release Image run `27912776562` succeeded; Cloud Rollout run `27912789001` rolled out image tag `8098809` but failed closed at `Rollout apply` because `portal.medopl.cn/healthz` still returns static nginx HTML. No raw logs, cloud payloads, secrets, kubeconfig, runtime artifacts or receipt manifest were committed.
- Rollout routing diagnostics: `fix/v22-rollout-routing-diagnostics` / `cbd0d8962a5bf9ab34a1ff0973c2bb9ba5ca99dc` adds redacted Service/Ingress/Endpoints/DNS diagnostics before the public Go JSON health gate. GitHub `v22 verify` run `27913303242` and Release Image run `27913362757` succeeded; Cloud Rollout run `27913371704` rolled out image tag `cbd0d89` but failed closed at `Rollout apply`. The diagnostic showed the active qcloud Ingress address `lb-7trlq374-v40s3uxfnpb1dazj.clb.usw-tencentclb.com`, while `portal.medopl.cn` still resolves to the old static nginx CLB `lb-pwv9zgky-yqsc8g20f1o6p3ir.clb.usw-tencentclb.com` / `43.159.159.90`. No raw logs, cloud payloads, secrets, kubeconfig, runtime artifacts or receipt manifest were committed.
- Current trunk rollout DNS blocker closeout: `chore/v22-closeout-32b1502-rollout-dns-blocker` records the latest trunk rerun without changing the product claim. GitHub `v22 verify` run `27913474525` and Release Image run `27913590845` succeeded for `32b1502cb128cca1979afb07e25dac075b6c7417`, building image tag `32b1502`; Cloud Rollout run `27913603345` rolled `medopl-control-plane` to image tag `32b1502` but failed closed at `Rollout apply`. The active qcloud Ingress remains `lb-7trlq374-v40s3uxfnpb1dazj.clb.usw-tencentclb.com`, while runner DNS still resolves `portal.medopl.cn` to old static nginx CLB `lb-pwv9zgky-yqsc8g20f1o6p3ir.clb.usw-tencentclb.com` / `43.159.159.90`. No raw logs, cloud payloads, secrets, kubeconfig, runtime artifacts or receipt manifest were committed.

- Public Go health/ready availability closeout: current machine cursor now records `npm run cloud:rollout:availability` observing MedOPL Go backend JSON 200 for `https://portal.medopl.cn/healthz` and `/readyz`, while keeping full OPL-Webui runtime-required E2E, cloud release candidate receipt manifest, release mutation and production complete unclaimed. Raw probe output is not committed; current machine truth is `tests/fixtures/v22/goal-current.json`.

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
