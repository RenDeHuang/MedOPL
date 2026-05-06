# platform-v22 Product Truth

platform-v22 是 MedOPL OPL SaaS 的新 canonical trunk。platform-v21 是 legacy recovery/reference worktree，只作为按域参考、取证和迁移判断来源。

## 产品定义

MedOPL 是 `platform-provisioned / customer-dedicated` 的 OPL SaaS 科研工作台。

用户购买平台提供的套餐、计算能力、存储容量和运行环境。平台负责资源开通、客户专属隔离、计费、审计、释放和管理员治理。用户不自带云服务器、对象存储或容器集群，也不配置云资源作为主产品路径。

## 当前主链路

```text
Portal
  -> OPL Web Gateway
  -> clean upstream OPL Web
  -> Portal OPL Adapter / Runtime Agent
  -> platform-provisioned compute/storage/runtime
  -> Billing/Audit/Admin
```

## 正式产品边界

- Portal 是 SaaS 控制面，负责账号、套餐、订单、workspace 生命周期、资源开通、文件空间、账单、审计和管理员治理。
- OPL Web Gateway 是 OPL Web 的平台入口，负责身份、workspace、运行态和 adapter 边界接入。
- one-person-lab 是 clean upstream，不修改源码，不承载 Portal、Gateway、Adapter 或平台计费逻辑。
- Portal OPL Adapter / Runtime Agent 是平台运行边界，负责会话绑定、run 合同、状态、产物索引和平台资源连接。
- Billing/Audit/Admin 是平台治理边界，负责费用解释、审计证据、释放证据和管理员操作。

## 非主线内容

- `user_owned` 只能作为 legacy alias，不能在新代码、新文档、新测试和默认产品叙事中解释成用户自带云资源。
- 旧 `med-autoscience-runner`、`resource-provisioner`、K8s Job、OpenCost、Langfuse 不是 platform-v22 主线。
- 这些旧资产只能作为历史资产、内部迁移参考，或在单独授权下作为旧栈审查对象。

## 产品落地原则

- 一个核心域只能有一个正式入口。
- spike 只能探索，不能进入 trunk。
- feat 必须从 v22 trunk 干净落地，一个 feat 只服务一个产品意图。
- 每次 pivot 必须带 cleanup/delete 计划。
- main/recovery trunk 不接收半成品探索。
