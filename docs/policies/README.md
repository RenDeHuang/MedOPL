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

## Agent Workflow Policy

- A 窗口只做开发/清退：从最新 `origin/recovery/platform-v22-trunk` 开隔离分支，声明订阅合同、边界和验收命令，按 step commit，最后交 B review。
- B 窗口才做 fresh review、ff-only absorb 和 push。
- subagent 必须显式记录模型；允许模型为 `gpt-5.4`、`gpt-5.3-codex`、`gpt-5.4-mini`。
- 真实云、secret、deploy、kubectl、live-test 和 build/push 必须单独授权。

## Physical Retirement Policy

文件可物理清退前必须同时满足：

1. 替代 truth 已写入目标 taxonomy。
2. 活引用已迁移，旧路径不再作为 current truth、default verify 或 compatibility alias。
3. gate 证明旧路径不能恢复为 current truth、default verify 或 compatibility alias。

## Retirement Lifecycle Policy

每个 v22 leaf 必须按同一个生命周期运行：

```text
truth -> gap -> eval -> implementation/cleanup -> verify -> B absorb -> post-absorb truth closeout -> next cursor
```

稳定规则：

- `docs/active/README.md` 是唯一人读 current truth；不得新建第二份 active truth 或阶段板。
- `docs/specs/README.md` 是唯一合同/spec truth；不得恢复旧 contracts 目录。
- `docs/history/README.md` 是唯一 agent-run / B absorb / cleanup closeout 摘要入口；不得恢复旧 recovery 目录或旧 agent-run 文件树。
- `tests/fixtures/v22/goal-current.json` 是唯一机器 cursor；`tests/fixtures/v22/agent-verify-manifest.json` 是唯一 verify manifest。
- 新增 repo-local eval 必须进入 `tests/{health,smoke,contract,regression,future-authorized}`；不得新增 `scripts/smoke-test-*`。
- `scripts/` 只保 runner、classifier、workflow gate，以及当前仍被 services 引用的 workspace-to-minio sync helper。
- B 已吸收并 push 的 leaf 不能长期保持 `ready_for_b_review`；必须执行 post-absorb truth closeout。
- current cursor 不能停在已完成 leaf，也不能把 `future-authorized`、真实云、deploy、live-test 或 release readiness 标成 cursor-eligible，除非用户单独授权。

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
