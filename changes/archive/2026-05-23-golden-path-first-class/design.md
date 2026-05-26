# golden-path-first-class Design

## Architecture

This change keeps the existing framework taxonomy and makes the product golden path the first-class default spine:

- Product docs define the spine and its can-claim / cannot-claim boundary.
- Framework docs make Golden Path Impact part of admission.
- Change package docs and gate require Golden Path Impact in every active/archive package.
- Verify manifest and current cursor show golden path health before governance guardrails.
- Source boundary debt is handled by keeping Node Portal backend out of the active control-plane surface and verifying Go-owned API boundaries.

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

Source boundary flow:

```text
Node backend physical absence
-> Portal frontend uses Go /api
-> Go control-plane owns typed local API
-> physical-removal and zero-compat gates
```

## Failure Modes

- Missing Golden Path Impact fails change-package lifecycle.
- Default current verification missing golden smoke first fails agent verify entrypoint / framework gate.
- Governance commands remain required; moving them after product health must not remove them from local contract or review suites.
- Node backend physical removal must not reintroduce a shell, facade, compatibility control plane, secret read or fallback behavior.

## Surface Impact

- source: `services/portal/frontend`, `services/medopl-go-backend`, and Node backend physical-removal guardrails.
- docs: `docs/product/README.md`, `docs/active/README.md`, `docs/framework/README.md`, `changes/README.md`.
- specs: `specs/product/spec.md`, `specs/framework/spec.md`, `specs/source/spec.md`.
- tests: change-package lifecycle, agent verify entrypoint, manifest/current verification tests.
