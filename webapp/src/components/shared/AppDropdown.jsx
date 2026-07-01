import { Dropdown } from "antd";

const AppDropdown = ({
  open,
  onOpenChange,
  menu,
  disabled,
  trigger = ["click"],
  placement = "bottomRight",
  children,
  ...rest
}) => {
  return (
      <Dropdown
        trigger={trigger}
        open={open}
        placement={placement}
        onOpenChange={onOpenChange}
        disabled={disabled}
        menu={menu}
        {...rest}
      >
        {children}
      </Dropdown>
  );
};

export default AppDropdown;
