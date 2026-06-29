import { useState } from "react";
import { Monitor, Sun, Moon } from "lucide-react";
import { AppSelect } from "@/components/shared";
import SettingsRow from "./SettingsRow";
import { FONT_OPTIONS, LANGUAGE_OPTIONS, ACCENT_OPTIONS } from "./settingsData";

// The three-way appearance control from the screenshot: System / Light / Dark.
// Light and Dark drive the real app theme via the existing toggle; System is a
// UI-only option for now (no follow-OS-after-manual-choice plumbing yet).
const APPEARANCE_MODES = [
  { value: "system", label: "System", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

const AppearanceToggle = ({ active, onSelect }) => (
  <div className="inline-flex border border-rule bg-ground">
    {APPEARANCE_MODES.map(({ value, label, Icon }) => {
      const selected = active === value;
      return (
        <button
          key={value}
          type="button"
          title={label}
          aria-pressed={selected}
          onClick={() => onSelect(value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
            selected ? "bg-surface text-brass" : "text-muted hover:text-ink"
          }`}
        >
          <Icon size={15} aria-hidden="true" />
        </button>
      );
    })}
  </div>
);

// Appearance tab. The theme segments reskin the app live; font / accent /
// language are UI-only selects on dummy state until those preferences are
// persisted server-side.
const AppearanceSettings = ({ theme, onToggleTheme }) => {
  const [font, setFont] = useState(FONT_OPTIONS[0].value);
  const [accent, setAccent] = useState(ACCENT_OPTIONS[0].value);
  const [language, setLanguage] = useState(LANGUAGE_OPTIONS[0].value);

  // The toggle exposes three modes, but the app's theme hook only knows
  // light/dark. Picking the mode that isn't the current theme flips it; picking
  // the current one (or "system") is a no-op on the live theme.
  const handleAppearance = (mode) => {
    if (mode === "light" && theme === "dark") onToggleTheme();
    if (mode === "dark" && theme === "light") onToggleTheme();
  };

  // Accent select shows a colored dot beside each label, drawn from the palette.
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
      <h3 className="mb-2 font-mono text-xs uppercase tracking-[0.25em] text-brass">
        Preferences
      </h3>

      <SettingsRow label="Appearance">
        <AppearanceToggle active={theme} onSelect={handleAppearance} />
      </SettingsRow>

      <SettingsRow label="Chat font">
        <AppSelect
          value={font}
          onChange={setFont}
          options={FONT_OPTIONS}
          className="w-56 max-w-full"
        />
      </SettingsRow>

      <SettingsRow label="Accent color">
        <AppSelect
          value={accent}
          onChange={setAccent}
          options={accentOptions}
          className="w-56 max-w-full"
        />
      </SettingsRow>

      <SettingsRow label="Language">
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
