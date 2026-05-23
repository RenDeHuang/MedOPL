# golden-path-productization-roadmap Tasks

- [x] Step 0: baseline audit trunk truth, active cursor, product/source/delivery docs and frontend/backend surfaces.
- [x] Step 1: create active roadmap change package with Golden Path Impact and authorization boundary.
- [x] Step 2: sync product, delivery and source truth with the six-package productization order.
- [x] Step 3: sync durable specs with roadmap, Figma absorption and Go takeover order.
- [x] Step 4: run local deterministic evals.
- [ ] Step 5: self-review, independent review, closeout and commit.

## Roadmap Packages

1. `figma-portal-ui-absorption`: absorb Figma Make visual/information architecture into repo-native React/Vite frontend source with typed fixtures/API boundaries.
2. `portal-typed-api-contract`: make frontend API modules and backend response shapes the typed contract between Portal UI and control plane.
3. `provider-key-reuse`: allow OPL launch/preflight to reuse an already bound user `providerKeyRef` without requiring inline provider key payload.
4. `opl-entry-real-preflight-launch`: make OPL entry UI render real preflight, launch, providerKeyRef and Gateway readiness state.
5. `go-control-plane-takeover`: migrate canonical MedOPL control-plane business truth to Go in bounded packages.
6. `real-cloud-authorization`: execute cloud/provider/deploy work only after explicit authorization and evidence routing.
