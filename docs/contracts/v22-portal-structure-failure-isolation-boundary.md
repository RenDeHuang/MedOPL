# v22 Portal Structure / Failure Isolation Boundary

这是 Portal 结构治理 / failure isolation 三级合同，不实现 UI，不改业务代码。

本合同只定义 Portal 线内部的工程边界：后端 route/dispatcher、payload/DTO builder、frontend view/composable、frontend API module 和 Portal smoke 应如何分层。它不定义新的产品主叙事，不替代普通用户、管理员/运维、files/billing/trace 等既有 surface 合同。

## 合同层级

本合同是 `tier_3_structure_governance`：

- 一级主合同仍是 `v22-mvp-managed-opl-loop.md` 和 `v22-saas-portal-opl-ops-surface-boundary.md`。
- 二级 Portal surface 合同仍是 `v22-portal-user-surface-boundary.md`、`v22-portal-admin-ops-surface-boundary.md` 和 `v22-portal-files-billing-trace-boundary.md`。
- 本合同只把这些 Portal 产品边界落成代码治理边界和 failure isolation 验收口径。

本合同 scope 是 `portal_only`。接云和接 OPL 是外部能力边界，不在本合同中实现。

## 分支意图与模型记录

本合同分支意图：

- 新增 Portal 三级结构治理合同。
- 新增只读 contract smoke。
- 更新合同索引。
- 不修改 Portal 业务代码。

模型记录：`gpt-5.4`。

## 订阅合同包

本合同订阅：

- `docs/contracts/v22-mvp-managed-opl-loop.md`
- `docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md`
- `docs/contracts/v22-portal-user-surface-boundary.md`
- `docs/contracts/v22-portal-admin-ops-surface-boundary.md`
- `docs/contracts/v22-portal-files-billing-trace-boundary.md`
- `docs/recovery/mvp-contract-acceptance.md`
- `docs/recovery/status-matrix.md`

## Portal 后端 route / dispatcher 边界

Portal 后端应按 surface/domain 拆 route/dispatcher 边界：

- user
- admin
- ops
- billing
- workspace
- packages
- resources
- trace

route handler 只承担：

- auth
- role
- request parsing
- service/store call
- DTO response

Portal route handler 不承担：

- cloud create/release implementation
- OPL runtime implementation
- secret reading
- raw provider key handling

真实云资源创建/释放、真实扣费、真实 OPL runtime 执行都必须留在接云或接 OPL 合同和授权边界内。Portal 可以展示已清洗 projection、状态、计划、审计、错误态和空态，但不能把外部实现揉进 Portal。

## Backend implementation eval template

未来任何 Portal 后端实现 leaf 都必须先订阅本模板，并在自己的分支内补充 route smoke、payload/domain contract smoke、`npm --prefix services/portal run check` 或同等 Node 22 ESM 语法检查，以及 workflow gate。

模板固定的后端路径是：

- route
- app payload
- domain
- state/persistence

route 层只能处理 auth、role、request parsing、service/store call 和 DTO response，不得直接 import state/persistence 作为业务快捷路径。app payload / DTO builder 只能组合、裁剪和格式化已传入数据，不得做 IO、读 secret、调用外部服务或 role authorization。domain 层不得恢复 `user_owned` primary path、`resource-order` primary path、OpenCost 主路径或 Langfuse 主路径。state/persistence 层不得生成用户产品文案、route response、云控制台语言，且不得执行缺少 step-local auth record 的真实云/live 操作。

缺字段必须合同化 fail-closed 或显式错误态；不得用 implicit default、silent fallback 或 shim/adapter compatibility 让 smoke 伪通过。

## Payload / DTO builder 边界

Portal payload / DTO builder 应按 payload 家族拆分：

- overview
- users
- groups
- billing
- system
- ops
- audit
- packages
- workspace
- resources

builder 必须是纯 builder：只组合、裁剪和格式化已传入的数据，不做 IO，不读取 secret，不调用外部服务，不做 role authorization。

