# v22 Cloud Onboarding Verification Matrix

program id: v22-cloud-onboarding

本矩阵定义 v22 cloud onboarding 的验证分层。AGENTS 管协作纪律，contracts 管边界，execution board 管当前 program/phase/lane/离场条件，status table 管每阶段状态和下一棒；本文件只说明每类验证证明什么、什么时候必须跑、不能做什么，以及 blocker 应回流到哪里。

本矩阵不推进 CO-06，不授权 live，不替代 `docs/contracts/v22-cloud-onboarding-workflow-boundary.md`，也不代表完整 create/release、deploy 或 Package D 已完成。Portal production integration 的本地 API + PostgreSQL canonical store smoke 可以作为 productionization evidence；用户在 2026-05-11 显式提供 Package C mutation secret file path 后，本分支已完成最小 real Tencent `storage-create` canary。canary 证据只在 `.runtime`，不进 git；当前分支不 build/push/kubectl，不 merge，不 push。

## Verification Scope

verification matrix covers:

- contract smoke: 合同、状态表和执行板不漂移。
- loader smoke: official SDK loader 默认 fail-closed，不读 secret，不打云。
- shape smoke: SDK package service/version/client shape 是否匹配 wrapper 假设。
- preflight smoke: CO-06 live 前的本地完整前置检查。
- authorized live: 用户显式授权后的一次真实 readonly 云调用。
- report review: 脱敏 readonly report 审查。
- cleanup gate: official SDK live report 通过后才允许 TC3 cleanup。

verification matrix does not cover:

- create/release mutation execution.
- production deploy/build/push/kubectl execution.
- Portal production integration real Tencent canary beyond the authorized `storage-create` sub-loop.
- real secret reading without explicit user authorization.
- real cloud calls without explicit user authorization.

## Plain Verification Summary

- 修改 contracts/status/board 时，必须跑 contract smoke 和 workflow gate，确认 repo-tracked truth 没有漂移。
- 安装或升级 SDK 依赖后，必须跑 loader smoke 和 shape smoke，确认 package 可加载且 service/version/client shape 符合 wrapper 假设。
- 修改 wrapper/factory/loader 时，必须跑 loader smoke、shape smoke 和相关 readonly inventory smoke。
- CO-06 live 授权前，必须跑 preflight smoke，确认 RUN gate、readonly API allowlist、region scope、report 输出和 redaction policy 都已静态通过。
- live 后 report review 前，只能审查脱敏 report；如需再次调用真实云，必须重新停下来问用户。
- official SDK live report 通过并被 B 接受前，TC3 cleanup gate 保持 blocked。

## Verification Matrix

| layer | purpose | must run when | forbidden before user authorization | required evidence | owner | blocker routing |
| --- | --- | --- | --- | --- | --- | --- |
| contract smoke | 证明合同、状态表、执行板和治理入口不漂移 | 修改 `docs/contracts/*`、`docs/status.md`、`docs/decisions.md`、`docs/invariants.md`、`docs/recovery/cloud-onboarding-*` 或 `docs/recovery/status-matrix.md` 时 | 不读 secret；不调用真实云；不创建/释放资源；不 build/push/kubectl；不推进状态 | local smoke output, workflow gate output, diff limited to intended docs/smoke | A/C 编写，B 审查 | A/C 修 docs/smoke，B 阻断状态漂移 |
| loader smoke | 证明 official SDK loader 默认 fail-closed，未显式启用时不加载真实 live path | 安装或升级 SDK 依赖后；修改 loader/factory/wrapper 边界后；CO-06 preflight 前 | 不读 secret；不 source env；不传 live flag；不调用真实 Tencent API | loader smoke output, default fail-closed evidence | A | A 修 loader/factory，B 审查默认路径 |
| shape smoke | 证明 SDK package service/version/client shape 与 wrapper 假设一致 | 安装或升级 SDK 依赖后；修改 official SDK wrapper/factory 后；新增 service family 前 | 不读 secret；不调用真实云；不把 package load 当作 service shape 通过 | package shape smoke output, explicit service/version/client evidence | A | A 修 wrapper 假设或拆分 service contract，B 审查 dependency diff |
| preflight smoke | 证明 readonly live 前本地前置条件完整 | CO-06 live 授权前；修改 readonly API allowlist、region/VPC scope、report output、redaction policy 后 | 不读 secret；不调用真实云；不读取 COS object body；不执行 mutation API | preflight smoke output, check-config report, explicit stop conditions | A | A 修 preflight，B 审查 live 前 gate，user 决定授权 |
| authorized live | 在用户授权后执行一次真实 readonly 云调用并生成脱敏 report | 用户明确授权 CO-06 后，且 default gate/preflight 已通过 | 未授权时不得读取 secret、不得调用真实云；授权也仅限 readonly allowlist | redacted readonly report outside git, command/evidence summary without secret material | user 授权，A 执行，B 审查 | user 决定 stop/retry；A 修配置；B 审查安全边界 |
| report review | 审查脱敏 report 是否支持 topology、resource tag、cost allocation、Portal ledger 映射和 cleanup 判定 | authorized live 生成脱敏 report 后；TC3 cleanup 或 dry-run plan 前 | 不再次调用真实云；不读 secret；不把 raw provider response 写入 git | B review result, redaction check, blocker list or accept note | B | B 给 blocker，A 修合同/实现，user 处理账号/权限/预算问题 |
| cleanup gate | official SDK live report 通过后才允许 TC3 cleanup | B 接受 readonly report 后；另开 cleanup 分支前 | 不提前删除 TC3；不恢复 TC3 为 production default；不碰 create/release | accepted report review, TC3 cleanup contract/smoke evidence | B | B 阻断 cleanup，A 修 cleanup plan |

