import { Monitor, Sun, Moon } from "lucide-react";
import { AppSelect } from "@/components/shared";
import { usePreferencesContext, useTranslation } from "@/context";
import SettingsRow from "./SettingsRow";
import { FONT_OPTIONS, LANGUAGE_OPTIONS, ACCENT_OPTIONS } from "./settingsData";

// The three-way appearance control from the screenshot: System / Light / Dark.
// "System" follows the OS; Light/Dark pin the theme. All three are real now —
// they drive the appearance mode in useTheme (via PreferencesContext). Labels
// resolve through t() so they follow the active language.
const APPEARANCE_MODES = [
  { value: "system", labelKey: "appearanceSystem", Icon: Monitor },
  { value: "light", labelKey: "appearanceLight", Icon: Sun },
  { value: "dark", labelKey: "appearanceDark", Icon: Moon },
];

const AppearanceToggle = ({ active, onSelect }) => {
  const { t } = useTranslation();
  return (
  <div className="inline-flex border border-rule bg-ground">
    {APPEARANCE_MODES.map(({ value, labelKey, Icon }) => {
      const selected = active === value;
      return (
        <button
          key={value}
          type="button"
          title={t(labelKey)}
          aria-pressed={selected}
          onClick={() => onSelect(value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
            selected ? "bg-surface text-primary" : "text-muted hover:text-ink"
          }`}
        >
          <Icon size={15} aria-hidden="true" />
        </button>
      );
    })}
  </div>
  );
};

// Appearance tab. Every control applies live and persists immediately (no save
// button) — appearance is a per-user UX preference, mirroring how the theme
// toggle already works. Changes write through to localStorage instantly and
// sync to the server in the background (useSettingsSync) when signed in.
const AppearanceSettings = () => {
  const { t } = useTranslation();
  const { mode, accent, chatFont, language, setThemeMode, setAccent, setChatFont, setLanguage } =
    usePreferencesContext();

  // Accent select shows a colored dot beside each label, drawn in that option's
  // OWN palette token — so each dot previews the color it names (Brass gold, Teal
  // teal, Terracotta terracotta, Ink ink). These preview swatches are the one
  // place the full palette shows at once; picking an option re-points `--brass`
  // via `[data-accent]`, so the rest of the app still surfaces only the selected
  // accent.
  const accentOptions = ACCENT_OPTIONS.map(({ value, label, token }) => ({
    value,
    label: (
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-3 w-3 rounded-full ring-1 ring-rule"
          style={{ backgroundColor: `rgb(var(${token}))` }}
        />
        {label}
      </span>
    ),
  }));

  return (
    <div>
      <h3 className="mb-2 font-mono text-xs uppercase tracking-[0.25em] text-primary">
        {t("preferences")}
      </h3>

      <SettingsRow label={t("appearance")}>
        <AppearanceToggle active={mode} onSelect={setThemeMode} />
      </SettingsRow>

      <SettingsRow label={t("font")}>
        <AppSelect
          value={chatFont}
          onChange={setChatFont}
          options={FONT_OPTIONS}
          className="w-56 max-w-full"
        />
      </SettingsRow>

      <SettingsRow label={t("accentColor")}>
        <AppSelect
          value={accent}
          onChange={setAccent}
          options={accentOptions}
          className="w-56 max-w-full"
        />
      </SettingsRow>

      <SettingsRow label={t("language")}>
        <AppSelect
          value={language}
          onChange={setLanguage}
          options={LANGUAGE_OPTIONS}
          className="w-56 max-w-full"
        />
      </SettingsRow>
    </div>
  );
};

export default AppearanceSettings;
