# v22 Cloud Onboarding Central Execution Board

program id: v22-cloud-onboarding

current trunk anchor: 9b68c44

current phase: 合同清退与本地 smoke 对齐阶段（不接云）；legacy CO phases are historical aliases only

本文件是 v22 cloud onboarding 的中央执行板。AGENTS 管纪律，contracts 管边界，execution board 管当前 program/phase/lane/离场条件，status table 管每阶段状态和下一棒。

当前 recovery 口径：先清合同-smoke-实现漂移，不接云。历史 cloud live/deploy 记录降级为 historical evidence，不等于当前阶段授权。

本执行板不替代 `docs/contracts/v22-cloud-onboarding-workflow-boundary.md`。workflow contract 定义完整状态机；本文件只记录当前 program 位置、lane 编排、离场条件、blocker 回流和需要用户确认的 gate。当前 cloud-lane 分支清退旧 CO/bridge-blocker 口径，落地 harness manifest、selector/check smoke 和 Portal async worker 控制面。生产真实验收必须按 L1 -> L2a -> L2b -> L3 -> L4 串联执行，不能把 direct canary、deploy runtime smoke 或本地 fake-live 当作完整产品闭环。

2026-05 framework mapping：Portal API 采用 async request-reply，只写 operation/outbox 并返回 `202 + operationId`；真实 COS/TKE mutation 由独立 leased worker drain；reconciliation 使用 controller desired/current 模型，恢复时 cleanup-first/reconcile-first；harness engineering 要求合同、manifest、selector、smoke、evidence 和 handoff 全部 repo-tracked。

资源共享裁定：标准套餐走共享用户计算池 + 硬 quota，不是一用户一个节点池。共享池内每个 workspace 由 compute allocation、ResourceQuota / LimitRange / admission policy、resourceBinding 和审计标签隔离；超过 allocation 的 workload 必须 fail-closed。高级隔离套餐才允许 `dedicated_node_pool` 或 `dedicated_node`。Package D 不授权 Package C 的资源生命周期动作，不能修改 compute allocation、quota、node pool capacity 或 COS 文件空间。

Package D / OPL Deployment Discovery 记录在 `docs/v22-package-d-opl-deploy-discovery` 分支，model: gpt-5.4。该 discovery 只回写已知事实和 owner guard blocker：no secret read、no kubeconfig read、no kubectl、no build/push/deploy。它不是 Package D rollout，does not prove build/push/kubectl/deploy completion，不代表 deploy/build/push/kubectl 已完成。

Cloud-lane is intentionally long-lived. The active implementation branch is `cloud-lane/feat/v22-cloud-operation-harness-refactor`, model: `gpt-5.4`. It records the production cloud operation harness refactor:旧合同清退、L1-L4 manifest、diff selector、cleanup gate、Portal queued API、independent worker drain、nodePoolRef attribution hard gate。B should not absorb this branch until it is rebased on the current trunk anchor, local harness gates are green, and starter minimal live evidence has cleanup proof.

Current goal leaf `leaf-cloud-lane-readonly-status-audit` is a repo-tracked local doc/eval audit only. It records that starter minimal live evidence exists, full matrix live acceptance is not claimed, S5 UI audit stays blocked until B absorbs this leaf, and no secret, true cloud, services implementation, deploy, build/push/kubectl, live-test, adapters, `.sentrux`, upstream, package/dependency, or merge/push operation is authorized by this branch.

关联状态表：`docs/recovery/cloud-onboarding-status-table.md`。

## Program Snapshot

