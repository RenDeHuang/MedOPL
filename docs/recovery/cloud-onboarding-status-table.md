# v22 Cloud Onboarding Status Table

program id: v22-cloud-onboarding

本状态总表记录 v22 cloud onboarding 每阶段状态、证据、owner、下一棒、required smoke 和 user gate。AGENTS 管纪律，contracts 管边界，execution board 管当前 program/phase/lane/离场条件，status table 管每阶段状态和下一棒。

当前 cloud-lane 分支是 `cloud-lane/feat/v22-cloud-operation-harness-refactor`，model: gpt-5.4。它不是新增大合同，而是清退旧 cloud 合同/状态中的阶段性口径，把当前执行入口收敛到 `docs/recovery/v22-cloud-harness-manifest.json` 的 L1 -> L2a -> L2b -> L3 -> L4。Portal API 必须 async-first：只写 canonical operation/outbox 并返回 `202 + operationId`；真实 Package C 由独立 leased worker drain；恢复时 cleanup-first/reconcile-first。

历史 Package C/D canary 和 rollout evidence 仍作为 evidence 参考，但不能替代当前完成态。当前完成态必须证明：用户在 Portal 点击套餐后，平台真实开通 COS/TKE/配额/绑定，账本冻结/扣费/120min 对账，用户看到计算资源/文件空间/状态/账单，并且用户可以释放计算、删除文件空间。测试前 node pool baseline desired/current 必须是 `2`；测试后必须回到 `2`，不允许遗留节点或 queued/running operation。当前已记录 starter 最小生产闭环；这不是 pro/升级/加存储/全矩阵 live 完成态。

资源隔离口径：标准套餐使用共享用户计算池 + 硬 quota；用户购买计算资源套餐和工作台能力，不购买节点、节点池或云控制台资源。Package C 必须把 compute allocation 写入 Portal canonical store，并落到 workspace namespace 的 ResourceQuota / LimitRange / admission policy；超过 allocation 的 workload 必须 fail-closed，不得自动扩容并由平台垫付。高级隔离套餐可以使用 `dedicated_node_pool` 或 `dedicated_node`，但仍由平台开通、隔离、计费、审计和释放。

Package D / OPL Deployment Discovery 已作为独立 docs/status 分支记录：`docs/v22-package-d-opl-deploy-discovery`，model: gpt-5.4。该分支只写状态和 smoke：no secret read、no kubeconfig read、no kubectl、no build/push/deploy。它不代表 Package D rollout，不代表 deploy/build/push/kubectl 已完成。

Cloud-lane must be preserved as a long-lived branch family, but the current active branch is `cloud-lane/feat/v22-cloud-operation-harness-refactor`, model: `gpt-5.4`, base `9b68c44`. Older D1/D2/D3 Package D stack evidence remains historical deploy evidence only; it does not authorize Package C resource lifecycle and does not prove the Portal user click product loop.

Current goal leaf `leaf-cloud-lane-readonly-status-audit` is recorded by branch `feat/v22-cloud-lane-readonly-status-audit`, model `gpt-5.4`. This is a local doc/eval audit: it writes the Cloud lane readonly status, authorization boundary, blocker state, and next leaf handoff only. It does not read secret, call real cloud, rerun live evidence, modify services/deploy/adapters/.sentrux/upstream/package files, run build/push/kubectl/live-test, merge, or push. S5 `leaf-portal-ui-design-quality-audit` remains blocked until B ff-only absorbs this leaf.

## Harness L1-L4 Status

