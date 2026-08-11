"use client";

import { type ReactNode, useEffect, useState } from "react";

import { BackIcon } from "@/app/components/single-page/ui";
import ImageUploader from "@/app/components/ImageUploader";
import ImageLightbox from "@/app/components/ImageLightbox";
import { type ConsumerAccount } from "@/app/lib/localState";
import { type SocialProfile } from "@/app/lib/publicApiClient";

type ProfileSectionProps = {
  visible: boolean;
  account: ConsumerAccount | null;
  socialProfile?: SocialProfile | null;
  isVibeeMember?: boolean;
  onBack: () => void;
  onSave: (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    displayName: string;
    avatarUrl: string;
  }) => Promise<void>;
  onEditPreferences?: () => void;
  onOpenMembership?: () => void;
  onUpgradeMembership?: () => void;
  onOpenNotifications?: () => void;
  onDeleteAccount?: () => Promise<void> | void;
};

function BackArrow() {
  return <BackIcon size={20} />;
}

function PencilIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function EditPencilButton({
  onClick,
  ariaLabel,
}: {
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-red-600 text-white shadow-[0_6px_18px_rgba(231,7,3,0.35)] transition hover:bg-red-700 dark:bg-[#E70703] dark:shadow-[0_6px_20px_rgba(231,7,3,0.45)]"
    >
      <PencilIcon size={14} />
    </button>
  );
}

function ProfileCard({
  title,
  onEdit,
  editAriaLabel,
  children,
}: {
  title: string;
  onEdit?: () => void;
  editAriaLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-[#E7070380] bg-transparent px-5 pb-5 pt-5 dark:border-[#E7070380] dark:bg-black/20">
      <div className="flex items-center justify-between">
        <h3 className="text-[1.1rem] font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        {onEdit ? (
          <EditPencilButton
            onClick={onEdit}
            ariaLabel={editAriaLabel ?? `Edit ${title}`}
          />
        ) : null}
      </div>
      <div className="mt-3 h-px bg-black/10 dark:bg-white/10" />
      <div className="mt-4">{children}</div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.82rem] text-gray-500 dark:text-white/55">{label}</p>
      <p className="mt-1 text-[1rem] font-medium text-gray-900 dark:text-white">
        {value || "—"}
      </p>
    </div>
  );
}

/**
 * WhatsApp-style opt-out for DM push notifications. Reads (and, on first read,
 * initializes) the current user's preferences, then toggles `notify_new_message`.
 * Uses the same per-user notification-preferences endpoints the producer
 * settings screen uses — the GET must run before the POST (it seeds defaults).
 */
function BellIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-red-600 dark:text-[#E70703]"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function ChevronRightIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-gray-400 dark:text-white/40"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function formatTagList(tags: unknown): string {
  // Backend can hand us an array, a JSON-encoded string, a comma-separated
  // string, or nothing at all — normalize everything to an array of strings.
  let list: string[] = [];
  if (Array.isArray(tags)) {
    list = tags.filter((t): t is string => typeof t === "string");
  } else if (typeof tags === "string") {
    const trimmed = tags.trim();
    if (!trimmed) return "—";
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          list = parsed.filter((t): t is string => typeof t === "string");
        }
      } catch {
        list = trimmed.split(",").map((t) => t.trim()).filter(Boolean);
      }
    } else {
      list = trimmed.split(",").map((t) => t.trim()).filter(Boolean);
    }
  }

  if (list.length === 0) return "—";
  return list
    .map((tag) =>
      tag
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join("-")
    )
    .join(", ");
}

