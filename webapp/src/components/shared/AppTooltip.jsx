import { Tooltip } from "antd";

const AppTooltip = ({
  ref,
  title,
  arrow,
  children,
  open,
  onOpenChange,
  placement = "bottom",
}) => {
  return (
    <Tooltip
      fresh
      ref={ref}
      arrow={arrow}
      title={title}
      destroyOnHidden
      placement={placement}
      open={open}
      onOpenChange={onOpenChange}
    >
      {children}
    </Tooltip>
  );
};

export default AppTooltip;
