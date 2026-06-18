# docs-specs-index-only Design

## Architecture

`docs/specs/README.md` becomes a short index with owner, purpose, state, machine boundary, domain spec owner table and anchor pointers. Durable behavior remains in root `specs/**`, source and tests.

## Data Flow

Human reader starts at `docs/specs/README.md`, then follows domain links to root specs. Machine gates read root specs, fixtures, manifest, source and runner output directly.

## Failure Modes

- If a test needs stable data but only has prose, fail closed and move the assertion to the real owner.
- If a contract has no consumer, keep it as human index text rather than adding empty machine surface.

## Surface Impact

- source: no runtime source behavior change; one Runtime Bridge test now reads route/source owners.
- docs: `docs/specs/README.md` compacted to index-only.
- specs: product spec keeps existing commercial JSON blocks; framework/runtime/source specs carry durable assertions.
- tests: prose/JSON-coupled tests redirected to durable owners.
