/* eslint-disable react-refresh/only-export-components -- router config file, not a component module */
import { lazy, Suspense } from "react";
import { ROUTES } from "./config/routes";
import { useAuth } from "@/context";
import DashboardLayout from "@/layouts/DashboardLayout";
import RouteError from "@/pages/error";
import { createBrowserRouter, Navigate } from "react-router-dom";

// Route-level code splitting: each page is its own chunk.
const ChatPage = lazy(() => import("@/pages/chat"));
const ChatsPage = lazy(() => import("@/pages/chats"));
const DocumentsPage = lazy(() => import("@/pages/documents"));
const UploadPage = lazy(() => import("@/pages/upload"));

const withSuspense = (Page) => (
  <Suspense fallback={null}>
    <Page />
  </Suspense>
);

// Permission gate for authenticated-only routes (e.g. upload). The app already
// resolves the session in AuthGate before the router renders, so isAuthenticated
// is settled here — a guest hitting /upload directly is redirected to Ask.
const RequireAuth = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to={ROUTES.CHAT} replace />;
};

export const router = createBrowserRouter([
  {
    path: ROUTES.CHAT,
    element: <DashboardLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: withSuspense(ChatPage) },
      {
        path: ROUTES.CHATS,
        element: <RequireAuth>{withSuspense(ChatsPage)}</RequireAuth>,
      },
      {
        path: ROUTES.UPLOAD,
        element: <RequireAuth>{withSuspense(UploadPage)}</RequireAuth>,
      },
      { path: ROUTES.DOCUMENTS, element: withSuspense(DocumentsPage) },
      { path: ROUTES.GLOBAL, element: <Navigate to={ROUTES.CHAT} replace /> },
    ],
  },
]);
