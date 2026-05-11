# v22 Authorized Tencent Deploy Execution Boundary

本合同定义 Package D: deploy and production integration 的执行边界。它只覆盖 TCR 镜像、push 版本、kubectl/deploy 和 runtime smoke；不覆盖 Package C 的存储 / 计算资源生命周期。

本合同只定义 TCR 镜像、push 版本、kubectl/deploy 和 runtime smoke 的授权边界。默认未授权路径不读取 deploy secret，不 build，不 push，不 kubectl，不调用真实云，不修改 deploy，不改变 TKE 或 COS 资源。

Package D 不授权 Package C 的资源生命周期动作。不创建、删除、释放或扩缩容 TKE node pool。不创建、删除、清空或扩容 COS bucket / prefix / object。任何需要开通、扩容、释放、删除计算或存储的动作必须回到 Package C，并重新取得当前会话授权。

## Positioning

Package D 的定位是“把一组已审查镜像版本接到指定运行面并证明它们在跑”，不是“管理云资源”。D 不是一个镜像包含所有服务；Portal、OPL Gateway、Runtime Bridge、上游 OPL、Langfuse 等必须按实际部署职责拆成多个 target 或外部 smoke surface。

可以做：

- TCR repository/tag preflight。
- multi-image build and push unique test tag。
- deploy dry-run。
- authorized deploy rollout。
- runtime smoke。
- rollback / stop condition 记录。
- final deploy evidence 写入 `.runtime` 脱敏报告。

不可以做：

- 不删除、关闭、扩缩容或创建任何未授权节点、节点池、namespace、storage、bucket、prefix 或 object。
- 不把 TCR、TKE、Kubernetes、namespace、workload、image digest、kubectl 暴露给普通用户。
- 不把 deploy secret、registry secret、kubeconfig、raw token、object key、signed URL 写入 stdout、docs、git、Portal payload 或 `.runtime`。
- 不绕过 dry-run、ownerRef、rollback evidence 或 B review。

## Package D Secret Allowlist

Package D 只能读取以下 key，且必须按 allowlist 精确读取，不允许 source env，不允许一读全读：

- `RUN_TENCENT_DEPLOY_EXECUTION`
- `TCR_ID`
- `TCR_SECRET`
- `TENCENT_TCR_REGISTRY`
- `TENCENT_TCR_NAMESPACE`
- `TENCENT_TCR_REGION`
- `TENCENT_DEPLOY_CLUSTER_ID`
- `TENCENT_DEPLOY_KUBECONFIG_REF`

`TENCENT_DEPLOY_KUBECONFIG_REF` 只能是后端 secret reference 或本机受控路径引用，不能把 raw kubeconfig 写入合同、日志、Portal payload、`.runtime` 或 git。

`TENCENT_TCR_REPOSITORY`、`TENCENT_DEPLOY_NAMESPACE`、`TENCENT_DEPLOY_WORKLOAD`、`TENCENT_DEPLOY_CONTAINER`、`TENCENT_DEPLOY_RUNTIME_SMOKE_URL` 不属于 secret allowlist。它们是 release plan 的 non-secret target 字段，必须逐 target 显式声明，不能用单值环境变量把多服务发布压成单容器发布。

## Release Plan

Package D 必须通过 `--release-plan <json>` 消费本地受控 release plan。release plan 可以放在 `.runtime` 或用户指定的本地路径，不进入 git，不包含 raw secret、raw kubeconfig、token、cookie、object key、signed URL 或 raw cloud response。

OPL / Portal / Gateway / Runtime Agent target ownership 必须同时订阅 [v22-opl-deployment-ownership-release-plan-boundary.md](./v22-opl-deployment-ownership-release-plan-boundary.md)。该 Level 4 子合同把 target 分为 `platform_service_target` 和 `workspace_runtime_target`：平台服务必须有 `ownerRef/operationId`，但不强制 `workspaceId/resourceBindingId`；workspace runtime target 必须额外绑定 `workspaceId/resourceBindingId`。只有 `k8s-app/qcloud-app`、deployment 名字、namespace、IP、创建时间或人工记忆时必须 fail-closed。

