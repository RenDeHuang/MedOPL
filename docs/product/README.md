# Product Truth

Owner: `MedOPL`
Purpose: `product_truth_view`
State: `hard_compacted_view`
Machine boundary: 本文是产品视角入口，不是第二份 current truth。当前唯一人读 current truth 是 `docs/active/README.md`；本文件只保产品语言、用户体验和合同分组索引。

## Product View

MedOPL v22 是 OPL-Webui 的商业资源控制面：用户在 MedOPL 完成账号创建/批准、充值/授信、套餐选择、计算资源、存储空间、任务并发、费用与释放能力管理。OPL-Webui 是主要 consumer / entry surface：登录用户日常 ordinary chat、项目 / session、skill 上传、文件管理和科研任务体验留在 OPL-Webui；只有数据分析、文件任务、长任务或其他 `runtime_required` 能力才通过 runtime gate 进入 MedOPL 控制面。MedOPL 不把自己写成 OPL-Webui，也不复制 OPL chatbot。

当前愿景收口到一条明确 slice：OPL-Webui 登录用户在当前 workspace 通过 MedOPL 选择套餐、开通计算资源和存储空间；MedOPL 返回 resourceBinding、storageBinding、billing/freeze/release 状态给 OPL-Webui；用户回到 OPL-Webui 做科研，MedOPL 只从资源视角展示存储空间清单、用量、费用、释放计算资源和按显式意图销毁存储空间。这个 slice 是 current 产品目标，不等于已经取得 production owner receipt。

MedOPL 不是云资源控制台。普通用户产品语言不展示 CVM、COS、K8s、节点池或云控制台配置。管理员 / ops 是后台视角，不进入普通用户产品主叙事。

用户主路径是：登录 OPL -> ordinary chat 或触发 runtime_required -> OPL entry surface 调用 MedOPL runtime gate -> MedOPL 引导用户购买套餐、开通计算资源和存储空间 -> MedOPL 展示资源是否可用、存储空间里有什么、费用是多少 -> 用户进入 OPL 继续科研 -> MedOPL 完成 release / stop billing / storage destroy intent。Portal 是资源购买与计算资源管理视角，不是普通 chat 的主入口。

MedOPL 不回答科研问题，不复制 OPL chatbot，不评判 OPL 科研能力质量。MedOPL 负责计算资源、存储空间、套餐、任务并发、usage/billing、release、storage destroy intent 和运维审计 receipt；OPL-Webui 负责 ordinary chat、项目 / session、文件管理、skill 上传、任务推进和结果展示体验；OPL 负责 framework、runtime semantics、agent / skill protocol 和科研执行 runtime。

MedOPL 的业务准入 truth 是 owner-created-or-approved MedOPL account with sufficient plan/balance/quota：账号存在且已由 owner/平台创建、批准或开通，并满足 plan/balance/quota。`runtime_required` 主业务 gate 必须检查账号存在、账号已由 owner/平台批准或开通、workspace 存在、需要时已有 `providerKeyRef`、已选择套餐、余额足够、quota 可用且没有平台 emergency stop；余额或套餐不足时返回 purchase / recharge / select_plan action，余额足够后才允许开通 compute resource 和 storage space。Release Image、Cloud Rollout 和 receipt manifest 是 operations/release substrate；它们不是 recharge、billing、plan、quota、cost ceiling 或 business admission truth。

普通用户主语言优先使用：账号、工作空间、计算资源、存储空间、套餐、任务并发、余额、冻结金额、费用与用量。租户、runtime、environmentId、resourceBindingId 和 billingAttributionId 只能作为内部标签、对账标签或审计字段。

用户侧只回答六个资源问题：

- 我买了什么资源？
- 资源是否可用？
- 存储空间里有什么？
- 套餐是什么？
- 费用是多少？
- 去哪里购买、升级、释放资源或进入 OPL？

## Golden Path

MedOPL 默认产品主线是唯一黄金链路：

