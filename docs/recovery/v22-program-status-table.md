# v22 Program Status Table

board id: v22-program-board

本状态总表记录 v22 三条 program 的当前状态、owner window、lane、B absorption status、evidence commit 和 next action。`docs/recovery/v22-program-board.md` 是执行板；本文件只记录当前 program status，不推进 CO-06，不授权 live，不执行真实副作用。

当前分支只写 docs 和 smoke，不读 secret，不调用真实云，不改 services，不改 deploy/.sentrux/adapters/upstream/Gateway/Runtime Bridge，不 build/push/kubectl，不 merge，不 push。

## Plain Status Summary

- portal-product-surface: active in current-ui-qa; next user-flow-hardening; B absorption pending review.
- cloud-onboarding: CO-06 remains needs-user-authorization; active lane readonly-live; next readonly-report-review after explicit user authorization and redacted report.
- one-person-lab-sync: active in sync-contract; next read-only-download-spike; upstream remains clean and read-only.

## Status Table

| program id | owner window | current phase | active lane | next lane | B absorption status | evidence commit | next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| portal-product-surface | Window A | local product surface QA and hardening | current-ui-qa | user-flow-hardening | pending B review | bb1238c | keep UI/product fixes isolated; B revalidates before absorption |
| cloud-onboarding | Window C | CO-06 remains needs-user-authorization | readonly-live | readonly-report-review | pending user authorization and B review | bb1238c | do not advance CO-06; wait for explicit user authorization before readonly live |
| one-person-lab-sync | Window C | sync boundary planning | sync-contract | read-only-download-spike | pending B review | bb1238c | define sync contract before any read-only download spike |

## Program Links

- total program board: `docs/recovery/v22-program-board.md`
- total program status table: `docs/recovery/v22-program-status-table.md`
- cloud onboarding execution board: `docs/recovery/cloud-onboarding-execution-board.md`
- cloud onboarding status table: `docs/recovery/cloud-onboarding-status-table.md`
- cloud onboarding verification matrix: `docs/recovery/cloud-onboarding-verification-matrix.md`

## Testing Boundaries

| boundary | status-table meaning |
| --- | --- |
| owner self-test | owner window must run scoped local verification before handoff. |
| B revalidation | B reruns required checks before ff-only absorption. |
| user-authorized test | real readonly live, create/release, dependency install, deploy/build/push/kubectl, or network updater execution only after explicit user authorization. |
| forbidden test | non-authorized phases must not read secret, call real cloud, run live-test, build/push/kubectl, create/release, deploy, or write upstream. |

## Status Data

<!-- v22-program-status-table:start -->
```json
{
  "boardId": "v22-program-board",
  "currentTrunkAnchor": "bb1238c",
  "programs": [
    {
      "programId": "portal-product-surface",
      "ownerWindow": "Window A",
      "currentPhase": "local product surface QA and hardening",
      "activeLane": "current-ui-qa",
      "nextLane": "user-flow-hardening",
      "bAbsorptionStatus": "pending B review",
      "evidenceCommit": "bb1238c",
      "nextAction": "keep UI/product fixes isolated; B revalidates before absorption"
    },
    {
      "programId": "cloud-onboarding",
      "ownerWindow": "Window C",
      "currentPhase": "CO-06 remains needs-user-authorization",
      "activeLane": "readonly-live",
      "nextLane": "readonly-report-review",
      "bAbsorptionStatus": "pending user authorization and B review",
      "evidenceCommit": "bb1238c",
      "nextAction": "do not advance CO-06; wait for explicit user authorization before readonly live"
    },
    {
      "programId": "one-person-lab-sync",
      "ownerWindow": "Window C",
      "currentPhase": "sync boundary planning",
      "activeLane": "sync-contract",
      "nextLane": "read-only-download-spike",
      "bAbsorptionStatus": "pending B review",
      "evidenceCommit": "bb1238c",
      "nextAction": "define sync contract before any read-only download spike"
    }
  ]
}
```
<!-- v22-program-status-table:end -->
