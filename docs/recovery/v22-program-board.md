# v22 Program Board

board id: v22-program-board

current trunk anchor: bb1238c

current phase: repo-tracked program coordination

current lane: docs/contracts/status lane

next lane: B review and ff-only absorption

本文件是 v22 总执行板的 repo-tracked truth。AGENTS 管窗口纪律，contracts 管产品和接口边界，program board 管 A/B/C/D 窗口角色、三条 program、lane、测试边界和真实副作用规则，program status table 管每条 program 的当前状态和下一棒。

本分支只写 docs 和 smoke，不读 secret，不调用真实云，不改 services，不改 runner/SDK/loader，不改 deploy/.sentrux/adapters/upstream/Gateway/Runtime Bridge，不 build/push/kubectl，不推进 CO-06，不 merge，不 push。

## Window Roles

| window | role | responsibility | default authority | hard stop |
| --- | --- | --- | --- | --- |
| Window A | implementation owner | 负责代码实现、局部 smoke、自测、commit；使用独立 worktree。 | 可在独立 worktree 写目标实现和局部 smoke；不得 merge/push。 | 需要读 secret、真实云、deploy、build/push/kubectl、merge/push 或超出实现边界时停。 |
| Window B | integration/review/absorption owner | 只在主工作区审查、复验、ff-only merge、checkpoint、push。 | 可在主工作区做审查、复验、ff-only merge、checkpoint、push；不得做大功能实现。 | 遇到 dirty/不能 ff-only 必须停。 |
| Window C | docs/contracts/status owner | 负责 docs/contracts/status/board/matrix/smoke；使用独立 worktree。 | 可在独立 worktree 写 docs 和 smoke；不得打云；不得 merge/push。 | 需要 services、真实云、secret、deploy 或业务实现时停。 |
| Window D | authorized side-effect/live coordination owner | 只在用户显式授权后协调真实 readonly live、dependency install、create/release、deploy 等串行副作用。 | 默认不得执行副作用。 | 未有当前会话显式授权、授权范围不清或副作用要扩展时停。 |

## Program Snapshot

| program id | owner window | current phase | active lane | next lane | parallelizable | requires user authorization | B absorption status | evidence commit | next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| portal-product-surface | Window A | local product surface QA and hardening | current-ui-qa | user-flow-hardening | yes | no | pending B review | bb1238c | A/C may open isolated UI/docs lanes; B revalidates before absorption |
| cloud-onboarding | Window C | CO-06 remains needs-user-authorization | readonly-live | readonly-report-review | mixed | yes | pending user authorization and B review | bb1238c | wait for explicit user authorization before readonly live |
| one-person-lab-sync | Window C | sync boundary planning | sync-contract | read-only-download-spike | yes | no for docs; yes for network/live side effects | pending B review | bb1238c | write sync contract/status first; no upstream write |

## Program Required Fields

Each program record must keep these fields:

- program id
- owner window
- current phase
- active lane
- next lane
- lane worktree policy
- branch naming pattern
- write scope
- forbidden scope
- owner self-test boundary
- B revalidation boundary
- required smoke / verification
- parallelizable
- requires user authorization
- serial side effects
- B absorption status
- evidence commit
- next action

## Program Details

### portal-product-surface

| field | value |
| --- | --- |
| program id | portal-product-surface |
| owner window | Window A |
| current phase | local product surface QA and hardening |
| active lane | current-ui-qa |
| next lane | user-flow-hardening |
| lane worktree policy | implementation and QA lanes use independent worktree; B only reviews in main workspace |
| branch naming pattern | `feat/v22-portal-*`, `fix/v22-portal-*`, `docs/v22-portal-*` |
| write scope | `docs/recovery/`, `docs/contracts/`, `scripts/smoke-test-v22-*`, and targeted Portal files only when a future implementation task explicitly allows services |
| forbidden scope | `services/` in this docs/status lane, `deploy/`, `.sentrux/`, `adapters/`, `upstream/`, Gateway, Runtime Bridge, real cloud, secret files |
| owner self-test boundary | local dev/preview QA evidence, role-surface smoke, mobile usability smoke, payload smoke when UI/API changes are in scope |
| B revalidation boundary | rerun affected smoke, inspect screenshots/payloads, confirm ordinary users do not see admin/cloud/internal language |
| required smoke / verification | `smoke-test-v22-portal-role-surface-boundaries.mjs`, `smoke-test-v22-portal-mobile-usability.mjs`, `smoke-test-v22-portal-mobile-table-usability.mjs`, `smoke-test-portal-api-payloads-contract.mjs` when relevant |
| parallelizable | yes |
| requires user authorization | no for local mock/dev QA; yes for any production/live endpoint |
| serial side effects | none by default; deploy/build/push/kubectl remains forbidden without explicit authorization |
| B absorption status | pending B review |
| evidence commit | bb1238c |
| next action | keep product-surface fixes isolated from cloud live lanes |

