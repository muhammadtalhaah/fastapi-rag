import { documentsApi, unwrap } from "@/api";

function toDocument(raw) {
  return {
    id: raw.id,
    filename: raw.filename,
    sizeBytes: raw.size_bytes,
    chunkCount: raw.chunk_count,
    createdAt: raw.created_at,
    downloadUrl: raw.download_url,
    // The backend has no per-file status field; a stored chunk count means the
    // file was successfully embedded and is queryable. Surface that as status.
    status: raw.chunk_count > 0 ? "indexed" : "empty",
  };
}

export async function listDocuments() {
  const data = unwrap(await documentsApi.listDocuments());
  // Newest first.
  return (data || [])
    .map(toDocument)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function removeDocument(id) {
  unwrap(await documentsApi.deleteDocument(id));
  return id;
}

export async function uploadDocument(file, onProgress) {
  return unwrap(await documentsApi.uploadDocument(file, onProgress));
}
