import { ConfigProvider, theme as antdTheme } from "antd";
import { useThemeContext } from "./ThemeContext";

// Bridges the app's CSS-variable palette (defined in index.css and swapped by
// [data-theme]) into Ant Design's token system, so antd surfaces — Select,
// Drawer, Tooltip, etc. — render in the same archive palette as the rest of the
// app instead of antd's stock blue/white.
//
// antd accepts CSS color strings for color tokens, so we hand it the same
// `rgb(var(--token))` values Tailwind resolves. The algorithm switch
// (dark/default) sets sensible derived tokens (shadows, hover/active states)
// that we don't override by hand.
const cssVar = (name) => `rgb(var(${name}))`;

// Shared color tokens, identical for both themes — the CSS variables resolve to
// the right palette per [data-theme] at paint time.
const sharedToken = {
  colorPrimary: cssVar("--brass"),
  colorBgContainer: cssVar("--surface"),
  colorBgElevated: cssVar("--surface"),
  colorBorder: cssVar("--rule"),
  colorText: cssVar("--ink"),
  colorTextPlaceholder: cssVar("--muted"),
  colorTextQuaternary: cssVar("--muted"),
  colorTextDescription: cssVar("--muted"),
  colorIcon: cssVar("--muted"),
  // Kill elevation shadows globally — dropdowns, tooltips, and popovers all
  // inherit these. Individual component tokens below handle any stragglers.
  boxShadow: "none",
  boxShadowSecondary: "none",
  boxShadowTertiary: "none",
  // antd v6 renders the Tooltip/Popover shadow as a CSS `filter: drop-shadow(...)`
  // on the root `.ant-tooltip` element via this derived alias token — NOT a
  // box-shadow — so the boxShadow* overrides above never reach it. Blank it here.
  dropShadowPopover: "none",
};

// Per-component tweaks. The Select's selected-option background was the worst
// offender in the dark theme (stock light-blue), so anchor it to the app's
// hover surface and brass-tinted active state.
const components = {
  Select: {
    // NOTE: antd color-processes `optionSelectedBg`, so it can't parse our
    // `rgb(var(--rule))` string and falls back to a stock dark grey — making the
    // selected option unreadable in the light theme. The real fix lives in a CSS
    // override in index.css (`.ant-select-item-option-selected`); we keep the
    // token here too so the value is at least declared in one place.
    optionSelectedBg: cssVar("--rule"),
    optionActiveBg: cssVar("--rule"),
    selectorBg: "transparent",
    // The open dropdown is a popover, so give it the `--elevated` stock — a shade
    // above `--surface` — so it reads as a distinct panel instead of blending
    // into the composer card it floats over (also `--surface`).
    colorBgElevated: cssVar("--elevated"),
    boxShadow: "none",
    boxShadowSecondary: "none",
  },
  Tooltip: {
    boxShadow: "none",
    boxShadowSecondary: "none",
  },
  Drawer: {
    // Kill the default side-shadow that bleeds onto the page content.
    boxShadowDrawerRight: "none",
    boxShadowDrawerLeft: "none",
    boxShadowDrawerUp: "none",
    boxShadowDrawerDown: "none",
  },
};

const AntdThemeBridge = ({ children }) => {
  const { theme } = useThemeContext();
  const algorithm =
    theme === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm;

  return (
    <ConfigProvider theme={{ algorithm, token: sharedToken, components }}>
      {children}
    </ConfigProvider>
  );
};

export default AntdThemeBridge;
