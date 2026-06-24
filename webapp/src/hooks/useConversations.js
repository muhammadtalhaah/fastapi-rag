import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { conversationService } from "@/services";
import { useAuth } from "@/context";

export const CONVERSATIONS_KEY = ["conversations"];

const toSummary = (raw) => ({
  id: raw.id,
  title: raw.title || "Untitled",
  updatedAt: raw.updated_at || raw.created_at || null,
  isGeneratingTitle: false,
});

// Durable chat history for the logged-in user. The list is server state in the
// query cache; it's only fetched when authenticated (guests have no history).
// A completed chat turn calls `refresh()` so a brand-new conversation appears in
// the sidebar without a manual reload.
export function useConversations() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: async () => {
      const list = await conversationService.listConversations();
      return list.map(toSummary);
    },
    enabled: isAuthenticated,
  });

  const deletion = useMutation({
    mutationFn: conversationService.deleteConversation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY }),
  });

  const setConversations = (updater) => {
    queryClient.setQueryData(CONVERSATIONS_KEY, (current) => {
      const list = Array.isArray(current) ? current : [];
      return updater(list);
    });
  };

  const upsertConversation = (conversation) => {
    setConversations((current) => {
      const existing = current.find((item) => item.id === conversation.id);
      const merged = {
        updatedAt: conversation.updatedAt ?? new Date().toISOString(),
        ...existing,
        ...conversation,
      };
      const rest = current.filter((item) => item.id !== conversation.id);
      return [merged, ...rest];
    });
  };

  const patchConversation = (conversationId, patch) => {
    setConversations((current) =>
      current.map((item) =>
        item.id === conversationId
          ? {
              ...item,
              ...patch,
            }
          : item,
      ),
    );
  };

  const rename = useMutation({
    mutationFn: ({ id, title }) => conversationService.updateConversation(id, { title }),
    onMutate: async ({ id, title }) => {
      const previous = queryClient.getQueryData(CONVERSATIONS_KEY);
      patchConversation(id, { title, isGeneratingTitle: false });
      return { previous };
    },
    onSuccess: (updated) => patchConversation(updated.id, {
      title: updated.title,
      updatedAt: updated.updatedAt,
      isGeneratingTitle: false,
    }),
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(CONVERSATIONS_KEY, context.previous);
      }
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });

  return {
    conversations: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refresh,
    upsertConversation,
    renameConversation: rename.mutate,
    renamingId: rename.isPending ? rename.variables?.id : null,
    deleteConversation: deletion.mutate,
    deletingId: deletion.isPending ? deletion.variables : null,
  };
}
