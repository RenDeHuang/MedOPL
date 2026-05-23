# MedOPL Change Packages

Owner: `MedOPL`
Purpose: `repo_native_change_lifecycle`
State: `active_change_governance`
Machine boundary: 本目录描述 repo-native change lifecycle。机器 gate 在 `tests/contract/contract-test-v22-change-package-lifecycle.mjs`、`scripts/v22-test-classification.mjs`、`tests/fixtures/v22/agent-verify-manifest.json` 和 `scripts/v22-workflow-gate.mjs` 中执行。本文不是 current truth、不是 durable spec 本体、不是 evidence store。

`changes/` 承接 OpenSpec-style change governance，但使用 MedOPL v22 语义。`docs/active/README.md remains the only human current truth`；open change 不能把 active 写成计划板，也不能替代 `docs/specs/README.md`、root `specs/**`、`tests/**` 或 `docs/history/README.md`。

## Lifecycle

每个正式工程变更必须遵守 repo-native change lifecycle：

```text
proposal -> spec delta -> design -> tasks -> eval plan -> implementation -> verify -> review -> archive -> durable specs sync -> history closeout
```

目录语义：

- `changes/active/<change-id>`: 当前正在 authoring / review / closeout 的 change package。
- `changes/archive/YYYY-MM-DD-<change-id>`: 已完成、已归档、已同步 durable specs 并写入 history closeout 的 change package。

`change-id` 必须是 kebab-case，必须表达业务或治理意图，不能使用 `template`、`tmp`、`misc`、`wip` 或聊天轮次名。

## Required Files

每个 `changes/active/<change-id>` 和 `changes/archive/YYYY-MM-DD-<change-id>` 必须包含：

| File | Purpose |
| --- | --- |
| `proposal.md` | 为什么做、目标、非目标、owner、授权边界、affected plane。 |
| `spec-delta.md` | 对 durable specs 的 `ADDED` / `MODIFIED` / `REMOVED` / `CANNOT-CLAIM` / `EVALS` delta。 |
| `design.md` | 实现设计、边界、数据流、失败模式、surface impact。 |
| `tasks.md` | 可单独 commit、可验证的任务列表。 |
| `eval-plan.md` | 新增或复用哪些 eval、verify 命令、evidence level 和不能宣称什么。 |
| `review.md` | 自审、独立 review、blocker 处理和剩余风险。 |
| `closeout.md` | commits、验证结果、can-claim、cannot-claim、archive target、history handoff 和 next owner。 |

## File Templates

Do not create a `template` change directory. Copy these sections into the target `changes/active/<change-id>/` files and fill every field.

### proposal.md

````markdown
# <change-id> Proposal

Status: authoring
Branch: <branch>
Base trunk: origin/recovery/platform-v22-trunk
Owner: <MedOPL plane owner>
Affected plane: Product | Integration | Runtime | Operations | Framework

## Why

<problem or opportunity>

## Goals

- <goal>

## Non-Goals

- <explicit non-goal>

## Authorization Boundary

- No secret read unless explicitly authorized.
- No real cloud, deploy, kubectl, build/push or live-test unless explicitly authorized.

## Subscribed Truth

- docs/active/README.md
- docs/specs/README.md or specs/<domain>/spec.md
- docs/evidence/README.md
- docs/policies/README.md
````

### spec-delta.md

````markdown
# <change-id> Spec Delta

Target specs:

- specs/<domain>/spec.md

## ADDED

- <new requirement id and behavior>

## MODIFIED

- <existing requirement id and exact behavior change>

## REMOVED

- <retired requirement id and tombstone>

## CANNOT-CLAIM

- <unsupported adjacent claim>

## EVALS

- <eval command or planned eval file>
````

### design.md

````markdown
# <change-id> Design

## Architecture

<components and boundaries>

## Data Flow

<source, projection, state, evidence>

## Failure Modes

- <fail-closed condition>

## Surface Impact

- source:
- docs:
- specs:
- tests:
````

### tasks.md

````markdown
# <change-id> Tasks

- [ ] Step 0: baseline audit
- [ ] Step 1: spec delta and eval RED
- [ ] Step 2: implementation
- [ ] Step 3: verification
- [ ] Step 4: review
- [ ] Step 5: archive and closeout
````

### eval-plan.md

