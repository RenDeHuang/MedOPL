# v22 OPL Deployment Ownership Release Plan Boundary

本合同定义 Package D 下的 OPL deployment ownership / release plan 子边界。它只回答一件事：

```text
Package D 在 build/push/kubectl 之前，如何证明 release plan 中每个 Portal / Gateway / Runtime Bridge / Runtime Agent target 属于本次发布，且允许被本次发布更新。
```

本合同不授权 build/push/kubectl；does not authorize build/push/kubectl。不读取 secret，不调用真实云，不修改 deploy，不修改 upstream，不创建/删除/扩缩容 TKE node pool，不创建/删除 COS storage。

## Contract Level

- Level 1: [v22-mvp-managed-opl-loop.md](./v22-mvp-managed-opl-loop.md)。MedOPL 托管 OPL SaaS 主合同。
- Level 2: [v22-cloud-onboarding-workflow-boundary.md](./v22-cloud-onboarding-workflow-boundary.md) 和 [v22-authorized-tencent-deploy-execution-boundary.md](./v22-authorized-tencent-deploy-execution-boundary.md)。Cloud onboarding 与 Package D deploy 执行边界。
- Level 3: [v22-real-opl-file-run-artifact-canary-boundary.md](./v22-real-opl-file-run-artifact-canary-boundary.md)。OPL lane 产出 Runtime Agent / run / artifact projection 和 `resourceBindingId/workspace runtime identity`。
- Level 4: 本合同。Package D release plan ownership 子合同，用来连接 OPL lane 的运行身份与 Package D 的 deploy target owner guard。

本合同是 Package D 的执行子合同，不替代 Package D 合同，不放宽 Package D 的 fail-closed 边界。

## Subscription Package

本合同订阅：

- [v22-mvp-managed-opl-loop.md](./v22-mvp-managed-opl-loop.md)
- [v22-cloud-onboarding-workflow-boundary.md](./v22-cloud-onboarding-workflow-boundary.md)
- [v22-authorized-tencent-deploy-execution-boundary.md](./v22-authorized-tencent-deploy-execution-boundary.md)
- [v22-production-cloud-topology-boundary.md](./v22-production-cloud-topology-boundary.md)
- [v22-portal-opl-context-backflow-boundary.md](./v22-portal-opl-context-backflow-boundary.md)
- [v22-real-opl-file-run-artifact-canary-boundary.md](./v22-real-opl-file-run-artifact-canary-boundary.md)
- [v22-runtime-bridge-session-run-file-provider-keyref-boundary.md](./v22-runtime-bridge-session-run-file-provider-keyref-boundary.md)
- [../recovery/cloud-onboarding-execution-board.md](../recovery/cloud-onboarding-execution-board.md)
- [../recovery/cloud-onboarding-status-table.md](../recovery/cloud-onboarding-status-table.md)
- [../recovery/cloud-onboarding-verification-matrix.md](../recovery/cloud-onboarding-verification-matrix.md)
- [../recovery/status-matrix.md](../recovery/status-matrix.md)

## Product Truth

MedOPL 是 `platform-provisioned / customer-dedicated` 的 OPL SaaS 托管科研工作台，不是云资源控制台。普通用户不看 TCR、TKE、Kubernetes、namespace、workload、container、image digest 或 kubectl。

OPL lane only provides `resourceBindingId/workspace runtime identity`、`billingMetadataRef`、`usageMetadataRef`、run/artifact projection 和 Runtime Agent endpoint binding status。OPL lane 不提供 `ownerRef`、`operationId` 或 K8s labels，不决定 namespace、workload、container、rollout、digest verify、owner labels 或 rollback evidence。这些属于 Package D / deploy lane。

## Target Classes

Package D release plan 必须给每个 target 显式声明 `targetClass`。

### `platform_service_target`

适用：

- Portal API / Portal frontend delivery image。
- OPL Web Gateway。
- Runtime Bridge / shared Runtime Bridge。
- Portal/Gateway/Runtime Bridge/trace 这组运行面中，trace surface 只能作为 smoke surface；除非有本仓库 image target metadata、source root / build recipe boundary、workload 和 owner guard，不得默认作为 image target。

必填 owner guard：

- `targetClass=platform_service_target`
- `ownerRef`
- `operationId`
- `component`
- `repository`
- `imageTargetRef`
- `sourceRoot`
- `namespace`
- `workload`
- `container`
- `expectedVersionMarker`

`platform_service_target` 不强制 `workspaceId/resourceBindingId`。共享平台服务不能被伪装成某个 workspace 的专属资源。

### `workspace_runtime_target`

适用：

- workspace 专属 Runtime Agent。
- workspace 专属 runtime workload。
- 任何代表租户计算能力、存储挂载或 workspace runtime capacity 的 workload。

必填 owner guard：

- `targetClass=workspace_runtime_target`
- `ownerRef`
- `operationId`
- `workspaceId`
- `resourceBindingId`
- `component`
- `repository`
- `imageTargetRef`
- `sourceRoot`
- `namespace`
- `workload`
- `container`
- `expectedVersionMarker`

