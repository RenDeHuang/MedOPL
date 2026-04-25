# Portal AionUI/OPL 真实联调推进日志 v1

## 2026-04-24 Step 0：方案落地

修改文件：
- `docs/plan/2026-04-24-Portal-AionUI-OPL-真实联调开发方案-v1.md`
- `docs/logs/2026-04-24-Portal-AionUI-OPL-真实联调推进日志-v1.md`

结论：
- 下一轮主线是把当前 OPL runtime bridge 接入 one-person-lab Product API / AionUI shell。
- bridge 后面的 contract run 要替换为 `med-autoscience-runner` internal API + 真实 K8s Job。
- Portal 只负责控制面与观测，不直连 AionUI 或 runner。

验证：
- 本 step 为方案与任务边界落地，未改运行代码。
- 后续每个 AI 开发 step 必须在本文件补充修改文件、测试命令、证据 ID 和未完成原因。

未完成：
- 尚未开发 `opl-client.mjs`。
- 尚未开发 `runner-client.mjs`。
- 尚未完成真实 AionUI shell launch。
- 尚未完成真实 K8s runner smoke。

## 2026-04-24 Step 1：OPL Product API fixture/client

目的：
- 让 bridge bootstrap 的 resources 事实源来自 OPL Product API，而不是 bridge 本地硬编码。

修改文件：
- `services/opl-runtime-bridge/src/opl-client.mjs`
- `scripts/fixtures/opl-product-api-fixture.mjs`
- `scripts/smoke-test-opl-product-api-bridge.mjs`
- `services/opl-runtime-bridge/src/server.mjs`

验证：
- 命令：`npm --prefix services/opl-runtime-bridge run check`
- 结果：通过
- 命令：`node scripts/smoke-test-opl-product-api-bridge.mjs`
- 结果：通过，`resources.system.id=opl-product-api-fixture`

证据：
- launchId: `0941e9bd-cd66-493b-b538-da45e2bb4e2d`
- workspaceSessionId: `a28074ca-b07d-40e6-9853-4836d9991783`
- runtimeSessionId: `774e5f75-4676-4fb8-83f5-afbf68ea7898`

未完成：
- 未接真实线上 OPL Product API；当前用 fixture 锁定 bridge 合同。原因：上游 OPL 可拉取上架 K8s 后再替换 `OPL_PRODUCT_API_URL`。

## 2026-04-24 Step 2：bridge state-store 拆分

目的：
- 把 bridge 状态读写从 `server.mjs` 拆出，统一记录 launch/session/run/artifact/trace/cost/event。

修改文件：
- `services/opl-runtime-bridge/src/state-store.mjs`
- `services/opl-runtime-bridge/src/server.mjs`

验证：
- 命令：`npm --prefix services/opl-runtime-bridge run check`
- 结果：通过
- 命令：`node scripts/smoke-test-opl-runtime-bridge.mjs`
- 结果：通过

证据：
- runId: `bridge-smoke-run`
- runtimeSessionId: `6f1dbf9b-c073-4235-9117-05ab19b79671`

未完成：
- 未引入数据库持久化；仍使用 `state.json`。原因：本轮目标是联调合同和真实状态，不扩大存储迁移范围。

## 2026-04-24 Step 3：AionUI shell launch/bootstrap

目的：
- Portal launch 后由 bridge 返回 AionUI shell URL；AionUI 通过 launch token 和 bridge bootstrap 获取 OPL resources。

修改文件：
- `services/opl-runtime-bridge/src/server.mjs`
- `scripts/smoke-test-portal-aionui-opl-hard-loop.mjs`

验证：
- 命令：`node scripts/smoke-test-portal-aionui-opl-hard-loop.mjs`
- 结果：通过，`workbenchUrl` 指向 `http://127.0.0.1:19999/aion?...launch_token...bridge_url...`

证据：
- runtimeSessionId: `c9c7045b-cd9b-4666-8f26-9cf206c3b938`
- workspaceSessionId: `8c785243-e66b-4e31-9e17-3c765d689b88`

未完成：
- 未启动真实 AionUI 进程。原因：AionUI 本体不在本仓库内，本轮通过 `OPL_AION_SHELL_URL` 接入外部 shell。

## 2026-04-24 Step 4：runner-client + bridge run submit

目的：
- bridge run 不再本地写假 completed/artifact/cost，而是调用 med-autoscience runner internal API。

修改文件：
- `services/opl-runtime-bridge/src/runner-client.mjs`
- `services/opl-runtime-bridge/src/server.mjs`
- `scripts/fixtures/med-autoscience-runner-fixture.mjs`
- `scripts/smoke-test-opl-runtime-bridge.mjs`

验证：
- 命令：`node scripts/smoke-test-opl-runtime-bridge.mjs`
- 结果：通过，run 初始 submitted，status sync 后 succeeded，artifactCount=1，costCount=1

证据：
- runId: `bridge-smoke-run`
- runtimeSessionId: `6f1dbf9b-c073-4235-9117-05ab19b79671`

