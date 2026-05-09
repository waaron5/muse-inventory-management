"use client";

import { type FormEvent, useState } from "react";
import { useToast } from "@/components/Toast";
import { EditIcon } from "@/components/DetailHeaderActions";
import { updateEmail, updateProfileSettings } from "./actions";

interface ProfileSettingsClientProps {
  firstName: string;
  lastName: string;
  email: string;
  roleLabel: string;
}

type EditingField = "name" | "email" | null;

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function ProfileSettingsClient({
  firstName,
  lastName,
  email,
  roleLabel,
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
  );
}
