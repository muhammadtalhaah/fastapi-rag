import { ConfigProvider, Switch } from "antd";

// Shared toggle, wrapping antd's Switch. A scoped ConfigProvider pins the
// switch colors to the app's CSS-variable palette so the on/off states read in
// the archive theme (brass when on, hairline rule when off) and follow the
// active [data-theme] automatically — the variables resolve per theme at paint.
const cssVar = (name) => `rgb(var(${name}))`;

const SWITCH_TOKENS = {
  Switch: {
    colorPrimary: cssVar("--brass"),
    colorPrimaryHover: cssVar("--brass"),
    colorTextQuaternary: cssVar("--rule"), // unchecked track
    colorTextTertiary: cssVar("--muted"), // unchecked track (hover)
    handleBg: cssVar("--surface"),
  },
};

const AppSwitch = ({ checked, onChange, size, disabled, ...props }) => {
  return (
    <ConfigProvider theme={{ components: SWITCH_TOKENS }}>
      <Switch
        checked={checked}
        onChange={onChange}
        size={size}
        disabled={disabled}
        {...props}
      />
    </ConfigProvider>
  );
};

export default AppSwitch;
