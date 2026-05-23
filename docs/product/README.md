# Product Truth

Owner: `MedOPL`
Purpose: `product_truth_view`
State: `hard_compacted_view`
Machine boundary: 本文是产品视角入口，不是第二份 current truth。当前唯一人读 current truth 是 `docs/active/README.md`；本文件只保产品语言、用户体验和合同分组索引。

## Product View

MedOPL v22 是 `platform-provisioned / customer-dedicated` 的 One Person Lab SaaS 控制面和托管交付平台：用户购买托管 OPL 科研工作台服务、计算能力、文件空间、任务并发和运行环境。Portal 解释服务、状态、余额、文件、账单和轨迹；OPL 继续负责科研执行和工作台内交互。

MedOPL 不是云资源控制台。普通用户产品语言不展示 CVM、COS、K8s、节点池或云控制台配置。管理员 / ops 是后台视角，不进入普通用户产品主叙事。

用户主路径是：登录 `portal.medopl.cn` -> 工作空间 -> 上传文件 / 提任务 -> 进入 OPL / 工作台 -> 看结果 -> 看费用。`opl.medopl.cn` 入口、Portal “进入 OPL 工作台”按钮和 Gateway preflight 最终进入同一套 Gateway / launch / provider binding 逻辑。

Portal 不回答科研问题，不复制 OPL chatbot。Portal 负责准备、管理、进入、回流、计费、审计和释放；OPL 负责 chatbot、agent、文件理解、任务推进、结果生成和工作台内交互体验。

普通用户主语言优先使用：账号、工作空间、计算资源、文件空间、套餐、任务并发、余额、冻结金额。租户、runtime、运行环境、environmentId 只能作为内部标签、对账标签或审计字段。

## Golden Path

MedOPL 默认产品主线是唯一黄金链路：

```text
login / credit / provider key
-> open managed environment
-> launch OPL
-> upload file / task
-> run / artifact
-> billing / trace / audit
-> release / stop billing
```

这条链路是 default verify 的第一公民。所有治理、合同、source debt、closeout 和 guardrail 都服务这条路径，不替代这条路径成为默认叙事中心。

黄金链路的最小本地健康证明由 smoke-golden lane 持有，覆盖：

- Portal SaaS 控制面用户体验边界。
- 用户充值、provider key 绑定和 `providerKeyRef` 投影。
- 托管环境开通和套餐 / 资源计划边界。
- OPL entry / Gateway preflight / launch 边界。
- Runtime Bridge session、message、fileRef、run、artifact 和 trace projection。
- Portal 文件、账单、trace 回流。
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

这六个 package 是黄金链路的后续交付顺序。每个 package 都必须单独开 `changes/active/<change-id>`，声明 Golden Path Impact、spec delta、eval plan、cannot-claim、review 和 archive closeout。

Figma Make 只提供视觉和信息架构输入；Figma absorption、typed API boundary 和 OPL entry real preflight / launch projection 已归档为 repo-native frontend/runtime truth。Portal UI 必须通过 typed API modules 和 backend projections 读取真实 preflight、launch、providerKeyRef 和 Gateway readiness 状态，不能继续展示 page-local launch readiness。当前阻塞是 real-cloud authorization boundary；它不授权 secret、真实云、deploy、kubectl、build/push 或 live-test。

Go backend 是 MedOPL control-plane business truth 的目标承载面。它应该先接管用户、workspace、provider key ref、managed environment intent、billing/audit projection 和 workflow command；OPL Web Gateway 与 Runtime Bridge 可以在迁移期继续作为薄 Node anti-corruption / relay 边界。`services/medopl-go-backend` 目录存在不等于 Go 已经是 current production backend。

## Optional Resource Lifecycle

计算资源和文件空间不是默认强制能力。未开通计算资源时，账号可以充值、管理工作空间、上传文件、绑定自己的 gflabtoken 模型调用密钥、进入 OPL 工作台或受限工作台，但不能跑平台托管计算任务。

进入 OPL 工作台和运行平台托管任务是两道 gate：workbench entry 要求账号、工作空间、Gateway / upstream entry 可用，并要求用户输入或已有自己的 gflabtoken API Key；managed run 还要求托管计算资源、文件空间、余额 / 冻结金额、`providerKeyRef` 和 Runtime Bridge 可用。

当前 MVP active 规格只落在 `full_runtime` 层：`starter_2c4g_10gb` 和 `pro_8c16g_100gb`。它们是托管运行能力的规格映射，不是第二套商业模型。

