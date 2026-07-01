import { useTranslation } from "@/context";
import { DUMMY_USAGE } from "./settingsData";

// Compact thousands/millions formatting for token counts: 1_284_530 -> "1.28M".
const fmtTokens = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const fmtFull = (n) => n.toLocaleString("en-US");

// Usage tab. Shows the period's total token consumption as the headline figure,
// a meter against the plan limit, and a per-model breakdown. All figures are
// dummy data (DUMMY_USAGE) until a usage endpoint exists.
const UsageSettings = () => {
  const { t } = useTranslation();
  const { period, totalTokens, limit, breakdown, requests } = DUMMY_USAGE;
  const pct = Math.min(100, Math.round((totalTokens / limit) * 100));

  return (
    <div>
      <h3 className="mb-2 font-mono text-xs uppercase tracking-[0.25em] text-primary">
        {t("usage")} · {period}
      </h3>

      {/* Headline total. */}
      <div className="border-b border-rule py-5">
        <p className="text-xs font-medium text-muted">{t("totalTokensUsed")}</p>
        <p className="mt-1 font-display text-3xl font-medium text-ink">
          {fmtTokens(totalTokens)}
          <span className="ml-2 align-baseline text-sm font-normal text-muted">
            / {fmtTokens(limit)}
          </span>
        </p>

        {/* Meter against the plan limit. */}
        <div className="mt-3 h-2 w-full overflow-hidden bg-ground ring-1 ring-rule">
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <p className="mt-1.5 font-mono text-[0.65rem] text-muted">
          {pct}% of monthly allowance · {fmtFull(requests)} requests
        </p>
      </div>

      {/* Per-model breakdown. */}
      <div className="py-2">
        <p className="px-1 pb-1 pt-2 font-mono text-[0.6rem] uppercase tracking-[0.25em] text-muted">
          {t("byModel")}
        </p>
        <ul>
          {breakdown.map((row) => (
            <li
              key={row.model}
              className="flex items-center justify-between border-b border-rule py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{row.label}</p>
                <p className="truncate font-mono text-[0.65rem] text-muted">
                  {row.model}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm tabular-nums text-ink">{fmtFull(row.tokens)}</p>
                <p className="font-mono text-[0.6rem] text-muted">{t("tokens")}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default UsageSettings;
