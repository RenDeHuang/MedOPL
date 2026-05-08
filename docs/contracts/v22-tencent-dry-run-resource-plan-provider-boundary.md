# v22 Tencent Dry-Run Resource Plan Provider Boundary

本合同定义 v22 `dry-run/tencent resource plan provider` 的接口边界。该 provider 基于现有 readonly quote provider 和 managed resource binding plan，生成“不会执行的资源创建计划”。

当前层级不调用真实腾讯云 API，不创建、绑定、释放真实资源，不真实扣费。

## Purpose

dry-run provider 用于把 readonly quote 的区域、规格和预计费用，整理成 Portal / 运维可审计的资源计划业务对象。它只描述计划，不执行计划。

Provider 输出字段白名单：

```json
{
  "resourcePlanId": "dry-run-plan-rb-v22-example",
  "resourceBindingId": "rb-v22-example",
  "planMode": "dry_run",
  "regionLabel": "硅谷一区",
  "planSpec": "8核 / 16GB 内存 / 100GB 文件空间",
  "estimatedCost": {
    "amount": 0,
    "currency": "CNY",
    "source": "contract_snapshot_fixture",
    "status": "mock_snapshot",
    "billingTruth": false,
    "chargeApplied": false
  },
  "resourceSteps": [
    "准备托管运行环境",
    "分配文件空间",
    "准备运行网络边界",
    "登记账单和审计边界"
  ],
  "approvalRequired": true,
  "releasePolicy": {
    "status": "not_released",
    "releasedAt": "",
    "billingStopConfirmBy": "",
    "stopBillingConfirmWithinMinutes": 120,
    "protection": "文件和输出进入保护/审计边界"
  },
  "auditStatus": {
    "status": "audit_pending",
    "auditReadyAt": "2026-05-09T08:00:00.000Z",
    "policy": "T+1"
  },
  "riskNotes": [
    "dry-run 只生成不会执行的资源创建计划",
    "真实腾讯云接入必须另开 feat/* 并单独授权",
    "当前不创建、绑定、释放真实资源，不真实扣费"
  ],
  "realResourceCreated": false,
  "chargeApplied": false
}
```

`realResourceCreated=false` 和 `chargeApplied=false` 是固定边界。dry-run 不得声称真实资源已创建，不得触发真实扣费。

## Resource Steps Language

`resourceSteps` 只能使用用户 / 运维可审计的产品语言，例如：

- 准备托管运行环境
- 分配文件空间
- 准备运行网络边界
- 登记账单和审计边界

普通用户主语言不得出现 CVM、COS、K8s、TKE、Kubernetes 或云资源控制台。后台实现可以在后续授权阶段映射到真实 provider adapter，但不得把云内部对象暴露到 Portal 普通用户 payload。

## Data Source

当前 dry-run provider 只能使用：

- contract/mock/snapshot 数据
- readonly/tencent quote provider 输出
- managed resource binding plan 里的业务字段

当前不得读取 secret、kubeconfig、token、SecretId、SecretKey、SSH private key 或 `.env`；不得调用真实腾讯云、COS、Langfuse、one-person-lab 或外部生产 API。

## Forbidden Response Fields

Provider response 和 Portal payload 不得包含：

- SecretId / SecretKey
- kubeconfig
- token / bearer token
- raw API Key
- provider raw cost internals
- CVM / COS / K8s / TKE 内部对象
- objectKey / storageKey / localPath / signedUrl

## Adapter Route

后续真实腾讯云接入路线保持：

`mock/snapshot -> readonly/tencent quote -> dry-run/tencent plan -> authorized/tencent create/release`

真实腾讯云 SDK、真实 SecretId/SecretKey、真实报价、真实创建、真实绑定、真实释放、真实扣费、真实账单核对、deploy、build/push、kubectl 和 live-test 必须另开 feat/* 并单独授权。