未完成：
- 未在 bridge smoke 中提交真实 K8s Job。原因：K8s 真实提交由 Step 5 的 `RUN_K8S_SMOKE=1` gated smoke 承担。

## 2026-04-24 Step 5：runner K8s labels/status/outputs

目的：
- runner 接收完整 ID 链，K8s Job labels/env 完整，状态和 outputs 返回真实结构。

修改文件：
- `adapters/med-autoscience-runner/src/server.mjs`
- `infra/kubernetes/job-template.yaml`
- `scripts/smoke-test-med-autoscience-runner-api.mjs`
- `scripts/smoke-test-bridge-real-runner-k8s.mjs`

验证：
- 命令：`npm --prefix adapters/med-autoscience-runner run check`
- 结果：通过
- 命令：`node scripts/smoke-test-med-autoscience-runner-api.mjs`
- 结果：通过，`runId=runner-api-smoke`，`runStatus=succeeded`，outputs 包含 `result.json` 元数据
- 命令：`node scripts/smoke-test-bridge-real-runner-k8s.mjs`
- 结果：明确跳过，`reason=RUN_K8S_SMOKE!=1`

证据：
- runId: `runner-api-smoke`
- output: `result.json`
- objectKey: `med-autoscience/portal-user-smoke/default/outputs/result.json`

未完成：
- 未跑真实 K8s Job。原因：当前环境未设置 `RUN_K8S_SMOKE=1`，按设计明确 skip，不伪造通过。

## 2026-04-24 Step 6：artifact/trace/cost 回流 + Portal 可观测

目的：
- artifact、trace、pending cost 从 bridge 回流，并能通过 Portal 控制面 API 查询。

修改文件：
- `services/opl-runtime-bridge/src/server.mjs`
- `services/opl-runtime-bridge/src/state-store.mjs`
- `services/portal/src/server.mjs`
- `scripts/smoke-test-portal-aionui-opl-hard-loop.mjs`

验证：
- 命令：`npm --prefix services/portal run check`
- 结果：通过
- 命令：`node scripts/smoke-test-portal-aionui-opl-hard-loop.mjs`
- 结果：通过，Portal API 可见 bridge run/trace/pending cost

证据：
- runId: `portal-aionui-opl-smoke-run`
- runtimeSessionId: `c9c7045b-cd9b-4666-8f26-9cf206c3b938`
- Portal run count: `1`
- Portal trace count: `1`
- Portal cost status: `pending`

未完成：
- 未完成 OpenCost exact 对账。原因：本轮只完成 pending 记录和 labels 基础；exact 需要真实 K8s/OpenCost 对账环境。

## 2026-04-24 Step 7：live/docs 执行面补齐

目的：
- 恢复并升级本地 live 启动入口。
- 补齐 OPL Product API / AionUI shell / runner / K8s 所需环境变量、compose service、gateway 转发和上线前文档。

修改文件：
- `scripts/start-portal-live.mjs`
- `.env.demo.template`
- `compose.demo.yaml`
- `configs/gateway/nginx.conf`
- `README.md`
- `infra/production-hardening/pre-launch-checklist.md`
- `docs/logs/2026-04-24-Portal-AionUI-OPL-真实联调推进日志-v1.md`

验证：
- 命令：`node --check scripts/start-portal-live.mjs`
- 结果：通过
- 命令：`docker compose -f compose.demo.yaml config`
- 结果：通过
- 命令：`node scripts/start-portal-live.mjs`
- 结果：通过，已启动 Portal/bridge/runner/OPL fixture
- 命令：`node scripts/check-commercial-blockers.mjs`
- 结果：通过，Portal、bridge、gateway、OpenCost、Harbor、MinIO、Rancher health 均为 200
- 命令：`Get-Content -Raw -Encoding UTF8 .env.demo.template`
- 结果：已确认包含 `OPL_PRODUCT_API_URL/TOKEN`、`OPL_AION_SHELL_URL`、`MED_AUTOSCIENCE_RUNNER_URL/TOKEN/IMAGE`、`K8S_NAMESPACE`
- 命令：`Get-Content -Raw -Encoding UTF8 compose.demo.yaml`
- 结果：已确认包含 `med-autoscience-runner` 与 `opl-product-api-fixture` service

证据：
- 说明：本 step 为 live/docs 补齐，不直接生成 run/session 证据 ID

未完成：
- 尚未接真实外部 AionUI/OPL 服务。原因：等待 OPL 更新完成后拉取上架 K8s，再用环境变量切换。
- 尚未跑 `RUN_K8S_SMOKE=1`。原因：当前未启用真实 K8s smoke 条件。

## 2026-04-25 补充：真实 one-person-lab Web/Product API 适配

目的：
- 确认 `one-person-lab` 已推出本地 Web/Product API 服务，并让本仓库 bridge 可对接真实 `/api/opl` g2 surface，而不只依赖 fixture。

