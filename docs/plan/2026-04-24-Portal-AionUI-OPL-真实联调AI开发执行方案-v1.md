# Portal / AionUI / OPL / med-autoscience 真实联调 AI 开发执行方案 v1

日期：2026-04-24

## 0. 本方案目的

本方案用于指导后续 AI executor / team 按顺序完成真实联调开发。

最终目标不是再做一个本地合同 demo，而是把四个系统的职责边界和数据链路打通：

```text
Portal
-> OPL runtime bridge
-> OPL Product API / AionUI shell
-> med-autoscience-runner
-> K8s Job
-> MinIO/COS outputs
-> trace / latency / token / user-agent / run actions
-> OpenCost / 云账单 / 钱包流水
-> Portal 用户端与管理员端可观测
```

完成后，同一个 `portalUserId / workspaceId / workspaceSessionId / runtimeSessionId / runId` 必须贯穿 launch、bootstrap、runner、K8s labels、artifact、trace、cost 和 Portal 查询页面。

## 1. 职责边界

### 1.1 Portal 负责 SaaS 控制面

Portal 是商业控制面和运营控制面，负责：

- 开户、登录、用户状态、余额、注册策略。
- 创建、归档、删除 workspace。
- K8s runtime 调度入口、资源标签、配额策略。
- MinIO/COS 输入输出文件归属。
- OpenCost、云账单、钱包流水。
- session、trace、latency、user-agent、token、run actions 的查看。
- 管理员查看用户、run、成本、K8s 分发和异常。

Portal 不负责：

- 不直连 AionUI。
- 不直连 med-autoscience-runner。
- 不拥有 OPL resources / progress / artifacts 的工作流真相。
- 不伪造 runner 成功状态或成本。

### 1.2 OPL / AionUI 负责工作台体验

OPL Product API 是 runtime resources 和 session/workspace/progress/artifacts 的事实源。

AionUI / `opl-aion-shell` 是用户工作台 shell 或 overlay，负责：

- 用户实际工作台体验。
- session、workspace、progress、artifacts 的工作流投影。
- 激活 MAS / MAG / RCA 等 domain agent。
- 对话、恢复、进度、产物视图。

AionUI 不负责：

- 不拥有计费真相。
- 不拥有 K8s 调度真相。
- 不拥有 Portal 用户、钱包、配额、云账单真相。

### 1.3 med-autoscience 负责 domain runtime

med-autoscience 负责医学科研 domain logic，具体包括：

- 真实 runner / CLI / 工具链。
- domain artifact。
- domain progress truth。
- K8s Job 中实际执行的医学科研任务。

med-autoscience 不负责：

- 不管理 Portal 账户、钱包、注册策略。
- 不管理 OPL/AionUI 工作台投影。
- 不自行决定商业计费归属。

### 1.4 OPL runtime bridge 负责边界编排

bridge 是 Portal、OPL/AionUI、runner 之间的合同层，负责：

- 接收 Portal launch 请求。
- 调 OPL Product API 绑定 workspace/session。
- 生成可给 AionUI shell 使用的 launch token 和 bootstrap URL。
- 接收 AionUI/Portal 发起的 runtime run 请求。
- 调 runner internal API 提交真实 run。
- 同步 runner status、outputs、trace、cost pending/exact。
- 向 Portal 暴露 session/run/artifact/trace/cost 查询合同。

bridge 不负责：

- 不再本地生成假 artifact 代表真实运行。
- 不再把 run 直接写成 `completed`。
- 不再写 `contract-zero-cost` 作为生产计费结果。

## 2. 当前基线判断

当前仓库已经具备本地合同闭环，但仍是半真实状态：

