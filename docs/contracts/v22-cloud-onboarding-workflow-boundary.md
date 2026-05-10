# v22 Cloud Onboarding Workflow Boundary

本合同定义 v22 接云上线的 repo-tracked workflow 合同，把从 official SDK provider strategy 到生产发布状态更新的业务推进顺序写成状态机。

本合同不替代 AGENTS.md。AGENTS.md 管 A/B/C/D 纪律、授权红线、协作规则和禁止路径；本合同管业务推进顺序、阶段依赖、验收状态和 blocker 回流。后续 cloud onboarding 不得只依赖聊天记忆推进，必须以 repo-tracked workflow 合同、合同索引、status/execution board 和 smoke 为准。

当前分支只写合同和 smoke，不实现业务代码，不读取 secret，不调用真实云，不执行 build/push/kubectl/live-test，不安装依赖，不 merge，不 push。

## Workflow Principle

v22 cloud onboarding workflow 是状态机。每个阶段必须显式记录：

- owner
- 是否可并发
- 是否必须独立 worktree
- 是否允许读 secret
- 是否允许真实云
- required contracts
- required smoke
- success status
- blocker 回流到谁
- 什么时候必须停下来问用户

阶段推进必须满足：

- 上一阶段 success status 明确后，下一阶段才能进入可执行状态。
- 真实外部副作用必须串行，不能和其他真实副作用并发。
- 每个阶段的 blocker 必须回流到明确 owner，不允许靠下一阶段兜底。
- 涉及真实 secret、真实云、deploy/build/push/kubectl、依赖安装、merge/push 时必须停下来问用户。

## Required State Machine

### 1. official SDK provider strategy

目标：确认 production default provider strategy 是 Tencent official SDK wrapper，TC3 仅为 diagnostic/reference。

- owner: A
- 是否可并发: 是，可与 docs/contracts、smoke、fake wrapper 设计并行。
- 是否必须独立 worktree: 是。
- 是否允许读 secret: 否。
- 是否允许真实云: 否。
- required contracts: `v22-tencent-readonly-inventory-boundary.md`, `v22-production-cloud-topology-boundary.md`
- required smoke: `smoke-test-v22-tencent-official-sdk-provider-strategy-contract.mjs`
- success status: provider strategy contract accepted and smoke passed
- blocker 回流到谁: A 修合同，B 复审策略冲突
- 什么时候必须停下来问用户: provider strategy 与已有 readonly inventory / create-release 合同冲突，或需要新增 SDK 依赖、真实 secret、真实云授权

### 2. official SDK wrapper

目标：定义或实现 wrapper shell，使业务层只依赖 readonly inventory interface，不暴露 raw SDK client。

- owner: A
- 是否可并发: 是，可与合同 smoke 和 cleanup plan 并行。
- 是否必须独立 worktree: 是。
- 是否允许读 secret: 否。
- 是否允许真实云: 否。
- required contracts: `v22-tencent-readonly-inventory-boundary.md`
- required smoke: `smoke-test-v22-tencent-readonly-inventory-official-sdk-wrapper.mjs`
- success status: official SDK wrapper shell merged with static smoke
- blocker 回流到谁: A 修 wrapper，B 审查 raw SDK exposure
- 什么时候必须停下来问用户: 需要安装依赖、读取 secret、启用真实 SDK fetch、或改变 create/release mutation 边界

### 3. official SDK dependency loader

目标：loader 只负责把 `tencentcloud-sdk-nodejs` package shape 包成 readonly modules factories；默认不加载 SDK package，不打云。

- owner: A
- 是否可并发: 是，但依赖安装本身不可并发执行。
- 是否必须独立 worktree: 是。
- 是否允许读 secret: 否。
- 是否允许真实云: 否。
- required contracts: `v22-tencent-readonly-inventory-boundary.md`
- required smoke: `smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs`
- success status: dependency loader contract/smoke merged; loader fail-closed by default
- blocker 回流到谁: A 修 loader，B 审查 package diff 和默认 gate
- 什么时候必须停下来问用户: 需要新增或升级 npm 依赖、修改 lockfile、加载真实 SDK package、或启用 live readonly

