# Portal -> AionUI/OPL -> OPL runtime -> med-autoscience 真实联调开发方案 v1

日期：2026-04-24

## 0. 结论

可以实现。

当前 v1 已经跑通本地合同闭环：Portal 生成 launch，OPL runtime bridge 建立 runtime session，contract run 写入 artifact/trace/cost。下一步不是再扩旧聊天壳，也不是再暴露旧 MCP 产品入口，而是把当前 bridge 改成真实 OPL/AionUI 接入层：

```text
Portal
-> OPL runtime bridge
-> one-person-lab Product API / AionUI GUI shell
-> med-autoscience-runner internal API
-> K8s Job
-> artifact / trace / cost / status 回流 Portal
```

`one-person-lab` 是 runtime/product API 的事实源；AionUI/`opl-aion-shell` 是 GUI shell 或 overlay，不拥有计费、存储、K8s 调度真相。Portal 仍负责开户、钱包、权限、任务空间、计费、存储、session 查看和管理员端。

## 1. 上游依据

- `one-person-lab` README：https://github.com/gaofeng21cn/one-person-lab
  - 维护 Codex-default runtime contract、Product API 和 OPL 资源真相。
- `one-person-lab` Product API 资源族：`system / engines / modules / agents / workspaces / sessions / progress / artifacts`。
- `opl-aion-shell` README：https://github.com/gaofeng21cn/opl-aion-shell
  - GUI shell 可以作为 OPL overlay；runtime/API 由 OPL 提供。

本方案的开发原则：
- 不把 AionUI 当后端事实源。
- 不把旧 MCP 当产品入口。
- 不在生产路径写 contract-zero-cost 假结果。
- OPL 或 runner 不可用时 fail closed，Portal 显示真实错误和事件日志。

## 2. 本轮要改哪些文件

### 必改代码

1. `services/opl-runtime-bridge/src/server.mjs`
   - 从“本地合同 mock run”改成“OPL + runner 编排入口”。
   - 保留 `/api/launch-tokens`、`/api/workbench/bootstrap`、`/api/runtime-sessions/:id/runs` 对 Portal/AionUI 的稳定合同。
   - 删除或隔离 `contract-zero-cost` 和本地假 artifact 写入。
   - 新增事件：`opl_launch_created`、`opl_bootstrap_loaded`、`runner_run_submitted`、`runner_run_status_synced`、`runner_artifact_synced`、`runner_cost_pending`、`runner_cost_reconciled`。

2. `services/opl-runtime-bridge/src/opl-client.mjs`（新建）
   - 负责调用 one-person-lab Product API。
   - 环境变量：
     - `OPL_PRODUCT_API_URL`
     - `OPL_PRODUCT_API_TOKEN`
     - `OPL_AION_SHELL_URL`
   - 必须实现：
     - `getSystem()`
     - `listEngines()`
     - `listModules()`
     - `listAgents()`
     - `bindWorkspace(portalContext)`
     - `createSession(portalContext)`
     - `getBootstrap(runtimeSession)`
   - 返回值必须统一映射为 bridge 内部 `resources`。

3. `services/opl-runtime-bridge/src/runner-client.mjs`（新建）
   - 负责调用 `adapters/med-autoscience-runner` 内部 API。
   - 环境变量：
     - `MED_AUTOSCIENCE_RUNNER_URL`
     - `MED_AUTOSCIENCE_RUNNER_TOKEN`
   - 必须实现：
     - `createWorkspace(context)`
     - `submitRun(context)`
     - `getRunStatus(runId)`
     - `getRunLogs(runId)`
     - `listOutputs(context)`
   - 所有请求都必须带完整 ID 链：`portalUserId / workspaceId / workspaceSessionId / runtimeSessionId / runId`。

4. `services/opl-runtime-bridge/src/state-store.mjs`（新建）
   - 把当前 `state.json` 读写从 `server.mjs` 拆出来。
   - 统一写入 launch/session/run/artifact/trace/cost/event。
   - 每条记录必须有 `createdAt` 或 `occurredAt`，并带上 ID 链。

5. `adapters/med-autoscience-runner/src/server.mjs`
   - `/api/runs` 从“生成 K8s manifest 后直接写 submitted”收口成真实 K8s runner 提交入口。
   - 增加 `runtimeSessionId`、`portalUserId`、`agentId`、`toolName`、`costCenter` 参数。
   - `GET /api/runs/:id/status` 要返回 `queued/submitted/running/succeeded/failed`，不能把未知状态当成功。
   - `GET /api/workspaces/:customerId/:workspaceId/outputs` 返回真实 outputs 文件清单。

