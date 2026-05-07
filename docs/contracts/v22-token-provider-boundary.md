# v22 Token Provider Boundary Contract

本合同定义 MedOPL v22 的 API token 业务和密钥边界。

## Provider

MedOPL 的 OpenAI-compatible API 中转站 base URL 是：

```text
https://gflabtoken.cn/v1
```

商业目标之一是销售 token/API 使用额度。

## OPL Entry / Preflight Binding

gflabtoken API Key 的用户可见入口属于 OPL entry/preflight：

- portal.medopl.cn 登录不需要 gflabtoken API Key。
- opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key。
- API Key 输入框放在 OPL 登录页密码下面。
- 如果用户已绑定，可以显示“已绑定”，不要求重复输入。
- gflabtoken.cn 网站本身不进入 MedOPL 用户主流程。
- Portal 可以展示“是否已绑定”状态。
- API Key 不是 Portal 普通登录字段。
- raw API Key 只能进入后端密钥边界，不能返回前端、不能写日志、不能进 git。

绑定后：

- 前端最多保留一次性输入态、`providerKeyRef` 和 bound status。
- 后端对 Portal 和 OPL 运行边界暴露引用状态，不暴露 raw key。

## Forbidden Storage

以下内容不能写入 sessionStorage、localStorage、global JS state、log、evidence 或 git：

- raw API Key
- bearer token
- launchToken
- runtimeToken
- secret

## Runtime Use

托管 runtime 任务使用 provider key reference 访问后端密钥边界。未开通 runtime 的租户可以绑定 API key，但不能因此获得托管 runtime 执行能力。
