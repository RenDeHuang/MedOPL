# Specs Truth Index

Owner: `MedOPL`
Purpose: `v22_contract_spec_index`
State: `active_index`
Machine boundary: 本文是人读 spec 导航入口，不是稳定机器接口。机器真相归 root `specs/<domain>/spec.md`、source、tests、fixtures、manifest、runner、CLI/API 行为和 runtime evidence。本文不得承载 fenced JSON、执行日志、历史 leaf 正文、current cursor 状态或 production completion claim。

## Scope

`docs/specs/README.md` 只回答“去哪里读长期合同/spec”。稳定 requirement 和 eval anchor 由 root `specs/**` 持有；产品、runtime、framework、evidence、policy、delivery、source 和 history 视角分别看对应 `docs/*/README.md`。

## Domain Spec Owners

| Domain | Owner | Durable spec | Holds |
| --- | --- | --- | --- |
| product | `MedOPL Portal` | [specs/product/spec.md](../../specs/product/spec.md) | 用户购买什么、商业套餐、普通用户/管理员边界、Portal 可宣称内容。 |
| runtime | `MedOPL Gateway / Runtime Bridge` | [specs/runtime/spec.md](../../specs/runtime/spec.md) | Portal -> Gateway -> clean OPL upstream -> Runtime Bridge / Runtime Agent 边界。 |
| framework | `MedOPL Platform` | [specs/framework/spec.md](../../specs/framework/spec.md) | repo lifecycle、cleanup、机器 cursor、review/closeout 和 truth-layer 纪律。 |
| operations | `MedOPL Operations` | [specs/operations/spec.md](../../specs/operations/spec.md) | 真实云授权、billing/release、deploy、admin ops 和 fail-closed 边界。 |
| evidence | `MedOPL Platform` | [specs/evidence/spec.md](../../specs/evidence/spec.md) | 证据等级、can-claim/cannot-claim 和 evidence routing。 |
| policies | `MedOPL Platform` | [specs/policies/spec.md](../../specs/policies/spec.md) | secret hygiene、人机边界、默认禁止操作和授权纪律。 |
| source | `MedOPL Platform` | [specs/source/spec.md](../../specs/source/spec.md) | active source surface、退役路径、Go/Portal/Runtime source owner。 |

## Contract Subscription Discipline

- 正式开发开始前必须声明本分支订阅的 domain specs、active truth、policy/delivery/source/runtime 边界和验收命令。
- 当前 truth 归 `contracts/`、`docs/active/README.md`、root `specs/**`、tests/fixtures/manifest 和 `validate:active-platform`；`changes/` 已退役，不再承载新增或修改合同的当前入口。
- 既有 spec 变更只允许通过 durable owner surfaces 吸收并同步到对应 `specs/<domain>/spec.md`，当前 active 事实不再回写到 `changes/active/<change-id>/spec-delta.md`。
- 被 source/tests/runner 直接消费的大型机器 owner payload 可以放在 root `contracts/**`，但必须由 `tests/fixtures/v22/goal-current.json` 或其他 canonical surface 显式引用，且不能把人读 prose 复制成第二份机器接口。
- 叙述性 docs 不作为测试断言对象；需要稳定判断时下沉到 schema、fixture、manifest、source contract、runner 行为或 CLI/API 输出。
- `future-authorized` 只表示未来授权边界可见，不授权真实云、secret、deploy、kubectl、live-test 或外部 mutation。
- Framework owner/readiness/surface impact 先读 `docs/framework/README.md`；evidence level 和 can-claim/cannot-claim 先读 `docs/evidence/README.md`。

## Anchor Index

这些锚点只做历史链接和人读跳转。具体 durable requirement 以对应 root domain spec 为准。

