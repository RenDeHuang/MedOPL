# v22 Cloud Onboarding Workflow Boundary

本合同定义 v22 接云上线的 repo-tracked workflow 合同，把旧 cloud onboarding 阶段、当前 Package C/D 边界和生产 Portal 点击闭环验收路径写成同一个可审计状态机。

本合同不替代 AGENTS.md。AGENTS.md 管 A/B/C/D 纪律、授权红线、协作规则和禁止路径；本合同管业务推进顺序、阶段依赖、验收状态和 blocker 回流。后续 cloud onboarding 不得只依赖聊天记忆推进，必须以 repo-tracked workflow 合同、合同索引、status/execution board 和 smoke 为准。

旧 `CO-01..CO-14` 只保留为历史阶段和证据索引，不再作为当前验收主线。当前 cloud-lane 执行入口是 `docs/recovery/v22-cloud-harness-manifest.json` 中的 L1 -> L2a -> L2b -> L3 -> L4 串联验收；该 manifest 不是新大合同，而是本合同的 harness-native 执行路由层。

当前分支允许修改旧 cloud 合同、recovery 状态、selector/check smoke 和 Portal cloud operation 控制面；读取 secret、调用真实云、build/push、kubectl、live-test 仍只能发生在本地 gate 通过后的 L1-L4 授权验收步骤中。

## 2026-05 Framework Mapping

本合同采用 2026-05 的三层工程框架：

- Microsoft Azure Architecture Center 的 Async Request-Reply pattern：Portal HTTP API 只接收请求、写入 operation/outbox，并返回 `202 Accepted + operationId/status endpoint`；长耗时真实云开通不得阻塞 Portal 请求。
- Kubernetes controller pattern：独立 worker/controller 持续把 canonical store 的 desired state 推进到 cloud current state；每次恢复先 cleanup/reconcile，再执行新 mutation。
- OpenAI Harness Engineering / Codex App Server：repo 内合同、manifest、selector、smoke、evidence 和 handoff 是系统事实；不能靠聊天记忆判断要跑哪些 gate 或是否完成。

## Current Production Acceptance Path

当前生产验收只认以下 L-level，不再把单个 CO 阶段或单次 canary 当作完成态：

| level | gate | purpose | pass condition |
| --- | --- | --- | --- |
| L1 | production env/secret/schema gate | 证明生产 Portal/worker 所需 env、secret reference、PostgreSQL schema 和 route 注册形状存在 | 不读 secret 内容、不打云；只证明引用、schema 和 fail-closed 行为 |
| L2a | direct Package C lifecycle canary | 直接用 Package C runner 验证 storage/compute create/expand/release/delete | 先 dry-run，后执行，最后清理回 baseline |
| L2b | Portal click -> queued -> worker -> projection | 证明用户点击套餐只入队，独立 worker drain，projection 只读 canonical store | Portal 返回 202；worker 带 lease；普通用户不见云控制台语言 |
| L3 | billing/reconciliation/cleanup | 证明冻结金额、释放停止计费、120min 对账、T+1 状态和 cleanup evidence | 没有 queued/running orphan operation；compute released；storage 删除或保护期可审计 |
| L4 | ordinary user product lifecycle | 证明普通用户可开通、上传文件、升级、删除并看到产品态 | 用户只看到工作台资源、计算资源、文件空间、套餐、余额、冻结金额和审计状态 |

Live 验收成本控制是硬 gate：测试前 node pool desired/current baseline 必须是 `2`；测试后必须回到 `2`，并且本次创建的 compute allocation 已 release，本次创建的 storage marker 已删除或进入合同允许的保护期。禁止把平台服务池删到 0，禁止 `kubectl delete`，禁止删除 node pool 或 bucket。

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

## Cloud Authorization Dual Gates

Cloud 路径必须同时满足双门禁：

- Gate-A（人/流程授权门）：用户在当前会话显式授权目标范围（secret allowlist、API allowlist、region、预算、回滚边界、证据路径）。
- Gate-B（执行门）：runner / allowlist / mode 满足本合同与对应子合同约束，并且默认 fail-closed。

任一门禁未通过时必须保持 `realCloudCalls=false`。