```text
account / balance
-> account approved by platform
-> package selection
-> compute resource open
-> storage space ready
-> OPL workspace binding
-> storage inventory / usage
-> billing / usage
-> release compute resource
-> retain or destroy storage space
-> enter OPL
```

这条链路是 default verify 的第一公民。所有治理、合同、source debt、closeout 和 guardrail 都服务这条路径，不替代这条路径成为默认叙事中心。

黄金链路的最小本地健康证明由 smoke-golden lane 持有，覆盖：

- Portal SaaS 控制面用户体验边界。
- 用户充值、provider key 绑定和 `providerKeyRef` 投影。
- 计算资源开通和套餐 / 资源计划边界。
- 存储空间容量、已用空间、输入文件 / 输出文件资源清单和保留期边界。
- OPL entry / Gateway preflight / launch 边界。
- Runtime Bridge 只作为 OPL integration reference，不拥有用户侧产品主线。
- Portal 文件资源清单、账单和用量回流。
- release / stop billing / audit closure。

Can claim:

- local golden smoke 证明默认产品 spine 的 repo-local 合同形状、投影和 fail-closed 行为仍然存在。
- default current verification 必须先展示 golden path health，再展示 governance guardrails。

Cannot claim:

- local golden smoke 不证明真实云开通、真实扣费、production deploy、kubectl rollout、live provider 或 production runtime。
- governance gate 通过不等于黄金链路健康；如果黄金链路 fail，默认 verify 必须先暴露 product failure。

## Productization Roadmap

Local RC 之后的产品化顺序以用户体验为中心，不以治理面完整性为中心：

```text
Figma UI repo-native absorption
-> typed Portal API contract
-> provider key reuse
-> OPL entry real preflight / launch state
-> Go control-plane takeover
-> real-cloud authorization
```

这六个 package 是黄金链路的后续交付顺序。当前 truth 归 `contracts/`、`docs/active/README.md`、root `specs/**`、tests/fixtures/manifest 和 `validate:active-platform`；`changes/` 已退役，不再作为每个 package 的当前入口或 archive 目标。

Commercial Launch UI baseline 已由 `contracts/medopl-commercial-launch-freeze-matrix.json` 冻结：批准的 Figma Make 方向是 Commercial Launch 的视觉和信息架构 baseline，repo-native contracts、source、tests 和 browser regression 才是机器 truth。Portal UI 必须通过 typed API modules 和 backend projections 读取真实 preflight、launch、providerKeyRef 和 Gateway readiness 状态，不能继续展示 page-local launch readiness。Local RC 复验商业业务流：account prepare -> account approval -> credit -> plan -> open runtime/storage -> upload/run/artifact -> billing ledger -> statement reconciliation -> release/destroy/stop billing。真实云、secret、deploy、kubectl、build/push 或 live-test 仍需要单独授权，不是本地产品 truth。

Go backend 是 MedOPL control-plane business truth 的本地 MVP takeover 承载面。它必须先接管用户、workspace、provider key ref、套餐、计算资源 intent、存储空间 inventory、billing/audit receipt 和 resource lifecycle command；OPL Web Gateway 与 Runtime Bridge 可以在迁移期继续作为薄 Node anti-corruption / relay 边界。`services/medopl-go-backend` 只有在 Go local RC eval 通过后才能进入 real-cloud-readiness；目录存在不等于 production backend 已完成。

## Commercial Production Maturity Gap

当前 business-flow 已完成，不再重开 business closure gap。当前 canClaim 只有：authorized commercial business-flow cloud canary passed；internal credit + billing ledger + statement reconciliation + release/destroy/stop billing passed；approved Commercial Launch UI baseline replacement absorbed into repo-native Portal contracts/source/tests。Commercial Launch UI freeze matrix 固定了批准 Figma Make 方向、客户信息架构、页面状态、交互流、视觉语法、copy、商业准入、账务成本、release lifecycle 和 rollout receipt 边界；它允许 claim approved UI baseline replacement，不允许 claim rollout complete、production complete、external PSP settlement、all users/all tenants、SLA/multi-region、enterprise compliance 或 ongoing authorization。

