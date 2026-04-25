# 2026-04-25 Portal / OPL Web 旧路径退场推进日志 v1

## 本轮目标

按双入口方案收缩旧路径：

- Portal 是后台管理和 SaaS 控制面入口。
- OPL Web 是用户工作台入口。
- adapter 只做 Portal 与 OPL Web / OPL Product API 的集成合同，不再提供工作台 projection，也不再作为 runtime 主路。

## 已退场的旧路径

- `POST /portal/api/workbench/launch`
  - 现在返回 `410 legacy_endpoint_retired`
  - 替代路径：`POST /portal/api/opl/launch`
- adapter `GET /workbench`
  - 现在返回 `410 legacy_endpoint_retired`
  - 替代路径：打开 `OPL_WEB_URL`
- adapter `POST /api/launch-tokens`
  - 现在返回 `410 legacy_endpoint_retired`
  - 替代路径：`POST /api/opl-launch/tokens`
- adapter `GET /api/workbench/bootstrap`
  - 现在返回 `410 legacy_endpoint_retired`
  - 替代路径：`GET /api/opl-launch/bootstrap`
- adapter `POST /api/runtime-sessions`
  - 现在返回 `410 legacy_endpoint_retired`
  - 替代路径：`POST /api/opl-launch/sessions/bind`
- adapter `POST /api/runtime-sessions/:id/runs`
  - 现在返回 `410 legacy_endpoint_retired`
  - 替代路径：`POST /api/opl-launch/runs`

## 新主路

```text
Portal /portal/opl
-> POST /portal/api/opl/launch
-> adapter POST /api/opl-launch/tokens
-> OPL_WEB_URL?launch_token=...&portal_adapter_url=...
-> OPL Web GET /api/opl-launch/bootstrap
-> OPL Web POST /api/opl-launch/sessions/bind
-> OPL Web POST /api/opl-launch/runs
-> Portal 回收 run / artifact / trace / pending cost
```

## 本轮新增收缩

- 删除 OPL Web URL 里的旧 `bridge_url` 参数，只保留 `portal_adapter_url`。
- 运行态 public/state 变量改为：
  - `PORTAL_OPL_ADAPTER_PUBLIC_URL`
  - `PORTAL_OPL_ADAPTER_STATE_ROOT`
- compose service 名收缩为 `portal-opl-adapter`。
- gateway 删除 `/opl/` 到 adapter 的转发，只保留 `/opl-adapter/`。
- 当前 smoke 文件名收缩为：
  - `scripts/smoke-test-portal-opl-adapter.mjs`
  - `scripts/smoke-test-opl-product-api-adapter.mjs`
  - `scripts/smoke-test-portal-opl-adapter-real-runner-k8s.mjs`

## 账号 / workspace / session 打通

launch / bootstrap / run 链路已携带：

- `portalUserId`
- `portalUserEmail`
- `portalUserName`
- `workspaceId`
- `workspaceTitle`
- `workspacePath`
- `workspaceSessionId`
- `runtimeSessionId`
- `oplSessionId`
- `runId`

`POST /api/opl-launch/sessions/bind` 已用于 OPL Web 回写 `oplSessionId`。

## 验证

- `npm --prefix services/portal run check`
- `npm --prefix services/opl-runtime-bridge run check`
- `npm --prefix services/portal run frontend:typecheck`
- `node scripts/smoke-test-opl-launch-adapter.mjs`
- `node scripts/smoke-test-opl-legacy-paths-retired.mjs`
- `node scripts/smoke-test-portal-opl-web-launch.mjs`
- `node scripts/smoke-test-portal-opl-web-hard-loop.mjs`
- `node scripts/smoke-test-portal-opl-adapter.mjs`
- `node scripts/smoke-test-opl-product-api-adapter.mjs`

## 未完成

- 真实 OPL Web 实机验收仍未完成：本机 `http://127.0.0.1:8787/api/health` 当前不可达。
- 非 fixture 最终硬闭环仍未完成：需要真实 `OPL_WEB_URL` / `OPL_PRODUCT_API_URL` 和真实 K8s 环境。
