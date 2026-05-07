# v22 User Credit Provider Key Boundary Contract

本合同定义 MedOPL v22 MVP 托管 OPL 闭环第一段：平台准备用户、给用户充值、绑定 gflabtoken API key，并输出 canonical state readiness。

## Product Boundary

MedOPL 是面向 AI 小白科研用户的 OPL 科研托管平台，不是云资源控制台。本合同只覆盖用户、余额、provider key 和托管运行环境开通前置条件，不开通 CVM/COS/TKE，不调用真实云 API，不进入 OPL Gateway、Runtime Bridge、deploy 或 one-person-lab upstream。

## Flow

1. 平台创建或准备 1 名用户。
2. 平台给该用户充值额度。
3. 用户绑定 gflabtoken API key。
4. raw API key 只进入后端密钥边界。
5. API response / canonical state 只暴露 `providerKeyRef` 和 bound status。
6. canonical state 输出 `identity`、`tenant`、`balance`、`providerBound`、`providerKeyRef`、`readyForManagedEnvironment`。
7. 未绑定 provider key 时，不能进入后续托管运行环境开通，错误码使用 `provider_key_required`。

## Secret Boundary

- raw API key 只能写入后端 `providerSecretStore`。
- Portal API response、canonical state、日志、evidence 和 git 不得包含 raw API key。
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
  - 绑定 gflabtoken API key。
  - raw API key 只进入后端密钥边界。
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