- `services/portal/src/server.mjs` 已经通过 bridge 创建 OPL workbench launch，方向正确。
- `services/opl-runtime-bridge/src/server.mjs` 仍然自造 OPL resources、假 artifact、假 completed、`contract-zero-cost`。
- `adapters/med-autoscience-runner/src/server.mjs` 已经有 internal API 雏形，但 run 入参和 K8s labels 还缺完整 OPL/Portal ID 链。
- `infra/kubernetes/job-template.yaml` 已有基础 labels，但缺 `portal_user_id / runtime_session_id / agent_id / tool_name / billing_scope / cost_center`。
- smoke 测试目前能证明合同 demo，但不能证明真实 OPL Product API、AionUI shell、runner、K8s、OpenCost 闭环。

因此执行顺序必须先切事实源，再切 launch，再切 runner，再切回流，再做 Portal 可观测和上线验收。

## 3. 总体交付标准

整条线完成后必须满足：

1. Portal launch 后返回 bridge 签发的 launch token、bootstrap URL、workbench URL。
2. 若配置 `OPL_AION_SHELL_URL`，workbench URL 指向 AionUI shell，并携带 `launch_token` 与 `bridge_url`。
3. AionUI/fixture 调 bridge bootstrap 时，拿到的 `resources.system / engines / modules / agents / workspaces / sessions / progress / artifacts` 来自 OPL Product API。
4. bridge 创建 run 时调 med-autoscience-runner internal API，不再本地伪造 run 完成。
5. runner 创建 K8s Job，Job labels 包含完整 ID 链和计费标签。
6. runner status 映射为 `queued / submitted / running / succeeded / failed`，未知状态不当成功。
7. artifact 只来自 runner outputs / MinIO/COS 输出清单。
8. trace 包含 `model / token / user-agent / latency / status / error / run actions`。
9. cost 初始为 `pending`，只有 OpenCost/云账单对账后才能变为 `exact`。
10. Portal 用户端和管理员端能看到 session、run、trace、artifact、cost、异常。
11. 生产路径中不得出现 `contract-zero-cost` 作为真实计费来源。
12. 每个 step 都更新推进日志，写明修改文件、验证命令、结果、证据 ID、未完成项。

## 4. Step 顺序总览

推荐按 7 个 step 推进：

```text
Step 1: OPL Product API fixture/client
Step 2: bridge state-store 拆分
Step 3: AionUI shell launch + bootstrap
Step 4: runner-client + bridge run submit
Step 5: runner K8s labels/status/outputs
Step 6: artifact/trace/cost 回流 + Portal 可观测
Step 7: live 启动、compose、文档、最终验收
```

Step 1 到 Step 3 先稳定 Portal -> OPL/AionUI 工作台入口。

Step 4 到 Step 5 再替换真实 med-autoscience runner 和 K8s 调度。

Step 6 到 Step 7 最后把商业控制面和上线验收补齐。

## 5. Step 1：OPL Product API fixture/client

### 目的

把 bridge bootstrap 的 resources 事实源从 bridge 本地硬编码切到 OPL Product API。

### 修改范围

- 新建 `services/opl-runtime-bridge/src/opl-client.mjs`
- 新建 `scripts/fixtures/opl-product-api-fixture.mjs`
- 新建 `scripts/smoke-test-opl-product-api-bridge.mjs`
- 修改 `services/opl-runtime-bridge/src/server.mjs`
- 更新 `docs/logs/2026-04-24-Portal-AionUI-OPL-真实联调推进日志-v1.md`

### 怎么做

1. `opl-client.mjs` 读取：
   - `OPL_PRODUCT_API_URL`
   - `OPL_PRODUCT_API_TOKEN`
   - `OPL_AION_SHELL_URL`
2. 实现 Product API 方法：
   - `getSystem()`
   - `listEngines()`
   - `listModules()`
   - `listAgents()`
   - `bindWorkspace(portalContext)`
   - `createSession(portalContext)`
   - `getBootstrap(runtimeSession)`