- program id: v22-cloud-onboarding
- current trunk anchor: 9b68c44
- current phase: 合同清退与本地 smoke 对齐阶段（不接云）；legacy CO phases are historical aliases only
- current lane: starter minimal live evidence reconciliation + rebase verification
- next lane: B review / ff-only absorption decision; future pro, upgrade, add-storage and full matrix live reruns require separate authorization
- current goal leaf: `leaf-cloud-lane-readonly-status-audit`
- current goal leaf risk: `local_doc_eval`
- current goal leaf branch: `feat/v22-cloud-lane-readonly-status-audit`, model: `gpt-5.4`
- current goal leaf status: ready for B absorption after `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk` is green
- next allowed leaf after B absorb: `leaf-portal-ui-design-quality-audit`; do not start S5 UI audit before B ff-only absorb
- cloud-lane branch: `cloud-lane/feat/v22-cloud-operation-harness-refactor`
- cloud-lane model: `gpt-5.4`
- cloud-lane stack base: `origin/recovery/platform-v22-trunk` at `9b68c44`
- cloud-lane status: rebased; starter minimal Portal live loop evidence recorded with cleanup proof; production full-matrix acceptance is not claimed
- workflow contract: `docs/contracts/v22-cloud-onboarding-workflow-boundary.md`
- harness manifest: `docs/recovery/v22-cloud-harness-manifest.json`
- status table: `docs/recovery/cloud-onboarding-status-table.md`
- execution board owner: B for board truth, A for implementation task packages, user for live authorization

## Active Harness Levels

| level | status | owner | next action |
| --- | --- | --- | --- |
| L1 | starter-live-done | A/B | production env/secret/schema reference gate passed for the live Portal deployment; rebase verification required before absorption |
| L2a | starter-live-done | A/user | direct Package C storage/compute lifecycle evidence supports the starter loop and cleanup baseline `2` |
| L2b | starter-live-done | A | Portal starter click queued operation; independent worker drained Package C; PostgreSQL/projection updated without 504 |
| L3 | starter-cleanup-done-reconciling | A/user/B | release compute and delete storage operations succeeded; billing projection is `对账中`; exact 120min settlement remains an audit checkpoint |
| L4 | starter-product-accepted | C/B/user | ordinary user starter projection shows sanitized product state; pro/upgrade/full matrix is local smoke only |

Live cost control gate:

- node pool desired/current baseline must be `2` before mutation.
- post-cleanup desired/current must return to `2`.
- every live run must include `baselineSnapshot`, `cleanupPlan`, `cleanupOperationId`, and `postCleanupSnapshot`.
- no queued/running operation may remain after cleanup.
- Package C may release only owned compute allocations; Package D must not scale or delete node pools.

## 14 阶段 Workflow 摘要

| phase | phase name | owner | lane role |
| --- | --- | --- | --- |
| CO-01 | official SDK provider strategy | A | production default provider strategy 已收敛到 official SDK wrapper，TC3 降为 diagnostic/reference |
| CO-02 | official SDK wrapper | A | wrapper shell 已完成，业务层不直接暴露 raw SDK client |
| CO-03 | official SDK dependency loader | A | dependency loader 已完成，默认 fail-closed，不默认加载真实 SDK package |
| CO-04 | check-config | A | done，本地静态 gate 已证明 readonly live 前置检查 fail-closed |
| CO-05 | default gate | B | done，默认路径不读 secret、不打云、不恢复 TC3 production default |
| CO-06 | user-authorized readonly live | user | 当前 active lane，等待用户显式授权后才可读 allowlist secret 和调用 official SDK 只读真实云 |
| CO-07 | readonly report review | B | 审查脱敏 readonly report，决定是否进入 cleanup/dry-run 后续 |
| CO-08 | TC3 cleanup gate | B | pending official SDK live report，未有 report 前不得执行 cleanup |
| CO-09 | create/release dry-run plan | A | 后续 dry-run 计划，不创建资源、不收费 |
| CO-10 | mutation SDK wrapper | A | 后续 mutation wrapper shell，fake-only by default |
| CO-11 | minimal authorized create/release live | user | 真实 create/release，必须用户逐次授权 |
| CO-12 | production deploy execution | user | 真实 deploy/build/push/kubectl，必须用户逐次授权 |
| CO-13 | Portal production integration | A | Portal 消费 sanitized production projection，不展示云控制台语义 |
| CO-14 | canary / QA / release status update | C | QA/canary/status 更新，真实 canary 仍需单独授权 |

## Lane Rules

current lane:

- readonly-live authorization wait。
- CO-04 check-config 和 CO-05 default gate 已完成；当前不能继续自动推进，只能等待用户显式授权 CO-06。
- 不读取真实 secret，不 source `.env`，不调用真实腾讯云 API，不读取 COS 对象正文。

next lane:

