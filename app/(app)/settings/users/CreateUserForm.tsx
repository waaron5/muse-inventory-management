"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inviteUser } from "@/app/(app)/settings/user-actions";

type InviteRole = "USER" | "ADMIN";

export function CreateUserForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("USER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    const result = await inviteUser({ email, role });

    setLoading(false);

    if ("error" in result) {
      setError(result.error);
    } else {
      setSuccessMessage(
        result.message ??
          "Invite sent. The user can create their profile and password from the email link.",
      );
      setEmail("");
      setRole("USER");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="inv-form">
      <div className="form-grid">
        <div className="form-field">
          <label className="form-label" htmlFor="cu-email">
            Email *
          </label>
          <input
            id="cu-email"
            type="email"
            className="form-input"
            autoComplete="off"
            required
            maxLength={200}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="cu-role">
            Role *
          </label>
          <select
            id="cu-role"
            className="form-input"
            value={role}
            onChange={(e) => setRole(e.target.value as InviteRole)}
            required
          >
            <option value="USER">Team Member</option>
            <option value="ADMIN">Administrator</option>
          </select>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      {successMessage && (
        <p
          style={{
            marginTop: 12,
            fontSize: 14,
            color: "var(--color-success, #16a34a)",
            fontWeight: 500,
          }}
        >
          {successMessage}
        </p>
      )}

      <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-outline" onClick={() => router.push("/settings")}>
          Cancel
        </button>
        <button type="submit" className="btn btn-dark" disabled={loading}>
          {loading ? "Sending..." : "Send Invite"}
        </button>
      </div>
    </form>
  );
}