3. fixture 提供最小 Product API：
   - `GET /api/opl/system`
   - `GET /api/opl/engines`
   - `GET /api/opl/modules`
   - `GET /api/opl/agents`
   - `POST /api/opl/workspaces`
   - `POST /api/opl/sessions`
   - `GET /api/opl/progress`
   - `GET /api/opl/artifacts`
4. bridge `/api/workbench/bootstrap` 调 `opl-client` 合成 resources。
5. 未配置 `OPL_PRODUCT_API_URL` 时仅允许测试模式使用 fixture；生产模式必须 fail closed。

### 交付标准

- bootstrap 里的 `resources.system.id` 来自 OPL Product API fixture。
- bridge 不再用硬编码 `opl-runtime-bridge` 冒充 OPL system。
- OPL API 调用失败时返回真实错误，并写入事件。
- smoke 能证明 system/engines/modules/agents/workspaces/sessions/progress/artifacts 全部可取。

### 验证命令

```powershell
npm --prefix services/opl-runtime-bridge run check
node scripts/smoke-test-opl-product-api-bridge.mjs
```

## 6. Step 2：bridge state-store 拆分

### 目的

把 bridge 的状态读写从 `server.mjs` 拆出来，避免后续 OPL、runner、artifact、trace、cost 都堆进一个大文件。

### 修改范围

- 新建 `services/opl-runtime-bridge/src/state-store.mjs`
- 修改 `services/opl-runtime-bridge/src/server.mjs`
- 更新 Step 1 smoke 或新增 state-store 断言
- 更新推进日志

### 怎么做

1. 将当前 `state.json` 的读写封装为 store：
   - `readState()`
   - `writeState()`
   - `addEvent()`
   - `upsertWorkspace()`
   - `createWorkspaceSession()`
   - `createRuntimeSession()`
   - `createRunRecord()`
   - `updateRunStatus()`
   - `addArtifactRecord()`
   - `addTraceRecord()`
   - `addCostRecord()`
2. 所有 records 必须带：
   - `createdAt` 或 `occurredAt`
   - `portalUserId`
   - `workspaceId`
   - `workspaceSessionId`
   - `runtimeSessionId`
   - `runId`，如果记录属于 run
3. 事件类型统一：
   - `opl_launch_created`
   - `opl_bootstrap_loaded`
   - `runner_run_submitted`
   - `runner_run_status_synced`
   - `runner_artifact_synced`
   - `runner_cost_pending`
   - `runner_cost_reconciled`
   - `runner_run_failed`

### 交付标准

- `server.mjs` 不再直接散落 `state.runs.push()`、`state.artifacts.push()`、`state.costRecords.push()`。
- 所有新增记录具备完整 ID 链。
- 既有 smoke 仍通过。

### 验证命令

```powershell
npm --prefix services/opl-runtime-bridge run check
node scripts/smoke-test-opl-product-api-bridge.mjs
```

## 7. Step 3：AionUI shell launch + bootstrap

### 目的

让 Portal launch 真实进入 AionUI shell；AionUI 通过 bridge bootstrap 拿当前用户、workspace、runtime session 和 OPL resources。

### 修改范围

- 修改 `services/opl-runtime-bridge/src/server.mjs`
- 修改 `services/portal/src/server.mjs`，只在必要时补 session API 字段，不改变 Portal 直连边界
- 新建 `scripts/smoke-test-portal-aionui-opl-hard-loop.mjs`
- 更新推进日志

### 怎么做

1. bridge `/api/launch-tokens` 创建：
   - workspace
   - workspace session
   - runtime session
   - launch token
2. bridge 调 OPL Product API：
   - bind workspace
   - create OPL session
3. bridge 返回：
   - `launchToken`
   - `workspaceSessionId`
   - `runtimeSessionId`
   - `bootstrapUrl`
   - `workbenchUrl`
4. `workbenchUrl` 规则：
   - 有 `OPL_AION_SHELL_URL`：指向 AionUI shell
   - URL query 必须包含 `launch_token` 和 `bridge_url`
   - 没有 `OPL_AION_SHELL_URL`：仅测试模式用 bridge `/workbench` 投影
