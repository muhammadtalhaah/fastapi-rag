/* eslint-disable react-refresh/only-export-components -- provider + its hook/key are intentionally colocated */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authService } from "@/services";
import { useToast } from "./ToastContext";

// Human-readable messages for the ?auth_error codes the OAuth callback may
// append when the Google flow fails (so we never show a raw code to a person).
const OAUTH_ERROR_MESSAGES = {
  google_failed: "Google sign-in was cancelled or failed. Please try again.",
  google_unverified: "Your Google account email isn’t verified.",
};

// Global auth state. The session lives in an HttpOnly cookie (not readable by
// JS), so "are we logged in?" is answered by asking the backend via /me rather
// than by inspecting a token. TanStack Query caches that answer and is the
// single source of truth; login/logout mutate the cookie and then refresh it.
const AuthContext = createContext(null);

export const AUTH_ME_KEY = ["auth", "me"];

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // On a full-page return from the Google OAuth callback, a successful login
  // already set the session cookie, so the /me query below resolves the user on
  // this fresh load — nothing extra needed for success. On failure the callback
  // appends ?auth_error=<code>; read it once on mount (lazy initializer, not an
  // effect) and map it to a message.
  const [oauthError, setOauthError] = useState(() => {
    const code = new URLSearchParams(window.location.search).get("auth_error");
    if (!code) return null;
    return OAUTH_ERROR_MESSAGES[code] || "Sign-in failed. Please try again.";
  });

  // Strip ?auth_error from the URL once (real side effect) so it doesn't persist
  // on refresh or leak into a shared link. No setState here.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("auth_error")) return;
    params.delete("auth_error");
    const query = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (query ? `?${query}` : "") + window.location.hash,
    );
  }, []);

  // Resolve the current user from the session cookie. Returns null when
  // anonymous (getMe maps 401/403 -> null), so `user` is either a user or null.
  const meQuery = useQuery({
    queryKey: AUTH_ME_KEY,
    queryFn: authService.getMe,
    staleTime: 5 * 60 * 1000,
    retry: false, // a 401 is an answer, not a transient failure
  });

  // Surface a genuine /me failure. A 401/403 is mapped to `null` inside getMe
  // (anonymous, not an error), so reaching `isError` means a real server/network
  // fault (e.g. 502) the user should know about. Keyed on the error object so it
  // toasts once per failure rather than on every render.
  useEffect(() => {
    if (meQuery.isError) {
      showToast("Couldn't reach the server. Please try again.");
    }
  }, [meQuery.isError, meQuery.error, showToast]);

  const loginMutation = useMutation({
    mutationFn: ({ email, password }) => authService.login(email, password),
    // Seed the cache with the returned user so the UI flips to "logged in"
    // immediately, without waiting for a /me round-trip.
    onSuccess: (user) => queryClient.setQueryData(AUTH_ME_KEY, user),
  });

  const logoutMutation = useMutation({
    mutationFn: authService.logout,
    onSuccess: () => queryClient.setQueryData(AUTH_ME_KEY, null),
  });

  const login = useCallback(
    (email, password) => loginMutation.mutateAsync({ email, password }),
    [loginMutation],
  );

  const logout = useCallback(() => logoutMutation.mutateAsync(), [logoutMutation]);

  const clearOauthError = useCallback(() => setOauthError(null), []);

  const value = useMemo(
    () => ({
      user: meQuery.data ?? null,
      isAuthenticated: Boolean(meQuery.data),
      isLoading: meQuery.isLoading,
      login,
      logout,
      isLoggingIn: loginMutation.isPending,
      // Surface the login error message (e.g. "Invalid credentials") for the form.
      loginError: loginMutation.isError ? loginMutation.error?.message : null,
      resetLoginError: loginMutation.reset,
      // Error from a failed Google OAuth round-trip (read from the URL on load).
      oauthError,
      clearOauthError,
    }),
    [
      meQuery.data,
      meQuery.isLoading,
      login,
      logout,
      loginMutation.isPending,
      loginMutation.isError,
      loginMutation.error,
      loginMutation.reset,
      oauthError,
      clearOauthError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Consumer hook. Throws if used outside the provider so misuse fails loudly.
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