lanes:

- local-dev-url
- current-ui-qa
- user-flow-hardening
- mobile-usability
- production-projection-after-cloud-report

### cloud-onboarding

| field | value |
| --- | --- |
| program id | cloud-onboarding |
| owner window | Window C |
| current phase | CO-06 remains needs-user-authorization |
| active lane | readonly-live |
| next lane | readonly-report-review |
| lane worktree policy | docs/status lanes use C independent worktree; implementation lanes use A independent worktree; live coordination uses D only after explicit authorization; B absorbs from main workspace |
| branch naming pattern | `docs/v22-cloud-onboarding-*`, `contract/v22-*`, `feat/v22-tencent-*`, `fix/v22-tencent-*` |
| write scope | `docs/recovery/`, `docs/contracts/`, `scripts/smoke-test-v22-*` for C; targeted implementation files only in A branches when explicitly scoped |
| forbidden scope | `services/` in this docs/status lane, `deploy/`, `.sentrux/`, `adapters/`, `upstream/`, Gateway, Runtime Bridge, secrets, real cloud, build/push/kubectl |
| owner self-test boundary | workflow gate, program-board smoke, cloud onboarding board/status/matrix smoke, MVP suite |
| B revalidation boundary | rerun workflow gate, relevant smoke, diff scope, secret hygiene, ff-only merge check |
| required smoke / verification | `smoke-test-v22-program-board.mjs`, `smoke-test-v22-cloud-onboarding-board-status.mjs`, `smoke-test-v22-cloud-onboarding-workflow-contract.mjs`, `smoke-test-v22-mvp-contract-suite.mjs` |
| parallelizable | mixed |
| requires user authorization | yes for readonly live, create/release, dependency install, deploy/build/push/kubectl; no for docs/smoke |
| serial side effects | readonly live; create/release; deploy/build/push/kubectl; dependency install; merge/push |
| B absorption status | pending user authorization and B review |
| evidence commit | bb1238c |
| next action | do not advance CO-06; wait for explicit user authorization before readonly live |

lanes:

- readonly-live
- readonly-report-review
- tc3-cleanup
- create-release-dry-run
- mutation-wrapper
- deploy-plan
- portal-production-integration
- canary-qa-release-status

### one-person-lab-sync

| field | value |
| --- | --- |
| program id | one-person-lab-sync |
| owner window | Window C |
| current phase | sync boundary planning |
| active lane | sync-contract |
| next lane | read-only-download-spike |
| lane worktree policy | docs/status lanes use C independent worktree; any later downloader/runner work uses A independent worktree; B absorbs from main workspace |
| branch naming pattern | `docs/v22-one-person-lab-*`, `contract/v22-one-person-lab-*`, `feat/v22-one-person-lab-*` |
| write scope | `docs/recovery/`, `docs/contracts/`, `scripts/smoke-test-v22-*` for C; no upstream writes |
| forbidden scope | `services/` in this docs/status lane, `deploy/`, `.sentrux/`, `adapters/`, `upstream/`, one-person-lab upstream, secrets, real cloud, build/push/kubectl |
| owner self-test boundary | contract/status smoke, workflow gate, no-upstream-write diff check |
| B revalidation boundary | confirm upstream remains clean, no upstream imports, no deploy/adapters/services drift in docs lane |
| required smoke / verification | program-board smoke now; later sync contract smoke before implementation |
| parallelizable | yes |
| requires user authorization | no for docs; yes for network download, dependency install, updater execution, or any live side effect |
| serial side effects | dependency install; network download; merge/push; deploy/build/push/kubectl if ever authorized |
| B absorption status | pending B review |
| evidence commit | bb1238c |
| next action | define sync contract before any read-only download spike |

lanes:

- sync-contract
- read-only-download-spike
- version-manifest
- integration-boundary
- auto-update-runner

## Testing Boundaries