临时 commercial production maturity gap 由 `tests/fixtures/v22/goal-current.json` 持有机器矩阵。矩阵参考 OPL ordinary path 的 consumer bridge/deeplink/projection 边界，以及 sub2api-style 成熟项目结构里的 packaging、install、config、release、CI/security 和 operations 维度；这些只是工程成熟度参考，不改变 MedOPL 的业务 truth，也不把 MedOPL 写成 OPL-Webui 本体或外部 PSP。

Payment / Admin Payment API maturity boundary 已固定：当前 production mode 仍是 owner/admin recharge 或 internal credit；Payment ledger 只作为真实资金流的未来边界，负责 payment order、payment intent、provider config、PSP webhook intake、settlement event、refund event、invoice metadata、payment reconciliation 和 admin payment operation audit。Billing ledger 继续负责资源使用流：account balance、credit、hold、debit、usage statement、release/destroy/stop billing。两者通过 account、statement、payment order、provider event ref 和 ledger event refs 对齐。当前不能 claim external PSP settlement、real payment completed、provider refund completed、invoice issuance 或 tax/compliance complete。已完成并退役的 maturity goals 不再作为下一步推荐；当前 next goal 以 `tests/fixtures/v22/goal-current.json` 中的 `goal-commercial-release-metadata-rollback-maturity` 为准。

## Optional Resource Lifecycle

计算资源和存储空间不是默认强制能力。未开通计算资源时，账号可以充值、管理工作空间、上传文件、绑定自己的 gflabtoken 模型调用密钥、进入 OPL 或受限 OPL 界面，但不能跑平台托管计算任务。

进入 OPL 和运行平台托管任务是两道 gate：OPL entry 要求账号、工作空间、Gateway / upstream entry 可用，并要求用户输入或已有自己的 gflabtoken API Key；managed run 还要求托管计算资源、存储空间、余额 / 冻结金额、`providerKeyRef` 和 Runtime Bridge 可用。

当前 MVP active 规格只落在 `full_runtime` 层：`starter_2c4g_10gb` 和 `pro_8c16g_100gb`。它们是托管运行能力的规格映射，不是第二套商业模型。用户可以升级配置，但只能选择 MedOPL plan catalog allowlist 里的规格，不能任意填写云厂商 instance type。

| 套餐 | 计算资源 | 存储空间 | 任务并发 |
| --- | --- | --- | --- |
| 基础套餐 | 2c / 4GB | 10GB 存储空间 | 1 个任务并发 |
| Pro 套餐 | 8c / 16GB | 100GB 存储空间 | 2 个任务并发 |

资源生命周期边界：

- 计算资源可独立开通、扩容、缩容、释放。
- 存储资源 / 存储空间可独立开通、扩容、删除。
- 释放计算资源不等于删除存储空间。
- 释放计算资源不删除存储空间。
- 删除存储资源 / 存储空间，或独立欠费保留策略，才进入 7 天保护期。
- 存储空间进入保护期或不可用时，新任务不能依赖该存储空间。
- 计算资源已释放但存储空间仍保留，是合法状态。
- 释放计算资源后的停止计费确认进入 `120min` 核对窗口，账单、资源、文件保留和异常处理进入 `T+1` 审计。
- 叠加计算、叠加存储和自定义规格属于 future-authorized，不能写成当前已授权真实云执行能力。

## Core User Loop