### 4. check-config

目标：在真实 readonly live 前确认 regions、readonly API allowlist、SDK mode、RUN gate、report 输出目录和 redaction policy 均可静态检查。

- owner: A
- 是否可并发: 是，可与 report review 模板、cleanup plan 设计并行。
- 是否必须独立 worktree: 是。
- 是否允许读 secret: 否。
- 是否允许真实云: 否。
- required contracts: `v22-tencent-readonly-inventory-boundary.md`, `v22-cloud-onboarding-workflow-boundary.md`
- required smoke: `smoke-test-v22-tencent-readonly-inventory-local-guard.mjs`, `smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs`
- success status: check-config blocks missing RUN gate, mutation API, read-all secret, and non-redacted output
- blocker 回流到谁: A 修 check-config，B 审查 gate
- 什么时候必须停下来问用户: 静态检查需要读取真实 secret 文件、source env、调用真实云或修改 deploy

### 5. default gate

目标：确认默认路径不读 secret、不加载真实 SDK、不调用真实云、不执行 mutation，不把 TC3 恢复为 production default。

- owner: B
- 是否可并发: 否，必须在 live readonly 前串行确认。
- 是否必须独立 worktree: 否，B 可在主工作区只读审查。
- 是否允许读 secret: 否。
- 是否允许真实云: 否。
- required contracts: `v22-tencent-readonly-inventory-boundary.md`, `v22-tencent-tc3-diagnostic-cleanup-plan.md`
- required smoke: `smoke-test-v22-tencent-readonly-inventory-official-sdk-wrapper.mjs`, `smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs`, `smoke-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs`
- success status: default gate confirms official SDK wrapper path is default and all live paths are opt-in
- blocker 回流到谁: B blocks; A fixes default gate or wrapper
- 什么时候必须停下来问用户: default behavior would read secret, call cloud, install dependency, push, merge, or change deploy

### 6. user-authorized readonly live

目标：在用户明确授权后，运行 official SDK readonly live，只调用 Describe/List/Get/Head 类 API，并生成脱敏 report。

- owner: user
- 是否可并发: 否，真实云 live 必须串行。
- 是否必须独立 worktree: 是。
- 是否允许读 secret: 是，但仅限用户授权的 readonly secret allowlist。
- 是否允许真实云: 是，但仅限用户授权的 readonly live。
- required contracts: `v22-tencent-readonly-inventory-boundary.md`, `v22-production-cloud-topology-boundary.md`
- required smoke: `smoke-test-v22-tencent-readonly-inventory-real-live-run.mjs`, `smoke-test-v22-tencent-readonly-inventory-live-bridge.mjs`, check-config output
- success status: redacted readonly inventory report generated outside git
- blocker 回流到谁: user decides retry/stop; A fixes config-only blockers; B reviews safety blockers
- 什么时候必须停下来问用户: before reading secret, before real cloud call, before changing region/API allowlist, on permission/limit/account mismatch, before sharing report contents

### 7. readonly report review

目标：B 审查脱敏 readonly report，确认 topology、resource tag、cost allocation、Portal ledger 映射和 orphan/conflict 风险。

- owner: B
- 是否可并发: 否，必须等待 readonly live report。
- 是否必须独立 worktree: 否，B 可只读审查 report 摘要。
- 是否允许读 secret: 否。
- 是否允许真实云: 否。
- required contracts: `v22-tencent-readonly-inventory-boundary.md`, `v22-production-cloud-topology-boundary.md`, `v22-tenant-resource-binding-boundary.md`
- required smoke: `smoke-test-v22-tencent-readonly-inventory-boundary.mjs`, report redaction checks
- success status: B accepts report or returns blocker list
- blocker 回流到谁: A for contract/code gaps, user for cloud/account/permission decisions, C for QA reproduction
- 什么时候必须停下来问用户: report shows unknown resources, missing tags, conflicting ownership, permission gaps, cost anomaly, or requires another real cloud read

