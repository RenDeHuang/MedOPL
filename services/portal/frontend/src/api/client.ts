import axios from "axios";

export const apiClient = axios.create({
  baseURL: "/portal/api",
  timeout: 30000,
  withCredentials: true
});