1. 平台创建 1 名用户。
2. 给用户充值额度。
3. 用户登录 `portal.medopl.cn`。
4. 用户进入工作空间，上传文件或提出任务意图。
5. 用户在 OPL entry/preflight 或 OPL provider 绑定面输入自己的 gflabtoken API Key；已绑定用户不要求重复输入。
6. 用户进入 OPL，查看上下文、组织文件、准备任务和查看已有结果。
7. 用户选择是否开通计算资源和存储空间。
8. 如开通，用户选择基础套餐、Pro 套餐，或已进入 MedOPL plan catalog allowlist 的升级规格。
9. 平台在统一 TKE 集群内为该租户或 workspace resource binding 创建独立 tenant node pool，并绑定存储空间、计费和审计；计算资源与存储空间可独立保留或释放。
10. Portal 展示账号的计算资源、存储空间、工作空间和资源绑定状态。
11. 开通资源后开始预扣费或冻结金额。
12. 用户通过 clean upstream OPL Web 工作。
13. 用户可以发送消息、上传文件、跑托管任务、下载输出文件。
14. Portal 可以从资源视角看到存储空间的输入文件 / 输出文件清单、容量、保留期和费用用量摘要。
15. 如果余额不足，Portal 提示将消耗冻结金额。
16. 余额或冻结金额不足时，停止新托管任务和计算资源续用，但不得把释放计算资源自动写成删除存储空间。
17. 释放计算资源只停止计算计费和托管任务续用；用户删除存储资源 / 存储空间，或独立欠费保留策略，才进入 7 天保护期。
18. 存储空间进入保护期或不可用时，新托管任务不能依赖该存储空间。
19. 计算停止计费需要在 `120min` 内核对，账单与资源状态进入 `T+1` 审计。

## Commercial Package Model

商业化主链路的客户视角是：谁都可以进入 OPL；需要平台托管计算、存储空间、隔离环境、计费和审计 receipt 时，必须进入 MedOPL。MedOPL 销售的是 OPL 所需的计算资源、存储空间、套餐、并发和费用管理，不销售云控制台配置权。

当前收敛后的三层商业模型：

- `api_only`: 账号、工作空间、OPL 入口、用户自己的 gflabtoken providerKeyRef、文件/任务/结果索引；不购买平台托管算力。
- `full_runtime`: 在 `api_only` 之上购买平台托管计算、存储空间、任务并发、余额/冻结金额、用量计费、资源清单和释放停止计费。
- `customer_dedicated`: 在 `full_runtime` 之上购买更强隔离、专属运行边界、专属审计标签和人工审批/变更窗口。

客户判断标准：

- 只需要进入 OPL 和保留工作空间上下文：`api_only`。
- 需要上云计算、托管存储空间、平台计费审计和释放：`full_runtime`。
- 需要客户级隔离、合规审计、专属资源边界和变更审批：`customer_dedicated`。

## Commercial UI Impact Decision

当前 Portal UI 必须收窄为资源购买与计算资源管理 Portal。用户侧只回答六个资源问题：买了什么资源、资源是否可用、存储空间里有什么、套餐是什么、费用是多少、去哪里购买 / 升级 / 释放资源或进入 OPL。

现有 UI 覆盖关系：

- overview：资源总览、当前套餐、计算资源状态、存储空间状态、余额 / 冻结金额、下一步资源动作。
- packages：套餐与购买、基础 / Pro 套餐、计算规格、存储容量、并发数、价格标签、购买 / 升级动作。
- resources：计算资源、规格、绑定的 OPL workspace、开通时间、计费状态、释放状态。
- workspace：存储空间、容量、已用空间、输入文件 / 输出文件资源清单、保留期和保护期。
- billing：费用与用量、余额、冻结金额、计算用量、存储用量、每日费用、账单明细、停止计费核对和 T+1 审计状态。
- opl-launch：进入 OPL、runtime_required gate、存储绑定 gate、provider key gate 和缺失步骤。

用户侧没有观测性或调试主导航。用量明细归 `billing`，资源文件归 `workspace`，审计事件只作为账单 / 释放 / 存储生命周期 receipt 支撑。`api_only` 复用入口和上下文状态；`full_runtime` 复用计算资源、存储空间、套餐、账单和用量 surface；`customer_dedicated` 对客户可见前必须另开 UI implementation leaf，补专属隔离、审批窗口、客户级审计标签和变更窗口状态。

Portal UI 设计判断归根层 `DESIGN.md`；机器约束归 `contracts/medopl-portal-page-state-matrix.json` 和 frontend/regression tests。产品 README 只保产品语言和 owner 指针，不承载 Figma 截图、页面长稿、raw 视觉 evidence 或 UI 评审流水。

