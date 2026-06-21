import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { ACCEPTED_EXTENSIONS } from "@/config";

// Drag-and-drop target that doubles as a file picker. The whole zone is a
// button for keyboard users; drag state lifts the border to retrieval teal.
const DropZone = ({ onFile, disabled }) => {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  const openPicker = () => !disabled && inputRef.current?.click();

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPicker();
        }
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label="Choose a file or drop one here to upload"
      className={`flex cursor-pointer flex-col items-center justify-center gap-4 border border-dashed px-6 py-16 text-center transition-colors ${
        isDragging
          ? "border-retrieval bg-retrieval/5"
          : "border-rule bg-surface/30 hover:border-brass"
      } ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <UploadCloud
        size={36}
        strokeWidth={1.5}
        aria-hidden="true"
        className={isDragging ? "text-retrieval" : "text-muted"}
      />
      <div>
        <p className="font-display text-lg font-medium text-ink">
          Drop a document, or click to choose
        </p>
        <p className="mt-1 font-mono text-xs text-muted">
          {ACCEPTED_EXTENSIONS.join("  ·  ")}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />
    </div>
  );
};

export default DropZone;
