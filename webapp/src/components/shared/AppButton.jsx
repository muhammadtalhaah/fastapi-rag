import { forwardRef } from "react";

// Square-cornered button in keeping with the ledger aesthetic. Primary fills
// brass (structural action); ghost is a hairline-ruled secondary.
const VARIANTS = {
  primary:
    "bg-brass text-ground hover:bg-brass/90 border border-brass disabled:bg-rule disabled:border-rule disabled:text-muted",
  ghost:
    "bg-transparent text-ink border border-rule hover:border-ink hover:bg-surface disabled:text-muted disabled:hover:border-rule",
  danger:
    "bg-transparent text-danger border border-danger/40 hover:bg-danger/10 hover:border-danger",
};

const AppButton = forwardRef(function AppButton(
  { variant = "primary", type = "button", className = "", children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium tracking-wide transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

export default AppButton;