function DeleteAccountSheet({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-80 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Delete account confirmation"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
      />
      <div className="relative mx-auto w-full max-w-md rounded-t-[28px] bg-white bg-[url('/bg-white.png')] bg-cover bg-center bg-no-repeat px-5 pb-10 pt-3 shadow-[0_-18px_40px_rgba(0,0,0,0.18)] dark:bg-black dark:bg-[url('/bg.png')] dark:shadow-[0_-18px_40px_rgba(0,0,0,0.5)]">
        <div className="pointer-events-none absolute inset-0 hidden rounded-t-[28px] bg-black/45 dark:block" />
        <div className="relative">
          <div className="mx-auto h-1 w-12 rounded-full bg-black/25 dark:bg-white/30" />
          <div className="mt-5 flex items-start justify-between gap-3">
            <h3 className="text-[1.5rem] font-semibold text-gray-900 dark:text-white">
              Delete Account
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-black/15 text-gray-800 transition hover:bg-black/25 dark:bg-white/15 dark:text-white dark:hover:bg-white/25"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-gray-700 dark:text-white/75">
            It&apos;s hard to see you going. Are you sure you want to delete your account?
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={confirming}
              className="w-full rounded-[20px] border border-red-500 bg-red-600 px-4 py-3.5 text-[15px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
            >
              {confirming ? "Deleting..." : "Yes, delete my account"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-[20px] bg-black/10 px-4 py-3.5 text-[15px] font-semibold text-gray-900 transition hover:bg-black/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StyledInput({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
  disabled = false,
  helperText,
}: {
  label: string;
  value: string;
  placeholder: string;
  type?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  helperText?: string;
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
        disabled={disabled}
        readOnly={disabled}
        style={{ fontSize: "16px" }}
        className={`w-full rounded-[16px] border border-[#E7070380] bg-gray-50 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#E7070380] dark:bg-black/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#ff6a6a] ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      />
      {helperText ? (
        <span className="mt-1.5 block text-[11px] text-gray-400 dark:text-white/40">
          {helperText}
        </span>
      ) : null}
    </label>
  );
}

export function ProfileSection({
  visible,
  account,
  socialProfile,
  isVibeeMember = false,
  onBack,
  onSave,
  onEditPreferences,
  onOpenMembership,
  onUpgradeMembership,
  onOpenNotifications,
  onDeleteAccount,
}: ProfileSectionProps) {
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrls, setAvatarUrls] = useState<string[]>([]);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (visible && account) {
      setFirstName(account.firstName ?? "");
      setLastName(account.lastName ?? "");
      setEmail(account.email ?? "");
      setPhone(account.phone ?? "");
      setDisplayName(account.displayName ?? "");
      setAvatarUrls(account.avatarUrl ? [account.avatarUrl] : []);
      setStatusMsg(null);
    }
    if (!visible) {
      setEditing(false);
      setStatusMsg(null);
      setDeleteSheetOpen(false);
    }
  }, [visible, account]);

  if (!visible) return null;

  if (editing) {
    return (
      <section className="flex flex-1 flex-col pb-[calc(env(safe-area-inset-bottom,0px)+5.75rem)]">
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
            Edit Details
          </h2>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div className="pb-2">
            <ImageUploader
              mode="single"
              shape="circle"
              folder="avatars"
              value={avatarUrls}
              onChange={setAvatarUrls}
              onUploadingChange={setAvatarUploading}
            />
          </div>
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
            label="Display Name"
            value={displayName}
            placeholder="How Genie should greet you"
            onChange={setDisplayName}
          />
          <StyledInput
            label="Email"
            value={email}
            placeholder="Email address"
            type="email"
            onChange={setEmail}
            disabled
            helperText="Your email is how you sign in, so it can't be changed here."
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
            if (avatarUploading) {
              setStatusMsg("Please wait for your photo to finish uploading.");
              return;
            }
            setSaving(true);
            setStatusMsg(null);
            try {
              await onSave({
                firstName,
                lastName,
                email,
                phone,
                displayName,
                avatarUrl: avatarUrls[0] ?? "",
              });
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

  const fullName =
    [account?.firstName, account?.lastName].filter(Boolean).join(" ") || "";
  const membershipLabel = isVibeeMember ? "V.I.Bee" : "Free";
  const preferenceRows: Array<{ label: string; value: string }> = [
    { label: "Music", value: formatTagList(socialProfile?.music_tags) },
    { label: "Bevy Bites", value: formatTagList(socialProfile?.bevy_bites_tags) },
    { label: "Experiences", value: formatTagList(socialProfile?.experiences_tags) },
    { label: "Atmosphere", value: formatTagList(socialProfile?.atmosphere_tags) },
    { label: "Community", value: formatTagList(socialProfile?.community_tags) },
  ];

  return (
    <section className="relative flex min-h-[calc(100dvh-4rem)] flex-1 flex-col pb-4">
      {/* Header */}
      <div className="mb-6 flex items-center">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-red-600 dark:border dark:border-white/12 dark:bg-black/24 dark:text-white/82"
        >
          <BackArrow />
        </button>
        <h2 className="flex-1 pr-9 text-center font-[family:var(--font-display)] text-[1.35rem] font-semibold text-gray-900 dark:text-white">
          My Profile
        </h2>
      </div>

      <div className="space-y-5">
        {/* Details */}
        <ProfileCard
          title="Details"
          onEdit={() => setEditing(true)}
          editAriaLabel="Edit details"
        >
          <div className="space-y-4">
            {account?.avatarUrl ? (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                aria-label="View profile photo"
                className="mx-auto block h-16 w-16 cursor-pointer overflow-hidden rounded-full border-2 border-red-400 shadow-[0_0_16px_rgba(220,38,38,0.35)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={account.avatarUrl}
                  alt={account.displayName || fullName}
                  className="h-full w-full object-cover"
                />
              </button>
            ) : null}
            {lightboxOpen && account?.avatarUrl ? (
              <ImageLightbox
                src={account.avatarUrl}
                alt={account.displayName || fullName}
                onClose={() => setLightboxOpen(false)}
              />
            ) : null}
            <DetailField label="Name" value={fullName} />
            {account?.displayName ? (
              <>
                <div className="h-px bg-black/10 dark:bg-white/10" />
                <DetailField label="Display Name" value={account.displayName} />
              </>
            ) : null}
            <div className="h-px bg-black/10 dark:bg-white/10" />
            <DetailField label="Email" value={account?.email ?? ""} />
            <div className="h-px bg-black/10 dark:bg-white/10" />
            <DetailField label="Phone" value={account?.phone ?? ""} />
          </div>
        </ProfileCard>

        {/* Membership */}
        <ProfileCard
          title="Membership"
          onEdit={onOpenMembership}
          editAriaLabel="Manage membership"
        >
          <div className="space-y-4">
            <DetailField label="Currently Active" value={membershipLabel} />
            {!isVibeeMember ? (
              <button
                type="button"
                onClick={onUpgradeMembership ?? onOpenMembership}
                className="w-full rounded-[20px] border border-red-500 bg-[radial-gradient(120%_140%_at_50%_50%,#ff4d4f_0%,#E70703_45%,#860a0c_100%)] px-4 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_28px_rgba(231,7,3,0.35)] transition hover:brightness-110 dark:border-[#d75050]"
              >
                Upgrade to V.I.Bee Now
              </button>
            ) : null}
          </div>
        </ProfileCard>

        {/* Social Preferences */}
        <ProfileCard
          title="Social Preferences"
          onEdit={onEditPreferences}
          editAriaLabel="Edit social preferences"
        >
          <div className="space-y-4">
            {preferenceRows.map((row, index) => (
              <div key={row.label}>
                {index > 0 ? (
                  <div className="mb-4 h-px bg-black/10 dark:bg-white/10" />
                ) : null}
                <p className="text-[0.95rem] font-semibold text-gray-900 dark:text-white">
                  {row.label}
                </p>
                <p className="mt-1 text-[0.95rem] leading-6 text-gray-500 dark:text-white/60">
                  {row.value}
                </p>
              </div>
            ))}
          </div>
        </ProfileCard>

        {/* Notifications */}
        {onOpenNotifications ? (
          <button
            type="button"
            onClick={onOpenNotifications}
            className="flex w-full items-center justify-between rounded-[22px] border border-[#E7070380] bg-transparent px-5 py-4 text-left transition hover:bg-black/[0.02] dark:border-[#E7070380] dark:bg-black/20 dark:hover:bg-white/[0.03]"
          >
            <span className="flex items-center gap-3">
              <BellIcon />
              <span className="text-[1.1rem] font-semibold text-gray-900 dark:text-white">
                Manage Notifications
              </span>
            </span>
            <ChevronRightIcon />
          </button>
        ) : null}
      </div>

      {/* Delete my account — anchored to bottom */}
      <div className="mt-auto pt-10 text-center">
        <button
          type="button"
          onClick={() => setDeleteSheetOpen(true)}
          className="text-[14px] text-gray-500 underline-offset-2 transition hover:text-gray-700 hover:underline dark:text-white/55 dark:hover:text-white/75"
        >
          Delete my account
        </button>
      </div>

      <DeleteAccountSheet
        open={deleteSheetOpen}
        onClose={() => setDeleteSheetOpen(false)}
        onConfirm={async () => {
          if (onDeleteAccount) {
            await onDeleteAccount();
          }
          setDeleteSheetOpen(false);
        }}
      />
    </section>
  );
}
