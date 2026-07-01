import { forwardRef } from "react";

// Square-cornered button in keeping with the ledger aesthetic. Primary fills
// brass (structural action); ghost is a hairline-ruled secondary.
const VARIANTS = {
  primary:
    "bg-primary text-ground hover:bg-primary/90 border border-primary disabled:bg-rule disabled:border-rule disabled:text-muted",
  ghost:
    "bg-transparent text-ink border border-rule hover:border-ink hover:bg-surface disabled:text-muted disabled:hover:border-rule",
  danger:
    "bg-transparent text-danger border border-danger/40 hover:bg-danger/10 hover:border-danger",
  plain: "bg-transparent text-ink border-0 disabled:text-muted",
};

const AppButton = forwardRef(function AppButton(
  {
    variant = "primary",
    type = "button",
    className = "",
    loading = false,
    disabled = false,
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-disabled={disabled || loading || undefined}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium tracking-wide transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ground ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

export default AppButton;
