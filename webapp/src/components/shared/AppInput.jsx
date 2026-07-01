import { Input } from "antd";

const { TextArea } = Input;

// Thin wrapper around antd's Input so the rest of the app imports a single
// shared control. The props we actually use are named explicitly; any other
// standard Input prop still passes straight through via `...props`. Pass
// `textarea` to render a multi-line Input.TextArea instead of a single line.
//
// Defaults to a visible `border-rule` outline so every field reads as bordered
// out of the box; consumers can override via `className` (later in the string
// wins) e.g. `focus-within:border-primary` to recolor on focus.

const AppInput = ({
  id,
  type,
  rows,
  size,
  value,
  onBlur,
  onChange,
  disabled,
  textarea,
  className,
  maxLength,
  placeholder,
  variant = "outlined",
  ...props
}) => {
  const Component = textarea ? TextArea : Input;

  return (
    <Component
      id={id}
      type={type}
      size={size}
      value={value}
      variant={variant}
      rows={rows}
      onChange={onChange}
      onBlur={onBlur}
      disabled={disabled}
      maxLength={maxLength}
      placeholder={placeholder}
      className={`border border-rule ${className ?? ""}`}
      {...props}
    />
  );
};

export default AppInput;
