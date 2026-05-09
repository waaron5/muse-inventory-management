import { LoginPageClient } from "@/app/login/LoginPageClient";

const DEFAULT_LOGIN_REDIRECT = "/events";

function normalizeCallbackUrl(callbackUrl?: string | string[]) {
  if (!callbackUrl) return DEFAULT_LOGIN_REDIRECT;

  const value = Array.isArray(callbackUrl) ? callbackUrl[0] : callbackUrl;

  if (!value.startsWith("/")) {
    return DEFAULT_LOGIN_REDIRECT;
  }

  if (value.startsWith("/login") || value.startsWith("/api/auth")) {
    return DEFAULT_LOGIN_REDIRECT;
  }

  return value || DEFAULT_LOGIN_REDIRECT;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const params = await searchParams;
  const callbackUrl = normalizeCallbackUrl(params.callbackUrl);

  return <LoginPageClient callbackUrl={callbackUrl} isDemo={process.env.APP_MODE === "demo"} />;
}