| Anchor | Domain spec |
| --- | --- |
| <a id="spec-v22-commercial-package-model"></a>`spec:v22-commercial-package-model` | [specs/product/spec.md](../../specs/product/spec.md) |
| <a id="spec-v22-commercial-ui-impact-decision"></a>`spec:v22-commercial-ui-impact-decision` | [specs/product/spec.md](../../specs/product/spec.md) |
| <a id="spec-v22-managed-environment-open-boundary"></a>`spec:v22-managed-environment-open-boundary` | [specs/product/spec.md](../../specs/product/spec.md) |
| <a id="spec-v22-portal-user-surface-boundary"></a>`spec:v22-portal-user-surface-boundary` | [specs/product/spec.md](../../specs/product/spec.md) |
| <a id="spec-v22-saas-control-plane-user-experience-boundary"></a>`spec:v22-saas-control-plane-user-experience-boundary` | [specs/product/spec.md](../../specs/product/spec.md) |
| <a id="spec-v22-user-credit-provider-boundary"></a>`spec:v22-user-credit-provider-boundary` | [specs/product/spec.md](../../specs/product/spec.md) |
| <a id="spec-v22-ai-runtime-contract-boundary"></a>`spec:v22-ai-runtime-contract-boundary` | [specs/runtime/spec.md](../../specs/runtime/spec.md) |
| <a id="spec-v22-langfuse-observability-metadata-boundary"></a>`spec:v22-langfuse-observability-metadata-boundary` | [specs/runtime/spec.md](../../specs/runtime/spec.md) |
| <a id="spec-v22-mvp-managed-opl-loop"></a>`spec:v22-mvp-managed-opl-loop` | [specs/runtime/spec.md](../../specs/runtime/spec.md) |
| <a id="spec-v22-opl-deployment-ownership-release-plan-boundary"></a>`spec:v22-opl-deployment-ownership-release-plan-boundary` | [specs/runtime/spec.md](../../specs/runtime/spec.md) |
| <a id="spec-v22-opl-entry-preflight-auth-boundary"></a>`spec:v22-opl-entry-preflight-auth-boundary` | [specs/runtime/spec.md](../../specs/runtime/spec.md) |
| <a id="spec-v22-opl-work-message-file-run-boundary"></a>`spec:v22-opl-work-message-file-run-boundary` | [specs/runtime/spec.md](../../specs/runtime/spec.md) |
| <a id="spec-v22-portal-storage-usage-billing-boundary"></a>`spec:v22-portal-storage-usage-billing-boundary` | [specs/runtime/spec.md](../../specs/runtime/spec.md) |
| <a id="spec-v22-portal-opl-connection-boundary"></a>`spec:v22-portal-opl-connection-boundary` | [specs/runtime/spec.md](../../specs/runtime/spec.md) |
| <a id="spec-v22-portal-opl-context-backflow-boundary"></a>`spec:v22-portal-opl-context-backflow-boundary` | [specs/runtime/spec.md](../../specs/runtime/spec.md) |
| <a id="spec-v22-real-opl-capability-canary-boundary"></a>`spec:v22-real-opl-capability-canary-boundary` | [specs/runtime/spec.md](../../specs/runtime/spec.md) |
| <a id="spec-v22-real-opl-file-run-artifact-canary-boundary"></a>`spec:v22-real-opl-file-run-artifact-canary-boundary` | [specs/runtime/spec.md](../../specs/runtime/spec.md) |
| <a id="spec-v22-real-opl-provider-message-canary-boundary"></a>`spec:v22-real-opl-provider-message-canary-boundary` | [specs/runtime/spec.md](../../specs/runtime/spec.md) |
| <a id="spec-v22-runtime-bridge-session-run-file-provider-keyref-boundary"></a>`spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary` | [specs/runtime/spec.md](../../specs/runtime/spec.md) |
| <a id="spec-v22-saas-portal-opl-ops-surface-boundary"></a>`spec:v22-saas-portal-opl-ops-surface-boundary` | [specs/runtime/spec.md](../../specs/runtime/spec.md) |
| <a id="spec-v22-token-provider-boundary"></a>`spec:v22-token-provider-boundary` | [specs/runtime/spec.md](../../specs/runtime/spec.md) |
| <a id="spec-v22-upstream-opl-boundary"></a>`spec:v22-upstream-opl-boundary` | [specs/runtime/spec.md](../../specs/runtime/spec.md) |
| <a id="spec-v22-admin-ops-console-boundary"></a>`spec:v22-admin-ops-console-boundary` | [specs/operations/spec.md](../../specs/operations/spec.md) |
| <a id="spec-v22-authorized-tencent-create-release-boundary"></a>`spec:v22-authorized-tencent-create-release-boundary` | [specs/operations/spec.md](../../specs/operations/spec.md) |
| <a id="spec-v22-authorized-tencent-create-release-execution-boundary"></a>`spec:v22-authorized-tencent-create-release-execution-boundary` | [specs/operations/spec.md](../../specs/operations/spec.md) |
| <a id="spec-v22-authorized-tencent-create-release-implementation-boundary"></a>`spec:v22-authorized-tencent-create-release-implementation-boundary` | [specs/operations/spec.md](../../specs/operations/spec.md) |
| <a id="spec-v22-authorized-tencent-deploy-execution-boundary"></a>`spec:v22-authorized-tencent-deploy-execution-boundary` | [specs/operations/spec.md](../../specs/operations/spec.md) |
| <a id="spec-v22-billing-freeze-boundary"></a>`spec:v22-billing-freeze-boundary` | [specs/operations/spec.md](../../specs/operations/spec.md) |
| <a id="spec-v22-cloud-onboarding-workflow-boundary"></a>`spec:v22-cloud-onboarding-workflow-boundary` | [specs/operations/spec.md](../../specs/operations/spec.md) |
| <a id="spec-v22-portal-admin-ops-surface-boundary"></a>`spec:v22-portal-admin-ops-surface-boundary` | [specs/operations/spec.md](../../specs/operations/spec.md) |
| <a id="spec-v22-precloud-deployable-rc-boundary"></a>`spec:v22-precloud-deployable-rc-boundary` | [specs/operations/spec.md](../../specs/operations/spec.md) |
| <a id="spec-v22-pricing-snapshot-boundary"></a>`spec:v22-pricing-snapshot-boundary` | [specs/operations/spec.md](../../specs/operations/spec.md) |
| <a id="spec-v22-production-cloud-topology-boundary"></a>`spec:v22-production-cloud-topology-boundary` | [specs/operations/spec.md](../../specs/operations/spec.md) |
| <a id="spec-v22-release-stop-billing-audit-boundary"></a>`spec:v22-release-stop-billing-audit-boundary` | [specs/operations/spec.md](../../specs/operations/spec.md) |
| <a id="spec-v22-resource-plan-boundary"></a>`spec:v22-resource-plan-boundary` | [specs/operations/spec.md](../../specs/operations/spec.md) |
| <a id="spec-v22-tenant-resource-binding-boundary"></a>`spec:v22-tenant-resource-binding-boundary` | [specs/operations/spec.md](../../specs/operations/spec.md) |
| <a id="spec-v22-tencent-dry-run-resource-plan-provider-boundary"></a>`spec:v22-tencent-dry-run-resource-plan-provider-boundary` | [specs/operations/spec.md](../../specs/operations/spec.md) |
| <a id="spec-v22-tencent-readonly-inventory-boundary"></a>`spec:v22-tencent-readonly-inventory-boundary` | [specs/operations/spec.md](../../specs/operations/spec.md) |
| <a id="spec-v22-tencent-readonly-quote-provider-boundary"></a>`spec:v22-tencent-readonly-quote-provider-boundary` | [specs/operations/spec.md](../../specs/operations/spec.md) |
| <a id="spec-v22-tencent-tc3-diagnostic-cleanup-plan"></a>`spec:v22-tencent-tc3-diagnostic-cleanup-plan` | [specs/operations/spec.md](../../specs/operations/spec.md) |
| <a id="spec-v22-tke-bootstrap-preflight-boundary"></a>`spec:v22-tke-bootstrap-preflight-boundary` | [specs/operations/spec.md](../../specs/operations/spec.md) |
| <a id="spec-v22-backend-go-convergence-program-boundary"></a>`spec:v22-backend-go-convergence-program-boundary` | [specs/source/spec.md](../../specs/source/spec.md) |
| <a id="spec-v22-go-control-plane-mvp-takeover-boundary"></a>`spec:v22-go-control-plane-mvp-takeover-boundary` | [specs/source/spec.md](../../specs/source/spec.md) |
| <a id="spec-v22-portal-figma-make-ui-implementation-boundary"></a>`spec:v22-portal-figma-make-ui-implementation-boundary` | [specs/source/spec.md](../../specs/source/spec.md) |
| <a id="spec-v22-portal-structure-failure-isolation-boundary"></a>`spec:v22-portal-structure-failure-isolation-boundary` | [specs/source/spec.md](../../specs/source/spec.md) |
| <a id="spec-v22-portal-ui-design-quality-audit-boundary"></a>`spec:v22-portal-ui-design-quality-audit-boundary` | [specs/source/spec.md](../../specs/source/spec.md) |
| <a id="spec-v22-portal-resource-control-ui-composition-boundary"></a>`spec:v22-portal-resource-control-ui-composition-boundary` | [specs/source/spec.md](../../specs/source/spec.md) |
| <a id="spec-v22-smoke-eval-boundary"></a>`spec:v22-smoke-eval-boundary` | [specs/source/spec.md](../../specs/source/spec.md) |