5. Portal 继续只调用 bridge 的 `/api/launch-tokens`。

### 交付标准

- Portal 不直连 AionUI。
- Portal launch response 的 `workbenchUrl` 来自 bridge。
- AionUI shell URL 可通过 `launch_token` 调 bridge bootstrap。
- bootstrap 的 `workspaceSessionId / runtimeSessionId` 与 Portal session 一致。

### 验证命令

```powershell
npm --prefix services/portal run check
npm --prefix services/opl-runtime-bridge run check
node scripts/smoke-test-portal-aionui-opl-hard-loop.mjs
```

## 8. Step 4：runner-client + bridge run submit

### 目的

把 bridge 的 run 执行从本地假完成替换为调用 med-autoscience-runner internal API。

### 修改范围

- 新建 `services/opl-runtime-bridge/src/runner-client.mjs`
- 修改 `services/opl-runtime-bridge/src/server.mjs`
- 修改或新增 bridge-run smoke
- 更新推进日志

### 怎么做

1. `runner-client.mjs` 读取：
   - `MED_AUTOSCIENCE_RUNNER_URL`
   - `MED_AUTOSCIENCE_RUNNER_TOKEN`
2. 实现：
   - `createWorkspace(context)`
   - `submitRun(context)`
   - `getRunStatus(runId)`
   - `getRunLogs(runId)`
   - `listOutputs(context)`
3. bridge `/api/runtime-sessions/:id/runs`：
   - 校验 runtime session 存在
   - 组装完整 ID 链
   - 调 runner `/api/workspaces`
   - 调 runner `/api/runs`
   - 将返回状态写为 `queued` 或 `submitted`
   - 不写 fake artifact
   - 不写 fake exact cost
4. runner 不可用时：
   - run 不创建成功记录
   - 返回真实错误
   - 写 `runner_run_failed` 事件

### 交付标准

- bridge run record 的 `runId` 与 runner 返回的 `runId` 一致。
- run 初始状态来自 runner。
- bridge 不再直接写 `completed`。
- bridge 不再在 submit 时写本地 contract report 当作真实 artifact。

### 验证命令

```powershell
npm --prefix services/opl-runtime-bridge run check
node scripts/smoke-test-portal-aionui-opl-hard-loop.mjs
```

## 9. Step 5：runner K8s labels/status/outputs

### 目的

让 med-autoscience-runner 真实提交 K8s Job，并把状态和 outputs 按完整 ID 链返回。

### 修改范围

- 修改 `adapters/med-autoscience-runner/src/server.mjs`
- 修改 `infra/kubernetes/job-template.yaml`
- 新建 `scripts/smoke-test-bridge-real-runner-k8s.mjs`
- 更新 `scripts/smoke-test-med-autoscience-runner-api.mjs`
- 更新推进日志

### 怎么做

1. runner `/api/runs` 必须接收：
   - `portalUserId`
   - `customerId`
   - `userId`
   - `workspaceId`
   - `workspaceSessionId`
   - `runtimeSessionId`
   - `runId`
   - `agentId`
   - `toolName`
   - `billingScope`
   - `costCenter`
2. K8s Job metadata labels 和 pod template labels 必须包含：
   - `portal_user_id`
   - `user_id`
   - `workspace_id`
   - `workspace_session_id`
   - `runtime_session_id`
   - `run_id`
   - `agent_id`
   - `tool_name`
   - `billing_scope`
   - `cost_center`
3. container env 同步传入同一组核心 ID。
4. `GET /api/runs/:id/status`：
   - `queued`：manifest 已生成但未提交
   - `submitted`：kubectl apply 成功但没有 active/succeeded/failed
   - `running`：job active > 0
   - `succeeded`：job succeeded > 0
   - `failed`：job failed > 0 或失败 condition
   - 未知 K8s 状态不得当成功
