# Portal / OPL Web / med-autoscience 真实适配 AI 开发文档 v1

日期：2026-04-25

## 0. 本文目的

本文用于指导后续 AI 开发按“Portal 控制面 + OPL Web 工作台 + med-autoscience 真实执行”的链路推进。

本轮核心不是继续扩大旧 bridge，而是把它收窄为内部 `portal-opl-adapter`，让产品主线变成：

```text
用户进入 Portal
-> Portal 做账号、余额、workspace、配额、K8s/存储/账单控制
-> Portal 生成 OPL launch context
-> 打开真实 OPL Web UI
-> OPL Web 负责 workspace/session/progress/artifacts 工作台体验
-> OPL Web 激活 MAS/MAG/RCA
-> med-autoscience runner 真执行
-> Portal 收回 run/cost/K8s/文件归属/管理员视图
```

最终用户感知应该是：

- Portal 是商业和资源控制面。
- OPL Web 是实际工作台。
- med-autoscience 是医学科研执行真相。

## 1. 当前根目录现状判断

当前仓库已经具备一些基础能力，但产品主线表达还不够准。

### 1.1 已具备

- `services/portal`
  - 已有账号、登录、workspace、余额、管理员、session、run、trace、cost、存储视图雏形。
  - 已能通过内部 bridge 创建 OPL launch。
- `services/opl-runtime-bridge`
  - 已有 launch token、bootstrap、runner submit、artifact/trace/cost 回流合同。
  - 但命名和文档上容易让人误会它是 OPL 产品主线。
- `adapters/med-autoscience-runner`
  - 已有 runner internal API 和 K8s Job 标签/状态/outputs 合同雏形。
- `scripts/fixtures/opl-product-api-fixture.mjs`
  - 可做本地开发替身。
  - 不应作为产品主路。
- `compose.demo.yaml`
  - 当前默认启动 `opl-product-api-fixture`，适合合同 smoke，不适合真实 OPL Web 验收。

### 1.2 当前不满足最终需求的点

- 真实 OPL Web/Product API 尚未成为主入口。
- `OPL Product API fixture` 在文档和 compose 中仍像主路径，容易误导。
- 旧 bridge 被写得过重，应该改成内部 `portal-opl-adapter` 角色。
- Portal 尚未明确区分：
  - 商业/基础设施控制面数据。
  - OPL Web 工作流投影数据。
  - med-autoscience domain truth。
- Langfuse、Harbor、OpenCost、MinIO、Rancher 等基础设施能力应归 Portal 控制面，而不是 OPL 链路的一部分。

## 2. 目标职责边界

### 2.1 Portal 负责 SaaS 控制面

Portal 负责：

- 开户、登录、用户状态、余额、注册策略。
- 创建、归档、删除 workspace。
- K8s runtime 调度入口、资源标签、配额。
- MinIO/COS 输入输出文件归属。
- OpenCost/云账单/钱包流水。
- session、trace、latency、user-agent、token、run actions 查看。
- 管理员查看用户、run、成本、K8s 分发和异常。
- 生成 OPL launch context。
- 接收 OPL/runner 回流的 run、artifact、cost、K8s、异常证据。

Portal 不负责：

- 不渲染实际工作台体验。
- 不拥有 OPL progress/artifacts 的工作流投影真相。
- 不直接执行医学科研 domain logic。
- 不把未完成 run 写成 completed。
- 不把未对账 cost 写成 exact。

### 2.2 OPL Web 负责工作台体验

OPL Web 负责：

- 用户实际工作台体验。
- workspace/session/progress/artifacts 的工作流投影。
- 激活 MAS/MAG/RCA 等 domain agent。
- 对话、恢复、进度、产物视图。
- 向 Portal 或 adapter 请求商业上下文允许范围内的 launch/bootstrap 信息。

OPL Web 不负责：

- 不管理用户余额。
- 不决定扣费。
- 不拥有 K8s 调度与资源配额真相。
- 不拥有 MinIO/COS 文件归属真相。
- 不绕过 Portal 创建商业 workspace。

### 2.3 med-autoscience 负责医学科研 domain truth

med-autoscience 负责：

- 医学科研 domain logic。
- 真实 runner / CLI / 工具链。
- domain artifact truth。
- domain progress truth。
- 在 K8s Job 或 runner 进程中执行实际任务。

med-autoscience 不负责：

