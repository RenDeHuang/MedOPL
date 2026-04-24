import { execFileSync } from "node:child_process";

const patch = JSON.stringify({
  spec: {
    type: "NodePort",
    ports: [
      { name: "tcp-model", port: 9003, protocol: "TCP", targetPort: 9003 },
      { name: "tcp-monitoring", port: 8081, protocol: "TCP", targetPort: 8081 },
      { name: "tcp-ui", port: 9090, protocol: "TCP", targetPort: 9090, nodePort: 30090 }
    ]
  }
});

execFileSync("kubectl", [
  "patch",
  "svc",
  "opencost",
  "-n",
  "opencost-system",
  "--type",
  "merge",
  "-p",
  patch
], { stdio: "inherit" });

execFileSync("kubectl", [
  "get",
  "svc",
  "opencost",
  "-n",
  "opencost-system",
  "-o",
  "wide"
], { stdio: "inherit" });

console.log(JSON.stringify({ ok: true, mode: "nodeport", ui: "http://127.0.0.1:30090" }, null, 2));
