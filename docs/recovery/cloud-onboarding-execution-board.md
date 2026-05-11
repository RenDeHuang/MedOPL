# v22 Cloud Onboarding Central Execution Board

program id: v22-cloud-onboarding

current trunk anchor: 148f5a0

current phase: CO-13 storage-create canary done; CO-06 readonly live remains separate and still needs user authorization

本文件是 v22 cloud onboarding 的中央执行板。AGENTS 管纪律，contracts 管边界，execution board 管当前 program/phase/lane/离场条件，status table 管每阶段状态和下一棒。

本执行板不替代 `docs/contracts/v22-cloud-onboarding-workflow-boundary.md`。workflow contract 定义完整状态机；本文件只记录当前 program 位置、lane 编排、离场条件、blocker 回流和需要用户确认的 gate。当前分支实现 Portal production storage-create loop，并在用户明确提供 Package C mutation secret file path 后完成最小 real Tencent storage-create canary。它不改 deploy，不 build/push/kubectl，不做 compute/delete/deploy；canary 证据只写 `.runtime`，不进 git。

Package D / OPL Deployment Discovery 记录在 `docs/v22-package-d-opl-deploy-discovery` 分支，model: gpt-5.4。该 discovery 只回写已知事实和 owner guard blocker：no secret read、no kubeconfig read、no kubectl、no build/push/deploy。它不是 Package D rollout，does not prove build/push/kubectl/deploy completion，不代表 deploy/build/push/kubectl 已完成。

Cloud-lane Package D stack is intentionally long-lived. `cloud-lane/feat/v22-package-d-image-push-gate` is based on D1 commit `eb23e02` and records the D2 R-14/R-15 image push gate. It must remain a cloud-lane branch until D1/D2/D3 are validated together or explicitly abandoned. B should review the stack as D1 -> D2 -> D3, not absorb D1 early if later gates require D1 correction.

关联状态表：`docs/recovery/cloud-onboarding-status-table.md`。

## Program Snapshot

- program id: v22-cloud-onboarding
- current trunk anchor: 148f5a0
- current phase: CO-13 storage-create canary done; CO-06 readonly live remains separate and still needs user authorization
- current lane: Portal production storage-create evidence review
- next lane: B review / absorption decision, then separate authorization for compute/delete/deploy if needed
- cloud-lane branch: `cloud-lane/feat/v22-package-d-image-push-gate`
- cloud-lane model: `gpt-5.4`
- cloud-lane stack base: D1 `feat/v22-opl-deployment-ownership-release-plan` at `eb23e02`
- cloud-lane status: D2 image push gate in progress; no real build/push/kubectl authorized by this status
- workflow contract: `docs/contracts/v22-cloud-onboarding-workflow-boundary.md`
- status table: `docs/recovery/cloud-onboarding-status-table.md`
- execution board owner: B for board truth, A for implementation task packages, user for live authorization

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
- open issue: Package D / OPL deployment discovery found candidate deployments, but real rollout remains blocked until a reviewed release plan uses the repo-tracked OPL deployment ownership / release plan sub-contract and real target metadata passes owner guard.
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
| R-16 deploy dry-run | CC-07 | deploy_and_production_integration | path defined; owner guard must pass before deploy dry-run can become apply readiness |
| R-17 authorized deploy rollout | CC-07 | deploy_and_production_integration | path defined; real kubectl blocked until release plan and owner guard pass |
| R-18 runtime smoke | CC-07 | deploy_and_production_integration | path defined; execution remains separate |
| R-19 release compute | CC-05 | authorized_resource_lifecycle | path defined; runner in later Package C branch |
| R-20 delete file space | CC-04 | authorized_resource_lifecycle | path defined; runner in later Package C branch |
| R-21 final reconciliation cleanup and B review | CC-REVIEW | manual_b_review | path defined; B absorption gate |

Package D 不授权 Package C 的资源生命周期动作。不得删除、关闭或扩缩容别人的节点和存储；禁止 `kubectl delete`；禁止 `DeleteNodePool`；禁止删除 bucket/prefix/object。

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
- candidate deployments discovered by prior read-only inspection: `default: portal-opl, opl-web-gateway-opl, portal-opl-adapter-opl`.
- candidate deployments discovered by prior read-only inspection: `portal-v21-gray: portal, opl-web-gateway, portal-opl-adapter`.
- candidate deployments have only `k8s-app/qcloud-app` style labels for this purpose; they do not provide Package D owner guard labels.

