# v22 Portal Customer / Ops UI Composition Boundary

这是 Portal 四级 UI composition 合同。它只固定 Portal 用户侧和管理侧页面任务、业务组件、DTO/API 数据来源、文案词库、失败隔离和验证链路；不实现 UI，不改业务代码。

## 合同层级

本合同是 `tier_4_ui_composition`：

- 一级主合同仍是 `v22-mvp-managed-opl-loop.md` 和 `v22-saas-portal-opl-ops-surface-boundary.md`。
- 二级 Portal role surface 合同仍是 `v22-portal-user-surface-boundary.md` 和 `v22-portal-admin-ops-surface-boundary.md`。
- 三级 Portal 结构治理合同仍是 `v22-portal-structure-failure-isolation-boundary.md`。
- 本合同只把 Portal 页面任务、业务组件、DTO/API 来源和文案约束固定成后续 UI 实现验收口径。

本合同 scope 是 `portal_only`。它不接真实云、不接真实 OPL、不改 Gateway、不改 Runtime Bridge、不修改 upstream。

## 分支意图与模型记录

本合同分支意图：

- 新增 Portal customer / ops UI composition 四级合同。
- 新增只读 contract smoke，固定页面任务、组件、DTO/API 来源、文案词库和失败隔离验收链路。
- 更新合同索引和 MVP suite。
- 不修改 Portal UI 代码。

模型记录：`gpt-5.4`。

## 订阅合同包

本合同订阅：

- `docs/contracts/v22-mvp-managed-opl-loop.md`
- `docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md`
- `docs/contracts/v22-portal-user-surface-boundary.md`
- `docs/contracts/v22-portal-admin-ops-surface-boundary.md`
- `docs/contracts/v22-portal-files-billing-trace-boundary.md`
- `docs/contracts/v22-portal-structure-failure-isolation-boundary.md`
- `docs/recovery/mvp-contract-acceptance.md`
- `docs/recovery/status-matrix.md`

## 固定推进顺序

Portal UI 后续实现必须按以下顺序推进：

1. 先定页面任务。
2. 再定业务组件。
3. 再定 DTO/API 数据来源。
4. 最后页面只组合组件。

页面不是状态字段仓库。页面不得直接拼装一整坨 raw payload；页面只做 template、props 传递和少量 wiring。loader、query state、formatter 和 actions 进入 composable；DTO builder 输出稳定业务字段。

## 用户侧页面任务

用户侧固定为五个页面：

- `MedOPL 总览`
- `托管环境`
- `任务运行`
- `账单`
- `文件空间`

用户侧只回答用户自己的问题：我现在能不能继续用、我租的环境是什么状态、我的任务跑得怎么样、我花了多少钱还剩多少钱、我的文件在哪里。

gflabtoken 模型调用密钥不是 Portal 用户侧主页面项。它只属于 OPL entry/preflight 的状态和输入边界；Portal 主导航、总览指标卡和常驻客户页面不得把它作为主信息架构。

## 管理侧页面任务

管理侧固定为六个页面：

- `平台总览`
- `用户管理`
- `托管资源管理`
- `任务会话`
- `账单`
- `审计`

管理侧只面向 admin/ops role，回答平台资源、租户行为、账务风险、会话回流、任务归因和审计问题。普通用户导航和普通用户 API 不得出现这些管理入口或全局数据。

## UI 形态规则

后续实现不能把页面做成说明书式文字框。页面必须组合明确业务组件：

- 指标卡：余额、累计消费、本月消费、冻结金额、任务数、文件数、会话数、资源数。
- 图表：消费趋势、任务趋势、资源占用、回流状态。
- 表格：任务、文件、账本、用户、资源绑定、审计记录。
- 进度条：文件空间用量、资源占用。
- 时间线：环境生命周期、审计事件。
- 操作面板：进入 OPL 工作台、申请充值、查看账单、查看文件。
- 服务状态面板：服务状态、服务目标、影响事件、最近更新时间。

## 文案规则

用户侧页面标题只允许：

- `MedOPL 总览`
- `托管环境`
- `任务运行`
- `账单`
- `文件空间`

用户侧常用 label 必须短、业务化，不能是内部治理词。用户侧必须固定以下可用 label：

- `余额`
- `可用余额`
- `累计消费`
- `本月消费`
- `冻结金额`
- `运行中任务`
- `成功任务`
- `失败任务`
- `文件空间`
- `会话数`
- `服务状态`
- `服务目标`
- `进入 OPL 工作台`
- `申请充值`

