# v22 Tencent Readonly Quote Provider Boundary

本合同定义 v22 腾讯云 `readonly/tencent quote provider` 的接口边界。当前只做 interface、mock adapter、合同和 smoke，不读取 secret，不调用真实腾讯云 API。

## Purpose

该 provider 为后续真实腾讯云价格/规格读取做接口准备。它只输出 Portal 可消费的普通业务对象：

```json
{
  "regionLabel": "硅谷一区",
  "planSpec": "8核 / 16GB 内存 / 100GB 文件空间",
  "estimatedCost": {
    "amount": 0,
    "currency": "CNY",
    "source": "contract_snapshot",
    "status": "mock_snapshot",
    "billingTruth": false,
    "chargeApplied": false
  },
  "quoteSource": "mock/tencent-readonly-quote-provider",
  "quoteStatus": "mock_snapshot",
  "quoteSnapshotId": "quote-snapshot-v22-pro-8c16g-100gb"
}
```

## Current Adapter

当前 adapter 是 mock/snapshot adapter：

- 只能使用 contract/mock/snapshot 数据。
- 不创建、绑定或释放资源。
- 不做真实扣费。
- 不调用真实腾讯云、COS、Langfuse 或 one-person-lab API。
- 不读取 `/home/dev/.secrets/medopl/secrets.env.txt` 或任何本地 secret。
- 不读取 SecretId、SecretKey、kubeconfig、token、raw API Key。

## Forbidden Response Fields

Provider response 不得包含：

- SecretId / SecretKey
- kubeconfig
- token / bearer token
- raw API Key
- provider raw cost internals
- CVM / COS / K8s / TKE 内部对象
- objectKey / storageKey / localPath / signedUrl

普通用户 payload 仍只能看到托管运行环境、区域、规格、预计费用、状态等产品语言，不出现云控制台主语言。

## Adapter Route

后续真实腾讯云接入路线保持：

`mock/snapshot -> readonly/tencent quote -> dry-run/tencent plan -> authorized/tencent create/release`

等价阶段名：`mock/snapshot provider -> readonly/tencent quote provider -> dry-run/tencent plan provider -> authorized/tencent create/release provider`

真实腾讯云 readonly 接入、SDK 选择、API 凭据读取、限流、重试、审计日志和真实 quote source 均必须另开 feat/* 并单独授权。