- readonly-report-review。
- 只有 CO-06 用户授权 readonly live 生成脱敏 report 后，B 才能进入 readonly-report-review。
- CO-06 执行前必须明确 secret allowlist、readonly API allowlist、region/VPC scope、report 输出位置和 redaction policy。

serial real side effects:

- 真实云 live。
- create/release。
- deploy/build/push/kubectl。
- 依赖安装。
- merge/push。

这些真实外部副作用必须串行，不能并发，也不能由 execution board 自动触发。进入任何一项前必须停下来问用户。

parallel lane rules:

- docs/contracts。
- smoke。
- fake wrapper。
- cleanup plan。
- topology/deploy contract。

这些并发 lane 必须独立 worktree，不读 secret，不调用真实云，不改 deploy，不 build/push/kubectl，不 merge/push。

## Exit Criteria

exit criteria:

- CO-04 离场：check-config 可证明缺少 RUN gate、mutation API、read-all secret、未脱敏输出会被阻断。
- CO-05 离场：B 确认默认路径不读 secret、不加载真实 SDK、不调用真实云、不执行 mutation、不恢复 TC3 production default。
- CO-06 离场：用户显式授权后才可生成脱敏 readonly inventory report，report 存放在 git 外。
- CO-07 离场：B 对脱敏 report 给出 accept 或 blocker list。
- CO-09 离场：official SDK live report 已完成且 B 确认 TC3 可进入 cleanup。
- CO-10 之后：每阶段必须以对应合同和 smoke 证明不越权，再交给下一 owner。

## Blocker Routing

blocker routing:

- 合同或 smoke 缺口回流 A。
- 默认 gate、安全边界、secret hygiene、真实副作用风险回流 B。
- 真实云账号、region、权限、预算、secret allowlist、live 授权回流 user。
- QA/canary 复现和 release status 异常回流 C。
- deploy/build/push/kubectl 只能在用户明确授权后串行处理。

## User Confirmation Gates

user confirmation gates:

- before reading any real secret or kubeconfig.
- before any real Tencent Cloud API call.
- before user-authorized official SDK readonly live.
- before minimal authorized create/release live.
- before production deploy execution.
- before build, push, kubectl, dependency install, merge, or push.
- before sharing redacted report contents outside the local review context.
- before expanding blast radius, retrying real mutation, or running rollback with side effect.

## Open Issues

- open issue: workflow contract phase 12 required contracts still includes deploy plan contract. It must be replaced by a concrete repo-tracked contract path before production deploy execution can leave planning.
- open issue: workflow contract phase 14 required contracts still includes role surface contracts and release/status docs. It must be replaced by concrete repo-tracked contract/status files before canary / QA / release status update can be treated as release-ready.
- open issue: Package D owner guard is resolved for the authorized `default` platform-service targets; Portal schema migration, rollout, and pushed-version runtime smoke passed. The old production bridge env/secret blocker is cleared for the starter minimal loop by the later Portal live deployment, but this does not prove pro 8c16g/100GB, upgrade/add-storage, dedicated node pool, or full Package D rollout acceptance.
- open issue: the authorized native TKE node pool currently carries Portal/OPL/trace/billing/system workloads. It must not be deleted or scaled to 0 as cleanup; user compute release must go through Package C desired-capacity and ownership gates.
- 本分支只登记 open issue，不修改 workflow 合同。

## Runnable Path Snapshot