`realCloudCalls` 只能由执行证据正向推出（授权记录 + runner 执行记录 + 脱敏 evidence）；不得由 `runnerMode`、资源物化状态或推测结果反推。

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
- required smoke: `smoke-test-v22-tencent-readonly-inventory-bridge-local-gate.mjs`, check-config output；真实 readonly inventory live runner 已退出 active repo executable surface，后续真实云 readonly 必须重新开 future-authorized boundary。
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
- required contracts: `v22-production-cloud-topology-boundary.md`, `v22-authorized-tencent-deploy-execution-boundary.md`, `v22-cloud-onboarding-workflow-boundary.md`
- required smoke: deploy plan smoke, local build/deploy dry-run smoke, workflow gate review
- success status: deployment executed with versioned evidence and rollback plan
- blocker 回流到谁: user decides stop/rollback; A fixes deploy plan; B reviews evidence; C runs QA
- 什么时候必须停下来问用户: before build, before push, before kubectl, before changing deploy, before reading kubeconfig/registry secret, before rollback

Package D production deploy execution 必须订阅 `v22-authorized-tencent-deploy-execution-boundary.md`。Package D release plan 是唯一允许的 deploy 输入形状：它显式列出 portal.medopl.cn、opl.medopl.cn、trace.medopl.cn runtime smoke surfaces，并逐 target 绑定 repository、imageTargetRef、sourceRoot、namespace、workload、container、targetClass、ownerRef、operationId 和 expectedVersionMarker。平台服务 target 使用 `platform_service_target`，只强制 `ownerRef/operationId`；workspace runtime target 使用 `workspace_runtime_target`，必须额外绑定 `workspaceId/resourceBindingId`。zero-compat active repo 不保留默认 Dockerfile / deploy asset；真实 build recipe 需未来单独授权。

Package D 不授权 Package C 的资源生命周期动作：不得创建、删除、释放或扩缩容 TKE node pool，不得创建、删除、清空或扩容 COS bucket / prefix / object。Package D 禁止 `kubectl delete`，禁止 `DeleteNodePool`，禁止 `CreateNodePool`、`ScaleNodePool`、`ModifyNodePoolDesiredCapacityAboutAsg`，禁止删除 bucket/prefix/object，禁止跨 namespace 或 cluster-wide mutation。

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

#### Portal API test-only local-executor bridge

在 Portal production integration 之前，允许存在一个本地 smoke 专用的 test-only local-executor bridge，用来验证 Portal API、PostgreSQL canonical shape、Package C local-executor operation 状态回写和普通用户 projection 的闭环。

测试路径：

- `POST /portal/api/v22/cloud-operations/test/local`
- `GET /portal/api/v22/cloud-operations/test/projection?workspaceId=<workspace-id>`

边界：

- 该 API 只能用于本地 smoke 和合同验证，必须返回 `testOnly=true`、`productionPortalConnected=false`、`runnerMode=local-executor`、`realCloudCalls=false`。
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

## Future Authorized Cloud Connection Path

当前接云模块只把 R-00 到 R-21 记录为 future authorized / cloud-lane candidate 闭环验证路径；它不是默认可运行路径。旧 `CO-01..CO-14` 只保留为历史阶段和状态说明，不再作为新验收主线。`C00`、`C01`、`C02`、`C03`、`C04` 也不得作为当前 gate id、task packet id 或完成状态使用。

