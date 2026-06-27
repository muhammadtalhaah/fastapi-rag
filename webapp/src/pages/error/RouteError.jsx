import { AlertTriangle, Home, RotateCw } from "lucide-react";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";
import { AppButton, StateBlock } from "@/components/shared";
import { ROUTES } from "@/config/routes";

// Route-level error boundary, wired as `errorElement` on the root route. React
// Router renders this in place of the crashed subtree when a loader, action, or
// render throws — replacing the framework's raw "Unexpected Application Error"
// stack with a themed, recoverable page.
//
// Two recovery paths: reload (re-runs the failed render/loader) and go home
// (navigate back to the Ask route, which remounts a clean tree). The raw error
// message is only surfaced in dev so production users never see internals.
const RouteError = () => {
  const error = useRouteError();
  const navigate = useNavigate();
  const isDev = import.meta.env.DEV;

  // A thrown Response (e.g. a 404 from a loader) carries status + statusText;
  // anything else is an unexpected runtime error.
  const isRouteResponse = isRouteErrorResponse(error);
  const isNotFound = isRouteResponse && error.status === 404;

  const title = isNotFound
    ? "Page not found"
    : isRouteResponse
      ? `${error.status} — ${error.statusText || "Request failed"}`
      : "Something went wrong";

  const message = isNotFound
    ? "The page you're looking for doesn't exist or may have moved."
    : "An unexpected error interrupted this page. You can try again, or head back to the start.";

  // Best-effort detail line for developers: a route-response's data, an Error's
  // message, or the stringified value as a last resort.
  const detail = isRouteResponse
    ? typeof error.data === "string"
      ? error.data
      : null
    : error instanceof Error
      ? error.message
      : error
        ? String(error)
        : null;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-ground px-4">
      <div className="w-full max-w-lg">
        <StateBlock
          variant="error"
          icon={AlertTriangle}
          title={title}
          message={message}
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              {!isNotFound ? (
                <AppButton variant="primary" onClick={() => window.location.reload()}>
                  <RotateCw size={16} aria-hidden="true" />
                  Try again
                </AppButton>
              ) : null}
              <AppButton variant="ghost" onClick={() => navigate(ROUTES.CHAT)}>
                <Home size={16} aria-hidden="true" />
                Back to chat
              </AppButton>
            </div>
          }
        />

        {isDev && detail ? (
          <pre className="mt-2 max-h-48 overflow-auto border border-rule bg-surface p-3 text-left font-mono text-xs leading-relaxed text-danger">
            {detail}
          </pre>
        ) : null}
      </div>
    </div>
  );
};

export default RouteError;