5. `GET /api/workspaces/:customerId/:workspaceId/outputs` 返回真实 outputs 文件清单，包含路径、大小、mtime、contentType 或 objectKey。

### 交付标准

- `kubectl get job -n med-agent-demo --show-labels` 能看到完整 ID 链。
- runner API status 与 K8s Job status 一致。
- outputs API 返回真实文件清单，而不是空壳字符串。
- K8s smoke 在 `RUN_K8S_SMOKE=1` 时跑真实集群；条件不足时明确 skip，并说明缺什么。

### 验证命令

```powershell
npm --prefix adapters/med-autoscience-runner run check
node scripts/smoke-test-med-autoscience-runner-api.mjs
$env:RUN_K8S_SMOKE="1"; node scripts/smoke-test-bridge-real-runner-k8s.mjs
```

## 10. Step 6：artifact/trace/cost 回流 + Portal 可观测

### 目的

让 Portal 用户端和管理员端能看到真实 run 的商业与运行证据。

### 修改范围

- 修改 `services/opl-runtime-bridge/src/server.mjs`
- 修改 `services/opl-runtime-bridge/src/state-store.mjs`
- 修改 `services/portal/src/server.mjs`
- 更新 `scripts/smoke-test-portal-aionui-opl-hard-loop.mjs`
- 更新推进日志

### 怎么做

1. bridge 同步 runner status：
   - 提供 run status 查询或在 bootstrap 中刷新
   - 写 `runner_run_status_synced`
2. bridge 同步 artifact：
   - 调 runner `listOutputs(context)`
   - 对每个 output 写 artifact record
   - 写 `runner_artifact_synced`
3. bridge 写 trace：
   - `traceId`
   - `runId`
   - `portalUserId`
   - `workspaceId`
   - `workspaceSessionId`
   - `runtimeSessionId`
   - `model`
   - `tokenCount`
   - `userAgent`
   - `latencyMs`
   - `status`
   - `error`
4. bridge 写 run actions：
   - `launch_created`
   - `bootstrap_loaded`
   - `runner_workspace_created`
   - `runner_run_submitted`
   - `runner_status_synced`
   - `artifact_synced`
   - `cost_pending`
5. cost 规则：
   - run submit 后只允许 `status: pending`
   - OpenCost/云账单对上 labels 后才允许 `status: exact`
   - 不允许生产路径写 `pricingSource: contract-zero-cost`
6. Portal API/页面补字段：
   - session list 展示 `runtimeSessionId / runId / status / latency / token / userAgent`
   - 管理员视图展示 run、成本、K8s 分发、异常

### 交付标准

- 同一个 run 在 Portal 可见：
   - session
   - run status
   - run actions
   - trace
   - artifact
   - cost pending/exact
- 失败 run 可见错误，不被吞掉。
- 未完成 run 不显示为已完成。
- 未对账成本不显示为 exact。

### 验证命令

```powershell
npm --prefix services/portal run check
npm --prefix services/opl-runtime-bridge run check
node scripts/smoke-test-portal-aionui-opl-hard-loop.mjs
node scripts/check-commercial-blockers.mjs
```

## 11. Step 7：live 启动、compose、文档、最终验收

### 目的

把真实联调从单脚本 smoke 收口成可启动、可部署、可交接的工程路径。

### 修改范围

- 修改 `scripts/start-portal-live.mjs`
- 修改 `.env.demo.template`
- 修改 `compose.demo.yaml`
- 修改 `configs/gateway/nginx.conf`，如需 AionUI/bridge 转发
- 修改 `README.md`
- 修改 `infra/production-hardening/pre-launch-checklist.md`
- 更新推进日志

### 怎么做

1. `start-portal-live.mjs` 同时启动：
   - Portal
   - OPL runtime bridge
   - med-autoscience-runner
   - 可选 OPL fixture
