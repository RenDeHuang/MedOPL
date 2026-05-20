# References Truth

Owner: `MedOPL`
Purpose: `references_index`
State: `active`
Machine boundary: 本文是索引和参考入口，不是 current product truth、delivery cursor 或 machine gate。

## Scope

`docs/references/README.md` 承接：

- upstream OPL reference
- 外部参考说明
- cleanup migration 摘要
- 已清退 docs/eval/scripts 的历史索引指针

## Upstream Reference

One Person Lab upstream reference:

```text
https://github.com/gaofeng21cn/one-person-lab
```

MedOPL v22 不修改 upstream 源码，不 import upstream 内部模块，不在 upstream 目录写 Portal/Gateway/Runtime Bridge 代码。

## Retired Reference Rule

旧分散 docs、旧合同叶子、旧 recovery 过程文档、旧 workflow/cloud helper 和旧 smoke 脚本只通过 git history 查证。若某条旧参考仍是当前规则，必须提升到 `docs/active/README.md`、`docs/specs/README.md`、`docs/policies/README.md`、`docs/delivery/README.md`、source 或 verify gate。
