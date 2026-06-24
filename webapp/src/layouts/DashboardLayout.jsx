import { Sidebar } from "@/components/shared";
import { Outlet, useLocation } from "react-router-dom";

// On tablet+ the catalog rail sits to the left; on mobile it stacks on top so
// navigation is never hidden behind a menu.
const DashboardLayout = () => {
  const location = useLocation();

  return (
    <div className="flex h-screen flex-col sm_tablet:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div
          className={`mx-auto flex min-h-full max-h-full overflow-hidden max-w-4xl flex-col px-5 ${location.pathname === "/" ? "py-0 pt-8" : "py-8"}  sm_desktop:px-10`}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
