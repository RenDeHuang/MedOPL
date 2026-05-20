# MedOPL v22 Docs

Owner: `MedOPL`
Purpose: `docs_taxonomy_index`
State: `active`
Machine boundary: 本文是人读入口。机器验证入口是 `scripts/v22-verify.mjs`；机器 cursor 和 verify manifest 在 `tests/fixtures/v22/goal-current.json` 与 `tests/fixtures/v22/agent-verify-manifest.json`。

本目录采用 OPL-style lifecycle taxonomy，并在 v22 严格版里执行“一目录一 README 真相”。`docs/active/README.md` 是唯一人读 current truth；`docs/specs/README.md` 是唯一合同/spec truth。

## Reading Order

1. [active](./active/README.md): 当前状态、理想目标差距、业务 cursor 和不可宣称事项。
2. [product](./product/README.md): 用户购买什么、Portal/OPL 怎么解释服务、普通用户与管理员边界。
3. [runtime](./runtime/README.md): Portal -> Gateway -> clean OPL upstream -> Runtime Bridge / Runtime Agent 的运行边界。
4. [specs](./specs/README.md): v22 contract/spec 单一真相。
5. [policies](./policies/README.md): 授权红线、secret hygiene、agent 证据、smoke/eval 和清退纪律。
6. [delivery](./delivery/README.md): 当前 cursor、验证入口、cloud / deploy / release 授权顺序。
7. [source](./source/README.md): active source surface、服务边界、禁止恢复的旧入口。
8. [public](./public/README.md): 对外产品叙事。
9. [references](./references/README.md): 外部参考、upstream 参考和迁移摘要。
10. [history](./history/README.md): agent-run、B review、吸收记录、cleanup 记录和 provenance 摘要。

## Directory Rule

`docs/{active,product,runtime,specs,policies,delivery,source,public,references,history}/` 只允许一个 `README.md`。新增第二个 Markdown 文件必须先改本入口和 hard-retirement gate，并说明为什么不能吸收到该目录 README。

## Retired Entrypoints

旧分散 root docs、旧合同叶子、旧 recovery 目录和旧 workflow/cloud helper 不再是 active docs 入口。历史原因和证据只看 git history 或 `docs/history/README.md` 摘要；当前事实只看本 taxonomy。
