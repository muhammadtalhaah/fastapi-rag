import { Select } from "antd";

// Thin wrapper around antd's Select so the rest of the app imports a single
// shared control. The props we actually use are named explicitly; any other
// standard Select prop still passes straight through via `...props`.
const AppSelect = ({
  size,
  value,
  options,
  variant,
  onChange,
  disabled,
  placement,
  className,
  popupMatchSelectWidth,
  ...props
}) => {
  return (
    <Select
      size={size}
      value={value}
      options={options}
      variant={variant}
      onChange={onChange}
      disabled={disabled}
      placement={placement}
      className={className}
      popupMatchSelectWidth={popupMatchSelectWidth}
      {...props}
    />
  );
};

export default AppSelect;