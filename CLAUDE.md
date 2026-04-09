# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dolphin Platform is a multi-module CRM/marketing platform. It's a **pnpm monorepo** with a **backend** (Express + TypeScript), **frontend** (React + Vite), and auxiliary projects (dual-name 3D renderer, chrome extension). Deployed on **Render.com** at `dolphin-platform.onrender.com`.

## Commands

```bash
# Development
pnpm dev                     # Run all packages in parallel
pnpm dev:backend             # Backend only (tsx watch, port 4000)
pnpm dev:frontend            # Frontend only (Vite, port 3000)

# Database (PostgreSQL via Prisma)
pnpm db:generate             # Generate Prisma client
pnpm db:migrate              # Create migration (prisma migrate dev)
pnpm db:push                 # Push schema to DB (dev, no migration file)
pnpm db:seed                 # Seed roles, permissions, modules
pnpm db:studio               # Prisma Studio GUI

# Build
pnpm build                   # Build all packages
pnpm build:backend           # Backend only (generates Prisma, pushes schema, seeds, compiles TS)
pnpm build:frontend          # Frontend only (tsc + vite build)

# Test
pnpm test                    # Run all tests (vitest)
cd backend && npx vitest run # Run backend tests only
cd backend && npx vitest     # Watch mode

# Infrastructure
docker compose up -d         # Start PostgreSQL 16 + Redis 7
```

## Architecture

### Monorepo Layout

- **backend/** — Express REST API (port 4000). Entry: `src/index.ts`, output: `dist/index.js`
- **frontend/** — React 18 SPA (Vite, port 3000). Proxies `/api` and `/uploads` to backend in dev
- **dual-name/** — Standalone Vite + Three.js app for 3D letter rendering
- **chrome-extension/** — Browser extension for WhatsApp monitoring

### Backend Module Structure

Each module under `backend/src/modules/` follows: `routes/` → `services/` → Prisma DB.

| Module | Path | Purpose |
|---|---|---|
| auth | `/api/v1/auth/*` | Login, register, OAuth (Google/Slack), password reset, RBAC |
| leads | `/api/v1/leads/*` | CRM leads, customers, orders, products, dashboard |
| marketing | `/api/v1/marketing/*` | Meta ad campaigns, creatives, AI-generated landing pages |
| inbox | `/api/v1/inbox/*` | Meta Messenger conversations, comments, channels |
| knowledge-base | `/api/v1/knowledge-base/*` | Product catalog, categories, media |
| settings | `/api/v1/settings/*` | Platform and user settings |
| tickets | `/api/v1/tickets/*` | Support ticket system |

Shared code lives in `backend/src/shared/` — config, middleware (auth, error-handler, upload validation), services (email, Google Drive, metrics), and utils.

Public webhook endpoints: `/api/webhooks/meta`, `/api/webhooks/bosta`, `/api/webhooks/woocommerce`.

### Frontend Module Structure

Each module under `frontend/src/modules/` has: `pages/`, `components/`, `services/`.

- **Routing**: React Router DOM with lazy-loaded modules via `React.lazy()`
- **Data fetching**: TanStack React Query (staleTime: 60s, no refetch on focus)
- **HTTP client**: Axios with interceptors — auto-attaches JWT bearer token, auto-logout on 401
- **Auth state**: React Context, stored in localStorage (`dolphin_token`, `dolphin_user`)
- **Styling**: Tailwind CSS
- **Shared UI**: `frontend/src/shared/` — Layout (AppShell, Sidebar, ModuleSwitcher), reusable components

### Database

PostgreSQL with Prisma ORM. Single schema at `backend/prisma/schema.prisma`. Tables use logical prefixes for grouping (no multi-schema): `auth_*`, `leads_*`, `mktg_*`, `kb_*`, `ticket_*`, `inbox_*`.

### Auth & Permissions

JWT-based (HS256, 15m expiry + 7d refresh). RBAC with granular permissions: `authMiddleware` validates token, `requirePermission(slug)` and `requireModule(slug)` guard routes. Super admin has wildcard `*` permission. Input validation uses Zod.

### Key Integrations

- **Meta/Facebook**: Messenger inbox (real-time webhooks), Ads Manager (campaign sync every 2h)
- **Google**: OAuth login, Sheets sync (lead import/order export), Drive (image proxy)
- **WooCommerce**: Product/order sync via webhooks (HMAC verified)
- **Bosta**: Delivery tracking via webhooks (signature verified)
- **OpenAI/Claude**: AI-generated ad copy and landing pages
- **Slack**: OAuth workspace linking

## Design System

See `DESIGN.md` for full specification. Key rules:
- **No 1px borders** — use color/opacity shifts between surface layers instead
- **Surface hierarchy**: `surface` (#f8f9fa) → `surface-container-low` (#f3f4f5) → `surface-container-lowest` (#ffffff)
- **Typography**: Manrope for headers, Inter for body text
- **Gradients**: Primary (#0040a1) to primary_container (#0056d2) at 135deg for CTAs
- **Rounding**: 12px for buttons, 24px for large containers

## Language

The app serves Arabic-speaking users. UI strings, error messages, and comments are primarily in Arabic. No i18n framework — strings are hardcoded in components and route handlers.

## Encryption Rule

All API keys/tokens stored in the database must be encrypted using `backend/src/shared/utils/token-encryption.ts` before saving. Never expose full API keys to the frontend.

## Module Boundaries (Parallel Development Rules)

Each module (`backend/src/modules/*`, `frontend/src/modules/*`) is independently editable. Multiple agents/worktrees can work on different modules simultaneously without conflicts.

### Import Rules
- A module may only import from: **itself**, `shared/`, `db.ts`, and npm packages
- **Never** import from `../../<other-module>/` — this creates coupling that blocks parallel work
- If you need data from another module, use `prisma` directly (for reads) or call its API endpoint
- When using prisma directly for cross-module reads, always replicate safety filters (`isActive`, etc.)
- Auth context (`useAuth()`) is the only cross-module frontend import allowed

### Shared Files (Conflict Zones)
These files are touched by all modules — coordinate when editing:
- `backend/prisma/schema.prisma` — add new models at the **end** of the file
- `backend/src/index.ts` — only modify to mount a new module's routes
- `frontend/src/App.tsx` — only modify to add a new module's lazy route

### Tickets
- Every ticket has a `module` field (leads, marketing, inbox, knowledge-base, settings, general)
- Auto-detected from the page URL where the user created the ticket
- Filter tickets by module: `GET /api/v1/tickets?module=leads`
- Agent scripts: `npx tsx agent/ticket-reader.ts --module leads`

### Adding a New Feature
- Feature inside existing module → safe to work in parallel, no shared files touched
- New module → add schema models + route mount + App.tsx route, merge first, then continue in parallel
- Cross-module data → prisma queries (with safety filters) or API calls, never direct imports
