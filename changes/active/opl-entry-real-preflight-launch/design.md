# opl-entry-real-preflight-launch Design

OPL entry must treat backend preflight / launch / launch-status payloads as the product state boundary. The frontend may render loading, ready and blocked states, but it cannot invent provider readiness, Gateway readiness, runtime session or upstream URL truth when backend projections are missing.

The package is intentionally local. It uses deterministic Portal, Gateway and Runtime Bridge regressions to close UI/API shape and secret hygiene; it does not call a real provider or real cloud.

Required design constraints:

- OPLEntry uses typed API helpers and normalized app adapters for launch state.
- provider key reuse happens only in backend secret boundary and public UI sees only `providerKeyRef` / bound status.
- launch token and runtime token may be represented only in HttpOnly cookie or backend-only state, never URL query, browser storage, public payload or frontend global state.
- Gateway / upstream unavailable cases fail closed with user-visible reason.
- local eval can prove contract shape only; it cannot become production evidence.
