import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const checkedFiles = [
  "docs/contracts/v22-user-credit-provider-key-boundary.md",
  "docs/contracts/v22-token-provider-boundary.md",
  "docs/contracts/v22-mvp-managed-opl-loop.md",
  "docs/contracts/README.md",
  "docs/recovery/v22-truth-freeze.md",
  "docs/recovery/decisions.md",
  "docs/recovery/product-truth.md",
  "docs/recovery/architecture-truth.md",
  "docs/recovery/status-matrix.md",
];

const requiredTruths = [
  "portal.medopl.cn 登录不需要 gflabtoken API Key",
  "opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key",
  "API Key 输入框放在 OPL 登录页密码下面",
  "gflabtoken.cn 网站本身不进入 MedOPL 用户主流程",
];

const forbiddenNarratives = [
  ["用户在 Portal 绑定", "gflabtoken API key"].join(" "),
  ["用户在 Portal 绑定", "gflabtoken API Key"].join(" "),
  ["Portal 登录需要", "API Key"].join(" "),
  ["portal.medopl.cn 登录需要", "gflabtoken"].join(" "),
  ["gflabtoken.cn 进入", "MedOPL 主流程"].join(" "),
];

const contents = await Promise.all(checkedFiles.map(async (filePath) => {
  const content = await readFile(path.join(repoRoot, filePath), "utf8");
  return { filePath, content };
}));

const corpus = contents.map(({ content }) => content).join("\n");

for (const truth of requiredTruths) {
  assert(corpus.includes(truth), `gflabtoken_entry_truth_missing:${truth}`);
}

for (const { filePath, content } of contents) {
  for (const forbidden of forbiddenNarratives) {
    assert.equal(content.includes(forbidden), false, `gflabtoken_entry_old_narrative:${filePath}:${forbidden}`);
  }
}

assert(corpus.includes("Portal 可以展示“是否已绑定”状态"), "portal_bound_status_truth_missing");
assert(corpus.includes("API Key 不是 Portal 普通登录字段"), "portal_login_field_boundary_missing");
assert(corpus.includes("raw API Key 只能进入后端密钥边界"), "raw_key_backend_boundary_missing");
assert(corpus.includes("不能返回前端、不能写日志、不能进 git"), "raw_key_no_leakage_boundary_missing");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_gflabtoken_entry_contract",
  checkedFiles,
}, null, 2));
