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
  - TKE rendered manifest 继续使用当前稳定 tag。
  - 推送脚本仍产出了 `med-autoscience-runner-opl:opl-v9` release tag，作为版本归档；当前 rendered manifest 不切换到该 tag。

## 已推送 digest

- `portal-opl:opl-v9` -> `sha256:0ad62716d28beee4384a3740915e5bfae0208c057596506fd3194d44b9a15316`
- `portal-opl-adapter-opl:opl-v9` -> `sha256:7211ea2b828be9625c7262592ba21fec8273a3dff2823d429c81ba0c57245941`
- `opl-web-gateway-opl:opl-v9` -> `sha256:02082fe79e1d26b14daeefd89e9b03bd50bc93980631043f801784cdfc49cf5f`
- `billing-aggregator-opl:opl-v9` -> `sha256:cad543b75637daefe84bba603308429de0ed8bd6c5ce654877fc03c9521985b9`
- `resource-provisioner-opl:opl-v9` -> `sha256:a81e1b591c94a41598d40782e889ca135da466dd79f8367caa456bacd20b70d2`
- `med-autoscience-runner-orchestrator-opl:opl-v9` -> `sha256:0b2ba53da906183c815f20c82f89e9f86f197a85217224f79e21aa92a86f33aa`
- `med-autoscience-runner-opl:opl-v9` -> `sha256:04032779eba68d9a1e8caff93e241c07d9384230d33142d069c268d5f1085810`

## 推云前验证

- Gateway 模块 `node --check`。
- `smoke-test-opl-web-gateway-native-login.mjs`。
- `smoke-test-opl-web-gateway-launch.mjs`。
- Portal `node --check`。
- Portal smoke 与前端构建在合并后统一执行。
- Rendered manifest 不应包含平台镜像 `opl-v8`，且 `imagePullPolicy` 由 env 保持 `Always`。