release plan 顶层字段：

- `runId`：本次发布 run id。
- `versionTag`：唯一版本 tag，禁止 `latest`。
- `namespace`：本次 release 允许 mutation 的单一 namespace；如各 target namespace 不一致，fail-closed。
- `targets[]`：要 build/push/deploy 的镜像目标。
- `runtimeSmokeTargets[]`：要访问的外部入口验证面。

每个 `targets[]` 必须包含：

- `component`：例如 `portal`、`opl-web-gateway`、`opl-runtime-bridge`、`opl-web-upstream`。
- `targetClass`：`platform_service_target` 或 `workspace_runtime_target`。
- `repository`：该 component 对应的 TCR repository。
- `dockerfile`、`buildContext`：repo-relative path，必须存在。
- `namespace`、`workload`、`container`：指定 Kubernetes Deployment/container。
- `ownerRef`、`operationId`，以及按 target class 需要的 `workspaceId`、`resourceBindingId`：owner guard 字段。
- `expectedVersionMarker`：该 target 被 runtime smoke 证明时应匹配的版本 marker 或 build id。

每个 `runtimeSmokeTargets[]` 必须包含：

- `surface`：`portal`、`opl`、`trace` 等外部验证面。
- `url`：授权访问的 endpoint，例如 `https://portal.medopl.cn/healthz`、`https://opl.medopl.cn/healthz`、`https://trace.medopl.cn/api/public/health`。
- `expectedVersionMarker`。
- `provesPushedVersion`：是否证明本次 pushed component 正在运行。
- `provesComponents[]`：该 endpoint 证明的 target component 列表。

`trace.medopl.cn` 是 Langfuse/admin trace surface；除非 release plan 明确包含已审查的 Langfuse image target、Dockerfile、workload 和 owner guard，否则它只能作为 runtime smoke surface，不得被默认建模成“本仓库 Langfuse 镜像 target”。换言之，trace surface 可验证观测入口可达，但不能替代 Portal/Gateway/Runtime Bridge pushed version marker。

## TCR Scope

只能操作指定 TCR registry / namespace，以及 release plan 中列出的 repositories。

允许的 registry 动作：

- `DescribeRepositories`
- `DescribeImages`
- `docker login`
- `docker build`
- `docker tag`
- `docker push`
- digest readback

约束：

- 只能 push 唯一 test tag。
- 禁止使用 `latest`。
- tag 必须包含 run id 或不可重复版本号。
- 必须记录 digest。
- 不得覆盖已有 tag。
- 不得删除 image、tag、repository 或 namespace。
- 不得写入 raw docker config、registry secret 或完整 registry credential。

## Kubernetes Deploy Scope

只能操作指定 TKE cluster。只能操作 release plan 中的单一 namespace。只能操作 release plan 中列出的 workload。只能更新 release plan 中列出的 container image。

允许的 kubectl 动作：

- `kubectl diff`
- server-side dry-run
- `kubectl apply`
- `kubectl rollout status`
- `kubectl get`
- `kubectl rollout undo`

必须先 `kubectl diff` 或 server-side dry-run，再执行 `kubectl apply`。执行后必须有 rollout status。失败或不确定时必须有 rollback evidence。

## Ownership Guard

Package D 的每个 deploy target 必须同时通过 Portal truth 和 Kubernetes metadata 归属校验。

必须校验：

- targetClass。
- ownerRef。
- operationId。
- workspaceId 和 resourceBindingId，若 targetClass 是 `workspace_runtime_target`。
- expected labels。
- 指定 cluster / namespace / workload / container。
- 目标 workload 当前 image 和回滚 image。

缺失、冲突或不一致时 fail-closed。不得靠名称、创建时间、IP、规格或人工记忆推断归属。不靠名称、创建时间、IP、规格或人工记忆推断归属。

这是防止误删、误停或误改别人节点和存储的硬边界。Package D 只能改“已确认属于本次 deploy operation 的指定 workload container image”，不能碰节点池容量、COS 文件空间或其他租户资源。