````markdown
# <change-id> Eval Plan

## Required Commands

```bash
node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json
```

## Evidence Level

- local contract proof

## Can Claim

- <bounded conclusion>

## Cannot Claim

- <unsupported conclusion>
````

### review.md

````markdown
# <change-id> Review

## Self Review

- rules/status/evidence separation:
- spec-to-eval traceability:
- secret hygiene:
- false production claim check:

## Independent Review

- reviewer:
- model:
- result:
- blockers:
````

### closeout.md

````markdown
# <change-id> Closeout

Status: ready_for_landing_review | landed | archived

## Commits

- <sha> <message>

## Verification

- `<command>`: pass/fail

## Can Claim

- <bounded claim>

## Cannot Claim

- <unsupported claim>

## Archive Target

- changes/archive/YYYY-MM-DD-<change-id>

## History Handoff

- docs/history/README.md

## Next Owner

- <owner>
````

## Admission Rules

正式开发开始前，change package 必须声明：

- branch name and base trunk
- owner and affected platform plane
- subscribed docs/spec/policy/evidence files
- impacted source surfaces
- authorization boundary
- spec delta target
- eval plan and expected evidence level
- cannot-claim list
- archive and history closeout target

缺少 owner、授权边界、spec delta、eval plan、cannot-claim 或 archive target 时，必须 fail closed。

## Spec Delta Rules

`spec-delta.md` 使用固定段落：`ADDED / MODIFIED / REMOVED / CANNOT-CLAIM / EVALS`。

Every delta entry must reference a target `specs/<domain>/spec.md` file. Delta 不能只写“更新文档”或“同步实现”；必须明确新增、修改或移除的 requirement id、owner plane、source surface、required evals、evidence level 和 cannot-claim。

Accepted deltas must be synced into durable specs during closeout. 如果 delta 只完成了 proposal 或 eval RED，不能 archive 为 landed；必须在 `closeout.md` 中记录未同步原因、blocker 和下一棒 owner。

Delta 不是 current truth。只有 closeout 接受并同步到 `specs/**` 后，durable specs 才改变。若 current cursor 或 blocker 因此变化，再更新 `docs/active/README.md` 和 `tests/fixtures/v22/goal-current.json`。

## Boundaries

Change packages must not store secrets. 禁止写入 raw provider key、bearer token、launchToken、runtimeToken、kubeconfig、SecretId/SecretKey、SSH private key、object key、local path、signed URL 或任何可还原敏感内容。

Change packages must not claim production truth. smoke、proof、canary、future-authorized 或 local regression 只能证明限定 scope；不能自动升级为真实云、真实扣费、kubectl rollout、production deploy、live provider 或 production runtime 已完成。

Change packages must not restore retired surfaces:

- `docs/contracts/**`
- `docs/recovery/**`
- root stage docs such as `docs/status.md`, `docs/invariants.md`, `docs/product.md`, `docs/architecture.md`, `docs/decisions.md`
- old `scripts/smoke-test-*`
- `user_owned`, `resource-order`, old runner/provisioner, OpenCost or Langfuse primary product narrative

## Closeout

完成一个 change 时必须：

1. run the eval plan and record exact commands in `closeout.md`;
2. sync accepted deltas into root `specs/**` or the current durable spec owner;
3. move the package from `changes/active/<change-id>` to `changes/archive/YYYY-MM-DD-<change-id>`;
4. add a compact summary to `docs/history/README.md`;
5. update `docs/active/README.md` and `tests/fixtures/v22/goal-current.json` only when current cursor or blocker changes.

Archive rules:

- archived directory names must use `YYYY-MM-DD-<change-id>`;
- archived `closeout.md` status must be `landed` or `archived`;
- archived `closeout.md` must point its Archive Target to its own `changes/archive/YYYY-MM-DD-<change-id>` directory;
- a landed change must not remain in `changes/active/<change-id>`.

Durable specs sync rules:

- every archived `spec-delta.md` must target at least one `specs/<domain>/spec.md`;
- accepted requirement ids from `spec-delta.md` must appear in the target durable spec;
- if a delta is intentionally not accepted, `closeout.md` must record blocker and next owner instead of claiming landed/archive completion.

History keeps summary only. Full proposal, design, tasks, spec delta, eval plan and review context belong in the archived change package.
