# v22 Smoke / Eval Boundary

本合同定义 MedOPL v22 的 smoke / eval 分层语义。它不新增产品能力，不接云，不读取 secret，不授权 build/push/deploy/kubectl/live-test，只收敛本地验证入口和命名真相。

所有 suite 默认不得读取 secret，不得调用真实云，不得 build/push/deploy/kubectl/live-test。真实云、secret、部署、kubectl、live-test 或真实外部 canary 只能在单独授权合同和 step-local authorization 下执行。

## 主线定义

Smoke 只代表极小关键路径，不等于所有 v22 eval。v22 仓库里所有 `tests/**/*.mjs` 都是 repo-local eval gate 文件；只有 `health-check` 和 `smoke-golden` 两层可以被称为 smoke。

当前 `tests/**/*.mjs` 文件名暂不机械重命名，避免制造无业务价值的大 diff。语义权威来自 `scripts/v22-test-classification.mjs` 里的 `tier + surface + entryKind + authorization + contractRefs` 元数据和 `scripts/v22-verify.mjs` suite 入口。

## Tier

| Tier | 语义 | 默认策略 |
| --- | --- | --- |
| `health-check` | 极小仓库控制面与零兼容生命体征。用于快速确认当前分支没有破坏 gate 体系本身。 | 可以默认跑，数量必须很小。 |
| `smoke-golden` | 小型关键用户路径。覆盖托管 OPL SaaS 最核心 loop，但不做全量回归。 | 可以作为 PR/B review 阻断信号，数量必须受限。 |
| `contract-local` | 合同、DTO、禁词、状态矩阵、workflow、manifest 和边界断言。 | 本地确定性 gate，不等于 smoke。 |
| `local-regression` | Portal / OPL / Runtime Bridge 本地闭环和更宽功能回归。 | 可默认进入 local deterministic regression，但不叫 smoke。 |
| `future-authorized` | Cloud / live / deploy / canary / Package D / Tencent 等后续授权验证。 | 默认不跑；需要 step-local authorization。 |
| `retired` | 已退役或历史入口。 | 必须为 0。 |

## Surface

| Surface | 范围 |
| --- | --- |
| `control-plane` | 合同、workflow、verify runner、分类、zero-compat、repo zoning、goal state。 |
| `portal` | Portal 普通用户和管理员本地 UI/API/domain eval。 |
| `opl` | OPL Gateway、Portal-OPL connection、OPL work/message/file/run 本地 eval。 |
| `runtime-bridge` | Runtime Bridge / Runtime Agent / run-file-providerKeyRef 本地 eval。 |
| `cloud` | Tencent/cloud/live/deploy/future-authorized 边界 eval。 |
| `archive` | 历史退役入口；active repo 中不应存在 retired eval。 |

## Entry Kind

| Entry kind | 语义 |
| --- | --- |
| `atomic` | 单个可执行 eval gate。它可以属于 health、golden、contract-local、local-regression 或 future-authorized。 |
| `suite-wrapper` | suite 聚合入口，例如 golden smoke suite 或 legacy MVP/local-regression wrapper；它不应被当作业务 eval 数量本身。 |
| `gate-self-test` | gate/runner 自检壳，用于验证 gate 体系本身，不代表业务功能闭环。 |

## Authorization

| Authorization | 语义 |
| --- | --- |
| `none` | 本地 deterministic eval，不授权 secret、真实云、deploy、kubectl、live-test 或真实外部 canary。 |
| `future-authorized` | 仅代表未来授权 lane 的本地边界可见性；默认 suite 不执行真实云、secret、deploy、kubectl、live-test。 |

## Golden Smoke 收录条件

`smoke-golden` 只能包含：

- MedOPL 托管 OPL SaaS 的关键用户路径。
- 本地 deterministic 命令。
- 无 secret 读取。
- 无真实云调用。
- 无 build/push/deploy/kubectl/live-test。
- 失败可以阻断 B 吸收。
- 能用少量脚本证明主链路仍然可解释：账号/余额、套餐/资源计划、托管环境、Portal-OPL connection、Runtime Bridge session/run/file/providerKeyRef、文件/账单/trace、释放停止计费。

`smoke-golden` 不得包含：

- Cloud / Tencent / live / deploy / Package D / canary runner。
- 大范围 Portal UI 回归。
- 大范围 OPL / Runtime Bridge 回归。
- 历史清退证明。
- 纯文档扫描集合。
- flaky、依赖外部状态、需要 secret 或真实资源的命令。

## Suite 入口

| Suite | 命令 | 语义 |
| --- | --- | --- |
| health | `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk` | 最小仓库控制面生命体征。 |
| smoke | `node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk` | 小型 golden smoke。 |
| local-contract | `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk` | 合同和控制面本地 gate。 |
| local-regression | `node scripts/v22-verify.mjs suite local-regression --base origin/recovery/platform-v22-trunk` | Portal / OPL / Runtime Bridge 本地 deterministic 回归。 |
| cloud-future-authorized | `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk` | 只做分类可见性，不授权执行真实云。 |
| mvp | `node scripts/v22-verify.mjs suite mvp --base origin/recovery/platform-v22-trunk` | 旧兼容入口，语义收敛为 local deterministic regression，不再称为纯 smoke。 |

## 门禁

- 新增 `tests/**/*.mjs` 必须有 category、tier、surface、entryKind、authorization、contractRefs。
- `health-check` 数量必须不超过 `HEALTH_CHECK_MAX`。
- `smoke-golden` 数量必须在 `SMOKE_GOLDEN_MIN` 和 `SMOKE_GOLDEN_MAX` 之间。
- `future-authorized` 不得进入默认 local deterministic suite。
- `future-authorized` 必须显式标记 authorization，不能只靠文件名里的 local/readonly/dry-run 推断授权状态。
- `suite-wrapper` 和 `gate-self-test` 必须显式列出，不能混入 atomic 业务 eval 统计。
- `retired` 必须为空。
- `smoke-golden` 和 `health-check` 不得包含 cloud/tencent/authorized/deploy/package-d/live/canary 语义。

## 非目标

- 不重命名全部 `tests/**/*.mjs` 文件。
- 不删除 active Portal / OPL / Runtime Bridge 本地 eval。
- 不接真实云。
- 不读取 secret、`.env`、kubeconfig、token 或 SSH key。
- 不执行 build/push/deploy/kubectl/live-test。
- 不修改 one-person-lab upstream。
