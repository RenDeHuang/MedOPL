export function fileNameFrom(relativePath) {
  return String(relativePath || "").split(/[\\/]/).pop() || String(relativePath || "");
}

export function createWorkspaceUploadSupport({
  buildWorkspaceFileChecksum,
  buildWorkspaceStorageKey,
  guessContentType,
  mkdir,
  path,
  recordWorkspaceFile,
  safeRelativePath,
  stat,
  syncWorkspaceFileToUserStorage,
  writeFile,
}) {
  function readMultipartFiles(body, boundary) {
    const text = body.toString("binary");
    const parts = text.split(`--${boundary}`).filter((part) => part.includes("filename="));
    const files = [];
    for (const part of parts) {
      const filenameMatch = part.match(/filename="([^"]+)"/i);
      if (!filenameMatch) continue;
      const relativePath = safeRelativePath(filenameMatch[1]);
      if (!relativePath) continue;
      const contentTypeMatch = part.match(/Content-Type:\s*([^\r\n]+)/i);
      const splitIndex = part.indexOf("\r\n\r\n");
      if (splitIndex === -1) continue;
      const content = part.slice(splitIndex + 4, part.lastIndexOf("\r\n"));
      files.push({
        name: fileNameFrom(relativePath),
        relativePath,
        contentType: String(contentTypeMatch?.[1] || guessContentType(relativePath) || "application/octet-stream").trim(),
        buffer: Buffer.from(content, "binary"),
      });
    }
    return files;
  }

  async function persistWorkspaceUpload({ db, user, taskSpace, kind = "inputs", file }) {
    const normalizedKind = String(kind || "inputs").toLowerCase() === "outputs" ? "outputs" : "inputs";
    const targetDir = path.join(taskSpace.path, normalizedKind);
    const relativePath = safeRelativePath(file.relativePath || file.name || "");
    if (!relativePath) return { ok: false, status: 400, error: "invalid_relative_path" };
    const targetFile = path.join(targetDir, relativePath);
    await mkdir(path.dirname(targetFile), { recursive: true });
    await writeFile(targetFile, file.buffer);
    const meta = await stat(targetFile);
    const tenantId = user.tenantId || user.id;
    const recorded = recordWorkspaceFile(db, {
      tenantId,
      userId: user.id,
      workspaceId: taskSpace.slug,
      kind: normalizedKind,
      name: file.name || fileNameFrom(relativePath),
      relativePath,
      storageKey: file.storageTarget?.storageKey || buildWorkspaceStorageKey(tenantId, taskSpace.slug, normalizedKind, relativePath),
      localPath: file.storageTarget?.localPath || targetFile,
      sizeBytes: Number(meta.size || file.buffer.length || 0),
      checksum: buildWorkspaceFileChecksum(file.buffer),
      contentType: file.contentType || guessContentType(relativePath) || "application/octet-stream",
      status: "active",
      source: file.storageTarget?.source || "portal_upload",
      storageMode: file.storageTarget?.storageMode,
      storageRootPrefix: file.storageTarget?.rootPrefix,
      oplSessionId: file.storageTarget?.oplSessionId,
      resourceBindingId: file.storageTarget?.resourceBindingId,
    });
    await syncWorkspaceFileToUserStorage(user.id, taskSpace.slug, normalizedKind, targetFile, relativePath);
    return {
      ok: true,
      file: recorded.file,
      localPath: targetFile,
    };
  }

  return {
    persistWorkspaceUpload,
    readMultipartFiles,
  };
}