| level | status | evidence / blocker | owner | next action | required smoke | cleanup gate |
| --- | --- | --- | --- | --- | --- | --- |
| L1 | starter-live-done | production env/secret/schema gate passed for the live Portal deployment that ran the starter minimal loop | A/B | rebase verification and B review before absorption | `smoke-test-v22-cloud-harness-manifest-selector.mjs`; `smoke-test-v22-portal-runtime-startup-config.mjs` | not required |
| L2a | starter-live-done | direct Package C storage/compute create evidence supports the starter live loop; final node pool baseline is `2/2/0` | A/user | preserve evidence boundary; no new live mutation before B decision | `smoke-test-v22-tencent-authorized-resource-lifecycle-runner.mjs`; `smoke-test-v22-tencent-authorized-resource-lifecycle-live-gate.mjs`; `smoke-test-v22-cloud-live-cleanup-gate.mjs` | required |
| L2b | starter-live-done | Portal starter click queued operation; independent worker drained Package C; PostgreSQL/projection updated without HTTP 504 | A | re-run local smoke after rebase; do not rerun live unless separately authorized | `smoke-test-v22-portal-cloud-operation-async-worker-loop.mjs`; `smoke-test-v22-portal-production-cloud-operation-loop.mjs`; `smoke-test-v22-portal-package-click-cloud-resource-loop.mjs` | required |
| L3 | starter-cleanup-done-reconciling | release compute and delete storage succeeded; canonical activeOperations is `0`; billing label is `对账中` | A/B/user | keep exact 120min settlement as an audit checkpoint; do not claim fully settled billing | `smoke-test-v22-cloud-live-cleanup-gate.mjs`; `smoke-test-v22-release-stop-billing-audit-flow.mjs`; `smoke-test-v22-portal-files-billing-trace-flow.mjs` | required |
| L4 | starter-product-accepted | ordinary user starter projection is sanitized and shows compute released, file protection, workbench available, billing reconciling | C/B/user | pro/upgrade/add-storage/full matrix remains local smoke unless a new live run is authorized | `smoke-test-v22-portal-package-click-cloud-resource-loop.mjs`; `smoke-test-v22-mvp-contract-suite.mjs` | required |

## Plain Status Summary

- official SDK provider strategy: done
- official SDK wrapper: done
- official SDK dependency loader: done
- cloud onboarding workflow boundary: done
- check-config/default gate: done; user-authorized official SDK readonly live: next/needs-user-authorization
- TC3 cleanup: pending official SDK live report
- create/release dry-run: pending
- mutation wrapper: pending
- production deploy: schema migration, rollout, and runtime smoke passed for Package D; later Portal live deployment enabled the cloud-operation worker path for the starter minimal loop only
- Package D / OPL deployment discovery: owner guard blocker was real and has now been resolved for the authorized `default` platform-service targets by adding `targetClass/ownerRef/operationId` Kubernetes labels; the guard remains hard for future targets
- Package D image push gate: authorized real R-14/R-15 TCR preflight/build/push completed for `portal`, `opl-web-gateway`, and `opl-runtime-bridge`; digest report remains under `.runtime/v22-registry/`
- Package D deploy dry-run gate: authorized real R-16 server-side dry-run passed after owner guard labels were added; Portal schema migration was run through a separate gate; rollout and pushed-version runtime smoke passed
- Portal production integration: current branch changes the production API shape from inline execution to queued operation + independent worker; backend compute allocation records `nodePoolRef` for admin attribution; missing nodePoolRef fails closed and must mark the operation/job failed instead of leaving queued work behind
- starter minimal production loop: done with cleanup proof; pro/upgrade/add-storage/full matrix live acceptance: not claimed
- readonly status audit: current leaf is local_doc_eval only; starter minimal live evidence remains historical/tracked, full matrix live is not claimed, and S5 UI audit waits for B absorb
- canary/QA/release status: pending for full product matrix

## Status Table

