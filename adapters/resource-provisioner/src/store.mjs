import { mkdir, readFile, writeFile } from "node:fs/promises";
import { runtimeRoot, ordersFile } from "./config.mjs";

export async function readOrders() {
  try {
    return JSON.parse(await readFile(ordersFile, "utf8"));
  } catch {
    return { orders: [] };
  }
}

export async function writeOrders(state) {
  await mkdir(runtimeRoot, { recursive: true });
  await writeFile(ordersFile, JSON.stringify(state, null, 2), "utf8");
}
