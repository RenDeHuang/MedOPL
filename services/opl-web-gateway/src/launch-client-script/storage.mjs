export const STORAGE_SECTION = `function readStoredState() {
  try {
    const raw = window.sessionStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStoredState(state) {
  try {
    window.sessionStorage.setItem(STATE_KEY, JSON.stringify(publicLaunchState(state)));
  } catch {}
}

function readStoredBootstrap() {
  try {
    const raw = window.sessionStorage.getItem(BOOTSTRAP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredBootstrap(bootstrap) {
  try {
    window.sessionStorage.setItem(BOOTSTRAP_KEY, JSON.stringify(publicBootstrapPayload(bootstrap)));
  } catch {}
}`;
