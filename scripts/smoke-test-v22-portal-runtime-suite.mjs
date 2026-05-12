import { spawn } from "node:child_process";

const groups = new Map([
  ["contract", [
    "scripts/smoke-test-v22-portal-workbench-management-ui-composition-contract.mjs",
    "scripts/smoke-test-v22-portal-role-surface-boundaries.mjs",
    "scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs",
  ]],
  ["api", [
    "scripts/smoke-test-v22-portal-workbench-management-ui-api.mjs",
    "scripts/smoke-test-v22-portal-api-auth-boundary.mjs",
    "scripts/smoke-test-v22-portal-web-route-alignment.mjs",
  ]],
  ["build", [
    "services/portal:check",
    "services/portal:frontend:typecheck",
    "services/portal:frontend:build",
  ]],
  ["browser", [
    "scripts/smoke-test-v22-portal-workbench-management-ui-browser.mjs",
  ]],
]);

function argValue(name) {
  const prefix = `${name}=`;
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex !== -1) return process.argv[exactIndex + 1] || "";
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : "";
}

function unique(items) {
  return [...new Set(items)];
}

function selectedTasks() {
  const group = argValue("--group") || "all";
  if (group === "all") {
    return unique([...groups.values()].flat());
  }
  if (!groups.has(group)) {
    throw new Error(`unknown_group:${group}`);
  }
  return groups.get(group);
}

function runCommand(task) {
  const separatorIndex = task.indexOf(":");
  const command = task.endsWith(".mjs")
    ? [process.execPath, [task]]
    : ["npm", ["--prefix", task.slice(0, separatorIndex), "run", task.slice(separatorIndex + 1)]];
  return new Promise((resolve) => {
    const child = spawn(command[0], command[1], {
      cwd: process.cwd(),
      stdio: "inherit",
      shell: false,
    });
    child.on("exit", (code) => resolve(code || 0));
  });
}

const tasks = selectedTasks();
const passed = [];
for (const task of tasks) {
  const code = await runCommand(task);
  if (code !== 0) {
    console.error(JSON.stringify({
      ok: false,
      failedTask: task,
      passed,
    }, null, 2));
    process.exit(code);
  }
  passed.push(task);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_runtime_suite",
  passed,
}, null, 2));