用户侧不得出现以下主文案：

- `商业化状态`
- `SaaS 状态`
- `providerKeyRef`
- `resourceBindingId`
- `tenantId`
- `serverPlanId`
- `TKE`
- `节点池`
- `COS bucket`
- `配置`
- `告警中心`
- `预扣费/冻结金额`
- `gflabtoken 模型调用密钥`
- `最近心跳`
- `SLO`

如果 OPL entry/preflight 需要提示密钥绑定状态，该提示只出现在进入 OPL 的 preflight/launch flow，不进入 Portal 用户主页面和主导航。

## Contract Data

<!-- v22-portal-customer-ops-ui-composition-contract:start -->
```json
{
  "contract": "v22_portal_customer_ops_ui_composition_boundary",
  "version": 1,
  "level": "tier_4_ui_composition",
  "scope": "portal_only",
  "model": "gpt-5.4",
  "definesProductNarrative": false,
  "replacesRoleSurfaceContracts": false,
  "implementsUi": false,
  "callsRealCloud": false,
  "readsSecrets": false,
  "modifiesOplGateway": false,
  "modifiesRuntimeBridge": false,
  "subscribedContracts": [
    "docs/contracts/v22-mvp-managed-opl-loop.md",
    "docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md",
    "docs/contracts/v22-portal-user-surface-boundary.md",
    "docs/contracts/v22-portal-admin-ops-surface-boundary.md",
    "docs/contracts/v22-portal-files-billing-trace-boundary.md",
    "docs/contracts/v22-portal-structure-failure-isolation-boundary.md",
    "docs/recovery/mvp-contract-acceptance.md",
    "docs/recovery/status-matrix.md"
  ],
  "orderingRule": [
    "page_task",
    "business_components",
    "dto_api_sources",
    "page_composition_only"
  ],
  "providerKeyDisplay": {
    "portalPrimarySurface": false,
    "portalMainNavigation": false,
    "oplEntryPreflightOnly": true,
    "rawApiKeyInPortalUi": false
  },
  "surfaces": {
    "customer": {
      "allowedPageTitles": [
        "MedOPL 总览",
        "托管环境",
        "任务运行",
        "账单",
        "文件空间"
      ],
      "pages": [
        {
          "id": "customer_overview",
          "title": "MedOPL 总览",
          "question": "我现在能不能继续用？",
          "primaryAction": "进入 OPL 工作台",
          "components": [
            {
              "name": "CustomerAccountStatsCards",
              "ui": "metric_cards",
              "dataSources": [
                "GET /portal/api/overview",
                "GET /portal/api/billing/summary"
              ],
              "dtoFields": [
                "kpis.balance",
                "kpis.availableBalance",
                "kpis.historicalCost",
                "kpis.exactCostMonth",
                "wallet.activeFreeze"
              ],
              "labels": [
                "余额",
                "可用余额",
                "累计消费",
                "本月消费",
                "冻结金额"
              ]
            },
            {
              "name": "CustomerCostTrendChart",
              "ui": "line_or_area_chart",
              "dataSources": [
                "GET /portal/api/billing/details"
              ],
              "dtoFields": [
                "trend.labels",
                "trend.total"
              ],
              "labels": [
                "消费趋势"
              ]
            },
            {
              "name": "CustomerServiceStatusPanel",
              "ui": "status_panel",
              "dataSources": [
                "required DTO addition: GET /portal/api/status/summary"
              ],
              "dtoFields": [
                "serviceStatus.state",
                "serviceStatus.serviceTarget",
                "serviceStatus.openIncidentCount",
                "serviceStatus.updatedAt"
              ],
              "labels": [
                "服务状态",
                "服务目标",
                "影响事件",
                "最近更新时间"
              ]
            },
            {
              "name": "RecentTaskTable",
              "ui": "data_table",
              "dataSources": [
                "GET /portal/api/overview"
              ],
              "dtoFields": [
                "latestRuns[]"
              ],
              "labels": [
                "最近任务"
              ]
            }
          ]
        },
        {
          "id": "customer_environment",
          "title": "托管环境",
          "question": "我租的环境是什么状态？",
          "primaryAction": "查看任务",
          "components": [
            {
              "name": "ManagedEnvironmentCard",
              "ui": "spec_card",
              "dataSources": [
                "GET /portal/api/workspace"
              ],
              "dtoFields": [
                "managedResourceBindingPlan",
                "workspace.serverPlan"
              ],
              "labels": [
                "托管环境",
                "环境状态"
              ]
            },
            {
              "name": "ResourceSpecCards",
              "ui": "metric_cards",
              "dataSources": [
                "GET /portal/api/workspace"
              ],
              "dtoFields": [
                "workspace.serverPlan.cpu",
                "workspace.serverPlan.memory",
                "storageEntitlement.storageSizeGb",
                "workspace.serverPlan.concurrency",
                "workspace.serverPlan.queueCapacity"
              ],
              "labels": [
                "CPU",
                "内存",
                "存储",
                "会话数"
              ]
            },
            {
              "name": "StorageUsageBar",
              "ui": "progress_bar",
              "dataSources": [
                "GET /portal/api/workspace"
              ],
              "dtoFields": [
                "fileSpace.capacityGb",
                "fileSpace.usedGb"
              ],
              "labels": [
                "文件空间"
              ]
            }
          ]
        },
        {
          "id": "customer_runs",
          "title": "任务运行",
          "question": "我的任务跑得怎么样？",
          "primaryAction": "查看任务详情",
          "components": [
            {
              "name": "TaskRunStatsCards",
              "ui": "metric_cards",
              "dataSources": [
                "GET /portal/api/workspace"
              ],
              "dtoFields": [
                "counts.runs",
                "runStatus.running",
                "counts.completedRuns"
              ],
              "labels": [
                "运行中任务",
                "成功任务",
                "失败任务"
              ]
            },
            {
              "name": "TaskRunTrendChart",
              "ui": "line_or_bar_chart",
              "dataSources": [
                "GET /portal/api/billing/details"
              ],
              "dtoFields": [
                "runCosts[]"
              ],
              "labels": [
                "任务趋势"
              ]
            },
            {
              "name": "TaskRunTable",
              "ui": "data_table",
              "dataSources": [
                "GET /portal/api/workspace"
              ],
              "dtoFields": [
                "recentRuns[]"
              ],
              "labels": [
                "任务明细"
              ]
            }
          ]
        },
        {
          "id": "customer_billing",
          "title": "账单",
          "question": "我花了多少钱，还剩多少钱？",
          "primaryAction": "申请充值",
          "components": [
            {
              "name": "BillingStatsCards",
              "ui": "metric_cards",
              "dataSources": [
                "GET /portal/api/billing/summary"
              ],
              "dtoFields": [
                "wallet.balance",
                "wallet.availableBalance",
                "wallet.activeFreeze",
                "summary.exactCost"
              ],
              "labels": [
                "余额",
                "可用余额",
                "冻结金额",
                "本月消费"
              ]
            },
            {
              "name": "CostTrendChart",
              "ui": "line_or_area_chart",
              "dataSources": [
                "GET /portal/api/billing/details"
              ],
              "dtoFields": [
                "trend.labels",
                "trend.total",
                "trend.cpu",
                "trend.storage"
              ],
              "labels": [
                "消费趋势"
              ]
            },
            {
              "name": "LedgerTable",
              "ui": "data_table",
              "dataSources": [
                "GET /portal/api/billing/details"
              ],
              "dtoFields": [
                "ledger[]"
              ],
              "labels": [
                "消费明细"
              ]
            },
            {
              "name": "ManualRechargePanel",
              "ui": "action_panel",
              "dataSources": [
                "required DTO addition: POST /portal/api/recharge-requests"
              ],
              "dtoFields": [
                "rechargeRequest.status",
                "rechargeRequest.amount",
                "rechargeRequest.createdAt"
              ],
              "labels": [
                "申请充值",
                "充值记录"
              ]
            }
          ]
        },
        {
          "id": "customer_files",
          "title": "文件空间",
          "question": "我的输入和输出文件在哪里？",
          "primaryAction": "查看文件",
          "components": [
            {
              "name": "StorageStatsCards",
              "ui": "metric_cards",
              "dataSources": [
                "GET /portal/api/workspace"
              ],
              "dtoFields": [
                "fileSpace.capacityGb",
                "fileSpace.usedGb",
                "counts.inputs",
                "counts.outputs"
              ],
              "labels": [
                "文件空间",
                "输入文件",
                "输出文件"
              ]
            },
            {
              "name": "WorkspaceFileTable",
              "ui": "data_table",
              "dataSources": [
                "GET /portal/api/workspace"
              ],
              "dtoFields": [
                "fileSpace.files[]"
              ],
              "labels": [
                "文件列表"
              ]
            }
          ]
        }
      ]
    },
    "adminOps": {
      "allowedPageTitles": [
        "平台总览",
        "用户管理",
        "托管资源管理",
        "任务会话",
        "账单",
        "审计"
      ],
      "pages": [
        {
          "id": "ops_overview",
          "title": "平台总览",
          "question": "平台现在是否健康？",
          "primaryAction": "查看异常",
          "components": [
            {
              "name": "OpsStatsCards",
              "ui": "metric_cards",
              "dataSources": [
                "GET /portal/api/admin/overview"
              ],
              "dtoFields": [
                "summary.activeUsers",
                "summary.runningRuns",
                "summary.billingRisk",
                "summary.backflowStatus"
              ],
              "labels": [
                "活跃用户",
                "运行中任务",
                "账务风险",
                "回流状态"
              ]
            },
            {
              "name": "OpsServiceStatusPanel",
              "ui": "status_panel",
              "dataSources": [
                "required DTO addition: GET /portal/api/admin/service-status"
              ],
              "dtoFields": [
                "serviceStatus.state",
                "serviceStatus.serviceTarget",
                "serviceStatus.attainment",
                "serviceStatus.openIncidentCount",
                "serviceStatus.updatedAt"
              ],
              "labels": [
                "服务状态",
                "服务目标达成率",
                "影响事件",
                "最近更新时间"
              ]
            }
          ]
        },
        {
          "id": "ops_users",
          "title": "用户管理",
          "question": "谁在用，谁还有多少钱？",
          "primaryAction": "查看用户",
          "components": [
            {
              "name": "AdminUserTable",
              "ui": "data_table",
              "dataSources": [
                "GET /portal/api/admin/users"
              ],
              "dtoFields": [
                "items[]",
                "financeRows[]"
              ],
              "labels": [
                "用户列表"
              ]
            }
          ]
        },
        {
          "id": "ops_resources",
          "title": "托管资源管理",
          "question": "资源池现在够不够？",
          "primaryAction": "查看绑定",
          "components": [
            {
              "name": "ResourceBindingTable",
              "ui": "data_table",
              "dataSources": [
                "GET /portal/api/admin/ops"
              ],
              "dtoFields": [
                "workspaceOperations.workspaces[]",
                "resourceUsage"
              ],
              "labels": [
                "资源绑定"
              ]
            },
            {
              "name": "ResourceUsageChart",
              "ui": "bar_or_stacked_chart",
              "dataSources": [
                "GET /portal/api/admin/ops"
              ],
              "dtoFields": [
                "summary.resourceUsage"
              ],
              "labels": [
                "资源占用"
              ]
            }
          ]
        },
        {
          "id": "ops_sessions",
          "title": "任务会话",
          "question": "任务和 session 有没有回流？",
          "primaryAction": "查看详情",
          "components": [
            {
              "name": "RunMonitorTable",
              "ui": "data_table",
              "dataSources": [
                "GET /portal/api/admin/usage",
                "GET /portal/api/admin/agent-traces"
              ],
              "dtoFields": [
                "runs[]",
                "sessions[]",
                "traces[]"
              ],
              "labels": [
                "任务会话"
              ]
            }
          ]
        },
        {
          "id": "ops_billing",
          "title": "账单",
          "question": "钱和账是否对得上？",
          "primaryAction": "审核充值",
          "components": [
            {
              "name": "AdminBillingStatsCards",
              "ui": "metric_cards",
              "dataSources": [
                "GET /portal/api/admin/billing-ops"
              ],
              "dtoFields": [
                "balance",
                "frozen",
                "pendingReconciliation"
              ],
              "labels": [
                "余额",
                "冻结金额",
                "待核对"
              ]
            }
          ]
        },
        {
          "id": "ops_audit",
          "title": "审计",
          "question": "谁做了什么？",
          "primaryAction": "查看记录",
          "components": [
            {
              "name": "AdminAuditTimeline",
              "ui": "timeline_and_data_table",
              "dataSources": [
                "GET /portal/api/admin/audit"
              ],
              "dtoFields": [
                "auditEvents[]"
              ],
              "labels": [
                "审计记录"
              ]
            }
          ]
        }
      ]
    }
  },
  "copy": {
    "customer": {
      "requiredLabels": [
        "余额",
        "可用余额",
        "累计消费",
        "本月消费",
        "冻结金额",
        "运行中任务",
        "成功任务",
        "失败任务",
        "文件空间",
        "会话数",
        "服务状态",
        "服务目标",
        "进入 OPL 工作台",
        "申请充值"
      ],
      "forbiddenLabels": [
        "商业化状态",
        "SaaS 状态",
        "providerKeyRef",
        "resourceBindingId",
        "tenantId",
        "serverPlanId",
        "TKE",
        "节点池",
        "COS bucket",
        "配置",
        "告警中心",
        "预扣费/冻结金额",
        "gflabtoken 模型调用密钥",
        "最近心跳",
        "SLO"
      ],
      "environmentStatusWords": [
        "未开通",
        "开通中",
        "可用",
        "暂停",
        "释放中",
        "已释放"
      ],
      "runStatusWords": [
        "排队中",
        "运行中",
        "已完成",
        "失败",
        "已取消"
      ],
      "billingStatusWords": [
        "已入账",
        "冻结中",
        "待核对",
        "已核对",
        "已冲正"
      ],
      "fileStatusWords": [
        "可用",
        "处理中",
        "保留期内",
        "已删除"
      ]
    }
  },
  "dtoRules": {
    "existingSourceAllowed": true,
    "requiredDtoAdditionMustBeDeclared": true,
    "pagesMustNotAssembleRawPayloads": true,
    "pageDefaultLargePortalBarrelImport": false,
    "sourceOfTruth": {
      "workspaceAndStorage": {
        "api": "GET /portal/api/workspace",
        "source": "workspace DTO, storage entitlement, workspace file records",
        "labels": [
          "托管环境",
          "存储",
          "文件空间"
        ]
      },
      "customerBilling": {
        "api": "GET /portal/api/billing/summary",
        "source": "wallet ledger, freeze ledger, monthly exact cost summary",
        "labels": [
          "余额",
          "可用余额",
          "累计消费",
          "本月消费",
          "冻结金额"
        ]
      },
      "customerServiceStatus": {
        "api": "required DTO addition: GET /portal/api/status/summary",
        "source": "portal runtime health events and service incident ledger",
        "labels": [
          "服务状态",
          "服务目标",
          "影响事件",
          "最近更新时间"
        ]
      },
      "opsServiceStatus": {
        "api": "required DTO addition: GET /portal/api/admin/service-status",
        "source": "portal runtime health events, service incident ledger, admin observability summary",
        "labels": [
          "服务状态",
          "服务目标达成率",
          "影响事件",
          "最近更新时间"
        ]
      }
    }
  },
  "pageComposition": {
    "viewResponsibilities": [
      "template",
      "pass_props",
      "local_wiring"
    ],
    "composableResponsibilities": [
      "load",
      "query_state",
      "formatters",
      "actions"
    ]
  },
  "failureIsolation": {
    "singleComponentFailureMustNotBlankPage": true,
    "billingTrendFailureMustNotHideBalanceCards": true,
    "taskTableFailureMustNotHideBillingCards": true,
    "adminOpsFailureMustNotAffectCustomerSurface": true
  },
  "validation": {
    "requiredSmoke": [
      "scripts/smoke-test-v22-portal-customer-ops-ui-composition-contract.mjs"
    ],
    "browserSmokeRequiredBeforeUiAbsorption": true,
    "defaultSmokeReadsSecrets": false,
    "defaultSmokeCallsRealCloud": false
  }
}
```
<!-- v22-portal-customer-ops-ui-composition-contract:end -->

## 验证链路

本合同的最小验证链路：

1. `node scripts/smoke-test-v22-portal-customer-ops-ui-composition-contract.mjs`
2. `node scripts/smoke-test-v22-portal-role-surface-boundaries.mjs`
3. `node scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs`
4. `node scripts/smoke-test-v22-mvp-contract-suite.mjs`

后续 UI 实现分支在吸收前必须追加浏览器验收：

- 普通用户看到 5 个用户侧页面，不看到 admin/ops 入口。
- admin 看到 6 个管理侧页面。
- 用户侧页面包含指标卡、图表、表格、进度条或操作面板，不是纯文字说明书。
- 用户侧禁用词不出现在主页面。
- 单个组件数据加载失败不能拖垮整个页面。

## Non-goals

- 不实现新 UI。
- 不改 Portal 代码。
- 不读取 secret。
- 不调用真实云。
- 不改 OPL Gateway。
- 不改 Runtime Bridge。
- 不改 deploy / `.sentrux` / `adapters` / upstream。
- 不运行 build/push/kubectl/live-test。
