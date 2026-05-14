# MedOPL v22 物理删除 Goal

## Branch Declaration

- branch: `cleanup/v22-physical-legacy-goal`
- model: `gpt-5.4`
- role: temporary physical-deletion goal
- name: 物理删除 goal
- intent: 为 v22 已完成的主路径清退补一条临时物理文件删除目标线，先定义导台、gate、分刀删除顺序和自治规则；后续授权 deletion slice 只能按导台和 gate 删除明确安全的文件。
- current truth: 主路径清退已经完成，不等于物理文件清退完成。
- cursor policy: 本 goal 不写入常驻 product cursor；它是 cleanup 后的临时物理清退工作包。
- removal policy: 完成后可由用户删除本 goal 文件或对应分支，避免长期污染常规 v22 目标推进。
- physical_delete_batch_status: completed_waiting_b_review
- latest_batch_branch: `cleanup/v22-physical-legacy-batch-run`
- latest_batch_truth: run manifest queue 已跑完；final slice 只写 completion truth / remaining blockers truth；用户随后授权的 live-test physical delete follow-up slice 已物理删除 `scripts/live-test-*`。

## Contract Subscription

本 goal 订阅以下边界：

- `AGENTS.md`
- `docs/contracts/README.md`
- `docs/recovery/mvp-contract-acceptance.md`
- `docs/recovery/status-matrix.md`
- `docs/recovery/repo-zoning.md`
- `docs/recovery/legacy-cleanup-backlog.md`
- `docs/recovery/v22-goal-current.json`
- `docs/recovery/v22-goal-state.md`
- `docs/recovery/v22-current-vs-ideal-gap-matrix.md`

本 goal 继承 v22 主线事实：MedOPL 是 `platform-provisioned / customer-dedicated` 的 OPL SaaS 托管科研工作台；旧 `user_owned`、`resource-order`、旧 runner/provisioner、OpenCost 主叙事和 Langfuse 旧默认叙事不得恢复为 active primary path。

## Goal Statement

把仍留在 trunk 的 legacy 文件、旧脚本、旧部署资产和旧命名 active surface 按证据裁定为可删除、保留 tombstone、归档参考、迁移输入、需授权禁区或需单独 schema/drop leaf，并在后续独立 deletion-only 分支中逐步物理删除可安全删除项。

本 goal 的第一阶段只创建目标定义、导台和 gate。后续执行必须从导台开始，不允许直接删除。

## Non Goals

- 不在 goal bootstrap 分支删除文件；后续授权 deletion slice 必须先 RED gate、证明无 active reference，再按导台删除。
- 不在本分支移动 scripts。
- 不在本分支修改 service implementation。
- 不在本分支修改默认 MVP suite。
- 不把物理清退并入 Cloud lane、OPL lane、Portal feature lane 或 release readiness。
- 不把 archive/reference 文件重新解释成 active surface。
- 不把 tombstone route 改成兼容成功路径。

## Authorization Boundary

- 不得读取 secret、`.env`、kubeconfig、token、SecretId、SecretKey、SSH private key。
- 不得调用真实云、COS、Langfuse、one-person-lab 或外部生产 API。
- 不得执行 build/push、kubectl、live-test 或真实 runtime smoke。
- 不得修改 `deploy/*`、`.sentrux/*`、`adapters/*`、`infra/*` 或 upstream。
- 不得删除 public 410 tombstone，除非有单独用户确认旧入口不再需要 fail-closed 语义。
- 不得 drop schema、删除 migration collection 或改写历史账本。

## Decision Taxonomy

每个 legacy 文件或文件组必须精确裁定为一个状态：

