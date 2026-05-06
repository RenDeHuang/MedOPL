# platform-v22 Architecture Truth

platform-v22 的架构真相是以 Portal 为 SaaS 控制面，以 Gateway、Adapter、Runtime Agent 和公开 API/CLI 连接 clean upstream OPL。架构目标不是复制旧仓，也不是重写 upstream，而是建立 MedOPL OPL SaaS 的 canonical trunk。

## 主链路

```text
Portal
  -> OPL Web Gateway
  -> clean upstream OPL Web
  -> Portal OPL Adapter / Runtime Agent
  -> platform-provisioned compute/storage/runtime
  -> Billing/Audit/Admin
```

## 边界职责

### Portal

Portal 是平台控制面，是用户购买、workspace 生命周期、资源开通、文件空间、账单、审计和管理员治理的正式入口。

### OPL Web Gateway

OPL Web Gateway 是 upstream OPL Web 进入 MedOPL SaaS 的正式浏览器入口。它负责平台身份、workspace 上下文、运行态启动和 adapter 接入，不把 Portal 逻辑写进 upstream。

### clean upstream OPL Web

one-person-lab upstream OPL Web 必须保持 clean。v22 不修改 upstream 源码，不在 upstream 目录写 Portal/Gateway/Adapter 代码，不 import upstream 内部模块。所有集成都通过 Gateway、Adapter、Runtime Agent、API/CLI 等公开边界完成。

### Portal OPL Adapter / Runtime Agent

Portal OPL Adapter / Runtime Agent 是平台运行边界。它连接 Portal 会话、OPL run 合同、运行状态、产物索引和 platform-provisioned compute/storage/runtime。

### platform-provisioned compute/storage/runtime

计算、存储和运行环境由平台开通并隔离给 customer-dedicated workspace。用户购买服务能力，不自带 CVM、COS、K8s 或云账号作为主链路。

### Billing/Audit/Admin

Billing/Audit/Admin 是平台治理边界。它负责套餐、账单解释、费用核对、审计证据、释放证据和管理员操作。

## 单入口规则

一个核心域只能有一个正式入口：

- SaaS 控制面：Portal。
- OPL Web 浏览器入口：OPL Web Gateway。
- Upstream OPL：clean upstream OPL Web 公开边界。
- OPL 运行集成：Portal OPL Adapter / Runtime Agent。
- 资源能力：platform-provisioned compute/storage/runtime。
- 治理能力：Billing/Audit/Admin。

任何第二入口、新旧双入口或并行主路径只能存在于 `spike/*`，不能进入 v22 trunk。进入 `feat/*` 前必须收敛为一个正式入口。

## 安全边界

- raw provider API key 只能进入后端密钥边界。
- 前端最多持有 `providerKeyRef`、bound status 和一次性输入态。
- 前端不能把 raw key、bearer token、launchToken 或 runtimeToken 写入 sessionStorage、localStorage、全局 JS state、日志、evidence 或 git。

## 操作边界

未获单独授权时，不运行 build/push、kubectl、live-test、真实云资源操作，也不修改 `.sentrux/*`。普通文档收敛和本地验证不能顺手触发真实资源动作。
