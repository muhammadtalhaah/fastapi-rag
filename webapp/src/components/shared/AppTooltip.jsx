import { Tooltip } from "antd";
import React from "react";

const AppTooltip = ({
  ref,
  title,
  arrow,
  children,
  popupVisible,
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
      popupVisible={popupVisible}
    >
      {children}
    </Tooltip>
  );
};

export default AppTooltip;