- 不管理 Portal 账户、余额、注册策略。
- 不管理 OPL Web 工作台全局投影。
- 不决定商业计费归属。

### 2.4 adapter 只做内部合同，不做产品主线

当前 `services/opl-runtime-bridge` 建议在产品语义上收窄为：

```text
portal-opl-adapter
```

它负责：

- 接收 Portal launch 请求。
- 生成短期 launch token。
- 把 Portal 用户、workspace、配额、文件归属上下文转换成 OPL Web 可读 launch context。
- 给 OPL Web 提供 bootstrap/context endpoint。
- 接收 OPL Web 的 run/action 请求或回调。
- 把 run 提交给 med-autoscience runner。
- 把 runner status/artifacts/cost pending 回流给 Portal。

它不负责：

- 不作为用户可见工作台。
- 不替代 OPL Web。
- 不持有最终产品 UI 入口。
- 不伪造 progress/artifact/cost。

## 3. 最终链路设计

### 3.1 用户进入工作台

```text
用户登录 Portal
-> Portal 检查用户状态、余额、注册策略、workspace 状态、配额
-> Portal 创建或复用 workspace session
-> Portal 生成 launch context
-> Portal 跳转真实 OPL Web URL
-> OPL Web 用 launch_token 拉 bootstrap
-> OPL Web 展示工作台
```

### 3.2 OPL Web 激活 domain agent

```text
用户在 OPL Web 选择 MAS/MAG/RCA
-> OPL Web 创建或恢复 OPL session
-> OPL Web 发起 run/action
-> adapter 校验 launch/runtime/session 权限
-> adapter 提交 med-autoscience runner
-> runner 创建真实执行
```

### 3.3 Portal 收回运行证据

```text
runner status/artifacts/progress
-> adapter 标准化 run/artifact/trace/cost pending
-> Portal 查询或接收回调
-> Portal 用户端展示 run/session/artifact/cost
-> Portal 管理员端展示用户、run、成本、K8s 分发、异常
```

## 4. 关键合同

### 4.1 Portal 生成 Launch Context

目的：

- 让 OPL Web 知道“哪个 Portal 用户、哪个商业 workspace、哪个 runtime session、允许启动哪些 domain agent”。
- 不把 Portal 的钱包、配额、K8s 权限泄露给 OPL Web 直接操作。

建议 endpoint：

```text
POST /portal/api/opl/launch
```

Portal 内部调用 adapter，返回给前端：

```json
{
  "ok": true,
  "launchId": "...",
  "launchToken": "...",
  "oplWebUrl": "http://127.0.0.1:8787/?launch_token=...&portal_adapter_url=...",
  "workspace": {
    "workspaceId": "default",
    "title": "默认任务空间",
    "status": "active"
  },
  "workspaceSession": {
    "workspaceSessionId": "..."
  },
  "runtimeSession": {
    "runtimeSessionId": "..."
  }
}
```

交付标准：

- Portal launch 前必须完成用户状态、余额、workspace 状态、配额检查。
- launch token 必须短期有效。
- OPL Web URL 必须指向真实 OPL Web，而不是 adapter 投影页。
- 未配置真实 OPL Web 时只能进入 dev/test 模式，不能宣称真实收口。

### 4.2 OPL Web 拉取 Bootstrap

目的：

- OPL Web 只拿工作台需要的数据。
- Portal 保留商业控制权。

建议 endpoint：

```text
GET /api/opl-launch/bootstrap?launch_token=...
```

返回：

```json
{
  "version": "v1",
  "portal": {
    "userId": "...",
    "workspaceId": "...",
    "workspaceSessionId": "...",
    "runtimeSessionId": "..."
  },
  "entitlements": {
    "agents": ["mas", "mag", "rca"],
    "canStartRun": true
  },
  "workspace": {
    "workspacePath": "...",
    "inputOwner": "...",
    "outputOwner": "..."
  },
  "callbacks": {
    "startRun": "/api/opl-launch/runs",
    "runStatus": "/api/opl-launch/runs/{runId}/status",
    "artifacts": "/api/opl-launch/runs/{runId}/artifacts"
  }
}
```

交付标准：

- OPL Web 可以用 bootstrap 渲染 workspace/session/progress/artifacts 壳。
- bootstrap 不返回可直接扣费或改配额的权限。
- bootstrap 里必须包含完整 ID 链。

### 4.3 OPL Web 发起 Run

目的：