## Package Templates

| Change type | Read first | Typical eval entry |
| --- | --- | --- |
| Portal / UI | `docs/product/README.md`, `specs/product/spec.md`, `specs/source/spec.md` | `npm --prefix services/portal/frontend run typecheck` and product/portal tests |
| OPL Entry / Gateway | `docs/runtime/README.md`, `specs/runtime/spec.md` | OPL gateway/runtime regression tests |
| Runtime Bridge | `docs/runtime/README.md`, `specs/runtime/spec.md` | runtime bridge contract/smoke tests |
| Resource / Billing / Audit | `docs/product/README.md`, `docs/delivery/README.md`, `specs/operations/spec.md` | product smoke plus operations gates |
| Tencent / Cloud / Deploy | `docs/delivery/README.md`, `specs/operations/spec.md`, `docs/policies/README.md` | future-authorized dry-run gates only unless separately authorized |
| Cleanup / Framework | `AGENTS.md`, `TASTE.md`, `docs/framework/README.md`, `specs/framework/spec.md` | repo hygiene, line budget, review gate and targeted lifecycle tests |

## Current Truth Pointer

- 当前阶段、cursor、blocker 和 verification entry 看 [docs/active/README.md](../active/README.md)。
- 产品语义看 [docs/product/README.md](../product/README.md) 和 [specs/product/spec.md](../../specs/product/spec.md)。
- runtime / clean upstream / no-fake-success 看 [docs/runtime/README.md](../runtime/README.md) 和 [specs/runtime/spec.md](../../specs/runtime/spec.md)。
- 云、deploy、release、真实资源授权顺序看 [docs/delivery/README.md](../delivery/README.md)、[docs/policies/README.md](../policies/README.md) 和 [specs/operations/spec.md](../../specs/operations/spec.md)。
- 历史 leaf、旧路线和 landed closeout 看 [docs/history/README.md](../history/README.md) 与 git history。