| 套餐 | 计算资源 | 文件空间 | 任务并发 |
| --- | --- | --- | --- |
| 基础套餐 | 2c / 4GB | 10GB 文件空间 | 1 个任务并发 |
| Pro 套餐 | 8c / 16GB | 100GB 文件空间 | 2 个任务并发 |

资源生命周期边界：

- 计算资源可独立开通、扩容、缩容、释放。
- 存储资源 / 文件空间可独立开通、扩容、删除。
- 释放托管运行环境不等于删除文件空间。
- 释放计算资源不删除文件空间。
- 删除存储资源 / 文件空间，或独立欠费保留策略，才进入 7 天保护期。
- 文件空间进入保护期或不可用时，新任务不能依赖该文件空间。
- 计算资源已释放但文件空间仍保留，是合法状态。
- 释放计算资源后的停止计费确认进入 `120min` 核对窗口，账单、资源、文件保留和异常处理进入 `T+1` 审计。
- 叠加计算、叠加存储和自定义规格属于 future-authorized，不能写成当前已授权真实云执行能力。

## Core User Loop

1. 平台创建 1 名用户。
2. 给用户充值额度。
3. 用户登录 `portal.medopl.cn`。
4. 用户进入工作空间，上传文件或提出任务意图。
5. 用户在 OPL entry/preflight 或工作台 provider 绑定面输入自己的 gflabtoken API Key；已绑定用户不要求重复输入。
6. 用户进入 OPL / 工作台，查看上下文、组织文件、准备任务和查看已有结果。
7. 用户选择是否开通计算资源和文件空间。
8. 如开通，用户选择基础套餐、Pro 套餐、叠加资源或自定义规格。
9. 平台在自己的 TKE/存储资源池里开通可组合资源，计算资源与文件空间可独立保留或释放。
10. Portal 展示账号的计算资源、文件空间、工作空间和资源绑定状态。
11. 开通资源后开始预扣费或冻结金额。
12. 用户通过 clean upstream OPL Web 工作。
13. 用户可以发送消息、上传文件、跑托管任务、下载输出文件。
14. Portal 可以看到 workspace 文件、账单和 session trace metadata。
15. 如果余额不足，Portal 提示将消耗冻结金额。
16. 余额或冻结金额不足时，停止新托管任务和计算资源续用，但不得把释放计算资源自动写成删除文件空间。
17. 释放计算资源只停止计算计费和托管任务续用；用户删除存储资源 / 文件空间，或独立欠费保留策略，才进入 7 天保护期。
18. 文件空间进入保护期或不可用时，新托管任务不能依赖该文件空间。
19. 计算停止计费需要在 `120min` 内核对，账单与资源状态进入 `T+1` 审计。

## Commercial Package Model

商业化主链路的客户视角是：谁都可以进入 OPL；需要平台托管计算、文件空间、隔离环境、计费和审计时，必须进入 MedOPL。MedOPL 销售的是托管 OPL 科研工作台服务和平台代管的运行能力，不销售云控制台配置权。

当前收敛后的三层商业模型：

- `api_only`: 账号、工作空间、OPL 入口、用户自己的 gflabtoken providerKeyRef、文件/任务/结果索引；不购买平台托管算力。
- `full_runtime`: 在 `api_only` 之上购买平台托管计算、文件空间、任务并发、余额/冻结金额、run/artifact/trace 回流和释放停止计费。
- `customer_dedicated`: 在 `full_runtime` 之上购买更强隔离、专属运行边界、专属审计标签和人工审批/变更窗口。

客户判断标准：

- 只需要进入 OPL 和保留工作空间上下文：`api_only`。
- 需要上云计算、托管文件空间、平台计费审计和释放：`full_runtime`。
- 需要客户级隔离、合规审计、专属资源边界和变更审批：`customer_dedicated`。

## Commercial UI Impact Decision

本阶段不修改 Portal UI 代码。当前 Portal UI 已覆盖商业化主链路的六个客户问题：买了什么、能不能用、缺什么、下一步点哪里、结果在哪里、费用是否正常。

现有 UI 覆盖关系：

- overview：托管 OPL 科研工作台服务、工作台可用性、下一步动作。
- resources：计算资源、文件空间、套餐规格、释放状态。
- workspace：文件列表、任务入口、输出结果。
- trace：任务运行轨迹、输出回流、费用关联。
- billing：余额、冻结金额、运行费用、账本审计。
- opl-launch：进入 OPL 工作台、启动阶段、provider 绑定状态。

