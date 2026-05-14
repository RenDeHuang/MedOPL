# platform-v22 Archive Policy

本文件定义 platform-v22 对旧文档、旧脚本和旧栈资产的 archive/reference/cleanup 规则。目标是保留历史证据，同时避免旧路径重新成为 v22 主线。

## Canonical And Legacy

- `platform-v22` 是 canonical trunk，v22 产品、架构、合同和 smoke 以此为准。
- `recovery/platform-v22-trunk` 是 v22 recovery trunk，只接收已收敛的正式文档和正式变更。
- `platform-v21` 是 legacy reference，只能提供迁移线索、历史证据和命名对照。

## Archive / Reference Surface

以下路径默认归档为 reference：

- `docs/plan/*`
- `docs/reports/*`
- `docs/releases/*`
- `docs/logs/*`
- `scripts/smoke-test-v19-*`
- `scripts/smoke-test-v20*`
- `OPL-v20-商业化产品套餐开发方案.md`

旧 `scripts/live-test-*` 文件已由用户授权的物理删除 slice 删除；未来真实外部 canary 只能通过新的授权合同和新的 v22 gate 重新引入。

Archive/reference 资产可以被阅读、摘取事实或转写为新的 v22 contract，但不能被当成 v22 active 入口、默认验证入口或当前产品叙事。

## Migration Rule

从 archive/reference 迁移到 active surface 时，必须重新落地到以下路径之一：

- `docs/product.md`
- `docs/architecture.md`
- `docs/contracts/v22-*`
- `docs/recovery/*`
- `scripts/smoke-test-v22-*`
- `services/portal`
- `services/opl-web-gateway`
- `services/opl-runtime-bridge`

迁移后的内容必须使用 v22 的平台托管科研工作台叙事，不得保留 v19/v20/v21 的旧默认入口。

## Cleanup Targets

以下内容属于 delete/cleanup target：

- `user_owned` primary path
- `resource-order` primary path
- `med-autoscience-runner`
- `resource-provisioner`
- OpenCost 主叙事
- Langfuse 旧默认叙事

Cleanup target 的处理规则：

- 普通 `feat/*` 分支不得继续扩写这些路径的主叙事。
- 删除、拆路由、移除默认入口或移除旧验证入口必须使用专门 `cleanup/*` 分支。
- `user_owned` 只能保留为 legacy alias，不得解释成用户自带 CVM/COS/K8s 或用户配置云资源。
- `resource-order` 只能作为退场参考；v22 主线应表达 resource binding、billing、quota 和 audit 边界。

## Forbidden Surface

以下路径和操作没有显式授权时禁止触碰：

- `deploy/*`
- `.sentrux/*`
- `adapters/*`
- one-person-lab upstream
- build/push/kubectl/live-test/真实云资源操作

这些路径和操作即使包含有用历史实现，也不能在普通文档收敛、本地 smoke 或仓库控制面修整中顺手修改或运行。