## Required Run Triggers

| trigger | required verification | reason |
| --- | --- | --- |
| 修改合同/status/board | contract smoke, workflow gate, `git diff --check -- docs` | 防止合同 truth、阶段状态和执行板漂移 |
| 安装或升级 SDK 依赖 | loader smoke, shape smoke, dependency diff review | package 可加载不等于 service/version/client shape 匹配 |
| 修改 wrapper/factory/loader | loader smoke, shape smoke, readonly inventory wrapper smoke | 防止默认路径读 secret、打云或暴露 raw SDK client |
| CO-06 live 授权前 | preflight smoke, default gate evidence review | 证明本地 gate 已阻断缺参、越权 API、未脱敏输出和 mutation |
| live 后 report review 前 | report redaction review, report review checklist | 只审查脱敏 report；需要再次 live 必须重新问用户 |

## Package D Deploy Verification Boundary

Package D 不授权 Package C 的资源生命周期动作。不得删除、关闭或扩缩容别人的节点和存储；禁止 `kubectl delete`；禁止 `DeleteNodePool`；禁止删除 bucket/prefix/object。

Package D verification 只证明 TCR repository/tag preflight、multi-image build/push unique test tag、deploy dry-run、authorized deploy rollout 和 runtime smoke 的合同边界。它不得被解释为 TKE node pool 开删、COS storage 开删或账单对账已经完成；这些仍归 Package C 和 readonly reconciliation gate。

## Package D / OPL Deployment Discovery Verification

Package D / OPL Deployment Discovery 记录在 `docs/v22-package-d-opl-deploy-discovery` 分支，model: gpt-5.4。该 discovery 只写 docs/status/smoke：no secret read、no kubeconfig read、no kubectl、no build/push/deploy。

Discovery facts:

- kube API endpoint shape: `kube.medopl.cn`.
- runtime surfaces: `portal.medopl.cn`, `opl.medopl.cn`, `trace.medopl.cn`.
- candidate deployments: `default: portal-opl, opl-web-gateway-opl, portal-opl-adapter-opl`.
- candidate deployments: `portal-v21-gray: portal, opl-web-gateway, portal-opl-adapter`.
- candidate label evidence for this purpose: `k8s-app/qcloud-app`.

Verification verdict:

- not Package D rollout.
- does not prove build/push/kubectl/deploy completion.
- 不代表 deploy/build/push/kubectl 已完成。
- owner guard blocker remains.
- Package D must fail-closed because candidate deployments lack `ownerRef`, `workspaceId`, `resourceBindingId`, and `operationId`.
- cannot infer ownership by deployment name, namespace, IP, creation time, qcloud-app label, or manual memory.
- 不能靠 deployment 名字、namespace、IP、创建时间、qcloud-app 或人工记忆判断归属。

Contract issue for next branch:

- Portal/Gateway/Adapter/trace may be platform service targets.
- workspace runtime targets still require workspaceId/resourceBindingId.
- The next branch must define an OPL deployment ownership / release plan sub-contract with target class, platform service target guard, workspace runtime target guard, release plan fields, dry-run evidence, rollback evidence, and runtime smoke coverage.
- This discovery does not loosen the current Package D owner guard; it records why real rollout is blocked.

## OPL Deployment Ownership Release Plan Verification

`docs/contracts/v22-opl-deployment-ownership-release-plan-boundary.md` is the Package D Level 4 sub-contract for release plan owner guard.

It verifies:

- `platform_service_target` requires `ownerRef/operationId` and does not require `workspaceId/resourceBindingId`.
- `workspace_runtime_target` requires `ownerRef/operationId/workspaceId/resourceBindingId`.
- `k8s-app/qcloud-app`, deployment name, namespace, IP, creation time, or manual memory cannot prove ownership.
- runtime smoke coverage must cover every pushed component.
- runner summaries must remain sanitized and must not expose deploy secret, kubeconfig, raw registry credential, object key, signed URL, Authorization header or Cookie.

It does not verify:

- real TCR push.
- real kubectl dry-run or rollout.
- pushed version running in production.
- rollback evidence from a real deployment.
- Package C compute/storage lifecycle.

## Forbidden Actions By Layer

- contract smoke, loader smoke, shape smoke and preflight smoke must not read secret, source env, call real cloud, create/release resources, build/push/kubectl, or run live-test.
- authorized live requires explicit user authorization in the current task context before reading the authorized readonly secret allowlist or making a real readonly cloud call.
- authorized live is readonly only. create/release/deploy are not part of readonly live and require separate contracts, gates, and user authorization.
- report review must not persist raw provider responses, secret material, local paths, internal storage keys, signed URLs, or raw cloud payloads in git.
- cleanup gate must not remove or weaken TC3 diagnostic/reference before official SDK readonly live report exists and B accepts cleanup readiness.

## Missed-Coverage Lesson

The current cloud onboarding lane keeps this explicit lesson:

- package 可加载不等于 SDK service shape 匹配。
- `tencentcloud-sdk-nodejs@4.1.227` 没有 `cos.v20180530.Client`。
- COS 后续需要单独 `cos-nodejs-sdk-v5` 或独立合同。
- 非 COS 路径不能被 COS 缺失阻断。

Required follow-through:

- shape smoke must check the concrete service/version/client names used by wrapper assumptions.
- COS support must be isolated behind its own dependency/contract decision instead of blocking non-COS readonly inventory paths.
- loader/default/preflight verification must remain local and fail-closed until the user authorizes CO-06.

## Phase Mapping

| phase | verification expectation | current state reference |
| --- | --- | --- |
| CO-01 official SDK provider strategy | contract smoke confirms official SDK wrapper is production default provider strategy and TC3 is diagnostic/reference | `docs/recovery/cloud-onboarding-status-table.md` |
| CO-02 official SDK wrapper | wrapper smoke confirms business code depends on readonly inventory interface, not raw SDK client | `docs/contracts/v22-tencent-readonly-inventory-boundary.md` |
| CO-03 official SDK dependency loader | loader smoke confirms fail-closed default and no live path by default | `docs/recovery/cloud-onboarding-status-table.md` |
| CO-04 check-config | preflight/local guard confirms no secret read, no env source, no live flag, no real Tencent API call | `docs/recovery/cloud-onboarding-status-table.md` |
| CO-05 default gate | B confirms default path has no secret read, no real cloud call, no real SDK live path, no mutation | `docs/recovery/cloud-onboarding-status-table.md` |
| CO-06 user-authorized readonly live | requires explicit user authorization before any readonly live call | `docs/recovery/cloud-onboarding-status-table.md` |
| CO-07 readonly report review | reviews only redacted report evidence generated outside git | `docs/contracts/v22-cloud-onboarding-workflow-boundary.md` |
| CO-08 TC3 cleanup gate | remains blocked until official SDK live report exists and B accepts cleanup readiness | `docs/recovery/cloud-onboarding-status-table.md` |
| CO-09 through CO-14 | later dry-run, mutation, deploy, Portal integration and canary/QA require their own contracts/gates | `docs/contracts/v22-cloud-onboarding-workflow-boundary.md` |

## Matrix Data

