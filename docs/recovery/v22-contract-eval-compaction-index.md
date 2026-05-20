# v22 Contract / Eval Compaction Index

本索引用于把 v22 文件治理收敛到 `contracts / truth / index / eval / agent-runs`。它不是新产品合同，不改变 current cursor；它只记录哪些文件是长期边界，哪些是当前真相，哪些 eval 需要保留、改名或后续压缩。

## 当前统计

- v22 contracts: 42
- v22 eval files: 148
- current truth entry: `docs/recovery/v22-goal-current.json`
- verify authority: `docs/recovery/v22-agent-verify-manifest.json`
- unified eval entrypoint: `scripts/v22-verify.mjs`

## 压缩原则

1. 长期合同保留在 `docs/contracts/v22-*.md`，只表达不变量、边界和授权。
2. 当前产品、架构、数据、云和治理事实写入 truth 层，不再恢复阶段性事实源。
3. 下一步 cursor、gap、允许写入范围和验证命令只以 index / manifest 为准。
4. eval gate 可以保留较多，但必须按 health、smoke-golden、contract-local、local-regression、future-authorized 分层。
5. 删除前必须有替代事实源和机器 gate；不能因为“还没做”删除 cloud/deploy/secret 授权边界。

## 文件裁定

| File | Layer | Role | Decision | Replacement / Authority | Notes |
| --- | --- | --- | --- | --- | --- |
| `AGENTS.md` | contracts | 稳定工作纪律 | keep | AGENTS.md | 禁区、A/B/C、secret、upstream、cloud 授权红线。 |
| `docs/contracts/README.md` | contracts | 合同索引 | keep | contracts index | 只索引长期合同和 truth layer，不再承接阶段故事线。 |
| `docs/contracts/v22-mvp-managed-opl-loop.md` | contracts | MVP 主闭环合同 | keep | MVP loop authority | 当前用户闭环主合同。 |
| `docs/contracts/v22-saas-control-plane-user-experience-boundary.md` | contracts | 用户体验边界 | keep | UX boundary | 保证 Portal 是托管科研工作台控制面，不是云控制台。 |
| `docs/contracts/v22-portal-opl-connection-boundary.md` | contracts | Portal-OPL 连接边界 | keep | OPL connection boundary | 长期边界。 |
| `docs/contracts/v22-opl-work-message-file-run-boundary.md` | contracts | OPL work 边界 | keep | OPL work boundary | 长期边界。 |
| `docs/contracts/v22-runtime-bridge-session-run-file-provider-keyref-boundary.md` | contracts | Runtime Bridge 边界 | keep | Runtime Bridge boundary | 长期边界。 |
| `docs/contracts/v22-portal-files-billing-trace-boundary.md` | contracts | 文件/账单/trace 边界 | keep | files billing trace boundary | 长期边界。 |
| `docs/contracts/v22-authorized-tencent-create-release-*.md` | contracts | future-authorized 云 mutation 边界 | keep | future-authorized | 不代表已上线，但防止越权真实云操作。 |
| `docs/contracts/v22-production-cloud-topology-boundary.md` | contracts | future-authorized 云拓扑边界 | keep | future-authorized | 不执行真实云。 |
| `docs/recovery/v22-truth-freeze.md` | truth | 当前主线真相冻结 | keep | truth authority | 业务、架构、数据、云、AI 治理真相。 |
| `docs/recovery/product-truth.md` | truth | 产品真相 | keep | product truth | 补充用户主动开通托管计算资源和文件空间、用户删除文件空间才进入 7 天保护期。 |
| `docs/recovery/architecture-truth.md` | truth | 架构真相 | keep | architecture truth | Portal/Gateway/Runtime Bridge/PostgreSQL/Redis/object plane 边界。 |
| `docs/recovery/v22-current-vs-ideal-gap-matrix.md` | index | gap matrix | keep | gap index | 不直接替代 current truth。 |
| `docs/recovery/v22-goal-current.json` | index | current cursor | keep | single_write_entry | current truth only here。 |
| `docs/recovery/v22-agent-verify-manifest.json` | eval | verify authority | keep | manifest_not_smoke | 分支 override 和命令权威入口。 |
| `scripts/v22-verify.mjs` | eval | 统一验证入口 | keep | verify entrypoint | Agent 默认入口。 |
| `scripts/v22-test-classification.mjs` | eval | eval 分类 | keep | smoke/eval boundary | health/smoke/local/future 分层。 |
| `tests/smoke/smoke-test-v22-mvp-user-loop-contract.mjs` | eval | MVP 用户闭环 golden gate | rename | renamed from old canonical loop gate | 保留覆盖，清退旧 canonical 命名。 |
| `scripts/smoke-test-v22-canonical-user-loop-contract.mjs` | eval | 旧命名 golden gate | delete | `tests/smoke/smoke-test-v22-mvp-user-loop-contract.mjs` | 内容仍有效但旧命名误导。 |
| `tests/contract/contract-test-v22-golden-smoke-suite.mjs` | eval | smoke-golden runner | keep | smoke suite | 使用 classification，不硬编码旧名。 |
| `tests/contract/contract-test-v22-contract-eval-compaction.mjs` | eval | 本 leaf gate | keep | compaction gate | 防止旧命名和保护期真相回退。 |
| `tests/contract/contract-test-v22-repo-governance-physical-compaction.mjs` | eval | 仓库治理压缩 gate | keep | repo governance gate | 验证文件分层、物理清退、agent-first loop 和 no second truth source。 |
| `tests/contract/contract-test-v22-smoke-eval-physical-compaction.mjs` | eval | smoke/eval 物理压缩 gate | keep | smoke/eval compaction gate | 验证 3 个旧 eval/support 脚本已删除、分类统计稳定、manifest/local-contract 入口对齐。 |
| `docs/recovery/agent-runs/*` | agent-runs | leaf 证据 | keep | trace-first archive | 只保存执行证据，不替代 current truth。 |

## 业务真相修正

用户主动开通的是 Portal 托管计算资源和文件空间。后台可以映射到底层 CVM / 存储资源，但普通用户不直接配置 CVM、COS、K8s。

释放托管计算资源只停止计算计费和任务续用。用户删除文件空间才进入 7 天保护期，平台保留数据以降低误删风险；独立欠费保留策略也可以触发保护期。

## 已清退阶段文件索引

以下文件已被物理清退。清退证据属于 index / agent-runs / eval 语境，不再写入 truth 层作为当前事实：

- `docs/recovery/v22-ai-frontend-backend-development-framework.md`
- `docs/contracts/v22-canonical-user-loop.md`
