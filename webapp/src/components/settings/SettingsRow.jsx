// One row in a settings panel: a label (with optional helper text) on the left
// and a control on the right, separated from its neighbours by a hairline rule —
// the layout the screenshots use throughout. `stacked` drops the control onto
// its own full-width line below the label (for textareas and the like).
const SettingsRow = ({ label, htmlFor, hint, stacked = false, children }) => {
  return (
    <div
      className={`border-b border-rule py-4 ${
        stacked ? "" : "flex items-center justify-between gap-6"
      }`}
    >
      <div className={stacked ? "mb-3" : "min-w-0"}>
        <label
          htmlFor={htmlFor}
          className="block text-sm font-medium text-ink"
        >
          {label}
        </label>
        {hint ? <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p> : null}
      </div>
      <div className={stacked ? "" : "shrink-0"}>{children}</div>
    </div>
  );
};

export default SettingsRow;
