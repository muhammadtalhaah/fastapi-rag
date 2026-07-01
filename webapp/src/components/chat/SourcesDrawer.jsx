import { AppDrawer } from "@/components/shared";
import { X } from "lucide-react";
import SourcesLedger from "./SourcesLedger";
import { useTranslation } from "@/context";

const SourcesDrawer = ({ sources, focusKey, onClose }) => {
  const { t } = useTranslation();
  const open = Boolean(sources?.length);

  return (
    <AppDrawer open={open} onClose={onClose} size={440}>
      <div className="flex h-full flex-col bg-ground">
        <div className="flex items-center justify-between border-b border-rule px-4 py-3">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            {t("sources")}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sources"
            className="flex h-7 w-7 items-center justify-center text-muted transition-colors hover:text-ink"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain [contain:content]">
          {open ? (
            <SourcesLedger sources={sources} focusKey={focusKey} hideHeader />
          ) : null}
        </div>
      </div>
    </AppDrawer>
  );
};

export default SourcesDrawer;
