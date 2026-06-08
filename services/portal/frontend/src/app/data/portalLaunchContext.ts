export function currentLaunchId() {
  const launchId = new URLSearchParams(window.location.search).get("launchId");
  return typeof launchId === "string" && launchId.trim() ? launchId.trim() : "";
}