### 8. TC3 cleanup gate

目标：确认 official SDK readonly live 已生成脱敏 report，B 确认 production default 不再依赖 TC3 后，才允许另开 cleanup 分支处理 TC3 production path。

- owner: B
- 是否可并发: 是，可与 dry-run create/release plan 合同并行；不能和真实 live 副作用并行。
- 是否必须独立 worktree: 是，cleanup 必须独立。
- 是否允许读 secret: 否。
- 是否允许真实云: 否。
- required contracts: `v22-tencent-tc3-diagnostic-cleanup-plan.md`, `v22-tencent-readonly-inventory-boundary.md`
- required smoke: `smoke-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs`
- success status: TC3 cleanup branch may start; TC3 remains diagnostic/reference until cleanup proves removal
- blocker 回流到谁: B blocks; A updates cleanup plan
- 什么时候必须停下来问用户: cleanup would delete TC3 before official SDK report review, change official SDK implementation, or touch create/release

### 9. create/release dry-run plan

目标：把 readonly evidence、topology 和 resource binding 映射成不会执行的 create/release dry-run plan。

- owner: A
- 是否可并发: 是，可与 TC3 cleanup plan、Portal copy review 和 deploy contract 并行。
- 是否必须独立 worktree: 是。
- 是否允许读 secret: 否。
- 是否允许真实云: 否。
- required contracts: `v22-tencent-dry-run-resource-plan-provider-boundary.md`, `v22-authorized-tencent-create-release-boundary.md`, `v22-production-cloud-topology-boundary.md`
- required smoke: `smoke-test-v22-tencent-dry-run-resource-plan-provider.mjs`, `smoke-test-v22-authorized-tencent-create-release-contract.mjs`
- success status: dry-run create/release plan produces no mutation and no charge
- blocker 回流到谁: A fixes plan, B reviews mutation leakage
- 什么时候必须停下来问用户: dry-run plan wants to call real cloud, read mutation secret, alter ledger, or expose cloud console language to ordinary users

### 10. mutation SDK wrapper

目标：定义 mutation SDK wrapper 的最小接口、独立 RUN gate、独立 mutation secret allowlist、operation budget 和 fail-closed behavior。

- owner: A
- 是否可并发: 是，仅限 fake wrapper、contract、smoke；不得与真实 create/release live 并发。
- 是否必须独立 worktree: 是。
- 是否允许读 secret: 否。
- 是否允许真实云: 否。
- required contracts: `v22-authorized-tencent-create-release-implementation-boundary.md`, `v22-authorized-tencent-create-release-execution-boundary.md`
- required smoke: `smoke-test-v22-authorized-tencent-create-release-implementation-contract.mjs`, `smoke-test-v22-authorized-tencent-create-release-execution-contract.mjs`
- success status: mutation wrapper shell is gated, fake-only by default, and separate from readonly runner/secret
- blocker 回流到谁: A fixes wrapper, B reviews side-effect boundary
- 什么时候必须停下来问用户: need mutation secret, real API, SDK dependency change, build/push, kubectl, or deploy change

### 11. minimal authorized create/release live

目标：在用户明确授权后，对最小资源集合执行真实 create/release live，并按 Portal ledger + cloud tags 双重校验、预算和回滚策略执行。

- owner: user
- 是否可并发: 否，create/release 必须串行。
- 是否必须独立 worktree: 是。
- 是否允许读 secret: 是，但仅限用户授权的 mutation secret allowlist。
- 是否允许真实云: 是，但仅限用户授权的 minimal create/release live。
- required contracts: `v22-authorized-tencent-create-release-boundary.md`, `v22-authorized-tencent-create-release-implementation-boundary.md`, `v22-authorized-tencent-create-release-execution-boundary.md`
- required smoke: execution contract smoke, preflight dry-run diff, rollback/audit smoke
- success status: minimal live operation completed, tagged, ledgered, audited, and rollback-ready
- blocker 回流到谁: user decides stop/retry; A fixes implementation; B reviews evidence before further mutation
- 什么时候必须停下来问用户: before reading mutation secret, before each real mutation, on budget/ownership/tag mismatch, before retry, before rollback with side effect, before expanding scope

