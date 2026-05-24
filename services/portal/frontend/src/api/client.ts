import axios from "axios";

export const apiClient = axios.create({
  baseURL: "/portal/api",
  timeout: 30000,
  withCredentials: true
});

export const goControlPlaneClient = axios.create({
  baseURL: "/api",
  timeout: 30000,
  withCredentials: true
});

let authRedirectStarted = false;

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error?.response?.data;
    const loginUrl = typeof data?.loginUrl === "string" && data.loginUrl ? data.loginUrl : "/login";
    if (error?.response?.status === 401 && data?.error === "unauthenticated" && !authRedirectStarted && typeof window !== "undefined") {
      authRedirectStarted = true;
      window.location.assign(loginUrl);
    }
    return Promise.reject(error);
  },
);