2. `.env.demo.template` 补：
   - `OPL_PRODUCT_API_URL`
   - `OPL_PRODUCT_API_TOKEN`
   - `OPL_AION_SHELL_URL`
   - `MED_AUTOSCIENCE_RUNNER_URL`
   - `MED_AUTOSCIENCE_RUNNER_TOKEN`
   - `MED_AUTOSCIENCE_RUNNER_IMAGE`
   - `K8S_NAMESPACE`
3. `compose.demo.yaml` 补 runner service，并让 bridge depends_on runner。
4. README 写清：
   - fixture 联调方式
   - AionUI shell 联调方式
   - runner/K8s smoke 方式
   - OpenCost 对账前后 cost 状态含义
5. pre-launch checklist 增加：
   - OPL Product API 可用性
   - AionUI shell 可用性
   - runner internal API 鉴权
   - K8s namespace/labels
   - MinIO/COS outputs
   - OpenCost label 分摊
   - Portal admin run/cost/exception visibility

### 交付标准

- 本地 live 一条命令能启动 Portal + bridge + runner。
- README 足够让下一位开发者复现 smoke。
- pre-launch checklist 覆盖上线前阻塞项。
- 推进日志完整记录每一步证据。

### 验证命令

```powershell
node scripts/start-portal-live.mjs
node scripts/smoke-test-opl-product-api-bridge.mjs
node scripts/smoke-test-portal-aionui-opl-hard-loop.mjs
node scripts/check-commercial-blockers.mjs
```

## 12. AI 执行分工建议

默认不并行改同一个文件。

### 第一批：顺序执行

1. `executor-bridge-opl-client`
   - 负责 Step 1。
   - 写 `opl-client.mjs`、OPL fixture、OPL bridge smoke。
   - 修改 `server.mjs` 中 bootstrap resources。

2. `executor-bridge-state-store`
   - 负责 Step 2。
   - 拆 `state-store.mjs`。
   - 不改变外部 API 行为。

3. `executor-aionui-launch`
   - 负责 Step 3。
   - 改 launch/workbench/bootstrap。
   - 写 Portal+AionUI+OPL hard-loop smoke。

第一批必须串行，因为都触碰 bridge `server.mjs`。

### 第二批：可并行但需边界清楚

4. `executor-runner-client`
   - 负责 Step 4 的 bridge 侧。
   - 写 `runner-client.mjs`。
   - 改 bridge run submit。

5. `executor-runner-k8s`
   - 负责 Step 5 的 runner/K8s 侧。
   - 改 `adapters/med-autoscience-runner/src/server.mjs`。
   - 改 `infra/kubernetes/job-template.yaml`。

这两个可以并行，前提是先约定 runner API request/response contract。

### 第三批：收口执行

6. `executor-portal-observability`
   - 负责 Step 6 的 Portal 侧。
   - 改 session/run/trace/billing/admin 展示和 API payload。

7. `executor-live-docs`
   - 负责 Step 7。
   - 改 live 启动、compose、env、README、pre-launch checklist。

8. `verifier-hard-loop`
   - 最后统一验收。
   - 跑 check/smoke。
   - 扫 `contract-zero-cost`、假 completed、旧入口。
   - 检查推进日志完整性。

## 13. 关键合同

### 13.1 Launch response

bridge `/api/launch-tokens` 返回：

```json
{
  "ok": true,
  "launchId": "...",
  "portalUserId": "...",
  "workspaceId": "...",
  "workspaceSessionId": "...",
  "runtimeSessionId": "...",
  "launchToken": "...",
  "workbenchUrl": "...",
  "bootstrapUrl": "..."
}
```

### 13.2 Bootstrap response

bridge `/api/workbench/bootstrap` 返回：

```json
{
  "version": "v1",
  "launch": {},
  "runtimeSession": {},
  "resources": {
    "system": {},
    "engines": [],
    "modules": [],
    "agents": [],
    "workspaces": [],
    "sessions": [],
    "progress": [],
    "artifacts": []
  },
  "runs": []
}
```