### 12. production deploy execution

目标：在用户明确授权后执行 production deploy/build/push/kubectl 路径，且只按已审查 deploy plan 执行。

- owner: user
- 是否可并发: 否，deploy/build/push/kubectl 必须串行。
- 是否必须独立 worktree: 是。
- 是否允许读 secret: 是，但仅限用户授权的 deploy secret/kubeconfig/registry allowlist。
- 是否允许真实云: 是，但仅限用户授权的 production deploy execution。
- required contracts: `v22-production-cloud-topology-boundary.md`, deploy plan contract, `v22-cloud-onboarding-workflow-boundary.md`
- required smoke: deploy plan smoke, local build/deploy dry-run smoke, workflow gate review
- success status: deployment executed with versioned evidence and rollback plan
- blocker 回流到谁: user decides stop/rollback; A fixes deploy plan; B reviews evidence; C runs QA
- 什么时候必须停下来问用户: before build, before push, before kubectl, before changing deploy, before reading kubeconfig/registry secret, before rollback

### 13. Portal production integration

目标：将 Portal 生产路径接入已授权云事实，但普通用户仍只看到工作台资源、文件空间、预计费用、释放策略和审计状态。

- owner: A
- 是否可并发: 是，可与 QA checklist 和 release status draft 并行；不得与真实 deploy/mutation 并发。
- 是否必须独立 worktree: 是。
- 是否允许读 secret: 否。
- 是否允许真实云: 否。
- required contracts: `v22-portal-user-surface-boundary.md`, `v22-portal-admin-ops-surface-boundary.md`, `v22-portal-files-billing-trace-boundary.md`, `v22-cloud-onboarding-workflow-boundary.md`
- required smoke: portal payload contract smoke, portal role surface smoke, mobile usability smoke
- success status: Portal consumes sanitized production projection without cloud console leakage
- blocker 回流到谁: A fixes Portal/API; B reviews role boundary; C runs UI QA
- 什么时候必须停下来问用户: Portal would expose secret/internal storage/cloud console language, alter billing truth, or require real cloud read

#### Portal API test-only fake-live bridge

在 Portal production integration 之前，允许存在一个本地 smoke 专用的 test-only fake-live bridge，用来验证 Portal API、PostgreSQL canonical shape、Package C fake-live operation 状态回写和普通用户 projection 的闭环。

测试路径：

- `POST /portal/api/v22/cloud-operations/test/fake-live`
- `GET /portal/api/v22/cloud-operations/test/projection?workspaceId=<workspace-id>`

边界：

- 该 API 只能用于本地 smoke 和合同验证，必须返回 `testOnly=true`、`productionPortalConnected=false`、`runnerMode=fake-live`、`realCloudCalls=false`。
- 该 API 默认不注册到 Portal route。只有 `PORTAL_ENABLE_CLOUD_OPERATION_TEST_BRIDGE=1` 且 `NODE_ENV` 不是 `production` 时才允许注册；production 环境必须强制关闭，即使设置该 env 也不能启用。
- 该 API 不读 secret、不调用真实云、不执行真实 TKE/COS/TCR/deploy、不写真实 `.runtime` evidence。
- 该 API 只写与未来真实 Portal 一致的 canonical record shape：`cloudOperations`、`computeAllocations`、`fileSpaceEntitlements`、`cloudResourceProjections`、`workspaceResourceBindings`、`weeklyProtectionFreezes` / wallet ledger、`billingReconciliations`、`auditEvents`。
- 支持的测试操作仅限：`create_storage`、`create_compute`、`expand_storage`、`expand_compute`、`release_compute`、`delete_storage`。
- 后续真实 Portal 可以复用同一 canonical shape，但必须替换为正式 Portal route、真实 PostgreSQL persistence、授权 runner queue 和用户确认链路；不得把该测试 API 当作生产 Portal 已接云。
- 普通用户 projection 只能显示工作台资源、计算资源、文件空间、套餐、余额、冻结金额、开通中、可用、扩容中、释放中、文件保护期、对账中、对账异常等产品语言；不得展示 CVM、COS、TKE、Kubernetes、node pool、bucket、object key、VPC、安全组、kubeconfig、SecretId、SecretKey 或 raw response。

