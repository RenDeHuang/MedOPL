# v22 Agent-first Development Loop

本文档是 v22 的 AI 开发流程规范。它吸收 OpenSpec 类方法里的 intent/change/validation 思路，但不新增 `openspec/` 第二事实源。当前仓库只保留 `contracts / truth / index / eval / agent-runs` 五层。

## 单一流程

每个 leaf 必须按这个顺序推进：

1. `goal`：明确本次目标、非目标、分支、允许写入范围、禁止事项和模型记录。
2. `contracts`：读取 `AGENTS.md`、`docs/contracts/README.md`、相关 `docs/contracts/v22-*.md`、`docs/recovery/status-matrix.md`、`docs/recovery/mvp-contract-acceptance.md`。
3. `truth`：读取当前产品/架构/阶段事实，不能用聊天记忆替代 `docs/recovery/*`。
4. `index`：确认 `docs/recovery/v22-goal-current.json`、`docs/recovery/v22-agent-verify-manifest.json`、gap matrix 和 branch override。
5. `eval-first`：先确认现有 eval 是否覆盖目标；不足时先补窄 gate，再实现。
6. `implementation`：只改本 leaf 的 active surface，不做兼容层，不恢复旧路线。
7. `verification`：运行 manifest 指定命令和必要局部验证，不用口头判断完成。
8. `agent-run record`：写入 `docs/recovery/agent-runs/<date>-<leaf>.md`，记录模型、subagent、合同包、验证、B review、未做事项。
9. `B review only absorb`：A 分支不 push、不 merge trunk。B fresh review 通过后 ff-only 吸收并 push。
10. `post-absorb truth`：吸收后另做小分支，把 `last_absorbed_commit`、cursor、scoreboard、agent-run B review 写回。

## 文件职责

| Layer | Files | Purpose |
| --- | --- | --- |
| `contracts` | `AGENTS.md`, `docs/contracts/README.md`, `docs/contracts/v22-*.md` | 长期边界、授权和非目标。 |
| `truth` | `docs/active/README.md`, `docs/product.md`, `docs/architecture.md`, `v22-truth-freeze.md`, `status-matrix.md`, `mvp-contract-acceptance.md` | 当前产品和系统事实；`docs/active/README.md` 是唯一人读 current truth。 |
| `index` | `v22-goal-current.json`, `v22-agent-verify-manifest.json`, `v22-current-vs-ideal-gap-matrix.md`, `v22-product-completion-scoreboard.json` | 下一步 cursor、gap、允许写入范围和验证入口。 |
| `eval` | `scripts/v22-verify.mjs`, `scripts/v22-test-classification.mjs`, `tests/**/*.mjs.mjs` | 机器验收。 |
| `agent-runs` | `docs/recovery/agent-runs/*.md` | 每一步开发证据和吸收记录。 |

## 分支类型

- `feat/*`：业务或服务能力实现。必须有 contract/eval/trace。
- `cleanup/*`：物理清退、真相收敛、索引修正。不得顺手做业务实现。
- `contract/*`：合同新增或边界变更。必须先让用户确认主叙事变化。

## subagent 纪律

- 只有互不冲突、读写范围独立的任务才并行。
- 每个 subagent 必须显式记录职责和模型。
- 允许模型仅限 `gpt-5.4`、`gpt-5.3-codex`、`gpt-5.4-mini`。
- 只读审计 subagent 不得写文件。
- 写入 subagent 必须有独立 write scope，避免覆盖他人改动。
- 不再需要的 subagent 必须及时关闭。

## eval 纪律

- `scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk` 是默认入口。
- cleanup 分支若当前 product cursor 不匹配，必须在 `v22-agent-verify-manifest.json` 加 branch override，而不是修改 product cursor。
- smoke 只用于 health/golden；宽口径验证叫 eval 或 local-regression。
- future-authorized cloud gates 只能分类可见，不授权真实云。
- 不允许 fake success、默认兜底、隐式降级或临时补丁掩盖缺能力。

## 禁止事项

- 不读取 secret、token、kubeconfig、SSH private key、`.env`。
- 不调用真实云。
- 不执行 build/push/kubectl/deploy/live-test，除非用户单独授权。
- 不修改 `deploy/*`、`.sentrux/*`、`adapters/*`、`infra/*`、one-person-lab upstream。
- 不把 raw provider key、launchToken、runtimeToken、signedUrl、objectKey、localPath 写入前端持久状态、日志、evidence 或 git。
- 不新增旧 Portal、旧 Adapter、旧 upstream 兼容层。

## 后续落地

下一条业务 leaf 应继续从 `v22-goal-current.json` 的 cursor 开始。当前索引指向 `leaf-portal-postgres-redis-local-production-data-closure`，目标是把本地 JSON truth 迁向可云迁移的数据层：PostgreSQL 为 canonical truth，Redis 只做 session/cache/queue/lock。