| step | gate | authorization package | entrypoint | artifact path | pass condition |
| --- | --- | --- | --- | --- | --- |
| R-00 local contract guard | CC-01 | none | repo root | stdout JSON only | 合同、board、status、workflow task packet 口径一致 |
| R-01 SDK dependency install | CC-01 | dependency_install | `services/portal` | `services/portal/package.json`; `services/portal/package-lock.json` | 只增加经审查 SDK dependency diff |
| R-02 SDK shape smoke | CC-01 | dependency_install | repo root | stdout JSON only | Tencent SDK 和 COS SDK shape 被证明或 fail-closed |
| R-03 readonly preflight | CC-02 | readonly_connection | repo root | stdout JSON only | RUN gate、readonly secret allowlist、region/API allowlist 和 redaction 规则通过 |
| R-04 readonly live report | CC-02 | readonly_connection | repo root | `.runtime/v22-tencent-readonly-inventory/<authorized-run-id>.json` | 脱敏 report 证明账号、region、TKE、COS、billing、tag/cost allocation 可读 |
| R-05 Portal canonical operation smoke | CC-03 | local_contract_smoke | repo root | stdout JSON only | Portal click/test API 写入 canonical operation、binding、file space、compute、ledger、audit 形状 |
| R-06 storage dry-run | CC-04 | authorized_resource_lifecycle | repo root | `.runtime/v22-cloud-lifecycle/<operation-id>-storage-dry-run.json` | dry-run 写明 workspace、file space、COS scope、预算和 rollback/retention policy，且不 mutation |
| R-07 authorized storage execution | CC-04 | authorized_resource_lifecycle | repo root | `.runtime/v22-cloud-lifecycle/<operation-id>-storage-execution.json` | 授权后执行最小 storage create/expand/delete，并回写 Portal/audit |
| R-08 compute dry-run | CC-05 | authorized_resource_lifecycle | repo root | `.runtime/v22-cloud-lifecycle/<operation-id>-compute-dry-run.json` | dry-run 写明已有 TKE cluster、namespace/quota/workload class/node pool capacity，且不 mutation |
| R-09 authorized compute execution | CC-05 | authorized_resource_lifecycle | repo root | `.runtime/v22-cloud-lifecycle/<operation-id>-compute-execution.json` | 授权后执行最小 compute create/expand/release，并保持 file space retained |
| R-10 Portal projection smoke | CC-03 | local_contract_smoke | repo root | stdout JSON only | 普通用户 projection 只展示工作台/计算/文件空间/账单状态，不展示云控制台对象 |
| R-11 expand storage dry-run and execution | CC-04 | authorized_resource_lifecycle | repo root | `.runtime/v22-cloud-lifecycle/<operation-id>-storage-expand.json` | 文件空间 entitlement、费用冻结估算和 audit event 更新 |
| R-12 expand compute dry-run and execution | CC-05 | authorized_resource_lifecycle | repo root | `.runtime/v22-cloud-lifecycle/<operation-id>-compute-expand.json` | namespace quota、workload class 或 node pool capacity 更新，Portal projection 同步 |
| R-13 COS billing checkpoint | CC-06 | readonly_connection | repo root | `.runtime/v22-cloud-reconciliation/<run-id>.json` | billing summary、COS usage、Portal ledger、cloud tag/cost allocation 可对账或产出 blocker |
| R-14 TCR repository/tag preflight | CC-07 | deploy_and_production_integration | repo root | `.runtime/v22-registry/<run-id>.json` | release plan 内每个 target repository/tag/digest 预检通过，禁止 `latest` |
| R-15 multi-image build and push unique test tag | CC-07 | deploy_and_production_integration | repo root | `.runtime/v22-registry/<run-id>.json` | 每个 target image push 唯一 test tag，并读回 digest |
| R-16 deploy dry-run | CC-07 | deploy_and_production_integration | repo root | `.runtime/v22-cloud-deploy/<run-id>.json` | dry-run 限定在 release plan 指定 namespace/workload/container，并有 rollback target |
| R-17 authorized deploy rollout | CC-07 | deploy_and_production_integration | repo root | `.runtime/v22-cloud-deploy/<run-id>.json` | 授权后 rollout 成功或 rollback evidence 完整 |
| R-18 runtime smoke | CC-07 | deploy_and_production_integration | repo root | `.runtime/v22-runtime-smoke/<run-id>.json` | `portal.medopl.cn`、`opl.medopl.cn`、`trace.medopl.cn` 证明推送版本运行且无 secret 泄漏 |
| R-19 release compute | CC-05 | authorized_resource_lifecycle | repo root | `.runtime/v22-cloud-lifecycle/<operation-id>-compute-release.json` | compute allocation 释放、计算计费停止、file space 保留 |
| R-20 delete file space | CC-04 | authorized_resource_lifecycle | repo root | `.runtime/v22-cloud-lifecycle/<operation-id>-storage-delete.json` | file space 进入 7 天保护期或有审计永久清理记录 |
| R-21 final reconciliation cleanup and B review | CC-REVIEW | manual_b_review | repo root | `.runtime/v22-cloud-cleanup/<run-id>.json` | billing、COS、TKE、TCR、deploy、runtime smoke、cleanup evidence 被 B 接受或返回 blocker |

