import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/((?!login|api/auth|api/demo-reset|_next/static|_next/image|favicon.ico|muse-logo.png|uploads).*)",
  ],
};
