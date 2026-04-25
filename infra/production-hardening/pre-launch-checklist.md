# 上线前执行 Checklist

适用目标：

- 本地验证版准备迁移到云上。
- Portal OPL adapter / real OPL Web / med-autoscience-runner 即将切换到真实环境。
- 上线前做一轮值守复验。

## 1. 服务健康与入口

- `node scripts/check-commercial-blockers.mjs`
- Portal 管理员页检查 Portal 控制面集成：
  - Portal OPL adapter
  - Langfuse（可选 trace backend）
  - Rancher/K8s
  - OpenCost
  - Harbor
  - MinIO/COS
- OPL Product API 可访问：
  - fixture 环境（仅 dev/test）：`/opl-product-api/healthz`
  - 真实环境：`OPL_PRODUCT_API_URL`
  - one-person-lab 本地 Web/Product API：`GET /api/health`、`GET /api/opl/system`、`GET /api/opl/agents`
  - 验证命令：`RUN_OPL_REAL_SMOKE=1 node scripts/smoke-test-opl-real-web.mjs`
- OPL Web URL 可访问：
  - `OPL_WEB_URL`
- med-autoscience-runner internal API 可访问：
  - `GET /healthz`

## 2. 用户链路

- `node scripts/smoke-test-portal-opl-web-hard-loop.mjs`
- 抽样检查 Portal 开户、登录、余额、任务空间、账单、轨迹。
- 抽样检查 Portal launch 后是否跳到真实 OPL Web 返回的 `oplWebUrl`。
- 抽样检查 OPL 工作台 launch 与 bootstrap。
- 抽样检查 runtime run、artifact、trace、cost 回流。

## 3. OPL / OPL Web 合同

- 确认 `OPL_PRODUCT_API_URL` 指向正确环境。
- 确认真实 OPL 由 `opl web --host 127.0.0.1 --port 8787` 或 `opl service start` 提供。
- 确认真实 workspace bind 环境变量：
  - `OPL_DEFAULT_PROJECT_ID` 或 `OPL_REAL_PROJECT_ID`
  - `OPL_DEFAULT_WORKSPACE_PATH` 或 `OPL_REAL_WORKSPACE_PATH`
- 如需验证 Portal OPL adapter launch 到真实 OPL bind，运行：
  - `RUN_OPL_REAL_SMOKE=1 RUN_OPL_REAL_ADAPTER_SMOKE=1 node scripts/smoke-test-opl-real-web.mjs`
- 确认 bootstrap 返回：
  - `system`
  - `engines`
  - `modules`
  - `agents`
  - `workspaces`
  - `sessions`
  - `progress`
  - `artifacts`
- 确认 `oplWebUrl`：
  - 未配置 `OPL_WEB_URL` 时，不应宣称真实 OPL Web 已完成验收。
  - 配置 `OPL_WEB_URL` 时，必须实际指向真实 OPL Web。

## 4. runner / K8s 调度

- `node scripts/smoke-test-med-autoscience-runner-api.mjs`
- `RUN_K8S_SMOKE=1 node scripts/smoke-test-portal-opl-adapter-real-runner-k8s.mjs`
- `kubectl get job -n $K8S_NAMESPACE --show-labels`
- `kubectl logs -n $K8S_NAMESPACE job/<job>`
- 确认 labels 包含：
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

## 5. 任务空间与对象存储

- 抽样上传一个输入文件。
- 抽样下载一个输出文件。
- 抽样下载输入整包。
- 抽样下载输出整包。
- 确认 MinIO/COS 中文件归属与 Portal workspace 一致。
- 确认最近运行列表与 outputs 文件一致。

## 6. 账单与成本

- 打开 Portal 账单页。
- 检查 `pricingSource` 和 `status`。
- 运行中或待对账 run 应显示 `pending`。
- 只有完成 OpenCost/云账单对账后才允许显示 `exact`。
- 导出 run 级 CSV。
- 导出任务级汇总 CSV。
- 检查最近一笔扣费。
- 抽样核对一条 run 的时间、状态、成本来源。

## 7. Session / Trace / 管理员可观测

- Portal 用户端确认可查看：
  - session
  - trace
  - latency
  - user-agent
  - token
  - run actions
- Portal 管理员端确认可查看：
  - 用户
  - run
  - 成本
  - K8s 分发
  - 异常

## 8. Secrets

- `powershell -ExecutionPolicy Bypass -File scripts/verify-openbao-eso-local.ps1`
- ClusterSecretStore Ready。
- ExternalSecret Ready。
- probe Secret 值为 `ready`。
- runner、Portal、Portal OPL adapter、OPL Product API 所需 token/secret 已按环境注入。

## 9. 运维材料

- `infra/production-hardening/openbao-eso-production-package.md`
- `infra/production-hardening/monitoring-backup-recovery-runbook.md`
- `infra/production-hardening/pre-launch-checklist.md`

## 10. 风险确认

- 当前是否仍允许开放注册。
- 当前余额阻断是否开启。
- 当前生产定价是否已经替换掉 demo/估算值。
- 当前 `pending` 和 `exact` 是否被明确区分。
- 当前备份是否真实存在。
- 当前恢复流程是否至少演练过一次。
