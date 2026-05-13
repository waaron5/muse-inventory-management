"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUser } from "@/app/(app)/settings/user-actions";

export function CreateUserForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    const result = await createUser({ firstName, lastName, email, password });

    setLoading(false);

    if ("error" in result) {
      setError(result.error);
    } else {
      setSuccess(true);
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="inv-form">
      <div className="form-grid">
        <div className="form-field">
          <label className="form-label" htmlFor="cu-first-name">
            First Name *
          </label>
          <input
            id="cu-first-name"
            type="text"
            className="form-input"
            autoComplete="given-name"
            required
            maxLength={100}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Jane"
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="cu-last-name">
            Last Name *
          </label>
          <input
            id="cu-last-name"
            type="text"
            className="form-input"
            autoComplete="family-name"
            required
            maxLength={100}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Smith"
          />
        </div>

        <div className="form-field form-field-wide">
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

        <div className="form-field form-field-wide">
          <label className="form-label" htmlFor="cu-password">
            Initial Password *
          </label>
          <input
            id="cu-password"
            type="password"
            className="form-input"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
          />
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      {success && (
        <p
          style={{
            marginTop: 12,
            fontSize: 14,
            color: "var(--color-success, #16a34a)",
            fontWeight: 500,
          }}
        >
          User created successfully. Share their credentials with them to log in.
        </p>
      )}

      <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-outline" onClick={() => router.push("/settings")}>
          Cancel
        </button>
        <button type="submit" className="btn btn-dark" disabled={loading}>
          {loading ? "Creating…" : "Create User"}
        </button>
      </div>
    </form>
  );
}
