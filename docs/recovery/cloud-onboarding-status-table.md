# v22 Cloud Onboarding Status Table

program id: v22-cloud-onboarding

本状态总表记录 v22 cloud onboarding 每阶段状态、证据、owner、下一棒、required smoke 和 user gate。AGENTS 管纪律，contracts 管边界，execution board 管当前 program/phase/lane/离场条件，status table 管每阶段状态和下一棒。

当前分支只写 docs/smoke，不实现业务代码，不读 secret，不调用真实云，不改 deploy，不 build/push/kubectl。

## Plain Status Summary

- official SDK provider strategy: done
- official SDK wrapper: done
- official SDK dependency loader: done
- cloud onboarding workflow boundary: done
- check-config/default gate: done; user-authorized official SDK readonly live: next/needs-user-authorization
- TC3 cleanup: pending official SDK live report
- create/release dry-run: pending
- mutation wrapper: pending
- production deploy: pending
- Portal production integration: pending
- canary/QA/release status: pending

## Status Table

| phase id | phase name | status | evidence commit / report | owner | next action | required smoke | user gate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CO-01 | official SDK provider strategy | done | existing trunk evidence before 148f5a0 | A | none | `smoke-test-v22-tencent-official-sdk-provider-strategy-contract.mjs` | none |
| CO-02 | official SDK wrapper | done | existing trunk evidence before 148f5a0 | A | none | `smoke-test-v22-tencent-readonly-inventory-official-sdk-wrapper.mjs` | none |
| CO-03 | official SDK dependency loader | done | existing trunk evidence before 148f5a0 | A | none | `smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs` | none |
| CO-04 | check-config | active | local gate pass on branch docs/v22-cloud-onboarding-co04-check-config-evidence: workflow status/next, readonly local guard, official SDK loader, agent workflow cloud onboarding, long-term governance surfaces, MVP suite; 未读 secret; 未读取 /home/dev/.secrets; 未 source env; 未传 --live-readonly; 未调用真实 Tencent API; 未加载真实 SDK live path; official SDK loader 默认 fail-closed; CO-06 仍需用户显式授权 | A | prepare local static gate for readonly live; evidence remains local/static only and does not advance CO-05/CO-06 | `smoke-test-v22-tencent-readonly-inventory-local-guard.mjs`; `smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs`; `smoke-test-v22-tencent-readonly-inventory-official-sdk-shape.mjs` | stop if real secret, real cloud, deploy, or dependency install is needed |
| CO-05 | default gate | done | B default gate pass after 83dfc45/ce58a94: 无 blocker; 默认路径不读 secret; 不调用真实云; 不加载真实 SDK live path; TC3 仍是 diagnostic/reference; 未新增 create/release/mutation 路径; 不自动 merge/push/build/push/kubectl | B | handoff to CO-06 user-authorized readonly live; no further default gate action | `smoke-test-v22-tencent-readonly-inventory-official-sdk-wrapper.mjs`; `smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs`; `smoke-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs` | stop before merge/push or any live path |
| CO-06 | user-authorized readonly live | needs-user-authorization | no live report yet | user | decide whether to authorize official SDK readonly secret allowlist and readonly API call | `smoke-test-v22-tencent-readonly-inventory-real-live-run.mjs`; `smoke-test-v22-tencent-readonly-inventory-live-bridge.mjs`; check-config output | must explicitly authorize secret allowlist, region/API scope, real cloud call, report location |
| CO-07 | readonly report review | pending | pending readonly report | B | review redacted report after CO-06 | `smoke-test-v22-tencent-readonly-inventory-boundary.mjs`; report redaction checks | stop if another real cloud read or report sharing is needed |
| CO-08 | TC3 cleanup gate | blocked | pending official SDK live report | B | wait for official SDK live report and B acceptance | `smoke-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs` | stop if cleanup would delete TC3 before report review |
| CO-09 | create/release dry-run plan | pending | pending | A | design no-mutation dry-run plan after readonly report review | `smoke-test-v22-tencent-dry-run-resource-plan-provider.mjs`; `smoke-test-v22-authorized-tencent-create-release-contract.mjs` | stop if dry-run wants real cloud, mutation secret, charge, or ledger mutation |
| CO-10 | mutation SDK wrapper | pending | pending | A | define fake-only mutation wrapper and gates | `smoke-test-v22-authorized-tencent-create-release-implementation-contract.mjs`; `smoke-test-v22-authorized-tencent-create-release-execution-contract.mjs` | stop if mutation secret, real API, dependency change, build/push/kubectl, or deploy is needed |
| CO-11 | minimal authorized create/release live | pending | pending | user | only after dry-run, wrapper, B review, and explicit user authorization | execution contract smoke; preflight dry-run diff; rollback/audit smoke | must explicitly authorize each real mutation, budget, tags, retry, rollback, and scope expansion |
| CO-12 | production deploy execution | pending | pending | user | wait for concrete deploy plan contract and explicit user authorization | deploy plan smoke; local build/deploy dry-run smoke; workflow gate review | must explicitly authorize build, push, kubectl, deploy secret/kubeconfig, registry, rollback |
| CO-13 | Portal production integration | pending | pending | A | connect Portal to sanitized production projection after deploy evidence | portal payload contract smoke; portal role surface smoke; mobile usability smoke | stop if Portal would expose secret/internal/cloud console language or alter billing truth |
| CO-14 | canary / QA / release status update | pending | pending | C | run QA/status update after Portal integration and authorized canary scope | canary/QA smoke; `smoke-test-v22-mvp-contract-suite.mjs`; workflow gate review | stop if QA needs live credentials, canary calls real service, or release status implies readiness |