| phase id | phase name | status | evidence commit / report | owner | next action | required smoke | user gate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CO-01 | official SDK provider strategy | done | existing trunk evidence before 148f5a0 | A | none | `smoke-test-v22-tencent-official-sdk-provider-strategy-contract.mjs` | none |
| CO-02 | official SDK wrapper | done | existing trunk evidence before 148f5a0 | A | none | `smoke-test-v22-tencent-readonly-inventory-official-sdk-wrapper.mjs` | none |
| CO-03 | official SDK dependency loader | done | existing trunk evidence before 148f5a0 | A | none | `smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs` | none |
| CO-04 | check-config | done | local gate pass on branch docs/v22-cloud-onboarding-co04-check-config-evidence: workflow status/next, readonly local guard, official SDK loader, agent workflow cloud onboarding, long-term governance surfaces, MVP suite; 未读 secret; 未读取真实 secret 目录; 未 source env; 未传 --live-readonly; 未调用真实 Tencent API; 未加载真实 SDK live path; official SDK loader 默认 fail-closed; CO-06 仍需用户显式授权 | A | none; CO-04 evidence remains local/static only and does not advance CO-06 without user authorization | `smoke-test-v22-tencent-readonly-inventory-local-guard.mjs`; `smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs`; `smoke-test-v22-tencent-readonly-inventory-official-sdk-shape.mjs` | stop if real secret, real cloud, deploy, or dependency install is needed |
| CO-05 | default gate | done | B default gate pass after 83dfc45/ce58a94: 无 blocker; 默认路径不读 secret; 不调用真实云; 不加载真实 SDK live path; TC3 仍是 diagnostic/reference; 未新增 create/release/mutation 路径; 不自动 merge/push/build/push/kubectl | B | handoff to CO-06 user-authorized readonly live; no further default gate action | `smoke-test-v22-tencent-readonly-inventory-official-sdk-wrapper.mjs`; `smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs`; `smoke-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs` | stop before merge/push or any live path |
| CO-06 | user-authorized readonly live | needs-user-authorization | no live report yet | user | decide whether to authorize official SDK readonly secret allowlist and readonly API call | `smoke-test-v22-tencent-readonly-inventory-real-live-run.mjs`; `smoke-test-v22-tencent-readonly-inventory-live-bridge.mjs`; check-config output | must explicitly authorize secret allowlist, region/API scope, real cloud call, report location |
| CO-07 | readonly report review | pending | pending readonly report | B | review redacted report after CO-06 | `smoke-test-v22-tencent-readonly-inventory-boundary.mjs`; report redaction checks | stop if another real cloud read or report sharing is needed |
| CO-08 | TC3 cleanup gate | blocked | pending official SDK live report | B | wait for official SDK live report and B acceptance | `smoke-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs` | stop if cleanup would delete TC3 before report review |
| CO-09 | create/release dry-run plan | pending | pending | A | design no-mutation dry-run plan after readonly report review | `smoke-test-v22-tencent-dry-run-resource-plan-provider.mjs`; `smoke-test-v22-authorized-tencent-create-release-contract.mjs` | stop if dry-run wants real cloud, mutation secret, charge, or ledger mutation |
| CO-10 | mutation SDK wrapper | pending | pending | A | define fake-only mutation wrapper and gates | `smoke-test-v22-authorized-tencent-create-release-implementation-contract.mjs`; `smoke-test-v22-authorized-tencent-create-release-execution-contract.mjs` | stop if mutation secret, real API, dependency change, build/push/kubectl, or deploy is needed |
| CO-11 | minimal authorized create/release live | pending | pending | user | only after dry-run, wrapper, B review, and explicit user authorization | execution contract smoke; preflight dry-run diff; rollback/audit smoke | must explicitly authorize each real mutation, budget, tags, retry, rollback, and scope expansion |
| CO-12 | production deploy execution | deploy-runtime-smoke-done | Package D authorized real path progressed: owner guard labels added to `default: portal-opl, opl-web-gateway-opl, portal-opl-adapter-opl`; real R-16 server-side dry-run passed at `.runtime/v22-cloud-deploy/package-d-real-20260511154104-deploy-dry-run.json`; Portal schema migration gate passed at `.runtime/v22-cloud-deploy/portal-schema-migrate-v22-20260511170138.json`; real R-17 rollout passed at `.runtime/v22-cloud-deploy/package-d-real-20260511154104-rollout.json`; real R-18 runtime smoke passed at `.runtime/v22-runtime-smoke/package-d-real-20260511154104-runtime-smoke.json` for Portal, OPL Gateway, and Runtime Bridge. Trace surface returned 200 but does not prove a repo-pushed Langfuse image. | B | review Package D evidence for absorption readiness; do not treat Package D as Package C storage/compute lifecycle or Portal cloud-operation bridge enablement | `smoke-test-v22-opl-deployment-ownership-release-plan-contract.mjs`; `smoke-test-v22-package-d-image-push-gate.mjs`; `smoke-test-v22-package-d-deploy-dry-run-gate.mjs`; `smoke-test-v22-tencent-authorized-deploy-execution-runner.mjs`; deploy plan smoke; server-side dry-run; rollout status; runtime smoke | must explicitly authorize deploy secret, docker build, docker push, kubectl, deploy secret/kubeconfig, registry, rollback, and any future Portal schema migration or env change; fail-closed if real target metadata lacks owner guard or if D2 digest report is missing |
| CO-13 | Portal production integration | superseded-by-L2b | historical Portal production bridge evidence remains useful, but current implementation changes the product path to queued operation + independent worker drain; do not claim production clicks are complete until L2b and L3 pass with cleanup proof. | A | use L2b/L3 harness gates instead of this CO phase as active execution entry | `smoke-test-v22-portal-cloud-operation-async-worker-loop.mjs`; `smoke-test-v22-portal-production-cloud-operation-loop.mjs`; `smoke-test-v22-portal-production-cloud-operation-resource-lifecycle-loop.mjs`; `smoke-test-v22-portal-cloud-operation-postgres-canonical-store.mjs`; `smoke-test-v22-mvp-contract-suite.mjs` | stop if Portal would expose secret/internal/cloud console language, if ordinary user projection exposes `nodePoolRef`/TKE/Kubernetes, if billing truth would be altered without reconciliation, or if live Portal bridge env/secret config changes without a deploy gate |
| CO-14 | canary / QA / release status update | pending | pending | C | run QA/status update after Portal integration and authorized canary scope | canary/QA smoke; `smoke-test-v22-mvp-contract-suite.mjs`; workflow gate review | stop if QA needs live credentials, canary calls real service, or release status implies readiness |

