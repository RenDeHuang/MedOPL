# OPL v9 镜像摘要

日期：2026-04-27

## 顶层原则

- 模块内高聚合：Portal/Gateway 入口文件拆成装配层，业务运行体和网关职责收回到各自模块。
- 模块间低耦合：Gateway 仍只通过 Portal internal auth / adapter bootstrap 绑定身份；Portal 不读取 Gateway 状态；Billing、Runner、Provisioner 边界不变。
- v9 只做结构化重构，不新增订单状态机，不改变账单、运行、登录语义。

## 镜像更新

- `uswccr.ccs.tencentyun.com/gaofenglab/portal-opl:opl-v9`
  - 更新：Portal `server.mjs` 变成启动聚合入口，原运行体迁入 `src/app/portal-app.mjs`。
  - 业务变化：无。
- `uswccr.ccs.tencentyun.com/gaofenglab/opl-web-gateway-opl:opl-v9`
  - 更新：Gateway 按配置、HTTP 工具、Portal 身份桥、HTML 注入、代理、launch 客户端脚本拆分。
  - 业务变化：无，保留 Portal 原生账号登录 OPL、launch token SSO、WebSocket proxy。
- `uswccr.ccs.tencentyun.com/gaofenglab/portal-opl-adapter-opl:opl-v9`
  - 更新：无源码变化，仅作为 v9 release set 重打版本。
- `uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl:opl-v9`
  - 更新：无源码变化，仅作为 v9 release set 重打版本。
- `uswccr.ccs.tencentyun.com/gaofenglab/resource-provisioner-opl:opl-v9`
  - 更新：无源码变化，仅作为 v9 release set 重打版本。
- `uswccr.ccs.tencentyun.com/gaofenglab/med-autoscience-runner-orchestrator-opl:opl-v9`
  - 更新：无源码变化，仅作为 v9 release set 重打版本。
- `opl-web-opl` 与 `med-autoscience-runner-opl`
  - 本版本不重建，继续使用当前稳定 tag。

## 推云前验证

- Gateway 模块 `node --check`。
- `smoke-test-opl-web-gateway-native-login.mjs`。
- `smoke-test-opl-web-gateway-launch.mjs`。
- Portal `node --check`。
- Portal smoke 与前端构建在合并后统一执行。
- Rendered manifest 不应包含平台镜像 `opl-v8`，且 `imagePullPolicy` 由 env 保持 `Always`。
