# Active Truth

Owner: `MedOPL`
Purpose: `current_state_vs_ideal_gap`
State: `active_current_truth`
Machine boundary: 本文是唯一人读 current truth 文件。机器 cursor、last absorbed commit、branch override 和 verification bundle 以 `tests/fixtures/v22/goal-current.json` 与 `tests/fixtures/v22/agent-verify-manifest.json` 为准。`docs/product/README.md`、`docs/runtime/README.md`、`docs/specs/README.md`、`docs/policies/README.md`、`docs/delivery/README.md`、`docs/source/README.md`、`docs/references/README.md`、`docs/history/README.md` 只提供视角索引，不再承载第二份 current truth。

## Ideal State

MedOPL v22 是 `platform-provisioned / customer-dedicated` 的 OPL SaaS 托管科研工作台。用户购买套餐、计算能力、文件空间、任务并发和运行环境；平台负责开通、隔离、计费、审计和释放。MedOPL 不是云资源控制台，不是用户自配 CVM/COS/K8s/TKE。

## Current State

### 当前阶段真相

当前 trunk 已完成合同级闭环、本地 deterministic eval、本地 smoke/local proof、Portal Workspace 文件动作闭环和 Portal-OPL file/run/artifact 本地闭环。当前不是真实云生产闭环，不是 PostgreSQL/Redis production data layer 完成态，也不是 admin 全业务闭环完成态。

当前 product cursor 是 `leaf-portal-postgres-redis-local-production-data-closure`。下一业务 leaf 必须让 PostgreSQL 成为 local production data 的 canonical truth，让 Redis 只用于 session/cache/queue/lock。`PORTAL_STORAGE_MODE=postgres_redis` 缺连接或 schema 时必须 fail-closed，不得回退 JSON 文件或伪成功。

本 hard compaction branch 只做 docs taxonomy truth 压缩和旧 recovery truth 文件物理清退，不实现 PostgreSQL/Redis，不推进业务 cursor，不修改 services。

当前已收敛的事实：

- Portal、OPL Web Gateway、Runtime Bridge / Runtime Agent 是 v22 active product chain。
- `scripts/v22-verify.mjs current/suite ...` 是默认 agent-facing verification 入口。
- `tests/**/*.mjs` 当前是 repo-local eval 文件族，不全是 smoke。
- `docs/history/README.md` 是 evidence 摘要入口，不是 product truth。
- 释放计算资源后的停止计费确认进入 `120min` 核对窗口，账单、资源、文件保留和异常处理进入 `T+1` 审计。

当前未闭合的事实：

- PostgreSQL/Redis local production data closure 仍未实现。
- 真实云、deploy、kubectl、live-test、真实资源 mutation、真实价格审批和 production release readiness 仍需单独授权。
- `scripts/sync-workspace-file-to-minio.ps1` 因 `services/portal/src/config/portal-config.mjs` 仍引用，暂属服务实现债，不在 docs/eval 清退中删除。

## 产品真相

MedOPL 是 One Person Lab 的 SaaS 控制面和托管交付平台。它不重做 OPL chatbot，不成为独立科研聊天产品；它把 clean upstream OPL 变成开箱即用、可购买、可管理、可计费、可审计、可释放的托管服务。

用户购买的是托管 OPL 科研工作台服务、计算能力、文件空间、任务并发和运行环境，不是云资源控制台对象。Portal 必须让用户知道自己买的是什么服务、工作台是否可用、还缺哪一步、下一步点哪里、文件/任务/结果在哪里，以及余额、预扣费、冻结金额和停止计费状态是否正常。

用户在 Portal 主动开通托管计算资源和文件空间，平台代管底层云资源，普通用户不直接配置 CVM、COS、K8s。

Portal 不回答科研问题，不复制 OPL 的 chatbot。OPL 负责科研执行：chatbot、agent、文件理解、任务推进、结果生成和工作台内交互体验。Portal 负责准备、管理、进入、回流、计费、审计和释放。

普通用户主语言优先使用：账号、工作空间、计算资源、文件空间、套餐、任务并发、余额、冻结金额。租户 / runtime / 运行环境 / environmentId 只能作为内部标签、对账标签或审计字段。

## 工作台资源是可选能力

计算资源和文件空间不是默认强制提供能力。

