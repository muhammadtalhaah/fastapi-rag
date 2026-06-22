import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Library, RotateCw, Plus } from "lucide-react";
import { PageHeader, StateBlock, AppButton } from "@/components/shared";
import { ROUTES } from "@/config";
import { useDocuments } from "@/hooks";
import DocumentRow from "./DocumentRow";
import ConfirmDelete from "./ConfirmDelete";

const DocumentsPage = () => {
  const navigate = useNavigate();
  const {
    documents,
    isLoading,
    isError,
    error,
    refetch,
    deleteDocument,
    deletingId,
  } = useDocuments();
  const [pendingDelete, setPendingDelete] = useState(null);

  const confirmDelete = (id) => {
    deleteDocument(id);
    setPendingDelete(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="02 · Documents"
        title="The collection"
        lede="Files indexed for retrieval. Each answer in Ask can only cite what lives here."
        actions={
          <AppButton onClick={() => navigate(ROUTES.UPLOAD)}>
            <Plus size={16} aria-hidden="true" />
            Upload
          </AppButton>
        }
      />

      {isLoading ? (
        <StateBlock variant="loading" message="Reading the collection…" />
      ) : isError ? (
        <StateBlock
          variant="error"
          icon={Library}
          title="Couldn’t load documents"
          message={error?.message}
          action={
            <AppButton variant="ghost" onClick={() => refetch()}>
              <RotateCw size={15} aria-hidden="true" />
              Retry
            </AppButton>
          }
        />
      ) : documents.length === 0 ? (
        <StateBlock
          variant="empty"
          icon={Library}
          title="The collection is empty"
          message="Upload a PDF, text, Markdown, or Word file to make it searchable."
          action={
            <AppButton onClick={() => navigate(ROUTES.UPLOAD)}>
              <Plus size={16} aria-hidden="true" />
              Upload a document
            </AppButton>
          }
        />
      ) : (
        <div className="border border-rule">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-rule bg-surface/60 text-left">
                <Th>Filename</Th>
                <Th className="hidden sm_tablet:table-cell">Added</Th>
                <Th className="hidden lg_tablet:table-cell">Size</Th>
                <Th>Index</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  onDelete={setPendingDelete}
                  isDeleting={deletingId === doc.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingDelete ? (
        <ConfirmDelete
          document={pendingDelete}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  );
};

const Th = ({ children, className = "" }) => (
  <th
    className={`px-4 py-2.5 font-mono text-[0.7rem] font-medium uppercase tracking-[0.15em] text-muted ${className}`}
  >
    {children}
  </th>
);

export default DocumentsPage;
