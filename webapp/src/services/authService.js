import { authApi, unwrap } from "@/api";

// Map a backend user payload ({id, name, email}) to the client shape. The
// backend never returns the password hash, so there's nothing to strip here.
function toUser(raw) {
  if (!raw) return null;
  return { id: raw.id, name: raw.name, email: raw.email, profileUrl: raw.profile_url ?? null };
}

// Log in with email + password. On success the backend sets the session and
// CSRF cookies; we just return the user. Errors bubble up via unwrap() as
// thrown Errors with human-readable messages (e.g. "Invalid credentials",
// or the 429 lockout message).
export async function login(email, password) {
  const data = unwrap(await authApi.login(email, password));
  return toUser(data?.user);
}

// Best-effort logout. CSRF-protected server-side; the client transform attaches
// the header automatically. We swallow errors so a flaky logout still clears
// local auth state (the caller resets regardless).
export async function logout() {
  try {
    unwrap(await authApi.logout());
  } catch {
    // ignore — local state is cleared by the caller either way
  }
}

// Begin the Google OAuth flow by navigating the whole page to the backend's
// start URL. Control leaves the SPA until the backend redirects the browser
// back (with the session cookie set), at which point AuthContext re-checks /me.
export function startGoogleLogin() {
  window.location.assign(authApi.googleLoginUrl());
}

// Resolve the current user from the session cookie, or null if unauthenticated.
// A 401 is the expected "logged out" signal, not an error to surface — return
// null so callers treat it as anonymous.
export async function getMe() {
  const response = await authApi.getMe();
  if (response.status === 401 || response.status === 403) return null;
  return toUser(unwrap(response));
}
