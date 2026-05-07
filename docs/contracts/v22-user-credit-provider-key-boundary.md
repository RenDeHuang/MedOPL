# v22 User Credit Provider Key Boundary Contract

本合同定义 MedOPL v22 MVP 托管 OPL 闭环第一段：平台准备用户、给用户充值、确认 gflabtoken API Key 绑定状态，并输出 canonical state readiness。

## Product Boundary

MedOPL 是面向 AI 小白科研用户的 OPL 科研托管平台，不是云资源控制台。本合同只覆盖用户、余额、provider key readiness 和托管运行环境开通前置条件，不开通 CVM/COS/TKE，不调用真实云 API，不进入 OPL Gateway、Runtime Bridge、deploy 或 one-person-lab upstream。

## Entry Truth

- portal.medopl.cn 登录不需要 gflabtoken API Key。
- opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key。
- API Key 输入框放在 OPL 登录页密码下面。
- 如果用户已绑定，可以显示“已绑定”，不要求重复输入。
- gflabtoken.cn 网站本身不进入 MedOPL 用户主流程。
- Portal 可以展示“是否已绑定”状态，但 API Key 不是 Portal 普通登录字段。
- 后端可以保留 provider key binding 能力，但用户可见入口必须属于 OPL entry/preflight，不属于 Portal 普通登录。

## Flow

1. 平台创建或准备 1 名用户。
2. 平台给该用户充值额度。
3. 用户登录 `portal.medopl.cn`；Portal 登录不要求 gflabtoken API Key。
4. 用户进入 `opl.medopl.cn` 时，在 OPL 登录页密码下面输入或确认 gflabtoken API Key；已绑定时展示“已绑定”。
5. raw API Key 只能进入后端密钥边界，不能返回前端、不能写日志、不能进 git。
6. API response / canonical state 只暴露 `providerKeyRef` 和 bound status。
7. canonical state 输出 `identity`、`tenant`、`balance`、`providerBound`、`providerKeyRef`、`readyForManagedEnvironment`。
8. 未绑定 provider key 时，不能进入后续托管运行环境开通，错误码使用 `provider_key_required`。

## Secret Boundary

- raw API Key 只能写入后端 `providerSecretStore`。
- Portal API response、canonical state、日志、evidence 和 git 不得包含 raw API Key。
- Portal API response、canonical state、日志、evidence 和 git 不得包含 `launchToken`、`runtimeToken`、bearer token 或 provider secret。
- 用户侧只可见 `providerKeyRef`、`providerBound` 和 bound status。

## Canonical State Contract

`/portal/api/canonical-state` 和 `/portal/api/state` 必须返回：

```json
{
  "identity": "current user public identity",
  "tenant": "current tenant public identity",
  "balance": "wallet and ledger summary",
  "providerBound": true,
  "providerKeyRef": "backend secret reference only",
  "readyForManagedEnvironment": true
}
```

当 provider key 未绑定时：

```json
{
  "providerBound": false,
  "providerKeyRef": "",
  "readyForManagedEnvironment": false,
  "readiness": {
    "ready": false,
    "reason": "provider_key_required"
  }
}
```

## API Surface

本轮最小 Portal API 小闭包：

- `POST /portal/api/v22/users/prepare`
  - 创建或准备用户、tenant、默认 workspace 和 wallet。
  - 响应只返回 public user、tenant、workspace、balance。
- `POST /portal/api/v22/users/credit`
  - 给用户充值额度，写入 wallet 和 `topup` ledger。
  - 响应只返回 public user、balance 和 ledger 摘要。
- `POST /portal/api/v22/provider-key`
  - 后端 provider key binding 能力，用于接收 OPL entry/preflight 提交的 gflabtoken API Key。
  - 该能力不是 Portal 普通登录字段，也不改变 portal.medopl.cn 登录不需要 gflabtoken API Key 的规则。
  - raw API Key 只进入后端密钥边界。
  - 响应只返回 `providerKeyRef`、`providerBound` 和 bound status。
- `POST /portal/api/v22/managed-environment/readiness`
  - 未绑定 provider key 返回 409 和 `provider_key_required`。
  - 已绑定 provider key 返回 `readyForManagedEnvironment=true`，允许进入下一段托管运行环境开通。

## Non-goals

- 不改 frontend。
- 不改 OPL Gateway。
- 不改 Runtime Bridge。
- 不改 deploy、`.sentrux` 或 `adapters`。
- 不修改 one-person-lab upstream。
- 不读取 `/home/dev/.secrets/medopl/secrets.env.txt`。
- 不调用真实云 API。
- 不运行 build/push/kubectl/live-test。
