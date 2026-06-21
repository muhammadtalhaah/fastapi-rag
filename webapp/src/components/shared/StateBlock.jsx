import Spinner from "./Spinner";

// Unified loading / empty / error presentation so every page handles its
// non-success states identically. Each variant is an invitation to act, not a
// dead end — `action` renders a button or link the caller supplies.
const StateBlock = ({ variant, icon: Icon, title, message, action }) => {
  const isError = variant === "error";

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      {variant === "loading" ? (
        <Spinner size={28} />
      ) : Icon ? (
        <Icon
          size={34}
          strokeWidth={1.5}
          aria-hidden="true"
          className={isError ? "text-danger" : "text-rule"}
        />
      ) : null}

      {title ? (
        <h2 className="font-display text-xl font-medium text-ink">{title}</h2>
      ) : null}

      {message ? (
        <p className="max-w-sm text-sm leading-relaxed text-muted">{message}</p>
      ) : null}

      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
};

export default StateBlock;
