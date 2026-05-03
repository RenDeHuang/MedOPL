import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dockerfile = readFileSync("deploy/tke-package/build/dockerfiles/opl-runtime-bridge.Dockerfile", "utf8");

assert.match(dockerfile, /COPY\s+source\/\.runtime\/one-person-lab-upstream\s+\.\/\.runtime\/one-person-lab-upstream/, "runtime bridge image must include upstream OPL runtime");
assert.match(dockerfile, /apt-get\s+install\s+-y\s+--no-install-recommends\s+ca-certificates/, "runtime bridge image must include native CA certificates for Codex HTTPS/WebSocket calls");
assert.match(dockerfile, /npm\s+install\s+-g\s+@openai\/codex@[0-9]+\.[0-9]+\.[0-9]+/, "runtime bridge image must provide a pinned Codex binary for ACP prompt");
assert.match(dockerfile, /OPL_CODEX_BIN=/, "runtime bridge image must set OPL_CODEX_BIN explicitly");

console.log(JSON.stringify({
  ok: true,
  checked: [
    "upstream_runtime_copied",
    "native_ca_certificates_available",
    "codex_binary_available",
    "opl_codex_bin_explicit",
  ],
}, null, 2));
