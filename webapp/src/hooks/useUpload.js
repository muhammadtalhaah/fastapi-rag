import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { documentService } from "@/services";
import { ACCEPTED_EXTENSIONS } from "@/config";
import { DOCUMENTS_KEY } from "@/hooks/useDocuments";

const hasAcceptedExtension = (name) =>
  ACCEPTED_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

// Orchestrates a single-file upload: client-side type guard, progress tracking,
// and cache invalidation so the Documents table is fresh on arrival.
export function useUpload({ onComplete }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("idle"); // idle | uploading | done | error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  // Keep the latest onComplete without making `upload` depend on it; writing the
  // ref in an effect (not during render) keeps the render pure.
  const completeRef = useRef(onComplete);
  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  const reset = useCallback(() => {
    setStatus("idle");
    setProgress(0);
    setError(null);
    setResult(null);
  }, []);

  const upload = useCallback(
    async (file) => {
      if (!file) return;
      if (!hasAcceptedExtension(file.name)) {
        setStatus("error");
        setError(
          `Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.join(", ")}.`,
        );
        return;
      }

      setStatus("uploading");
      setProgress(0);
      setError(null);

      try {
        const data = await documentService.uploadDocument(file, setProgress);
        setResult(data);
        setStatus("done");
        queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY });
        completeRef.current?.(data);
      } catch (err) {
        setStatus("error");
        setError(err.message);
      }
    },
    [queryClient],
  );

  return { status, progress, error, result, upload, reset };
}
