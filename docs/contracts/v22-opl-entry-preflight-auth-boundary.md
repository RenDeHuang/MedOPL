# v22 OPL Entry Preflight Auth Boundary Contract

本合同定义 MedOPL v22 的 OPL Web entry/preflight 最小认证闭环。它只覆盖 `opl.medopl.cn` 进入 OPL 工作台前的账号校验、gflabtoken API Key 输入/绑定和后端密钥边界，不修改 one-person-lab upstream，不 import upstream 内部模块。

## Product Truth

- MedOPL 有两种进入 OPL Web 的路径。
- 路径 1：从 Portal SaaS 后台进入。
- `portal.medopl.cn -> Portal 工作空间 / 托管运行环境 / “进入 OPL 工作台”按钮 -> Gateway launch / preflight -> clean upstream one-person-lab Web`
- 路径 2：直接访问 OPL 工作台。
- `opl.medopl.cn -> OPL Gateway entry -> MedOPL 账号/密码/gflabtoken API Key preflight -> clean upstream one-person-lab Web`
- 两条路径最终进入同一套 Gateway / preflight / launch 逻辑。
- portal.medopl.cn 登录不需要 gflabtoken API Key。
- Portal 普通登录页不需要 API Key。
- opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key。
- OPL 登录页输入顺序：账号/邮箱、密码、gflabtoken API Key。
- API Key 放在密码下面。
- API Key 只出现在 opl.medopl.cn entry/preflight 的密码下面。
- 从 Portal 进入时可复用 Portal session / workspace / launch context。
- 从 OPL 直接进入时需要 MedOPL 账号/密码/gflabtoken API Key，已绑定可显示“已绑定”。
- 已绑定则显示“已绑定”，不要求重复输入。
- gflabtoken.cn 网站本身不进入 MedOPL 用户主流程。
- raw API Key 只能进入后端密钥边界，不能返回前端、不能写日志、不能进 git。
- raw API Key 只进入后端密钥边界。
- one-person-lab 是 clean upstream；不得修改源码，不得 import 内部模块。

## Entrypoint Alias

用户可见入口必须指向 OPL Gateway entry/preflight alias，不暴露 internal path：

```text
用户可见入口：GET /opl/entry/preflight
用户可见入口：POST /opl/entry/preflight
```

内部实现可以保留 /internal/opl/auth/login，但用户合同、表单 action 和产品入口必须指向 OPL Gateway entry/preflight alias。该入口属于 MedOPL Gateway / SSO / Auth Bridge 的 OPL entry/preflight 边界，不是 Portal 普通登录页。`/login` 只能保留账号/邮箱和密码，不得出现 gflabtoken API Key 字段。

用户可见入口不是 /internal/opl/auth/login。/internal/opl/auth/login 只能是 internal implementation path。用户可见入口必须是 Portal “进入 OPL 工作台”或 /opl/entry/preflight。

## Preflight Form

OPL entry/preflight 登录表单必须包含：

1. `email` 或 `account`
2. `password`
3. `apiKey`，用户可见名称为 `gflabtoken API Key`

`apiKey` 字段必须在 `password` 字段之后。表单不得引导用户进入 `gflabtoken.cn` 网站主流程。

Gateway / preflight / launch 边界必须满足：

- launchToken/runtimeToken 不进 URL query。
- launchToken/runtimeToken 不进 localStorage/sessionStorage。
- Gateway 不写 raw API Key 到 localStorage/sessionStorage。
- Gateway 不 import one-person-lab 内部模块。

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
