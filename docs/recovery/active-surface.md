# platform-v22 Active Surface

本文件定义 platform-v22 canonical trunk 的 active surface。它用于判断新开发、修复、契约和验证应该落在哪里，以及哪些路径只能迁移、归档、清理或在授权后触碰。

## Repository Authority

- `platform-v22` 是 canonical trunk。
- `recovery/platform-v22-trunk` 是 v22 recovery trunk；正式分支应从这里新开。
- `platform-v21` 是 legacy reference；只能作为历史参考或迁移输入，不能作为 v22 默认叙事来源。

## Active

以下路径是 v22 当前 active surface，可以承载新产品语义、契约、文档收敛和 v22 本地 smoke：

- `services/portal`
- `services/opl-web-gateway`
- `services/opl-runtime-bridge`
- `docs/product.md`
- `docs/architecture.md`
- `docs/contracts/v22-*`
- `docs/recovery/*`
- `scripts/smoke-test-v22-*`
- `scripts/v22-verify.mjs`

Active surface 的产品叙事必须保持 `platform-provisioned / customer-dedicated`：用户购买套餐、计算能力、存储容量和运行环境，平台负责开通、隔离、计费、审计和释放。

OPL Web 用户可见入口必须是 Portal “进入 OPL 工作台”或 /opl/entry/preflight。/internal/opl/auth/login 只能作为 internal implementation path。旧 v19/v20/v21 OPL direct path、direct upstream path、internal path 不能成为 v22 产品入口。后续真实 proxy / upstream 运行接入单独 feat；旧入口删除如需要另开 cleanup/*。

active surface 不允许修改 one-person-lab upstream。one-person-lab upstream 不属于 active surface；它只作为 clean upstream reference，通过 Gateway、Adapter、Runtime Agent、公开 API/CLI 或反向代理边界接入。

## Zero-Compat Active Surface Rule

在 strict monolith zero-compat cleanup 下，“兼容层”是任何让旧路线、旧字段、旧模块、旧部署形态、旧测试体系、旧叙事还能被调用、注册、接受、映射、解释、验证、部署或作为默认上下文存在的 active repo 资产。

不算兼容层的只有：

- git history。
- strict/retire/zero-compat gate 里的 forbidden-token 检查清单。
- 文档中明确写“已删除 / 不得恢复 / delete”的事实记录。
- 有明确 v22 active reason 且位于 Portal / Gateway / Runtime Bridge / v22 local gate 边界内的 monolith 主线代码。

Zero-compat 下，文件名是 `v22-*` 不自动等于 active。`live`、`canary`、`authorized-deploy`、`authorized-resource-lifecycle`、`real-live`、`live-runner`、`live-bridge` 和 `live-diagnostics` 可执行脚本不属于默认 active executable surface；未来真实外部操作只保留合同边界，重新授权时另建 v22 边界和执行入口。

`adapters/*`、`deploy/*` 和 `infra/*` 不属于 strict monolith 默认 active surface。仍有业务价值的能力必须迁入 `services/portal`、`services/opl-web-gateway`、`services/opl-runtime-bridge` 或 repo-local v22 gate 后，再删除旧路径；不得以 adapter/deploy/infra 形态作为 active repo 默认上下文保留。

## Migrate

`migrate` 表示资产仍有可复用价值，但它不能以旧路径、旧命名或旧叙事直接进入 v22 active surface。迁移必须满足：

- 重新落到 active surface 中的 v22 文件或 v22 contract。
- 去掉 `user_owned` primary path、`resource-order` primary path、旧 runner/provisioner、OpenCost 主叙事和 Langfuse 旧默认叙事。
- 不把 v19/v20/v21 的 smoke、live-test、部署脚本或报告当成 v22 默认验证入口。
- 不把 live/canary/authorized runner 当成默认 executable surface。
- 不把 `adapters/*`、`deploy/*`、`infra/*` 当成 active repo 默认上下文。
- 不移动目录，不删除文件；清理动作另走 `cleanup/*`。

## Archive / Reference

以下路径只作为 archive/reference，允许阅读和引用证据，不作为新实现入口。strict monolith cleanup 下旧脚本本体不再因为历史证据保留；git history 已足够保存 v19/v20/v21 脚本事实。

- `docs/plan/*`
- `docs/reports/*`
- `docs/releases/*`
- `docs/logs/*`
- `OPL-v20-商业化产品套餐开发方案.md`

旧 `scripts/smoke-test-v19-*`、`scripts/smoke-test-v20*`、`scripts/smoke-test-v21-*`、旧 v13 脚本、旧 check/daily/live-prepare、resource-provisioner/OpenCost 脚本、旧 portal resource-order/provisioner 脚本、旧 non-v22 billing/portal smoke、旧 runner fixture、旧 v19/v20 helper lib 和旧 live helper 已在 strict monolith cleanup 中删除；未来真实外部 canary 必须重新走单独授权合同，不得恢复旧 live-test 或旧版本 smoke 默认入口。

## Delete / Cleanup Target

以下内容是 v22 cleanup target。普通功能分支不得继续扩写；需要删除或拆除时，使用专门 `cleanup/*` 分支：

- `user_owned` primary path
- `resource-order` primary path
- `med-autoscience-runner`
- `resource-provisioner`
- OpenCost 主叙事
- Langfuse 旧默认叙事
- residual `adapters/billing-aggregator/**`
- residual `deploy/local/dockerfiles/**`
- residual live/canary/authorized runner executable scripts
- Runtime Bridge active code 中已清退的 `resourceOrderId`、`resource_order_id`、`user_owned`、`user-owned` 和 `USER_OWNED_*` alias；后续不得恢复为兼容字段、trace metadata 或 runtime mode

## Forbidden Without Explicit Authorization

以下路径和操作没有单独授权时禁止触碰：

- `deploy/*`
- `.sentrux/*`
- `adapters/*`
- one-person-lab upstream
- build/push/kubectl/live-test/真实云资源操作