| boundary | meaning | allowed commands | forbidden commands |
| --- | --- | --- | --- |
| owner self-test | 该窗口完成前必须自己跑的验证。 | Local smoke, typecheck, workflow gate, diff check, local mock/dev QA as scoped by the lane. | secret read, real cloud, live-test, build/push/kubectl, deploy unless explicitly authorized for the lane. |
| B revalidation | B 合并前必须复跑的验证。 | workflow gate, relevant smoke, diff scope, ff-only merge check, checkpoint after merge. | large feature implementation, dirty main absorption, non-ff merge, unreviewed push. |
| user-authorized test | 只有用户授权后才可跑。 | readonly live, create/release, dependency install, deploy/build/push/kubectl, live canary, network updater execution within the explicit authorization scope. | expanding a prior chat authorization to a later execution, reading unapproved secret paths, widening cloud/API/resource scope. |
| forbidden test | 任何非授权阶段不得跑。 | none. | real cloud, secret read, kubeconfig read, deploy/build/push/kubectl, live-test, create/release, production mutation, upstream write. |

## Serial Side Effect Rules

- readonly live、create/release、deploy/build/push/kubectl、dependency install、merge/push 必须串行。
- 除 B 的 merge/push 外，其他真实副作用必须用户显式授权。
- 任何窗口不得把聊天里的授权扩大到下一次执行。
- 真实副作用必须在当前会话重新确认授权边界、secret allowlist、region/API/resource scope、输出位置和 rollback/stop 条件。

## Board Data

