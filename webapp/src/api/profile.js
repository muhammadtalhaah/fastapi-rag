import apiClient from "./client";
import { ENDPOINTS } from "./endpoints";

// HTTP layer only for the authenticated user's editable profile (nickname, work,
// instructions, avatar). Routes are scoped to the session — no id in the path —
// so these always read/write the caller's own record. CSRF on the mutating
// calls is attached by the client transform automatically. See
// services/profileService.js for DTO shaping.
const getProfile = () => apiClient.get(ENDPOINTS.USER_PROFILE);

const updateProfile = (body) => apiClient.patch(ENDPOINTS.USER_PROFILE, body);

// Ask the backend to assign a fresh random avatar URL and persist it.
const shuffleAvatar = () => apiClient.post(ENDPOINTS.USER_AVATAR_SHUFFLE);

export default { getProfile, updateProfile, shuffleAvatar };
