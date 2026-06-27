import { Drawer } from "antd";

// Shared drawer wrapper. Removes the default antd box-shadow (visible as a
// dark bleed on the left edge in dark theme) and hoists the styles object to
// module scope so antd's internal style merging only runs once, not per render.
const BASE_STYLES = {
  header: { display: "none" },
  body: { padding: 0 },
  mask: { background: "rgba(0, 0, 0, 0.45)" },
  content: { contain: "layout paint" },
};

const AppDrawer = ({ open, onClose, placement = "right", size, destroyOnHidden = false, children }) => (
  <Drawer
    open={open}
    onClose={onClose}
    placement={placement}
    size={size}
    closeIcon={null}
    destroyOnHidden={destroyOnHidden}
    styles={BASE_STYLES}
  >
    {children}
  </Drawer>
);

export default AppDrawer;
