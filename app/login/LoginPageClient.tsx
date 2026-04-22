"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export function LoginPageClient({
  callbackUrl,
  isDemo,
}: {
  callbackUrl: string;
  isDemo: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function fillCredentials(demoEmail: string, demoPassword: string) {
    setEmail(demoEmail);
    setPassword(demoPassword);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setErrorCode(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setErrorCode(result.error);
      if (result.error === "CredentialsSignin") {
        setError("Invalid email or password.");
      } else {
        setError(
          isDemo
            ? "Sign-in failed. Check demo env vars and seeded demo data."
            : "Sign-in failed. Check server auth configuration."
        );
      }
    } else {
      router.push(callbackUrl);
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
            width={165}
            height={40}
            style={{ width: "auto", height: 40, objectFit: "contain" }}
            priority
          />
        </div>
        <h1 className="login-title">Sign in</h1>

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

          {error && (
            <p className="login-error">
              {error}
              {isDemo && errorCode ? ` (${errorCode})` : null}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary login-btn">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {isDemo && (
          <div className="demo-credentials">
            <h3>Demo Accounts</h3>
            <div className="demo-credentials-accounts">
              <div className="demo-credentials-account">
                <span className="demo-role">Admin</span>
                <span className="demo-email">admin@muse.local</span>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => fillCredentials("admin@muse.local", "admin123")}
                >
                  Use
                </button>
              </div>
              <div className="demo-credentials-account">
                <span className="demo-role">User</span>
                <span className="demo-email">user@muse.local</span>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => fillCredentials("user@muse.local", "user123")}
                >
                  Use
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