Implementation note: OPL deployment discovery.

This note does not loosen the current Package D contract. The discovery branch `docs/v22-package-d-opl-deploy-discovery` records that current OPL candidate deployments are visible as possible Portal/Gateway/Adapter/trace targets, but lack Package D owner guard labels for this purpose. `k8s-app/qcloud-app`, deployment name, namespace, IP, creation time, or manual memory cannot prove ownership.

Portal/Gateway/Adapter/trace may be platform service targets. A future OPL deployment ownership / release plan sub-contract may define a platform service target guard that uses platform-level `ownerRef` and `operationId` without forcing `workspaceId/resourceBindingId` on shared platform services. Workspace runtime targets still require workspaceId/resourceBindingId because they represent tenant-scoped runtime capacity.

The repo-tracked OPL deployment ownership / release plan sub-contract is [v22-opl-deployment-ownership-release-plan-boundary.md](./v22-opl-deployment-ownership-release-plan-boundary.md). It explicitly classifies every target as `platform_service_target` or `workspace_runtime_target`, defines which owner guard fields are mandatory for each class, and keeps fail-closed behavior when Portal truth or Kubernetes metadata is missing or conflicting. Package D real rollout remains blocked until a reviewed release plan, real target metadata, dry-run evidence, rollback evidence and explicit authorization are present.

## Forbidden Side Effects

明确禁止：

- 禁止 `kubectl delete`。
- 禁止 `DeleteNodePool`。
- 禁止 `CreateNodePool`。
- 禁止 `ScaleNodePool`。
- 禁止 `ModifyNodePoolDesiredCapacityAboutAsg`。
- 禁止删除 bucket。
- 禁止删除 prefix。
- 禁止删除对象。
- 禁止清空 bucket。
- 禁止跨 namespace。
- 禁止 cluster-wide mutation。
- 禁止修改 Secret。
- 禁止修改 CRD。
- 禁止修改 Ingress。
- 禁止修改 Service、PVC、PV、StorageClass、ClusterRole、ClusterRoleBinding。
- 禁止删除或关闭别人的节点和存储。

如果 deploy 需要上述任一动作，Package D 必须停止，并回到合同审阅与用户授权。

## Runtime Smoke

runtime smoke 必须命中 release plan 中的已授权 endpoint，必须证明 pushed version 正在运行，不能只证明镜像存在。

runtime smoke evidence 至少包含：

- smoke run id。
- deployed tag。
- digest。
- sanitized endpoint ref。
- version marker 或 build id。
- rollout status summary。
- rollback evidence ref。
- runtime smoke surface 到 target component 的覆盖关系。

不得输出 raw token、kubeconfig、registry secret、object key、signed URL、raw response、Authorization header 或 cookie。

## Portal Projection

普通用户不展示 TCR、TKE、Kubernetes、namespace、workload、image digest、kubectl。Portal 只能展示工作台版本、运行状态、更新时间和审计状态。

管理员/运维也只能看到脱敏 registry/deploy/runtime evidence，不得看到 raw secret、raw kubeconfig、registry credential、raw cloud response、object key 或 signed URL。

## Closed Loop

Package D 的闭环链路：

1. R-14 TCR repository/tag preflight：按 release plan targets 确认 registry、repositories、docker login、tag/digest readback 可用。
2. R-15 multi-image build and push unique test tag：逐 target build、tag、push 唯一 test tag，逐 target 读回 digest。
3. R-16 deploy dry-run：逐 target 对指定 namespace/workload/container 生成 diff 或 server-side dry-run evidence。
4. R-17 authorized deploy rollout：用户确认 dry-run 后逐 target apply，等待 rollout status；失败时停止并记录 rollback evidence。
5. R-18 runtime smoke：命中 `portal.medopl.cn`、`opl.medopl.cn`、`trace.medopl.cn` 等 release plan 授权 endpoint，证明 pushed components 正在运行，并确认 trace surface 可访问。

产物路径：

