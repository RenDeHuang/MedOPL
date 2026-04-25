# 2026-04-25 Portal / OPL Web 真实适配推进日志 v1

## 已完成

- Step 1 / 7 语义对齐
  - `README.md`
  - `.env.demo.template`
  - `compose.demo.yaml`
  - `infra/production-hardening/pre-launch-checklist.md`
  - 主线已改为 `Portal -> real OPL Web -> med-autoscience-runner -> Portal control-plane recovery`
  - `OPL Product API fixture` 已明确标成 `dev/test only`
  - `OPL_WEB_URL`、`PORTAL_OPL_ADAPTER_URL` 已作为推荐变量，旧变量不再作为运行态主路
  - Langfuse / Harbor / OpenCost / MinIO / Rancher 已归到 Portal 控制面叙事

- Step 2 Portal launch 产品化
  - `services/portal/src/server.mjs`
  - 新入口 `POST /portal/api/opl/launch`
  - 旧入口 `POST /portal/api/workbench/launch` 已退场为 `410 legacy_endpoint_retired`
  - Portal 返回 `launchToken`、`launchId`、`oplWebUrl`、`runtimeSession`
  - `/portal/workbench` 仅重定向到 `/portal/opl`

- Step 3 adapter 合同层
  - `services/opl-runtime-bridge/src/server.mjs`
  - 已提供：
    - `GET /api/opl-launch/bootstrap`
    - `POST /api/opl-launch/runs`
    - `GET /api/opl-launch/runs/:runId/status`
    - `GET /api/opl-launch/runs/:runId/artifacts`
  - 旧接口已退场为 `410 legacy_endpoint_retired`：
    - `/api/launch-tokens`
    - `/api/workbench/bootstrap`
    - `/api/runtime-sessions/:id/runs`
    - `/api/runs/:id/status`
  - bootstrap 已包含 `portal`、`workspace`、`callbacks`、`resources`

- Step 5 / 6 fixture 硬闭环
  - Portal launch
  - OPL bootstrap
  - adapter startRun
  - med-autoscience runner fixture 执行
  - Portal 回收 run / trace / artifact / pending cost

## 新增 / 更新验证脚本

- 新增：
  - `scripts/smoke-test-portal-opl-web-launch.mjs`
  - `scripts/smoke-test-opl-launch-adapter.mjs`
  - `scripts/smoke-test-portal-opl-web-hard-loop.mjs`
- 收缩更新：
  - `scripts/smoke-test-portal-opl-adapter.mjs`
  - `scripts/smoke-test-opl-product-api-adapter.mjs`

## 本轮验证结果

- `npm --prefix services/portal run check` 通过
- `npm --prefix services/opl-runtime-bridge run check` 通过
- `node --check scripts/smoke-test-portal-opl-web-launch.mjs` 通过
- `node --check scripts/smoke-test-opl-launch-adapter.mjs` 通过
- `node --check scripts/smoke-test-portal-opl-web-hard-loop.mjs` 通过
- `node scripts/smoke-test-portal-opl-web-launch.mjs` 通过
- `node scripts/smoke-test-opl-launch-adapter.mjs` 通过
- `node scripts/smoke-test-portal-opl-web-hard-loop.mjs` 通过
- `node scripts/smoke-test-portal-opl-adapter.mjs` 通过
- `node scripts/smoke-test-opl-product-api-adapter.mjs` 通过

## 未完成

- Step 4 真实 OPL Web 接入验收
  - 本机 `http://127.0.0.1:8787/api/health` 不可达
  - 因此当前不能宣称“Portal 已接上真实 OPL Web 并完成实机验收”

- Step 8 非 fixture 最终硬闭环
  - 目前跑通的是 fixture 闭环，不是外部真实 OPL Product API 闭环
  - `node scripts/smoke-test-opl-real-web.mjs` 在默认条件下仅返回 `RUN_OPL_REAL_SMOKE!=1` 的 skip

- 真实 K8s 验收
- `node scripts/smoke-test-portal-opl-adapter-real-runner-k8s.mjs` 在默认条件下仅返回 `RUN_K8S_SMOKE!=1` 的 skip
  - 还没有真实 namespace / image / cluster 证据

## 阻塞原因

- 缺真实 OPL Web 运行实例与可访问 URL
- 缺真实 K8s smoke 所需环境变量与集群上下文
- 这两项如果不具备，继续宣称 Step 4 / 8 完成会变成假收口
