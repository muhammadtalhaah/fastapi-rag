import { useCallback, useEffect, useMemo, useState } from "react";

// Appearance preferences that reskin the app the same way the theme does:
// each is reflected onto an attribute on <html> and CSS keys off it (see the
// [data-accent] / [data-font] rules in index.css). Language drives <html lang>
// and dir (RTL for ar/ur) and the in-app string table.
//
// localStorage is the source of truth for instant, offline, flash-free apply
// (the pre-paint script in index.html reads the same keys). The server sync
// layer (useSettingsSync) rehydrates these on login and writes back on change.
const DEFAULTS = { accent: "brass", chatFont: "serif", language: "en" };

const ACCENTS = new Set(["brass", "retrieval", "danger", "ink"]);
const FONTS = new Set(["serif", "sans", "mono"]);
const LANGUAGES = new Set(["en", "ur", "ar", "fr", "de"]);
const RTL_LANGUAGES = new Set(["ar", "ur"]);

const KEYS = {
  accent: "athenaeum-accent",
  chatFont: "athenaeum-font",
  language: "athenaeum-language",
};

const VALID = { accent: ACCENTS, chatFont: FONTS, language: LANGUAGES };

const read = (key, allowed, fallback) => {
  if (typeof window === "undefined") return fallback;
  try {
    const saved = window.localStorage.getItem(key);
    return allowed.has(saved) ? saved : fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Persistence is best-effort; ignore storage failures (privacy mode).
  }
};

// Apply a preference to the document. Accent/font are simple attributes; the
// language also sets `lang` and `dir` so RTL scripts lay out correctly.
const applyToDocument = (accent, chatFont, language) => {
  const root = document.documentElement;
  root.setAttribute("data-accent", accent);
  root.setAttribute("data-font", chatFont);
  root.setAttribute("lang", language);
  root.setAttribute("dir", RTL_LANGUAGES.has(language) ? "rtl" : "ltr");
};

export const usePreferences = () => {
  const [accent, setAccentState] = useState(() =>
    read(KEYS.accent, ACCENTS, DEFAULTS.accent),
  );
  const [chatFont, setChatFontState] = useState(() =>
    read(KEYS.chatFont, FONTS, DEFAULTS.chatFont),
  );
  const [language, setLanguageState] = useState(() =>
    read(KEYS.language, LANGUAGES, DEFAULTS.language),
  );

  // Reflect every preference onto <html> whenever any of them changes.
  useEffect(() => {
    applyToDocument(accent, chatFont, language);
  }, [accent, chatFont, language]);

  const setAccent = useCallback((value) => {
    if (!ACCENTS.has(value)) return;
    setAccentState(value);
    write(KEYS.accent, value);
  }, []);

  const setChatFont = useCallback((value) => {
    if (!FONTS.has(value)) return;
    setChatFontState(value);
    write(KEYS.chatFont, value);
  }, []);

  const setLanguage = useCallback((value) => {
    if (!LANGUAGES.has(value)) return;
    setLanguageState(value);
    write(KEYS.language, value);
  }, []);

  // Apply a batch of server-sourced values without persisting (the server is
  // already the origin). Each setter still re-validates and writes through to
  // localStorage so the local cache and the document stay in sync.
  const applyServerPreferences = useCallback(
    (prefs) => {
      if (!prefs) return;
      if (VALID.accent.has(prefs.accent)) setAccent(prefs.accent);
      if (VALID.chatFont.has(prefs.chatFont)) setChatFont(prefs.chatFont);
      if (VALID.language.has(prefs.language)) setLanguage(prefs.language);
    },
    [setAccent, setChatFont, setLanguage],
  );

  return useMemo(
    () => ({
      accent,
      chatFont,
      language,
      isRtl: RTL_LANGUAGES.has(language),
      setAccent,
      setChatFont,
      setLanguage,
      applyServerPreferences,
    }),
    [
      accent,
      chatFont,
      language,
      setAccent,
      setChatFont,
      setLanguage,
      applyServerPreferences,
    ],
  );
};