| step | gate | owner package | status in this branch |
| --- | --- | --- | --- |
| R-00 local contract guard | CC-01 | none | defined and smoke-covered |
| R-01 SDK dependency install | CC-01 | dependency_install | path defined; execution remains separate |
| R-02 SDK shape smoke | CC-01 | dependency_install | path defined; execution remains separate |
| R-03 readonly preflight | CC-02 | readonly_connection | path defined; execution remains separate |
| R-04 readonly live report | CC-02 | readonly_connection | path defined; needs explicit authorization |
| R-05 Portal canonical operation smoke | CC-03 | local_contract_smoke | test-only fake-live bridge and production storage-create fake-live loop covered; production route uses inline operation job and PostgreSQL canonical store shape |
| R-06 storage dry-run | CC-04 | authorized_resource_lifecycle | passed for minimal storage-create canary; report under `.runtime/v22-cloud-lifecycle/` |
| R-07 authorized storage execution | CC-04 | authorized_resource_lifecycle | passed for minimal storage-create canary via Portal production API and direct Package C runner; report under `.runtime/v22-cloud-lifecycle/` |
| R-08 compute dry-run | CC-05 | authorized_resource_lifecycle | path defined; runner in later Package C branch |
| R-09 authorized compute execution | CC-05 | authorized_resource_lifecycle | path defined; runner in later Package C branch |
| R-10 Portal projection smoke | CC-03 | local_contract_smoke | test-only projection, production sanitized projection, and real storage-create live projection covered for the storage-create sub-loop |
| R-11 expand storage dry-run and execution | CC-04 | authorized_resource_lifecycle | path defined; runner in later Package C branch |
| R-12 expand compute dry-run and execution | CC-05 | authorized_resource_lifecycle | path defined; runner in later Package C branch |
| R-13 COS billing checkpoint | CC-06 | readonly_connection | path defined; execution remains separate |
| R-14 TCR repository/tag preflight | CC-07 | deploy_and_production_integration | path defined; OPL deployment ownership / release plan contract defines target classes; real preflight still requires reviewed plan and authorization |
| R-15 multi-image build and push unique test tag | CC-07 | deploy_and_production_integration | D2 cloud-lane runner gate requires accepted R-14 preflight id before build-push; real push blocked until deploy secret/build/push authorization |
| R-16 deploy dry-run | CC-07 | deploy_and_production_integration | authorized real server-side dry-run passed after owner guard labels were applied |
| R-17 authorized deploy rollout | CC-07 | deploy_and_production_integration | passed after Portal schema migration gate; report under `.runtime/v22-cloud-deploy/package-d-real-20260511154104-rollout.json` |
| R-18 runtime smoke | CC-07 | deploy_and_production_integration | pushed Portal, OPL Gateway, and Runtime Bridge version smoke passed; trace surface is reachable but does not prove a repo-pushed Langfuse image |
| R-19 release compute | CC-05 | authorized_resource_lifecycle | path defined; runner in later Package C branch |
| R-20 delete file space | CC-04 | authorized_resource_lifecycle | path defined; runner in later Package C branch |
| R-21 final reconciliation cleanup and B review | CC-REVIEW | manual_b_review | path defined; B absorption gate |

Starter minimal production evidence after the async worker refactor:

- online Portal accepted the `starter_2c4g_10gb` package click as queued work instead of draining Package C synchronously.
- independent worker drained the queued operation and executed real Package C storage create and compute create.
- cleanup executed `release_compute` and `delete_storage`; PostgreSQL canonical store reports `activeOperations: 0`.
- final canonical resource statuses: compute `released`, storage `retention_protected`, billing `对账中`.
- ordinary user projection shows 工作台资源、计算资源、文件空间、套餐、余额、冻结金额 and does not expose CVM/COS/TKE/node pool/bucket/kubeconfig/SecretId.
- final node pool snapshot returned to desired/current/joining `2/2/0`.
- evidence remains outside git under `.runtime/v22-live-portal-loop/live-l2b-8c8cff2-20260513T031510Z/` and `.runtime/v22-cloud-cleanup/final-becd258-20260513T043410Z-node-pool-snapshot.json`.
- boundary: this proves only the starter minimal live loop. It does not prove pro live full matrix, compute/storage upgrade live full matrix, dedicated node pool, exact 120min settlement completion, Package D rollout, or build/push/kubectl readiness.

Package D 不授权 Package C 的资源生命周期动作。不得删除、关闭或扩缩容别人的节点和存储；禁止 `kubectl delete`；禁止 `DeleteNodePool`；禁止删除 bucket/prefix/object。Package D 只能改已确认属于本次 deploy operation 的指定 workload container image，不能碰 Package C 的 compute allocation、ResourceQuota / LimitRange / admission policy、node pool capacity 或 COS 文件空间。

## Package D / OPL Deployment Discovery

Discovery branch: `docs/v22-package-d-opl-deploy-discovery`; model: gpt-5.4.

Scope:

- no secret read.
- no kubeconfig read.
- no kubectl.
- no build/push/deploy.
- no real cloud call.
- no deploy, `.sentrux`, `adapters`, or upstream mutation.

Observed facts supplied by the authorized discovery lane:

