# go-control-plane-mvp-takeover Proposal

Status: authoring
Branch: feat/v22-go-control-plane-mvp-takeover
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Platform
Affected plane: Product | Integration | Runtime | Operations

## Why

The local golden path is blocked from moving into real-cloud readiness while Node Portal backend still owns control-plane business truth. MedOPL now chooses to delay cloud migration and make `services/medopl-go-backend` the local MVP control-plane backend first.

## Goals

- Make Go the local MVP takeover target for Portal typed API, package/subscription/entitlement, OPL launch projection, billing/audit/resource workflow and release.
- Make `services/portal/frontend` a modern separated frontend that talks to Go-owned typed API.
- Retire `services/portal/src` business truth without keeping a long-term Node compatibility control plane.
- Keep real cloud, provider operation, deploy, kubectl, build/push and live-test out of this package.

## Non-Goals

- Do not read secrets, `.env`, provider keys, kubeconfig, tokens or SSH private keys.
- Do not call real cloud, real provider APIs, Langfuse, COS or production APIs.
- Do not run deploy, kubectl, build/push image work, live-test or true cloud mutation.
- Do not modify `deploy/*`, `.sentrux/*`, `adapters/*`, `infra/*` or one-person-lab upstream.
- Do not preserve Node Portal backend as a second control plane or compatibility layer.

## Golden Path Impact

- improves: this package makes the default golden path depend on a single Go control-plane API before cloud readiness.
- affected steps: login/account projection, credit/package/subscription, provider key projection, OPL launch, upload/task/run/artifact, billing/trace/audit and release.
- required golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`.

## Authorization Boundary

- This is local deterministic implementation and documentation cleanup only.
- Real cloud readiness starts only after Go local RC passes and a separate package is opened.
- Local proof cannot be upgraded into production, live provider or real-cloud evidence.

## Subscribed Truth

- `AGENTS.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/framework/README.md`
- `docs/source/README.md`
- `docs/specs/README.md`
- `docs/evidence/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `specs/source/spec.md`
- `specs/runtime/spec.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