上游确认：
- `one-person-lab` 当前提供 `opl web`，用于启动本地 OPL Product API service。
- `one-person-lab` 当前提供 `opl service install/status/start/stop/open/uninstall`，默认 host 为 `127.0.0.1`，默认 port 为 `8787`。
- canonical API 前缀为 `/api/opl`，资源面包括 `system/engines/modules/agents/workspaces/sessions/progress/artifacts`。
- 工作区绑定动作路径为 `/api/opl/workspaces/bind`；真实 session create 路径 `/api/opl/sessions` 是 domain ask/session 创建入口，需要 `goal`，不适合 Portal launch 阶段伪造调用。

修改文件：
- `services/opl-runtime-bridge/src/opl-client.mjs`
- `services/opl-runtime-bridge/src/server.mjs`
- `services/opl-runtime-bridge/src/state-store.mjs`
- `services/portal/src/server.mjs`
- `scripts/fixtures/opl-product-api-fixture.mjs`
- `scripts/smoke-test-opl-real-web.mjs`
- `.env.demo.template`
- `README.md`
- `infra/production-hardening/pre-launch-checklist.md`
- `docs/logs/2026-04-24-Portal-AionUI-OPL-真实联调推进日志-v1.md`

已交付：
- `opl-client.mjs` 支持真实 OPL g2 nested payload：`engines.items`、`modules.items`、`agents.items`、`workspaces.projects/bindings`、`sessions.items`、`progress`、`artifacts.deliverable_files/supporting_files`。
- Product API URL 现在保留 base path，支持 `http://host/base-path/api/...`。
- workspace bind 优先调用 `/api/opl/workspaces/bind`，仅在 404/405 时回到旧 fixture `/api/opl/workspaces`。
- Portal launch 会把 `taskSpace.path` 传给 bridge，bridge 会继续传给真实 OPL 的 `workspace_path`。
- 对真实 OPL 的 session create 差异做了显式处理：没有 `goal` 时记录 `opl_session_create_deferred`，不伪造 `oplSessionId`。
- 新增 `scripts/smoke-test-opl-real-web.mjs`，用于真实 OPL Web/Product API 读面和可选 bridge bind 验收。

验证：
- 命令：`node --check services/opl-runtime-bridge/src/opl-client.mjs`
- 结果：通过
- 命令：`node --check services/opl-runtime-bridge/src/state-store.mjs`
- 结果：通过
- 命令：`node --check scripts/fixtures/opl-product-api-fixture.mjs`
- 结果：通过
- 命令：`node --check scripts/smoke-test-opl-real-web.mjs`
- 结果：通过
- 命令：`npm --prefix services/opl-runtime-bridge run check`
- 结果：通过
- 命令：`npm --prefix services/portal run check`
- 结果：通过
- 命令：`node scripts/smoke-test-opl-product-api-bridge.mjs`
- 结果：通过
- 命令：`node scripts/smoke-test-opl-runtime-bridge.mjs`
- 结果：通过
- 命令：`node scripts/smoke-test-portal-aionui-opl-hard-loop.mjs`
- 结果：通过
- 命令：`node scripts/smoke-test-opl-real-web.mjs`
- 结果：明确跳过，`reason=RUN_OPL_REAL_SMOKE!=1`
- 命令：`GET http://127.0.0.1:8787/api/health`
- 结果：真实 OPL Web 当前未在本机运行，无法连接到远程服务器。

证据：
- OPL Product API bridge launchId: `82f7188d-0cb6-4b58-bd6c-5f03050b5e13`
- OPL Product API bridge workspaceSessionId: `928a0398-ac0a-4ccf-97fa-11e583caaa80`
- OPL Product API bridge runtimeSessionId: `6c81a35e-1ede-449e-9bdb-f962656b7af8`
- OPL runtime bridge launchId: `3fbb69d8-5edd-454c-940d-db16acfaf571`
- OPL runtime bridge runtimeSessionId: `81f384ee-91ea-4b80-bb1d-f5e6771e5e3d`
- OPL runtime bridge runId: `bridge-smoke-run`
- Portal hard-loop workspaceSessionId: `8c785243-e66b-4e31-9e17-3c765d689b88`
- Portal hard-loop runtimeSessionId: `1f305641-c085-471f-8972-dbae746a7632`
- Portal hard-loop runId: `portal-aionui-opl-smoke-run`
- Portal hard-loop cost status: `pending`

未完成：
- 尚未完成真实 OPL Web 运行态验收。原因：本机 `http://127.0.0.1:8787/api/health` 当前未运行；需要先在 `one-person-lab` 仓库执行 `opl web --host 127.0.0.1 --port 8787` 或 `opl service start`。
- 尚未完成真实 OPL workspace bind 验收。原因：需要设置 `RUN_OPL_REAL_SMOKE=1`、`RUN_OPL_REAL_BRIDGE_SMOKE=1`、`OPL_PRODUCT_API_URL`、`OPL_REAL_PROJECT_ID`、`OPL_REAL_WORKSPACE_PATH` 后运行 `node scripts/smoke-test-opl-real-web.mjs`。
- 尚未完成真实 AionUI shell 验收。原因：`OPL_AION_SHELL_URL` 仍需指向实际 `opl-aion-shell` 服务或应用入口。