- 工作空间是业务容器。
- 用户在 Portal 主动开通托管计算资源和文件空间。
- 未开通计算资源时，账号可以充值、查看 Portal 状态和 OPL entry/preflight provider key 绑定状态，但不能跑托管计算任务。
- 账号在工作空间下开通计算资源且文件空间可用后，才能使用平台托管计算资源跑任务。
- 计算资源可独立开通、扩容、缩容、释放。
- 存储资源 / 文件空间可独立开通、扩容、删除。
- 释放托管运行环境不等于删除文件空间。
- 释放计算资源不删除文件空间。
- 释放计算资源不触发文件空间 7 天保护期。
- 释放计算资源不让文件空间进入 7 天保护期。
- 删除存储资源 / 文件空间，或独立欠费保留策略，才进入 7 天保护期。
- 用户删除文件空间才进入 7 天保护期，平台保留数据以降低误删风险。
- 文件空间进入保护期或不可用时，新任务不能依赖该文件空间。
- 计算资源已释放但文件空间仍保留，是合法状态。
- 计算资源和存储资源都必须绑定到账号、工作空间和内部治理边界，不能存在无归属资源。

当前 MVP active 套餐只有 `starter_2c4g_10gb` 和 `pro_8c16g_100gb`。

| 套餐 | 计算资源 | 文件空间 | 任务并发 |
| --- | --- | --- | --- |
| 基础套餐 | 2c / 4GB | 10GB 文件空间 | 1 个任务并发 |
| Pro 套餐 | 8c / 16GB | 100GB 文件空间 | 2 个任务并发 |

叠加计算、叠加存储和自定义规格属于 future-authorized。future-authorized 能力可以规划为 CPU、内存、文件空间和任务并发数的扩展，但不能写成当前已授权真实云执行能力。

## 核心用户 loop

1. 平台创建 1 名用户。
2. 给用户充值额度。
3. 用户登录 `portal.medopl.cn`。
4. 用户进入 `opl.medopl.cn`；OPL 登录 / 进入 OPL 工作台需要 gflabtoken API Key。
5. API Key 输入框放在 OPL 登录页密码下面；灰度说明来源于 gflabtoken；已绑定时显示“已绑定”，不要求重复输入。
6. 用户选择是否开通计算资源和文件空间。
7. 如开通，用户选择基础套餐、Pro 套餐、叠加资源或自定义规格。
8. 平台在自己的 TKE/存储资源池里开通可组合资源，计算资源与文件空间可独立保留或释放。
9. Portal 展示账号的计算资源、文件空间、工作空间和资源绑定状态。
10. 开通资源后开始预扣费或冻结金额。
11. 用户通过 clean upstream OPL Web 工作。
12. 用户可以发送消息、上传文件、跑任务、下载输出文件。
13. Portal 可以看到 workspace 文件、账单和 session trace metadata。
14. 如果余额不足，Portal 提示将消耗冻结金额。
15. 余额或冻结金额不足时，停止新任务和计算资源续用，但不得把释放计算资源自动写成删除文件空间。
16. 释放计算资源只停止计算计费和任务续用；用户删除存储资源 / 文件空间，或独立欠费保留策略，才进入 7 天保护期。
17. 文件空间进入保护期或不可用时，新任务不能依赖该文件空间。
18. 计算停止计费需要在 `120min` 内核对，账单与资源状态进入 `T+1` 审计。

## Token Provider Boundary

MedOPL 的 OpenAI-compatible API 中转站 base URL 是：

```text
https://gflabtoken.cn/v1
```

portal.medopl.cn 登录不需要 gflabtoken API Key。opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key。gflabtoken.cn 网站本身不进入 MedOPL 用户主流程。

Portal 可以展示“是否已绑定”状态，但 API Key 不是 Portal 普通登录字段。raw API Key 只能进入后端密钥边界；前端最多保留一次性输入态、`providerKeyRef` 和 bound status。raw API Key、bearer token、launchToken、runtimeToken 不能写入 sessionStorage、localStorage、global JS state、log、evidence 或 git，不能返回前端、不能写日志、不能进 git。

## 架构真相

当前主链路：

```text
Portal
  -> OPL Web Gateway
  -> clean upstream OPL Web
  -> Runtime Bridge / Runtime Agent
  -> platform-managed TKE/storage resource pools
  -> Billing/Quota/Audit/Admin
```

Portal canonical truth 是 control-plane store，生产方向是 PostgreSQL。Redis 不是事实源，只能用于 session、cache、queue、lock 或短期协调。

Portal 保存账号、用户、工作空间、钱包、冻结金额、账本、审计、resource binding、fileRef/logical index、session/run/artifact/trace metadata 的业务事实。Runtime Bridge 只提供 launch/session/run/artifact/trace 的 canonical integration boundary；它不是 billing ledger truth，也不是 cloud inventory truth。

数据与云控制面真相采用 Portal 内部 operation/job/projection/reconciliation 模型：

- desired state：Portal 中形成的资源、文件空间、计费和释放意图。
- actual state：云资源、runtime、文件空间、账单和审计的实际观测事实。
- reconciled state：Portal 对 desired state 和 actual state 的核对结果、异常、补偿和审计记录。