<!-- v22-program-board:start -->
```json
{
  "boardId": "v22-program-board",
  "currentTrunkAnchor": "bb1238c",
  "currentPhase": "repo-tracked program coordination",
  "currentLane": "docs/contracts/status lane",
  "nextLane": "B review and ff-only absorption",
  "readsSecretNow": false,
  "callsRealCloudNow": false,
  "modifiesServicesNow": false,
  "runsBuildPushKubectlNow": false,
  "advancesCo06Now": false,
  "automerges": false,
  "autopushes": false,
  "windows": [
    {
      "windowId": "Window A",
      "role": "implementation owner",
      "responsibility": "code implementation, local smoke, self-test, commit in independent worktree",
      "requiresIndependentWorktree": true,
      "mayMergePush": false
    },
    {
      "windowId": "Window B",
      "role": "integration/review/absorption owner",
      "responsibility": "main workspace review, revalidation, ff-only merge, checkpoint, push",
      "usesMainWorkspace": true,
      "mustStopOnDirtyOrNonFf": true
    },
    {
      "windowId": "Window C",
      "role": "docs/contracts/status owner",
      "responsibility": "docs, contracts, status, board, matrix, smoke in independent worktree",
      "requiresIndependentWorktree": true,
      "mayCallRealCloudByDefault": false
    },
    {
      "windowId": "Window D",
      "role": "authorized side-effect/live coordination owner",
      "responsibility": "coordinate serial side effects only after explicit user authorization",
      "mayRunSideEffectsByDefault": false
    }
  ],
  "programs": [
    {
      "programId": "portal-product-surface",
      "ownerWindow": "Window A",
      "currentPhase": "local product surface QA and hardening",
      "activeLane": "current-ui-qa",
      "nextLane": "user-flow-hardening",
      "laneWorktreePolicy": "independent worktree for implementation and QA lanes; B reviews in main workspace",
      "branchNamingPattern": "feat/v22-portal-* | fix/v22-portal-* | docs/v22-portal-*",
      "writeScope": [
        "docs/recovery/",
        "docs/contracts/",
        "scripts/smoke-test-v22-*"
      ],
      "forbiddenScope": [
        "services/",
        "deploy/",
        ".sentrux/",
        "adapters/",
        "upstream/",
        "Gateway",
        "Runtime Bridge",
        "secret",
        "real cloud"
      ],
      "ownerSelfTestBoundary": "local dev/mock QA, role-surface smoke, mobile usability smoke, payload smoke when relevant",
      "bRevalidationBoundary": "affected smoke, screenshots/payload inspection, user/admin boundary review",
      "requiredSmokeOrVerification": [
        "scripts/smoke-test-v22-portal-role-surface-boundaries.mjs",
        "scripts/smoke-test-v22-portal-mobile-usability.mjs",
        "scripts/smoke-test-v22-portal-mobile-table-usability.mjs"
      ],
      "parallelizable": true,
      "requiresUserAuthorization": false,
      "serialSideEffects": [],
      "bAbsorptionStatus": "pending B review",
      "evidenceCommit": "bb1238c",
      "nextAction": "keep product-surface fixes isolated from cloud live lanes",
      "lanes": [
        "local-dev-url",
        "current-ui-qa",
        "user-flow-hardening",
        "mobile-usability",
        "production-projection-after-cloud-report"
      ]
    },
    {
      "programId": "cloud-onboarding",
      "ownerWindow": "Window C",
      "currentPhase": "CO-06 remains needs-user-authorization",
      "activeLane": "readonly-live",
      "nextLane": "readonly-report-review",
      "laneWorktreePolicy": "C docs/status worktree, A implementation worktree, D live coordination only after explicit authorization, B main workspace absorption",
      "branchNamingPattern": "docs/v22-cloud-onboarding-* | contract/v22-* | feat/v22-tencent-* | fix/v22-tencent-*",
      "writeScope": [
        "docs/recovery/",
        "docs/contracts/",
        "scripts/smoke-test-v22-*"
      ],
      "forbiddenScope": [
        "services/",
        "deploy/",
        ".sentrux/",
        "adapters/",
        "upstream/",
        "Gateway",
        "Runtime Bridge",
        "secret",
        "real cloud"
      ],
      "ownerSelfTestBoundary": "workflow gate, program-board smoke, cloud onboarding board/status/matrix smoke, MVP suite",
      "bRevalidationBoundary": "workflow gate, relevant smoke, diff scope, secret hygiene, ff-only merge check",
      "requiredSmokeOrVerification": [
        "scripts/smoke-test-v22-program-board.mjs",
        "scripts/smoke-test-v22-cloud-onboarding-board-status.mjs",
        "scripts/smoke-test-v22-cloud-onboarding-workflow-contract.mjs",
        "scripts/smoke-test-v22-mvp-contract-suite.mjs"
      ],
      "parallelizable": false,
      "requiresUserAuthorization": true,
      "serialSideEffects": [
        "readonly live",
        "create/release",
        "deploy/build/push/kubectl",
        "dependency install",
        "merge/push"
      ],
      "bAbsorptionStatus": "pending user authorization and B review",
      "evidenceCommit": "bb1238c",
      "nextAction": "do not advance CO-06; wait for explicit user authorization before readonly live",
      "lanes": [
        "readonly-live",
        "readonly-report-review",
        "tc3-cleanup",
        "create-release-dry-run",
        "mutation-wrapper",
        "deploy-plan",
        "portal-production-integration",
        "canary-qa-release-status"
      ]
    },
    {
      "programId": "one-person-lab-sync",
      "ownerWindow": "Window C",
      "currentPhase": "sync boundary planning",
      "activeLane": "sync-contract",
      "nextLane": "read-only-download-spike",
      "laneWorktreePolicy": "C docs/status worktree first; A implementation worktree later; no upstream writes; B main workspace absorption",
      "branchNamingPattern": "docs/v22-one-person-lab-* | contract/v22-one-person-lab-* | feat/v22-one-person-lab-*",
      "writeScope": [
        "docs/recovery/",
        "docs/contracts/",
        "scripts/smoke-test-v22-*"
      ],
      "forbiddenScope": [
        "services/",
        "deploy/",
        ".sentrux/",
        "adapters/",
        "upstream/",
        "one-person-lab upstream",
        "secret",
        "real cloud"
      ],
      "ownerSelfTestBoundary": "contract/status smoke, workflow gate, no-upstream-write diff check",
      "bRevalidationBoundary": "upstream remains clean, no upstream imports, no deploy/adapters/services drift in docs lane",
      "requiredSmokeOrVerification": [
        "scripts/smoke-test-v22-program-board.mjs"
      ],
      "parallelizable": true,
      "requiresUserAuthorization": false,
      "serialSideEffects": [
        "dependency install",
        "network download",
        "merge/push"
      ],
      "bAbsorptionStatus": "pending B review",
      "evidenceCommit": "bb1238c",
      "nextAction": "define sync contract before any read-only download spike",
      "lanes": [
        "sync-contract",
        "read-only-download-spike",
        "version-manifest",
        "integration-boundary",
        "auto-update-runner"
      ]
    }
  ],
  "serialSideEffects": [
    "readonly live",
    "create/release",
    "deploy/build/push/kubectl",
    "dependency install",
    "merge/push"
  ],
  "testBoundaries": [
    "owner self-test",
    "B revalidation",
    "user-authorized test",
    "forbidden test"
  ]
}
```
<!-- v22-program-board:end -->
