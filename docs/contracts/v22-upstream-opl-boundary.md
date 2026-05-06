# v22 Upstream OPL Boundary Contract

本合同定义 MedOPL v22 与 one-person-lab upstream 的边界。

## Upstream

one-person-lab 是 clean upstream：

```text
https://github.com/gaofeng21cn/one-person-lab
```

## Rules

- 不修改 upstream 源码。
- 不在 upstream 目录写 Portal、Gateway、Adapter 代码。
- 不 import upstream 内部模块。
- 不把 Portal 账号、计费、资源开通、密钥管理或审计逻辑写进 upstream。

## Adaptation

upstream 更新后，平台拉取更新，并通过以下公开边界适配：

- OPL Web Gateway
- Portal OPL Adapter
- Runtime Agent
- API/CLI

## Product Entry

用户通过 `opl.medopl.cn` 进入 OPL Web。该入口必须保持 MedOPL 的 tenant、workspace、runtime availability、resource binding 和 token provider boundary，不绕过 Portal 控制面。
