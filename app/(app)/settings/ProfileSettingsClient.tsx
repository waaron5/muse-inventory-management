"use client";

import { type FormEvent, useRef, useState } from "react";
import Image from "next/image";
import { useToast } from "@/components/Toast";
import { EditIcon } from "@/components/DetailHeaderActions";
import { updateAvatarUrl, updateEmail, updateProfileSettings } from "./actions";

interface ProfileSettingsClientProps {
  firstName: string;
  lastName: string;
  email: string;
  roleLabel: string;
  avatarUrl: string | null;
}

type EditingField = "name" | "email" | null;

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function ProfileSettingsClient({
  firstName,
  lastName,
  email,
  roleLabel,
  avatarUrl,
}: ProfileSettingsClientProps) {
  const { toast } = useToast();

  const initialFullName = [firstName, lastName].filter(Boolean).join(" ");
  const [savedName, setSavedName] = useState(initialFullName);
  const [draftName, setDraftName] = useState(initialFullName);
  const [savedEmail, setSavedEmail] = useState(email);
  const [draftEmail, setDraftEmail] = useState(email);
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(avatarUrl);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initials =
    initialFullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "ME";

  function startEdit(field: EditingField) {
    setDraftName(savedName);
    setDraftEmail(savedEmail);
    setError("");
    setEditingField(field);
  }

  function cancelEdit() {
    setError("");
    setEditingField(null);
  }

  async function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!e.target.files) return;
    e.target.value = "";
    if (!file) return;

    setAvatarUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/avatar-image", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      await updateAvatarUrl(data.imageUrl);
      setCurrentAvatarUrl(data.imageUrl);
      toast("Photo updated");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to upload photo.", "error");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleRemoveAvatar() {
    setAvatarUploading(true);
    try {
      await updateAvatarUrl(null);
      setCurrentAvatarUrl(null);
      toast("Photo removed");
    } catch {
      toast("Failed to remove photo.", "error");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleSaveName(event: FormEvent) {
    event.preventDefault();
    const trimmed = draftName.trim();
    if (!trimmed) {
      setError("Name cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      const parts = trimmed.replace(/\s+/g, " ").split(" ");
      await updateProfileSettings({
        firstName: parts[0],
        lastName: parts.slice(1).join(" "),
      });
      setSavedName(trimmed.replace(/\s+/g, " "));
      setEditingField(null);
      toast("Name updated");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update name";
      setError(msg);
      toast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEmail(event: FormEvent) {
    event.preventDefault();
    const trimmed = draftEmail.trim();
    setSaving(true);
    try {
      await updateEmail(trimmed);
      setSavedEmail(trimmed.toLowerCase());
      setEditingField(null);
      toast("Email updated");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update email";
      setError(msg);
      toast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-profile-layout">
      <div className="settings-avatar-section">
        <div className="settings-avatar-preview">
          {currentAvatarUrl ? (
            <Image
              src={currentAvatarUrl}
              alt=""
              className="settings-avatar-preview-photo"
              fill
              sizes="120px"
            />
          ) : (
            initials
          )}
        </div>
        <div className="settings-avatar-controls">
          <button
            type="button"
            className="settings-avatar-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
          >
            {avatarUploading ? "Uploading…" : currentAvatarUrl ? "Change photo" : "Upload photo"}
          </button>
          {currentAvatarUrl && (
            <button
              type="button"
              className="settings-avatar-remove-btn"
              onClick={handleRemoveAvatar}
              disabled={avatarUploading}
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleAvatarFileChange}
          aria-label="Upload profile photo"
        />
      </div>

      <div className="detail-fields">
        <div className="detail-row">
          <span className="detail-label">Full Name</span>
          {editingField === "name" ? (
            <form className="settings-field-inline-edit" onSubmit={handleSaveName}>
              <div className="settings-inline-input-row">
                <input
                  className="form-input"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  maxLength={200}
                  disabled={saving}
                  autoFocus
                  autoComplete="name"
                />
                <div className="settings-inline-actions">
                  <button
                    type="submit"
                    className="settings-inline-btn settings-inline-btn-save"
                    disabled={saving}
                    aria-label="Save name"
                  >
                    <CheckIcon />
                  </button>
                  <button
                    type="button"
                    className="settings-inline-btn"
                    onClick={cancelEdit}
                    disabled={saving}
                    aria-label="Cancel"
                  >
                    <XIcon />
                  </button>
                </div>
              </div>
              {error && <p className="form-error">{error}</p>}
            </form>
          ) : (
            <span className="settings-field-value">
              <span>{savedName || "—"}</span>
              <button
                type="button"
                className="settings-edit-trigger"
                onClick={() => startEdit("name")}
                aria-label="Edit name"
              >
                <EditIcon />
              </button>
            </span>
          )}
        </div>

        <div className="detail-row">
          <span className="detail-label">Email</span>
          {editingField === "email" ? (
            <form className="settings-field-inline-edit" onSubmit={handleSaveEmail}>
              <div className="settings-inline-input-row">
                <input
                  className="form-input"
                  value={draftEmail}
                  onChange={(e) => setDraftEmail(e.target.value)}
                  type="email"
                  maxLength={200}
                  disabled={saving}
                  autoFocus
                  autoComplete="email"
                />
                <div className="settings-inline-actions">
                  <button
                    type="submit"
                    className="settings-inline-btn settings-inline-btn-save"
                    disabled={saving}
                    aria-label="Save email"
                  >
                    <CheckIcon />
                  </button>
                  <button
                    type="button"
                    className="settings-inline-btn"
                    onClick={cancelEdit}
                    disabled={saving}
                    aria-label="Cancel"
                  >
                    <XIcon />
                  </button>
                </div>
              </div>
              {error && <p className="form-error">{error}</p>}
            </form>
          ) : (
            <span className="settings-field-value">
              <span>{savedEmail}</span>
              <button
                type="button"
                className="settings-edit-trigger"
                onClick={() => startEdit("email")}
                aria-label="Edit email"
              >
                <EditIcon />
              </button>
            </span>
          )}
        </div>

        <div className="detail-row">
          <span className="detail-label">Role</span>
          <span>{roleLabel}</span>
        </div>
      </div>
    </div>
  );
}