- `delete`: 无 active import、无 public surface、无 schema/migration/deploy/secret 风险、无保留证据价值，可以进入 deletion-only 分支。
- `keep_tombstone`: 仍需 fail-closed 退役壳，保留最小 410 或 retired API surface，不做兼容翻译。
- `archive_reference`: 只作历史证据或迁移输入，不进入默认 suite、默认文档或 active implementation。
- `migrate`: 仍有业务价值，但必须改名、改边界或迁成 v22 active surface 后才能保留。
- `forbidden_without_auth`: 位于 `deploy/*`、`adapters/*`、`infra/*`、`.sentrux/*`、upstream 或真实外部系统边界，未授权只记录不修改。
- `needs_schema_drop_leaf`: 涉及数据库 schema、migration collection、历史账本、Postgres snapshot helper 或数据保留策略，必须单独合同和 gate。

## Execution Steps

### Step 0: Baseline and Contract Subscription

确认当前分支从 `origin/recovery/platform-v22-trunk` 创建，记录模型、合同包、授权边界和不做事项。运行 goal gate 前不得删除任何文件。

验收命令：

```bash
git status --short --branch
node scripts/smoke-test-v22-physical-legacy-file-retirement-goal.mjs
```

### Step 1: 导台 Physical Inventory

创建 `docs/recovery/physical-legacy-file-retirement-inventory.md`，列出以下文件族的每个命中项或文件组：

- `user-owned` / `user_owned`
- `resource-order` / `resource_orders`
- v19 / v20 / v21 smoke、check、daily、live prepare 和 live-test
- OpenCost
- Langfuse
- `med-autoscience-runner`
- `resource-provisioner`
- legacy docs、reports、logs、release notes 和旧 deployment/operations 文档

每条记录至少包含：

- path
- legacy_family
- current_zone
- current_role
- inbound_refs
- default_suite_ref
- public_surface
- schema_or_migration_risk
- deploy_or_external_risk
- decision
- required_gate
- deletion_branch
- stop_condition

### Step 2: Inventory Gate

创建 `scripts/smoke-test-v22-physical-legacy-file-retirement-inventory.mjs`。该 gate 必须 fail-closed 于：

- physical_legacy_file_retirement_inventory_missing
- unadjudicated_legacy_file
- active_reference_to_delete_candidate
- forbidden_path_without_auth
- public_tombstone_delete_requires_user_confirmation
- schema_or_migration_delete_without_schema_drop_leaf
- default_suite_references_archive_or_delete_candidate

inventory gate 只读仓库文件，不读 secret，不执行 legacy script，不跑 live-test。

### Step 3: Low-Risk Delete Slice

后续单独分支删除 `delete` 状态且满足以下条件的文件：

- 无 active import 或 runtime reference。
- 不属于 public route、public API、schema、migration、deploy、adapter、infra、upstream。
- 不在默认 suite、README、product、architecture 或 active contracts 中被引用。
- 删除后 targeted gate、goal gate、workflow gate 和 diff check 必须通过。

### Step 4: Legacy Script Archive/Delete Slice

对 v19/v20/v21/live-test/check/daily 脚本分组处理：

- 已被 v22 gate 替代且无历史证据价值的脚本可进入 `delete`。
- 仍有迁移或事故复盘价值的脚本保留 `archive_reference`，但不得进入默认 suite 或默认文档。
- live-test 只能作为授权 canary 参考，不能默认运行。

### Step 5: Portal Tombstone Minimization Slice

缩小 `user-owned` 和 `resource-order` active surface：

- public route 若仍需要明确 410，保留最小 `keep_tombstone`。
- retired domain/store/helper 若不再被 tombstone route 或 gate 需要，进入 `delete`。
- 任何删除都必须先证明没有 active import。
- 不允许把旧 route 改为兼容成功路径。

### Step 6: OpenCost/Langfuse/Runner Physical Retirement Slice

对 OpenCost、Langfuse、旧 runner/provisioner 做物理裁定：

- 产品主叙事附近的旧文件优先 delete 或 archive_reference。
- optional sanitized observability attachment 可保留在 v22 trace metadata 边界内。
- `deploy/*`、`adapters/*`、`infra/*` 命中项必须保持 `forbidden_without_auth`，除非用户单独授权对应路径。

