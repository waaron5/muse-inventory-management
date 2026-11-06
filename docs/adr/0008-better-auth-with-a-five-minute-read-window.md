# Better Auth, invite-only, with revocation immediate for changes and within 5 minutes for reads

Sign-in uses Better Auth's email OTP plugin alone: a 6-digit code emailed to the person's address (5-minute expiry, 3 attempts). There is no Microsoft sign-in and no password. Sign-up is disabled. An invite creates the user row, and a sign-in succeeds only when its email matches an active user, ignoring case. The admin plugin's role (`admin` | `user`) is the Admin/User distinction, and its ban is deactivation, which revokes all of that user's sessions. Sign out ends this device's session only. There is no *Sign out everywhere*, so nobody has to decide between the two: a lost phone is covered by an Admin deactivating and reactivating the person, which revokes every session, and by sessions expiring. Screens trust a signed session cookie cache for up to 5 minutes, so checking a session costs no database round trip. Every command re-checks the session with the cache bypassed. So a deactivated or signed-out person cannot change anything from that moment, but may keep seeing data for up to 5 minutes. We accepted that window because roles never limit what anyone can see, and the alternative is a database round trip on every screen, which is the latency v1 suffered from.

## Considered Options

- **Auth.js / NextAuth**: now part of Better Auth and on security fixes only; v5 never left beta.
- **Long-lived JWTs**: no database cost, but sessions could not be revoked, which Login and user accounts ruled out.
- **No cookie cache**: revocation is immediate everywhere, at the cost of a database round trip per screen.
- **Microsoft sign-in to Muse's tenant, beside the code**: dropped, because it needs an admin on the company's side and a client secret that has to be renewed at least every 24 months. Rolling ~90-day sessions make code sign-in rare enough that one sign-in path is enough. Better Auth's Microsoft provider can be added later without changing the user table.

## Consequences

- The Better Auth `user` table is the record of people; there is no separate profile table.
- Sign-in depends on Resend delivering codes. Mail is sent from its own subdomain with its own DKIM.
- Better Auth's rate limiter only guards its HTTP routes, and sign-in has none (the only public ones are AI Connections' OAuth routes, ADR 0017), so sign-in has its own limits, counted in the database before each try. Sending: 1 a minute and 5 an hour per address, 20 an hour per IP. Wrong codes: 10 an hour and 20 a day per address, 30 an hour per IP. A new code resets a code's 3 tries but never these. Anyone who knows an address can use up its limits and hold up that person's next sign-in until they ease, which we accept because existing sessions are untouched and sign-in is rare.
- Nothing at sign-in can create an Admin. The first one comes from `DATABASE_URL=<url> pnpm admin:create <email>`, run once by the maintainer against that environment's database; after that, Admins invite people and promote them. Deleting someone is final, even for the address that was first.
- Offboarding has two locks: an Admin deactivates the person, and once Muse closes their mailbox no new code can reach them.