### 14. canary / QA / release status update

目标：C/D 对生产路径做 canary、QA 和 release status update，B 汇总是否可推进 release。

- owner: C
- 是否可并发: 是，QA/canary/status 文档可以并行；真实外部副作用仍串行。
- 是否必须独立 worktree: 是，QA/report/status 更新必须独立于 deploy/mutation worktree。
- 是否允许读 secret: 否，除非用户另行授权只读 canary 所需 key。
- 是否允许真实云: 否，除非用户另行授权 canary。
- required contracts: `v22-cloud-onboarding-workflow-boundary.md`, role surface contracts, release/status docs
- required smoke: canary/QA smoke, MVP suite, workflow gate review
- success status: C_PASS or B_BLOCKER with release status updated
- blocker 回流到谁: C files repro, A fixes, B decides merge/release, user authorizes any further live action
- 什么时候必须停下来问用户: QA needs live credentials, canary calls real service, release status implies production readiness, or rollout expands blast radius

## Serial External Side Effects

真实外部副作用必须串行：

- 真实云 live。
- create/release。
- deploy/build/push/kubectl。
- 依赖安装。
- merge/push。

这些动作不得由 workflow 自动执行，不得和其他真实副作用并发，不得在没有用户当前会话明确授权时发生。任何阶段如果要进入上述动作，必须停下来问用户。

## Parallelizable Work

可并发项：

- docs/contracts。
- smoke。
- fake wrapper。
- cleanup plan。
- topology/deploy contract。

这些工作仍必须使用独立 worktree，并且不得读取 secret、不得调用真实云、不得执行 build/push/kubectl/live-test。

## Workflow Non-Goals

本 workflow 不自动 merge、不自动 push、不读 secret、不调用真实云；只能生成任务包和下一步建议。

本分支可预留后续让 `scripts/v22-agent-workflow.mjs` 支持 cloud-onboarding lane type，但本分支不实现脚本逻辑，不修改 workflow orchestrator behavior，不新增自动执行能力。

## Contract Data