单个 builder 或单个 domain payload 出错时，失败必须尽量局部化。套餐 payload 的失败不能拖垮 Portal shell；admin payload 的失败不能拖垮普通用户 surface；单个 domain 的失败不能变成整个 web 崩溃。

## Frontend view / adapter 边界

Portal frontend page 应保留：

- template
- local wiring

以下逻辑应进入 Portal API adapter：

- query state
- loader
- formatter
- action handler

普通用户、admin 和 ops 页面不得共享会造成角色数据泄漏的状态。普通用户页面不能因为 admin/ops API、全局数据或运营 payload 失败而白屏。

## Frontend API module 边界

Portal frontend API module 是前端到后端合同的映射层，不承载业务决策。

页面默认不得依赖大型 `@/api/portal` barrel 聚合所有 Portal API。页面应按域直引：

- billing
- packages
- workspace
- resources
- trace
- admin/users
- admin/system
- ops

barrel 可以作为兼容入口存在，但不应成为页面默认引入方式，也不能让无关 domain 被同一聚合节点绑定。

## Portal smoke 分层

Portal 线 smoke 应分层：

- portal contract smoke
- portal role-boundary smoke
- portal payload/failure-isolation smoke
- portal browser smoke

这些 smoke 默认不读 secret、不调用真实云、不运行 live-test。需要真实外部系统、secret、build/push、kubectl、live-test 或真实云操作时，必须另开分支并单独授权。

## Failure isolation 要求

Portal 必须按低耦合目标治理：

- package surface failure must not crash Portal shell
- admin payload failure must not crash user surface
- single domain failure must remain local
- Portal shell must render auth and error states

本合同不要求用临时兜底、启发式补救或伪通过掩盖真实缺参。错误态和空态必须是合同化状态，而不是吞异常。

## 授权边界

本合同不允许：

- 调用真实云。
- 读取 secret。
- 修改 OPL Gateway。
- 修改 Runtime Bridge。
- 修改 deploy。
- 修改 one-person-lab upstream。
- 修改 `.sentrux`。
- 修改 `adapters`。
- build/push。
- kubectl。
- live-test。

禁止泄漏或进入 frontend 持久化、日志、evidence、git 的敏感数据包括：

- SecretId
- SecretKey
- token
- raw API Key
- bearer token
- launchToken
- runtimeToken
- kubeconfig
- objectKey
- storageKey
- localPath
- signedUrl

## Contract Data