Object/blob plane 当前仍属本地/过渡实现；后续对象存储只承载文件正文和私有 locator，不成为账本、资源或审计事实源。secret plane、object/blob plane、runtime state plane 仍属本地/过渡实现，不能写成 productionized truth。

代码解耦真相：

- Portal frontend 只负责 UI composition、typed API client 和 UI-safe adapter，不直接接触云、secret、objectKey、localPath、signedUrl 或 runtime token。
- Portal backend 继续保持 route / domain / state / integration 分层。
- Gateway = 入口反腐层，只处理 launch、bootstrap、auth context、proxy 和 clean upstream 边界。
- Runtime Bridge = launch/session/run/artifact/trace 的 canonical integration boundary。

## OPL Entry / Upstream Boundary

OPL Web 用户可见入口必须是 Portal “进入 OPL 工作台”或 `/opl/entry/preflight`。`/internal/opl/auth/login` 只能作为 internal implementation path。旧 v19/v20/v21 OPL direct path、direct upstream path、internal path 不能成为 v22 产品入口。后续真实 proxy / upstream 运行接入单独 feat；旧入口删除如需要另开 `cleanup/*`。

one-person-lab 是 clean upstream：

```text
https://github.com/gaofeng21cn/one-person-lab
```

active surface 不允许修改 one-person-lab upstream。one-person-lab upstream 不属于 active surface；它只作为 clean upstream reference，通过 OPL Web Gateway、Runtime Bridge / Runtime Agent、公开 API/CLI、反向代理边界和必要的内部 anti-corruption mapping 接入。

v22 不修改 upstream 源码，不在 upstream 目录写 Portal、Gateway 或 Runtime Bridge 代码，不 import upstream 内部模块。upstream 更新后，平台拉取更新，并通过 OPL Web Gateway、Runtime Bridge / Runtime Agent、公开 API/CLI 和必要的内部 anti-corruption mapping 适配。

## Active Source Surface

当前 v22 active service surface：

- `services/portal`
- `services/opl-web-gateway`
- `services/opl-runtime-bridge`

Current docs / eval surface during migration：

- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `docs/public/README.md`
- `docs/references/README.md`
- `docs/history/README.md`
- `tests/**/*.mjs`
- `tests/fixtures/v22/{goal-current,agent-verify-manifest}.json`
- `scripts/v22-verify.mjs`
- `scripts/v22-test-classification.mjs`
- `scripts/v22-workflow-gate.mjs`

`user_owned`、`resource-order`、旧 `med-autoscience-runner`、旧 `resource-provisioner`、OpenCost 主叙事和 Langfuse 主产品叙事不得恢复为 active source、默认入口、fixture、compat alias 或文档默认上下文。

## Gap Matrix

| Area | Ideal | Current Evidence | Gap | Next Action | Done When | Verify |
| --- | --- | --- | --- | --- | --- | --- |
| Current truth | 一个 current truth 文件 | `docs/active/README.md` | 无第二份 current truth | maintain | 新 truth 直接改 active/specs/delivery/fixtures | `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk` |
| Tests taxonomy | `tests/**` 独立承载 health/smoke/contract/regression/future-authorized | `tests/**/*.mjs` + dynamic classifier | 仅保真实 eval 分类，不保旧脚本目录 | maintain | `scripts/` 只留 runner/classifier/workflow 和服务引用的 sync helper | `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk` |
| Contracts compaction | human truth 吸收到 `docs/specs/README.md` | `docs/specs/README.md` | 无分散合同叶子 | maintain | 合同新增直接写 specs anchor 和 eval | local-contract suite |
| Recovery retirement | recovery 不再是长期 docs taxonomy | `docs/history/README.md` + git history + fixtures | 无 active recovery 目录 | maintain | history 摘要承接证据，不保 shadow archive | hard-retirement gate |

## Cannot Claim

- 不能写成 `tests/**/*.mjs` 都是 smoke。
- 不能写成 agent-run evidence 是当前产品真相。
- 不能写成 `future-authorized` 等于真实云、deploy、kubectl 或 live-test 已授权。
- 不能写成 PostgreSQL/Redis、本地 production data layer、admin 全业务闭环或真实云生产闭环已完成。
- 不能把旧分散 docs、旧合同叶子或旧过程目录恢复成 current truth。

## Source Of Truth During Migration

- 唯一人读 current truth：`docs/active/README.md`
- 机器 cursor：`tests/fixtures/v22/goal-current.json`
- 验证 manifest：`tests/fixtures/v22/agent-verify-manifest.json`
- smoke/eval 边界：`docs/specs/README.md`
- agent-run evidence 摘要：`docs/history/README.md`