### 13.3 Runner submit response

runner `/api/runs` 返回：

```json
{
  "ok": true,
  "run": {
    "runId": "...",
    "jobName": "med-autoscience-...",
    "namespace": "med-agent-demo",
    "status": "submitted",
    "manifestPath": "...",
    "portalUserId": "...",
    "workspaceId": "...",
    "workspaceSessionId": "...",
    "runtimeSessionId": "...",
    "agentId": "mas",
    "toolName": "med-autoscience",
    "billingScope": "run",
    "costCenter": "research-foundry"
  }
}
```

### 13.4 Cost record

未对账：

```json
{
  "status": "pending",
  "pricingSource": "opencost-pending",
  "totalCost": null
}
```

已对账：

```json
{
  "status": "exact",
  "pricingSource": "opencost",
  "totalCost": 0.123
}
```

## 14. 风险与处理

### 风险 1：OPL Product API 实际字段与 fixture 不一致

处理：
- fixture 只固定 bridge 需要的内部 normalized contract。
- `opl-client.mjs` 单独负责外部字段映射。
- 真实 OPL 接入时只改 client mapper，不改 Portal。

### 风险 2：AionUI shell URL contract 未定

处理：
- bridge 先采用最小 query contract：`launch_token` + `bridge_url`。
- AionUI 后续如需要 hash route 或 path route，只改 `buildWorkbenchUrl()`。

### 风险 3：runner/K8s 环境不可用

处理：
- K8s smoke 必须明确 skip 条件。
- skip 只能代表环境不足，不能代表功能通过。
- fixture smoke 和 K8s smoke 分开记录。

### 风险 4：成本对账滞后

处理：
- submit 后只写 `pending`。
- exact 必须来自 OpenCost/云账单对账。
- Portal 明确显示 pending 与 exact，不混淆。

### 风险 5：旧合同测试误导为生产真相

处理：
- 旧 smoke 命名和输出标注为 fixture/contract test。
- 商业阻塞检查扫描 `contract-zero-cost` 生产路径。

## 15. 不做事项

- 不接 LibreChat。
- 不把旧 MCP 当产品入口。
- 不让 Portal 直连 AionUI 或 runner。
- 不让 AionUI 拥有计费、K8s、钱包真相。
- 不把未完成 run 写成 `completed`。
- 不把未对账 cost 写成 `exact`。
- 不通过临时映射补 OpenCost labels，labels 必须在 K8s Job 创建时完整写入。

## 16. 每步日志格式

每完成一个 step，必须更新：

`docs/logs/2026-04-24-Portal-AionUI-OPL-真实联调推进日志-v1.md`

格式：

```markdown
## 2026-04-24 Step N：标题

目的：
- ...

修改文件：
- ...

验证：
- 命令：...
- 结果：通过/失败/跳过

证据：
- portalUserId:
- workspaceId:
- workspaceSessionId:
- runtimeSessionId:
- runId:
- jobName:
- artifactId:
- traceId:
- costRecordId:

未完成：
- ...
```

## 17. 最终完成定义

以下全部满足才算完成：

- Portal 可以创建 workspace session 并拿到 AionUI workbench URL。
- AionUI/fixture 可以通过 launch token 获取 OPL bootstrap。
- OPL bootstrap resources 来自 Product API。
- bridge 可以提交 med-autoscience runner run。
- runner 可以创建 K8s Job。
- K8s Job labels 包含完整 ID 链和计费标签。
- runner status 能真实反映 K8s Job 状态。
- runner outputs 能回流为 artifact records。
- trace、latency、token、user-agent、run actions 可在 Portal 查询。
- cost pending/exact 可在 Portal 查询。
- 管理员能看到用户、run、成本、K8s 分发和异常。
- 所有 smoke/check 通过，K8s 条件不足时只允许明确 skip。
- 推进日志完整。
