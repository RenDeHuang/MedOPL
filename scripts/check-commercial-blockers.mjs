const checks = [];

async function addCheck(name, fn) {
  try {
    const result = await fn();
    checks.push({ name, ok: true, detail: result || "ok" });
  } catch (error) {
    checks.push({ name, ok: false, detail: String(error) });
  }
}

await addCheck("portal-health", async () => {
  const res = await fetch("http://127.0.0.1:17080/healthz");
  if (!res.ok) throw new Error(`status=${res.status}`);
  return `status=${res.status}`;
});

await addCheck("portal-opl-adapter-health", async () => {
  const res = await fetch("http://127.0.0.1:8788/healthz");
  if (!res.ok) throw new Error(`status=${res.status}`);
  return `status=${res.status}`;
});

await addCheck("gateway-health", async () => {
  const res = await fetch("http://127.0.0.1:4413/healthz");
  if (!res.ok) throw new Error(`status=${res.status}`);
  return `status=${res.status}`;
});

await addCheck("opencost-ui", async () => {
  const res = await fetch("http://127.0.0.1:30090");
  if (!res.ok) throw new Error(`status=${res.status}`);
  return `status=${res.status}`;
});

await addCheck("harbor-ui", async () => {
  const res = await fetch("http://127.0.0.1:30095");
  if (!res.ok) throw new Error(`status=${res.status}`);
  return `status=${res.status}`;
});

await addCheck("minio-console", async () => {
  const res = await fetch("http://127.0.0.1:30092");
  if (!res.ok) throw new Error(`status=${res.status}`);
  return `status=${res.status}`;
});

await addCheck("rancher-ui", async () => {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const res = await fetch("https://127.0.0.1:30443");
  if (!res.ok) throw new Error(`status=${res.status}`);
  return `status=${res.status}`;
});

console.log(JSON.stringify({
  ok: checks.every((item) => item.ok),
  checks,
}, null, 2));