- 让 OPL Web 激活 MAS/MAG/RCA，但不绕过 Portal 的商业控制面。

建议 endpoint：

```text
POST /api/opl-launch/runs
```

请求：

```json
{
  "launchToken": "...",
  "agentId": "mas",
  "toolName": "med-autoscience",
  "goal": "...",
  "inputRefs": [],
  "runtimeOptions": {}
}
```

adapter 提交 runner 时补齐：

```json
{
  "portalUserId": "...",
  "workspaceId": "...",
  "workspaceSessionId": "...",
  "runtimeSessionId": "...",
  "runId": "...",
  "agentId": "mas",
  "toolName": "med-autoscience",
  "billingScope": "run",
  "costCenter": "research-foundry"
}
```

交付标准：

- OPL Web 不能自己构造 Portal 用户或 workspace 归属。
- adapter 必须从 launch token 恢复 ID 链。
- runner 初始状态只能是 queued/submitted/running 等真实状态。
- 失败要回流 Portal，不吞错误。

### 4.4 Portal 收回 Runtime

目的：

- Portal 不是工作台，但必须拥有商业、资源、账单、管理员视角。

收回内容：

- run status。
- run actions。
- trace / latency / user-agent / token。
- artifact metadata。
- MinIO/COS object ownership。
- K8s namespace/jobName/labels。
- cost pending/exact。
- error/exception。

建议 endpoint：

```text
GET /portal/api/runs
GET /portal/api/traces
GET /portal/api/artifacts
GET /portal/api/costs/run
GET /portal/api/admin/overview
```

交付标准：

- Portal 用户端能按 workspace/session/run 查看结果。
- Portal 管理员端能按用户、run、成本、K8s、异常查看。
- cost 在 OpenCost/云账单对账前只能是 pending。
- K8s labels 必须在 Job 创建时写入，不能靠后处理补救。

## 5. Portal 需要优化什么

### 5.1 把 OPL 启动入口产品化

当前问题：

- Portal 现在有 workbench launch，但命名和文档偏 bridge。

改造目标：

- Portal UI 上明确显示“打开 OPL 工作台”。
- 后端 endpoint 改成 OPL Web launch 语义。

实现：

- 新增或调整：
  - `POST /portal/api/opl/launch`
  - `GET /portal/app/workspaces/:id/opl`
- Portal launch 前统一检查：
  - user status
  - wallet balance
  - registration policy
  - workspace status
  - group quota
  - allowed agents
- launch response 使用 `oplWebUrl`，而不是 `workbenchUrl` 泛称。

交付标准：

- Portal 上的主按钮打开真实 OPL Web。
- 未配置真实 OPL Web 时显示“OPL Web 未配置”，不能静默进入 fixture。

### 5.2 把基础设施控制面归 Portal

当前问题：

- Langfuse、Harbor、OpenCost、MinIO、Rancher 容易被误写成联调主链路。

改造目标：

- 它们都属于 Portal 控制面模块。

实现：

- Portal 管理员页按模块展示：
  - `Images`：Harbor / runner image。
  - `Storage`：MinIO/COS inputs/outputs ownership。
  - `Cost`：OpenCost / 云账单 / wallet ledger。
  - `Runtime`：K8s namespace/job/pod labels。
  - `Trace`：内置 trace，Langfuse 仅可选后端。
- README 中把这些移到“Portal infra integrations”。

交付标准：

- 第一硬闭环不依赖 Langfuse。
- 没有 Harbor/Langfuse 时，Portal/OPL/runner 主链路仍可验收。
- OpenCost 不可用时 cost 只能停留 pending。

### 5.3 Portal workspace 成为商业归属源

当前问题：

- OPL Web 和 runner 都需要 workspace，但商业归属必须由 Portal 决定。

实现：

- Portal workspace record 增加或确认：
  - `workspaceId`
  - `ownerUserId`
  - `workspacePath`
  - `storagePrefix`
  - `quotaPolicy`
  - `allowedAgents`
  - `status`
- launch context 中只把必要字段给 OPL Web。

交付标准：

- OPL Web 不能创建绕过 Portal 的商业 workspace。
- runner outputs 必须落在 Portal 指定的 workspace 文件归属下。

### 5.4 Portal session/run 视图对齐 OPL

当前问题：

- Portal 现在能看 run/trace/cost，但还需要更明确地区分 OPL session 与 runner run。

实现：

