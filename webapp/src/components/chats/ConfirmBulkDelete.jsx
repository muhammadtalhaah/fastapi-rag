import { useEffect, useRef } from "react";
import { AppButton } from "@/components/shared";

// Confirms bulk deletion of selected chats. Focus moves to Cancel on open and
// Escape closes — deletion is irreversible, so it must be deliberate. Mirrors
// the documents ConfirmDelete to keep the two confirm flows consistent.
const ConfirmBulkDelete = ({ count, onConfirm, onCancel, isDeleting }) => {
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const noun = count === 1 ? "chat" : "chats";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ground/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-bulk-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md border border-rule bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-bulk-title" className="font-display text-xl font-medium text-ink">
          Delete {count} {noun}?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {count === 1 ? "This conversation" : `These ${count} conversations`} and
          their full message history will be permanently removed. This can’t be
          undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <AppButton ref={cancelRef} variant="ghost" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </AppButton>
          <AppButton variant="danger" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Delete"}
          </AppButton>
        </div>
      </div>
    </div>
  );
};

export default ConfirmBulkDelete;
