import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/shared";

// On tablet+ the catalog rail sits to the left; on mobile it stacks on top so
// navigation is never hidden behind a menu.
const DashboardLayout = () => {
  return (
    <div className="flex h-full flex-col sm_tablet:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-4xl flex-col px-5 py-8 sm_desktop:px-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
