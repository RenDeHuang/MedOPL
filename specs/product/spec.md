# Product Spec

Owner: `MedOPL Portal`
Purpose: `product_behavior_spec`
State: `active`
Human index: `docs/product/README.md`, `docs/specs/README.md`

## Scope

Product specs define what users buy and what Portal may claim about accounts, workspaces, packages, file space, managed compute, billing, audit and OPL entry.

| Requirement | Owner plane | Source surface | Required evals | Evidence level | Cannot claim |
| --- | --- | --- | --- | --- | --- |
| `product:golden-path-default-spine` | Product | `docs/product/README.md`, `tests/fixtures/v22/agent-verify-manifest.json` | `node tests/suites/suite-test-v22-golden-smoke.mjs`; `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json` | local smoke evidence | Local golden smoke proves production runtime, real cloud, real billing or live provider. |
| `product:golden-path-productization-roadmap` | Product | `docs/product/README.md`, `docs/delivery/README.md`, `contracts/medopl-product-profile.json` | `node tests/product/product-test-v22-medopl-contract-authority.mjs`; `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json` | local contract proof | Figma UI absorption, typed API, provider reuse, Go takeover or real cloud authorization has landed. |
| `product:managed-opl-service` | Product | `docs/product/README.md`, `services/portal` | `node tests/smoke/smoke-test-v22-saas-control-plane-user-experience-boundary.mjs` | local smoke evidence | Real cloud resources, production billing or deploy are complete. |
| `product:no-cloud-console-language` | Product | `docs/product/README.md`, Portal user routes | `node tests/regression/portal/regression-test-v22-retire-legacy-resource-user-surface.mjs` | local regression proof | Users self-manage CVM/COS/K8s through MedOPL. |
| `product:local-portal-delivery-rc` | Product | `services/portal/frontend`, `services/medopl-go-backend`, `contracts/medopl-portal-page-state-matrix.json`, `contracts/medopl-api-contract.json` | `node tests/frontend/frontend-test-v22-portal-page-state-matrix.mjs`; `node tests/backend/backend-test-v22-api-contract.mjs`; `npm run verify:local-release-candidate -- --json` | local release-candidate proof | Local Portal delivery RC is production backend, real cloud, live provider, production billing or deploy readiness. |
| `product:starter-2c4g-10gb-plan-catalog` | Product | `docs/product/README.md`, `services/medopl-go-backend/internal/domain/lab/lab.go`, `contracts/medopl-billing-ledger-contract.json` | `node tests/smoke/smoke-test-v22-pricing-plan-contract.mjs`; `node tests/smoke/smoke-test-v22-resource-plan-contract.mjs`; `node tests/smoke/smoke-test-v22-managed-user-loop-contract.mjs` | local contract proof | Starter plan catalog proof authorizes real Tencent mutation, production billing, deploy, kubectl, build/push or live-test. |
| `product:commercial-package-model` | Product | `docs/product/README.md`, `specs/product/spec.md` | `node tests/product/product-test-v22-medopl-contract-authority.mjs`; `node tests/smoke/smoke-test-v22-pricing-plan-contract.mjs`; `node tests/smoke/smoke-test-v22-resource-plan-contract.mjs` | local contract proof | Commercial package model proof means `customer_dedicated` is customer-visible, production billing is ready, real cloud is authorized or UI must change in this package. |
| `product:portal-user-surface-boundary` | Product | `docs/product/README.md`, `services/portal/frontend/src/app/components/Layout.tsx`, `services/portal/frontend/src/app/pages/**` | `node tests/regression/portal/regression-test-v22-portal-role-surface-boundaries.mjs`; `node tests/regression/portal/regression-test-v22-saas-portal-opl-ops-surface-contract.mjs` | local regression proof | Ordinary users can see admin/ops entrypoints, cloud console language, raw provider keys, launch/runtime tokens, tenant/resource binding ids or other users' data. |

## Commercial Package Model Data

<!-- v22-commercial-package-model:start -->
```json
{
  "contract": "v22_commercial_package_model",
  "version": 1,
  "customerRule": {
    "anyoneCanEnterOpl": true,
    "medoplRequiredForCloudCompute": true,
    "portalIsCloudConsole": false,
    "ordinaryUserSelfConfiguresCloud": false
  },
  "packages": [
    {
      "id": "api_only",
      "label": "API / OPL entry only",
      "includes": [
        "账号",
        "工作空间",
        "OPL 入口",
        "用户自己的 gflabtoken providerKeyRef",
        "文件/任务/结果索引"
      ],
      "allowsPlatformManagedCompute": false,
      "requiresBalanceFreeze": false,
      "requiresFileSpace": false,
      "medoplRequiredBecause": "需要账号、工作空间、入口治理和回流索引，但不购买平台托管算力。"
    },
    {
      "id": "full_runtime",
      "label": "Full managed runtime",
      "includes": [
        "平台托管计算",
        "文件空间",
        "任务并发",
        "余额/冻结金额",
        "run/artifact/trace 回流",
        "释放和停止计费"
      ],
      "allowsPlatformManagedCompute": true,
      "requiresBalanceFreeze": true,
      "requiresFileSpace": true,
      "medoplRequiredBecause": "需要平台代管计算、文件空间、计费、审计和释放。"
    },
    {
      "id": "customer_dedicated",
      "label": "Customer dedicated runtime",
      "includes": [
        "客户级隔离",
        "专属运行边界",
        "专属审计标签",
        "人工审批",
        "变更窗口"
      ],
      "allowsPlatformManagedCompute": true,
      "requiresBalanceFreeze": true,
      "requiresFileSpace": true,
      "isolation": "dedicated_runtime_boundary",
      "medoplRequiredBecause": "需要客户级隔离、专属运行边界、审批和审计。"
    }
  ]
}
```
<!-- v22-commercial-package-model:end -->

<!-- v22-commercial-ui-impact-decision:start -->
```json
{
  "contract": "v22_commercial_ui_impact_decision",
  "version": 1,
  "decision": "no_immediate_ui_code_change",
  "reason": "existing_portal_surface_already_answers_required_customer_questions",
  "requiredCustomerQuestions": [
    "买了什么",
    "能不能用",
    "缺什么",
    "下一步点哪里",
    "结果在哪里",
    "费用是否正常"
  ],
  "existingUiCoverage": {
    "overview": [
      "托管 OPL 科研工作台服务",
      "工作台可用性",
      "下一步动作"
    ],
    "resources": [
      "计算资源",
      "文件空间",
      "套餐规格",
      "释放状态"
    ],
    "workspace": [
      "文件列表",
      "任务入口",
      "输出结果"
    ],
    "trace": [
      "任务运行轨迹",
      "输出回流",
      "费用关联"
    ],
    "billing": [
      "余额",
      "冻结金额",
      "运行费用",
      "账本审计"
    ],
    "oplLaunch": [
      "进入 OPL 工作台",
      "启动阶段",
      "provider 绑定状态"
    ]
  },
  "commercialModelImpacts": [
    "api_only_needs_entry_and_context_state_only",
    "full_runtime_uses_existing_runtime_resource_billing_surfaces",
    "customer_dedicated_requires_future_ui_leaf_before_customer_visible_launch"
  ],
  "modifiesUiNow": false,
  "requiresFutureUiLeafForCustomerDedicated": true
}
```
<!-- v22-commercial-ui-impact-decision:end -->
