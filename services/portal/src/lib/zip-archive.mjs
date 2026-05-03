import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const CRC32_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  return value >>> 0;
});

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value = CRC32_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  return {
    date: ((year - 1980) << 9) | (month << 5) | day,
    time: (hours << 11) | (minutes << 5) | seconds,
  };
}

function uint32(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`${label}_out_of_zip32_range`);
  }
  return value;
}

async function listFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(rootDir, absolutePath));
      continue;
    }
    if (!entry.isFile()) continue;
    const relativePath = path.relative(rootDir, absolutePath).split(path.sep).join("/");
    if (!relativePath || relativePath.startsWith("../") || path.isAbsolute(relativePath)) {
      throw new Error("zip_entry_path_invalid");
    }
    files.push({ absolutePath, relativePath });
  }
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function localFileHeader({ nameBuffer, checksum, size, modified }) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(modified.time, 10);
  header.writeUInt16LE(modified.date, 12);
  header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(size, 18);
  header.writeUInt32LE(size, 22);
  header.writeUInt16LE(nameBuffer.length, 26);
  header.writeUInt16LE(0, 28);
  return header;
}

function centralDirectoryHeader({ nameBuffer, checksum, size, modified, localHeaderOffset }) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(modified.time, 12);
  header.writeUInt16LE(modified.date, 14);
  header.writeUInt32LE(checksum, 16);
  header.writeUInt32LE(size, 20);
  header.writeUInt32LE(size, 24);
  header.writeUInt16LE(nameBuffer.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(localHeaderOffset, 42);
  return header;
}

function endOfCentralDirectory({ entryCount, centralDirectorySize, centralDirectoryOffset }) {
  const header = Buffer.alloc(22);
  header.writeUInt32LE(0x06054b50, 0);
  header.writeUInt16LE(0, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(entryCount, 8);
  header.writeUInt16LE(entryCount, 10);
  header.writeUInt32LE(centralDirectorySize, 12);
  header.writeUInt32LE(centralDirectoryOffset, 16);
  header.writeUInt16LE(0, 20);
  return header;
}

export async function createZipFromDir(sourceDir, outFile) {
  const sourceStat = await stat(sourceDir);
  if (!sourceStat.isDirectory()) throw new Error("zip_source_must_be_directory");

  const files = await listFiles(sourceDir);
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const data = await readFile(file.absolutePath);
    const fileStat = await stat(file.absolutePath);
    const nameBuffer = Buffer.from(file.relativePath, "utf8");
    const size = uint32(data.length, "zip_file_size");
    const checksum = crc32(data);
    const modified = dosDateTime(fileStat.mtime);
    const localHeaderOffset = uint32(offset, "zip_local_header_offset");
    const localHeader = localFileHeader({ nameBuffer, checksum, size, modified });
    localParts.push(localHeader, nameBuffer, data);
    offset = uint32(offset + localHeader.length + nameBuffer.length + data.length, "zip_local_data_offset");
    centralParts.push(centralDirectoryHeader({ nameBuffer, checksum, size, modified, localHeaderOffset }), nameBuffer);
  }

  const centralDirectoryOffset = uint32(offset, "zip_central_directory_offset");
  const centralDirectorySize = uint32(centralParts.reduce((sum, part) => sum + part.length, 0), "zip_central_directory_size");
  if (files.length > 0xffff) throw new Error("zip_entry_count_out_of_range");

  const archive = Buffer.concat([
    ...localParts,
    ...centralParts,
    endOfCentralDirectory({
      entryCount: files.length,
      centralDirectorySize,
      centralDirectoryOffset,
    }),
  ]);

  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, archive);
}
