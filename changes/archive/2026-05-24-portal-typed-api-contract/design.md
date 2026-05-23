# portal-typed-api-contract Design

Portal pages must treat `services/portal/frontend/src/api/portal/**` and app data adapters as the contract boundary. Backend route payloads remain the control-plane projection source; frontend components render normalized DTOs and fail closed when required fields are unavailable.

This package is intentionally narrower than visual design work. It does not redesign the Figma-absorbed UI, and it does not move backend ownership to Go. It closes the API/data boundary so later OPL entry and Go takeover packages can replace implementation behind the same typed contract.

Required design constraints:

- page components do not invent readiness, billing, resource or launch truth when a backend projection is missing
- API modules do not store raw provider keys, launch tokens, runtime tokens or secret paths
- OPL entry provider state is rendered from backend projection fields and remains a follow-up gap if still partially synthesized
- contract tests and frontend typecheck are the acceptance boundary
