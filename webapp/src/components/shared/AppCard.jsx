// Shared floating popover surface. Both the composer "+" menu and the sidebar
// account menu open a small card above their trigger; AppCard centralizes that
// surface — positioning, border, background, elevation, and rounding — so the
// two read as the same component and stay visually consistent. It uses the
// `--elevated` tone (a step above `--surface`/`--ground`) so the card reads as
// floating above the sidebar and chat rather than blending into them.
//
// Positioning assumes the parent is `relative`; the card anchors to the bottom
// of the trigger and opens upward (`bottom-full`), matching both call sites.
// Sizing, padding, and any per-instance offsets all come in through a single
// `className` (e.g. "w-72 p-3" for the composer menu) — pass whatever utility
// classes the call site needs. Other props (role, aria-label, …) pass straight
// through to the surface element.
const AppCard = ({ children, className = "", ...props }) => {
  return (
    <div
      className={`absolute bottom-full left-0 !z-50 mb-2 max-w-[calc(100vw-2rem)] rounded-2xl border border-rule bg-elevated shadow-lg ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default AppCard;