- kube API endpoint shape is reachable through `kube.medopl.cn`.
- runtime smoke surfaces are reachable at `portal.medopl.cn`, `opl.medopl.cn`, and `trace.medopl.cn`.
- candidate deployments discovered by prior read-only inspection: `default: portal-opl, opl-web-gateway-opl, opl-runtime-bridge-opl`.
- candidate deployments discovered by prior read-only inspection: `portal-v21-gray: portal, opl-web-gateway, opl-runtime-bridge`.
- candidate deployments have only `k8s-app/qcloud-app` style labels for this purpose; they do not provide Package D owner guard labels.

Blocker:

- owner guard blocker: candidate deployments lack `ownerRef`, `workspaceId`, `resourceBindingId`, and `operationId`.
- Package D must fail-closed when ownership labels or Portal truth do not match.
- cannot infer ownership by deployment name, namespace, IP, creation time, qcloud-app label, or manual memory.
- 不能靠 deployment 名字、namespace、IP、创建时间、qcloud-app 或人工记忆判断归属。

Contract problem to solve next:

- Portal/Gateway/Runtime Bridge/trace may be platform service targets, so they may need a platform-level ownerRef and operation audit identity rather than forced workspace ownership.
- workspace runtime targets still require workspaceId/resourceBindingId because they represent tenant-scoped runtime capacity.
- The next branch must define an OPL deployment ownership / release plan sub-contract with explicit target class values: platform service target and workspace runtime target.
- That sub-contract must decide which labels or Portal canonical records prove each target class without weakening the current Package D owner guard.

Contract update:

- `docs/contracts/v22-opl-deployment-ownership-release-plan-boundary.md` is the repo-tracked OPL deployment ownership / release plan sub-contract.
- `platform_service_target` covers Portal/Gateway/Runtime Bridge/shared Runtime Bridge target classes and requires `ownerRef/operationId`.
- `workspace_runtime_target` covers workspace Runtime Agent/runtime workload target classes and requires `ownerRef/operationId/workspaceId/resourceBindingId`.
- This contract only enables config/fake-live ownership validation; real TCR push, kubectl dry-run, rollout, runtime smoke and rollback evidence remain separate Package D steps requiring explicit authorization.

Discovery status:

- not Package D rollout.
- does not prove build/push/kubectl/deploy completion.
- 不代表 deploy/build/push/kubectl 已完成。
- R-14 through R-18 have historical authorized real evidence for the prior deploy lane; they are not the current completion gate.
- Current completion gate is L1 -> L2a -> L2b -> L3 -> L4 with cleanup proof and baseline `2`.

## Board Data