Blocker:

- owner guard blocker: candidate deployments lack `ownerRef`, `workspaceId`, `resourceBindingId`, and `operationId`.
- Package D must fail-closed when ownership labels or Portal truth do not match.
- cannot infer ownership by deployment name, namespace, IP, creation time, qcloud-app label, or manual memory.
- 不能靠 deployment 名字、namespace、IP、创建时间、qcloud-app 或人工记忆判断归属。

Contract problem to solve next:

- Portal/Gateway/Adapter/trace may be platform service targets, so they may need a platform-level ownerRef and operation audit identity rather than forced workspace ownership.
- workspace runtime targets still require workspaceId/resourceBindingId because they represent tenant-scoped runtime capacity.
- The next branch must define an OPL deployment ownership / release plan sub-contract with explicit target class values: platform service target and workspace runtime target.
- That sub-contract must decide which labels or Portal canonical records prove each target class without weakening the current Package D owner guard.

Contract update:

- `docs/contracts/v22-opl-deployment-ownership-release-plan-boundary.md` is the repo-tracked OPL deployment ownership / release plan sub-contract.
- `platform_service_target` covers Portal/Gateway/Adapter/shared Runtime Bridge target classes and requires `ownerRef/operationId`.
- `workspace_runtime_target` covers workspace Runtime Agent/runtime workload target classes and requires `ownerRef/operationId/workspaceId/resourceBindingId`.
- This contract only enables config/fake-live ownership validation; real TCR push, kubectl dry-run, rollout, runtime smoke and rollback evidence remain separate Package D steps requiring explicit authorization.

Discovery status:

- not Package D rollout.
- does not prove build/push/kubectl/deploy completion.
- 不代表 deploy/build/push/kubectl 已完成。
- R-14 through R-18 remain blocked for real execution until release plan, target class, owner guard, dry-run, rollback evidence, and user authorization are present.

## Board Data

<!-- v22-cloud-onboarding-execution-board:start -->
```json
{
  "programId": "v22-cloud-onboarding",
  "currentTrunkAnchor": "148f5a0",
  "currentPhase": "CO-13 storage-create canary done; CO-06 readonly live remains separate and still needs user authorization",
  "workflowModel": "authorized_cloud_connection_loop",
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
  "currentLane": "Portal production storage-create evidence review",
  "nextLane": "B review / absorption decision, then separate authorization for compute/delete/deploy if needed",
  "cloudLane": {
    "branch": "cloud-lane/feat/v22-package-d-image-push-gate",
    "model": "gpt-5.4",
    "baseCommit": "eb23e02",
    "stack": [
      "D1: feat/v22-opl-deployment-ownership-release-plan",
      "D2: cloud-lane/feat/v22-package-d-image-push-gate",
      "D3: pending deploy dry-run rollout runtime smoke"
    ],
    "longLived": true,
    "absorbD1Early": false,
    "d2Scope": [
      "R-14",
      "R-15"
    ],
    "d2RealPushDone": false,
    "requiresAcceptedPreflightBeforeBuildPush": true
  },
  "workflowContract": "docs/contracts/v22-cloud-onboarding-workflow-boundary.md",
  "statusTable": "docs/recovery/cloud-onboarding-status-table.md",
  "readsSecretNow": false,
  "callsRealCloudNow": false,
  "authorizedStorageCreateCanaryDone": true,
  "packageDDiscovery": {
    "branch": "docs/v22-package-d-opl-deploy-discovery",
    "model": "gpt-5.4",
    "readsSecretNow": false,
    "readsKubeconfigNow": false,
    "runsKubectlNow": false,
    "runsBuildPushDeployNow": false,
    "rolloutDone": false,
    "ownerGuardBlocked": true,
    "requiresOwnershipReleasePlanSubContract": true,
    "ownershipReleasePlanContract": "docs/contracts/v22-opl-deployment-ownership-release-plan-boundary.md",
    "ownershipReleasePlanContractReady": true,
    "realRolloutStillBlocked": true,
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
        "portal-opl-adapter-opl"
      ],
      "portal-v21-gray": [
        "portal",
        "opl-web-gateway",
        "portal-opl-adapter"
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
    "workflow contract phase 12 required contracts still includes deploy plan contract",
    "workflow contract phase 14 required contracts still includes role surface contracts and release/status docs"
  ]
}
```
<!-- v22-cloud-onboarding-execution-board:end -->
