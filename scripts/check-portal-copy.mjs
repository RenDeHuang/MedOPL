import { readFile } from "node:fs/promises";
import path from "node:path";

const file = path.resolve(process.cwd(), "services", "portal", "src", "server.mjs");
const source = await readFile(file, "utf8");

const suspicious = [
  "\u7f01\u719a\u4e00\u95c2\u310f\u57db",
  "\u9438\u8bf2\u7dbf\u9304",
  "\u5a34\u72b1\u8bd5",
  "\u95bb\u72b3\u52a7\u7ba1",
  "\u93c3\u72b4\u6f08\u6a29",
  "\u93c8\u4e81\u58d8\u9352"
];

const hits = suspicious.filter((item) => source.includes(item));

if (hits.length > 0) {
  console.error(JSON.stringify({ ok: false, hits }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, file }, null, 2));
