# MedOPL v22 Docs

Owner: `MedOPL`
Purpose: `docs_taxonomy_index`
State: `taxonomy_skeleton`
Machine boundary: 本文是人读入口。机器验证入口仍是 `scripts/v22-verify.mjs`，当前 cursor / allowlist / suite 权威仍在 `docs/recovery/v22-goal-current.json` 和 `docs/recovery/v22-agent-verify-manifest.json`，直到后续迁移分支完成引用迁移。

本目录采用 OPL-style lifecycle taxonomy，并在 v22 严格版里执行“一目录一 README 真相”。本分支只建立目标骨架，不物理删除仍被引用的 `docs/specs/**`、`docs/recovery/**` 或 `tests/**/*.mjs`。

## Reading Order

1. [active](./active/README.md): 当前状态、理想目标差距、下一步 cursor 的人读摘要。
2. [product](./product/README.md): 用户购买什么、Portal/OPL 怎么解释服务、普通用户与管理员边界。
3. [runtime](./runtime/README.md): Portal -> Gateway -> clean OPL upstream -> Runtime Bridge / Runtime Agent 的运行边界。
4. [specs](./specs/README.md): v22 contract/spec 的收敛入口；当前 `docs/specs/**` 仍是 machine-boundary leaf。
5. [policies](./policies/README.md): 授权红线、secret hygiene、agent 证据、smoke/eval 和清退纪律。
6. [delivery](./delivery/README.md): 当前交付 cursor、验证入口、cloud / deploy / release 授权顺序。
7. [source](./source/README.md): active source surface、服务边界、禁止恢复的旧入口。
8. [public](./public/README.md): 对外产品叙事的目标入口。
9. [references](./references/README.md): compaction、matrix、索引、外部参考和迁移说明。
10. [history](./history/README.md): agent-runs、吸收记录、cleanup 记录和 provenance 摘要。

## Current Compatibility

当前仍存在旧权威入口：

- `docs/product.md`
- `docs/architecture.md`
- `docs/specs/README.md`
- `docs/specs/v22-*`
- `docs/recovery/*`
- `docs/recovery/agent-runs/*`

这些路径本轮是 `blocked-retain`，不是最终 taxonomy。后续清退必须先完成引用迁移、替代 truth 写入和 gate 覆盖，再物理删除旧路径。

## Directory Rule

目标 taxonomy 下，`docs/{active,product,runtime,specs,policies,delivery,source,public,references,history}/` 只允许一个 `README.md`。新增第二个 Markdown 文件必须先改本入口和 taxonomy gate，并说明为什么不能吸收到该目录 README。

