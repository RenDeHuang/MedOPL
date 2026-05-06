# MedOPL v21 平台搭建

MedOPL v21 是 `platform-provisioned / customer-dedicated` 的 OPL SaaS 托管科研工作台。

用户购买平台打包好的套餐、计算能力、存储容量和运行环境。平台负责后台开通、隔离、计费、审计和释放；用户不自带云服务器、对象存储或容器集群，也不配置云资源。

当前 v21 产品主链：

```text
Portal -> OPL Web Gateway -> clean upstream OPL Web -> Portal OPL Adapter / Runtime Agent -> platform-provisioned compute/storage -> Billing/Audit
```

当前职责边界：

- Portal：SaaS 控制面。负责账号、充值、套餐、workspace 生命周期、运行环境开通、文件空间、账单、审计和管理员治理。
- OPL Web Gateway：同源工作台入口。负责把 clean upstream OPL Web 接入 Portal 身份、工作区、运行态和文件边界。
- Portal OPL Adapter / Runtime Agent：平台内部运行边界。负责会话绑定、消息/run 合同、运行状态、产物索引和 customer-dedicated 资源连接。
- Billing/Audit：平台账单与审计边界。负责费用投影、核对证据、释放证据和用户可解释账单。

`user_owned` 只能作为 legacy alias；当前产品语义必须是平台代开通、用户购买服务、后台隔离资源。upstream OPL 必须保持 clean，只能通过 Gateway、Adapter、Runtime Agent、API/CLI 等公开边界适配。

## 当前入口

- Portal 控制面：`services/portal`
- OPL Web Gateway：`services/opl-web-gateway`
- Portal OPL Adapter / Runtime Agent（当前代码目录仍为 `services/opl-runtime-bridge`）：`services/opl-runtime-bridge`
- v21 产品主计划：`docs/plan/2026-05-05-OPL-v21-User-Owned-Runtime-Refactor-Checklist.md`
- v21 产品逻辑校正：`docs/reports/2026-05-06-OPL-v21-Product-Logic-Reconciliation.md`
- v21 本地验收历史记录：`docs/reports/2026-05-06-OPL-v21-Phase2-9-Local-Acceptance-Report.md`
- v21 灰度推云计划：`docs/reports/2026-05-06-OPL-v21-Cloud-Rollout-Plan.md`

旧聊天壳代理、旧 MCP 产品入口和旧托管运行栈不再作为 v21 主路径。
`services/opl-runtime-bridge` 当前目录名保留，但产品语义视为 Portal 内部 adapter，不是产品主入口。

## 环境变量

`/.env.demo.template` 已补真实联调所需关键变量：

- `PORTAL_OPL_ADAPTER_URL`
- `PORTAL_OPL_ADAPTER_PUBLIC_URL`
- `PORTAL_OPL_ADAPTER_STATE_ROOT`
- `OPL_WEB_URL`
- `OPL_RUNTIME_MODE`
- `OPL_ACP_RUNTIME_DIR`
- `OPL_ACP_RUNTIME_COMMAND_JSON`
- `OPL_PRODUCT_API_URL`
- `OPL_PRODUCT_API_TOKEN`
- `MED_AUTOSCIENCE_RUNNER_URL`
- `MED_AUTOSCIENCE_RUNNER_TOKEN`
- `MED_AUTOSCIENCE_RUNNER_IMAGE`
- `K8S_NAMESPACE`

其中：

