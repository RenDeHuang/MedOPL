# platform-v22 Recovery Status Matrix

本矩阵记录 platform-v22 canonical trunk 的当前状态裁定。它用于决定哪些内容可以进入 v22，哪些内容只能参考、迁移、删除或归档。

## Trunk 状态

| 项目 | 当前状态 | v22 裁定 |
| --- | --- | --- |
| platform-v22 | 新 canonical trunk | 正式主线，所有新产品语义以此为准 |
| platform-v21 | legacy recovery/reference worktree | 仅按域参考，不整包搬迁 |
| `recovery/platform-v22-trunk` | v22 recovery trunk | 只接收已收敛的正式文档和正式变更 |
| `main` / `recovery/*` trunk | trunk 线 | 不接收半成品探索 |
| `spike/*` | 探索分支 | 可快、可脏、可丢，不直接合并 trunk |
| `feat/*` | 正式落地分支 | 从 v22 trunk 新开，干净实现一个产品意图 |
| `cleanup/*` | 清理分支 | pivot 后必须跟进，删除或归档被替代路径 |

## 产品域状态

| 核心域 | 正式入口 | 当前裁定 |
| --- | --- | --- |
| SaaS 控制面 | Portal | keep |
| OPL Web 浏览器入口 | OPL Web Gateway | keep |
| Upstream OPL | clean upstream OPL Web | keep |
| OPL 运行集成 | Portal OPL Adapter / Runtime Agent | keep |
| 计算、存储、运行环境 | platform-provisioned compute/storage/runtime | keep |
| 计费、审计、管理 | Billing/Audit/Admin | keep |
| `user_owned` | legacy alias only | archive alias，不作为产品主路径 |
| 旧 `med-autoscience-runner` | 无正式入口 | archive/reference，非 v22 主线 |
| 旧 `resource-provisioner` | 无正式入口 | archive/reference，非 v22 主线 |
| K8s Job 叙事 | 无正式入口 | archive/reference，非 v22 主线 |
| OpenCost 叙事 | 无正式入口 | archive/reference，非 v22 主线 |
| Langfuse 叙事 | 无正式入口 | archive/reference，非 v22 主线 |

## 资产裁定规则

| 裁定 | 含义 | 进入 v22 的条件 |
| --- | --- | --- |
| keep | 符合当前主线 | 可以重落或迁入 |
| migrate | 有价值但边界不对 | 改边界、命名、合同后通过 `feat/*` 进入 |
| delete | 属于被替代路线 | 通过 `cleanup/*` 删除 |
| archive | 只保留参考价值 | 不进入产品主线，不作为正式入口 |

## 合入检查

| 检查项 | 要求 |
| --- | --- |
| 产品叙事 | 必须是 `platform-provisioned / customer-dedicated` |
| 工作树关系 | v22 是 canonical trunk，v21 是 legacy recovery/reference |
| 分支来源 | 正式变更从 v22 trunk 开 `feat/*` |
| 探索隔离 | `spike/*` 不直接合并 trunk |
| pivot 清理 | 每次 pivot 必须带 cleanup/delete 计划 |
| 正式入口 | 一个核心域只能有一个正式入口 |
| upstream 边界 | one-person-lab upstream 保持 clean |
| 密钥边界 | raw provider key 只进入后端密钥边界 |
| 操作限制 | 未授权不运行 build/push、kubectl、live-test、真实云资源操作，不修改 `.sentrux/*` |
