import { useState } from "react";
import { getInitials } from "@/helpers";
import { AppSelect } from "@/components/shared";
import SettingsRow from "./SettingsRow";
import { WORK_OPTIONS, DUMMY_PROFILE } from "./settingsData";

// Account tab of the Settings modal. Mirrors the screenshot's Profile panel:
// avatar + full name (read-only, from the session user), an editable nickname,
// a "what describes your work" select, and a free-text instructions box.
//
// UI only for now — edits live in local state and there is no save endpoint yet,
// so the controls are wired to state but nothing is persisted. The `user` record
// supplies the live name/email/avatar; everything else seeds from DUMMY_PROFILE.
const Avatar = ({ user }) =>
  user?.profileUrl ? (
    <img
      src={user.profileUrl}
      alt={user.name}
      className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-rule"
    />
  ) : (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ground ring-1 ring-rule">
      <span className="font-mono text-lg text-brass">{getInitials(user?.name)}</span>
    </div>
  );

const inputClass =
  "w-64 max-w-full border border-rule bg-ground px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-retrieval focus:outline-none";

const AccountSettings = ({ user }) => {
  const [nickname, setNickname] = useState(DUMMY_PROFILE.nickname);
  const [work, setWork] = useState(DUMMY_PROFILE.work);
  const [instructions, setInstructions] = useState(DUMMY_PROFILE.instructions);

  return (
    <div>
      <h3 className="mb-2 font-mono text-xs uppercase tracking-[0.25em] text-brass">
        Profile
      </h3>

      {/* Avatar — read-only for now; the screenshot shows it as a static field. */}
      <SettingsRow label="Avatar">
        <Avatar user={user} />
      </SettingsRow>

      <SettingsRow label="Full name">
        <input
          type="text"
          value={user?.name ?? ""}
          readOnly
          aria-readonly="true"
          className={`${inputClass} cursor-default opacity-80`}
        />
      </SettingsRow>

      <SettingsRow label="What should Athenæum call you?" htmlFor="settings-nickname">
        <input
          id="settings-nickname"
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Preferred name"
          className={inputClass}
        />
      </SettingsRow>

      <SettingsRow label="What best describes your work?">
        <AppSelect
          value={work}
          onChange={setWork}
          options={WORK_OPTIONS}
          className="w-64 max-w-full"
        />
      </SettingsRow>

      {/* Instructions — stacked so the textarea spans the full panel width, with
          the same "kept in mind across chats" helper line as the screenshot. */}
      <SettingsRow
        stacked
        label="Instructions for Athenæum"
        htmlFor="settings-instructions"
        hint="Athenæum will keep these in mind across chats."
      >
        <textarea
          id="settings-instructions"
          rows={4}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="e.g. keep explanations brief and to the point"
          className="w-full resize-none border border-rule bg-ground px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-retrieval focus:outline-none"
        />
      </SettingsRow>
    </div>
  );
};

export default AccountSettings;
