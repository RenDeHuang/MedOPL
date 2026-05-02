import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("scripts/live-test-v19-cos-exact-bill-reconcile.mjs", "utf8");

assert.match(
  source,
  /COS_LIVE_HTTP_TRANSPORT/,
  "cos exact bill live gate must expose an explicit HTTP transport selector",
);
assert.match(
  source,
  /kubectl_exec/,
  "cos exact bill live gate must support kubectl_exec transport for cluster-internal billing calls",
);
assert.match(
  source,
  /COS_LIVE_KUBECTL_BIN/,
  "kubectl_exec transport must make kubectl binary explicit",
);
assert.match(
  source,
  /COS_LIVE_KUBECONFIG/,
  "kubectl_exec transport must make kubeconfig explicit",
);
assert.match(
  source,
  /COS_LIVE_KUBE_SERVER_OVERRIDE/,
  "kubectl_exec transport must support the TKE API server override",
);
assert.match(
  source,
  /COS_LIVE_KUBE_INSECURE_SKIP_TLS_VERIFY/,
  "kubectl_exec transport must support explicit TLS bypass for the current TKE LB endpoint",
);
assert.match(
  source,
  /COS_LIVE_BILLING_DEPLOYMENT/,
  "kubectl_exec transport must make the billing deployment explicit",
);
assert.match(
  source,
  /COS_LIVE_BILLING_NAMESPACE/,
  "kubectl_exec transport must make the billing namespace explicit",
);
assert.match(
  source,
  /normalizeKubeconfigForKubectl/,
  "kubectl_exec transport must normalize WSL kubeconfig paths for kubectl.exe",
);
assert.match(
  source,
  /execFileAsync/,
  "kubectl_exec transport must call kubectl without shell interpolation",
);
assert.match(
  source,
  /"wget"[\s\S]*"-qO-"/,
  "kubectl_exec transport must use in-cluster HTTP without local port-forwarding",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v19_cos_live_kubectl_transport",
}, null, 2));
