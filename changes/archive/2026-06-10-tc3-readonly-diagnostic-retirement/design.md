Owner: `MedOPL`
Purpose: `design`
State: `active_change`
Machine boundary: The cleanup is enforced by static contract tests and runner source inspection.

# Design

The cleanup is intentionally static and narrow.

`tests/support/cloud-prework/tencent-readonly-inventory-support.js` already supports only:

- `fake-readonly`
- `tencent-official-sdk-readonly`

This branch records that as the active contract and prevents TC3 live bridge flags from returning.

The cleanup test reads the runner source and fails if any of the following reappear:

- `tencent-tc3-readonly`
- `--enable-real-fetch`
- `enableRealFetch`

No cloud SDK behavior changes are made.
