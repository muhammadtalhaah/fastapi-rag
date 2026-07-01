import LNG from "./applicationLanguage";

const FALLBACK = "en";

// Resolve a string key for a given language, falling back to English per-key
// when a translation is missing, and finally to the key itself so a typo is
// visible rather than rendering "undefined". This is the single lookup used by
// the t() function the LanguageContext hands to components.
export const translate = (lang, key) => {
  const table = LNG[lang] || LNG[FALLBACK];
  return table[key] ?? LNG[FALLBACK][key] ?? key;
};