## Open Issues

- starter minimal live loop evidence is recorded, but pro 8c16g/100GB, upgrade/add-storage and full matrix live reruns are not claimed.
- exact 120min billing settlement remains an audit checkpoint; current starter evidence shows reconciliation status `对账中`.
- Package D rollout/build/push/kubectl readiness is outside the starter Package C lifecycle proof.
- Package D / OPL Deployment Discovery records reachable `kube.medopl.cn`, `portal.medopl.cn`, `opl.medopl.cn`, and `trace.medopl.cn` facts from the authorized discovery lane, but it did not read secret, did not read kubeconfig, did not run kubectl, and did not build/push/deploy.
- owner guard blocker resolved for the authorized `default` Package D platform-service targets by adding `targetClass/ownerRef/operationId` labels. The rule remains hard: Package D cannot use `k8s-app/qcloud-app`, deployment name, namespace, IP, creation time, or manual memory as ownership proof.
- Legacy Portal production cloud bridge blocker is superseded by L2b/L3: the active blocker is no longer only env presence, but whether Portal click queues operation, independent worker drains, PostgreSQL canonical store updates, billing/reconciliation records exist, and cleanup returns baseline to 2.
- Node pool cleanup blocker: the authorized TKE native node pool is not an idle test-only pool; it currently carries Portal/OPL/trace/billing/system workloads. It must not be deleted or scaled to 0 as cleanup. Releasing a user compute allocation must use Package C ownership and desired-capacity gates, not direct node pool deletion.
- contract issue resolved for config/fake-live gate: `docs/contracts/v22-opl-deployment-ownership-release-plan-boundary.md` defines `platform_service_target` and `workspace_runtime_target`; real target metadata and authorization are still required before build/push/kubectl.
- D2 issue resolved for config/fake-live gate: `build-push` now requires `acceptedPreflightId`; real TCR preflight/build/push still requires deploy secret and explicit user authorization.
- D3a issue resolved for config/fake-live gate: `deploy-dry-run` now requires `imageDigestsFile`; real kubectl server-side dry-run still requires deploy secret/kubeconfig and explicit user authorization.
- This branch modifies the workflow contract and status docs to retire old CO phase execution as the current entry while preserving historical evidence.

