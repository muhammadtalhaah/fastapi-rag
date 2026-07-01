import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getInitials } from "@/helpers";
import { AppInput, AppSelect, Spinner } from "@/components/shared";
import { useTranslation } from "@/context";
import { useProfile } from "@/hooks";
import SettingsRow from "./SettingsRow";
import { WORK_OPTIONS } from "./settingsData";

// Account tab of the Settings modal: avatar + editable full name, an editable
// nickname, a "what describes your work" select, and a free-text instructions
// box.
//
// Edits are buffered locally and flushed in a SINGLE PATCH when the modal
// closes, rather than one request per field on every blur/change — no redundant
// DB calls while the user is still typing or tabbing between fields. The parent
// owns the close action, so we hand it a `flush()` via `flushRef` that it calls
// on every close path (X, backdrop, Escape); flush diffs the buffers against the
// stored user and saves only what actually changed (and nothing if unchanged).
// The avatar is the exception — clicking it shuffles to a fresh random image and
// saves immediately, since it's an explicit action with its own spinner/toast.
// All writes update the auth `/me` cache so the new name/avatar reflect across
// the app.

// Clickable avatar: shows the saved image (or initials fallback) with a hover
// overlay inviting a shuffle, and a spinner while the shuffle is in flight.
const Avatar = ({ user, onShuffle, isShuffling }) => (
  <button
    type="button"
    onClick={onShuffle}
    disabled={isShuffling}
    aria-label="Shuffle avatar"
    title="Click for a new avatar"
    className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-1 ring-rule transition-opacity disabled:opacity-60"
  >
    {user?.profileUrl ? (
      <img
        src={user.profileUrl}
        alt={user.name}
        className="h-full w-full object-cover"
      />
    ) : (
      <span className="flex h-full w-full items-center justify-center bg-ground font-mono text-lg text-primary">
        {getInitials(user?.name)}
      </span>
    )}
    {/* Hover/active affordance: a dim scrim with a shuffle icon. */}
    <span className="absolute inset-0 flex items-center justify-center bg-ground/70 opacity-0 transition-opacity group-hover:opacity-100">
      {isShuffling ? (
        <Spinner size={16} />
      ) : (
        <RefreshCw size={16} className="text-ink" aria-hidden="true" />
      )}
    </span>
  </button>
);

const inputClass =
  "w-64 max-w-full border border-rule bg-ground px-3 py-2 text-sm text-ink transition-colors placeholder:text-muted focus-within:border-primary focus-within:outline-none";

const AccountSettings = ({ user }) => {
  const { t } = useTranslation();
  const { saveField, shuffleAvatar, isShufflingAvatar } = useProfile();

  // Local edit buffers, seeded from the live user record. The parent keys this
  // component on the profile fields, so when they change server-side (a save
  // round-trip, an avatar shuffle, a cross-device edit) the component remounts
  // with fresh initial state — no syncing effect needed.
  const [name, setName] = useState(user?.name ?? "");
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [work, setWork] = useState(user?.work ?? "");
  const [instructions, setInstructions] = useState(user?.instructions ?? "");

  // Mirror everything the unmount flush needs into a ref so the cleanup (which
  // runs with deps captured at mount) reads the LATEST buffers and stored user,
  // never a stale closure. Synced in an effect — refs must not be written during
  // render — so it holds the last committed render's values when unmount fires.
  const latest = useRef({ user, name, nickname, work, instructions });
  useEffect(() => {
    latest.current = { user, name, nickname, work, instructions };
  });

  // Diff the buffers against the stored user and PATCH only what changed, in one
  // request — fired on unmount (closing the modal, or switching away from the
  // Account tab). `name` is required by the backend, so a blank name is dropped
  // from the patch (the field reverts to the stored value on blur anyway). No
  // network call at all when nothing changed — the whole point of deferring.
  useEffect(() => {
    return () => {
      const { user, name, nickname, work, instructions } = latest.current;
      const next = {
        name: name.trim(),
        nickname: nickname.trim(),
        work,
        instructions: instructions.trim(),
      };
      const changes = {};
      for (const [field, value] of Object.entries(next)) {
        if (field === "name" && !value) continue;
        if (value !== (user?.[field] ?? "")) changes[field] = value;
      }
      if (Object.keys(changes).length) saveField(changes);
    };
    // Mount-once: the cleanup reads live values from `latest` on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h3 className=" font-mono text-xs uppercase tracking-[0.25em] text-primary">
        {t("profile")}
      </h3>

      <SettingsRow label={t("avatar")}>
        <Avatar
          user={user}
          onShuffle={() => shuffleAvatar()}
          isShuffling={isShufflingAvatar}
        />
      </SettingsRow>

      <SettingsRow label={t("fullName")} htmlFor="settings-name">
        <AppInput
          id="settings-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          // The backend requires a name, so an empty buffer resets back to the
          // stored value on blur. The actual save is deferred to flush-on-close.
          onBlur={() => {
            if (!name.trim()) setName(user?.name ?? "");
          }}
          placeholder={t("fullName")}
          maxLength={200}
          className={inputClass}
        />
      </SettingsRow>

      <SettingsRow label={t("callYou")} htmlFor="settings-nickname">
        <AppInput
          id="settings-nickname"
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder={t("preferredName")}
          maxLength={60}
          className={inputClass}
        />
      </SettingsRow>

      <SettingsRow label={t("workDescribe")}>
        <AppSelect
          size={"large"}
          value={work}
          variant={"borderless"}
          onChange={(value) => setWork(value)}
          options={WORK_OPTIONS}
          className="w-fit !text-sm"
        />
      </SettingsRow>

      {/* Instructions — stacked so the textarea spans the full panel width, with
          the same "kept in mind across chats" helper line as the screenshot. */}
      <SettingsRow
        stacked
        label={t("instructions")}
        htmlFor="settings-instructions"
        hint={t("instructionsHint")}
      >
        <AppInput
          textarea
          id="settings-instructions"
          rows={4}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={t("instructionsPlaceholder")}
          maxLength={2000}
          className={`${inputClass} w-full resize-none`}
        />
      </SettingsRow>
    </div>
  );
};

export default AccountSettings;
