# v22 Truth Freeze

本文件冻结 MedOPL v22 当前业务、架构、数据、云和 AI 开发治理真相。它不新增产品方向，只把长期不变量、当前事实和下一步索引分开，避免阶段性合同继续挤占主线。

## 业务闭环真相

MedOPL 的最小闭环是托管 OPL 科研工作台闭环，不是云资源控制台闭环：

1. 管理员创建 1 名用户。
2. 管理员给该用户充值额度。
3. 用户分别登录 `portal.medopl.cn` 与 `opl.medopl.cn`。
4. `portal.medopl.cn` 登录不需要 gflabtoken API Key。
5. `opl.medopl.cn` 登录 / 进入 OPL 工作台需要 gflabtoken API Key；输入框位于密码下面，并标明来源于 gflabtoken。
6. 用户在 Portal 创建工作空间，选择托管计算资源和文件空间。
7. Portal 展示用户自己的计算资源、文件空间、工作空间、余额、冻结金额和预扣费状态。
8. 用户在 clean upstream OPL Web 中发送消息、上传文件、触发 run、下载输出文件。
9. Portal 回流并展示 workspace 文件、账单、session trace、run、artifact metadata。
10. 用户释放托管运行环境 / 计算资源，停止计算计费。
11. 账单日内核对、120min 停止计费确认和 T+1 审计进入 billing / audit 边界。

## 当前阶段真相

当前 trunk 已完成的是合同级闭环、本地 deterministic eval、本地 smoke/local proof、Portal Workspace 文件动作闭环和 Portal-OPL file/run/artifact 本地闭环。

当前不是：

- 真实云生产闭环。
- 真实腾讯云 create/release mutation 已上线。
- 真实 COS 对账和真实账单日生产结算已完成。
- 真实 Langfuse 部署或 trace source 已上线。
- PostgreSQL/Redis production data layer 已完成。
- Admin 全业务闭环已完成。

因此后续开发必须继续走 contract-driven、eval-driven、trace-first 的 leaf，而不能把本地 proof 写成生产完成态。

## MVP active 套餐真相

当前 MVP active 套餐真相只有：

- `starter_2c4g_10gb`
- `pro_8c16g_100gb`

叠加计算、叠加存储、自定义 CPU/内存/文件空间/任务并发属于 `future-authorized`。它们可以保留为合同方向和产品规划，但不能在当前 active path 中宣称已经完成。

## 释放语义真相

释放托管运行环境 / 计算资源不等于删除文件空间。

- 释放计算资源：停止计算计费和任务续用。
- 文件空间：独立保留，除非用户删除文件空间或独立欠费保留策略触发。
- 7 天保护期：由文件空间删除或独立欠费策略触发，不由计算资源释放自动触发。
- 账单确认：计算停止计费需要 120min 内确认。
- 审计：T+1 审计用于账单、资源释放、文件保留和异常处理核对。

## OPL 能力分层真相

OPL upstream 仍是 clean upstream：`https://github.com/gaofeng21cn/one-person-lab`。

当前能力分层：

- message reply 有授权 canary 事实。
- file/run/artifact 已有 gate/proof/local closure。
- 真实云 runtime、真实 COS 对账、真实 Langfuse 部署不是当前 production truth。
- Portal 只做控制面、进入 OPL、状态回流、账单、审计和释放；不重做 OPL chatbot。

## 数据归属真相

Portal canonical truth 是 control-plane store，生产方向是 PostgreSQL。Redis 不是事实源，只能用于 session、cache、queue、lock 或短期协调。

核心数据归属：

- Account/User/Tenant/Workspace：Portal control-plane store。
- Wallet/Ledger/Freeze/Audit：Portal control-plane store / PostgreSQL 方向，必须有幂等和审计。
- Resource binding：Portal control-plane store 保存 desired state、actual state、reconciled state。
- Session/run/artifact/trace metadata：Runtime Bridge 生成 integration projection，Portal 保存可审计、可展示、脱敏后的 metadata。
- Provider key：raw key 只在后端 secret plane；前端只看 bound status / providerKeyRef。
- Object/blob plane：当前仍属本地/过渡实现；后续对象存储只承载文件正文和私有 locator，不成为账本、资源或审计事实源。短期 transfer URL 如被使用，只能是 action-scoped，不进入持久状态、日志、agent-run 或 git。

## 云真相

云控制面当前是合同和本地 proof，不是生产完成态。

目标生产模型是 Portal 内部 operation/job/projection/reconciliation：

- desired state：Portal 中形成的资源、文件空间、计费和释放意图。
- actual state：云资源、runtime、文件空间、账单和审计的实际观测事实。
- reconciled state：Portal 对 desired state 和 actual state 的核对结果、异常、补偿和审计记录。

云、deploy、live-test、真实云资源 mutation 必须单独授权。readonly inventory、dry-run plan、authorized create/release、deploy execution 仍按各自合同和 gate 推进，不得混进普通 cleanup 或本地业务 leaf。

## 代码解耦真相

代码边界保持清晰分层：

- Portal = SaaS 控制面和 canonical business/backend boundary。
- Gateway = 入口反腐层，只处理 launch、bootstrap、auth context、proxy 和 upstream clean boundary。
- Runtime Bridge = launch/session/run/artifact/trace 的 canonical integration boundary。
- Runtime Agent = 执行侧 relay / worker boundary，不成为账本事实源。
- Portal frontend = UI composition + typed API client + UI-safe adapter，不直接碰云、secret、objectKey、localPath 或 runtime token。
- Portal backend = route / domain / state / integration 分层，云操作以 operation/job/projection/reconciliation 进入。

secret plane、object/blob plane、runtime state plane 仍属本地/过渡实现，不能写成 productionized truth。旧 schema 命名残留是技术债，不是 v22 canonical 领域边界。

## AI 开发治理真相

v22 后续开发只使用五层治理模型：contracts / truth / index / eval / agent-runs。

- `contracts`：长期不变量和授权边界。
- `truth`：当前架构、产品、数据和完成度事实。
- `index`：current cursor、next leaf、gap 和允许写入范围。
- `eval`：机器验收入口。
- `agent-runs`：每一步开发证据、验证结果、B review 和吸收记录。

current truth only in `docs/recovery/v22-goal-current.json`。
verify authority only in `docs/recovery/v22-agent-verify-manifest.json`。
unified eval entrypoint is `scripts/v22-verify.mjs`。
agent-runs 保存 leaf 证据，不替代 current truth。

## 物理清退边界

本次清退只移除阶段性事实源：

- `docs/recovery/v22-ai-frontend-backend-development-framework.md`
- `docs/contracts/v22-canonical-user-loop.md`

这些文件的长期内容已收敛进本 truth freeze、product truth、architecture truth、主合同和 verify manifest。后续不得恢复兼容层、旧 Portal、旧 Adapter、旧 upstream 叙事或阶段性合同作为当前事实源。
