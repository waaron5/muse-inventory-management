# Muse Inventory Management System

A production inventory and reservation system built for Muse Event Management to replace error-prone spreadsheet workflows.

---

## Overview

This application was built to solve a real operational problem: the team was managing inventory, events, and reservations across messy spreadsheets that led to lost inventory and constant manual overhead.

This system replaces that with a structured, reliable workflow:

- Track inventory and quantities
- Reserve items across events without conflicts
- Enforce approvals
- Maintain a clear audit trail of all actions

---

## Impact

- Eliminated spreadsheet-based errors
- Prevented overbooking with enforced constraints
- Reduced manual coordination between team members
- Saved time and removed operational friction for daily use

---

## Product Development Process

This was built directly with the end users, not in isolation:

**1. Problem Discovery**

- Met with Muse Event Management to understand existing workflows
- Identified core issues: lack of structure, no conflict prevention, no accountability

**2. System Design**

- Modeled real-world constraints (inventory quantities, event date overlaps, approvals)
- Designed for speed and simplicity to match spreadsheet workflows without the risk

**3. Iterative Development**

- Built and shipped early versions quickly
- Gathered feedback from real users after each iteration
- Refined UX and system logic based on actual usage

**4. Outcome**

- Delivered a system the team actively uses
- Reduced errors, saved time, and improved operational clarity

---

## Core Features

- Inventory tracking with quantity management
- Event-based reservations with date conflict prevention
- Admin approval workflows
- Consumable vs reusable inventory handling
- Action-level audit tracking (who did what, when)

---

## Tech Stack

- Next.js (React, TypeScript)
- PostgreSQL
- Prisma ORM
- Vercel

---

## Local Development

```bash
npm run dev
```

### First-Time Setup

```bash
npm install
npm run db up
npm run db migrate
npm run db seed
npm run dev
```

### Workflow Commands

| Command                  | Purpose                                      |
| ------------------------ | -------------------------------------------- |
| `npm run dev`            | Start the local app                          |
| `npm run check`          | Run the full local quality gate              |
| `npm run fix`            | Format code and apply safe lint fixes        |
| `npm run lint`           | Run ESLint                                   |
| `npm run typecheck`      | Run the TypeScript checker                   |
| `npm run build`          | Create a production build                    |
| `npm run db up`          | Start local Postgres                         |
| `npm run db status`      | Show migration status                        |
| `npm run db migrate`     | Create/apply a development migration         |
| `npm run db reset`       | Reset the local database                     |
| `npm run db seed`        | Seed the local database                      |
| `npm run db demo`        | Reset demo data                              |
| `npm run db logs`        | Follow Postgres logs                         |
| `npm run deps clean`     | Remove local install/build output            |
| `npm run deps reinstall` | Clean install dependencies from the lockfile |

---

## Production Setup

Production should use a separate database from local development and demo data. The production
Neon project is `muse-production`.

### Production Environment Variables

Set these in Vercel for the production environment:

| Variable                | Purpose                                             |
| ----------------------- | --------------------------------------------------- |
| `DATABASE_URL`          | Pooled Neon connection string for `muse-production` |
| `APP_MODE`              | Set to `production`                                 |
| `NEXTAUTH_SECRET`       | Long random secret for NextAuth                     |
| `NEXTAUTH_URL`          | Final production URL                                |
| `NEXT_PUBLIC_APP_URL`   | Final production URL                                |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token                        |
| `RESEND_API_KEY`        | Resend production API key                           |
| `RESEND_FROM_EMAIL`     | Verified production sender address                  |

`DEMO_RESET_SECRET` is demo-only. Do not set it for normal production.

### Production Database

Use migrations only for production schema setup:

```bash
npm run db deploy
```

Do not seed production with demo data. These commands are local/demo-only and must not be run
against the production database:

```bash
npm run db reset
npm run db seed
npm run db demo
npm run seed
npm run demo
```

### Production Admin Bootstrap

Create the first production admin with temporary environment variables:

```bash
ADMIN_EMAIL="admin@yourdomain.com" \
ADMIN_PASSWORD="use-a-strong-password" \
ADMIN_NAME="Muse Admin" \
npm run admin create
```

Only run this after confirming `DATABASE_URL` points to the `muse-production` database. Remove the
temporary admin password from your shell/session afterward.

### Production Launch Checklist

- Copy the pooled Neon connection string from `muse-production`.
- Add all production environment variables in Vercel.
- Deploy the app from a branch where CI passes.
- Run `npm run db deploy` against production.
- Run `npm run admin create` once for the production admin.
- Log in as admin and create real users.
- Confirm `/api/demo-reset` returns 404 in production.
- Smoke test inventory, gifting, events, reservations, image uploads, and email notifications.
