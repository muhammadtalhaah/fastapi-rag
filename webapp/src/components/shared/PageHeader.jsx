// Page masthead: a brass eyebrow "call-number" + display title + lede.
// The eyebrow encodes the section's catalog position, not decoration.
const PageHeader = ({ eyebrow, title, lede, actions }) => {
  return (
    <header className="flex flex-col gap-4 border-b border-rule pb-6 sm_tablet:flex-row sm_tablet:items-end sm_tablet:justify-between">
      <div className="flex flex-col gap-2">
        {eyebrow ? (
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-brass">
            {eyebrow}
          </span>
        ) : null}
        <h1 className="font-display text-3xl font-semibold leading-none tracking-tight text-ink sm_desktop:text-4xl">
          {title}
        </h1>
        {lede ? (
          <p className="max-w-xl text-sm leading-relaxed text-muted">{lede}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </header>
  );
};

export default PageHeader;
