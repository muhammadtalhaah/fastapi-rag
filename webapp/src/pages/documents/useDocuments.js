import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { documentService } from "@/services";

export const DOCUMENTS_KEY = ["documents"];

// Server state lives in the query cache; the delete mutation invalidates it on
// success so the table reflects the backend without a manual refetch.
export function useDocuments() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: DOCUMENTS_KEY,
    queryFn: documentService.listDocuments,
  });

  const deletion = useMutation({
    mutationFn: documentService.removeDocument,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY }),
  });

  return {
    documents: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    deleteDocument: deletion.mutate,
    deletingId: deletion.isPending ? deletion.variables : null,
    deleteError: deletion.isError ? deletion.error : null,
  };
}