<!-- v22-cloud-onboarding-workflow-contract:start -->
```json
{
  "contract": "v22_cloud_onboarding_workflow_boundary",
  "version": 1,
  "replacesAgentsMd": false,
  "agentsMdRole": "AGENTS.md 管 A/B/C/D 纪律",
  "contractRole": "本合同管业务推进顺序",
  "automerges": false,
  "autopushes": false,
  "readsSecretNow": false,
  "callsRealCloudNow": false,
  "generatesOnlyTaskPackagesAndNextStepSuggestions": true,
  "futureScriptLaneType": "cloud-onboarding",
  "implementsScriptLogicNow": false,
  "serialExternalSideEffects": [
    "真实云 live",
    "create/release",
    "deploy/build/push/kubectl",
    "依赖安装",
    "merge/push"
  ],
  "parallelizableWork": [
    "docs/contracts",
    "smoke",
    "fake wrapper",
    "cleanup plan",
    "topology/deploy contract"
  ],
  "portalApiTestBridge": {
    "testOnly": true,
    "productionPortalConnected": false,
    "runnerMode": "fake-live",
    "realCloudCalls": false,
    "readsSecretNow": false,
    "defaultRouteEnabled": false,
    "enableEnv": "PORTAL_ENABLE_CLOUD_OPERATION_TEST_BRIDGE",
    "requiresEnableEnvValue": "1",
    "forbidsProductionRouteRegistration": true,
    "apiPaths": [
      "POST /portal/api/v22/cloud-operations/test/fake-live",
      "GET /portal/api/v22/cloud-operations/test/projection"
    ],
    "operations": [
      "create_storage",
      "create_compute",
      "expand_storage",
      "expand_compute",
      "release_compute",
      "delete_storage"
    ],
    "canonicalRecords": [
      "cloudOperations",
      "computeAllocations",
      "fileSpaceEntitlements",
      "cloudResourceProjections",
      "workspaceResourceBindings",
      "weeklyProtectionFreezes",
      "walletLedger",
      "billingReconciliations",
      "auditEvents"
    ],
    "futureProductionPortalMustReplaceTestRoute": true,
    "ordinaryProjectionHidesCloudConsoleObjects": true
  },
  "phases": [
    {
      "name": "official SDK provider strategy",
      "owner": "A",
      "parallelizable": true,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/contracts/v22-tencent-readonly-inventory-boundary.md",
        "docs/contracts/v22-production-cloud-topology-boundary.md"
      ],
      "requiredSmoke": [
        "scripts/smoke-test-v22-tencent-official-sdk-provider-strategy-contract.mjs"
      ],
      "successStatus": "provider strategy contract accepted and smoke passed",
      "blockerReturnsTo": "A; B reviews strategy conflicts",
      "mustStopAndAskUserWhen": [
        "strategy conflicts with readonly inventory or create/release contracts",
        "new SDK dependency or real cloud authorization is needed"
      ]
    },
    {
      "name": "official SDK wrapper",
      "owner": "A",
      "parallelizable": true,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/contracts/v22-tencent-readonly-inventory-boundary.md"
      ],
      "requiredSmoke": [
        "scripts/smoke-test-v22-tencent-readonly-inventory-official-sdk-wrapper.mjs"
      ],
      "successStatus": "official SDK wrapper shell merged with static smoke",
      "blockerReturnsTo": "A; B reviews raw SDK exposure",
      "mustStopAndAskUserWhen": [
        "dependency install is needed",
        "real SDK fetch or secret read is needed",
        "create/release mutation boundary changes"
      ]
    },
    {
      "name": "official SDK dependency loader",
      "owner": "A",
      "parallelizable": true,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/contracts/v22-tencent-readonly-inventory-boundary.md"
      ],
      "requiredSmoke": [
        "scripts/smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs"
      ],
      "successStatus": "dependency loader contract/smoke merged and fail-closed by default",
      "blockerReturnsTo": "A; B reviews package diff and default gate",
      "mustStopAndAskUserWhen": [
        "npm dependency or lockfile changes are needed",
        "live readonly execution is needed"
      ]
    },
    {
      "name": "check-config",
      "owner": "A",
      "parallelizable": true,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/contracts/v22-tencent-readonly-inventory-boundary.md",
        "docs/contracts/v22-cloud-onboarding-workflow-boundary.md"
      ],
      "requiredSmoke": [
        "scripts/smoke-test-v22-tencent-readonly-inventory-local-guard.mjs",
        "scripts/smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs"
      ],
      "successStatus": "check-config blocks missing gate, mutation API, read-all secret, and non-redacted output",
      "blockerReturnsTo": "A; B reviews gate",
      "mustStopAndAskUserWhen": [
        "check-config needs to read a real secret file",
        "check-config needs to call real cloud or modify deploy"
      ]
    },
    {
      "name": "default gate",
      "owner": "B",
      "parallelizable": false,
      "requiresIndependentWorktree": false,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/contracts/v22-tencent-readonly-inventory-boundary.md",
        "docs/contracts/v22-tencent-tc3-diagnostic-cleanup-plan.md"
      ],
      "requiredSmoke": [
        "scripts/smoke-test-v22-tencent-readonly-inventory-official-sdk-wrapper.mjs",
        "scripts/smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs",
        "scripts/smoke-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs"
      ],
      "successStatus": "default gate confirms official SDK wrapper path is default and all live paths are opt-in",
      "blockerReturnsTo": "B blocks; A fixes default gate or wrapper",
      "mustStopAndAskUserWhen": [
        "default behavior would read secret or call cloud",
        "default behavior would install dependency, push, merge, or change deploy"
      ]
    },
    {
      "name": "user-authorized readonly live",
      "owner": "user",
      "parallelizable": false,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": true,
      "realCloudAllowed": true,
      "requiredContracts": [
        "docs/contracts/v22-tencent-readonly-inventory-boundary.md",
        "docs/contracts/v22-production-cloud-topology-boundary.md"
      ],
      "requiredSmoke": [
        "scripts/smoke-test-v22-tencent-readonly-inventory-real-live-run.mjs",
        "scripts/smoke-test-v22-tencent-readonly-inventory-live-bridge.mjs",
        "check-config output"
      ],
      "successStatus": "redacted readonly inventory report generated outside git",
      "blockerReturnsTo": "user decides retry/stop; A fixes config-only blockers; B reviews safety blockers",
      "mustStopAndAskUserWhen": [
        "before reading readonly secret",
        "before real cloud call",
        "before changing region or API allowlist",
        "on permission, limit, or account mismatch",
        "before sharing report contents"
      ]
    },
    {
      "name": "readonly report review",
      "owner": "B",
      "parallelizable": false,
      "requiresIndependentWorktree": false,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/contracts/v22-tencent-readonly-inventory-boundary.md",
        "docs/contracts/v22-production-cloud-topology-boundary.md",
        "docs/contracts/v22-tenant-resource-binding-boundary.md"
      ],
      "requiredSmoke": [
        "scripts/smoke-test-v22-tencent-readonly-inventory-boundary.mjs",
        "report redaction checks"
      ],
      "successStatus": "B accepts report or returns blocker list",
      "blockerReturnsTo": "A for contract/code gaps; user for cloud/account/permission decisions; C for QA reproduction",
      "mustStopAndAskUserWhen": [
        "report shows unknown resources or missing tags",
        "report shows conflicting ownership, permission gaps, or cost anomaly",
        "another real cloud read is needed"
      ]
    },
    {
      "name": "TC3 cleanup gate",
      "owner": "B",
      "parallelizable": true,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/contracts/v22-tencent-tc3-diagnostic-cleanup-plan.md",
        "docs/contracts/v22-tencent-readonly-inventory-boundary.md"
      ],
      "requiredSmoke": [
        "scripts/smoke-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs"
      ],
      "successStatus": "TC3 cleanup branch may start; TC3 remains diagnostic/reference until cleanup proves removal",
      "blockerReturnsTo": "B blocks; A updates cleanup plan",
      "mustStopAndAskUserWhen": [
        "cleanup would delete TC3 before official SDK report review",
        "cleanup would change official SDK implementation or create/release"
      ]
    },
    {
      "name": "create/release dry-run plan",
      "owner": "A",
      "parallelizable": true,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/contracts/v22-tencent-dry-run-resource-plan-provider-boundary.md",
        "docs/contracts/v22-authorized-tencent-create-release-boundary.md",
        "docs/contracts/v22-production-cloud-topology-boundary.md"
      ],
      "requiredSmoke": [
        "scripts/smoke-test-v22-tencent-dry-run-resource-plan-provider.mjs",
        "scripts/smoke-test-v22-authorized-tencent-create-release-contract.mjs"
      ],
      "successStatus": "dry-run create/release plan produces no mutation and no charge",
      "blockerReturnsTo": "A fixes plan; B reviews mutation leakage",
      "mustStopAndAskUserWhen": [
        "dry-run plan wants to call real cloud or read mutation secret",
        "dry-run plan would alter ledger or expose cloud console language to ordinary users"
      ]
    },
    {
      "name": "mutation SDK wrapper",
      "owner": "A",
      "parallelizable": true,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/contracts/v22-authorized-tencent-create-release-implementation-boundary.md",
        "docs/contracts/v22-authorized-tencent-create-release-execution-boundary.md"
      ],
      "requiredSmoke": [
        "scripts/smoke-test-v22-authorized-tencent-create-release-implementation-contract.mjs",
        "scripts/smoke-test-v22-authorized-tencent-create-release-execution-contract.mjs"
      ],
      "successStatus": "mutation wrapper shell is gated, fake-only by default, and separate from readonly runner/secret",
      "blockerReturnsTo": "A fixes wrapper; B reviews side-effect boundary",
      "mustStopAndAskUserWhen": [
        "mutation secret or real API is needed",
        "SDK dependency change, build/push, kubectl, or deploy change is needed"
      ]
    },
    {
      "name": "minimal authorized create/release live",
      "owner": "user",
      "parallelizable": false,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": true,
      "realCloudAllowed": true,
      "requiredContracts": [
        "docs/contracts/v22-authorized-tencent-create-release-boundary.md",
        "docs/contracts/v22-authorized-tencent-create-release-implementation-boundary.md",
        "docs/contracts/v22-authorized-tencent-create-release-execution-boundary.md"
      ],
      "requiredSmoke": [
        "execution contract smoke",
        "preflight dry-run diff",
        "rollback/audit smoke"
      ],
      "successStatus": "minimal live operation completed, tagged, ledgered, audited, and rollback-ready",
      "blockerReturnsTo": "user decides stop/retry; A fixes implementation; B reviews evidence before further mutation",
      "mustStopAndAskUserWhen": [
        "before reading mutation secret",
        "before each real mutation",
        "on budget, ownership, or tag mismatch",
        "before retry or rollback with side effect",
        "before expanding scope"
      ]
    },
    {
      "name": "production deploy execution",
      "owner": "user",
      "parallelizable": false,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": true,
      "realCloudAllowed": true,
      "requiredContracts": [
        "docs/contracts/v22-production-cloud-topology-boundary.md",
        "deploy plan contract",
        "docs/contracts/v22-cloud-onboarding-workflow-boundary.md"
      ],
      "requiredSmoke": [
        "deploy plan smoke",
        "local build/deploy dry-run smoke",
        "workflow gate review"
      ],
      "successStatus": "deployment executed with versioned evidence and rollback plan",
      "blockerReturnsTo": "user decides stop/rollback; A fixes deploy plan; B reviews evidence; C runs QA",
      "mustStopAndAskUserWhen": [
        "before build",
        "before push",
        "before kubectl",
        "before changing deploy",
        "before reading kubeconfig or registry secret",
        "before rollback"
      ]
    },
    {
      "name": "Portal production integration",
      "owner": "A",
      "parallelizable": true,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/contracts/v22-portal-user-surface-boundary.md",
        "docs/contracts/v22-portal-admin-ops-surface-boundary.md",
        "docs/contracts/v22-portal-files-billing-trace-boundary.md",
        "docs/contracts/v22-cloud-onboarding-workflow-boundary.md"
      ],
      "requiredSmoke": [
        "portal payload contract smoke",
        "portal role surface smoke",
        "mobile usability smoke"
      ],
      "successStatus": "Portal consumes sanitized production projection without cloud console leakage",
      "blockerReturnsTo": "A fixes Portal/API; B reviews role boundary; C runs UI QA",
      "mustStopAndAskUserWhen": [
        "Portal would expose secret, internal storage, or cloud console language",
        "Portal would alter billing truth or require real cloud read"
      ]
    },
    {
      "name": "canary / QA / release status update",
      "owner": "C",
      "parallelizable": true,
      "requiresIndependentWorktree": true,
      "readsSecretAllowed": false,
      "realCloudAllowed": false,
      "requiredContracts": [
        "docs/contracts/v22-cloud-onboarding-workflow-boundary.md",
        "role surface contracts",
        "release/status docs"
      ],
      "requiredSmoke": [
        "canary/QA smoke",
        "scripts/smoke-test-v22-mvp-contract-suite.mjs",
        "workflow gate review"
      ],
      "successStatus": "C_PASS or B_BLOCKER with release status updated",
      "blockerReturnsTo": "C files repro; A fixes; B decides merge/release; user authorizes any further live action",
      "mustStopAndAskUserWhen": [
        "QA needs live credentials",
        "canary calls real service",
        "release status implies production readiness",
        "rollout expands blast radius"
      ]
    }
  ]
}
```
<!-- v22-cloud-onboarding-workflow-contract:end -->