- Portal session 列表展示：
  - `workspaceSessionId`
  - `runtimeSessionId`
  - `oplSessionId`
  - `lastRunId`
  - `agentId`
  - `status`
- Portal run 详情展示：
  - OPL launch 信息。
  - runner status。
  - K8s job labels。
  - artifact list。
  - cost pending/exact。

交付标准：

- 用户能从 Portal 找到“我在哪个 OPL session 做了什么”。
- 管理员能从 run 反查用户、workspace、K8s job、成本归属。

## 6. OPL Web 需要适配什么

### 6.1 支持 Portal Launch Token

目的：

- 让 OPL Web 可以作为 Portal 打开的工作台，而不是孤立 Web。

实现：

- OPL Web 支持 URL：

```text
http://127.0.0.1:8787/?launch_token=...&portal_adapter_url=...
```

- OPL Web 启动时：
  - 读取 `launch_token`
  - 调 adapter bootstrap
  - 建立 workspace/session projection

交付标准：

- 从 Portal 点击后直接进入对应 OPL workspace。
- token 过期时显示明确错误。

### 6.2 OPL Web 调用 startRun callback

目的：

- OPL Web 可以激活 MAS/MAG/RCA，但实际运行仍归 Portal/runner 管控。

实现：

- OPL Web 的 MAS/MAG/RCA 按钮调用 bootstrap 中的 `callbacks.startRun`。
- 请求中带：
  - `launchToken`
  - `agentId`
  - `goal`
  - `inputRefs`

交付标准：

- OPL Web 不需要知道 Portal 钱包实现。
- run 被 Portal 看到。
- runner outputs 回到 OPL Web artifacts 和 Portal 文件归属视图。

### 6.3 OPL Web 继续拥有工作台投影

目的：

- 不让 Portal 变成工作台。

实现：

- OPL Web 自己展示：
  - progress
  - artifacts
  - conversation
  - session restore
  - domain agent activation
- Portal 只展示控制面摘要和证据。

交付标准：

- 用户实际工作停留在 OPL Web。
- Portal 只负责启动、控制、查看结果。

## 7. med-autoscience runner 需要适配什么

### 7.1 接收完整 ID 链

目的：

- 保证 runner、K8s、artifact、cost 都能被 Portal 收回。

实现：

- `/api/runs` 必须接收：
  - `portalUserId`
  - `workspaceId`
  - `workspaceSessionId`
  - `runtimeSessionId`
  - `runId`
  - `agentId`
  - `toolName`
  - `billingScope`
  - `costCenter`

交付标准：

- runner 返回的 run metadata 包含同一组 ID。

### 7.2 K8s labels 完整写入

目的：

- OpenCost/管理员/K8s 排障都依赖 labels。

实现：

- Job metadata labels 和 pod labels 必须包含：
  - `portal_user_id`
  - `workspace_id`
  - `workspace_session_id`
  - `runtime_session_id`
  - `run_id`
  - `agent_id`
  - `tool_name`
  - `billing_scope`
  - `cost_center`

交付标准：

- `kubectl get job -n <namespace> --show-labels` 可见完整链路。

### 7.3 outputs 按 Portal workspace 归属

目的：

- MinIO/COS 文件归属属于 Portal 控制面。

实现：

- runner outputs metadata 返回：
  - `runId`
  - `workspaceId`
  - `objectKey`
  - `localPath`
  - `sizeBytes`
  - `contentType`

交付标准：

- Portal 能按 workspace/run 查 outputs。
- OPL Web 能按 session/artifacts 视图展示产物。

## 8. AI 开发步骤

### Step 1：重写产品主线文档与配置语义

目的：

- 先纠正方向，避免继续把 bridge/fixture 当产品主路。

如何实现：

- README 主线改为：

```text
Portal -> real OPL Web -> med-autoscience runner -> Portal control-plane recovery
```

- 把 `OPL Product API fixture` 标注为 dev/test only。
- 把旧 bridge 文档定位改为 internal adapter。
- `.env.demo.template` 增加：
  - `OPL_WEB_URL`
  - `PORTAL_OPL_ADAPTER_URL`
  - 保留 `OPL_PRODUCT_API_URL` 作为 OPL API base。

交付标准：

- 新开发者读 README 不会误以为 fixture 是主线。
- 文档清楚表达 Portal/OPL Web/runner 三方边界。

验证：

- 搜索 README 和 plan，不应出现“fixture 是真实主路”的表达。

