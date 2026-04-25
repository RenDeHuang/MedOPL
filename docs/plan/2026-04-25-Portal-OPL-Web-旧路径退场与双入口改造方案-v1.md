# Portal / OPL Web 旧路径退场与双入口改造方案 v1

日期：2026-04-25

## 1. 目的

把产品形态收敛为两个入口：

```text
Portal = SaaS 控制面 / 后台管理入口
OPL Web = 用户工作台入口
```

最终链路是：

```text
Portal -> OPL Web -> OPL runtime
```

Portal 不再自造工作台，不再通过旧 bridge runtime 主路直接发起工作台 run。Portal 只负责账号、workspace、session、配额、K8s/成本/存储/管理员视图，以及生成 OPL launch context。OPL Web 负责实际工作台体验，OPL runtime 负责执行。

## 2. 哪些是旧的

以下路径和变量属于旧逻辑：

- `GET /portal/workbench`
- `POST /portal/api/workbench/launch`
- adapter `GET /workbench`
- adapter `GET /api/workbench/bootstrap`
- adapter `POST /api/launch-tokens`
- adapter `POST /api/runtime-sessions`
- adapter `POST /api/runtime-sessions/:id/runs`
- `OPL_WORKBENCH_URL`
- `OPL_AION_SHELL_URL`
- response 字段 `workbenchUrl`

它们旧的原因是：

- 会让 Portal 或 adapter 看起来像工作台入口。
- 会让 adapter `/workbench` dev projection 被误认为真实 OPL Web。
- 会让 run 绕过 OPL Web 的 workspace/session 工作台体验。
- 会形成 `Portal -> adapter -> runner` 的旧主路，而不是 `Portal -> OPL Web -> OPL runtime`。

## 3. 新逻辑

只保留新的产品合同：

```text
Portal:
GET  /portal/opl
POST /portal/api/opl/launch

Portal OPL adapter:
POST /api/opl-launch/tokens
GET  /api/opl-launch/bootstrap?launch_token=...
POST /api/opl-launch/sessions/bind
POST /api/opl-launch/runs
GET  /api/opl-launch/runs/:runId/status
GET  /api/opl-launch/runs/:runId/artifacts
```

打开方式：

```text
Portal 生成 launch token
-> 返回 / 跳转 OPL_WEB_URL?launch_token=...&portal_adapter_url=...
-> OPL Web 拉 bootstrap
-> OPL Web 创建或恢复 oplSessionId
-> OPL Web 调 sessions/bind 回写 session
-> OPL Web / OPL runtime 执行
-> Portal 回收 run / artifact / trace / cost evidence
```

## 4. 账号 / Workspace / Session 合同

launch token 与 bootstrap 必须包含：

- `portalUserId`
- `portalUserEmail`
- `portalUserName`
- `workspaceId`
- `workspaceTitle`
- `workspacePath`
- `workspaceSessionId`
- `runtimeSessionId`
- `oplSessionId`
- `allowedAgents`
- `expiresAt`

OPL Web 启动后必须调用：

```text
POST /api/opl-launch/sessions/bind
```

用于把 OPL Web 自己创建或恢复的 `oplSessionId` 绑定回 Portal ID 链。

## 5. 安全方案

在线版不向用户发 OPL Web 独立用户名密码。Portal 是唯一用户认证入口，OPL Web 通过短期 launch token 建立工作台会话。

如果 OPL Web 当前仍需要 Basic Auth / 本地密码，线上应由 Gateway/Portal 侧保护 `OPL_WEB_URL`，浏览器不暴露 OPL upstream 密码。

## 6. 交付标准

- Portal 主入口是 `GET /portal/opl` 与 `POST /portal/api/opl/launch`。
- OPL Web URL 只来自 `OPL_WEB_URL`。
- 旧 workbench/runtime 路径不再成功。
- adapter 不再渲染工作台 projection。
- bootstrap 有完整 identity/workspace/session/callbacks。
- OPL Web 可以回写 `oplSessionId`。
- smoke 不再依赖旧 workbench/runtime 路径。
- 最终可说明：
  - Portal URL
  - OPL_WEB_URL
  - 已退场路径
  - 已打通 ID 链
  - 仍未完成的真实 OPL Web / K8s 外部环境验收

## 7. 七步开发顺序

### Step 1：入口收敛

目的：让 Portal 只做 SaaS 控制面，不再表现为工作台。

实现：
- Portal 新主入口固定为 `/portal/opl` 与 `/portal/api/opl/launch`。
- `/portal/workbench` 只做迁移重定向。
- `/portal/api/workbench/launch` 返回 `410 legacy_endpoint_retired`。

验收：
- Portal 页面按钮只指向 `/portal/opl`。
- API smoke 能证明旧 launch endpoint 已退场。

### Step 2：Adapter 合同收敛

