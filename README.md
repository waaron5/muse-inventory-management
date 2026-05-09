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
