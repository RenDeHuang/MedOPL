# v22 OPL Entry Preflight Auth Boundary Contract

本合同定义 MedOPL v22 的 OPL Web entry/preflight 最小认证闭环。它只覆盖 `opl.medopl.cn` 进入 OPL 工作台前的账号校验、gflabtoken API Key 输入/绑定和后端密钥边界，不修改 one-person-lab upstream，不 import upstream 内部模块。

## Product Truth

- portal.medopl.cn 登录不需要 gflabtoken API Key。
- opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key。
- OPL 登录页输入顺序：账号/邮箱、密码、gflabtoken API Key。
- API Key 放在密码下面。
- 已绑定则显示“已绑定”，不要求重复输入。
- gflabtoken.cn 网站本身不进入 MedOPL 用户主流程。
- raw API Key 只能进入后端密钥边界，不能返回前端、不能写日志、不能进 git。
- one-person-lab 是 clean upstream；不得修改源码，不得 import 内部模块。

## Entrypoint Alias

用户可见入口必须指向 OPL Gateway entry/preflight alias，不暴露 internal path：

```text
用户可见入口：GET /opl/entry/preflight
用户可见入口：POST /opl/entry/preflight
```

内部实现可以保留 /internal/opl/auth/login，但用户合同、表单 action 和产品入口必须指向 OPL Gateway entry/preflight alias。该入口属于 MedOPL Gateway / SSO / Auth Bridge 的 OPL entry/preflight 边界，不是 Portal 普通登录页。`/login` 只能保留账号/邮箱和密码，不得出现 gflabtoken API Key 字段。

## Preflight Form

OPL entry/preflight 登录表单必须包含：

1. `email` 或 `account`
2. `password`
3. `apiKey`，用户可见名称为 `gflabtoken API Key`

`apiKey` 字段必须在 `password` 字段之后。表单不得引导用户进入 `gflabtoken.cn` 网站主流程。

## Binding Flow

1. 用户在 `opl.medopl.cn` entry/preflight 输入账号/邮箱、密码和 gflabtoken API Key。
2. 平台先校验 MedOPL 账号密码。
3. 未提交 API Key 且没有已绑定记录时，返回 `provider_api_key_required`。
4. 提交 API Key 成功后，raw API Key 只写入 `providerSecretStore`。
5. 后端写入 provider key binding，用户侧只返回 `providerKeyRef`、`providerBound` 和 `boundStatus`。
6. 用户已绑定时，entry/preflight 可以显示“已绑定”，不要求重复输入；后端复用已有 `providerKeyRef`，不回放 raw API Key。
7. OPL 启动 response 不得包含 raw API Key、`providerApiKey`、`apiKey`、`providerSecret` 或 `rawProviderKey` 字段。

## Non-goals

- 不改 Portal 普通登录页为 API Key 登录。
- 不实现新的重复 OPL 登录入口。
- 不改 one-person-lab upstream。
- 不 import one-person-lab 内部模块。
- 不改 deploy、`.sentrux` 或 `adapters`。
- 不读取 secret。
- 不调用真实云 API。
- 不运行 build/push/kubectl/live-test。
- 不把 raw API Key 写入 localStorage、sessionStorage、log、response 或 git。

## Smoke

`scripts/smoke-test-v22-opl-entry-preflight-auth-flow.mjs` 是本地合同 smoke。它只使用本地 fixture 和临时 provider secret store，不读取 `/home/dev/.secrets/medopl/secrets.env.txt`，不调用真实云 API，不执行 build、push、kubectl 或 live-test。