任何 R-step 都不得把 raw provider response、SecretId、SecretKey、token、kubeconfig、object key、signed URL 或 COS object body 写入 stdout、`.runtime`、docs、git 或 Portal payload。

## Workflow Non-Goals

本 workflow 不自动 merge、不自动 push、不读 secret、不调用真实云；只能生成任务包、可跑路径和下一步建议。

本分支只允许 `scripts/v22-agent-workflow.mjs cloud-onboarding status --json` 输出 future authorized task packet 形状；这些 task packet 默认 blocked，不新增真实云执行能力、不读 secret、不执行 build/push/kubectl。

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
  "installsDependencyNow": false,
  "executesMutationNow": false,
  "runsBuildPushKubectlNow": false,
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
  "loopName": "cloud_harness_native_async_lifecycle_loop",
  "harnessManifest": "docs/recovery/v22-cloud-harness-manifest.json",
  "productionAcceptanceLevels": [
    "L1",
    "L2a",
    "L2b",
    "L3",
    "L4"
  ],
  "liveBaselineDesiredCapacity": 2,
  "cleanupRequiredForLiveRuns": true,
  "generatesOnlyTaskPackagesAndNextStepSuggestions": true,
  "scriptLaneType": "cloud-onboarding",
  "implementsScriptLogicNow": true,
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
  "authorizationPackages": [
    "dependency_install",
    "readonly_connection",
    "authorized_resource_lifecycle",
    "deploy_and_production_integration"
  ],
  "futureAuthorizedPath": [
    { "step": "R-00", "gateId": "CC-01", "authorizationPackage": "none", "entrypoint": "repo root", "artifactPath": "stdout JSON only", "blockerWriteback": "docs/recovery/cloud-onboarding-status-table.md" },
    { "step": "R-01", "gateId": "CC-01", "authorizationPackage": "dependency_install", "entrypoint": "services/portal", "artifactPath": "services/portal/package.json and services/portal/package-lock.json", "blockerWriteback": "docs/recovery/cloud-onboarding-status-table.md" },
    { "step": "R-02", "gateId": "CC-01", "authorizationPackage": "dependency_install", "entrypoint": "repo root", "artifactPath": "stdout JSON only", "blockerWriteback": "docs/recovery/cloud-onboarding-verification-matrix.md" },
    { "step": "R-03", "gateId": "CC-02", "authorizationPackage": "readonly_connection", "entrypoint": "repo root", "artifactPath": "stdout JSON only", "blockerWriteback": "docs/recovery/cloud-onboarding-status-table.md" },
    { "step": "R-04", "gateId": "CC-02", "authorizationPackage": "readonly_connection", "entrypoint": "repo root", "artifactPath": ".runtime/v22-tencent-readonly-inventory/<authorized-run-id>.json", "blockerWriteback": "docs/recovery/cloud-onboarding-execution-board.md" },
    { "step": "R-05", "gateId": "CC-03", "authorizationPackage": "local_contract_smoke", "entrypoint": "repo root", "artifactPath": "stdout JSON only", "blockerWriteback": "docs/contracts/v22-authorized-tencent-create-release-boundary.md" },
    { "step": "R-06", "gateId": "CC-04", "authorizationPackage": "authorized_resource_lifecycle", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-lifecycle/<operation-id>-storage-dry-run.json", "blockerWriteback": "docs/recovery/cloud-onboarding-status-table.md" },
    { "step": "R-07", "gateId": "CC-04", "authorizationPackage": "authorized_resource_lifecycle", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-lifecycle/<operation-id>-storage-execution.json", "blockerWriteback": "cloud operation row and docs/recovery/cloud-onboarding-execution-board.md" },
    { "step": "R-08", "gateId": "CC-05", "authorizationPackage": "authorized_resource_lifecycle", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-lifecycle/<operation-id>-compute-dry-run.json", "blockerWriteback": "docs/recovery/cloud-onboarding-status-table.md" },
    { "step": "R-09", "gateId": "CC-05", "authorizationPackage": "authorized_resource_lifecycle", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-lifecycle/<operation-id>-compute-execution.json", "blockerWriteback": "cloud operation row and CC-05 status" },
    { "step": "R-10", "gateId": "CC-03", "authorizationPackage": "local_contract_smoke", "entrypoint": "repo root", "artifactPath": "stdout JSON only", "blockerWriteback": "docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md and CC-03 blocker" },
    { "step": "R-11", "gateId": "CC-04", "authorizationPackage": "authorized_resource_lifecycle", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-lifecycle/<operation-id>-storage-expand.json", "blockerWriteback": "cloud operation row and CC-04 status" },
    { "step": "R-12", "gateId": "CC-05", "authorizationPackage": "authorized_resource_lifecycle", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-lifecycle/<operation-id>-compute-expand.json", "blockerWriteback": "cloud operation row and CC-05 status" },
    { "step": "R-13", "gateId": "CC-06", "authorizationPackage": "readonly_connection", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-reconciliation/<run-id>.json", "blockerWriteback": "billing_reconciliation record and CC-06 blocker" },
    { "step": "R-14", "gateId": "CC-07", "authorizationPackage": "deploy_and_production_integration", "entrypoint": "repo root", "artifactPath": ".runtime/v22-registry/<run-id>.json", "blockerWriteback": "CC-07 blocker and registry preflight evidence" },
    { "step": "R-15", "gateId": "CC-07", "authorizationPackage": "deploy_and_production_integration", "entrypoint": "repo root", "artifactPath": ".runtime/v22-registry/<run-id>.json", "blockerWriteback": "CC-07 blocker and registry evidence" },
    { "step": "R-16", "gateId": "CC-07", "authorizationPackage": "deploy_and_production_integration", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-deploy/<run-id>.json", "blockerWriteback": "CC-07 blocker and deploy dry-run evidence" },
    { "step": "R-17", "gateId": "CC-07", "authorizationPackage": "deploy_and_production_integration", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-deploy/<run-id>.json", "blockerWriteback": "CC-07 blocker and rollout evidence" },
    { "step": "R-18", "gateId": "CC-07", "authorizationPackage": "deploy_and_production_integration", "entrypoint": "repo root", "artifactPath": ".runtime/v22-runtime-smoke/<run-id>.json", "blockerWriteback": "CC-07 blocker and runtime smoke evidence" },
    { "step": "R-19", "gateId": "CC-05", "authorizationPackage": "authorized_resource_lifecycle", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-lifecycle/<operation-id>-compute-release.json", "blockerWriteback": "cloud operation row and CC-05 status" },
    { "step": "R-20", "gateId": "CC-04", "authorizationPackage": "authorized_resource_lifecycle", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-lifecycle/<operation-id>-storage-delete.json", "blockerWriteback": "cloud operation row and CC-04 status" },
    { "step": "R-21", "gateId": "CC-REVIEW", "authorizationPackage": "manual_b_review", "entrypoint": "repo root", "artifactPath": ".runtime/v22-cloud-cleanup/<run-id>.json", "blockerWriteback": "B review note" }
  ],
  "portalApiTestBridge": {
    "testOnly": true,
    "productionPortalConnected": false,
    "runnerMode": "local-executor",
    "realCloudCalls": false,
    "readsSecretNow": false,
    "defaultRouteEnabled": false,
    "enableEnv": "PORTAL_ENABLE_CLOUD_OPERATION_TEST_BRIDGE",
    "requiresEnableEnvValue": "1",
    "forbidsProductionRouteRegistration": true,
    "apiPaths": [
      "POST /portal/api/v22/cloud-operations/test/local",
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
  "packageD": {
    "contract": "docs/contracts/v22-authorized-tencent-deploy-execution-boundary.md",
    "authorizationPackage": "deploy_and_production_integration",
    "readsDeploySecretNow": false,
    "runsBuildPushKubectlNow": false,
    "modifiesTkeNodePool": false,
    "modifiesCosStorage": false,
    "forbidsLatestTag": true,
    "requiresUniqueTag": true,
    "requiresDigestVerification": true,
    "requiresDeployDryRunBeforeApply": true,
    "requiresRuntimeSmokeForPushedVersion": true,
    "requiresRollbackEvidence": true,
    "runnableSteps": [
      "R-14",
      "R-15",
      "R-16",
      "R-17",
      "R-18"
    ],
    "secretAllowlist": [
      "RUN_TENCENT_DEPLOY_EXECUTION",
      "TCR_ID",
      "TCR_SECRET",
      "TENCENT_TCR_REGISTRY",
      "TENCENT_TCR_NAMESPACE",
      "TENCENT_TCR_REGION",
      "TENCENT_DEPLOY_CLUSTER_ID",
      "TENCENT_DEPLOY_KUBECONFIG_REF"
    ],
    "releasePlan": {
      "required": true,
      "singleNamespaceOnly": true,
      "requiresMultipleTargets": true,
      "forbidsSingleImageAllInOneAssumption": true,
      "targetClasses": {
        "platform_service_target": {
          "requiresWorkspaceBinding": false,
          "requiredOwnerGuard": [
            "ownerRef",
            "operationId"
          ]
        },
        "workspace_runtime_target": {
          "requiresWorkspaceBinding": true,
          "requiredOwnerGuard": [
            "ownerRef",
            "operationId",
            "workspaceId",
            "resourceBindingId"
          ]
        }
      },
      "runtimeSmokeTargetsRequired": [
        "portal",
        "opl",
        "trace"
      ],
      "defaultRuntimeSmokeUrls": {
        "portal": "https://portal.medopl.cn/healthz",
        "opl": "https://opl.medopl.cn/healthz",
        "trace": "https://trace.medopl.cn/api/public/health"
      },
      "traceSurfaceIsNotImplicitImageTarget": true
    },
    "allowedAfterCurrentSessionExplicitAuthorizationKubectlActions": [
      "kubectl diff",
      "kubectl server-side dry-run",
      "kubectl apply",
      "kubectl rollout status",
      "kubectl get",
      "kubectl rollout undo"
    ],
    "forbiddenActions": [
      "kubectl delete",
      "DeleteNodePool",
      "CreateNodePool",
      "ScaleNodePool",
      "ModifyNodePoolDesiredCapacityAboutAsg",
      "deleteBucket",
      "deletePrefix",
      "deleteObject",
      "emptyBucket",
      "crossNamespaceMutation",
      "clusterWideMutation",
      "modifySecret",
      "modifyCRD",
      "modifyIngress"
    ]
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
        "tests/future-authorized/cloud/smoke-test-v22-tencent-official-sdk-provider-strategy-contract.mjs"
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
        "tests/future-authorized/cloud/smoke-test-v22-tencent-readonly-inventory-official-sdk-wrapper.mjs"
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
        "tests/future-authorized/cloud/smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs"
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
        "tests/future-authorized/cloud/smoke-test-v22-tencent-readonly-inventory-local-guard.mjs",
        "tests/future-authorized/cloud/smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs"
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
        "tests/future-authorized/cloud/smoke-test-v22-tencent-readonly-inventory-official-sdk-wrapper.mjs",
        "tests/future-authorized/cloud/smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs",
        "tests/future-authorized/cloud/smoke-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs"
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
        "tests/future-authorized/cloud/smoke-test-v22-tencent-readonly-inventory-bridge-local-gate.mjs",
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
        "tests/future-authorized/cloud/smoke-test-v22-tencent-readonly-inventory-boundary.mjs",
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
        "tests/future-authorized/cloud/smoke-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs"
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
        "tests/future-authorized/cloud/smoke-test-v22-tencent-dry-run-resource-plan-provider.mjs",
        "tests/future-authorized/cloud/smoke-test-v22-authorized-tencent-create-release-contract.mjs"
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
        "tests/future-authorized/cloud/smoke-test-v22-authorized-tencent-create-release-implementation-contract.mjs",
        "tests/future-authorized/cloud/smoke-test-v22-authorized-tencent-create-release-execution-contract.mjs"
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
        "tests/contract/smoke-test-v22-mvp-contract-suite.mjs",
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
