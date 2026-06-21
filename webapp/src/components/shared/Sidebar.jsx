import { NavLink } from "react-router-dom";
import { MessagesSquare, Library, UploadCloud } from "lucide-react";
import { ROUTES } from "@/config";

// Nav reads like a card-catalog index: each entry has a brass call-number, an
// icon, and a label. Order encodes the natural workflow — ask, browse, add.
const NAV = [
  { to: ROUTES.CHAT, code: "01", label: "Ask", icon: MessagesSquare, end: true },
  { to: ROUTES.DOCUMENTS, code: "02", label: "Documents", icon: Library },
  { to: ROUTES.UPLOAD, code: "03", label: "Upload", icon: UploadCloud },
];

const Sidebar = () => {
  return (
    <aside className="flex shrink-0 flex-col border-r border-rule bg-surface/40 sm_tablet:w-64">
      <div className="border-b border-rule px-6 py-6">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.3em] text-brass">
          Retrieval Index
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold leading-none text-ink">
          Athenæum
        </h1>
        <p className="mt-1 text-xs text-muted">Grounded answers, with sources.</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Primary">
        {NAV.map(({ to, code, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `group flex items-center gap-3 border px-3 py-3 text-sm transition-colors ${
                isActive
                  ? "border-rule bg-ground text-ink"
                  : "border-transparent text-muted hover:border-rule hover:bg-ground/60 hover:text-ink"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`font-mono text-xs ${
                    isActive ? "text-brass" : "text-rule group-hover:text-brass"
                  }`}
                >
                  {code}
                </span>
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                <span className="font-medium tracking-wide">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-rule px-6 py-4">
        <p className="font-mono text-[0.65rem] leading-relaxed text-muted">
          Vector search over MongoDB
          <br />
          Voyage embeddings · Azure GPT-4o
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