<!-- v22-cloud-onboarding-verification-matrix:start -->
```json
{
  "programId": "v22-cloud-onboarding",
  "matrixType": "verification-layering",
  "doesNotReadSecret": false,
  "doesNotCallRealCloud": false,
  "authorizedSecretReadScope": "Package C mutation secret file path supplied by user for storage-create canary only",
  "authorizedRealCloudScope": "Tencent COS putObject storage marker for storage-create canary only",
  "doesNotModifyScriptsOrServices": true,
  "doesNotAuthorizeLive": true,
  "packageDDiscovery": {
    "branch": "docs/v22-package-d-opl-deploy-discovery",
    "model": "gpt-5.4",
    "doesNotAuthorizeRollout": true,
    "doesNotReadSecret": true,
    "doesNotReadKubeconfig": true,
    "doesNotRunKubectl": true,
    "doesNotBuildPushDeploy": true,
    "ownerGuardMustRemainHard": true,
    "requiresTargetClassContract": true,
    "blocker": "candidate deployments lack ownerRef/workspaceId/resourceBindingId/operationId and cannot be accepted from k8s-app/qcloud-app labels",
    "targetClassesToDefine": [
      "platform service target",
      "workspace runtime target"
    ],
    "runtimeSurfaces": [
      "portal.medopl.cn",
      "opl.medopl.cn",
      "trace.medopl.cn"
    ]
  },
  "oplDeploymentOwnershipReleasePlan": {
    "contract": "docs/contracts/v22-opl-deployment-ownership-release-plan-boundary.md",
    "level": 4,
    "package": "Package D",
    "doesNotAuthorizeBuildPushKubectl": true,
    "targetClasses": [
      "platform_service_target",
      "workspace_runtime_target"
    ],
    "smoke": "scripts/smoke-test-v22-opl-deployment-ownership-release-plan-contract.mjs",
    "realRolloutStillRequiresExplicitAuthorization": true
  },
  "layers": [
    {
      "layer": "contract smoke",
      "purpose": "contracts/status/board do not drift",
      "mustRunWhen": [
        "contracts/status/board changes",
        "governance entry references change"
      ],
      "forbiddenBeforeUserAuthorization": [
        "read secret",
        "call real cloud",
        "create/release",
        "build/push/kubectl"
      ],
      "owner": "A/C",
      "blockerRouting": "A/C fix docs or smoke; B blocks status drift"
    },
    {
      "layer": "loader smoke",
      "purpose": "official SDK loader remains fail-closed by default",
      "mustRunWhen": [
        "SDK dependency install or upgrade",
        "loader/factory/wrapper changes",
        "CO-06 preflight"
      ],
      "forbiddenBeforeUserAuthorization": [
        "read secret",
        "source env",
        "pass live flag",
        "call real Tencent API"
      ],
      "owner": "A",
      "blockerRouting": "A fixes loader/factory; B reviews default path"
    },
    {
      "layer": "shape smoke",
      "purpose": "SDK package service/version/client shape matches wrapper assumptions",
      "mustRunWhen": [
        "SDK dependency install or upgrade",
        "official SDK wrapper/factory changes",
        "new service family is added"
      ],
      "forbiddenBeforeUserAuthorization": [
        "read secret",
        "call real cloud",
        "treat package load as service-shape pass"
      ],
      "owner": "A",
      "blockerRouting": "A fixes wrapper assumptions or splits service contract; B reviews dependency diff"
    },
    {
      "layer": "preflight smoke",
      "purpose": "readonly live prerequisites are complete before CO-06",
      "mustRunWhen": [
        "before CO-06 authorization request",
        "readonly API allowlist changes",
        "region/VPC scope changes",
        "report redaction policy changes"
      ],
      "forbiddenBeforeUserAuthorization": [
        "read secret",
        "call real cloud",
        "read COS object body",
        "execute mutation API"
      ],
      "owner": "A",
      "blockerRouting": "A fixes preflight; B reviews live gate; user decides authorization"
    },
    {
      "layer": "authorized live",
      "purpose": "one user-authorized real readonly cloud call generates a redacted report",
      "mustRunWhen": [
        "user explicitly authorizes CO-06",
        "default gate and preflight are passed"
      ],
      "forbiddenBeforeUserAuthorization": [
        "read secret",
        "call real cloud"
      ],
      "owner": "user/A/B",
      "blockerRouting": "user decides stop/retry; A fixes config-only blockers; B reviews safety blockers"
    },
    {
      "layer": "report review",
      "purpose": "redacted readonly report is reviewed before cleanup or dry-run planning",
      "mustRunWhen": [
        "authorized live report exists",
        "before TC3 cleanup",
        "before create/release dry-run planning"
      ],
      "forbiddenBeforeUserAuthorization": [
        "repeat real cloud call",
        "read secret",
        "write raw provider response to git"
      ],
      "owner": "B",
      "blockerRouting": "B returns blockers; A fixes contract/code gaps; user handles account/permission/budget decisions"
    },
    {
      "layer": "cleanup gate",
      "purpose": "TC3 cleanup starts only after official SDK live report is accepted",
      "mustRunWhen": [
        "B accepts readonly report",
        "before opening TC3 cleanup branch"
      ],
      "forbiddenBeforeUserAuthorization": [
        "delete TC3 early",
        "restore TC3 as production default",
        "touch create/release"
      ],
      "owner": "B",
      "blockerRouting": "B blocks cleanup; A fixes cleanup plan"
    }
  ],
  "missedCoverageLesson": [
    "package load does not prove SDK service shape match",
    "tencentcloud-sdk-nodejs@4.1.227 does not provide cos.v20180530.Client",
    "COS needs separate cos-nodejs-sdk-v5 or a separate contract",
    "non-COS paths must not be blocked by missing COS support"
  ]
}
```
<!-- v22-cloud-onboarding-verification-matrix:end -->
