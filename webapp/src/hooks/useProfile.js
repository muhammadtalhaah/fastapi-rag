import { useMutation, useQueryClient } from "@tanstack/react-query";
import { profileService } from "@/services";
import { AUTH_ME_KEY, useToast } from "@/context";

// Profile mutations for the Account settings panel: save a changed field
// (nickname / work / instructions) on blur, and shuffle the avatar on click.
//
// Both write the returned profile straight into the auth `/me` cache via
// setQueryData(AUTH_ME_KEY, ...), so the new name/avatar reflect everywhere the
// `user` object is read (sidebar, account menu) without a refetch. We MERGE onto
// the existing cached user so fields the profile endpoint doesn't echo (none
// today, but defensive) are preserved. A success toast fires on each save; an
// error toast surfaces the server message.
export function useProfile() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const applyToCache = (profile) => {
    queryClient.setQueryData(AUTH_ME_KEY, (prev) =>
      prev ? { ...prev, ...profile } : profile,
    );
  };

  const save = useMutation({
    mutationFn: (changes) => profileService.updateProfile(changes),
    onSuccess: (profile) => {
      applyToCache(profile);
      showToast("Saved successfully", { variant: "success" });
    },
    onError: (error) => {
      showToast(error?.message || "Couldn't save your changes.", { variant: "error" });
    },
  });

  const shuffleAvatar = useMutation({
    mutationFn: () => profileService.shuffleAvatar(),
    onSuccess: (profile) => {
      applyToCache(profile);
      showToast("Saved successfully", { variant: "success" });
    },
    onError: (error) => {
      showToast(error?.message || "Couldn't update your avatar.", { variant: "error" });
    },
  });

  return {
    saveField: save.mutate,
    isSaving: save.isPending,
    shuffleAvatar: shuffleAvatar.mutate,
    isShufflingAvatar: shuffleAvatar.isPending,
  };
}
