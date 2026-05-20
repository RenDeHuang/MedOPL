# v22 Portal UI Design Quality Audit Boundary

本合同只定义边界和评价标准，不规定具体审美解法。它用于回答：Portal 是否真的把 MedOPL 的主线表达成一个现代 SaaS 工作台，而不是只证明 route、DOM anchor、fixture 和截图存在。

本合同不实现 UI，不修改 `services/*`，不读取 secret，不调用真实云，不修改 upstream，不运行 build/push/kubectl/live-test。后续真正改 Portal UI 时，必须另开实现 leaf，并订阅本合同、`v22-saas-control-plane-user-experience-boundary.md` 和 `v22-portal-workbench-management-ui-composition-boundary.md`。

模型记录：`gpt-5.4`。

## 审计目的

Portal 是 OPL 的 SaaS 控制面。UI design quality audit 要审计 Portal 是否让用户在进入后快速理解：

- 我买的是什么服务？
- 我的 OPL 工作台现在能不能用？
- 如果不能用，还缺哪一步？
- 下一步应该点哪里？
- 我的文件、任务、结果在哪里？
- 我的余额、预扣费、冻结金额、停止计费状态是否正常？
- 我什么时候应该释放计算资源但保留文件空间？

这些问题来自主线合同。审计不得把 Portal 评成科研聊天界面，不得重做 OPL chatbot，不得把 Portal 做成云资源控制台。用户购买的是托管 OPL 科研工作台服务，不是 CVM、COS、TKE、节点池或 K8s 控制台权限。

## Rubric 分层

硬约束用于阻断污染和基础可用性退化。任何硬约束失败，都不能只靠视觉分数或截图基准通过：

- 主线问题必须可从页面信息架构、状态、空态、操作区和账单摘要中得到回答。
- Portal / OPL 职责必须清晰：Portal 负责准备、管理、进入、回流、计费、审计和释放；OPL 负责科研执行、chatbot、agent、文件理解和结果生成。
- 普通用户页面不得恢复云资源控制台语言。
- 不得重做 OPL chatbot。
- 普通用户、管理员和运维 surface 不能越权串台。
- raw API key、token、launchToken、runtimeToken、objectKey、localPath、signedUrl 不进入浏览器持久化状态、日志、evidence 或 git。
- 关键页面在桌面和移动视口不能横向溢出，关键文本不能互相遮挡。
- ready、empty、loading、error、disabled、pending、success 和 failure 状态必须有可审计覆盖。
- 审计报告只写 `.runtime/portal-ui-design-quality/report.json`，不进 git。

软评分用于形成审计报告，不直接锁定某一种视觉实现：

- 现代 SaaS 工作台的信息层级是否清楚。
- 工作台是否适合扫描、比较和重复操作。
- 用户是否能明确感知自己购买的是托管 OPL 科研工作台服务。
- 下一步动作是否稳定、具体、可点击。
- 页面气质是否像科研工作台，而不是营销页、云控制台或散装资源面板。
- 信息密度、留白、表格、卡片、列表、状态标签和操作区是否平衡。
- 中文文案是否直接、可信、面向 AI 小白科研用户。

软评分只能指导后续 UI 实现 leaf，不得写死布局、颜色、字体、动效、组件库或组件形态。合同审计只回答边界和质量标准，具体审美解法留给 UI 实现阶段。

## 外部 UI/UX 参考边界

允许在审计报告和后续 UI implementation leaf 中参考外部 UI/UX best practices、web design guidelines、frontend development guidelines 或 UI UX Pro 类设计经验，但只能作为表达质量参考：信息层级、可扫描性、留白密度、状态表达、操作区清晰度、响应式无溢出、文案可信度和现代 SaaS 工作台质感。

内容语义必须由 v22 合同固定。外部设计参考不得改变用户购买的服务、Portal/OPL 职责、账单/冻结/释放/文件/任务/结果状态、角色可见边界、secret/browser hygiene、no-cloud-console language、OPL chatbot 边界或 Cloud lane 授权边界。`vercel-react-best-practices` 一类资料可以贡献通用前端质量原则，但不得把本 audit leaf 本身变成 UI implementation leaf。Portal 前端技术栈迁移的授权只来自 `v22-portal-figma-make-ui-implementation-boundary.md`，并被限制在 Portal frontend、Figma Make 吸收、本地验证和本地可预览部署边界内。

