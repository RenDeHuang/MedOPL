# v22 Token Provider Boundary Contract

本合同定义 MedOPL v22 的 API token 业务和密钥边界。

## Provider

MedOPL 的 OpenAI-compatible API 中转站 base URL 是：

```text
https://gflabtoken.cn/v1
```

商业目标之一是销售 token/API 使用额度。

## API Key Binding

用户在 Portal 绑定 gflabtoken API key。绑定后：

- raw API key 只能进入后端密钥边界。
- 前端最多保留一次性输入态、`providerKeyRef` 和 bound status。
- 后端对 Portal 和 OPL 运行边界暴露引用状态，不暴露 raw key。

## Forbidden Storage

以下内容不能写入 sessionStorage、localStorage、global JS state、log、evidence 或 git：

- raw API key
- bearer token
- launchToken
- runtimeToken
- secret

## Runtime Use

托管 runtime 任务使用 provider key reference 访问后端密钥边界。未开通 runtime 的租户可以绑定 API key，但不能因此获得托管 runtime 执行能力。
