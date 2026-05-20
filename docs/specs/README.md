# Specs Truth

Owner: `MedOPL`
Purpose: `specs_contract_index`
State: `taxonomy_skeleton`
Machine boundary: 本文是人读 specs 入口。当前 contract leaf authority 仍是 `docs/contracts/README.md` 和 `docs/contracts/v22-*`，直到后续引用迁移完成。

## Scope

`docs/specs/README.md` 最终吸收 v22 合同目录的人读真相，回答接口、状态、字段、入口、失败码和 flow shape。它不替代 source、runtime evidence、verify manifest 或真实授权记录。

## Current Contract Groups

| Group | Target Truth |
| --- | --- |
| Product and user surface | `docs/product/README.md` |
| Portal / Gateway / Runtime Bridge flow specs | `docs/specs/README.md` |
| Runtime / upstream / canary boundary | `docs/runtime/README.md` |
| Secret, token, trace, tenant, smoke/eval policies | `docs/policies/README.md` |
| Cloud, create/release, deploy, release ownership | `docs/delivery/README.md` |

## Non-Negotiable Specs

- Portal 登录不需要 provider key；OPL entry/preflight 需要 provider key gate。
- raw provider key、bearer token、launchToken、runtimeToken 只能进入后端密钥边界。
- `user_owned`、`resource-order`、旧 runner/provisioner、OpenCost、Langfuse 主叙事不得回流主线。
- 所有资源必须绑定 tenant/user/workspace/resourceBinding/billingAccount/auditTag。
- 释放计算资源不等于删除文件空间。
- `future-authorized` 不得混入默认本地验证。

## Migration Status

本 README 是目标 specs skeleton。42 个 `docs/contracts/v22-*` 仍被 scripts、manifest、README 和 recovery 引用，本分支不删除。后续物理清退必须先迁引用并保留必要 machine-boundary leaf。

