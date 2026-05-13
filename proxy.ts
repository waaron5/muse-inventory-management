import { withAuth } from "next-auth/middleware";

const proxy = withAuth({
  pages: {
    signIn: "/login",
  },
});

export default proxy;

export const config = {
  matcher: [
    "/((?!login|invite/accept|api/auth|api/demo-reset|_next/static|_next/image|favicon.ico|muse-logo.png|uploads|demo/images|.*\\.(?:png|jpg|jpeg|webp|gif|svg|ico)$).*)",
  ],
};
