# Active Truth

Owner: `MedOPL`
Purpose: `current_state_control_surface`
State: `active_current_truth`
Machine boundary: 本文是唯一人读 current truth 文件。机器 cursor、latest landed closeout、branch override 和 verification bundle 以 `tests/fixtures/v22/goal-current.json` 与 `tests/fixtures/v22/agent-verify-manifest.json` 为准。稳定 product、runtime、framework、spec、evidence、policy、delivery、source 和 history truth 只看各自 README，不在本文展开第二份 truth。

## Current Product Identity

MedOPL 是 OPL-Webui 的商业资源控制面，负责 owner 创建或批准账号、plan、balance、quota、runtime/storage 开通、file/run ledger、billing ledger、statement reconciliation、release/destroy/stop billing 和审计。OPL-Webui 负责 ordinary chat、科研交互、任务体验、progress/result/gate/refs/deeplink 展示；MedOPL 不复制 OPL-Webui，不负责普通 chat，也不是云资源控制台。

当前商业业务流是：`account prepare -> account approval -> credit -> plan -> open runtime/storage -> upload/run/artifact -> billing ledger -> statement reconciliation -> release/destroy/stop billing`。商业准入 truth 是 owner-created-or-approved MedOPL account with sufficient plan/balance/quota；不是 selected allowlist，不是 canary allowlist，也不是 production rollout governance。

## Current Cursor

| Field | Value |
| --- | --- |
| current phase | `commercial runtime storage billing business closure` |
| current cursor | `goal-commercial-runtime-storage-billing-business-closure` |
| latest repo closeout | `goal-commercial-launch-product-contract-matrix` / `63f1986071c26810746b2477c2ef9e1f886724c0` |
| current blocker | `none_for_current_scoped_commercial_business_flow` |
| source fix | `goal-commercial-upload-file-billing-writeback-fix` landed at `34b0e3070357504b475a0bee2ff6bd4de0af23df`; `goal-commercial-storage-destroy-writeback-fix` landed at `64699bd3619f01a4442936b096079b3e8051733d` |
| next proof | `goal-commercial-release-metadata-rollback-maturity` is the next recommended maturity implementation goal after the owner/admin bootstrap setup boundary closeout |

`goal-commercial-runtime-storage-billing-business-closure` is retained as the umbrella product spine for the commercial resource-control flow. It is not an unfinished blocker, and completed retired leaf goals must not be re-entered through stale next-goal prompts.

The latest repo/gate closeout is goal-commercial-launch-product-contract-matrix at 63f1986071c26810746b2477c2ef9e1f886724c0. The Commercial Launch Product Contract Matrix is machine-owned at `contracts/medopl-commercial-launch-product-contract-matrix.json` and binds persona, business step, page action, backend truth, receipt/cannot-claim, regression gate and legacy retirement for the commercial launch journey. The scoped canary proof is retained as operations substrate only; detailed run provenance stays in history / GitHub Actions artifact, not active product truth.

Goal-driven development remains the project management layer: `goal` declares the delivery slice, owner surfaces, verification and closeout, while `journey.id` declares the affected commercial product path. Current machine cursor fields now bind the active commercial closure goal to `affected_journeys` from `contracts/medopl-commercial-launch-product-contract-matrix.json`; future product-facing goals must keep that binding instead of treating goal development and journey development as separate processes.

Current scoped commercial canClaim is: authorized commercial business-flow cloud canary passed; internal credit + billing ledger + statement reconciliation + release/destroy/stop billing passed; approved Commercial Launch UI baseline replacement absorbed into repo-native Portal contracts/source/tests. The Commercial Launch freeze/admission matrix is machine-owned by `contracts/medopl-commercial-launch-freeze-matrix.json`, and the Product Contract Matrix is machine-owned by `contracts/medopl-commercial-launch-product-contract-matrix.json`: approved Figma Make direction is the visual and information-architecture baseline, while repo-native contracts, source, tests and browser regression remain machine truth. This can claim approved UI baseline replacement only; it cannot claim rollout complete, production complete, external PSP settlement, all users/all tenants, SLA/multi-region, enterprise compliance or ongoing authorization. The current cross-repo launch completion pointer is machine-owned by `tests/fixtures/v22/goal-current.json#/cross_repo_launch_completion`: OPL-Webui Cloud Rollout run `28332168943` passed the scoped commercial cross-repo browser canary, and MedOPL Cloud Rollout run `28332365127` completed the paired commercial resource-control canary with redacted receipt manifest hash `sha256:fa71a90c267503d617c4d196353b55c1f30a6e4e7eaaddbba6b60837a2442234`. This remains scoped canary / operations substrate evidence, not unscoped production complete or ongoing authorization. The maturity gap matrix is machine-owned by `tests/fixtures/v22/goal-current.json` and compares the remaining production productization gaps against OPL ordinary-path boundaries and sub2api-style packaging maturity as engineering references only.

