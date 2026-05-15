# v22 Autonomous Goal Runner

This document defines runner governance for long-running MedOPL v22 goal execution. It does not change the current cursor, product truth, cloud authorization, or B absorption rule.

## Purpose

The purpose is 合同 + manifest + runner 驱动 so code follows contracts instead of relying on an agent remembering scattered smoke scripts. The operating goal is simple: 代码跟上合同.

The current reference pattern from steipete's public agent tooling is:

- AGENTS.md 只保留稳定纪律 and repo-local non-negotiable boundaries.
- skills/scripts 承接可执行工作流 and reusable operating procedures.
- manifest is the place where an agent discovers what to read and what to run; manifest 是 allowlist 和验证入口权威.
- small scripts enforce docs, gates, and handoff checks before coding or commit.

MedOPL maps that pattern to v22 as:

- `AGENTS.md` keeps durable workspace law and forbidden operations.
- `docs/recovery/v22-goal-current.json` keeps the current cursor truth.
- `docs/recovery/v22-agent-verify-manifest.json` is the allowlist and verification bundle authority.
- `docs/recovery/v22-autonomous-goal-runner-policy.json` is the autonomous runner policy.
- `scripts/v22-verify.mjs` is the unified runner.
- smoke 只做 atomic gate.

## Scope

This is runner governance, not a new product leaf. It does not advance `leaf-cloud-lane-readonly-status-audit`, does not unlock S5, and does not mark any Cloud, Portal, OPL, release, or dependency work complete.

The autonomous runner may only continue while the next unit is a manifest-defined leaf and the current policy permits its risk class.

## Risk Classes

- `local_doc_eval`: allowed for auto-run and auto-review inside this protocol.
- `local_service_code`: may be prepared by a normal implementation branch, but not automatically reviewed or absorbed by this protocol.
- `sensitive_boundary`: stop and request step-local authorization.
- `live_external`: stop and request step-local authorization.

The policy field `cursor_advancement_source` is `post_absorb_trunk_only`. That means cursor movement can only happen after the relevant branch is absorbed into trunk and the new trunk truth is written.

## Required Loop

Every leaf still runs the existing v22 loop:

1. read current state and manifest
2. declare subscribed contracts
3. create or confirm eval
4. implement the minimum change
5. run `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk`
6. write success or failure truth
7. commit
8. hand off to B or an explicitly authorized auto-B lane

每个 leaf 仍然独立 branch、verify、receipt、commit、B absorb. It is forbidden to combine unrelated leaves into one large change just because the runner is autonomous.

## Actor Boundary

A can author a leaf branch. B can review, ff-only absorb, and push trunk. A 不得伪装 B 吸收.

An auto-B lane, if introduced later, must be a separate policy and must be limited by risk class, diff scope, verification output, and explicit trunk mutation authority. This contract does not authorize automatic merge of risky work.

## Stop Conditions

The runner must stop before any operation that matches:

- secret
- live-cloud
- true-cloud-mutation
- build-push-kubectl
- deploy
- live-test
- upstream-write
- dependency-upgrade

The runner also stops if verification fails, if the branch changes unsubscribed files, if the same gate fails repeatedly without failure analysis, if the problem should split, or if B absorption criteria are not satisfied.

## Receipts

Autonomous runs write receipts under `.runtime/v22-autonomous-goal-runner/`. Receipts stay out of git and should include:

- leaf id
- branch
- model
- risk class
- subscribed contracts
- changed files
- verification commands
- verification summary
- failure category when applicable
- next cursor recommendation

Repo-tracked docs only receive sanitized truth writeback.

## Verification

Policy and manifest wiring are verified by:

```bash
node scripts/v22-verify.mjs suite autonomous --base origin/recovery/platform-v22-trunk
```

The autonomous suite checks the runner contract, policy JSON, manifest suite registration, unified runner dry-run, and product-goal harness compatibility.

## Non-Goals

- no service implementation
- no UI implementation
- no true cloud or deploy execution
- no secret read
- no upstream one-person-lab modification
- no automatic release readiness unlock
- no automatic cursor advancement before B absorption
- no automatic merge of high-risk branches
