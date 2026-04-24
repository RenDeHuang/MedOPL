# Portal AionUI/OPL 硬闭环开发计划 v1

日期：2026-04-24

## 0. 唯一主线

v1 只保留一条产品主线：

```text
Portal 开户/登录
-> 创建或选择任务空间
-> 生成 OPL launch token
-> 打开 AionUI/OPL 工作台
-> OPL runtime 建立 workspace_session/runtime_session
-> 触发 med-autoscience run
-> artifact/trace/cost/status 回流 Portal
```

旧聊天壳代理、旧 workspace chat 代理、旧 MCP 产品入口不再是主线。`med-autoscience` 既有 server 代码只作为 runner 适配素材迁移，后续由 runtime bridge/orchestrator 调用，不由聊天壳直接暴露。

## 1. 目录整理原则

已迁移到 `C:\Users\Administrator\Desktop\平台搭建_v1` 的资产：

- `services/portal`：开户、钱包、任务空间、账单、trace、管理员后台。
- `services/opl-runtime-bridge`：承接 launch/session/run/artifact/trace/cost 合同。
- `adapters/billing-aggregator`：保留账本聚合语义，后续改读统一 cost records。
- `adapters/shared`：Portal 共享状态访问。
- `adapters/med-autoscience-runner`：由旧 med-autoscience adapter 迁移而来，后续去外部协议化。
- `infra/kubernetes`：Job/Pod/PVC 模板。
- `infra/opencost`、`infra/codex-runtime`、`infra/production-hardening`：云上成本与运行时基础设施素材。
- `scripts`：Portal、OpenCost、MinIO、billing、workspace lifecycle、OPL hard-loop 验证脚本。

明确不迁移为主路径：

- 旧聊天壳代理目录。
- 旧 workspace chat 代理目录。
- 旧 session bridge。
- 旧浏览器聊天 smoke。
- `.runtime`、`node_modules`、`dist`、临时 `tsbuildinfo`。

## 2. Step 与验收标准

### Step 1：文件夹收口

交付：
- v1 目录只包含可复用主线资产。
- 不提交 `node_modules`、`dist`、旧运行产物。
- 不包含旧聊天壳代理配置目录。

测试：
```powershell
Get-ChildItem -Recurse -Directory -Filter node_modules
Get-ChildItem -Recurse -Directory -Filter dist
Get-ChildItem configs -Directory
```

通过标准：
- `node_modules` 与 `dist` 只允许作为本地忽略产物存在，不进入 git。
- `configs` 下不存在旧聊天壳配置目录。

### Step 2：Portal 工作台入口切到 OPL

交付：
- `/portal/workbench` 调用 `services/opl-runtime-bridge` 的 `/api/launch-tokens`。
- 返回并跳转 `workbenchUrl`。
- `workspace_session` cookie 仍由 Portal 设置，便于控制面追踪。
- 不保留旧 `workspace-chat` 兼容入口。

测试：
```powershell
npm --prefix services/portal run check
node scripts/smoke-test-portal-opl-hard-loop.mjs
```

通过标准：
- `server.mjs` 静态检查通过。
- smoke 中 Portal launch 返回 `launchToken/workbenchUrl/runtimeSessionId`。
- smoke 过程中不访问旧聊天壳路径。

### Step 3：OPL runtime bridge 合同

交付：
- `POST /api/launch-tokens`
- `GET /api/workbench/bootstrap`
- `POST /api/runtime-sessions`
- `POST /api/runtime-sessions/:id/runs`
- `GET /api/runs`
- `GET /api/artifacts`

测试：
```powershell
npm --prefix services/opl-runtime-bridge run check
node scripts/smoke-test-opl-runtime-bridge.mjs
```

通过标准：
- 能创建 launch token。
- 能用 launch token bootstrap。
- 能创建 runtime run。
- 同一组 `portalUserId/workspaceId/workspaceSessionId/runtimeSessionId/runId` 出现在 run、artifact、trace、cost records。

### Step 4：med-autoscience runner 适配

交付：
- 旧实现素材迁移到 `adapters/med-autoscience-runner`。
- 当前不作为用户产品入口启动。
- 后续改造为 runtime-orchestrator 内部 adapter。

测试：
```powershell
node --check adapters/med-autoscience-runner/src/server.mjs
node scripts/smoke-test-med-autoscience-runner-api.mjs
```

通过标准：
- 代码静态检查通过。
- 内部 runner API `/healthz` 返回 `mode: "internal-runner"`。
- 能通过 `/api/workspaces` 创建 workspace，并通过 `/api/workspaces/:customerId/:workspaceId/files` 查询输入/输出清单。
- README 明确该目录不是用户入口。

### Step 5：本地硬闭环 contract run

交付：
- `smoke-test-portal-opl-hard-loop.mjs` 启动 bridge + Portal。
- 使用本地 Portal 登录。
- 创建 OPL launch。
- 触发 runtime run。
- 检查 artifact/trace/cost/session 记录。

通过标准：
- 输出 `ok: true`。
- `runtimeRun.status === "completed"`。
- bootstrap 能看到对应 artifact。
- Portal `/portal/api/sessions` 能看到 OPL workspace session。

### Step 6：云上真实 K8s 闭环

交付：
- runtime bridge/orchestrator 调 `med-autoscience-runner` 创建真实 K8s Job。
- Job labels 至少包含 `portal_user_id/user_id/workspace_id/workspace_session_id/runtime_session_id/run_id/agent_id/tool_name/billing_scope/cost_center`。
- OpenCost 能按 label 回填成本。

测试：
```powershell
kubectl get job -n med-agent-demo --show-labels
kubectl logs -n med-agent-demo job/<job>
```

通过标准：
- TKE/kind 中可见真实 Job。
- Portal 能按同一 `run_id` 看到 artifact、trace、cost。

本轮状态：
- Step 1-5 属于当前本地可闭环范围。
- Step 6 依赖真实 runner image、集群上下文、命名空间、镜像拉取权限与 OpenCost 采集链路，作为下一轮云上验收。

## 3. 剩余风险

- `services/portal/src/server.mjs` 仍偏大，后续应拆出 repository/service/router。
- `billing-aggregator` 仍有历史 `.runtime` 读取路径，后续要改为读 `cost_records`。
- trace 当前保留 Langfuse 查询素材，生产路径应改为 trace indexer。
- `adapters/med-autoscience-runner` 仍保留旧协议实现素材，后续要去协议外壳，只留 runner adapter。
