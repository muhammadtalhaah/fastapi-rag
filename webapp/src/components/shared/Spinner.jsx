// A small rotating "retrieval" mark — the ring is brass, the sweep is teal,
// reinforcing that something is being fetched from the archive.
const Spinner = ({ size = 18, label }) => {
  return (
    <span className="inline-flex items-center gap-2 text-muted">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        role="img"
        aria-label={label || "Loading"}
        className="motion-safe:animate-spin"
        style={{ animationDuration: "0.9s" }}
      >
        <circle cx="12" cy="12" r="9" stroke="rgb(var(--rule))" strokeWidth="2" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="rgb(var(--brass))"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      {label ? <span className="text-sm">{label}</span> : null}
    </span>
  );
};

export default Spinner;
