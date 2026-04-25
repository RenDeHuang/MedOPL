# Portal 接入 OPL Web/ACP Runtime AI 开发文档 v1

## 为什么做

最终产品形态是：

```text
Portal SaaS 控制面 -> OPL Web 工作台 -> OPL ACP runtime -> domain runner/K8s -> Portal 账单/trace/产物
```

Portal 不应该变成一个巨大的 `server.mjs`。Portal 的职责是 SaaS 后端和控制面；OPL Web 的职责是工作台；OPL ACP runtime 的职责是运行时；runner/K8s 的职责是分发执行；billing/trace/storage/registry 是可替换模块。

本次目标不是再做一个 Portal 内置工作台，而是把 Portal 正确接入 OPL。判断标准是：任意一段挂掉时，5 分钟内可以定位是登录、launch、Web gateway、ACP runtime、runner、billing、K8s 还是对象存储/镜像分发的问题。

## 本轮落地状态

- Portal 本地入口：`scripts/start-portal-live.mjs` 默认关闭 OIDC，显式 `PORTAL_OIDC_ENABLED=1` 仍可切回统一身份；`scripts/smoke-test-portal-local-login.mjs` 覆盖本地管理员登录、`portal_session`、进入 `/portal/app/overview`。
- OPL Web Gateway SSO：`services/opl-web-gateway/src/server.mjs` 在 `launch_token` 进入时设置 HTTP-only launch cookie，拦截 `/api/auth/user` 并通过 adapter bootstrap 映射 Portal 用户；无 launch cookie 时继续代理 OPL upstream，不伪造用户。
- OPL Web run 回流：gateway 注入 `window.__OPL_PORTAL__`，提供 `refreshBootstrap()`、`startRun()`、`getRunStatus()`、`getArtifacts()`；同时安装 OPL 原生 MAS/MAG/RCA pill 点击桥，识别 `data-testid="opl-module-pill-{mas|mag|rca}"` 后自动调用 `/api/opl-launch/runs`。当前由 smoke 覆盖合同。
- 旧路径退场：demo env、Compose gateway、nginx gateway 统一使用 `/portal-adapter`；旧 `/workbench`、`/api/workbench/*`、`/api/runtime-sessions*`、`/api/launch-tokens` 保持 410 retired，不再作为主路径。

## 模块识别

### 1. Portal Auth 模块

位置：
- `services/portal/src/server.mjs`

管理内容：
- Portal 登录、注册、OIDC callback、本地 dev login、`portal_session`
- 用户、钱包、分组策略
- Portal 侧 SaaS 身份源

不管理：
- OPL Web 自己的账号注册
- OPL runtime session 内部状态

### 2. Portal OPL Launch 模块

位置：
- `services/portal/src/services/opl-launch.service.mjs`
- `services/portal/src/routes/opl.routes.mjs`
- `services/portal/src/integrations/opl-adapter-client.mjs`

管理内容：
- 用户是否允许启动 OPL
- workspace/taskSpace 创建与选择
- workspaceSession 创建
- 调用 adapter 签发 OPL launch token

不管理：
- OPL Web 页面渲染
- runner/K8s 具体执行

### 3. OPL Web Gateway 模块

位置：
- `services/opl-web-gateway/src/server.mjs`

管理内容：
- 真实 OPL Web 的同源入口
- 注入 Portal launch client
- `/portal-adapter/*` 同源代理到 Portal OPL adapter
- Portal launch token 换 OPL Web 当前用户会话
- 避免 OPL Web CSP 阻止浏览器访问 Portal adapter

不管理：
- Portal 用户数据库
- OPL ACP runtime
- K8s 分发

### 4. Portal OPL Adapter 模块

位置：
- `services/opl-runtime-bridge/src/server.mjs`
- `services/opl-runtime-bridge/src/opl-acp-runtime-client.mjs`
- `services/opl-runtime-bridge/src/opl-client.mjs`
- `services/opl-runtime-bridge/src/runner-client.mjs`
- `services/opl-runtime-bridge/src/state-store.mjs`

管理内容：
- launch token 签发和校验
- bootstrap 输出
- session bind
- run/status/artifacts 回调
- trace/cost pending 记录
- ACP runtime bootstrap
- runner submit/status/artifacts

不管理：
- Portal 登录页面
- OPL Web UI 交互细节

### 5. OPL Web Run Adapter 模块

位置：
- 先由 `services/opl-web-gateway/src/server.mjs` 暴露最小浏览器 client
- 后续可上游合入 OPL Web 源码

管理内容：
- OPL Web 用户点击 MAS/MAG/RCA 时，调用 `/portal-adapter/api/opl-launch/runs`
- 轮询 `/status`
- 拉取 `/artifacts`
- 将 run/trace/cost 状态显示给工作台

