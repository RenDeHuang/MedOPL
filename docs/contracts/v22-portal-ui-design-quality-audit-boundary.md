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

硬约束用于阻断污染和基础可用性退化。任何硬约束失败，都不能只靠视觉分数或截图 baseline 通过：

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

## 与现有 UI 合同关系

本合同不替代 UI composition 合同。分工如下：

- `v22-saas-control-plane-user-experience-boundary.md` 定义用户体验主线问题。
- `v22-portal-workbench-management-ui-composition-boundary.md` 定义 UI 分层、evalset、DOM anchor、fixture、截图回归和统一验证入口。
- 本合同定义 design quality audit 的评价标准、报告形态和 baseline 更新边界。

视觉回归只能证明“和 baseline 一致”，不能证明 baseline 本身足够好。截图 baseline 可以因有意 redesign 更新，但必须先有 `.runtime/portal-ui-design-quality/report.json` 审计证据说明哪些硬约束仍通过、哪些软评分改善，以及为什么这是有意改版而不是偶然漂移。

## 验收方式

本合同的合同级验收入口是：

```bash
node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs
```

Portal UI design quality audit 的现有执行证据由 composition/evalset 的 surface 组和截图回归承接：

```bash
node scripts/smoke-test-v22-portal-runtime-suite.mjs --group surface
npm --prefix services/portal/frontend run test:visual
```

本合同 smoke 只读取 repo-tracked 文档和 manifest，不读取 secret，不调用真实云，不执行 build/push/kubectl/live-test，不修改 upstream。

## Contract Data

<!-- v22-portal-ui-design-quality-audit-contract:start -->
```json
{
  "contract": "v22_portal_ui_design_quality_audit_boundary",
  "version": 1,
  "model": "gpt-5.4",
  "contractRole": "boundary_and_rubric_only",
  "scope": {
    "implementsUi": false,
    "prescribesSpecificAestheticSolution": false,
    "callsRealCloud": false,
    "readsSecrets": false,
    "modifiesUpstream": false,
    "modifiesServices": false
  },
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
  "validationCommands": [
    "node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs",
    "node scripts/smoke-test-v22-portal-runtime-suite.mjs --group surface",
    "npm --prefix services/portal/frontend run test:visual"
  ]
}
```
<!-- v22-portal-ui-design-quality-audit-contract:end -->
