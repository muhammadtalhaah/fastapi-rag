import { useEffect, useRef } from "react";
import { AppButton } from "@/components/shared";

// Minimal modal confirm. Focus moves to the cancel button on open and Escape
// closes — deletion is irreversible, so it must be a deliberate act.
const ConfirmDelete = ({ document, onConfirm, onCancel }) => {
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ground/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md border border-rule bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="font-display text-xl font-medium text-ink">
          Remove this document?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          <span className="text-ink">{document.filename}</span> and its{" "}
          {document.chunkCount} indexed chunks will be deleted. Answers can no
          longer cite it. This can’t be undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <AppButton ref={cancelRef} variant="ghost" onClick={onCancel}>
            Keep it
          </AppButton>
          <AppButton variant="danger" onClick={() => onConfirm(document.id)}>
            Delete
          </AppButton>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDelete;
