# platform-v22 Recovery Decisions

本文档记录 platform-v22 canonical trunk 的当前决策。除非后续通过新的明确决策替换，否则这些规则约束 v22 的文档、代码、测试和分支操作。

## D001: platform-v22 是新 canonical trunk

platform-v22 是 MedOPL OPL SaaS 的新 canonical trunk。正式产品语义、正式入口和正式工作流以 v22 为准。

## D002: platform-v21 是 legacy recovery/reference worktree

platform-v21 不再作为功能叠加主线。v21 只能作为 legacy recovery/reference worktree，用于按域查证、迁移判断和边界参考。v21 内容不能整包搬进 v22。

## D003: 产品主线是 platform-provisioned / customer-dedicated OPL SaaS

MedOPL 用户购买套餐、计算能力、存储容量和运行环境。平台负责开通、隔离、计费、审计和释放。`user_owned` 只能作为 legacy alias，不能被解释成用户自带云资源。

## D004: one-person-lab upstream 必须保持 clean

one-person-lab 是 clean upstream。v22 不修改 upstream 源码，不在 upstream 目录写 Portal、Gateway、Adapter 代码，不 import upstream 内部模块。集成只能走 Gateway、Adapter、Runtime Agent、API/CLI 等公开边界。

## D005: 主链路固定为 Portal 到平台资源治理

v22 主链路是：

```text
Portal -> OPL Web Gateway -> clean upstream OPL Web -> Portal OPL Adapter / Runtime Agent -> platform-provisioned compute/storage/runtime -> Billing/Audit/Admin
```

新文档、新代码和新测试必须围绕这条主链路组织。

## D006: spike 探索，feat 落地

想法不确定时开 `spike/*`。`spike/*` 可以快、可以脏、可以丢，但不能直接并入 trunk。

方向确定后，从 v22 trunk 新开 `feat/*` 干净重落。一个 `feat/*` 只能服务一个产品意图，即使它同时修改前端、后端、文档和测试。

## D007: main/recovery trunk 不接收半成品探索

`main` 和 `recovery/*` 这类 trunk 线只接收已经收敛的正式变更。半成品探索、并行入口、路线未定实现和脏实验必须留在 `spike/*`。

## D008: 每次 pivot 必须带 cleanup/delete 计划

路线替换不能只新增新路径。每次 pivot 必须写明旧入口、旧文档、旧测试、旧脚本或旧配置如何处理，并通过 `cleanup/*` 删除、迁移或归档被替代路径。

## D009: 一个核心域只能有一个正式入口

Portal、OPL Web Gateway、clean upstream OPL Web、Portal OPL Adapter / Runtime Agent、platform-provisioned compute/storage/runtime、Billing/Audit/Admin 各自承担唯一正式入口。并行入口只能用于探索，不能进入 v22 trunk。

## D010: 旧运行栈不是 v22 主产品叙事

旧 `med-autoscience-runner`、`resource-provisioner`、K8s Job、OpenCost、Langfuse 不作为 v22 主线。它们只能被裁定为 `keep`、`migrate`、`delete` 或 `archive` 后按域处理。

## D011: 未授权不执行真实资源操作

普通文档收敛、本地检查和代码重构不得运行 build/push、kubectl、live-test、真实云资源操作，也不得修改 `.sentrux/*`。这些动作必须单独授权。