`api_only` 复用入口和上下文状态；`full_runtime` 复用运行环境、资源、文件空间、账单和 trace surface；`customer_dedicated` 对客户可见前必须另开 UI implementation leaf，补专属隔离、审批窗口、客户级审计标签和变更窗口状态。

## Product Contract Groups

| Product question | Spec anchors |
| --- | --- |
| MVP 用户闭环、开户、充值、进入 Portal/OPL、释放和审计 | [spec:v22-mvp-managed-opl-loop](../specs/README.md#spec-v22-mvp-managed-opl-loop), [spec:v22-user-credit-provider-key-boundary](../specs/README.md#spec-v22-user-credit-provider-key-boundary) |
| Portal 是 SaaS 控制面，不是科研 chatbot 或云控制台 | [spec:v22-saas-control-plane-user-experience-boundary](../specs/README.md#spec-v22-saas-control-plane-user-experience-boundary), [spec:v22-saas-portal-opl-ops-surface-boundary](../specs/README.md#spec-v22-saas-portal-opl-ops-surface-boundary) |
| 套餐、计算资源、文件空间、任务并发和用户可见语言 | [spec:v22-resource-plan-boundary](../specs/README.md#spec-v22-resource-plan-boundary), [spec:v22-managed-environment-open-boundary](../specs/README.md#spec-v22-managed-environment-open-boundary), [spec:v22-tenant-resource-binding-boundary](../specs/README.md#spec-v22-tenant-resource-binding-boundary) |
| 商业化套餐分层、OPL 入口和 MedOPL 托管算力 gate | [spec:v22-commercial-package-model](../specs/README.md#spec-v22-commercial-package-model), [spec:v22-saas-control-plane-user-experience-boundary](../specs/README.md#spec-v22-saas-control-plane-user-experience-boundary) |
| 商业化 UI 是否需要立即修改 | [spec:v22-commercial-ui-impact-decision](../specs/README.md#spec-v22-commercial-ui-impact-decision), [spec:v22-portal-ui-design-quality-audit-boundary](../specs/README.md#spec-v22-portal-ui-design-quality-audit-boundary) |
| 余额、冻结金额、停止计费、`120min` 核对和 `T+1` 审计 | [spec:v22-billing-freeze-boundary](../specs/README.md#spec-v22-billing-freeze-boundary), [spec:v22-release-stop-billing-audit-boundary](../specs/README.md#spec-v22-release-stop-billing-audit-boundary), [spec:v22-pricing-snapshot-boundary](../specs/README.md#spec-v22-pricing-snapshot-boundary) |
| OPL 入口、用户自带 gflabtoken provider key、providerKeyRef 和 raw key 禁泄露 | [spec:v22-token-provider-boundary](../specs/README.md#spec-v22-token-provider-boundary), [spec:v22-opl-entry-preflight-auth-boundary](../specs/README.md#spec-v22-opl-entry-preflight-auth-boundary), [spec:v22-portal-opl-connection-boundary](../specs/README.md#spec-v22-portal-opl-connection-boundary) |
| 文件、账单、session trace metadata、run/artifact 回流 | [spec:v22-portal-files-billing-trace-boundary](../specs/README.md#spec-v22-portal-files-billing-trace-boundary), [spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary](../specs/README.md#spec-v22-runtime-bridge-session-run-file-provider-keyref-boundary), [spec:v22-trace-metadata-boundary](../specs/README.md#spec-v22-trace-metadata-boundary) |
| 管理台和普通用户边界 | [spec:v22-portal-user-surface-boundary](../specs/README.md#spec-v22-portal-user-surface-boundary), [spec:v22-portal-admin-ops-surface-boundary](../specs/README.md#spec-v22-portal-admin-ops-surface-boundary), [spec:v22-admin-ops-console-boundary](../specs/README.md#spec-v22-admin-ops-console-boundary) |

## Current Truth Pointer

产品语义、资源生命周期、套餐、用户自带 gflabtoken provider key、7 天保护期、`120min` 和 `T+1` 审计口径由本文和 `docs/specs/README.md` 持有。当前阶段、cursor、blocker 和 verification entry 才看 `docs/active/README.md`。旧分散 product truth 不得恢复为当前产品真相入口。