## Open Issues

- workflow contract phase 12 required contracts still includes deploy plan contract. Track as should-fix before production deploy execution can advance.
- workflow contract phase 14 required contracts still includes role surface contracts and release/status docs. Track as should-fix before canary / QA / release status update can be release-ready.
- This branch records the open issue only; it does not modify `docs/contracts/v22-cloud-onboarding-workflow-boundary.md`.

## Status Data

<!-- v22-cloud-onboarding-status-table:start -->
```json
{
  "programId": "v22-cloud-onboarding",
  "currentTrunkAnchor": "148f5a0",
  "workflowBoundaryEvidence": "148f5a0",
  "phases": [
    {
      "phaseId": "CO-01",
      "phaseName": "official SDK provider strategy",
      "status": "done",
      "evidenceCommitOrReport": "existing trunk evidence before 148f5a0",
      "owner": "A",
      "nextAction": "none",
      "requiredSmoke": [
        "scripts/smoke-test-v22-tencent-official-sdk-provider-strategy-contract.mjs"
      ],
      "userGate": "none"
    },
    {
      "phaseId": "CO-02",
      "phaseName": "official SDK wrapper",
      "status": "done",
      "evidenceCommitOrReport": "existing trunk evidence before 148f5a0",
      "owner": "A",
      "nextAction": "none",
      "requiredSmoke": [
        "scripts/smoke-test-v22-tencent-readonly-inventory-official-sdk-wrapper.mjs"
      ],
      "userGate": "none"
    },
    {
      "phaseId": "CO-03",
      "phaseName": "official SDK dependency loader",
      "status": "done",
      "evidenceCommitOrReport": "existing trunk evidence before 148f5a0",
      "owner": "A",
      "nextAction": "none",
      "requiredSmoke": [
        "scripts/smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs"
      ],
      "userGate": "none"
    },
    {
      "phaseId": "CO-04",
      "phaseName": "check-config",
      "status": "active",
      "evidenceCommitOrReport": "local gate pass on branch docs/v22-cloud-onboarding-co04-check-config-evidence: workflow status/next, readonly local guard, official SDK loader, agent workflow cloud onboarding, long-term governance surfaces, MVP suite; 未读 secret; 未读取 /home/dev/.secrets; 未 source env; 未传 --live-readonly; 未调用真实 Tencent API; 未加载真实 SDK live path; official SDK loader 默认 fail-closed; CO-06 仍需用户显式授权",
      "owner": "A",
      "nextAction": "prepare local static gate for readonly live; evidence remains local/static only and does not advance CO-05/CO-06",
      "requiredSmoke": [
        "scripts/smoke-test-v22-tencent-readonly-inventory-local-guard.mjs",
        "scripts/smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs",
        "scripts/smoke-test-v22-tencent-readonly-inventory-official-sdk-shape.mjs"
      ],
      "userGate": "stop if real secret, real cloud, deploy, or dependency install is needed"
    },
    {
      "phaseId": "CO-05",
      "phaseName": "default gate",
      "status": "done",
      "evidenceCommitOrReport": "B default gate pass after 83dfc45/ce58a94: 无 blocker; 默认路径不读 secret; 不调用真实云; 不加载真实 SDK live path; TC3 仍是 diagnostic/reference; 未新增 create/release/mutation 路径; 不自动 merge/push/build/push/kubectl",
      "owner": "B",
      "nextAction": "handoff to CO-06 user-authorized readonly live; no further default gate action",
      "requiredSmoke": [
        "scripts/smoke-test-v22-tencent-readonly-inventory-official-sdk-wrapper.mjs",
        "scripts/smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs",
        "scripts/smoke-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs"
      ],
      "userGate": "stop before merge/push or any live path"
    },
    {
      "phaseId": "CO-06",
      "phaseName": "user-authorized readonly live",
      "status": "needs-user-authorization",
      "evidenceCommitOrReport": "no live report yet",
      "owner": "user",
      "nextAction": "decide whether to authorize official SDK readonly secret allowlist and readonly API call",
      "requiredSmoke": [
        "scripts/smoke-test-v22-tencent-readonly-inventory-real-live-run.mjs",
        "scripts/smoke-test-v22-tencent-readonly-inventory-live-bridge.mjs",
        "check-config output"
      ],
      "userGate": "must explicitly authorize secret allowlist, region/API scope, real cloud call, report location"
    },
    {
      "phaseId": "CO-07",
      "phaseName": "readonly report review",
      "status": "pending",
      "evidenceCommitOrReport": "pending readonly report",
      "owner": "B",
      "nextAction": "review redacted report after CO-06",
      "requiredSmoke": [
        "scripts/smoke-test-v22-tencent-readonly-inventory-boundary.mjs",
        "report redaction checks"
      ],
      "userGate": "stop if another real cloud read or report sharing is needed"
    },
    {
      "phaseId": "CO-08",
      "phaseName": "TC3 cleanup gate",
      "status": "blocked",
      "evidenceCommitOrReport": "pending official SDK live report",
      "owner": "B",
      "nextAction": "wait for official SDK live report and B acceptance",
      "requiredSmoke": [
        "scripts/smoke-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs"
      ],
      "userGate": "stop if cleanup would delete TC3 before report review"
    },
    {
      "phaseId": "CO-09",
      "phaseName": "create/release dry-run plan",
      "status": "pending",
      "evidenceCommitOrReport": "pending",
      "owner": "A",
      "nextAction": "design no-mutation dry-run plan after readonly report review",
      "requiredSmoke": [
        "scripts/smoke-test-v22-tencent-dry-run-resource-plan-provider.mjs",
        "scripts/smoke-test-v22-authorized-tencent-create-release-contract.mjs"
      ],
      "userGate": "stop if dry-run wants real cloud, mutation secret, charge, or ledger mutation"
    },
    {
      "phaseId": "CO-10",
      "phaseName": "mutation SDK wrapper",
      "status": "pending",
      "evidenceCommitOrReport": "pending",
      "owner": "A",
      "nextAction": "define fake-only mutation wrapper and gates",
      "requiredSmoke": [
        "scripts/smoke-test-v22-authorized-tencent-create-release-implementation-contract.mjs",
        "scripts/smoke-test-v22-authorized-tencent-create-release-execution-contract.mjs"
      ],
      "userGate": "stop if mutation secret, real API, dependency change, build/push/kubectl, or deploy is needed"
    },
    {
      "phaseId": "CO-11",
      "phaseName": "minimal authorized create/release live",
      "status": "pending",
      "evidenceCommitOrReport": "pending",
      "owner": "user",
      "nextAction": "only after dry-run, wrapper, B review, and explicit user authorization",
      "requiredSmoke": [
        "execution contract smoke",
        "preflight dry-run diff",
        "rollback/audit smoke"
      ],
      "userGate": "must explicitly authorize each real mutation, budget, tags, retry, rollback, and scope expansion"
    },
    {
      "phaseId": "CO-12",
      "phaseName": "production deploy execution",
      "status": "pending",
      "evidenceCommitOrReport": "pending",
      "owner": "user",
      "nextAction": "wait for concrete deploy plan contract and explicit user authorization",
      "requiredSmoke": [
        "deploy plan smoke",
        "local build/deploy dry-run smoke",
        "workflow gate review"
      ],
      "userGate": "must explicitly authorize build, push, kubectl, deploy secret/kubeconfig, registry, rollback"
    },
    {
      "phaseId": "CO-13",
      "phaseName": "Portal production integration",
      "status": "pending",
      "evidenceCommitOrReport": "pending",
      "owner": "A",
      "nextAction": "connect Portal to sanitized production projection after deploy evidence",
      "requiredSmoke": [
        "portal payload contract smoke",
        "portal role surface smoke",
        "mobile usability smoke"
      ],
      "userGate": "stop if Portal would expose secret/internal/cloud console language or alter billing truth"
    },
    {
      "phaseId": "CO-14",
      "phaseName": "canary / QA / release status update",
      "status": "pending",
      "evidenceCommitOrReport": "pending",
      "owner": "C",
      "nextAction": "run QA/status update after Portal integration and authorized canary scope",
      "requiredSmoke": [
        "canary/QA smoke",
        "scripts/smoke-test-v22-mvp-contract-suite.mjs",
        "workflow gate review"
      ],
      "userGate": "stop if QA needs live credentials, canary calls real service, or release status implies readiness"
    }
  ]
}
```
<!-- v22-cloud-onboarding-status-table:end -->