## Runnable Gate Mapping

| gate | runnable steps | required artifact roots | blocker writeback |
| --- | --- | --- | --- |
| CC-01 | R-00 local contract guard; R-01 SDK dependency install; R-02 SDK shape smoke | stdout JSON only; `services/portal/package.json`; `services/portal/package-lock.json` | CC-01 blocker; verification matrix |
| CC-02 | R-03 readonly preflight; R-04 readonly live report | stdout JSON only; `.runtime/v22-tencent-readonly-inventory/` | CC-02 blocker; execution board current blockers |
| CC-03 | R-05 Portal canonical operation smoke; R-10 Portal projection smoke | stdout JSON only | CC-03 blocker; Portal canonical store contract |
| CC-04 | R-06 storage dry-run; R-07 authorized storage execution; R-11 expand storage dry-run and execution; R-20 delete file space | `.runtime/v22-cloud-lifecycle/` | CC-04 blocker; cloud operation row |
| CC-05 | R-08 compute dry-run; R-09 authorized compute execution; R-12 expand compute dry-run and execution; R-19 release compute | `.runtime/v22-cloud-lifecycle/` | CC-05 blocker; cloud operation row |
| CC-06 | R-13 COS billing checkpoint; R-21 final reconciliation cleanup and B review | `.runtime/v22-cloud-reconciliation/`; `.runtime/v22-cloud-cleanup/` | billing reconciliation record; CC-06 blocker |
| CC-07 | R-14 TCR repository/tag preflight; R-15 multi-image build and push unique test tag; R-16 deploy dry-run; R-17 authorized deploy rollout; R-18 runtime smoke | `.runtime/v22-registry/`; `.runtime/v22-cloud-deploy/`; `.runtime/v22-runtime-smoke/` | program board blocker; CC-07 blocker |
| CC-REVIEW | R-21 final reconciliation cleanup and B review | `.runtime/v22-cloud-cleanup/`; stdout JSON and reviewed diff | B review note |

Package D 不授权 Package C 的资源生命周期动作。不得删除、关闭或扩缩容别人的节点和存储；禁止 `kubectl delete`；禁止 `DeleteNodePool`；禁止删除 bucket/prefix/object。Package D 只能改已确认属于本次 deploy operation 的指定 workload container image，不能碰 Package C 的 compute allocation、ResourceQuota / LimitRange / admission policy、node pool capacity 或 COS 文件空间。

## Status Data

