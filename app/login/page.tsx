"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <Image
            src="/muse-logo.png"
            alt="Muse"
            width={120}
            height={40}
            style={{ objectFit: "contain" }}
            priority
          />
        </div>
        <h1 className="login-title">Sign in</h1>
        <p className="login-subtitle">Access the Muse Event Management system</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-field">
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              placeholder="you@muse.local"
            />
          </div>

          <div className="form-field">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" disabled={loading} className="btn btn-primary login-btn">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f9fafb;
          padding: 24px;
        }
        .login-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 40px;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
        }
        .login-logo {
          margin-bottom: 28px;
        }
        .login-title {
          font-size: 22px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 6px;
        }
        .login-subtitle {
          font-size: 14px;
          color: #6b7280;
          margin: 0 0 28px;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .form-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-label {
          font-size: 13px;
          font-weight: 500;
          color: #374151;
        }
        .form-input {
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 9px 12px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
        }
        .form-input:focus {
          border-color: #00b4d8;
          box-shadow: 0 0 0 3px rgba(0, 180, 216, 0.1);
        }
        .login-error {
          background: #fee2e2;
          border: 1px solid #fca5a5;
          border-radius: 6px;
          padding: 10px 12px;
          font-size: 13px;
          color: #991b1b;
          margin: 0;
        }
        .login-btn {
          width: 100%;
          margin-top: 4px;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border: none;
          border-radius: 8px;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s, opacity 0.15s;
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn-primary {
          background: #111827;
          color: white;
        }
        .btn-primary:hover:not(:disabled) {
          background: #1f2937;
        }
      `}</style>
    </div>
  );
}