### Step 7: Schema/Migration Future Leaf

`resource_orders` 表、`resource_order_events`、Postgres snapshot helper、migration collection 和历史账本不在普通 deletion slice 处理。它们进入 `needs_schema_drop_leaf`，未来必须单独写：

- schema/drop 合同
- migration compatibility gate
- rollback / restore note
- historical ledger protection note
- B review checklist

### Step 8: Completion Truth and Temporary Goal Removal

当所有 inventory 项都已被处理为已删除、保留 tombstone、archive_reference、migrate 完成、forbidden_without_auth 记录或 needs_schema_drop_leaf 转移后，写回物理清退完成事实。

B ff-only 吸收并 push 后才允许更新物理清退完成事实。用户可在完成后删除本 goal 文件、删除临时分支或把本 goal 归档为历史 evidence。

## Agent Run Workflow

agent_run_mode: physical_delete_goal_driven

agent_run_batch_mode: physical_delete_goal_batch_driven

Run manifest: `docs/recovery/physical-legacy-file-retirement-run-manifest.json`.

本物理删除 goal 参考 v22 总 goal 的控制面模式：总 goal 用 `docs/recovery/v22-goal-current.json` 固定 current cursor、next leaf、gap 依赖、allowed files、forbidden files 和 verification；本物理删除 goal 不写入常驻 product cursor，但用临时 batch manifest 固定 batch manifest、next_slice queue、one commit per slice、B may absorb the whole batch 和每刀 gate。

batch mode 允许 agent 在同一个 cleanup 分支中连续执行最多 3 个低风险 slice，但每个 slice 必须独立 RED gate、独立 GREEN gate、独立 inventory writeback 和独立 commit。任何 slice 触发 stop condition 时，agent 必须停止 batch，不得跳到下一刀。

next_slice queue 固定为：

1. `slice-2-legacy-script-archive-delete-boundary`
2. `slice-3-observability-runner-physical-retirement-boundary`
3. `slice-final-completion-truth-and-temporary-goal-removal`

任何 agent 进入本物理删除 goal 时，必须按以下 8 步运行，不得跳过导台直接删除。

Latest batch run truth:

- `slice-2-legacy-script-archive-delete-boundary`: completed. v19/v20/v21 smoke families remain `archive_reference`; `scripts/live-test-*` was later explicitly authorized for physical deletion and deleted without running live-test.
- `slice-3-observability-runner-physical-retirement-boundary`: completed. `compose.langfuse.yaml` remains `archive_reference`; `langfuse-trace-client.mjs` and `langfuse-publisher.mjs` remain active trace metadata boundary implementation points; `adapters/*` and `infra/opencost/**` remain `forbidden_without_auth`.
- `slice-final-completion-truth-and-temporary-goal-removal`: completed_waiting_b_review. No additional deletion is performed in the final slice.
- Remaining blockers: public 410 tombstone removal requires explicit confirmation; resource-order schema/drop stays in schema leaf; deploy/adapters/infra/upstream need separate authorization; future real live/canary execution needs explicit authorization; Langfuse runtime implementation requires a future migration branch before any physical removal.

Authorized follow-up physical delete truth:

- `slice-authorized-live-test-physical-delete`: user authorized physical deletion on 2026-05-14. `scripts/live-test-*` files were removed from the repo without executing live-test, reading secrets, touching deploy/adapters/infra/upstream, or changing public tombstones/schema.

### A1: sync-baseline

从最新 `origin/recovery/platform-v22-trunk` 新开或更新当前 cleanup 分支，确认本分支只属于物理删除 goal。读取 `AGENTS.md`、合同索引、阶段文档、本 goal 和导台。

### A2: read-goal-and-inventory