<!-- v22-cloud-onboarding-status-table:start -->
```json
{
  "programId": "v22-cloud-onboarding",
  "currentTrunkAnchor": "9b68c44",
  "workflowModel": "cloud_harness_native_async_lifecycle_loop",
  "oldCoPhaseStateMachineRetired": true,
  "activeGatePrefix": "CC",
  "retiredLegacyGateAliases": [
    "C00",
    "C01",
    "C02",
    "C03",
    "C04",
    "CO-01..CO-14"
  ],
  "workflowBoundaryEvidence": "9b68c44",
  "harnessManifest": "docs/recovery/v22-cloud-harness-manifest.json",
  "liveBaselineDesiredCapacity": 2,
  "cleanupRequiredForLiveRuns": true,
  "harnessLevels": [
    {
      "level": "L1",
      "status": "starter-live-done",
      "owner": "A",
      "purpose": "production env/secret/schema gate without reading secret content",
      "requiredSmoke": [
        "scripts/smoke-test-v22-cloud-harness-manifest-selector.mjs",
        "scripts/smoke-test-v22-portal-runtime-startup-config.mjs"
      ],
      "cleanupRequired": false
    },
    {
      "level": "L2a",
      "status": "starter-live-done",
      "owner": "A/user",
      "purpose": "direct Package C resource lifecycle canary from baseline 2 back to baseline 2",
      "requiredSmoke": [
        "scripts/smoke-test-v22-tencent-authorized-resource-lifecycle-runner.mjs",
        "scripts/smoke-test-v22-tencent-authorized-resource-lifecycle-live-gate.mjs",
        "scripts/smoke-test-v22-cloud-live-cleanup-gate.mjs"
      ],
      "cleanupRequired": true
    },
    {
      "level": "L2b",
      "status": "starter-live-done",
      "owner": "A",
      "purpose": "Portal click queues operation, independent worker drains, projection updates without HTTP 504",
      "requiredSmoke": [
        "scripts/smoke-test-v22-portal-cloud-operation-async-worker-loop.mjs",
        "scripts/smoke-test-v22-portal-production-cloud-operation-loop.mjs",
        "scripts/smoke-test-v22-portal-package-click-cloud-resource-loop.mjs",
        "scripts/smoke-test-v22-cloud-live-cleanup-gate.mjs"
      ],
      "cleanupRequired": true
    },
    {
      "level": "L3",
      "status": "starter-cleanup-done-reconciling",
      "owner": "A/B/user",
      "purpose": "120min billing reconciliation, release stop billing, and cleanup proof",
      "requiredSmoke": [
        "scripts/smoke-test-v22-cloud-live-cleanup-gate.mjs",
        "scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs",
        "scripts/smoke-test-v22-portal-files-billing-trace-flow.mjs"
      ],
      "cleanupRequired": true
    },
    {
      "level": "L4",
      "status": "starter-product-accepted",
      "owner": "C/B/user",
      "purpose": "ordinary user open/upload/upgrade/release/delete product lifecycle with sanitized language",
      "requiredSmoke": [
        "scripts/smoke-test-v22-portal-package-click-cloud-resource-loop.mjs",
        "scripts/smoke-test-v22-portal-frontend-surface-eval.mjs",
        "scripts/smoke-test-v22-mvp-contract-suite.mjs"
      ],
      "cleanupRequired": true
    }
  ],
  "cloudLane": {
    "branch": "cloud-lane/feat/v22-cloud-operation-harness-refactor",
    "model": "gpt-5.4",
    "baseCommit": "9b68c44",
    "longLived": true,
    "stack": [
      "cloud-lane/feat/v22-cloud-operation-harness-refactor"
    ],
    "absorbD1Early": false,
    "currentScope": [
      "old cloud contract/status retirement",
      "L1-L4 harness manifest",
      "diff selector",
      "cleanup gate",
      "Portal queued API",
      "independent worker drain",
      "nodePoolRef attribution hard gate"
    ],
    "readonlyStatusAudit": {
      "leafId": "leaf-cloud-lane-readonly-status-audit",
      "branch": "feat/v22-cloud-lane-readonly-status-audit",
      "model": "gpt-5.4",
      "riskClass": "local_doc_eval",
      "scope": "repo_tracked_local_doc_eval_only",
      "currentLeafStatus": "ready_for_B_absorb_after_current_verify",
      "cloudStatus": "starter_minimal_live_recorded_full_matrix_not_claimed",
      "nextAllowedLeafAfterBAbsorb": "leaf-portal-ui-design-quality-audit",
      "s5UiAuditBlockedUntilBAbsorb": true,
      "readsSecret": false,
      "callsRealCloud": false,
      "modifiesServices": false,
      "modifiesDeploy": false,
      "runsBuildPushKubectl": false
    },
    "productionStarterMinimalLiveAcceptanceClaimed": true,
    "productionFullMatrixLiveAcceptanceClaimed": false,
    "starterLiveEvidence": {
      "runId": "live-l2b-8c8cff2-20260513T031510Z",
      "portalImageTag": "cloud-harness-20260513T043146Z-becd258",
      "portalImageDigest": "sha256:7073a9b063b3b2ff789d5cc26adea7d231cfca16083083fbfe91479e0c2f2d9f",
      "deployment": "default/portal-opl",
      "operationStatuses": [
        "create_storage:succeeded",
        "create_compute:succeeded",
        "release_compute:succeeded",
        "delete_storage:succeeded"
      ],
      "activeOperations": 0,
      "computeStatus": "released",
      "storageStatus": "retention_protected",
      "billingStatusLabel": "对账中",
      "userProjectionProviderLanguageForbidden": false,
      "nodePoolFinal": {
        "desired": 2,
        "current": 2,
        "joining": 0
      },
      "evidenceRoot": ".runtime/v22-live-portal-loop/live-l2b-8c8cff2-20260513T031510Z/",
      "cleanupSnapshot": ".runtime/v22-cloud-cleanup/final-becd258-20260513T043410Z-node-pool-snapshot.json"
    }
  },
  "packageDDiscovery": {
    "branch": "docs/v22-package-d-opl-deploy-discovery",
    "model": "gpt-5.4",
    "status": "blocked_by_owner_guard_and_release_plan_contract",
    "ownershipReleasePlanContract": "docs/contracts/v22-opl-deployment-ownership-release-plan-boundary.md",
    "ownershipReleasePlanContractReady": true,
    "realRolloutStillBlocked": false,
    "readsSecretNow": false,
    "readsKubeconfigNow": false,
    "runsKubectlNow": false,
    "runsBuildPushDeployNow": false,
    "rolloutDone": true,
    "requiresOwnershipReleasePlanSubContract": true,
    "blocker": "candidate deployments only have k8s-app/qcloud-app style labels for this purpose and lack ownerRef/workspaceId/resourceBindingId/operationId",
    "candidateDeployments": {
      "default": [
        "portal-opl",
        "opl-web-gateway-opl",
        "portal-opl-adapter-opl"
      ],
      "portal-v21-gray": [
        "portal",
        "opl-web-gateway",
        "portal-opl-adapter"
      ]
    },
    "contractProblem": "Portal/Gateway/Adapter/trace may be platform service targets; workspace runtime targets still require workspaceId/resourceBindingId.",
    "targetClasses": [
      "platform_service_target",
      "workspace_runtime_target"
    ]
  },
  "runnableGateMapping": [
    {
      "gateId": "CC-01",
      "steps": ["R-00", "R-01", "R-02"],
      "artifactRoots": ["stdout JSON only", "services/portal/package.json", "services/portal/package-lock.json"]
    },
    {
      "gateId": "CC-02",
      "steps": ["R-03", "R-04"],
      "artifactRoots": ["stdout JSON only", ".runtime/v22-tencent-readonly-inventory/"]
    },
    {
      "gateId": "CC-03",
      "steps": ["R-05", "R-10"],
      "artifactRoots": ["stdout JSON only"]
    },
    {
      "gateId": "CC-04",
      "steps": ["R-06", "R-07", "R-11", "R-20"],
      "artifactRoots": [".runtime/v22-cloud-lifecycle/"]
    },
    {
      "gateId": "CC-05",
      "steps": ["R-08", "R-09", "R-12", "R-19"],
      "artifactRoots": [".runtime/v22-cloud-lifecycle/"]
    },
    {
      "gateId": "CC-06",
      "steps": ["R-13", "R-21"],
      "artifactRoots": [".runtime/v22-cloud-reconciliation/", ".runtime/v22-cloud-cleanup/"]
    },
    {
      "gateId": "CC-07",
      "steps": ["R-14", "R-15", "R-16", "R-17", "R-18"],
      "artifactRoots": [".runtime/v22-registry/", ".runtime/v22-cloud-deploy/", ".runtime/v22-runtime-smoke/"]
    },
    {
      "gateId": "CC-REVIEW",
      "steps": ["R-21"],
      "artifactRoots": [".runtime/v22-cloud-cleanup/", "stdout JSON and reviewed diff"]
    }
  ],
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
      "status": "done",
      "evidenceCommitOrReport": "local gate pass on branch docs/v22-cloud-onboarding-co04-check-config-evidence: workflow status/next, readonly local guard, official SDK loader, agent workflow cloud onboarding, long-term governance surfaces, MVP suite; 未读 secret; 未读取真实 secret 目录; 未 source env; 未传 --live-readonly; 未调用真实 Tencent API; 未加载真实 SDK live path; official SDK loader 默认 fail-closed; CO-06 仍需用户显式授权",
      "owner": "A",
      "nextAction": "none; CO-04 evidence remains local/static only and does not advance CO-06 without user authorization",
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
      "status": "deploy-runtime-smoke-done",
      "evidenceCommitOrReport": "Package D authorized real path progressed: owner guard labels added to default: portal-opl, opl-web-gateway-opl, portal-opl-adapter-opl; real R-16 server-side dry-run passed at .runtime/v22-cloud-deploy/package-d-real-20260511154104-deploy-dry-run.json; Portal schema migration gate passed at .runtime/v22-cloud-deploy/portal-schema-migrate-v22-20260511170138.json; real R-17 rollout passed at .runtime/v22-cloud-deploy/package-d-real-20260511154104-rollout.json; real R-18 runtime smoke passed at .runtime/v22-runtime-smoke/package-d-real-20260511154104-runtime-smoke.json for Portal, OPL Gateway, and Runtime Bridge. Trace surface returned 200 but does not prove a repo-pushed Langfuse image.",
      "owner": "B",
      "nextAction": "review Package D evidence for absorption readiness; do not treat Package D as Package C storage/compute lifecycle or Portal cloud-operation bridge enablement",
      "requiredSmoke": [
        "scripts/smoke-test-v22-opl-deployment-ownership-release-plan-contract.mjs",
        "scripts/smoke-test-v22-package-d-image-push-gate.mjs",
        "scripts/smoke-test-v22-package-d-deploy-dry-run-gate.mjs",
        "scripts/smoke-test-v22-tencent-authorized-deploy-execution-runner.mjs",
        "deploy plan smoke",
        "server-side dry-run",
        "rollout status",
        "runtime smoke"
      ],
      "userGate": "must explicitly authorize deploy secret, docker build, docker push, kubectl, deploy secret/kubeconfig, registry, rollback, and any future Portal schema migration or env change; fail-closed if real target metadata lacks owner guard or if D2 digest report is missing"
    },
    {
      "phaseId": "CO-13",
      "phaseName": "Portal production integration",
      "status": "superseded-by-L2b",
      "evidenceCommitOrReport": "historical Portal production bridge evidence remains useful, but current implementation changes the product path to queued operation + independent worker drain; do not claim production clicks are complete until L2b and L3 pass with cleanup proof.",
      "owner": "A",
      "nextAction": "use L2b/L3 harness gates instead of this CO phase as active execution entry",
      "requiredSmoke": [
        "scripts/smoke-test-v22-portal-cloud-operation-async-worker-loop.mjs",
        "scripts/smoke-test-v22-portal-production-cloud-operation-loop.mjs",
        "scripts/smoke-test-v22-portal-production-cloud-operation-resource-lifecycle-loop.mjs",
        "scripts/smoke-test-v22-portal-cloud-operation-postgres-canonical-store.mjs",
        "scripts/smoke-test-v22-mvp-contract-suite.mjs"
      ],
      "userGate": "stop if Portal would expose secret/internal/cloud console language, if ordinary user projection exposes nodePoolRef/TKE/Kubernetes, if billing truth would be altered without reconciliation, or if live Portal bridge env/secret config changes without a deploy gate"
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
