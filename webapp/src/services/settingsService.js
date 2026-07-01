import { settingsApi, unwrap } from "@/api";

// DTO mapping between the backend settings shape (snake_case, theme included)
// and the client preference shape. The theme `mode` is owned by useTheme via its
// own localStorage key, so it round-trips through here too for cross-device sync.
function toClient(raw) {
  if (!raw) return null;
  return {
    theme: raw.theme, // "system" | "light" | "dark"
    accent: raw.accent,
    chatFont: raw.chat_font,
    language: raw.language,
  };
}

// Only send the keys the caller actually changed. Maps camelCase -> snake_case
// and drops undefined so a single-field update stays a single-field PATCH.
function toServer(prefs) {
  const body = {};
  if (prefs.theme !== undefined) body.theme = prefs.theme;
  if (prefs.accent !== undefined) body.accent = prefs.accent;
  if (prefs.chatFont !== undefined) body.chat_font = prefs.chatFont;
  if (prefs.language !== undefined) body.language = prefs.language;
  return body;
}

// Fetch the authenticated user's settings, or null if unauthenticated. A 401 is
// the expected "logged out" answer (we sync only for signed-in users), not an
// error to surface.
export async function getSettings() {
  const response = await settingsApi.getSettings();
  if (response.status === 401 || response.status === 403) return null;
  return toClient(unwrap(response));
}

// Persist a partial set of preference changes; returns the full resolved
// settings echoed back by the server.
export async function updateSettings(prefs) {
  const data = unwrap(await settingsApi.updateSettings(toServer(prefs)));
  return toClient(data);
}
