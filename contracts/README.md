# Contracts Index

Owner: `MedOPL Platform`
Purpose: `machine_contract_index`
State: `active`
Machine boundary: 本目录保存被 source/tests/runner 直接消费的机器合同；不是人读 current truth，也不是 durable specs 的替代。当前 cursor 仍以 `tests/fixtures/v22/goal-current.json` 为准，长期规则仍以 `docs/specs/README.md` 和 root `specs/**` 为准。

## Scope

- `contracts/medopl-package-d-deploy-readiness.json`: Package D deploy readiness owner payload。
- `contracts/medopl-production-launch-gap-map.json`: production launch goal / gap owner payload。

## Consumer-First Rule

- 只有当 tests/source/runner 直接消费时，才允许在本目录新增机器合同。
- `tests/fixtures/v22/goal-current.json` 只保 current cursor、latest landed closeout、current leaf、verify bundle、next cursor 和指向本目录的引用字段；不得重新内嵌大对象。
- 人读解释、产品/运行时/政策语义仍写回 `docs/**` 和 `specs/**`，不要把 Markdown prose 当成机器接口。
