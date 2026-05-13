"use client";

import { type FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { acceptInvite } from "./actions";

export function InviteAcceptClient({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const result = await acceptInvite({
      token,
      firstName,
      lastName,
      password,
      confirmPassword,
    });

    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }

    const signInResult = await signIn("credentials", {
      email: result.email,
      password,
      redirect: false,
      callbackUrl: "/events",
    });

    setLoading(false);

    if (signInResult?.error) {
      router.push("/login");
      router.refresh();
      return;
    }

    router.push("/events");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <div className="form-field">
        <label htmlFor="invite-email" className="form-label">
          Email
        </label>
        <input id="invite-email" className="form-input" value={email} disabled />
      </div>

      <div className="form-field">
        <label htmlFor="invite-first-name" className="form-label">
          First Name
        </label>
        <input
          id="invite-first-name"
          type="text"
          className="form-input"
          autoComplete="given-name"
          required
          maxLength={100}
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
        />
      </div>

      <div className="form-field">
        <label htmlFor="invite-last-name" className="form-label">
          Last Name
        </label>
        <input
          id="invite-last-name"
          type="text"
          className="form-input"
          autoComplete="family-name"
          required
          maxLength={100}
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
        />
      </div>

      <div className="form-field">
        <label htmlFor="invite-password" className="form-label">
          Password
        </label>
        <input
          id="invite-password"
          type="password"
          className="form-input"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      <div className="form-field">
        <label htmlFor="invite-confirm-password" className="form-label">
          Confirm Password
        </label>
        <input
          id="invite-confirm-password"
          type="password"
          className="form-input"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </div>

      {error && <p className="login-error">{error}</p>}

      <button type="submit" disabled={loading} className="btn btn-primary login-btn">
        {loading ? "Creating account..." : "Create Password"}
      </button>
    </form>
  );
}
