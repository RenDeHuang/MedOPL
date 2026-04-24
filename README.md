# 平台搭建 v1

v1 只保留一条产品主线：

```text
Portal -> AionUI/OPL -> OPL runtime -> med-autoscience
```

本目录从旧 `平台搭建` 中迁移可复用资产，只保留控制面、运行时合同、账本、K8s、对象存储和成本链路。旧聊天壳代理和旧 MCP 产品入口不再作为主路径。

## 当前入口

- Portal 控制面：`services/portal`
- OPL runtime bridge：`services/opl-runtime-bridge`
- med-autoscience runner 素材：`adapters/med-autoscience-runner`
- 开发计划：`docs/plan/2026-04-24-Portal-AionUI-OPL-硬闭环开发计划-v1.md`
- 迁移日志：`docs/logs/2026-04-24-Portal-AionUI-OPL-硬闭环迁移日志-v1.md`

## 本地验证

```powershell
npm --prefix services/opl-runtime-bridge run check
npm --prefix services/portal run check
node --check adapters/med-autoscience-runner/src/server.mjs
node scripts/smoke-test-med-autoscience-runner-api.mjs
node scripts/smoke-test-opl-runtime-bridge.mjs
node scripts/smoke-test-portal-opl-hard-loop.mjs
npm --prefix services/portal run frontend:typecheck
npm --prefix services/portal run frontend:build
```

全部通过后，说明本地合同闭环已跑通：Portal 创建 OPL launch，OPL runtime bridge 建立 runtime session，触发 med-autoscience contract run，并回流 artifact、trace、cost、session 记录。