6. `infra/kubernetes/job-template.yaml`
   - 确保 labels 完整：
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
   - OpenCost 后续只能靠这些 labels 分摊，不允许另起临时映射。

7. `services/portal/src/server.mjs`
   - `createOplWorkbenchLaunch()` 继续调用 bridge，不直连 AionUI 或 runner。
   - `/portal/api/sessions` 展示 OPL session/run/status/latency/token/user-agent。
   - `/portal/workbench` 跳转 bridge 返回的 `workbenchUrl`，该 URL 可指向 AionUI shell。

8. `scripts/start-portal-live.mjs`
   - 增加启动参数：
     - `OPL_PRODUCT_API_URL`
     - `OPL_AION_SHELL_URL`
     - `MED_AUTOSCIENCE_RUNNER_URL`
   - 本地 live 必须同时启动 Portal、bridge、runner。

9. `.env.demo.template`
   - 增加真实联调变量：
     - `OPL_PRODUCT_API_URL=`
     - `OPL_PRODUCT_API_TOKEN=`
     - `OPL_AION_SHELL_URL=`
     - `MED_AUTOSCIENCE_RUNNER_URL=http://127.0.0.1:18890`
     - `MED_AUTOSCIENCE_RUNNER_TOKEN=`
     - `MED_AUTOSCIENCE_RUNNER_IMAGE=`
     - `K8S_NAMESPACE=med-agent-demo`

10. `compose.demo.yaml`
    - 增加 `med-autoscience-runner` service。
    - bridge 依赖 runner。
    - gateway 增加 AionUI/bridge 必要转发。

### 必改测试

1. `scripts/smoke-test-opl-product-api-bridge.mjs`（新建）
   - 启动一个最小 OPL Product API fixture。
   - bridge 调 `/api/opl/system`、`engines/modules/agents/workspaces/sessions/progress/artifacts`。
   - 验收 bridge bootstrap 是否包含 OPL resources。

2. `scripts/smoke-test-portal-aionui-opl-hard-loop.mjs`（新建）
   - 启动 Portal + bridge + OPL fixture + runner fixture。
   - 从 Portal 创建 launch。
   - 验证 `workbenchUrl` 指向 `OPL_AION_SHELL_URL` 或 bridge `/workbench` 投影。
   - 验证 bootstrap 包含同一组 `workspaceSessionId/runtimeSessionId`。

3. `scripts/smoke-test-bridge-real-runner-k8s.mjs`（新建）
   - 只在 `RUN_K8S_SMOKE=1` 时执行。
   - 调 runner `/api/runs` 提交真实 K8s Job。
   - `kubectl get job -n $K8S_NAMESPACE --show-labels` 必须能看到完整 ID labels。
   - 不满足集群/镜像条件时测试应明确 skip，不伪造成功。

4. 更新 `scripts/smoke-test-portal-opl-hard-loop.mjs`
   - 保留本地快速合同测试，但要明确它是 fixture 测试。
   - 新增断言：生产模式下不得出现 `pricingSource: contract-zero-cost`。

### 必改文档/日志

1. `docs/logs/2026-04-24-Portal-AionUI-OPL-真实联调推进日志-v1.md`（新建）
   - 每完成一个 step 写：
     - 修改文件
     - 测试命令
     - 测试结果
     - 未完成原因

2. `README.md`
   - 增加真实联调启动方式。

3. `infra/production-hardening/pre-launch-checklist.md`
   - 增加 AionUI/OPL Product API/runner/K8s/OpenCost 的上线前检查。

## 3. Step 与交付标准

### Step A：OPL Product API fixture 和 client

开发：
- 新建 `services/opl-runtime-bridge/src/opl-client.mjs`。
- 新建 `scripts/fixtures/opl-product-api-fixture.mjs`。
- 新建 `scripts/smoke-test-opl-product-api-bridge.mjs`。

交付标准：
- bridge 可以从 fixture 拉到 `system/engines/modules/agents/workspaces/sessions/progress/artifacts`。
- bootstrap 响应里 `resources.system.id` 来自 OPL Product API，而不是 bridge 自造。

测试：
```powershell
npm --prefix services/opl-runtime-bridge run check
node scripts/smoke-test-opl-product-api-bridge.mjs
```

### Step B：AionUI shell launch 接入

开发：
- `services/opl-runtime-bridge/src/server.mjs`
  - `/api/launch-tokens` 返回 `workbenchUrl`。
  - 若设置 `OPL_AION_SHELL_URL`，URL 指向 AionUI shell，并携带 `launch_token` 与 `bridge_url`。
  - 若未设置，只允许本地 fixture 测试用 bridge `/workbench` 投影。
- `services/portal/src/server.mjs`
  - 不直连 AionUI，只信任 bridge 返回的 `workbenchUrl`。

