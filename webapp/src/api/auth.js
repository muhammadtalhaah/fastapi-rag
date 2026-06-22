import apiClient from "./client";
import { ENDPOINTS } from "./endpoints";

// HTTP layer only. The session + CSRF cookies are managed by the browser
// (withCredentials) and the client-side CSRF transform — nothing token-related
// is handled here. See services/authService.js for response shaping.
const login = (email, password) =>
  apiClient.post(ENDPOINTS.AUTH_LOGIN, { email, password });

const logout = () => apiClient.post(ENDPOINTS.AUTH_LOGOUT);

const getMe = () => apiClient.get(ENDPOINTS.AUTH_ME);

// Absolute URL to start the Google OAuth flow. This is a full-page browser
// navigation (not an XHR) — the browser must follow Google's redirects and land
// back on the SPA with cookies set, so it has to target the real backend origin
// rather than a relative path. Falls back to same-origin (dev proxy) if no base
// URL is configured.
const googleLoginUrl = () => {
  const base = import.meta.env.VITE_API_BASE_URL || "";
  return `${base}${ENDPOINTS.AUTH_GOOGLE_LOGIN}`;
};

export default { login, logout, getMe, googleLoginUrl };
