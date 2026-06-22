import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { PageHeader, AppButton } from "@/components/shared";
import { ROUTES } from "@/config";
import { useUpload } from "@/hooks";
import DropZone from "./DropZone";
import UploadProgress from "./UploadProgress";

const UploadPage = () => {
  const navigate = useNavigate();
  const [filename, setFilename] = useState("");

  const { status, progress, error, result, upload, reset } = useUpload({
    // On success, send the operator to the collection where the new file now lives.
    onComplete: () => {
      setTimeout(() => navigate(ROUTES.DOCUMENTS), 900);
    },
  });

  const start = (file) => {
    setFilename(file.name);
    upload(file);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="03 · Upload"
        title="Add to the archive"
        lede="New files are split into passages and embedded so the archive can retrieve and cite them."
      />

      {status === "idle" ? (
        <DropZone onFile={start} />
      ) : null}

      {status === "uploading" ? (
        <UploadProgress filename={filename} progress={progress} />
      ) : null}

      {status === "done" ? (
        <div className="flex flex-col items-center gap-4 border border-retrieval/30 bg-retrieval/5 px-6 py-12 text-center">
          <CheckCircle2 size={34} aria-hidden="true" className="text-retrieval" />
          <div>
            <h2 className="font-display text-xl font-medium text-ink">
              Added to the collection
            </h2>
            <p className="mt-1 text-sm text-muted">
              <span className="text-ink">{result?.filename}</span> ·{" "}
              {result?.chunks_stored} chunks indexed. Taking you to Documents…
            </p>
          </div>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="flex flex-col items-center gap-4 border border-danger/40 bg-danger/5 px-6 py-12 text-center">
          <AlertTriangle size={34} aria-hidden="true" className="text-danger" />
          <div>
            <h2 className="font-display text-xl font-medium text-ink">
              Upload didn’t go through
            </h2>
            <p className="mt-1 max-w-sm text-sm text-muted">{error}</p>
          </div>
          <AppButton variant="ghost" onClick={reset}>
            Choose another file
          </AppButton>
        </div>
      ) : null}
    </div>
  );
};

export default UploadPage;
