/* eslint-disable react-refresh/only-export-components -- router config file, not a component module */
import { lazy, Suspense } from "react";
import { ROUTES } from "./config/routes";
import DashboardLayout from "@/layouts/DashboardLayout";
import { createBrowserRouter, Navigate } from "react-router-dom";

// Route-level code splitting: each page is its own chunk.
const ChatPage = lazy(() => import("@/pages/chat"));
const DocumentsPage = lazy(() => import("@/pages/documents"));
const UploadPage = lazy(() => import("@/pages/upload"));

const withSuspense = (Page) => (
  <Suspense fallback={null}>
    <Page />
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: ROUTES.CHAT,
    element: <DashboardLayout />,
    children: [
      { index: true, element: withSuspense(ChatPage) },
      { path: ROUTES.UPLOAD, element: withSuspense(UploadPage) },
      { path: ROUTES.DOCUMENTS, element: withSuspense(DocumentsPage) },
      { path: ROUTES.GLOBAL, element: <Navigate to={ROUTES.CHAT} replace /> },
    ],
  },
]);