## 与现有 UI 合同关系

本合同不替代 UI composition 合同。分工如下：

- `v22-saas-control-plane-user-experience-boundary.md` 定义用户体验主线问题。
- `v22-portal-workbench-management-ui-composition-boundary.md` 定义 UI 分层、Figma Make ZIP surface gate 和统一验证入口。
- 本合同定义 design quality audit 的评价标准、报告形态和 runtime evidence 边界。
- `DESIGN.md` 是 Portal UI 重构的设计执行源，用于把合同和 Figma Make implementation leaf 转成产品气质、信息架构、组件、文案、视觉和 Figma Make ZIP 吸收规则；它不替代本合同、UI composition 合同、Figma Make ZIP source-of-truth 或 smoke，也不授权修改后端、真实云、deploy、upstream 或 secret 边界。

旧截图回归只能证明“和 baseline 一致”，不能证明 baseline 本身足够好；它已不再是当前 Portal UI completion evidence。当前实现 leaf 以 React route/surface eval、typecheck、build 和本地预览作为完成证据；如果后续重新引入截图回归，必须先有 `.runtime/portal-ui-design-quality/report.json` 审计证据说明哪些硬约束仍通过、哪些软评分改善，以及为什么这是有意改版而不是偶然漂移。

## 审计证据和后续 handoff

本 leaf 产出的审计证据只证明合同、rubric、报告 schema 和后续 implementation handoff 已被定义并可被 gate 检查；当前 implementation leaf 的执行证据由 React route/surface eval、typecheck、build 和本地预览承接。运行时报告路径固定为 `.runtime/portal-ui-design-quality/report.json`，报告不进 git。

审计报告必须覆盖七个主线问题、全部硬约束、全部软评分轴、surface/typecheck/build 证据来源、表达质量发现、产品语义边界检查和后续 UI implementation leaf handoff。

后续 UI implementation leaf handoff 必须作为独立 leaf 处理。它可以在单独授权和 manifest allowlist 下修改 `services/portal/frontend/**` 以及 Portal frontend package/lockfile，但不得默认开放 Portal 后端、非 Portal frontend 依赖、deploy、adapters、`.sentrux`、upstream、secret 或真实云路径。它必须继续订阅本合同、UI composition 合同和 SaaS control-plane UX 合同，并把实现验证与 truth writeback 明确写入下一 leaf。

## Implementation Truth Writeback

`leaf-portal-figma-make-react-ui-implementation` 在当前分支执行本 handoff，范围保持在 Portal frontend、Portal frontend package/lockfile、当前 design-quality gate 和订阅 truth writeback 文档内。Portal 全体前端技术栈由 implementation leaf 固定为 React + Vite + TypeScript + shadcn/Radix + lucide，覆盖普通用户 Portal 和后续 Admin / Ops Portal；当前完成的 UI surface：

- `overview`: 说明托管 OPL 科研工作台服务、工作台可用性、下一步动作、运行环境、文件任务结果和账单摘要。
- `resources`: 说明托管运行环境、文件空间、释放计算资源和删除存储资源的 7 天保护期。
- `workspace`: 展示文件空间、任务、输出结果和托管环境计划。
- `trace`: 展示任务运行轨迹、输出回流和费用关联，不暴露外部 trace 直链。
- `billing`: 展示余额、冻结金额、运行费用和账本审计。
- `opl-launch`: 展示 OPL 启动阶段，不暴露 providerKeyRef、runtime token 或 raw key。
- `services/portal/frontend/src/app/**` 已按 Figma Make ZIP 复制为 React user Portal route 和 surface source；`services/portal/frontend/src/app/data/portalAdapters.ts` 已接现有 `/portal/api/*`。

仍不属于本 leaf 的后续事项：Portal backend services、Node 22 ESM layering、billing preauth/ledger/release T+1 后端闭环、真实云、release readiness、deploy、build/push/kubectl、live-test、secret-backed canary 和 upstream OPL 修改。B 吸收本分支后，cursor 是否推进到 `backend-product-node22-esm-layering` 必须继续由 `docs/recovery/v22-goal-current.json`、gap matrix 和 B review 规则决定；本实现分支不提前声明全局 cursor 完成。

## 验收方式

本合同的合同级验收入口是：

```bash
node tests/regression/portal/smoke-test-v22-portal-ui-design-quality-audit.mjs
```

