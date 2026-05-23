# golden-path-first-class Design

## Architecture

This change keeps the existing framework taxonomy and makes the product golden path the first-class default spine:

- Product docs define the spine and its can-claim / cannot-claim boundary.
- Framework docs make Golden Path Impact part of admission.
- Change package docs and gate require Golden Path Impact in every active/archive package.
- Verify manifest and current cursor show golden path health before governance guardrails.
- Portal runtime source debt is handled by extracting local helper glue from the entrypoint into an adjacent app module.

## Data Flow

Default verification flow:

```text
golden smoke suite
-> local product/runtime regression proof
-> governance guardrails
-> repo hygiene / review gates
```

Change package flow:

```text
proposal Golden Path Impact
-> spec delta target
-> eval plan evidence level
-> implementation
-> verify
-> review
-> closeout / archive
```

Source debt flow:

```text
baseline fan-out metric
-> narrow helper extraction
-> portal check / runtime regression
-> structure metric comparison
```

## Failure Modes

- Missing Golden Path Impact fails change-package lifecycle.
- Default current verification missing golden smoke first fails agent verify entrypoint / framework gate.
- Governance commands remain required; moving them after product health must not remove them from local contract or review suites.
- Portal runtime extraction must not introduce new dependencies, circular imports, secret reads or fallback behavior.

## Surface Impact

- source: `services/portal/src/app/portal-runtime.mjs`, adjacent Portal app helper module.
- docs: `docs/product/README.md`, `docs/active/README.md`, `docs/framework/README.md`, `changes/README.md`.
- specs: `specs/product/spec.md`, `specs/framework/spec.md`, `specs/source/spec.md`.
- tests: change-package lifecycle, agent verify entrypoint, manifest/current verification tests.
