# Contracts Index

Owner: `MedOPL Platform`
Purpose: `machine_contract_index`
State: `active`
Machine boundary: 本目录保存被 source/tests/runner 可直接消费的小型机器合同；不是人读 current truth，也不是 durable specs 的替代。当前 cursor 仍以 `tests/fixtures/v22/goal-current.json` 为准，长期规则仍以 `docs/specs/README.md` 和 root `specs/**` 为准。

## Product Authority

MedOPL 的产品权威是 `platform-provisioned / customer-dedicated` 的 OPL SaaS 控制面。平台负责 runtime、cloud、file、billing、audit、release；不承担 OPL 科研质量、医学质量、基金质量或论文质量判断。

| Contract | Consumer intent | Authority boundary |
| --- | --- | --- |
| `contracts/medopl-product-profile.json` | active platform product identity checks | Product profile and non-responsibility boundary |
| `contracts/medopl-portal-page-state-matrix.json` | Portal page/state coverage checks | Customer control-plane states, not cloud console states |
| `contracts/medopl-api-contract.json` | API surface and secret-boundary checks | Portal/API resource identity and fail-closed response shape |
| `contracts/medopl-runtime-bridge-contract.json` | Runtime bridge / OPL boundary checks | Gateway/bridge/agent integration only; no upstream internals |
| `contracts/medopl-data-plane-contract.json` | File/artifact ownership checks | Platform-managed workspace data plane |
| `contracts/medopl-billing-ledger-contract.json` | Billing ledger and metering checks | Usage/billing ledger, not research-quality billing |
| `contracts/medopl-release-boundary.json` | Release/cleanup receipt checks | Workspace release, settlement and cleanup boundary |
| `contracts/medopl-cloud-boundary.json` | Cloud authority and authorization checks | Platform-operated cloud boundary for customer-dedicated runtime |
| `contracts/medopl-cloud-authorization-pack.json` | Cloud execution authorization and receipt requirements | Machine authorization pack for cloud, deploy, kubectl, build/push and live-test execution |

每个 product-authority JSON 必须保留 `schema_version`、`owner`、`purpose`、`state`、`authority_boundary`、`consumers` 或 `consumer_tests`，并保持小到可由 `validate:active-platform` 或 tests 直接枚举读取。

## Legacy Ops Inputs

| Contract | Current role | Source reference |
| --- | --- | --- |
| `contracts/cloud-deploy-readiness-contract.json` | legacy/ops boundary input for future authorized deploy runner shape | referenced by `contracts/medopl-release-boundary.json` |
| `contracts/cloud-authorization-boundary-contract.json` | legacy/ops boundary input for explicit cloud authorization, evidence sink and redaction | referenced by `contracts/medopl-cloud-boundary.json` |

旧 cloud 文件暂不删除；主线程决定清退。它们不再表达 MedOPL product authority，只作为 release/cloud 合同的 ops source references 和现有 verify consumer 的兼容输入。

Retired oversized payloads:

- `contracts/medopl-production-launch-gap-map.json`: deleted after current-state / verify consumers moved to `contracts/cloud-authorization-boundary-contract.json`.
- `contracts/medopl-package-d-deploy-readiness.json`: deleted after future-authorized deploy execution status/history checks were removed from active verification and durable consumers moved to `contracts/cloud-deploy-readiness-contract.json`.

这两个旧文件中的 gap/evidence/history/current status 不再是 durable contract；current fact、gap narrative 和 closeout history 回到 `tests/fixtures/v22/goal-current.json`、`docs/**`、`.runtime` evidence 或 git history 的对应 owner。

## Consumer-First Rule

- 只有当 tests/source/runner 直接消费或准备由 `validate:active-platform` 枚举消费时，才允许在本目录新增机器合同。
- `tests/fixtures/v22/goal-current.json` 只保 current cursor、latest landed closeout、current leaf、verify bundle、next cursor 和指向本目录小合同的引用字段；不得重新内嵌大对象。
- 人读解释、产品/运行时/政策语义仍写回 `docs/**` 和 `specs/**`，不要把 Markdown prose 当成机器接口。
