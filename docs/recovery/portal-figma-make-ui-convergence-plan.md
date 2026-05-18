# Portal Figma Make UI Convergence Plan

模型记录：`gpt-5.4`

## Goal

按 v22 合同纪律完成 Portal 技术栈与 Figma Make UI 收敛：先改合同与旧文案，再清退旧 Portal 前端，再纳入 Figma Make UI 并接 API，最后提供可预览部署路径。

## Branch Intent

- 当前分支：`feat/v22-portal-ui-reference-mapped-shell`
- 本轮不新开 v26，不改变 v22 产品真相。
- 本轮把 Portal 全体前端技术栈收敛为 React + Vite + TypeScript + react-router + shadcn/Radix + lucide。
- 当前 Figma Make ZIP 是唯一 Portal UI source-of-truth，只提供普通用户端 active route；Admin / Ops 仍属于同一 Portal 技术栈，但 UI 需要后续单独设计和合同 leaf。
- 本轮默认只做本地可预览部署，不执行真实云、build/push、kubectl、live-test 或线上发布。

## Contract Subscription Package

- `docs/contracts/README.md`
- `docs/contracts/v22-mvp-managed-opl-loop.md`
- `docs/contracts/v22-saas-control-plane-user-experience-boundary.md`
- `docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md`
- `docs/contracts/v22-portal-user-surface-boundary.md`
- `docs/contracts/v22-portal-admin-ops-surface-boundary.md`
- `docs/contracts/v22-portal-files-billing-trace-boundary.md`
- `docs/contracts/v22-portal-structure-failure-isolation-boundary.md`
- `docs/contracts/v22-portal-workbench-management-ui-composition-boundary.md`
- `docs/contracts/v22-portal-ui-design-quality-audit-boundary.md`
- `docs/recovery/mvp-contract-acceptance.md`
- `docs/recovery/status-matrix.md`

## Authorization Boundary

Allowed files:

- `docs/contracts/v22-*.md`
- `docs/contracts/README.md`
- `docs/recovery/*`
- `DESIGN.md`
- `services/portal/frontend/**`
- `scripts/smoke-test-v22-*`

Forbidden without separate authorization:

- `deploy/*`
- `.sentrux/*`
- `adapters/*`
- one-person-lab upstream
- secret files, raw provider keys, kubeconfig, SSH private keys, `.env`
- build/push, kubectl, live-test, real cloud operations, true production deploy

## Step 1: Add And Align Contracts

- Create `docs/contracts/v22-portal-figma-make-ui-implementation-boundary.md`.
- Declare React + Vite + TypeScript + react-router + shadcn/Radix + lucide as the Portal-wide frontend target stack.
- Declare Figma Make ZIP `/mnt/c/Users/Administrator/Downloads/MedOPL+Portal+UI+Design.zip` and file `pjLYKml89XFsf8BMNOJ3CV` as current user Portal UI implementation source.
- Declare current user routes: `/overview`, `/resources`, `/workspace`, `/trace`, `/billing`, `/opl-launch`.
- Declare `AdminConsole.tsx` from Figma Make as copied ZIP residue that must remain unrouted and must not count as completed Admin UI.
- Declare Admin / Ops UI as future same-stack work, not current Figma coverage.
- Fix storage deletion protection period to 7 days.

## Step 2: Retire Conflicting Old Contract Copy

- Update Vue-only and Pinia-only wording in UI composition contract.
- Update design-quality audit contract so the old "no React migration" rule is scoped to the historical audit leaf, not this approved implementation leaf.
- Update `DESIGN.md` from "Figma roundtrip back to Vue" to "Figma Make as React implementation source".
- Update recovery current/gap documents to remove `frontend-product-vue-vite-ts-pinia` as the target stack.
- Physically retire current-truth contract assertions that still treat Vue SPA, old visual workbench, screenshot baseline, old admin routes, or Vue-owned evalset/harness as the current completion surface.
- Update `v22-portal-structure-failure-isolation-boundary.md` so current frontend shape points to `src/app/pages/*`, `src/app/data/portalAdapters.ts`, and ZIP/surface smoke instead of deleted Vue views/composables or deleted harness.
- Keep Admin role boundary, but do not claim current Figma contains Admin UI.

## Step 3: Retire Old Portal Frontend Surface

- Replace the current Vue SPA with a React SPA.
- Remove old frontend routes: `/packages`, `/advanced/servers`, `/admin/*`.
- Retire Vue-specific evalset owner paths, harness ownership, visual workbench ownership and smoke assumptions.
- Physically delete old `.vue` frontend files, old Vue composables, old component fixture renderer, old visual workbench test, and old screenshot snapshots from current Portal frontend surface.
- Preserve backend `/portal/api/*` as the data boundary.

## Step 4: Absorb Figma Make UI And Connect APIs

- Copy the user-side Figma Make UI into `services/portal/frontend`.
- Copy `src/app/pages/AdminConsole.tsx` only as ZIP residue, keep it unmounted from `src/app/routes.tsx`, and do not count it as Admin UI completion.
- Replace static mock-only page state with typed Portal API adapters where existing `/portal/api/*` payloads exist: overview/resources/workspace/trace/billing/opl-launch all call `services/portal/frontend/src/api/portal/*.ts` through `/portal/api`.
- Keep no-secret browser hygiene: no raw API key, bearer token, launchToken, runtimeToken, objectKey, localPath, signedUrl or provider secret in public state, logs, evidence or git.
- Add loading, empty, degraded and error states per page where current APIs can expose them.
- Rebuild smoke expectations around Figma Make ZIP file-tree parity, React routes, API adapter wiring and physical old-file deletion.

## Deployment Path

- Run local dependency install/build/typecheck.
- Start local Vite preview or dev server on an available port.
- Provide the local URL.
- For true online deployment, stop and request explicit deploy authorization first.

## Acceptance Commands

```bash
git diff --check
node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs
node scripts/smoke-test-v22-portal-role-surface-boundaries.mjs
node scripts/smoke-test-v22-portal-files-billing-trace-flow.mjs
npm --prefix services/portal/frontend run typecheck
npm --prefix services/portal/frontend run build
node scripts/smoke-test-v22-portal-runtime-suite.mjs --group surface
```

If `node scripts/smoke-test-v22-mvp-contract-suite.mjs` is run and fails on an existing recovery/status gate unrelated to this work, record the exact failing gate instead of treating it as a Portal UI regression.