读取 `docs/recovery/physical-legacy-file-retirement-goal.md` 和 `docs/recovery/physical-legacy-file-retirement-inventory.md`。只允许处理导台里已有明确 decision 的项；遇到未覆盖旧文件必须先扩展导台和 inventory gate。

### A3: select-one-slice

一次只选一个 deletion slice。非 batch mode 的优先顺序为 low-risk delete、legacy script archive/delete、Portal tombstone minimization、OpenCost/Langfuse/runner physical retirement、schema/migration future leaf。batch mode 必须按 run manifest 的 next_slice queue 顺序推进。不得在同一分支混入 Cloud lane、OPL lane、Portal feature 或 release readiness。

### A4: red-gate

先写或扩展 slice gate，让当前未清退状态产生明确失败。失败信息必须指向具体 path、decision 或 active reference，不得用泛化断言掩盖原因。

### A5: apply-deletion-only-change

只执行导台允许的 deletion-only change。删除前必须用 `rg` 或静态 import/ref scan 证明 delete candidate 没有 active reference。禁止删除 `keep_tombstone`、`forbidden_without_auth` 或 `needs_schema_drop_leaf` 项。

### A6: green-gates

运行本 goal gate、inventory gate、slice gate、cleanup completion gate、workflow gate 和 diff check。必要时运行 MVP suite。不得把失败 gate 改弱来通过。

### A7: writeback

更新导台中对应项的处理状态、commit、验证命令和剩余风险。若发现合同冲突或授权缺口，写 blocker，不继续删除。

### A8: B-review-handoff

提交 deletion-only commit，交给 B 复审。非 batch mode 下，B ff-only 吸收并 push 后，下一 slice 才能从最新 trunk 继续。batch mode 下，agent 可在同一分支连续产生 one commit per slice，B may absorb the whole batch after all slice gates pass。物理删除完成后写 completion truth；用户可删除本临时 goal 文件或分支。

## Autonomy Rules

可自治：

- 创建 inventory 文档。
- 创建只读 inventory gate。
- 删除明确 `delete` 且无 active import、无 public surface、无 schema/migration/deploy/adapter/infra/upstream 风险的文件。
- 更新对应 recovery 文档和 smoke allowlist。

必须停下来让用户确认：

- 删除或修改 `deploy/*`、`adapters/*`、`infra/*`、`.sentrux/*` 或 upstream。
- 删除 public 410 tombstone。
- drop schema、删除 migration collection、删除历史账本或 Postgres snapshot helper。
- 运行 build/push、kubectl、live-test、真实云或外部生产 API。
- 读取任何 secret-like 路径。
- inventory gate 与现有合同发生冲突。

每个 deletion slice 必须 deletion-only，不得混入功能开发、UI 调整、Cloud lane、OPL productionization 或 release readiness。每个 slice 必须先 RED gate，再删除，再 GREEN gate。

## Verification

本 goal 分支验收命令：

```bash
node scripts/smoke-test-v22-physical-legacy-batch-run-manifest.mjs
node scripts/smoke-test-v22-physical-legacy-file-retirement-goal.mjs
node scripts/smoke-test-v22-physical-legacy-file-retirement-inventory.mjs
node scripts/smoke-test-v22-cleanup-completion-truth.mjs
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
git diff --check -- docs/recovery scripts
```

本临时 goal 不要求在分支内运行 `node scripts/smoke-test-v22-goal-state-consistency.mjs`，因为该 gate 要求 runtime branch 是 `cleanup/v22-cleanup-completion-truth` 或 `recovery/platform-v22-trunk`。本分支不得为了通过该 gate 改写 `docs/recovery/v22-goal-current.json`；物理清退 goal 是临时工作包，不是常驻 product cursor。

后续 deletion 分支必须运行：

```bash
node scripts/smoke-test-v22-physical-legacy-file-retirement-inventory.mjs
```

后续 deletion 分支必须额外运行对应 targeted smoke，并用 `rg` 或静态 import/ref scan 证明 delete candidate 没有 active reference。
