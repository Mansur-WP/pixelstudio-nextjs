# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains the **PixelStudio** photography studio management system — a full-stack Next.js 15 App Router application with SSR and built-in API Route Handlers.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5
- **Frontend + Backend**: Next.js 15 App Router (SSR + Route Handlers replace Express)
- **UI**: Tailwind CSS v4 + shadcn/ui (Radix-based)
- **Database**: PostgreSQL + Drizzle ORM (`@workspace/db`)
- **Auth**: JWT (jsonwebtoken) + bcryptjs; localStorage key `ps_token`; multi-tenant (studioId in JWT payload)
- **File uploads**: Next.js Route Handler with `fs` (stored in `public/uploads/`)
- **Validation**: Zod, drizzle-zod
- **Offline sync**: IndexedDB queue via `lib/offline-db.ts`

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/             # Legacy Express API (still running, parallel)
│   ├── pixelstudio/            # Next.js 15 App Router (main app, port 21502)
│   │   ├── app/                # App Router pages + Route Handlers
│   │   │   ├── api/            # Route Handlers (auth, clients, photos, etc.)
│   │   │   ├── admin/          # Admin dashboard + staff/payments/settings/activity
│   │   │   ├── gallery/[id]/   # Public client gallery
│   │   │   ├── login/          # Studio login (slug + role)
│   │   │   ├── platform/       # Superadmin platform dashboard (6 tabs)
│   │   │   ├── platform/login/ # Superadmin login
│   │   │   ├── s/[slug]/       # Studio-branded login by slug
│   │   │   ├── staff/          # Staff dashboard + clients (CRUD, invoice, upload)
│   │   │   └── not-found.tsx   # 404 page
│   │   ├── components/         # Shared UI components (layout, providers, etc.)
│   │   ├── hooks/              # React Query hooks (use-data, use-sync-context, etc.)
│   │   ├── lib/                # Helpers (api.ts, auth.ts, offline-db.ts, utils.ts)
│   │   ├── public/uploads/     # Uploaded files served statically
│   │   └── next.config.ts      # Next.js config
│   └── mockup-sandbox/         # Component preview server
├── lib/
│   └── db/                     # Drizzle ORM schema + DB connection
├── pnpm-workspace.yaml
└── package.json
```

## PixelStudio Features

- **Roles**: ADMIN, STAFF, SUPERADMIN
- **Multi-tenant**: Each studio fully isolated via studioId in JWT
- **Clients**: Full CRUD, status tracking (Pending/Editing/Ready/Delivered)
- **Photos**: Upload to `public/uploads/`, served statically by Next.js
- **Galleries**: Public sharing via 32-char hex token (no auth required)
- **Invoices**: Auto-numbered INV-0001 format, PDF preview + QR code
- **Payments**: Payment tracking (Pending/Partial/Paid)
- **Staff management**: Admin can create/deactivate/manage staff
- **Dashboards**: Role-based views with stat cards and activity feeds
- **Offline sync**: IndexedDB queue syncs when back online
- **Platform admin**: 6-tab superadmin dashboard (studios, analytics, activity, notifications, settings, upgrade requests)

## Database Tables

`studios`, `users`, `password_reset_sessions`, `clients`, `galleries`, `photos`, `invoices`, `payments`, `upgradeRequests`, `platformSettings`, `activityLog`

## Multi-Tenant Architecture

- **Studios table**: each studio has `id`, `slug`, `name`, `logoUrl`, `plan` (free/pro), `isActive`, `subscriptionStatus`, `trialEndsAt`
- **All tables** have `studioId` foreign key
- **JWT payload**: `{ id, role, studioId }` — studioId is null for SUPERADMIN

## Login URLs

- **Studio users (slug-based)**: `/s/:slug` — e.g. `/s/gbsm`
- **Studio users (legacy)**: `/login` — Admin/Staff with slug field
- **Superadmin**: `/platform/login`

## Default Credentials

- **GBSM Admin**: `admin@gbsm` / `gbsm123` — login at `/login` or `/s/gbsm`
- **Platform Superadmin**: `platform@admin` / `platform123` — login at `/platform/login`
- Staff are created by admin via Manage Staff page

## API Routes (Next.js Route Handlers)

All routes under `app/api/`:
- `POST /api/auth/login` — login (role: "admin" | "staff" | "superadmin")
- `POST /api/auth/register` — register new studio
- `GET /api/auth/me`, `PUT /api/auth/me` — current user profile
- `POST /api/auth/change-password` — change password
- `POST /api/auth/forgot-password`, `/verify-otp`, `/reset-password` — password reset
- `GET /api/studios/public/:slug` — public studio info (no auth)
- `GET/PUT /api/studios/me` — current studio info + update
- `POST /api/studios/me/logo` — upload studio logo
- `GET/POST/PUT/DELETE /api/clients` — client CRUD
- `POST /api/clients/:id/photos` — upload photos (multipart)
- `DELETE /api/photos/:id` — delete photo
- `GET /api/gallery/:token` — public gallery (no auth)
- `GET/POST /api/invoices` — invoice management
- `GET/POST /api/payments` — payment management
- `GET/POST/PUT/DELETE /api/staff` — staff management (admin only)
- `GET /api/dashboard/admin`, `/staff` — role-based stats
- `GET /api/platform/studios` — all studios (superadmin)
- `POST /api/platform/studios` — create studio (superadmin)
- `PATCH/DELETE /api/platform/studios/:id` — update/delete studio (superadmin)
- `POST /api/platform/studios/:id/impersonate` — impersonate studio admin (superadmin)
- `GET /api/platform/activity` — cross-studio activity (superadmin)
- `GET /api/platform/analytics` — revenue/growth analytics (superadmin)
- `GET /api/platform/health` — server health (superadmin)
- `GET /api/platform/notifications` — limit alerts, trial expiries (superadmin)
- `GET /api/platform/export/studios` — CSV export (superadmin)
- `GET/PUT /api/platform/settings` — bank + pricing settings (superadmin)
- `GET /api/platform/upgrade-requests` — upgrade payment submissions (superadmin)
- `POST /api/platform/upgrade-requests/:id/confirm|reject` — process upgrades (superadmin)
- `GET /api/studios/me/upgrade-info` — upgrade info for studio (admin)
- `POST /api/studios/me/upgrade-request` — submit upgrade payment ref (admin)

## Invoice Fields

`studiosTable` has `phone`, `address`, `email` (all nullable text, snake_case in DB). These appear in:
- `GET/PUT /api/studios/me` — included in all studio responses
- Settings page (Admin > Settings > Studio Branding card) — pre-filled from API, saved via PUT
- Invoice page (`/staff/clients/[id]/invoice`) — rendered dynamically from live API call

## Key Configuration

- Next.js port: 21502 (PORT env var)
- JWT secret: `JWT_SECRET` env var (defaults to dev fallback)
- JWT expiry: 7 days (`JWT_EXPIRES_IN`)
- Uploads stored at: `public/uploads/` (served by Next.js static handler)
- `allowedDevOrigins` set to `*.replit.dev` for Replit proxy compatibility
- **CRITICAL**: api-server artifact `paths = []` (empty) — all `/api/*` traffic routed to Next.js at port 21502 via Replit proxy. DO NOT add `/api` back to api-server paths or browser API calls will hit the old Express server instead of Next.js Route Handlers.
- `Cache-Control: no-store` on `/api/studios/me` GET/PUT and `/api/auth/me` GET to prevent browser caching stale studio data
