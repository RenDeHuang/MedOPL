# Portal AionUI/OPL 硬闭环迁移日志 v1

## 2026-04-24

### Step 1：v1 文件夹迁移

结果：已完成。

迁移内容：
- Portal 控制面：`services/portal`
- OPL runtime bridge：`services/opl-runtime-bridge`
- 账本聚合：`adapters/billing-aggregator`
- 共享状态：`adapters/shared`
- med-autoscience runner 素材：`adapters/med-autoscience-runner`
- K8s/OpenCost/MinIO/生产加固素材：`infra/*`
- Portal/OpenCost/MinIO/billing/workspace lifecycle/OPL hard-loop 脚本：`scripts/*`

未作为主路径迁移：
- 旧聊天壳代理
- 旧 session bridge
- 旧聊天链路 smoke
- `.runtime`
- `node_modules`
- `dist`

### Step 2：Portal 工作台入口切到 OPL

结果：已完成第一轮代码切换。

变更：
- `/portal/workbench` 调用 `OPL_RUNTIME_BRIDGE_URL/api/launch-tokens`。
- 新增 `/portal/api/workbench/launch`，用于自动化测试和 AionUI/OPL 接入调试。
- 删除旧 `workspace-chat` 兼容入口与前端 dev proxy。
- demo compose 与 gateway 改为 Portal + OPL runtime bridge + billing。

### Step 3：OPL runtime bridge

结果：已完成第一轮合同服务。

能力：
- 生成 launch token。
- 暴露 workbench bootstrap。
- 建立 runtime session。
- 创建 med-autoscience contract run。
- 写入 artifact、trace、cost records。

### Step 4：测试

已执行：

- `npm --prefix services/opl-runtime-bridge run check`
- `npm --prefix services/portal run check`
- `node --check adapters/med-autoscience-runner/src/server.mjs`
- `node scripts/smoke-test-med-autoscience-runner-api.mjs`
- `node scripts/smoke-test-opl-runtime-bridge.mjs`
- `node scripts/smoke-test-portal-opl-hard-loop.mjs`
- `npm --prefix services/portal run frontend:typecheck`
- `npm --prefix services/portal run frontend:build`

结果：
- OPL runtime bridge 静态检查通过。
- Portal 静态检查通过。
- med-autoscience runner 静态检查通过。
- med-autoscience runner internal API smoke 通过，能创建 workspace 并查询文件清单。
- OPL runtime bridge smoke 通过，生成 launch/runtime session/run/artifact。
- Portal OPL hard-loop smoke 通过，Portal 生成 launch，bridge 完成 run，bootstrap 能看到 artifact，Portal session API 能看到 OPL workspace session。
- Portal 前端类型检查通过。
- Portal 前端构建通过。

本地运行依赖：
- `services/portal/node_modules`
- `services/portal/frontend/node_modules`
- `.runtime/tools/mc.exe`

这些均为本地运行依赖，已由 `.gitignore` 排除，不作为源码提交对象。

### 未完成项

- 真实 AionUI GUI 联调：需要本地 `opl-aion-shell` 或已部署 AionUI/OPL URL。
- 真实 K8s Job 提交：需要确认 runner image、集群上下文、命名空间与镜像拉取权限。
- OpenCost 精确回填：需要运行中集群和 label allocation 数据。