交付标准：
- Portal launch 后跳到 AionUI shell URL。
- AionUI 可通过 bridge bootstrap 拿到当前 session/resources。
- Portal session API 能看到同一个 `workspaceSessionId/runtimeSessionId`。

测试：
```powershell
node scripts/smoke-test-portal-aionui-opl-hard-loop.mjs
```

### Step C：bridge 后端替换为真实 runner

开发：
- 新建 `services/opl-runtime-bridge/src/runner-client.mjs`。
- `services/opl-runtime-bridge/src/server.mjs`
  - `/api/runtime-sessions/:id/runs` 调 runner `/api/runs`。
  - run 初始状态来自 runner，不能直接写 `completed`。
  - artifact 只从 runner outputs 或 MinIO 返回结果生成。
- `adapters/med-autoscience-runner/src/server.mjs`
  - 确保 `/api/runs` 返回 `runId/jobName/namespace/status/manifestPath`。
  - 确保 `/api/runs/:id/status` 读取真实 K8s Job。

交付标准：
- bridge run record 和 runner run metadata 的 `runId` 一致。
- K8s Job labels 完整。
- 未跑完时 Portal 看到 `submitted/running`，不是假 `completed`。

测试：
```powershell
node scripts/smoke-test-med-autoscience-runner-api.mjs
$env:RUN_K8S_SMOKE="1"; node scripts/smoke-test-bridge-real-runner-k8s.mjs
```

### Step D：artifact / trace / cost 回流

开发：
- bridge 从 runner outputs 同步 artifact records。
- bridge 写 trace records：模型、token、user-agent、latency、status、error。
- cost 初始可写 `pending`，OpenCost 对上 labels 后再变 `exact`。
- Portal 账单页/轨迹页继续读 bridge/Portal 聚合数据。

交付标准：
- 同一个 run 在 Portal 可看到：
  - session
  - model/token/user-agent/latency/status
  - artifact
  - cost pending 或 exact
- 不允许把未对账 cost 写成 exact。

测试：
```powershell
node scripts/smoke-test-portal-aionui-opl-hard-loop.mjs
```

### Step E：上线前真实环境验收

交付标准：
- `kubectl get job -n med-agent-demo --show-labels` 能看到完整 ID 链。
- `kubectl logs -n med-agent-demo job/<job>` 有真实 med-autoscience runner 输出。
- Portal trace 页能按 session 查到运行。
- Portal billing 页能按 workspace/run 查到 cost pending/exact。
- OpenCost 能按 `run_id` 或 `workspace_id` label 分摊。

测试：
```powershell
kubectl get job -n med-agent-demo --show-labels
kubectl logs -n med-agent-demo job/<job>
node scripts/check-commercial-blockers.mjs
```

## 4. AI 开发任务顺序

推荐按下面顺序开 AI 开发，不要并行改同一个文件：

1. `executor-bridge-opl-client`
   - 写 `opl-client.mjs`、fixture、bridge bootstrap 集成。
   - 写并跑 `smoke-test-opl-product-api-bridge.mjs`。

2. `executor-runner-client`
   - 写 `runner-client.mjs`。
   - 改 bridge run 提交流程。
   - 不碰 Portal UI。

3. `executor-runner-k8s`
   - 改 `adapters/med-autoscience-runner/src/server.mjs` 和 `infra/kubernetes/job-template.yaml`。
   - 写 K8s smoke，可 skip 但不能假通过。

4. `executor-portal-observability`
   - 改 Portal session/trace/billing 展示字段。
   - 确保五行分页和真实状态不回退。

5. `verifier-hard-loop`
   - 跑所有 smoke、typecheck、build。
   - 复扫旧聊天壳/MCP 可执行入口。
   - 检查日志文档是否逐 step 更新。

## 5. 日志与提交规则

每个 AI 开发 step 必须更新：
- `docs/logs/2026-04-24-Portal-AionUI-OPL-真实联调推进日志-v1.md`

日志格式：

```markdown
## Step X

修改文件：
- ...

验证：
- 命令：...
- 结果：通过/失败

证据：
- runId:
- workspaceSessionId:
- runtimeSessionId:
- jobName:

未完成：
- ...
```

每次 commit 必须使用 Lore Commit Protocol，至少包含：
- `Constraint:`
- `Rejected:`
- `Tested:`
- `Not-tested:`

## 6. 不做什么

- 不再接 LibreChat。
- 不再把旧 MCP 当产品入口。
- 不把 AionUI shell 当计费/存储/session 真相源。
- 不用假 completed/fake cost 代表真实运行。
- 不在 Portal 里直连 runner；Portal 只通过 bridge 打开和查询 OPL runtime 合同。
