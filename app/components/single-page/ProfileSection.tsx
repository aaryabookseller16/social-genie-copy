"use client";

import { useEffect, useState } from "react";

import { type ConsumerAccount } from "@/app/lib/localState";

type ProfileSectionProps = {
  visible: boolean;
  account: ConsumerAccount | null;
  onBack: () => void;
  onSave: (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  }) => Promise<void>;
};

function BackArrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M19 12H6m0 0 5-5m-5 5 5 5" />
    </svg>
  );
}

function ProfileRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-center justify-between rounded-[18px] border border-gray-100 bg-white px-4 py-3.5 dark:border-white/10 dark:bg-black/20">
      <span className="text-sm font-medium text-gray-500 dark:text-white/55">
        {label}
      </span>
      <span className="text-sm font-semibold text-gray-900 dark:text-white">
        {value || "—"}
      </span>
    </div>
  );
}

function StyledInput({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  type?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-600 dark:text-white/72">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#ff6a6a]"
      />
    </label>
  );
}

export function ProfileSection({
  visible,
  account,
  onBack,
  onSave,
}: ProfileSectionProps) {
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible && account) {
      setFirstName(account.firstName ?? "");
      setLastName(account.lastName ?? "");
      setEmail(account.email ?? "");
      setPhone(account.phone ?? "");
      setStatusMsg(null);
    }
    if (!visible) {
      setEditing(false);
      setStatusMsg(null);
    }
  }, [visible, account]);

  if (!visible) return null;

  if (editing) {
    return (
      <section className="flex flex-1 flex-col pb-4">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing(false)}
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 dark:border-white/12 dark:bg-black/24 dark:text-white/82"
          >
            <BackArrow />
          </button>
          <h2 className="flex-1 text-center pr-9 font-[family:var(--font-display)] text-[1.35rem] font-semibold text-gray-900 dark:text-white">
            Edit Profile
          </h2>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <StyledInput
            label="First Name"
            value={firstName}
            placeholder="First name"
            onChange={setFirstName}
          />
          <StyledInput
            label="Last Name"
            value={lastName}
            placeholder="Last name"
            onChange={setLastName}
          />
          <StyledInput
            label="Email"
            value={email}
            placeholder="Email address"
            type="email"
            onChange={setEmail}
          />
          <StyledInput
            label="Phone"
            value={phone}
            placeholder="Phone number"
            type="tel"
            onChange={setPhone}
          />
        </div>

        {statusMsg ? (
          <p className="mt-3 text-center text-sm text-red-500 dark:text-[#ff9f9f]">
            {statusMsg}
          </p>
        ) : null}

        <button
          type="button"
          onClick={async () => {
            setSaving(true);
            setStatusMsg(null);
            try {
              await onSave({ firstName, lastName, email, phone });
              setEditing(false);
            } catch (error) {
              setStatusMsg(
                error instanceof Error ? error.message : "Could not save changes."
              );
            } finally {
              setSaving(false);
            }
          }}
          disabled={saving}
          className="mt-8 w-full rounded-[20px] border border-red-500 bg-red-600 px-4 py-3.5 text-[15px] font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col pb-4">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 dark:border-white/12 dark:bg-black/24 dark:text-white/82"
        >
          <BackArrow />
        </button>
        <h2 className="font-[family:var(--font-display)] text-[1.35rem] font-semibold text-gray-900 dark:text-white">
          My Profile
        </h2>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-full border border-red-200 bg-transparent px-4 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-white/20 dark:text-white/82 dark:hover:bg-white/10"
        >
          Edit
        </button>
      </div>

      {/* Avatar placeholder */}
      <div className="mb-6 flex flex-col items-center gap-2">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-red-200 bg-red-50 text-[2rem] font-bold text-red-600 dark:border-white/20 dark:bg-black/30 dark:text-white">
          {(account?.firstName?.[0] ?? "?").toUpperCase()}
        </div>
        <p className="text-base font-semibold text-gray-900 dark:text-white">
          {[account?.firstName, account?.lastName].filter(Boolean).join(" ") || "Guest"}
        </p>
        <span className="rounded-full border border-red-200 bg-red-50 px-3 py-0.5 text-xs font-medium text-red-600 capitalize dark:border-white/15 dark:bg-black/20 dark:text-[#ff9d7d]">
          {account?.membership ?? "free"}
        </span>
      </div>

      {/* Info rows */}
      <div className="space-y-3">
        <ProfileRow
          label="First Name"
          value={account?.firstName}
        />
        <ProfileRow
          label="Last Name"
          value={account?.lastName}
        />
        <ProfileRow
          label="Email"
          value={account?.email}
        />
        <ProfileRow
          label="Phone"
          value={account?.phone}
        />
      </div>
    </section>
  );
}
