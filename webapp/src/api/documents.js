import apiClient from "./client";
import { ENDPOINTS } from "./endpoints";

// The ingest collection is the source of truth for uploaded files: it carries
// filename, size, chunk_count, and created_at. The /documents resource is the
// metadata CRUD layer used for deletion.
const listDocuments = () => apiClient.get(ENDPOINTS.INGEST);

const deleteDocument = (id) => apiClient.delete(ENDPOINTS.document(id));

const uploadDocument = (file, onProgress) => {
  const form = new FormData();
  form.append("file", file);

  return apiClient.post(ENDPOINTS.INGEST, form, {
    headers: { "Content-Type": undefined },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });
};

export default { listDocuments, deleteDocument, uploadDocument };
