"use client";

import { useState } from "react";
import { updateEmailNotificationPreference } from "./actions";

export function NotificationPreferencesClient({
  initialEmailEnabled,
}: {
  initialEmailEnabled: boolean;
}) {
  const [emailEnabled, setEmailEnabled] = useState(initialEmailEnabled);

  async function handleChange(checked: boolean) {
    setEmailEnabled(checked); // optimistic
    try {
      await updateEmailNotificationPreference(checked);
    } catch {
      setEmailEnabled(!checked); // revert on error
    }
  }

  return (
    <div className="settings-toggle-list">
      <label className="settings-toggle-row">
        <span className="settings-toggle-copy">
          <span className="settings-toggle-title">Reservation approvals</span>
          <span className="settings-toggle-description">
            Receive an email when your requests are approved or rejected.
          </span>
        </span>
        <input
          type="checkbox"
          className="settings-checkbox"
          checked={emailEnabled}
          onChange={(e) => handleChange(e.target.checked)}
        />
      </label>

      <label className="settings-toggle-row">
        <span className="settings-toggle-copy">
          <span className="settings-toggle-title">Overdue return reminders</span>
          <span className="settings-toggle-description">
            Highlight items and events that need follow-up attention. Shown in-app only.
          </span>
        </span>
        <input
          type="checkbox"
          className="settings-checkbox"
          defaultChecked
          disabled
        />
      </label>
    </div>
  );
}