`workspace_runtime_target` 必须同时能被 Portal resource binding 和 Kubernetes metadata 证明。缺失、冲突或不一致时 fail-closed。

## Release Plan Shape

release plan 顶层：

- `runId`
- `versionTag`，禁止 `latest`
- `namespace`，单一 namespace；跨 namespace 必须拆分为多个 release plan
- `targets[]`
- `runtimeSmokeTargets[]`

每个 `targets[]` 还必须满足对应 target class 的 owner guard。`k8s-app`、`qcloud-app`、deployment 名字、namespace、IP、创建时间或人工记忆不能证明归属。

最小平台服务 target：

```json
{
  "component": "opl-web-gateway",
  "targetClass": "platform_service_target",
  "repository": "opl-web-gateway",
  "imageTargetRef": "opl-web-gateway-service-image",
  "sourceRoot": "services/opl-web-gateway",
  "namespace": "platform-namespace",
  "workload": "opl-web-gateway",
  "container": "opl-web-gateway",
  "ownerRef": "platform-release-owner",
  "operationId": "deploy-operation-id",
  "expectedVersionMarker": "unique-version-marker"
}
```

最小 workspace runtime target：

```json
{
  "component": "opl-runtime-agent",
  "targetClass": "workspace_runtime_target",
  "repository": "opl-runtime-agent",
  "imageTargetRef": "opl-runtime-bridge-service-image",
  "sourceRoot": "services/opl-runtime-bridge",
  "namespace": "workspace-namespace",
  "workload": "workspace-runtime-agent",
  "container": "runtime-agent",
  "ownerRef": "workspace-runtime-owner",
  "operationId": "deploy-operation-id",
  "workspaceId": "workspace-id",
  "resourceBindingId": "resource-binding-id",
  "expectedVersionMarker": "unique-version-marker"
}
```

## Module Split

当前 v22 D1 只认以下自有模块：

| component | default target class | source | default role |
| --- | --- | --- | --- |
| `portal` | `platform_service_target` | `services/portal` | Portal API + frontend delivery |
| `opl-web-gateway` | `platform_service_target` | `services/opl-web-gateway` | clean OPL WebUI gateway/proxy |
| `opl-runtime-bridge` | `platform_service_target` | `services/opl-runtime-bridge` | shared Runtime Bridge / Runtime Agent relay |

`opl-runtime-bridge` 只有在 release plan 显式声明 `workspace_runtime_target`，并提供 `workspaceId/resourceBindingId` 时，才能作为 workspace runtime target。

## Validation Path

D1 验证路径：

1. 合同 smoke 确认本合同是 Package D Level 4 子合同，且订阅 OPL Runtime Agent 合同。
2. 本地合同 gate 验证 `platform_service_target` 不强制 `workspaceId/resourceBindingId`。
3. 本地合同 gate 验证 `workspace_runtime_target` 必须提供 `workspaceId/resourceBindingId`。
4. 本地合同 gate 验证 `ownerRef/operationId` 缺失时 fail-closed。
5. 本地合同 gate 验证只有 `k8s-app/qcloud-app` 时 fail-closed。
6. 本地合同 gate 验证 runtime smoke coverage 必须覆盖每个 pushed component。
7. zero-compat cleanup 已删除 Package D runner executable surface；未来真实 deploy runner 必须重新授权并建立新的 v22 boundary。

通过 D1 只能说明 release plan ownership gate 可用；不代表 TCR push、kubectl rollout、runtime smoke 或真实云 deploy 已完成。

## Non-Goals

- 不读取 deploy secret now。
- 不读取 kubeconfig now。
- 不运行 build/push/kubectl now。
- 不调用真实云。
- 不修改 deploy / `.sentrux` / adapters / upstream。
- 不创建、删除、释放或扩缩容 TKE node pool。
- 不创建、删除、清空或扩容 COS bucket/prefix/object。
- 不把 `trace.medopl.cn` 默认建模为本仓库 image target。
- 不把平台共享服务伪装成 workspace runtime。

## Contract Data

<!-- v22-opl-deployment-ownership-release-plan-contract:start -->
```json
{
  "contract": "v22_opl_deployment_ownership_release_plan_boundary",
  "level": 4,
  "parentContract": "v22-authorized-tencent-deploy-execution-boundary.md",
  "package": "Package D",
  "doesNotAuthorizeBuildPushKubectl": true,
  "doesNotReadSecretNow": true,
  "doesNotReadKubeconfigNow": true,
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
  "moduleSplit": [
    "portal",
    "opl-web-gateway",
    "opl-runtime-bridge"
  ],
  "forbiddenOwnershipProof": [
    "k8s-app",
    "qcloud-app",
    "deployment name",
    "namespace",
    "IP",
    "creation time",
    "manual memory"
  ],
  "runnerGate": {
    "executableSurfaceDeleted": true,
    "futureRunnerRequiresNewV22Boundary": true,
    "smoke": "scripts/smoke-test-v22-opl-deployment-ownership-release-plan-contract.mjs",
    "modesCovered": [
      "local-contract",
      "local-owner-guard"
    ]
  }
}
```
<!-- v22-opl-deployment-ownership-release-plan-contract:end -->