### Step 2：Portal OPL Launch 产品化

目的：

- 让 Portal 成为 OPL Web 的启动控制面。

如何实现：

- 在 Portal 增加或调整 endpoint：

```text
POST /portal/api/opl/launch
```

- 复用现有 workspace/session/policy/wallet 检查。
- 返回 `oplWebUrl`，指向真实 `OPL_WEB_URL`。
- launch token 由 adapter 签发或 Portal 签发，必须短期有效。

交付标准：

- Portal UI 点击“打开 OPL 工作台”后跳到真实 OPL Web。
- 未配置 `OPL_WEB_URL` 时明确报错。
- launch response 包含完整 ID 链。

验证：

```powershell
npm --prefix services/portal run check
node scripts/smoke-test-portal-opl-web-launch.mjs
```

### Step 3：adapter 收窄为 Portal-OPL 合同层

目的：

- 保留已有代码价值，但不让它成为产品入口。

如何实现：

- 现有 `services/opl-runtime-bridge` 暂不必立即改目录名，但文档和 API 语义改成 adapter。
- 增加或明确 endpoint：

```text
GET /api/opl-launch/bootstrap
POST /api/opl-launch/runs
GET /api/opl-launch/runs/:runId/status
GET /api/opl-launch/runs/:runId/artifacts
```

- 旧 `/workbench` 仅保留 dev projection。

交付标准：

- 真实产品 URL 不指向 adapter `/workbench`。
- OPL Web 只通过 adapter 拉 bootstrap 和发起 run。
- adapter 不渲染工作台 UI。

验证：

```powershell
npm --prefix services/opl-runtime-bridge run check
node scripts/smoke-test-opl-launch-adapter.mjs
```

### Step 4：真实 OPL Web 接入

目的：

- 把 fixture 替换成真实 OPL Web/Product API。

如何实现：

- 在 `one-person-lab` 仓库启动：

```powershell
opl web --host 127.0.0.1 --port 8787
```

- 设置：

```powershell
$env:OPL_WEB_URL="http://127.0.0.1:8787"
$env:OPL_PRODUCT_API_URL="http://127.0.0.1:8787"
```

- OPL Web 支持读取 Portal launch token。
- OPL Product API 支持 `/api/opl/workspaces/bind`。

交付标准：

- `GET http://127.0.0.1:8787/api/health` 返回 ok。
- Portal 打开的 URL 是真实 OPL Web。
- OPL Web 能显示 Portal workspace 对应的工作台投影。

验证：

```powershell
$env:RUN_OPL_REAL_SMOKE="1"
node scripts/smoke-test-opl-real-web.mjs
```

### Step 5：OPL Web 激活 MAS 并提交 runner

目的：

- 验证 OPL Web 真正成为工作台入口。

如何实现：

- OPL Web MAS 按钮调用 adapter `POST /api/opl-launch/runs`。
- adapter 从 launch token 恢复 Portal ID 链。
- adapter 调 med-autoscience runner `/api/runs`。

交付标准：

- OPL Web 发起 MAS 后，Portal 能看到对应 run。
- runner 返回真实 submitted/running/succeeded/failed。
- 未完成 run 不显示 completed。

验证：

```powershell
node scripts/smoke-test-portal-opl-web-mas-run.mjs
```

### Step 6：Portal 收回 runtime 证据

目的：

- 让 Portal 完成 SaaS 控制面的闭环。

如何实现：

- adapter 同步 runner status/artifacts。
- Portal 查询 adapter 或接收 callback。
- Portal 写入/展示：
  - run actions
  - trace
  - latency
  - user-agent
  - token
  - artifact metadata
  - cost pending
  - K8s job labels

交付标准：

- Portal 用户端能看到本 workspace 的 session/run/artifact/cost。
- Portal 管理员端能看到用户、run、成本、K8s 分发、异常。
- OpenCost 未对账前 cost 为 pending。

验证：

```powershell
node scripts/smoke-test-portal-opl-runtime-recovery.mjs
```

### Step 7：把基础设施模块归 Portal 控制面

目的：

- 避免 Langfuse、Harbor、OpenCost、MinIO、Rancher 混入 OPL 工作台主链路。

如何实现：

- README 和 Portal admin 信息架构改成：
  - Runtime/K8s：Rancher/K8s。
  - Image：Harbor。
  - Storage：MinIO/COS。
  - Cost：OpenCost/云账单/钱包。
  - Trace：Portal 内置 trace，Langfuse 可选。
