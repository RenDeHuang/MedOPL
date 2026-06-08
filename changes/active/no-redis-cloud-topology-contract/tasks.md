# No Redis Cloud Topology Contract Tasks

Owner: `MedOPL`
Purpose: `change_tasks`
State: `active`
Machine boundary: 本文件记录执行任务；验收以 tests 和 package scripts 为准。

- [x] Update future-authorized production topology eval to require no Redis, COS file space, CBS PV and Kubernetes multi-tenancy controls.
- [x] Update runtime truth to PostgreSQL-only required data plane and optional Redis accelerator language.
- [x] Update specs production topology resource roles and contract data.
- [x] Update compose product/dev services to remove Redis.
- [x] Update current machine fixtures and closeout automation cursor from `postgres-redis` to `postgres-only`.
- [x] Add compose guard to precloud deployable RC contract.
- [x] Run target tests and standard verification.