- `.runtime/v22-registry/<run-id>.json`
- `.runtime/v22-cloud-deploy/<run-id>.json`
- `.runtime/v22-runtime-smoke/<run-id>.json`

执行入口：

- `scripts/v22-tencent-authorized-deploy-execution-runner.mjs`
- `scripts/smoke-test-v22-opl-deployment-ownership-release-plan-contract.mjs`
- `scripts/smoke-test-v22-tencent-authorized-deploy-execution-runner.mjs`
- `scripts/smoke-test-v22-tencent-authorized-deploy-execution-live-gate.mjs`

runner 必须显式传入 non-secret execution parameter：`--release-plan <json>`。release plan 缺 `runId`、`versionTag`、`targets[]`、`runtimeSmokeTargets[]`、任一 owner guard 字段、任一 target repository/build/deploy 字段或任一 smoke surface 覆盖关系都必须 fail-closed。`--provider-mode real` 才允许真实 `docker` / `kubectl`；默认和 smoke 只能走 `config-only` 或 `fake-live`。

只有 R-14..R-18 都通过，且 evidence 脱敏、rollback evidence 存在、没有越权 mutation，才能说 Package D 验证通过。

## Non-Goals

- 不读取 deploy secret now。
- 不运行 build/push/kubectl now。
- 不修改 TKE node pool。
- 不修改 COS storage。
- 不运行 live-test。
- 不修改 deploy / `.sentrux` / adapters / upstream。
- 不 merge，不 push。

## Contract Data

<!-- v22-authorized-tencent-deploy-execution-contract:start -->
```json
{
  "contract": "v22_authorized_tencent_deploy_execution_boundary",
  "version": 1,
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
    "targetRequiredFields": [
      "component",
      "repository",
      "dockerfile",
      "buildContext",
      "namespace",
      "workload",
      "container",
      "targetClass",
      "ownerRef",
      "operationId",
      "expectedVersionMarker"
    ],
    "targetClasses": {
      "platform_service_target": {
        "requiresWorkspaceBinding": false,
        "requiredOwnerGuard": ["ownerRef", "operationId"]
      },
      "workspace_runtime_target": {
        "requiresWorkspaceBinding": true,
        "requiredOwnerGuard": ["ownerRef", "operationId", "workspaceId", "resourceBindingId"]
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
  "allowedRegistryActions": [
    "DescribeRepositories",
    "DescribeImages",
    "docker login",
    "docker build",
    "docker tag",
    "docker push",
    "digest readback"
  ],
  "allowedKubectlActions": [
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
    "modifyIngress",
    "modifyService",
    "modifyPVC",
    "modifyPV",
    "modifyStorageClass",
    "modifyClusterRole",
    "modifyClusterRoleBinding"
  ],
  "ownershipGuard": {
    "requiresOwnerRef": true,
    "requiredLabels": [
      "workspaceId",
      "resourceBindingId",
      "operationId"
    ],
    "scope": [
      "cluster",
      "namespace",
      "workload",
      "container"
    ],
    "failClosedOnMissingOrConflictingOwner": true,
    "forbidsInferenceByNameTimeIpSpecOrMemory": true
  },
  "runner": {
    "entrypoint": "scripts/v22-tencent-authorized-deploy-execution-runner.mjs",
    "smoke": "scripts/smoke-test-v22-tencent-authorized-deploy-execution-runner.mjs",
    "liveGateSmoke": "scripts/smoke-test-v22-tencent-authorized-deploy-execution-live-gate.mjs",
    "requiresExplicitNonSecretExecutionParameters": [
      "releasePlan"
    ],
    "defaultProviderMode": "config-only",
    "realProviderMode": "real"
  },
  "artifactRoots": [
    ".runtime/v22-registry/",
    ".runtime/v22-cloud-deploy/",
    ".runtime/v22-runtime-smoke/"
  ],
  "ordinaryUserProjection": [
    "工作台版本",
    "运行状态",
    "更新时间",
    "审计状态"
  ]
}
```
<!-- v22-authorized-tencent-deploy-execution-contract:end -->