<!-- v22-cloud-onboarding-execution-board:start -->
```json
{
  "programId": "v22-cloud-onboarding",
  "currentTrunkAnchor": "9b68c44",
  "currentPhase": "starter minimal production cloud loop recorded; B rebase review pending; legacy CO phases are historical aliases only",
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
  "currentLane": "starter minimal live evidence reconciliation + rebase verification",
  "nextLane": "B review / ff-only absorption decision; future pro, upgrade, add-storage and full matrix live reruns require separate authorization",
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
  "cloudLane": {
    "branch": "cloud-lane/feat/v22-cloud-operation-harness-refactor",
    "model": "gpt-5.4",
    "baseCommit": "9b68c44",
    "stack": [
      "cloud-lane/feat/v22-cloud-operation-harness-refactor"
    ],
    "longLived": true,
    "absorbD1Early": false,
    "scope": [
      "old cloud contract cleanup",
      "L1-L4 harness manifest",
      "diff selector/check smoke",
      "Portal queued API",
      "independent worker drain",
      "nodePoolRef attribution hard gate",
      "cleanup-first/reconcile-first gate"
    ],
    "requiresHarnessManifestBeforeLive": true,
    "requiresCleanupProofBeforeAbsorption": true
  },
  "workflowContract": "docs/contracts/v22-cloud-onboarding-workflow-boundary.md",
  "statusTable": "docs/recovery/cloud-onboarding-status-table.md",
  "readsSecretNow": false,
  "callsRealCloudNow": false,
  "authorizedStorageCreateCanaryDone": true,
  "starterMinimalLiveLoopDone": true,
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
  },
  "harnessManifest": "docs/recovery/v22-cloud-harness-manifest.json",
  "liveBaselineDesiredCapacity": 2,
  "cleanupRequiredForLiveRuns": true,
  "activeHarnessLevels": [
    {
      "level": "L1",
      "status": "starter-live-done",
      "purpose": "production env secret schema gate"
    },
    {
      "level": "L2a",
      "status": "starter-live-done",
      "purpose": "direct Package C resource lifecycle canary"
    },
    {
      "level": "L2b",
      "status": "starter-live-done",
      "purpose": "Portal click -> queued -> worker -> projection"
    },
    {
      "level": "L3",
      "status": "starter-cleanup-done-reconciling",
      "purpose": "billing reconciliation and cleanup"
    },
    {
      "level": "L4",
      "status": "starter-product-accepted",
      "purpose": "ordinary user product lifecycle"
    }
  ],
  "packageDDiscovery": {
    "branch": "docs/v22-package-d-opl-deploy-discovery",
    "model": "gpt-5.4",
    "readsSecretNow": false,
    "readsKubeconfigNow": false,
    "runsKubectlNow": false,
    "runsBuildPushDeployNow": false,
    "rolloutDone": true,
    "ownerGuardBlocked": false,
    "requiresOwnershipReleasePlanSubContract": true,
    "ownershipReleasePlanContract": "docs/contracts/v22-opl-deployment-ownership-release-plan-boundary.md",
    "ownershipReleasePlanContractReady": true,
    "realRolloutStillBlocked": false,
    "realRolloutBlocker": null,
    "realDeployDryRunDone": true,
    "realRuntimeSmokeDone": true,
    "productionPortalBridgeEnabledInLiveDeployment": true,
    "productionCloudOperationRowsObserved": 4,
    "authorizedNodePoolIdle": false,
    "rollbackDone": true,
    "kubeApiEndpoint": "kube.medopl.cn",
    "runtimeSurfaces": [
      "portal.medopl.cn",
      "opl.medopl.cn",
      "trace.medopl.cn"
    ],
    "candidateDeployments": {
      "default": [
        "portal-opl",
        "opl-web-gateway-opl",
        "opl-runtime-bridge-opl"
      ],
      "portal-v21-gray": [
        "portal",
        "opl-web-gateway",
        "opl-runtime-bridge"
      ]
    },
    "candidateLabelEvidence": "k8s-app/qcloud-app only for this purpose",
    "missingOwnerGuardFields": [
      "ownerRef",
      "workspaceId",
      "resourceBindingId",
      "operationId"
    ],
    "targetClassContractNeeded": [
      "platform_service_target",
      "workspace_runtime_target"
    ]
  },
  "modifiesDeployNow": false,
  "runsBuildPushKubectlNow": false,
  "automerges": false,
  "autopushes": false,
  "serialRealSideEffects": [
    "真实云 live",
    "create/release",
    "deploy/build/push/kubectl",
    "依赖安装",
    "merge/push"
  ],
  "parallelLaneRules": [
    "docs/contracts",
    "smoke",
    "fake wrapper",
    "cleanup plan",
    "topology/deploy contract"
  ],
  "runnablePathArtifactRoots": [
    "stdout JSON only",
    "services/portal/package.json",
    "services/portal/package-lock.json",
    ".runtime/v22-tencent-readonly-inventory/",
    ".runtime/v22-cloud-lifecycle/",
    ".runtime/v22-registry/",
    ".runtime/v22-cloud-reconciliation/",
    ".runtime/v22-cloud-deploy/",
    ".runtime/v22-runtime-smoke/",
    ".runtime/v22-cloud-cleanup/"
  ],
  "openIssues": [
    "L1 live Deployment env/secret/schema gate passed for the starter loop; rebase-local verification is still required before absorption",
    "starter minimal live loop evidence is recorded, but pro 8c16g/100GB, upgrade/add-storage and full matrix live reruns are not claimed",
    "exact 120min billing settlement remains an audit checkpoint; current starter evidence shows reconciliation status 对账中",
    "Package D rollout/build/push/kubectl readiness is outside the starter Package C lifecycle proof"
  ]
}
```
<!-- v22-cloud-onboarding-execution-board:end -->
