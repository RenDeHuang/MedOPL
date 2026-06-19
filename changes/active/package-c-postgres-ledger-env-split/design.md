# package-c-postgres-ledger-env-split Design

Keep `package-c-postgres-ledger-sink.js` as the public sink and CLI owner. Move env parsing, allowlist validation and redaction helpers to `package-c-postgres-ledger-env.js`; re-export stable helpers from the sink so active consumers do not need compatibility wrappers.
