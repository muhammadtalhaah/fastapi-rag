/* eslint-disable react-refresh/only-export-components -- router config file, not a component module */
import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import DashboardLayout from "@/layouts/DashboardLayout";
import { StateBlock } from "@/components/shared";
import { ROUTES } from "@/config";

// Route-level code splitting: each page is its own chunk.
const ChatPage = lazy(() => import("@/pages/chat"));
const DocumentsPage = lazy(() => import("@/pages/documents"));
const UploadPage = lazy(() => import("@/pages/upload"));

const withSuspense = (Page) => (
  <Suspense fallback={<StateBlock variant="loading" message="Loading…" />}>
    <Page />
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: <DashboardLayout />,
    children: [
      { index: true, element: withSuspense(ChatPage) },
      { path: "documents", element: withSuspense(DocumentsPage) },
      { path: "upload", element: withSuspense(UploadPage) },
      { path: "*", element: <Navigate to={ROUTES.CHAT} replace /> },
    ],
  },
]);
