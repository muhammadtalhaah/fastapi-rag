import { profileApi, unwrap } from "@/api";

// DTO mapping between the backend profile shape (snake_case) and the client
// shape used by the auth `user` object. The profile endpoints return the same
// field set as /auth/me (minus the hash), so the mapping mirrors authService's
// toUser — kept here too so this module is self-contained.
function toClient(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    profileUrl: raw.profile_url ?? null,
    nickname: raw.nickname ?? "",
    work: raw.work ?? "",
    instructions: raw.instructions ?? "",
  };
}

// Only send the keys the caller actually changed, camelCase -> snake_case, so a
// single-field save stays a single-field PATCH and never clobbers the others.
function toServer(prefs) {
  const body = {};
  if (prefs.name !== undefined) body.name = prefs.name;
  if (prefs.nickname !== undefined) body.nickname = prefs.nickname;
  if (prefs.work !== undefined) body.work = prefs.work;
  if (prefs.instructions !== undefined) body.instructions = prefs.instructions;
  return body;
}

// Fetch the authenticated user's profile, or null if unauthenticated.
export async function getProfile() {
  const response = await profileApi.getProfile();
  if (response.status === 401 || response.status === 403) return null;
  return toClient(unwrap(response));
}

// Persist a partial set of profile changes; returns the full resolved profile.
export async function updateProfile(prefs) {
  return toClient(unwrap(await profileApi.updateProfile(toServer(prefs))));
}

// Assign a fresh random avatar; returns the full resolved profile with the new
// profileUrl.
export async function shuffleAvatar() {
  return toClient(unwrap(await profileApi.shuffleAvatar()));
}
