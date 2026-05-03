import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const { createZipFromDir } = await import("../services/portal/src/lib/zip-archive.mjs");

function readUInt32LE(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

function readUInt16LE(buffer, offset) {
  return buffer.readUInt16LE(offset);
}

function findEndOfCentralDirectory(buffer) {
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (readUInt32LE(buffer, offset) === 0x06054b50) return offset;
  }
  throw new Error("zip_eocd_missing");
}

function readCentralDirectoryEntries(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = readUInt16LE(buffer, eocdOffset + 10);
  const directorySize = readUInt32LE(buffer, eocdOffset + 12);
  const directoryOffset = readUInt32LE(buffer, eocdOffset + 16);
  const entries = [];
  let offset = directoryOffset;
  while (entries.length < entryCount) {
    assert.equal(readUInt32LE(buffer, offset), 0x02014b50, "central_directory_signature_mismatch");
    const compressionMethod = readUInt16LE(buffer, offset + 10);
    const compressedSize = readUInt32LE(buffer, offset + 20);
    const uncompressedSize = readUInt32LE(buffer, offset + 24);
    const fileNameLength = readUInt16LE(buffer, offset + 28);
    const extraLength = readUInt16LE(buffer, offset + 30);
    const commentLength = readUInt16LE(buffer, offset + 32);
    const localHeaderOffset = readUInt32LE(buffer, offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    entries.push({ name, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  assert.equal(offset - directoryOffset, directorySize, "central_directory_size_mismatch");
  return entries;
}

function readStoredFile(buffer, entry) {
  const offset = entry.localHeaderOffset;
  assert.equal(readUInt32LE(buffer, offset), 0x04034b50, "local_file_signature_mismatch");
  const fileNameLength = readUInt16LE(buffer, offset + 26);
  const extraLength = readUInt16LE(buffer, offset + 28);
  const dataOffset = offset + 30 + fileNameLength + extraLength;
  return buffer.subarray(dataOffset, dataOffset + entry.compressedSize);
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "portal-zip-archive-"));
try {
  const sourceDir = path.join(tempRoot, "source");
  const outFile = path.join(tempRoot, "workspace-inputs.zip");
  await mkdir(path.join(sourceDir, "nested"), { recursive: true });
  await writeFile(path.join(sourceDir, "input.txt"), "hello portal zip\n", "utf8");
  await writeFile(path.join(sourceDir, "nested", "result.json"), "{\"ok\":true}\n", "utf8");

  await createZipFromDir(sourceDir, outFile);

  const archive = await readFile(outFile);
  const entries = readCentralDirectoryEntries(archive);
  assert.deepEqual(entries.map((item) => item.name), ["input.txt", "nested/result.json"], "zip_entries_must_be_sorted_relative_paths");
  assert.ok(entries.every((item) => item.compressionMethod === 0), "zip_entries_must_use_portable_store_method");
  assert.equal(readStoredFile(archive, entries[0]).toString("utf8"), "hello portal zip\n", "first_entry_content_mismatch");
  assert.equal(readStoredFile(archive, entries[1]).toString("utf8"), "{\"ok\":true}\n", "nested_entry_content_mismatch");

  console.log(JSON.stringify({
    ok: true,
    contract: "portal_zip_archive",
    entries: entries.map((item) => item.name),
  }, null, 2));
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
