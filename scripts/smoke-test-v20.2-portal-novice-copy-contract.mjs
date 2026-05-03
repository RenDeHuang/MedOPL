#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const targets = [
  "services/portal/frontend/src/layouts/AppSidebar.vue",
  "services/portal/frontend/src/router/index.ts",
  "services/portal/frontend/src/views/overview/OverviewView.vue",
  "services/portal/frontend/src/views/packages/PackagesView.vue",
  "services/portal/frontend/src/views/workspace/WorkspaceView.vue",
  "services/portal/frontend/src/views/billing/BillingView.vue",
  "services/portal/frontend/src/views/trace/TraceView.vue",
];

const forbiddenPatterns = [
  { label: "K8s", regex: /\bk8s\b/i },
  { label: "Kubernetes", regex: /\bkubernetes\b/i },
  { label: "CVM", regex: /\bcvm\b/i },
  { label: "TKE", regex: /\btke\b/i },
  { label: "COS", regex: /\bcos\b/i },
  { label: "node pool", regex: /\bnode\s*pool\b/i },
  { label: "对象存储开通", regex: /对象存储开通/ },
];

const errors = [];

for (const relativePath of targets) {
  const absolutePath = path.resolve(repoRoot, relativePath);
  const content = await readFile(absolutePath, "utf8");
  const lines = content.split(/\r?\n/);
  for (const rule of forbiddenPatterns) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (rule.regex.test(line)) {
        errors.push(`${relativePath}:${index + 1} 命中禁词「${rule.label}」`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error("[FAIL] v20.2 portal novice copy contract 未通过");
  for (const item of errors) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("[PASS] v20.2 portal novice copy contract 通过");