Cross-repo OPL-Webui / MedOPL launch contract is fixed locally under `contracts/medopl-api-contract.json#/medopl_api_contract/opl_webui_e2e_launch_contract` and the matching OPL-Webui commercial consumer contract. It records shared `userId` / `email` / `tenantId` / `workspaceId` mapping, keeps OPL-Webui session/account projection separate from MedOPL account/plan/balance/quota/runtime/storage/billing/release truth, keeps ordinary chat/task UX with OPL-Webui, and fixes runtime_required blocked/onboarding/ready projection plus deeplink handoff states. The local contract plus scoped live canary evidence can claim cross-repo launch canary readiness only; it does not replace the next recommended goal `goal-commercial-release-metadata-rollback-maturity`.

Dynamic cross-repo current truth sync is recorded at `contracts/medopl-api-contract.json#/medopl_api_contract/commercial_cross_repo_dynamic_current_truth_sync` and `tests/fixtures/v22/goal-current.json#/commercial_cross_repo_dynamic_current_truth_sync`. It fresh-read MedOPL `recovery/platform-v22-trunk` HEAD `e6d2e7ae54ee3bcb2fd86fd21d56c35492ac7b35` and OPL-Webui `main` HEAD `94704dc55b9d689655d6e0a34625e8dd10d73b4a`, keeps MedOPL as account/plan/balance/quota/runtime/storage/billing/release truth owner, keeps OPL-Webui as ordinary/task/page-state/readonly projection/deeplink owner, and fails closed on ownership conflict, claim inconsistency, HEAD mismatch, missing contract field, or cannotClaim upgrade before live E2E, rollout, or production-complete claims. It is a closed sync pointer, not a long-running active blocker, and must not overwrite `goal-commercial-release-metadata-rollback-maturity` as the next recommended MedOPL maturity goal.

## Active Supporting Substrates

- `active operations substrate`: Release Image, Cloud Rollout, redacted receipt boundary and the cloud goal runner support scoped proof and future authorized revalidation. They do not define product identity, business admission, recharge, plan, balance, quota, billing truth or cost ceiling.
- Cost ceiling for current business claims comes from account balance, plan hold amount and quota.
- `minimum ops readiness substrate`: `tests/fixtures/v22/goal-current.json#/ops_readiness_minimum` points monitoring/readiness, rollback drill, troubleshooting and failed handoff runbook surfaces for the scoped cross-repo canary. It does not claim full SLA, multi-region HA, ongoing authorization, enterprise compliance or all-user readiness.
- 真实云、build/push、kubectl、deploy、live-test 只能通过机器授权包、package script / workflow 和 redacted evidence sink 执行；raw workflow evidence、secrets、kubeconfig、cloud payloads、runtime artifacts、uploaded files 和 transcripts 不进入 git。

## Cannot Claim

- 不能 claim production complete、unscoped full production、ongoing authorization、external PSP settlement、multi-region/SLA 或 enterprise compliance。
- 不能 claim real payment completed、refund / invoice / tax / compliance、all users/all tenants、SLA/multi-region/ongoing authorization 或 unscoped full production。
- 不能把 Release Image / Cloud Rollout / receipt manifest 写成用户产品主线或商业准入 truth。
- 不能把 internal ledger 写成 external real payment settlement。
- 不能把 historical deployment provenance 写回 active product truth。
- 不能把 ordinary chat、OPL Framework/domain quality verdict 或 artifact authority 写成 MedOPL owner surface。
- 不能绕过 billing/audit、把 upload_file 或 storage_destroy 假成功、或把 projection/local UI 当真实 business ledger。

## Source Of Truth Pointers

- product truth: `docs/product/README.md`
- runtime / Gateway / upstream truth: `docs/runtime/README.md`
- framework truth: `docs/framework/README.md`
- contract/spec lower bound: `docs/specs/README.md`
- commercial launch freeze/admission matrix: `contracts/medopl-commercial-launch-freeze-matrix.json`
- evidence-after-contract: `docs/evidence/README.md`
- stable policy and authorization boundary: `docs/policies/README.md`
- delivery / operations substrate: `docs/delivery/README.md`
- active source surface: `docs/source/README.md`
- landed closeout / provenance: `docs/history/README.md`
- machine cursor: `tests/fixtures/v22/goal-current.json`
- verify manifest: `tests/fixtures/v22/agent-verify-manifest.json`
