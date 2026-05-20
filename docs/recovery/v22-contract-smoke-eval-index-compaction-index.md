# v22 Contract / Smoke / Eval / Index Compaction Index

本索引记录 `cleanup/v22-contract-smoke-eval-index-compaction` 的全量审计裁定。它不是新产品合同，不改变业务 cursor，不实现 PostgreSQL/Redis，不接真实云；它只把当前 repo 的 `contracts / truth / index / eval / agent-runs` 五层关系压紧，说明哪些文件是长期权威、哪些只是阶段证据、哪些当前不能物理删除。

## 基线

- base trunk: `422547d2ed61c7ecc231e07e1d9b1214dc5df715`
- v22 contract files: `42`
- v22 eval scripts after this branch: `149`
- health-check: `6`
- smoke-golden: `11`
- contract-local: `22`
- local-regression: `62`
- future-authorized: `48`
- retired: `0`
- current cursor: `leaf-portal-postgres-redis-local-production-data-closure`

## 模型与 subagent 审计

- 总控 / 集成：`gpt-5.4`
- contracts auditor：`gpt-5.4`
- recovery/truth/index auditor：`gpt-5.4`
- scripts/smoke/eval auditor：`gpt-5.4`
- reference-chain auditor：`gpt-5.4`

四个 subagent 都是只读审计：未改文件、未读 secret、未触云、未执行 build/deploy/kubectl/live-test。

## 五层权威

| Layer | 当前权威 | 规则 |
| --- | --- | --- |
| contracts | `AGENTS.md`, `docs/contracts/README.md`, `docs/contracts/v22-*.md` | 只写长期不变量、边界、授权和非目标。 |
| truth | `docs/product.md`, `docs/architecture.md`, `docs/recovery/product-truth.md`, `docs/recovery/architecture-truth.md`, `docs/recovery/v22-truth-freeze.md`, `docs/recovery/status-matrix.md`, `docs/recovery/mvp-contract-acceptance.md` | 只回答当前产品、架构、数据、云和治理事实。 |
| index | `docs/recovery/v22-goal-current.json`, `docs/recovery/v22-agent-verify-manifest.json`, `docs/recovery/v22-current-vs-ideal-gap-matrix.md`, compaction indexes | 只回答下一步 cursor、gap、允许写入范围、验证入口和 cleanup 顺序。 |
| eval | `scripts/v22-verify.mjs`, `scripts/v22-smoke-classification.mjs`, `scripts/smoke-test-v22-*` | 只做机器验收，不讲阶段故事；`smoke-test-v22-*` 是 repo-local eval 文件族。 |
| agent-runs | `docs/recovery/agent-runs/*` | 只保存每一步开发证据、验证、B review 和吸收记录，不替代 current truth。 |

## 合同裁定

| Group | Count | Decision | Reason |
| --- | ---: | --- | --- |
| long-term contracts | 23 | keep | 覆盖 MVP loop、Portal/OPL/Gateway/Runtime、resource/billing/trace、role surface、upstream clean、smoke/eval 分层。 |
| merge-candidate contracts | 6 | blocked | 仍被 README、manifest、scoreboard 或 smoke gate 直接引用；必须先迁引用再删。 |
| rename-candidate contracts | 2 | blocked | UI audit 和 cloud workflow 本质更像 rubric/program，但当前仍是 gate 订阅文件。 |
| retire-candidate contracts | 2 | blocked | Figma implementation 和 TC3 cleanup 是阶段性合同，但当前引用未迁完。 |
| future-authorized boundaries | 9 | keep | 它们不代表已上线，但负责阻止未授权真实云、deploy、kubectl、live-test。 |

### 合同清退顺序

1. 先合并 `v22-user-credit-provider-key-boundary.md`、`v22-billing-freeze-boundary.md`、`v22-admin-ops-console-boundary.md`，分别迁到 token/preflight、release-stop-billing-audit、portal-admin-ops surface。
2. 再收敛 real OPL 三份 canary 合同；当前真实 OPL validation path 和 contract gate 仍依赖它们，不能直接删。
3. 再处理 `v22-portal-ui-design-quality-audit-boundary.md` 与 `v22-cloud-onboarding-workflow-boundary.md` 的 rename；rename 前必须同步 smoke、manifest、README、scoreboard。
4. 最后退 `v22-portal-figma-make-ui-implementation-boundary.md` 与 `v22-tencent-tc3-diagnostic-cleanup-plan.md`；前者必须由 DESIGN + composition + frontend code 承接，后者必须等 official SDK readonly path 成为唯一主路径。

Blocked contract paths:

- `docs/contracts/v22-admin-ops-console-boundary.md`
- `docs/contracts/v22-user-credit-provider-key-boundary.md`
- `docs/contracts/v22-billing-freeze-boundary.md`
- `docs/contracts/v22-real-opl-capability-canary-boundary.md`
- `docs/contracts/v22-real-opl-provider-message-canary-boundary.md`
- `docs/contracts/v22-real-opl-file-run-artifact-canary-boundary.md`
- `docs/contracts/v22-portal-ui-design-quality-audit-boundary.md`
- `docs/contracts/v22-portal-figma-make-ui-implementation-boundary.md`
- `docs/contracts/v22-cloud-onboarding-workflow-boundary.md`
- `docs/contracts/v22-tencent-tc3-diagnostic-cleanup-plan.md`

## Recovery / truth / index 裁定

