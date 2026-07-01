import apiClient from "./client";
import { ENDPOINTS } from "./endpoints";

// HTTP layer only for the authenticated user's appearance settings. The route is
// scoped to the session (no id in the path), so these always read/write the
// caller's own preferences. CSRF on the PATCH is attached by the client
// transform automatically. See services/settingsService.js for DTO shaping.
const getSettings = () => apiClient.get(ENDPOINTS.USER_SETTINGS);

const updateSettings = (body) =>
  apiClient.patch(ENDPOINTS.USER_SETTINGS, body);

export default { getSettings, updateSettings };
