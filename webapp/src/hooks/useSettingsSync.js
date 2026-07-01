import { useEffect, useRef } from "react";
import { useAuth, usePreferencesContext } from "@/context";
import { settingsService } from "@/services";

// Bridges the local (localStorage-backed) preference state with the server.
//
// Direction on login: server is the source of truth — we fetch the signed-in
// user's stored settings and apply them locally, so preferences follow the user
// across devices. Direction after that: local changes are pushed up so the
// server stays current.
//
// localStorage remains the instant/offline source of truth for *applying* a
// preference (no flash, works for guests); this hook only adds cross-device
// persistence on top, and only while authenticated.
export const useSettingsSync = () => {
  const { user } = useAuth();
  const { mode, accent, chatFont, language, setThemeMode, applyServerPreferences } =
    usePreferencesContext();

  // The user id we've already hydrated from the server. Guards two things:
  // (1) we hydrate once per login, and (2) we don't push local->server writes
  // until after that hydration, so applying the server's values doesn't
  // immediately echo back as an outbound PATCH.
  const hydratedFor = useRef(null);

  // Load server settings when a user signs in (or switches accounts).
  useEffect(() => {
    if (!user?.id) {
      hydratedFor.current = null; // reset on logout so next login re-hydrates
      return;
    }
    if (hydratedFor.current === user.id) return;

    let cancelled = false;
    (async () => {
      try {
        const server = await settingsService.getSettings();
        if (cancelled || !server) return;
        // Apply accent / chat font / language.
        applyServerPreferences(server);
        // Theme mode is owned by useTheme; apply it through its setter.
        if (server.theme) setThemeMode(server.theme);
      } catch {
        // Sync is best-effort; a failed load just leaves local prefs in place.
      } finally {
        if (!cancelled) hydratedFor.current = user.id;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, applyServerPreferences, setThemeMode]);

  // Push local changes to the server, but only after the initial hydration for
  // this user (so the server's own values aren't written straight back). Sends
  // the full set each time; the backend merges, and a redundant write is cheap.
  useEffect(() => {
    if (!user?.id || hydratedFor.current !== user.id) return;
    settingsService
      .updateSettings({ theme: mode, accent, chatFont, language })
      .catch(() => {
        // Best-effort; the local choice already applied regardless.
      });
  }, [user?.id, mode, accent, chatFont, language]);
};
