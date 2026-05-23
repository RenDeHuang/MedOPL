# golden-path-productization-roadmap Design

## Architecture

This package is a roadmap truth package, not an implementation branch. It records the next six executable packages in repo-owned docs and durable specs so later agents can start from the repository instead of chat context.

The roadmap uses the existing MedOPL framework planes:

- Product Plane owns Figma UI absorption and user-visible golden path language.
- Integration Plane owns OPL entry preflight, launch and clean Gateway boundaries.
- Runtime Plane owns providerKeyRef projection, run, artifact and trace backflow.
- Operations Plane owns real-cloud authorization, billing, release and audit authorization.
- Framework owns change lifecycle, roadmap subscription, eval ordering and closeout.

## Data Flow

Future development flow:

```text
docs/active current cursor
-> changes/active/<roadmap-package>
-> specs delta
-> typed source/API boundary
-> local eval
-> review
-> archive
-> docs/history closeout
```

Runtime product flow remains:

```text
login / credit / provider key
-> open managed environment
-> launch OPL
-> upload file / task
-> run / artifact
-> billing / trace / audit
-> release / stop billing
```

## Failure Modes

- A future UI branch that copies Figma mock state without repo-native API wiring must fail review.
- A frontend package that bypasses typed API modules must fail review.
- Provider key launch that requires users to re-enter a previously bound key remains a product gap.
- OPL entry UI that displays local mock readiness as real preflight/launch state remains a product gap.
- Go backend presence alone does not make it canonical control plane.
- Real cloud remains fail-closed without explicit authorization.

## Surface Impact

- source: none in this package.
- docs: `docs/product/README.md`, `docs/delivery/README.md`, `docs/source/README.md`.
- specs: `specs/product/spec.md`, `specs/framework/spec.md`, `specs/source/spec.md`.
- tests: existing change package, spec traceability, golden path and review gates.
