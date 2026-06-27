import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { AntdThemeBridge, AuthProvider, ThemeProvider, ToastProvider, useAuth } from "@/context";
import { StateBlock } from "@/components/shared";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

// Hold the whole app behind a full-screen loader while the initial session check
// (/me) is in flight, so no route renders in a momentarily-"logged out" state on
// a fresh load or refresh. Lives inside AuthProvider so it can read auth state.
function AuthGate() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-ground">
        <StateBlock variant="loading" message="Loading your session…" />
      </div>
    );
  }

  return <RouterProvider router={router} />;
}

// AuthProvider sits inside QueryClientProvider (it uses TanStack Query for the
// /me session check) and wraps the router so every route can read auth state.
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AntdThemeBridge>
          <ToastProvider>
            <AuthProvider>
              <AuthGate />
            </AuthProvider>
          </ToastProvider>
        </AntdThemeBridge>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