### 6. Billing 模块

位置：
- `services/portal/src/integrations/billing-client.mjs`
- `services/opl-runtime-bridge/src/server.mjs`
- OpenCost/云账单服务

管理内容：
- `pending` 成本：run 已提交，真实成本未对账
- `exact` 成本：OpenCost/云账单按 labels 对账后写回
- 钱包流水和账单

### 7. K8s Distribution 模块

位置：
- `adapters/med-autoscience-runner/src/server.mjs`
- `infra/kubernetes/job-template.yaml`

管理内容：
- K8s Job manifest
- namespace、image、imagePullSecret
- run/workspace/customer labels
- runner 输出 artifacts

## 怎么做

### Phase 1：修正 Portal 本地可进入

根因：本地 live 默认启用 OIDC，`POST /login` 被重定向到 `/auth/oidc/login`。如果 Zitadel callback、证书、端口或浏览器信任链不匹配，用户会感知为 Portal 进不去。

做法：
- `scripts/start-portal-live.mjs` 本地默认 `PORTAL_OIDC_ENABLED=0`
- 生产/真实 SSO 由显式环境变量开启
- smoke 覆盖本地登录后进入 `/portal`

交付标准：
- `http://127.0.0.1:17180/login` 可用本地管理员账号登录
- 登录后有 `portal_session`
- `/portal` 返回 200
- 显式 `PORTAL_OIDC_ENABLED=1` 时仍走 OIDC

### Phase 2：完成 Portal -> OPL Web SSO

根因：当前 OPL Web upstream 是 no-auth admin；Portal 用户身份没有真正进入 OPL Web 当前用户。

做法：
- gateway 在 URL 带 `launch_token` 时设置 HTTP-only launch cookie
- gateway 拦截 `/api/auth/user`
- gateway 用 launch token 调 adapter bootstrap 校验
- 返回 Portal 用户作为 OPL Web 当前用户
- OPL Web 无需注册账号

交付标准：
- Portal 登录用户打开 OPL Web 后，`GET /api/auth/user` 返回 Portal 用户，而不是 `opl-webui-noauth/admin`
- 没有 launch token 时 gateway 不伪造 Portal 用户
- OPL Web 不需要独立注册

### Phase 3：完成 OPL Web run 回流入口

做法：
- gateway 注入的 launch client 暴露 `window.__OPL_PORTAL__.startRun/getRunStatus/getArtifacts`
- OPL Web 原生 UI 还没上游改造前，由 gateway 注入层安装点击桥，把 MAS/MAG/RCA pill 点击映射到 `startRun`
- 后续如果上游 OPL Web 源码接受改造，可把该桥下沉为原生调用 `window.__OPL_PORTAL__.startRun`

交付标准：
- launch client 可 start run
- OPL Web MAS/MAG/RCA pill 点击可自动 start run
- adapter 记录 run/action/trace/cost pending
- runner fixture 返回 succeeded
- Portal `/portal/api/runs`、`/portal/api/traces`、`/portal/api/costs/run` 可见

### Phase 4：Billing/K8s 外部条件闭环

做法：
- 保持 adapter cost 为 `pending`
- K8s labels 必须包含 customer/workspace/session/run/billing scope
- OpenCost exact 对账单独写回

交付标准：
- 无真实 OpenCost 时不显示假 exact 成本
- K8s smoke 在条件不足时明确 skip
- 条件齐全时 K8s Job 能提交并按 labels 回查

## 最终验收

必须全部通过：

```powershell
npm --prefix services/portal run check
npm --prefix services/opl-runtime-bridge run check
node --check services/opl-web-gateway/src/server.mjs
node scripts/smoke-test-portal-local-login.mjs
node scripts/smoke-test-opl-web-gateway-launch.mjs
node scripts/smoke-test-opl-acp-runtime-adapter.mjs
node scripts/smoke-test-portal-opl-web-hard-loop.mjs
node scripts/smoke-test-opl-legacy-paths-retired.mjs
git diff --check
```

人工可见验收：
- Portal：`http://127.0.0.1:17180`
- OPL Web gateway：`http://127.0.0.1:13031`
- Portal 登录后点 OPL，进入 OPL Web
- OPL Web `/api/auth/user` 显示 Portal 用户
- OPL Web launch bootstrap 来源是 `opl_acp_runtime`

## 不做什么

- 不恢复旧 `/portal/workbench`
- 不把 OPL Web 塞进 Portal `server.mjs`
- 不用假成本冒充真实 exact 成本
- 不在 OPL Web 单独注册 SaaS 用户
- 不把 MinIO/Harbor/OpenCost/Langfuse 写死进 launch 主链路
