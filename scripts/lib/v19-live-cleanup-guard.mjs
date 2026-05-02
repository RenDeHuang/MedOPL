export async function runWithRequiredCleanup({
  collect,
  validate,
  cleanup,
  runAfterCleanup,
} = {}) {
  if (typeof collect !== "function") throw new Error("cleanup_guard_collect_required");
  if (typeof validate !== "function") throw new Error("cleanup_guard_validate_required");
  if (typeof cleanup !== "function") throw new Error("cleanup_guard_cleanup_required");

  const state = await collect();
  let validation;
  let primaryError = null;
  try {
    validation = await validate(state);
  } catch (error) {
    primaryError = error;
  }

  let cleanupResult;
  let cleanupError = null;
  try {
    cleanupResult = await cleanup(state);
  } catch (error) {
    cleanupError = error;
  }

  let afterCleanupResult;
  let afterCleanupError = null;
  if (typeof runAfterCleanup === "function") {
    try {
      afterCleanupResult = await runAfterCleanup(state, cleanupResult);
    } catch (error) {
      afterCleanupError = error;
    }
  }

  if (primaryError) {
    primaryError.cleanupResult = cleanupResult;
    primaryError.cleanupError = cleanupError;
    primaryError.afterCleanupResult = afterCleanupResult;
    primaryError.afterCleanupError = afterCleanupError;
    throw primaryError;
  }
  if (cleanupError) throw cleanupError;
  if (afterCleanupError) throw afterCleanupError;
  return { state, validation, cleanupResult, afterCleanupResult };
}
