# Policies Truth

Owner: `MedOPL`
Purpose: `policy_truth`
State: `active`
Machine boundary: 本文是人读政策入口。稳定协作纪律仍由 `AGENTS.md` 约束；合同和 verify gate 仍是机器检查边界。

## Stable Rules

- 未授权不得读取 secret、raw provider key、token、kubeconfig、SSH private key 或云凭据。
- 未授权不得真实云调用、build/push、kubectl、deploy 或 live-test。
- 未授权不得修改 `deploy/*`、`.sentrux/*`、`adapters/*`、`infra/*` 或 one-person-lab upstream。
- agent-run evidence 是历史证据，不是 product truth。
- `scripts/v22-verify.mjs` 是默认 agent-facing verification 入口。

## Smoke / Eval Policy

`tests/**/*.mjs` 当前是 repo-local eval 文件族。只有 `health-check` 和 `smoke-golden` 可以被称为 smoke。`contract-local` 与 `local-regression` 是 eval；`future-authorized` 只表示未来授权边界可见性，不授权真实云。

## Framework Landing Protocol

- authoring branch 只做开发/清退：从最新 `origin/recovery/platform-v22-trunk` 开隔离分支，声明订阅合同、边界和验收命令，按 step commit，最后交 landing gate。
- 正式工程变更必须先有 `changes/active/<change-id>`，把 proposal、spec delta、design、tasks、eval plan、review 和 closeout 作为 repo-native artifact 管理。
- landing gate 执行 fresh review、ff-only merge、push、post-push verification 和 post-merge closeout；authoring branch 不自合入。
- parallel lane 可以并行推进互不冲突的只读审计或清退分支，但合入前必须基于最新 trunk 重放并通过同一个 landing gate。
- subagent 必须显式记录模型；允许模型为 `gpt-5.4`、`gpt-5.3-codex`、`gpt-5.4-mini`。
- 真实云、secret、deploy、kubectl、live-test 和 build/push 必须单独授权。

## Physical Cleanup Policy

文件可物理清退前必须同时满足：

1. 替代 truth 已写入目标 taxonomy。
2. 活引用已迁移，旧路径不再作为 current truth、default verify 或 compatibility alias。
3. gate 证明旧路径不能恢复为 current truth、default verify 或 compatibility alias。

## Human / Machine Boundary

README files are human truth, not machine APIs. Tests and workflow gates may verify document existence, taxonomy structure, manifest/schema consistency, command references, cleanup-path protection and closeout state, but they must not assert prose wording as machine truth or depend on Markdown titles as API.

机器判断优先使用 `tests/fixtures/v22/goal-current.json`、`tests/fixtures/v22/agent-verify-manifest.json`、`tests/**`、source code and runner behavior。Markdown 文档负责解释事实与边界；如果需要可执行判断，必须把判断下沉到 JSON fixture、test registry、source contract 或 explicit gate。

History 中的旧路线只能作为 provenance，不得反向恢复 active owner、default verify、compat alias 或 product mainline。

## Repo-Native Change Package Policy

`changes/README.md` 定义 change package 生命周期。`docs/active/README.md` 只保 current truth；proposal、spec delta、design、tasks、eval plan、review 和 closeout 必须进入 `changes/active/<change-id>`，完成后进入 `changes/archive/YYYY-MM-DD-<change-id>`。

Change package 是正式工程变更的准入面，不是第二份 current truth、不是 secret store、不是 production evidence。缺少 owner、授权边界、spec delta、eval plan、cannot-claim 或 archive target 时，必须 fail closed。

聊天 prompt 可以启动工作，但不能替代 repo-native change package。后续 agent 必须能够只读 repo 就知道 open change、spec delta、eval plan、closeout 状态和 archive target。

## Framework Truth-Layer Policy

- `docs/framework/README.md` 是 MedOPL Platform Framework 的 owner boundary、surface budget、admission 和 readiness 人读入口。
- `docs/evidence/README.md` 是 evidence-after-contract、证据等级和 can-claim / cannot-claim 人读入口。
- `docs/framework/README.md` 和 `docs/evidence/README.md` 都不是第二份 current truth；当前状态仍只归 `docs/active/README.md` 和 `tests/fixtures/v22/goal-current.json`。
- Framework view 不得照抄 one-person-lab 的 AI runtime、executor、family runtime、MAS/MAG/RCA、App/operator 或专属命令语义。
- Evidence view 不得保存 secret、raw provider payload、live cloud payload 或可还原敏感内容；真实外部 evidence 默认只进 `.runtime` 或外部授权 evidence store，git 只保脱敏摘要。
- 新增 framework/evidence gate 必须进入 `tests/**` 和 `scripts/v22-test-classification.mjs`，不得恢复 `scripts/smoke-test-*`。

## Cleanup Lifecycle Policy

每个 v22 leaf 必须按同一个生命周期运行：

```text
truth -> gap -> eval -> implementation/cleanup -> verify -> landing gate -> post-merge closeout -> next cursor
```

正式工程变更的扩展生命周期为：

```text
truth -> changes/active/<change-id> -> spec delta -> eval plan -> implementation/cleanup -> verify -> review -> changes/archive/<date-change-id> -> durable specs sync -> history closeout -> next cursor
```

稳定规则：

- `docs/active/README.md` 是唯一人读 current truth；不得新建第二份 active truth 或阶段板。
- `docs/specs/README.md` 是唯一合同/spec truth；不得恢复旧 contracts 目录。
- `docs/history/README.md` 是唯一 agent-run / landing gate / cleanup closeout 摘要入口；不得恢复旧 recovery 目录或旧 agent-run 文件树。
- `tests/fixtures/v22/goal-current.json` 是唯一机器 cursor；`tests/fixtures/v22/agent-verify-manifest.json` 是唯一 verify manifest。
- 新增 repo-local eval 必须进入 `tests/{health,smoke,contract,regression,future-authorized}`；不得新增 `scripts/smoke-test-*`。
- `scripts/` 只保 runner、classifier、workflow gate，以及当前仍被 services 引用的 workspace-to-minio sync helper。
- 已通过 landing gate 并 push 的 leaf 不能长期保持 `ready_for_landing_review`；必须执行 post-merge closeout。
- current cursor 不能停在已完成 leaf，也不能把 `future-authorized`、真实云、deploy、live-test 或 release readiness 标成 cursor-eligible，除非用户单独授权。
- slide 可以有组件、API、数据、UI 或测试子任务，但这些子任务只能存在于代码、tests、fixtures、manifest 或 history closeout 摘要中；不得新增 per-slide docs、subslide docs、shadow archive 或未注册测试。
- slide authoring branch 提交前必须跑 `npm run test:fast` 和 `npm run test:lanes`，用 repo bloat、lane registry、product-loop preflight 和 health gate 防止 docs/tests/scripts 在产品实现中再次膨胀。

## Current Sources

- `AGENTS.md`
- `docs/active/README.md`
- `docs/specs/README.md`
- `docs/delivery/README.md`
- `docs/history/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-verify.mjs`
- `scripts/v22-test-classification.mjs`
- `scripts/v22-workflow-gate.mjs`