- `PORTAL_OPL_ADAPTER_URL` 是 Portal 到 OPL 的内部适配层地址
- `PORTAL_OPL_ADAPTER_PUBLIC_URL` 是 OPL Web 浏览器侧回调 adapter 的公开地址
- `PORTAL_OPL_ADAPTER_STATE_ROOT` 是 adapter 本地状态目录，空值时使用 `.runtime/portal-opl-adapter`
- `OPL_WEB_URL` 是 Portal 打开的 OPL Web 工作台地址；本地推荐指向 `opl-web-gateway`，由 gateway 同源转发真实 OPL Web 与 Portal adapter
- `OPL_WEB_GATEWAY_ENABLED=1` 时，`scripts/start-opl-web-runtime.mjs` 会在真实 OPL Web 前启动一个薄 gateway，用于注入 launch client 与 `/portal-adapter` 同源代理
- `OPL_RUNTIME_MODE=acp` 时，adapter 使用 one-person-lab 的 `opl session runtime --acp` stdio runtime
- `OPL_ACP_RUNTIME_DIR` 指向本地 one-person-lab/OPL runtime 仓库或 zip 解压目录；无源码时也可用 `OPL_ACP_RUNTIME_COMMAND_JSON` 显式指定命令
- 本地 fixture 联调时，`OPL_PRODUCT_API_URL` 指向 `http://opl-product-api-fixture:18910` 或 `http://127.0.0.1:18910`，仅用于 dev/test 合同验证
- 接真实 one-person-lab ACP runtime 时，不设置 `OPL_PRODUCT_API_URL`，设置 `OPL_RUNTIME_MODE=acp` 与 `OPL_ACP_RUNTIME_DIR=C:\path\to\one-person-lab`；`OPL_WEB_URL` 指向 OPL Web gateway 或真实 OPL Web/AionUI 工作台
- 真实 OPL workspace bind 需要 `OPL_DEFAULT_PROJECT_ID` 与 `OPL_DEFAULT_WORKSPACE_PATH`；当前医学科研默认 project 为 `medautoscience`
- 接真实 runner/K8s 时，设置 `MED_AUTOSCIENCE_RUNNER_IMAGE`、`MED_AUTOSCIENCE_RUNNER_TOKEN` 和实际的 `K8S_NAMESPACE`

Portal 控制面基础设施归属：

- `OpenCost` / 云账单 / 钱包流水：Portal 成本与账单控制面
- `MinIO/COS`：Portal workspace 输入输出文件归属
- `Harbor`：Portal 镜像与 runner 发布资产管理
- `Rancher/K8s`：Portal runtime 调度与异常查看
- `Langfuse`：Portal 可选 trace backend，不是主链路阻塞项

## 历史实现资产

以下旧实现资产只作为历史记录或内部迁移参考，不代表 v21 当前主产品叙事：

- med-autoscience runner：`adapters/med-autoscience-runner`
- OPL Product API fixture（仅 dev/test）：`scripts/fixtures/opl-product-api-fixture.mjs`
- 旧开发方案：`docs/plan/2026-04-25-Portal-OPL-Web-旧路径退场与双入口改造方案-v1.md`
- 旧推进日志：`docs/logs/2026-04-25-Portal-OPL-Web-旧路径退场推进日志-v1.md`
- 2026-04-24 旧联调文档仅作为历史记录保留，不再代表当前主链路。

## 本地 live 启动

Start real OPL Web/AionUI locally without Docker:

```powershell
$env:OPL_WEB_START_MODE="local"
$env:OPL_AION_SHELL_DIR=".runtime\opl-aion-shell-full"
$env:OPL_UPSTREAM_DIR=".runtime\one-person-lab-upstream"
$env:OPL_WEB_PORT="13030"
$env:OPL_WEB_GATEWAY_PORT="13031"
node scripts/start-opl-web-runtime.mjs
```

Reuse an already running OPL Web on the same port:

```powershell
$env:OPL_WEB_START_MODE="local"
$env:OPL_WEB_REUSE="1"
$env:OPL_WEB_BUILD_LOCAL="0"
$env:OPL_WEB_PORT="13030"
$env:OPL_WEB_GATEWAY_PORT="13031"
$env:OPL_AION_SHELL_DIR=".runtime\opl-aion-shell-full"
$env:OPL_UPSTREAM_DIR=".runtime\one-person-lab-upstream"
node scripts/start-opl-web-runtime.mjs
```

本地直接启动：

```powershell
node scripts/start-portal-live.mjs
```

默认会拉起：

- Portal
- Portal OPL adapter
- med-autoscience-runner
- OPL Product API fixture（仅 dev/test）

可选开关：

- `START_OPL_PRODUCT_API_FIXTURE=0`
  - 不启动 fixture；真实 ACP runtime 模式下保持 `OPL_PRODUCT_API_URL` 为空
- `OPL_PRODUCT_API_URL=http://127.0.0.1:8787`
  - 仅用于仍提供 HTTP Product API 的 dev/test 或兼容服务；ACP runtime 主链路不设置
- `OPL_RUNTIME_MODE=acp`
  - 让 Portal OPL adapter 使用 one-person-lab ACP stdio runtime
- `OPL_ACP_RUNTIME_DIR=C:\path\to\one-person-lab`
  - 指向本地 OPL runtime 仓库或 zip 解压目录
