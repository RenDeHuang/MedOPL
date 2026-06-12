# No Redis Cloud Topology Contract Spec Delta

Owner: `MedOPL`
Purpose: `spec_delta`
State: `active`
Machine boundary: 本文件只描述 spec delta；实际合同由 docs、tests 和 compose 持有。

## Delta

Target specs:

- specs/source/spec.md
- specs/operations/spec.md

## ADDED

- `docs/runtime/README.md`：Portal canonical truth 改为 PostgreSQL-only required data plane；Redis is not a required production dependency。
- `docs/specs/README.md#spec-v22-production-cloud-topology-boundary`：新增 Kubernetes 多租户控制要求和 tenant node pool 调度约束。

## MODIFIED

- `docs/specs/README.md#spec-v22-production-cloud-topology-boundary`：资源角色从 `CLB/TKE/CBS/NAT/Redis/PostgreSQL` 改为 `CLB/TKE/COS/CBS/NAT/PostgreSQL`。
- `compose.product.yaml`：删除 Redis service、Redis volume、`PORTAL_REDIS_URL` 和 Redis `depends_on`；`PORTAL_STORAGE_MODE` 改为 `postgres`。
- Tests/fixtures：更新当前 cursor、manifest、contract tests 和 future-authorized topology eval。

## REMOVED

- Redis required production topology role.
- Redis required local compose service.

## CANNOT-CLAIM

- 不代表真实云已接入。
- 不代表生产部署已完成。
- 不代表 COS 账单或 PostgreSQL production connection 已验证。

## EVALS

- `node tests/future-authorized/cloud/future-authorized-test-v22-production-cloud-topology-contract.mjs`
- `node tests/contract/contract-test-v22-precloud-deployable-rc.mjs`
- `npm run verify`

## Compatibility

历史 closeout 和 `docs/history/README.md` 中的旧 Redis cursor 保留为 provenance；当前 truth、machine fixtures、compose 和 eval 不再把 Redis 写成必需依赖。
