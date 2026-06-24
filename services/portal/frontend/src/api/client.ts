import axios from "axios";

export const goControlPlaneClient = axios.create({
  baseURL: "/api",
  timeout: 30000,
  withCredentials: true
});

let authRedirectStarted = false;

function cookieValue(name: string) {
  if (typeof document === "undefined") return "";
  const encodedName = `${encodeURIComponent(name)}=`;
  const item = document.cookie.split("; ").find((entry) => entry.startsWith(encodedName));
  if (!item) return "";
  return decodeURIComponent(item.slice(encodedName.length));
}

goControlPlaneClient.interceptors.request.use((request) => {
  const csrf = cookieValue("medopl_csrf");
  if (csrf) {
    request.headers.set("X-MedOPL-CSRF", csrf);
  }
  return request;
});

goControlPlaneClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error?.response?.data;
    const loginUrl = typeof data?.loginUrl === "string" && data.loginUrl ? data.loginUrl : "/";
    if (error?.response?.status === 401 && data?.error === "unauthenticated" && !authRedirectStarted && typeof window !== "undefined") {
      authRedirectStarted = true;
      window.location.assign(loginUrl);
    }
    return Promise.reject(error);
  },
);