<!-- v22-portal-structure-failure-isolation-contract:start -->
```json
{
  "contract": "v22_portal_structure_failure_isolation_boundary",
  "version": 1,
  "level": "tier_3_structure_governance",
  "scope": "portal_only",
  "model": "gpt-5.4",
  "definesProductNarrative": false,
  "replacesRoleSurfaceContracts": false,
  "callsRealCloud": false,
  "readsSecrets": false,
  "modifiesOplGateway": false,
  "modifiesRuntimeBridge": false,
  "modifiesDeploy": false,
  "modifiesUpstream": false,
  "requiredSurfaces": [
    "backend_routes_dispatcher",
    "backend_implementation_eval_template",
    "payload_dto_builders",
    "frontend_views_composables",
    "frontend_api_modules",
    "portal_smoke_layers"
  ],
  "backendRoutesDispatcher": {
    "routeGroups": [
      "user",
      "admin",
      "ops",
      "billing",
      "workspace",
      "packages",
      "resources",
      "trace"
    ],
    "handlerResponsibilities": [
      "auth",
      "role",
      "request_parsing",
      "service_or_store_call",
      "dto_response"
    ],
    "forbiddenResponsibilities": [
      "cloud_create_release_implementation",
      "opl_runtime_implementation",
      "secret_reading",
      "raw_provider_key_handling"
    ]
  },
  "backendImplementationEvalTemplate": {
    "templateKind": "backend_implementation_gate",
    "runtime": "node_22_esm",
    "requiredForFutureBackendChanges": true,
    "layerFlow": [
      "route",
      "app_payload",
      "domain",
      "state_persistence"
    ],
    "requiredVerificationCommands": [
      "node tests/regression/portal/smoke-test-v22-portal-structure-failure-isolation-contract.mjs",
      "npm --prefix services/portal run check",
      "node tests/contract/smoke-test-v22-product-goal-harness.mjs",
      "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk"
    ],
    "routeLayer": {
      "allowedResponsibilities": [
        "auth",
        "role",
        "request_parsing",
        "service_or_store_call",
        "dto_response"
      ],
      "forbiddenDirectImports": [
        "services/portal/src/state/**",
        "services/portal/src/state/*"
      ],
      "forbiddenMissingFieldBehaviors": [
        "implicit_default",
        "silent_fallback",
        "shim_adapter_compatibility"
      ]
    },
    "appPayloadLayer": {
      "allowedResponsibilities": [
        "compose_passed_data",
        "trim_fields",
        "format_dto"
      ],
      "forbiddenEffects": [
        "io",
        "secret_reading",
        "external_service_call",
        "role_authorization"
      ],
      "missingFieldPolicy": "fail_closed_or_explicit_error_state"
    },
    "domainLayer": {
      "allowedResponsibilities": [
        "business_rules",
        "contract_field_validation",
        "state_adapter_call"
      ],
      "forbiddenPrimaryPaths": [
        "user_owned_primary_path",
        "resource_order_primary_path",
        "opencost_main_path",
        "langfuse_main_path"
      ]
    },
    "statePersistenceLayer": {
      "allowedResponsibilities": [
        "state_read",
        "state_write",
        "migration_only_legacy_record"
      ],
      "forbiddenResponsibilities": [
        "route_response_building",
        "user_facing_product_copy",
        "cloud_console_language",
        "live_cloud_call_without_auth_record"
      ]
    }
  },
  "payloadDtoBuilders": {
    "builderFamilies": [
      "overview",
      "users",
      "groups",
      "billing",
      "system",
      "ops",
      "audit",
      "packages",
      "workspace",
      "resources"
    ],
    "pureBuildersOnly": true,
    "forbiddenBuilderEffects": [
      "io",
      "secret_reading",
      "external_service_call",
      "role_authorization"
    ]
  },
  "frontendViewsComposables": {
    "viewResponsibilities": [
      "template",
      "local_wiring"
    ],
    "composableResponsibilities": [
      "query_state",
      "loader",
      "formatter",
      "action_handler"
    ],
    "roleStateLeakageAllowed": false
  },
  "frontendApiModules": {
    "usesLargePortalBarrelAsPageDefault": false,
    "domainModules": [
      "billing",
      "packages",
      "workspace",
      "resources",
      "trace",
      "admin/users",
      "admin/system",
      "ops"
    ],
    "carriesBusinessDecisions": false
  },
  "portalSmokeLayers": {
    "layers": [
      "portal_contract_smoke",
      "portal_role_boundary_smoke",
      "portal_payload_failure_isolation_smoke",
      "portal_browser_smoke"
    ],
    "callsRealCloud": false,
    "readsSecrets": false,
    "liveTestAllowedByDefault": false
  },
  "failureIsolation": {
    "packageSurfaceFailureMustNotCrashPortalShell": true,
    "adminPayloadFailureMustNotCrashUserSurface": true,
    "singleDomainFailureMustRemainLocal": true,
    "portalShellMustRenderAuthAndErrorStates": true
  },
  "forbiddenPaths": [
    "deploy",
    ".sentrux",
    "adapters",
    "one-person-lab upstream"
  ],
  "forbiddenSensitiveData": [
    "SecretId",
    "SecretKey",
    "token",
    "raw API Key",
    "bearer token",
    "launchToken",
    "runtimeToken",
    "kubeconfig",
    "objectKey",
    "storageKey",
    "localPath",
    "signedUrl"
  ],
  "subscribedContracts": [
    "docs/contracts/v22-mvp-managed-opl-loop.md",
    "docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md",
    "docs/contracts/v22-portal-user-surface-boundary.md",
    "docs/contracts/v22-portal-admin-ops-surface-boundary.md",
    "docs/contracts/v22-portal-files-billing-trace-boundary.md",
    "docs/recovery/mvp-contract-acceptance.md",
    "docs/recovery/status-matrix.md"
  ],
  "currentPortalCodeShape": {
    "characterizationOnly": true,
    "modifiesPortalBusinessCode": false,
    "runsLiveTest": false,
    "readsSecrets": false,
    "backendRoutesDispatcher": {
      "dispatcherFile": "services/portal/src/routes/portal-api.routes.mjs",
      "dispatcherMustReference": [
        "createPortalApiV22UserCreditProviderKeyRoutes",
        "createPortalApiV22OplWorkRoutes",
        "createPortalApiV22CloudOperationsRoutes",
        "createPortalApiV22ManagedEnvironmentReleaseRoutes",
        "createPlatformProvisionedResourceRoutes"
      ],
      "currentRouteFiles": [
        "services/portal/src/routes/portal-api.routes.mjs",
        "services/portal/src/routes/admin-api.routes.mjs",
        "services/portal/src/routes/platform-provisioned-resource.routes.mjs",
        "services/portal/src/routes/portal-api-state.routes.mjs",
        "services/portal/src/routes/portal-api-runs.routes.mjs",
        "services/portal/src/routes/portal-api-sessions.routes.mjs",
        "services/portal/src/routes/portal-api-traces.routes.mjs",
        "services/portal/src/routes/platform-provisioned-resource.routes.mjs",
        "services/portal/src/routes/workspace-storage.routes.mjs"
      ]
    },
    "backendAppPayloadBuilders": {
      "payloadEntryFile": "services/portal/src/app/portal-page-payloads.mjs",
      "payloadEntryMustReference": [
        "createBillingPayloadBuilders",
        "createOverviewPayloadBuilder",
        "createWorkspacePayloadBuilder"
      ],
      "currentAppPayloadFiles": [
        "services/portal/src/app/portal-app.mjs",
        "services/portal/src/app/portal-runtime.mjs",
        "services/portal/src/app/portal-runtime-bootstrap.mjs",
        "services/portal/src/app/portal-http-dispatcher.mjs",
        "services/portal/src/app/portal-api-runtime-handlers.mjs",
        "services/portal/src/app/portal-feature-runtime-handlers.mjs",
        "services/portal/src/app/portal-store-runtime.mjs",
        "services/portal/src/app/portal-page-payloads.mjs",
        "services/portal/src/app/portal-page-runtime-payloads.mjs",
        "services/portal/src/app/portal-admin-api-payloads.mjs"
      ]
    },
    "backendDomainModules": {
      "currentDomainFiles": [
        "services/portal/src/domain/portal-api-payloads.mjs",
        "services/portal/src/domain/commercial-state.mjs",
        "services/portal/src/domain/wallet-ledger.mjs",
        "services/portal/src/domain/platform-provisioned-resources.mjs",
        "services/portal/src/domain/user-resource-bindings.mjs",
        "services/portal/src/domain/managed-environment-open-flow.mjs",
        "services/portal/src/domain/managed-environment-release-flow.mjs",
        "services/portal/src/domain/workspace-storage.mjs"
      ]
    },
    "backendStatePersistence": {
      "currentStateFiles": [
        "services/portal/src/state/portal-store.mjs",
        "services/portal/src/state/portal-store-db-facade.mjs",
        "services/portal/src/state/portal-store-runtime-connections.mjs",
        "services/portal/src/state/portal-store-schema.mjs",
        "services/portal/src/state/portal-store-migrations.mjs",
        "services/portal/src/state/portal-platform-provisioned-resource-store.mjs",
        "services/portal/src/state/portal-workspace-store.mjs",
        "services/portal/src/state/portal-accounting-store.mjs",
        "services/portal/src/state/portal-lab-billing-store.mjs"
      ]
    },
    "frontendViewsComposables": {
      "currentViewFiles": [
        "services/portal/frontend/src/app/pages/Overview.tsx",
        "services/portal/frontend/src/app/pages/RuntimeEnvironment.tsx",
        "services/portal/frontend/src/app/pages/Workspace.tsx",
        "services/portal/frontend/src/app/pages/BillingAudit.tsx",
        "services/portal/frontend/src/app/pages/TasksResults.tsx",
        "services/portal/frontend/src/app/pages/OPLEntry.tsx"
      ],
      "currentComposableFiles": [
        "services/portal/frontend/src/app/data/portalAdapters.ts",
        "services/portal/frontend/src/app/components/ui/utils.ts"
      ],
      "coreViewComposableImports": [
        {
          "viewFile": "services/portal/frontend/src/app/pages/Overview.tsx",
          "composableImport": "usePortalQuery"
        },
        {
          "viewFile": "services/portal/frontend/src/app/pages/RuntimeEnvironment.tsx",
          "composableImport": "usePortalQuery"
        },
        {
          "viewFile": "services/portal/frontend/src/app/pages/Workspace.tsx",
          "composableImport": "usePortalQuery"
        },
        {
          "viewFile": "services/portal/frontend/src/app/pages/BillingAudit.tsx",
          "composableImport": "usePortalQuery"
        },
        {
          "viewFile": "services/portal/frontend/src/app/pages/TasksResults.tsx",
          "composableImport": "usePortalQuery"
        },
        {
          "viewFile": "services/portal/frontend/src/app/pages/OPLEntry.tsx",
          "composableImport": "usePortalQuery"
        }
      ]
    },
    "frontendApiModules": {
      "currentApiModuleFiles": [
        "services/portal/frontend/src/api/client.ts",
        "services/portal/frontend/src/api/portal.ts",
        "services/portal/frontend/src/api/portal/overview.ts",
        "services/portal/frontend/src/api/portal/resources.ts",
        "services/portal/frontend/src/api/portal/workspace.ts",
        "services/portal/frontend/src/api/portal/billing.ts",
        "services/portal/frontend/src/api/portal/traces.ts",
        "services/portal/frontend/src/api/portal/admin.ts",
        "services/portal/frontend/src/api/portal/opl.ts",
        "services/portal/frontend/src/api/portal/common.ts",
        "services/portal/frontend/src/api/portal/commercial.ts",
        "services/portal/frontend/src/api/portal/lab.ts",
        "services/portal/frontend/src/api/portal/public.ts",
        "services/portal/frontend/src/api/portal/server-plans.ts",
        "services/portal/frontend/src/api/portal/sessions.ts",
        "services/portal/frontend/src/api/portal/types.ts"
      ]
    },
    "portalSmokeLayers": {
      "currentSmokeFiles": [
        "tests/regression/portal/smoke-test-v22-portal-structure-failure-isolation-contract.mjs",
        "tests/regression/portal/smoke-test-v22-portal-role-surface-boundaries.mjs",
        "tests/regression/portal/smoke-test-v22-portal-frontend-surface-eval.mjs",
        "tests/regression/portal/smoke-test-v22-portal-web-route-alignment.mjs",
        "tests/regression/portal/smoke-test-v22-portal-ui-design-quality-audit.mjs",
        "tests/regression/portal/smoke-test-v22-portal-runtime-suite.mjs"
      ]
    },
    "knownFutureRefactorRisks": [
      "portal_runtime_composition_root_is_large",
      "route_to_state_direct_import_exists",
      "domain_contains_payload_and_provider_bridge_modules",
      "app_layer_mixes_orchestration_and_view_model_payloads",
      "frontend_api_barrel_exists_but_not_page_default",
      "admin_ops_frontend_is_future_same_stack_leaf",
      "retired_resource_order_schema_store_physically_deleted",
      "retired_user_owned_public_route_deleted",
      "old_vue_visual_workbench_removed_from_current_gate"
    ]
  }
}
```
<!-- v22-portal-structure-failure-isolation-contract:end -->

## Non-goals

- 不实现新 UI。
- 不改 Portal 业务代码。
- 不改 OPL Gateway。
- 不改 Runtime Bridge。
- 不读取 secret。
- 不调用真实云。
- 不创建、绑定、释放或修改真实资源。
- 不真实扣费。
- 不改 deploy / .sentrux / adapters / upstream。
- 不运行 build/push/kubectl/live-test。
