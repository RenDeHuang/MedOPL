# No Redis Cloud Topology Contract Spec Delta

Owner: `MedOPL`
Purpose: `spec_delta`
State: `archived`
Machine boundary: 本文件只描述 spec delta；实际合同由 docs、tests 和 compose 持有。

## Delta

Target specs:

- specs/operations/spec.md

## ADDED

- `operations:production-cloud-topology-boundary` records PostgreSQL/COS/CBS/Kubernetes topology requirements without Redis as a required production dependency.

## MODIFIED

- `specs/operations/spec.md` production topology requirement no longer lists Redis as required.
- `compose.product.yaml` removed Redis service, Redis volume, `PORTAL_REDIS_URL` and Redis `depends_on`; `PORTAL_STORAGE_MODE` is `postgres`.
- Tests/fixtures update current cursor, manifest, contract tests and future-authorized topology eval.

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

## Provenance

历史 closeout 和 `docs/history/README.md` 中的旧 Redis cursor 保留为 provenance；当前 truth、machine fixtures、compose 和 eval 不再把 Redis 写成必需依赖。
