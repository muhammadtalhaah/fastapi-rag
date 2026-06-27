// Derive avatar initials from a display name. Takes the first letter of the
// first two words, uppercased — "Muhammad Talha" → "MT", "Ada" → "A". Returns a
// fallback (default "?") when the name is missing or has no letters, so the
// avatar always renders something.
export function getInitials(name, fallback = "?") {
  if (!name || typeof name !== "string") return fallback;
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return fallback;
  const initials = words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return initials || fallback;
}
