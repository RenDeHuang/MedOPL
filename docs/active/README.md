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
| latest repo closeout | `goal-commercial-storage-destroy-writeback-fix` / `64699bd3619f01a4442936b096079b3e8051733d` |
| current blocker | `none_for_authorized_commercial_business_flow_production_canary_revalidation` |
| source fix | `goal-commercial-upload-file-billing-writeback-fix` landed at `34b0e3070357504b475a0bee2ff6bd4de0af23df`; `goal-commercial-storage-destroy-writeback-fix` landed at `64699bd3619f01a4442936b096079b3e8051733d` |
| next proof | future scope expansion / ongoing operations proof must be separately authorized |

The latest repo/gate closeout is goal-commercial-storage-destroy-writeback-fix at 64699bd3619f01a4442936b096079b3e8051733d. The source line keeps `upload_file -> save_billing_event` fail-closed while using canonical runtime ledger tenant / billing attribution identity before fallback account lookup, and keeps `storage_destroy -> save_billing_event` fail-closed while using collision-resistant billing event IDs. The authorized Release Image + Cloud Rollout + OPL-Webui consumer canary rerun passed for the same commercial business flow; detailed run provenance stays in history / GitHub Actions artifact, not active product truth.

## Active Supporting Substrates

- `active operations substrate`: Release Image, Cloud Rollout, redacted receipt boundary and the cloud goal runner support the current复验. They do not define product identity, business admission, recharge, plan, balance, quota, billing truth or cost ceiling.
- Cost ceiling for current business claims comes from account balance, plan hold amount and quota.
- 真实云、build/push、kubectl、deploy、live-test 只能通过机器授权包、package script / workflow 和 redacted evidence sink 执行；raw workflow evidence、secrets、kubeconfig、cloud payloads、runtime artifacts、uploaded files 和 transcripts 不进入 git。

## Cannot Claim

- 不能 claim production complete、unscoped full production、ongoing authorization、external PSP settlement、multi-region/SLA 或 enterprise compliance。
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
- evidence-after-contract: `docs/evidence/README.md`
- stable policy and authorization boundary: `docs/policies/README.md`
- delivery / operations substrate: `docs/delivery/README.md`
- active source surface: `docs/source/README.md`
- landed closeout / provenance: `docs/history/README.md`
- machine cursor: `tests/fixtures/v22/goal-current.json`
- verify manifest: `tests/fixtures/v22/agent-verify-manifest.json`
