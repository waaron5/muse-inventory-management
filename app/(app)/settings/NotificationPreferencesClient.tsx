"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";
import { updateEmailNotificationPreference } from "./actions";

export function NotificationPreferencesClient({
  initialEmailEnabled,
}: {
  initialEmailEnabled: boolean;
}) {
  const { toast } = useToast();
  const [emailEnabled, setEmailEnabled] = useState(initialEmailEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(checked: boolean) {
    const previousValue = emailEnabled;
    setError("");
    setEmailEnabled(checked);
    setSaving(true);

    try {
      await updateEmailNotificationPreference(checked);
      toast("Notification preferences updated");
    } catch {
      setEmailEnabled(previousValue);
      setError("Unable to update notification preferences. Try again.");
      toast("Unable to update notification preferences", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="settings-toggle-list">
        <label className="settings-toggle-row">
          <span className="settings-toggle-copy">
            <span className="settings-toggle-title">Email notifications</span>
            <span className="settings-toggle-description">
              Receive email updates when your reservation requests are approved or rejected.
            </span>
            {saving && <span className="settings-toggle-status">Saving preference...</span>}
          </span>
          <span className="settings-switch">
            <input
              type="checkbox"
              className="settings-switch-input"
              checked={emailEnabled}
              disabled={saving}
              onChange={(e) => handleChange(e.target.checked)}
            />
            <span className="settings-switch-track" aria-hidden="true">
              <span className="settings-switch-thumb" />
            </span>
          </span>
        </label>

        <div className="settings-toggle-row settings-toggle-row-readonly">
          <span className="settings-toggle-copy">
            <span className="settings-toggle-title">In-app notifications</span>
            <span className="settings-toggle-description">
              Dashboard alerts for pending approvals and overdue returns stay enabled for all users.
            </span>
          </span>
          <span className="settings-toggle-fixed">Always on</span>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
    </>
  );
}