Portal UI design quality audit 的现有执行证据由 Figma Make ZIP surface 组、React typecheck 和 build 承接：

```bash
node tests/regression/portal/smoke-test-v22-portal-runtime-suite.mjs --group surface
npm --prefix services/portal/frontend run typecheck
npm --prefix services/portal/frontend run build
```

本合同 smoke 只读取 repo-tracked 文档和 manifest，不读取 secret，不调用真实云，不执行 build/push/kubectl/live-test，不修改 upstream。

## Contract Data

<!-- v22-portal-ui-design-quality-audit-contract:start -->
```json
{
  "contract": "v22_portal_ui_design_quality_audit_boundary",
  "version": 2,
  "model": "gpt-5.4",
  "contractRole": "boundary_and_rubric_only",
  "scope": {
    "implementsUi": false,
    "prescribesSpecificAestheticSolution": false,
    "callsRealCloud": false,
    "readsSecrets": false,
    "modifiesUpstream": false,
    "modifiesServices": false,
    "migratesFrontendStack": false
  },
  "referenceBoundaries": [
    "external_ui_ux_best_practices_reference_only",
    "content_semantics_fixed_by_v22_contracts",
    "frontend_stack_migration_authorized_only_by_figma_make_implementation_leaf",
    "portal_wide_react_vite_typescript_shadcn_radix_lucide_stack",
    "audit_leaf_does_not_implement_ui"
  ],
  "mainlineQuestions": [
    "我买的是什么服务？",
    "我的 OPL 工作台现在能不能用？",
    "如果不能用，还缺哪一步？",
    "下一步应该点哪里？",
    "我的文件、任务、结果在哪里？",
    "我的余额、预扣费、冻结金额、停止计费状态是否正常？",
    "我什么时候应该释放计算资源但保留文件空间？"
  ],
  "hardRubric": [
    "mainline_questions_answered",
    "portal_opl_responsibility_boundary",
    "no_cloud_console_language_for_normal_users",
    "no_opl_chatbot_reimplementation",
    "role_surface_boundary",
    "secret_browser_hygiene",
    "responsive_no_overflow",
    "state_coverage",
    "audit_report_runtime_only"
  ],
  "softRubric": [
    "modern_saas_information_hierarchy",
    "workbench_scanability",
    "service_clarity",
    "next_action_clarity",
    "research_workspace_feel",
    "visual_density_balance",
    "copy_tone_quality"
  ],
  "auditOutput": {
    "reportPath": ".runtime/portal-ui-design-quality/report.json",
    "committedToGit": false
  },
  "baselinePolicy": {
    "intentionalRedesignCanUpdateScreenshots": true,
    "requiresAuditEvidenceBeforeBaselineUpdate": true
  },
  "auditEvidenceSchema": {
    "reportPath": ".runtime/portal-ui-design-quality/report.json",
    "reportType": "portal_ui_design_quality_audit_evidence",
    "reportCommittedToGit": false,
    "requiredSections": [
      "mainlineQuestionAnswerability",
      "hardRubricVerdicts",
      "softRubricScores",
      "surfaceAndVisualEvidenceSources",
      "expressionQualityFindings",
      "productSemanticBoundaryCheck",
      "futureImplementationLeafHandoff"
    ],
    "requiredMainlineQuestionVerdicts": [
      "我买的是什么服务？",
      "我的 OPL 工作台现在能不能用？",
      "如果不能用，还缺哪一步？",
      "下一步应该点哪里？",
      "我的文件、任务、结果在哪里？",
      "我的余额、预扣费、冻结金额、停止计费状态是否正常？",
      "我什么时候应该释放计算资源但保留文件空间？"
    ],
    "requiredHardRubricVerdicts": [
      "mainline_questions_answered",
      "portal_opl_responsibility_boundary",
      "no_cloud_console_language_for_normal_users",
      "no_opl_chatbot_reimplementation",
      "role_surface_boundary",
      "secret_browser_hygiene",
      "responsive_no_overflow",
      "state_coverage",
      "audit_report_runtime_only"
    ],
    "requiredSoftRubricScores": [
      "modern_saas_information_hierarchy",
      "workbench_scanability",
      "service_clarity",
      "next_action_clarity",
      "research_workspace_feel",
      "visual_density_balance",
      "copy_tone_quality"
    ],
    "evidenceSources": [
      "node tests/regression/portal/smoke-test-v22-portal-ui-design-quality-audit.mjs",
      "node tests/regression/portal/smoke-test-v22-portal-runtime-suite.mjs --group surface",
      "npm --prefix services/portal/frontend run typecheck",
      "npm --prefix services/portal/frontend run build"
    ],
    "findingScope": "expression_quality_only_not_product_semantics",
    "baselineUpdateGate": {
      "requiresReportBeforeScreenshotBaselineUpdate": true,
      "reportPath": ".runtime/portal-ui-design-quality/report.json"
    }
  },
  "futureImplementationLeafHandoff": {
    "leafIntent": "portal_figma_make_react_ui_implementation",
    "allowedFiles": [
      "services/portal/frontend/**",
      "DESIGN.md",
      "docs/contracts/v22-portal-ui-design-quality-audit-boundary.md",
      "docs/contracts/v22-portal-workbench-management-ui-composition-boundary.md",
      "docs/contracts/v22-saas-control-plane-user-experience-boundary.md",
      "docs/contracts/README.md",
      "docs/recovery/v22-goal-current.json",
      "docs/recovery/v22-goal-state.md",
      "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
      "docs/recovery/v22-agent-verify-manifest.json",
      "docs/recovery/mvp-contract-acceptance.md",
      "tests/regression/portal/smoke-test-v22-portal-ui-design-quality-audit.mjs",
      "tests/regression/portal/smoke-test-v22-portal-figma-make-ui-implementation-contract.mjs",
      "tests/regression/portal/smoke-test-v22-portal-runtime-suite.mjs",
      "services/portal/frontend/package.json",
      "services/portal/frontend/package-lock.json"
    ],
    "verificationCommands": [
      "node tests/regression/portal/smoke-test-v22-portal-figma-make-ui-implementation-contract.mjs",
      "node tests/regression/portal/smoke-test-v22-portal-ui-design-quality-audit.mjs",
      "node tests/regression/portal/smoke-test-v22-portal-runtime-suite.mjs --group surface",
      "npm --prefix services/portal/frontend run typecheck",
      "npm --prefix services/portal/frontend run build",
      "node tests/health/smoke-test-v22-contract-conflict-boundary.mjs",
      "node tests/contract/smoke-test-v22-goal-state-consistency.mjs",
      "node tests/contract/smoke-test-v22-agent-verify-entrypoint.mjs",
      "node tests/contract/smoke-test-v22-product-goal-harness.mjs",
      "git diff --check -- docs/contracts docs/recovery scripts services/portal/frontend"
    ],
    "truthWritebackTarget": [
      "docs/contracts/v22-portal-ui-design-quality-audit-boundary.md",
      "docs/contracts/v22-portal-workbench-management-ui-composition-boundary.md",
      "DESIGN.md",
      "docs/contracts/README.md",
      "docs/recovery/v22-goal-current.json",
      "docs/recovery/v22-goal-state.md",
      "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
      "docs/recovery/mvp-contract-acceptance.md"
    ],
    "stopConditions": [
      "requires_backend_services_change",
      "requires_non_portal_frontend_dependency_change",
      "requires_secret_or_live_cloud",
      "requires_deploy_build_push_kubectl_or_live_test",
      "changes_product_semantics_instead_of_expression_quality",
      "updates_screenshot_baseline_without_runtime_audit_report"
    ],
    "forbiddenAllowedFilePatterns": [
      "services/portal/**/backend_or_api_except_frontend",
      "non_portal_frontend_package_or_dependency_files",
      "deploy/*",
      "adapters/*",
      ".sentrux/*",
      "upstream/*",
      "secret-like paths",
      "true cloud runners"
    ],
    "forbiddenVerificationCommandPatterns": [
      "build/push/kubectl",
      "deploy",
      "live-test",
      "live-cloud",
      "secret-read",
      "dependency-upgrade"
    ]
  },
  "validationCommands": [
    "node tests/regression/portal/smoke-test-v22-portal-ui-design-quality-audit.mjs",
    "node tests/regression/portal/smoke-test-v22-portal-runtime-suite.mjs --group surface",
    "npm --prefix services/portal/frontend run typecheck",
    "npm --prefix services/portal/frontend run build"
  ]
}
```
<!-- v22-portal-ui-design-quality-audit-contract:end -->