| Group | Decision | Reason |
| --- | --- | --- |
| truth files | keep | 当前事实已经集中到 product/architecture/truth-freeze/status/mvp acceptance。 |
| current/index files | keep | `goal-current + gap-matrix + verify-manifest` 是下一步执行入口。 |
| agent-run records | keep | 当前 gate 仍引用这些 trace-first 证据；不建议删。 |
| stage boards and phase summaries | blocked-retire-candidate | 仍被根级治理 docs、cloud workflow、status 或 smoke 引用。 |
| duplicate governance docs | blocked-retire-candidate | `active-surface.md`、`archive-policy.md`、`recovery/decisions.md`、`system-domain-truth-layer-matrix.md`、`v22-agent-first-development-loop.md` 需要先迁引用。 |

### Recovery 清退顺序

1. 先修根级权威漂移：`docs/status.md`、`docs/invariants.md`、`docs/decisions.md`、`docs/vibe-coding.md` 不应再把 cloud onboarding board/status table 或 `v22-agent-workflow.mjs` 写成当前唯一入口。
2. 再退重复治理件：`active-surface.md`、`archive-policy.md`、`recovery/decisions.md`、`system-domain-truth-layer-matrix.md`、`v22-agent-first-development-loop.md`。
3. 再退阶段 goal 文档：`v22-goal-state.md`、`v22-product-goal.md`、`legacy-cleanup-backlog.md`，前提是相关 gate 改成只认 `goal-current + gap-matrix + manifest`。
4. 最后处理 cloud/program 阶段板：`v22-program-board.md`、`v22-program-status-table.md`、`cloud-onboarding-execution-board.md`、`cloud-onboarding-status-table.md`；必须先确认 `cloud-onboarding-verification-matrix.md`、`v22-cloud-harness-manifest.json` 和 cloud workflow contract 已接住全部引用。

Blocked recovery paths:

- `docs/recovery/active-surface.md`
- `docs/recovery/archive-policy.md`
- `docs/recovery/decisions.md`
- `docs/recovery/legacy-cleanup-backlog.md`
- `docs/recovery/system-domain-truth-layer-matrix.md`
- `docs/recovery/v22-agent-first-development-loop.md`
- `docs/recovery/v22-goal-state.md`
- `docs/recovery/v22-product-goal.md`
- `docs/recovery/v22-program-board.md`
- `docs/recovery/v22-program-status-table.md`
- `docs/recovery/cloud-onboarding-execution-board.md`
- `docs/recovery/cloud-onboarding-status-table.md`

## Smoke / Eval 裁定

当前不应继续大面积物理删除 `scripts/smoke-test-v22-*`。这些脚本已经全部分类，但语义需要更清楚：

- `health-check` 和 `smoke-golden` 才可以称为 smoke。
- `contract-local` 与 `local-regression` 是 eval，不叫 smoke。
- `future-authorized` 只表示未来授权边界可见性，不授权真实云、secret、deploy、kubectl、live-test。
- `entryKind` 明确区分 `atomic`、`suite-wrapper`、`gate-self-test`，避免 suite wrapper 污染业务 eval 数量。
- `authorization` 明确区分 `none` 与 `future-authorized`，避免从文件名里的 local/readonly/dry-run 误判执行授权。

### 不删除的脚本

| File | Decision | Reason |
| --- | --- | --- |
| `scripts/v22-verify.mjs` | keep | 统一 agent 验证入口。 |
| `scripts/v22-workflow-gate.mjs` | keep | A/B/C 合同订阅和 review/checkpoint 纪律本体。 |
| `scripts/v22-smoke-classification.mjs` | keep | 当前唯一 eval 分类 authority。 |
| `scripts/smoke-test-v22-golden-smoke-suite.mjs` | keep | 唯一纯 golden smoke wrapper。 |
| `scripts/smoke-test-v22-mvp-contract-suite.mjs` | keep / legacy alias | 仍被 manifest 的 `mvp` 与 `local-regression` 引用；直接删会断链。 |
| `scripts/smoke-test-v22-workflow-gate.mjs` | keep / gate-self-test | 这是 workflow gate 自检壳，不是业务 smoke。 |
| `scripts/v22-retired-surface-data.mjs` | keep | retired surface 证据层仍依赖它。 |
| `scripts/v22-agent-workflow.mjs` | blocked-retire-candidate | 根级治理 docs、cloud workflow 合同和多个 smoke 仍引用。 |
| `scripts/sync-workspace-file-to-minio.ps1` | blocked-retire-candidate | `services/portal/src/config/portal-config.mjs` 仍直接挂载；删除要另开 service cleanup leaf。 |

## 本轮物理删除

无。

原因：本轮全量引用链审计没有发现“引用已迁移、替代权威明确、gate 已覆盖”的合同、recovery 文档或 v22 eval 脚本。继续硬删会破坏当前 gate 或改变授权边界。

## 本轮收紧

- 扩展 `v22-smoke-eval-boundary.md`：把 `entryKind` 和 `authorization` 纳入 smoke/eval 元数据。
- 扩展 `v22-smoke-classification.mjs`：给每个 eval 生成 `entryKind` 和 `authorization`。
- 扩展 smoke classification / boundary gate：验证 suite wrapper、gate self-test、future-authorized authorization 不混入默认 smoke。
- 新增本索引和本 leaf gate，机器验证全量审计结论、blocked 清退顺序和 no-cloud/no-secret/no-services 边界。
- 补上个 `cleanup/v22-smoke-eval-physical-compaction` 的 post-absorb trace truth。

## 非目标

- 不实现 PostgreSQL/Redis。
- 不改 `services/*` 业务代码。
- 不接真实云。
- 不读取 secret。
- 不修改 upstream。
- 不 build/deploy/kubectl/live-test。
- 不改 Figma Portal UI。