## Product Contract Groups

| Product question | Spec anchors |
| --- | --- |
| 托管用户闭环、开户、充值、进入 Portal/OPL、释放和审计 | [spec:v22-mvp-managed-opl-loop](../specs/README.md#spec-v22-mvp-managed-opl-loop), [spec:v22-user-credit-provider-key-boundary](../specs/README.md#spec-v22-user-credit-provider-key-boundary) |
| Portal 是 SaaS 控制面，不是科研 chatbot 或云控制台 | [spec:v22-saas-control-plane-user-experience-boundary](../specs/README.md#spec-v22-saas-control-plane-user-experience-boundary), [spec:v22-saas-portal-opl-ops-surface-boundary](../specs/README.md#spec-v22-saas-portal-opl-ops-surface-boundary) |
| 套餐、计算资源、存储空间、任务并发和用户可见语言 | [spec:v22-resource-plan-boundary](../specs/README.md#spec-v22-resource-plan-boundary), [spec:v22-managed-environment-open-boundary](../specs/README.md#spec-v22-managed-environment-open-boundary), [spec:v22-tenant-resource-binding-boundary](../specs/README.md#spec-v22-tenant-resource-binding-boundary) |
| 商业化套餐分层、OPL 入口和 MedOPL 托管算力 gate | [spec:v22-commercial-package-model](../specs/README.md#spec-v22-commercial-package-model), [spec:v22-saas-control-plane-user-experience-boundary](../specs/README.md#spec-v22-saas-control-plane-user-experience-boundary) |
| 商业化 UI 是否需要立即修改与如何冻结 | [spec:v22-commercial-launch-freeze-baseline](../specs/README.md#spec-v22-commercial-launch-freeze-baseline), [spec:v22-commercial-ui-impact-decision](../specs/README.md#spec-v22-commercial-ui-impact-decision), [spec:v22-portal-ui-design-quality-audit-boundary](../specs/README.md#spec-v22-portal-ui-design-quality-audit-boundary) |
| 余额、冻结金额、停止计费、`120min` 核对和 `T+1` 审计 | [spec:v22-billing-freeze-boundary](../specs/README.md#spec-v22-billing-freeze-boundary), [spec:v22-release-stop-billing-audit-boundary](../specs/README.md#spec-v22-release-stop-billing-audit-boundary), [spec:v22-pricing-snapshot-boundary](../specs/README.md#spec-v22-pricing-snapshot-boundary) |
| OPL 入口、用户自带 gflabtoken provider key、providerKeyRef 和 raw key 禁泄露 | [spec:v22-token-provider-boundary](../specs/README.md#spec-v22-token-provider-boundary), [spec:v22-opl-entry-preflight-auth-boundary](../specs/README.md#spec-v22-opl-entry-preflight-auth-boundary), [spec:v22-portal-opl-connection-boundary](../specs/README.md#spec-v22-portal-opl-connection-boundary) |
| 存储空间清单、文件资源引用、用量和账单 receipt | [spec:v22-portal-storage-usage-billing-boundary](../specs/README.md#spec-v22-portal-storage-usage-billing-boundary), [spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary](../specs/README.md#spec-v22-runtime-bridge-session-run-file-provider-keyref-boundary) |
| 管理台和普通用户边界 | [spec:v22-portal-user-surface-boundary](../specs/README.md#spec-v22-portal-user-surface-boundary), [spec:v22-portal-admin-ops-surface-boundary](../specs/README.md#spec-v22-portal-admin-ops-surface-boundary), [spec:v22-admin-ops-console-boundary](../specs/README.md#spec-v22-admin-ops-console-boundary) |

## Current Truth Pointer

产品语义、资源生命周期、套餐、用户自带 gflabtoken provider key、7 天保护期、`120min` 和 `T+1` 审计口径由本文和 `docs/specs/README.md` 持有。当前阶段、cursor、blocker 和 verification entry 才看 `docs/active/README.md`。旧分散 product truth 不得恢复为当前产品真相入口。