目的：adapter 只做 Portal 与 OPL Web / OPL Product API 的内部合同层，不再渲染工作台。

实现：
- 新合同固定为 `/api/opl-launch/*`。
- `/workbench`、`/api/launch-tokens`、`/api/workbench/bootstrap`、`/api/runtime-sessions*` 全部返回 410。
- 运行态变量改为 `PORTAL_OPL_ADAPTER_PUBLIC_URL` 与 `PORTAL_OPL_ADAPTER_STATE_ROOT`。

验收：
- `scripts/smoke-test-opl-legacy-paths-retired.mjs` 必须通过。
- 搜索不到 `OPL_RUNTIME_BRIDGE_PUBLIC_URL` / `OPL_RUNTIME_BRIDGE_STATE_ROOT` 的运行时代码依赖。

### Step 3：OPL Web Launch Context

目的：Portal 不自造工作台，只把用户带到真实 OPL Web。

实现：
- `oplWebUrl` 只由 `OPL_WEB_URL` 生成。
- URL query 只保留 `launch_token`、`portal_adapter_url`、可选 `bootstrap_url`。
- 删除旧 `bridge_url` query，避免 OPL Web 继续依赖旧 bridge 命名。

验收：
- `oplWebUrl` 不指向 adapter `/workbench`。
- `oplWebUrl` 带 `portal_adapter_url`，不再带 `bridge_url`。

### Step 4：账号 / Workspace / Session 对齐

目的：Portal 管身份和 workspace，OPL Web 管工作台 session，二者通过 launch token 对齐。

实现：
- launch/bootstrap 带 `portalUserId`、`portalUserEmail`、`workspaceId`、`workspaceSessionId`、`runtimeSessionId`。
- OPL Web 调 `/api/opl-launch/sessions/bind` 回写 `oplSessionId`。

验收：
- Portal sessions 能看到 workspace session、runtime session、OPL session bind 结果。

### Step 5：Run / Artifact / Cost 回收

目的：执行仍由 OPL Web / OPL runtime 触发，Portal 只回收管理视图需要的结果。

实现：
- OPL Web 使用 bootstrap callbacks 发起 run/status/artifacts。
- Portal 从 Portal OPL adapter 拉 run、trace、cost records。
- 成本只能是 pending 或对账后的 exact，不允许 fake exact cost。

验收：
- `scripts/smoke-test-portal-opl-web-hard-loop.mjs` 能看到 run、artifact、trace、pending cost 回流。

### Step 6：Gateway / Compose / 文档退场

目的：部署入口也符合双入口，不让 `/opl/` 被误解成工作台。

实现：
- compose service 改为 `portal-opl-adapter`。
- gateway 只暴露 `/opl-adapter/` 给内部合同，不再把 `/opl/` 转到 adapter。
- README / runbook / checklist 改成 Portal OPL adapter 术语。

验收：
- `compose.demo.yaml` 中 Portal 默认访问 `http://portal-opl-adapter:8788`。
- `configs/gateway/nginx.conf` 不再有 `/opl/` -> adapter 的转发。

### Step 7：验证与未完成边界

目的：不把 fixture 说成真实收口。

实现：
- dev/test 使用 fixture smoke 验证合同。
- 真实 OPL Web 通过 `RUN_OPL_REAL_SMOKE=1` 验证。
- 真实 adapter bind 通过 `RUN_OPL_REAL_ADAPTER_SMOKE=1` 验证。
- K8s 通过 `RUN_K8S_SMOKE=1` 验证。

验收：
- fixture smoke 全绿。
- 真实 OPL Web / K8s 如果环境不可达，必须明确标为未完成和原因。

## 8. 本轮实际退场范围

已退场：
- 旧 Portal API：`/portal/api/workbench/launch`
- 旧 Portal 页面：`/portal/workbench`
- 旧 adapter 工作台投影：`/workbench`
- 旧 adapter bootstrap：`/api/workbench/bootstrap`
- 旧 adapter token API：`/api/launch-tokens`
- 旧 runtime session API：`/api/runtime-sessions*`
- 旧变量：`OPL_WORKBENCH_URL`、`OPL_AION_SHELL_URL`、`OPL_RUNTIME_BRIDGE_PUBLIC_URL`、`OPL_RUNTIME_BRIDGE_STATE_ROOT`
- 旧 URL 参数：`bridge_url`
- 旧 gateway 转发：`/opl/` -> adapter

保留但只作为墓碑：
- 旧 HTTP endpoint 的 410 分支。
- `scripts/smoke-test-opl-legacy-paths-retired.mjs` 中的旧路径断言。

未改名但需后续独立迁移：
- `services/opl-runtime-bridge` 目录名暂时保留为代码目录名。产品语义已收敛为 Portal OPL adapter；若要物理目录也改名，应单独做一次仓库级迁移，避免影响 package、compose、CI 和历史引用。