- `compose.langfuse.yaml` 保持可选。
- 第一硬闭环 smoke 不依赖 Langfuse/Harbor。

交付标准：

- 关闭 Langfuse/Harbor 不影响 Portal -> OPL Web -> runner 主链路。
- OpenCost 不可用时只影响 exact cost，不影响 run 执行。

验证：

```powershell
node scripts/check-commercial-blockers.mjs
```

### Step 8：最终硬闭环验收

目的：

- 证明用户真实路径可以跑通。

验收路径：

```text
Portal 登录
-> 创建 workspace
-> 打开 OPL Web
-> OPL Web 激活 MAS
-> med-autoscience runner 执行
-> Portal 看到 run/artifact/cost/K8s/admin evidence
```

交付标准：

- 不依赖 fixture。
- 不依赖 adapter `/workbench` 投影页。
- 不依赖 Langfuse。
- 同一组 ID 链贯穿：
  - `portalUserId`
  - `workspaceId`
  - `workspaceSessionId`
  - `runtimeSessionId`
  - `oplSessionId`
  - `runId`
  - `jobName`
- K8s labels 完整。
- Portal 能导出或展示成本 pending/exact。

验证：

```powershell
npm --prefix services/portal run check
npm --prefix services/opl-runtime-bridge run check
npm --prefix adapters/med-autoscience-runner run check
node scripts/smoke-test-portal-opl-web-hard-loop.mjs
```

## 9. 文件改造清单

### 9.1 Portal

- `services/portal/src/server.mjs`
  - 新增/调整 OPL launch endpoint。
  - 优化 workspace/session/run/cost/admin 数据映射。
- `services/portal/frontend`
  - 如前端已启用，增加“打开 OPL 工作台”和 runtime evidence 视图。

### 9.2 adapter

- `services/opl-runtime-bridge/src/server.mjs`
  - 收窄为 adapter endpoint。
  - dev `/workbench` 保留但不作为主路。
- `services/opl-runtime-bridge/src/opl-client.mjs`
  - 继续适配真实 OPL Product API。
- `services/opl-runtime-bridge/src/runner-client.mjs`
  - 继续对接 med-autoscience runner。
- `services/opl-runtime-bridge/src/state-store.mjs`
  - 保留 runtime evidence 状态。

### 9.3 runner

- `adapters/med-autoscience-runner/src/server.mjs`
  - 保证真实 runner/K8s 状态与 outputs。
- `infra/kubernetes/job-template.yaml`
  - 保证 labels/env 完整。

### 9.4 docs/config

- `README.md`
- `.env.demo.template`
- `compose.demo.yaml`
- `infra/production-hardening/pre-launch-checklist.md`
- 新增 smoke scripts：
  - `scripts/smoke-test-portal-opl-web-launch.mjs`
  - `scripts/smoke-test-opl-launch-adapter.mjs`
  - `scripts/smoke-test-portal-opl-web-mas-run.mjs`
  - `scripts/smoke-test-portal-opl-runtime-recovery.mjs`
  - `scripts/smoke-test-portal-opl-web-hard-loop.mjs`

## 10. 不做事项

- 不把 fixture 当真实 OPL。
- 不把 adapter `/workbench` 当真实工作台。
- 不让 Portal 变成 OPL 工作台。
- 不让 OPL Web 管余额、配额、K8s、钱包。
- 不让 runner 决定商业计费归属。
- 不把 Langfuse/Harbor 作为第一硬闭环依赖。
- 不用后处理补齐 K8s labels。
- 不写 fake completed。
- 不写 fake exact cost。

## 11. 最终完成定义

只有以下全部满足，才算完成：

- Portal 能完成用户、余额、workspace、配额检查。
- Portal 能生成真实 OPL Web launch context。
- Portal 打开的是真实 OPL Web UI。
- OPL Web 能用 launch token 拉 bootstrap。
- OPL Web 能展示 workspace/session/progress/artifacts 工作台。
- OPL Web 能激活 MAS/MAG/RCA。
- MAS 至少能通过 med-autoscience runner 提交真实 run。
- runner status 不伪造。
- runner outputs 能回流为 artifacts。
- Portal 能收回 run/cost/K8s/文件归属/管理员视图。
- fixture 只用于 dev/test。
- Langfuse/Harbor 等基础设施不阻塞第一硬闭环。
