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

Active surface 的产品叙事必须保持 `platform-provisioned / customer-dedicated`：用户购买套餐、计算能力、存储容量和运行环境，平台负责开通、隔离、计费、审计和释放。

OPL Web 用户可见入口必须是 Portal “进入 OPL 工作台”或 /opl/entry/preflight。/internal/opl/auth/login 只能作为 internal implementation path。旧 v19/v20/v21 OPL direct path、direct upstream path、internal path 不能成为 v22 产品入口。后续真实 proxy / upstream 运行接入单独 feat；旧入口删除如需要另开 cleanup/*。

active surface 不允许修改 one-person-lab upstream。one-person-lab upstream 不属于 active surface；它只作为 clean upstream reference，通过 Gateway、Adapter、Runtime Agent、公开 API/CLI 或反向代理边界接入。

## Migrate

`migrate` 表示资产仍有可复用价值，但它不能以旧路径、旧命名或旧叙事直接进入 v22 active surface。迁移必须满足：

- 重新落到 active surface 中的 v22 文件或 v22 contract。
- 去掉 `user_owned` primary path、`resource-order` primary path、旧 runner/provisioner、OpenCost 主叙事和 Langfuse 旧默认叙事。
- 不把 v19/v20/v21 的 smoke、live-test、部署脚本或报告当成 v22 默认验证入口。
- 不移动目录，不删除文件；清理动作另走 `cleanup/*`。

## Archive / Reference

以下路径只作为 archive/reference，允许阅读和引用证据，不作为新实现入口。strict monolith cleanup 下旧脚本本体不再因为历史证据保留；git history 已足够保存 v19/v20/v21 脚本事实。

- `docs/plan/*`
- `docs/reports/*`
- `docs/releases/*`
- `docs/logs/*`
- `OPL-v20-商业化产品套餐开发方案.md`

旧 `scripts/smoke-test-v19-*`、`scripts/smoke-test-v20*`、`scripts/smoke-test-v21-*`、旧 v13 脚本、旧 check/daily/live-prepare、resource-provisioner/OpenCost 脚本、旧 portal resource-order/provisioner 脚本、旧 runner fixture 和旧 v19/v20 helper lib 已在 strict monolith cleanup 中删除；未来真实外部 canary 必须重新走单独授权合同，不得恢复旧 live-test 或旧版本 smoke 默认入口。

## Delete / Cleanup Target

以下内容是 v22 cleanup target。普通功能分支不得继续扩写；需要删除或拆除时，使用专门 `cleanup/*` 分支：

- `user_owned` primary path
- `resource-order` primary path
- `med-autoscience-runner`
- `resource-provisioner`
- OpenCost 主叙事
- Langfuse 旧默认叙事

## Forbidden Without Explicit Authorization

以下路径和操作没有单独授权时禁止触碰：

- `deploy/*`
- `.sentrux/*`
- `adapters/*`
- one-person-lab upstream
- build/push/kubectl/live-test/真实云资源操作