- `OPL_DEFAULT_WORKSPACE_PATH=C:\path\to\med-autoscience`
  - 让 adapter 调真实 OPL `/api/opl/workspaces/bind` 时传入 workspace_path
- `OPL_WEB_URL=http://127.0.0.1:13031`
  - 让 Portal 返回 OPL Web gateway URL；gateway 再转发到真实 OPL Web 并提供 `/portal-adapter` 同源代理

## Docker Compose 启动

```powershell
docker compose -f compose.demo.yaml up --build
```

当前 `compose.demo.yaml` 会启动：

- `gateway`
- `portal`
- `portal-opl-adapter`（代码目录仍为 `services/opl-runtime-bridge`）
- `med-autoscience-runner`
- `opl-product-api-fixture`（仅 dev/test）
- `billing-aggregator`

说明：

- 真实 OPL Web 不在本仓库内，默认通过外部 `OPL_WEB_URL` 接入。
- 本地真实 OPL Web 建议通过 `services/opl-web-gateway` 接入，避免 OPL Web CSP 阻止浏览器访问 Portal adapter。
- gateway 暴露 `/portal-adapter/` 同源转发 Portal OPL adapter，并拦截 `/api/auth/user` 将有效 launch cookie 映射为 Portal 用户；注入的 `window.__OPL_PORTAL__` 负责 bootstrap、run/status/artifacts，且会把 OPL Web 原生 MAS/MAG/RCA pill 点击映射到 `/api/opl-launch/runs`。`/opl/`、旧 `/workbench` 和旧 runtime session API 不再作为工作台入口。

## 本地验证

基础检查：

```powershell
npm --prefix services/opl-runtime-bridge run check
npm --prefix services/portal run check
node --check adapters/med-autoscience-runner/src/server.mjs
```

fixture/合同验证（仅 dev/test）：

```powershell
node scripts/smoke-test-med-autoscience-runner-api.mjs
node scripts/smoke-test-opl-acp-runtime-adapter.mjs
node scripts/smoke-test-portal-opl-adapter.mjs
node scripts/smoke-test-opl-product-api-adapter.mjs
node scripts/smoke-test-opl-launch-adapter.mjs
node scripts/smoke-test-portal-opl-web-launch.mjs
node scripts/smoke-test-portal-opl-web-hard-loop.mjs
```

真实 ACP runtime 验证：

```powershell
$env:OPL_RUNTIME_MODE="acp"
$env:OPL_ACP_RUNTIME_DIR="C:\path\to\one-person-lab"
$env:OPL_PRODUCT_API_URL=""
node scripts/smoke-test-opl-acp-runtime-adapter.mjs
```

OPL Web gateway launch 验证：
```powershell
node scripts/smoke-test-opl-web-gateway-launch.mjs
```

HTTP Product API 兼容验证（仅兼容服务或 fixture）：

```powershell
$env:RUN_OPL_REAL_SMOKE="1"
$env:OPL_PRODUCT_API_URL="http://127.0.0.1:8787"
node scripts/smoke-test-opl-real-web.mjs
```

如需同时验证 adapter launch 到真实 OPL workspace bind：

```powershell
$env:RUN_OPL_REAL_SMOKE="1"
$env:RUN_OPL_REAL_ADAPTER_SMOKE="1"
$env:OPL_PRODUCT_API_URL="http://127.0.0.1:8787"
$env:OPL_REAL_PROJECT_ID="medautoscience"
$env:OPL_REAL_WORKSPACE_PATH="C:\path\to\med-autoscience"
node scripts/smoke-test-opl-real-web.mjs
```

前端验证：

```powershell
npm --prefix services/portal run frontend:typecheck
npm --prefix services/portal run frontend:build
```

真实 K8s smoke：

```powershell
$env:RUN_K8S_SMOKE="1"
node scripts/smoke-test-portal-opl-adapter-real-runner-k8s.mjs
```

如果 K8s 集群、镜像或 `kubectl` 条件不足，K8s smoke 应明确 `skip`，这不代表通过。

## 成本状态说明

成本状态分两类：

- `pending`
  - 已提交 run，但 OpenCost/云账单尚未完成对账。
  - 这时不应把成本当成精确值。
- `exact`
  - 已完成对账，成本可以用于 Portal 账单和钱包流水。

生产路径中不应再使用 `contract-zero-cost` 代表真实成本。
