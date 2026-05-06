# platform-v22 Recovery Status Matrix

本矩阵记录 platform-v22 canonical trunk 的当前状态裁定。

## Trunk 状态

| 项目 | 当前状态 | v22 裁定 |
| --- | --- | --- |
| platform-v22 | canonical trunk | 正式主线，所有新产品语义以此为准 |
| `recovery/platform-v22-trunk` | v22 recovery trunk | 只接收已收敛的正式文档和正式变更 |
| `main` / `recovery/*` trunk | trunk 线 | 不接收半成品探索 |
| `spike/*` | 探索分支 | 可快、可脏、可丢，不直接合并 trunk |
| `feat/*` | 正式落地分支 | 从 v22 trunk 新开，干净实现一个产品意图 |
| `cleanup/*` | 清理分支 | pivot 后必须跟进，删除或归档被替代路径 |

## 产品域状态

| 核心域 | 正式入口/边界 | 当前裁定 |
| --- | --- | --- |
| 托管科研工作台 | Portal + OPL Web Gateway | keep，MedOPL 不是云资源控制台 |
| 小白科研用户体验 | Portal/OPL Web | keep，不要求用户理解 CVM/COS/K8s |
| 云资源控制台叙事 | 无正式入口 | delete，不进入 v22 主线 |
| Runtime | 租户可选开通能力 | keep，未开通不能跑托管 runtime 任务 |
| Compute/Storage | 平台 TKE/存储资源池 | keep，由平台管理并绑定租户 |
| 默认资源套餐 | 2c4gb+10GB、8c16gb+100GB | keep |
| 叠加计算/叠加存储/自定义套餐 | billing/quota/audit 边界 | keep，不能描述成用户自配云资源 |
| 资源绑定 | tenant/user/workspace/resource binding/billing account/audit tag / cost allocation tag | keep，所有资源必须绑定 |
| API token 业务 | `https://gflabtoken.cn/v1` | keep，商业目标之一是销售 token/API 使用额度 |
| API key 密钥边界 | 后端密钥边界 | keep，前端只保留一次性输入态、`providerKeyRef`、bound status |
| OPL Web | clean upstream OPL Web | keep |
| upstream 更新 | pull + Gateway/Adapter/Runtime Agent/API/CLI 适配 | keep，不修改 upstream 源码 |
| Billing freeze | 7 天冻结保护 | keep，余额不足提示消耗冻结金额，释放后停止扣费 |
| Trace metadata | Portal 元数据边界 | keep，仅用于轨迹、审计、排障 |
| Langfuse | 后续 trace metadata 来源 | archive/reference，不是当前主产品叙事 |
| `user_owned` | legacy alias only | archive alias，不作为产品主路径 |
| 旧 `med-autoscience-runner` | 无正式入口 | archive/reference，非 v22 主线 |
| 旧 `resource-provisioner` | 无正式入口 | archive/reference，非 v22 主线 |
| K8s Job 主叙事 | 无正式入口 | archive/reference，非 v22 主线 |
| OpenCost 主叙事 | 无正式入口 | archive/reference，非 v22 主线 |

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
| 产品叙事 | MedOPL 是托管 OPL 科研工作台，不是云资源控制台 |
| Runtime gate | runtime 是租户可选能力，未开通不能跑托管 runtime 任务 |
| 资源池 | 平台 TKE/存储资源池由平台管理，用户不直接配置云资源 |
| 资源套餐 | 明确 2c4gb+10GB、8c16gb+100GB、叠加和自定义能力 |
| 资源绑定 | runtime/compute/storage 绑定 tenant/user/workspace/resource binding/billing account/audit tag / cost allocation tag |
| Token provider | 明确 `https://gflabtoken.cn/v1` 和 API key 后端密钥边界 |
| Upstream | one-person-lab upstream clean，不修改源码 |
| Billing freeze | 明确 7 天冻结保护、余额不足提示、释放后停止扣费 |
| Trace | Langfuse 只作为后续 trace metadata 来源，不是当前主产品叙事 |
| 探索隔离 | `spike/*` 不直接合并 trunk |
| 操作限制 | 未授权不运行 build/push、kubectl、live-test、真实云资源操作，不修改 `.sentrux/*` |
