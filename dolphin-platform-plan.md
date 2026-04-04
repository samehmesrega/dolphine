# Dolphin Platform - Detailed Implementation Plan

## Company Context
- **Company:** Digitics
- **Stores:** 3 (Print In بالعربي, Picked In بالإنجليزي, Choroida بالإنجليزي)
- **Employees:** 35 across 11 departments
- **Marketing Team:** 7 (3 photographers + supervisor/account manager + 3 media buyers)
- **Gap:** No marketing manager — CEO fills the role
- **Current:** Dolphin CRM at `APPS/dolphin/` (React + Express + Prisma + PostgreSQL)
- **Hosting:** Render + GitHub

---

## Architecture: Single Unified App

```
dolphin-platform.onrender.com
├── /                    → Homepage (module switcher)
├── /leads/*             → Dolphin Leads
├── /marketing/*         → Dolphin Marketing
├── /settings/*          → Global settings
└── (future modules: /operations, /accounting, /hr, /vault)
```

Landing pages only get separate subdomains:
- `lp.printin.sa` / `lp.pickedin.com` / `lp.choroida.com`

---

## Tech Stack
- **Frontend:** React 18 + TypeScript + Vite + Tailwind
- **Backend:** Express + TypeScript
- **Database:** Single PostgreSQL + table prefixes per module (NOT separate schemas — see note below)
- **ORM:** Prisma (single schema file, single client)
- **AI:** OpenAI (scripts) + Claude API (landing pages)
- **Hosting:** Render (auto-SSL)
- **Queue:** BullMQ + Redis (for scheduled jobs & background tasks)
- **Logging:** Pino (structured JSON logging)
- **Monitoring:** Sentry (error tracking + performance)
- **File Storage:** Cloudflare R2 (for thumbnails & LP assets)
- **Rate Limiting:** express-rate-limit + Redis store
- **Testing:** Vitest (unit + integration)

> **⚠️ IMPORTANT: Prisma Multi-Schema Decision**
> Prisma's `@@schema()` multi-schema support is still a **preview feature** with significant limitations:
> - Cannot do cross-schema relations
> - Migrations are unreliable across schemas
> - Not all providers support it fully
>
> **SOLUTION:** Use a **single schema** with **table name prefixes** instead:
> - `auth_users`, `auth_modules`, `auth_module_roles`, `auth_module_access`
> - `mktg_creatives`, `mktg_tags`, `mktg_campaigns`, `mktg_landing_pages`
> - `sales_leads`, `sales_orders`, `sales_customers`
>
> This gives logical separation while keeping full Prisma relation support across all tables.
> All models live in ONE `schema.prisma` file with ONE Prisma client.

---

# PHASE 1: Monorepo Setup + Move Dolphin + Rename

## 1.1 Monorepo Structure

```
APPS/dolphin-platform/
├── pnpm-workspace.yaml
├── package.json
├── docker-compose.yml
├── .gitignore
├── .npmrc
│
├── packages/
│   ├── shared-auth/          # @dolphin/auth
│   ├── shared-types/         # @dolphin/shared-types
│   ├── shared-ui/            # @dolphin/shared-ui
│   └── shared-utils/         # @dolphin/shared-utils
│
├── backend/                  # Single Express backend
│   ├── prisma/
│   │   └── schema.prisma      # Single unified schema (tables use prefixes: auth_, mktg_, sales_)
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── leads/
│   │   │   └── marketing/
│   │   ├── shared/
│   │   │   ├── middleware/       # error-handler, rate-limit, validate
│   │   │   ├── config/           # logger, sentry, redis, storage, queue
│   │   │   └── utils/            # encryption, phone normalization
│   │   ├── __tests__/            # Unit + integration tests (Vitest)
│   │   └── index.ts
│   └── package.json
│
└── frontend/                 # Single React frontend
    ├── src/
    │   ├── modules/
    │   │   ├── auth/
    │   │   ├── leads/
    │   │   └── marketing/
    │   ├── shared/
    │   │   ├── Layout/
    │   │   │   ├── AppShell.tsx
    │   │   │   ├── Sidebar.tsx
    │   │   │   ├── Header.tsx
    │   │   │   └── ModuleSwitcher.tsx
    │   │   └── components/
    │   └── App.tsx
    └── package.json
```

## 1.2 Config Files

**pnpm-workspace.yaml:**
```yaml
packages:
  - 'packages/*'
  - 'backend'
  - 'frontend'
```

**Root package.json:**
```json
{
  "name": "dolphin-platform",
  "private": true,
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "dev:backend": "pnpm --filter backend dev",
    "dev:frontend": "pnpm --filter frontend dev",
    "build": "pnpm -r build",
    "db:migrate": "pnpm --filter backend prisma:migrate",
    "db:seed": "pnpm --filter backend prisma:seed"
  }
}
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    container_name: dolphin-platform-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: dolphin_platform
    ports:
      - "5432:5432"
    volumes:
      - dolphin_platform_pgdata:/var/lib/postgresql/data
  redis:
    image: redis:7-alpine
    container_name: dolphin-platform-redis
    ports:
      - "6379:6379"
    volumes:
      - dolphin_platform_redisdata:/data  # persist Redis data (BullMQ jobs survive restarts)
volumes:
  dolphin_platform_pgdata:
  dolphin_platform_redisdata:
```

> **Redis is used for:**
> - BullMQ job queue (scheduled publishing, ad sync, fatigue checks)
> - Rate limiting store (express-rate-limit)
> - Permissions cache (JWT lightweight approach)
> - Session data (optional)

## 1.3 Moving Current Dolphin Code

### Backend
| From (dolphin/backend/) | To (dolphin-platform/backend/) |
|---|---|
| `src/routes/leads.ts` | `src/modules/leads/routes/leads.ts` |
| `src/routes/customers.ts` | `src/modules/leads/routes/customers.ts` |
| `src/routes/orders.ts` | `src/modules/leads/routes/orders.ts` |
| `src/routes/products.ts` | `src/modules/leads/routes/products.ts` |
| `src/routes/shifts.ts` | `src/modules/leads/routes/shifts.ts` |
| `src/routes/dashboard.ts` | `src/modules/leads/routes/dashboard.ts` |
| `src/routes/auth.ts` | `src/modules/auth/routes/auth.ts` |
| `src/middleware/*` | `src/shared/middleware/*` |
| `prisma/schema.prisma` | `prisma/schema-leads.prisma` |

### Frontend
| From (dolphin/frontend/src/) | To (dolphin-platform/frontend/src/) |
|---|---|
| `pages/Dashboard.tsx` | `modules/leads/pages/Dashboard.tsx` |
| `pages/Leads.tsx` | `modules/leads/pages/Leads.tsx` |
| `pages/Customers.tsx` | `modules/leads/pages/Customers.tsx` |
| `pages/Orders.tsx` | `modules/leads/pages/Orders.tsx` |
| `pages/Products.tsx` | `modules/leads/pages/Products.tsx` |
| `pages/Shifts.tsx` | `modules/leads/pages/Shifts.tsx` |
| `pages/Login.tsx` | `modules/auth/pages/Login.tsx` |
| `components/Layout.tsx` | `shared/Layout/AppShell.tsx` |
| `components/Sidebar.tsx` | `shared/Layout/Sidebar.tsx` |
| `context/AuthContext.tsx` | `modules/auth/context/AuthContext.tsx` |
| `services/api.ts` | `shared/services/api.ts` |

## 1.4 Unified Backend Entry

```typescript
// backend/src/index.ts
import express from 'express';
import { authRoutes } from './modules/auth/routes';
import { leadsRoutes } from './modules/leads/routes';
import { marketingRoutes } from './modules/marketing/routes';
import { validateToken } from '@dolphin/auth';

const app = express();
app.use(express.json());

// --- Global Middleware ---
app.use(pinoHttp({ logger }));                          // Structured logging
app.use(helmet());                                       // Security headers
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));

// --- Rate Limiting ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  store: new RedisStore({ client: redisClient }),
});
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // stricter for public endpoints
  store: new RedisStore({ client: redisClient }),
});
app.use('/api/', apiLimiter);

// --- API Routes (versioned) ---
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/leads', validateToken, leadsRoutes);
app.use('/api/v1/marketing', validateToken, marketingRoutes);
app.use('/api/v1/notifications', validateToken, notificationRoutes);

// --- Public Routes (rate limited separately) ---
app.use('/lp', publicLimiter, landingPagePublicRoutes);

// --- Global Error Handler ---
app.use(globalErrorHandler); // catches all unhandled errors, logs to Pino + Sentry

app.listen(4000);
```

## 1.5 Unified Frontend App.tsx

```tsx
import { lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './modules/auth/context/AuthContext';
import { AppShell } from './shared/Layout/AppShell';
import { ModuleSwitcher } from './shared/Layout/ModuleSwitcher';
import { Login } from './modules/auth/pages/Login';
import { ProtectedRoute } from './modules/auth/components/ProtectedRoute';

const LeadsModule = lazy(() => import('./modules/leads'));
const MarketingModule = lazy(() => import('./modules/marketing'));

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route path="/" element={<ModuleSwitcher />} />
            <Route path="/leads/*" element={<LeadsModule />} />
            <Route path="/marketing/*" element={<MarketingModule />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

## 1.6 Rename: Dolphin → Dolphin Leads

| File | Old | New |
|------|-----|-----|
| backend/package.json | `dolphin-backend` | `dolphin-leads-backend` |
| frontend/index.html | `<title>دولفين</title>` | `<title>دولفين ليدز</title>` |
| frontend/manifest.json | `"name": "دولفين"` | `"name": "دولفين ليدز"` |
| api.ts localStorage | `dolphin_token` | `dolphin_leads_token` |
| api.ts localStorage | `dolphin_user` | `dolphin_leads_user` |
| WordPress plugin | Display name → `"Dolphine Leads"` |
| All Arabic .md files | `دولفين` | `دولفين ليدز` |

## 1.7 Shared Packages

### @dolphin/shared-types
```typescript
export interface User {
  id: string; email: string; name: string; phone?: string;
  isActive: boolean; isSuperAdmin: boolean; modules: ModuleAccess[];
}
export interface ModuleAccess {
  moduleSlug: string; role: string; permissions: string[];
}
export interface ApiResponse<T> {
  success: boolean; data?: T; error?: string;
  pagination?: { page: number; limit: number; total: number; totalPages: number; };
}
export interface Store {
  id: string; name: string; slug: string; language: 'ar' | 'en';
}
```

### @dolphin/shared-auth
```typescript
// Express middleware
export const validateToken = (req, res, next) => { /* JWT verify */ };
export const requireModule = (slug: string) => (req, res, next) => { /* check access */ };
export const requirePermission = (perm: string) => (req, res, next) => { /* check perm */ };

// React hooks
export const useAuth = () => { /* user, login, logout, isAuthenticated */ };
export const usePermissions = () => { /* hasPermission, hasModule */ };
```

### @dolphin/shared-ui
- `Layout/` — AppShell, Sidebar, Header, ModuleSwitcher
- `Form/` — Input, Select, DatePicker, TextArea
- `Table/` — DataTable, Pagination, Filters
- `Feedback/` — Modal, Toast, Confirm, NotificationBell

### @dolphin/shared-utils
- `phone.ts` — Phone normalization
- `date.ts` — Date formatting AR/EN
- `validation.ts` — Common validators

---

# PHASE 2: Auth Module

## 2.1 Database Schema (prisma/schema.prisma — auth section)

> All tables use `auth_` prefix. The `@@map("auth_users")` directive maps the Prisma model name to the actual table name.

```prisma
model User {
  id            String         @id @default(uuid())
  email         String         @unique
  passwordHash  String
  name          String
  phone         String?
  avatar        String?
  isActive      Boolean        @default(true)
  isSuperAdmin  Boolean        @default(false)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  moduleAccess  ModuleAccess[]
  auditLogs     AuthAuditLog[]
  @@map("auth_users")
}

model Module {
  id          String         @id @default(uuid())
  name        String         // "Dolphin Leads"
  slug        String         @unique // "leads"
  icon        String         // "📊"
  description String?
  isActive    Boolean        @default(true)
  order       Int            @default(0)
  roles       ModuleRole[]
  access      ModuleAccess[]
  @@map("auth_...")  // use proper table name: auth_modules, auth_module_roles, etc.
}

model ModuleRole {
  id          String         @id @default(uuid())
  moduleId    String
  module      Module         @relation(fields: [moduleId], references: [id])
  name        String         // "Sales Manager"
  slug        String         // "sales_manager"
  permissions Json           // ["leads.view", "leads.create", "leads.edit", "leads.delete"]
  isDefault   Boolean        @default(false)
  access      ModuleAccess[]
  @@unique([moduleId, slug])
  @@map("auth_...")  // use proper table name: auth_modules, auth_module_roles, etc.
}

model ModuleAccess {
  id           String     @id @default(uuid())
  userId       String
  user         User       @relation(fields: [userId], references: [id])
  moduleId     String
  module       Module     @relation(fields: [moduleId], references: [id])
  moduleRoleId String
  moduleRole   ModuleRole @relation(fields: [moduleRoleId], references: [id])
  createdAt    DateTime   @default(now())
  @@unique([userId, moduleId])
  @@map("auth_...")  // use proper table name: auth_modules, auth_module_roles, etc.
}

model AuthAuditLog {
  id        String   @id @default(uuid())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id])
  action    String   // "login", "logout", "password_change", "role_change"
  ip        String?
  userAgent String?
  metadata  Json?
  createdAt DateTime @default(now())
  @@map("auth_...")  // use proper table name: auth_modules, auth_module_roles, etc.
}
```

## 2.2 API Routes

| Method | Path | Body | Response | Auth |
|--------|------|------|----------|------|
| POST | `/api/v1/auth/register` | `{email, password, name, phone}` | `{user, token}` | Admin only |
| POST | `/api/v1/auth/login` | `{email, password}` | `{user, token, refreshToken}` | Public |
| POST | `/api/v1/auth/refresh` | `{refreshToken}` | `{token, refreshToken}` | Public |
| GET | `/api/v1/auth/me` | — | `{user with moduleAccess}` | Token |
| GET | `/api/v1/auth/users` | — | `{users[]}` | Admin |
| GET | `/api/v1/auth/users/:id` | — | `{user with moduleAccess}` | Admin |
| PUT | `/api/v1/auth/users/:id` | `{name, phone, isActive}` | `{user}` | Admin |
| PUT | `/api/v1/auth/users/:id/password` | `{newPassword}` | `{success}` | Admin/Self |
| POST | `/api/v1/auth/users/:id/module-access` | `{moduleId, roleId}` | `{moduleAccess}` | Admin |
| DELETE | `/api/v1/auth/users/:id/module-access/:moduleId` | — | `{success}` | Admin |
| GET | `/api/v1/auth/modules` | — | `{modules[]}` | Admin |
| GET | `/api/v1/auth/modules/:id/roles` | — | `{roles[]}` | Admin |

## 2.3 JWT Token (Lightweight)

> **⚠️ حجم الـ JWT:** تخزين كل الـ permissions داخل الـ JWT يكبّر حجمه مع نمو النظام ويبطّئ كل request.
>
> **SOLUTION:** الـ JWT يحتوي فقط على المعلومات الأساسية. الصلاحيات التفصيلية تُحمَّل من Redis cache.

**JWT Payload (خفيف):**
```json
{
  "sub": "user-uuid",
  "email": "ahmed@digitics.com",
  "name": "Ahmed",
  "isSuperAdmin": false,
  "modules": ["leads", "marketing"],
  "iat": 1710000000,
  "exp": 1710000900
}
```

**Permissions Cache (Redis):**
```typescript
// عند تسجيل الدخول، تُخزَّن الصلاحيات في Redis
const cacheKey = `user:${userId}:permissions`;
await redis.setex(cacheKey, 900, JSON.stringify({
  leads: {
    role: "sales_manager",
    permissions: ["leads.view", "leads.create", "leads.edit", "orders.view", "orders.create"]
  },
  marketing: {
    role: "media_buyer",
    permissions: ["creatives.view", "campaigns.view", "spend.view"]
  }
}));

// Middleware يحمّل الصلاحيات من Redis (سريع جداً)
export const loadPermissions = async (req, res, next) => {
  const cached = await redis.get(`user:${req.user.sub}:permissions`);
  if (cached) {
    req.permissions = JSON.parse(cached);
  } else {
    // Cache miss: reload from DB
    const access = await prisma.moduleAccess.findMany({
      where: { userId: req.user.sub },
      include: { moduleRole: true, module: true }
    });
    const permissions = buildPermissionsMap(access);
    await redis.setex(`user:${req.user.sub}:permissions`, 900, JSON.stringify(permissions));
    req.permissions = permissions;
  }
  next();
};

// عند تغيير صلاحيات المستخدم، يُحذَف الـ cache
async function invalidateUserPermissions(userId: string) {
  await redis.del(`user:${userId}:permissions`);
}
```

- Access token: 15 min expiry
- Refresh token: 7 days, stored in HttpOnly cookie
- Permissions cache: 15 min TTL in Redis (auto-refreshed)

## 2.4 Default Module Roles

### Leads Module
| Role | Permissions |
|------|------------|
| `admin` | `*` (all) |
| `sales_manager` | leads.*, customers.*, orders.*, shifts.*, dashboard.view |
| `sales_agent` | leads.view, leads.edit, customers.view, orders.view, orders.create |
| `viewer` | leads.view, customers.view, orders.view, dashboard.view |

### Marketing Module
| Role | Permissions |
|------|------------|
| `admin` | `*` (all) |
| `marketing_manager` | creatives.*, ideas.*, publishing.*, campaigns.*, landing_pages.*, settings.view |
| `content_supervisor` | creatives.*, ideas.*, publishing.*, landing_pages.create, landing_pages.edit |
| `content_creator` | creatives.view, ideas.create, ideas.view |
| `media_buyer` | creatives.view, campaigns.*, spend.*, landing_pages.view |
| `account_manager` | creatives.*, requests.create, ideas.view, publishing.schedule, landing_pages.create |

## 2.5 Frontend Pages

### Login Page `/login`
- Email + Password fields
- "تسجيل الدخول" button
- Error messages (wrong credentials, inactive account)
- Redirect to `/` after login

### User Management `/settings/users` (Admin only)
- Users table: name, email, phone, status, modules
- Add user button → modal form
- Edit user → modal
- Module access assignment per user:
  - Dropdown: select module
  - Dropdown: select role in that module
  - Add/Remove module access

### Sidebar Behavior
```tsx
// Sidebar shows only modules user has access to
const modules = user.modules.map(m => ({
  slug: m.moduleSlug,
  name: moduleNames[m.moduleSlug],
  icon: moduleIcons[m.moduleSlug],
  path: `/${m.moduleSlug}`
}));
// Plus: Home (always), Settings (admin only)
```

---

# PHASE 3: Marketing Module — Scaffold

## 3.1 Backend Structure
```
backend/src/modules/marketing/
├── routes/
│   ├── index.ts              # mounts all marketing sub-routes
│   ├── creatives.ts
│   ├── requests.ts
│   ├── ideas.ts
│   ├── competitors.ts
│   ├── scripts.ts
│   ├── publishing.ts
│   ├── campaigns.ts
│   ├── landing-pages.ts
│   └── settings.ts
├── services/
│   ├── creative.service.ts
│   ├── idea.service.ts
│   ├── ai-script.service.ts
│   ├── publishing.service.ts
│   ├── ad-sync.service.ts
│   ├── landing-page.service.ts
│   └── notification.service.ts
└── utils/
    ├── creative-code.ts      # Code generation logic
    └── utm.ts                # UTM parsing
```

## 3.2 Frontend Structure
```
frontend/src/modules/marketing/
├── index.tsx                 # Routes for /marketing/*
├── pages/
│   ├── Dashboard.tsx
│   ├── CreativeLibrary.tsx
│   ├── CreativeDetail.tsx
│   ├── CreativeRequests.tsx
│   ├── IdeasBank.tsx
│   ├── CompetitorLibrary.tsx
│   ├── ScriptGenerator.tsx
│   ├── ContentCalendar.tsx
│   ├── MediaBuying.tsx
│   ├── LandingPages.tsx
│   ├── LandingPageEditor.tsx
│   └── Settings.tsx
├── components/
│   ├── CreativeCard.tsx
│   ├── CreativeFilters.tsx
│   ├── TagSelector.tsx
│   ├── CalendarView.tsx
│   ├── AIChatPanel.tsx
│   ├── PerformanceChart.tsx
│   └── NotificationList.tsx
└── services/
    └── marketing-api.ts
```

## 3.3 Marketing Sidebar
```
📢 Marketing
├── 📊 Dashboard
├── 🎬 Creative Index
│   ├── Library
│   ├── Requests
│   └── Performance
├── 💡 Ideas & AI
│   ├── Ideas Bank
│   ├── Competitors
│   └── Script Generator
├── 📅 Publishing
│   └── Content Calendar
├── 📈 Media Buying
│   └── Dashboard
├── 🌐 Landing Pages
└── ⚙️ Settings
```

---

# PHASE 4: Creative Index

## 4.1 Database Schema (prisma/schema-marketing.prisma)

```prisma
// ===== CREATIVE LIBRARY =====

model Creative {
  id              String              @id @default(uuid())
  code            String              @unique // auto-generated: "1-2-3-001"
  name            String
  description     String?
  type            CreativeType        // IMAGE, VIDEO, CAROUSEL, REEL
  driveUrl        String?             // Google Drive link
  thumbnailUrl    String?             // Thumbnail link
  projectId       String
  project         Project             @relation(fields: [projectId], references: [id])
  productId       String?
  product         Product             @relation(fields: [productId], references: [id])
  language        String              // "ar" | "en"
  creatorId       String              // team member who created it
  creator         User                @relation(fields: [creatorId], references: [id])
  status          CreativeStatus      @default(REQUESTED)
  tags            CreativeTag[]
  performances    CreativePerformance[]
  requestId       String?             // linked to the request that spawned it
  request         CreativeRequest?    @relation(fields: [requestId], references: [id])
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

enum CreativeType {
  IMAGE
  VIDEO
  CAROUSEL
  REEL
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

enum CreativeStatus {
  REQUESTED
  IN_PRODUCTION
  DONE
  PUBLISHED
  TESTING
  WINNER
  LOSER
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

// ===== CREATIVE CODE SYSTEM =====

model CreativeCodeConfig {
  id        String               @id @default(uuid())
  segments  Json                 // [{name: "Language", values: [{code: "1", label: "Arabic"}, {code: "2", label: "English"}]}, ...]
  separator String               @default("-")
  seqDigits Int                  @default(3) // 001, 002, etc.
  updatedAt DateTime             @updatedAt
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

// Example segments JSON:
// [
//   { "name": "Language", "order": 1, "values": [
//     { "code": "1", "label": "Arabic" },
//     { "code": "2", "label": "English" }
//   ]},
//   { "name": "Project", "order": 2, "values": [
//     { "code": "1", "label": "Print In" },
//     { "code": "2", "label": "Picked In" },
//     { "code": "3", "label": "Choroida" }
//   ]},
//   { "name": "Product", "order": 3, "values": [
//     { "code": "1", "label": "Dual Name" },
//     { "code": "2", "label": "Slipperz" },
//     { "code": "3", "label": "Decor Lamp" }
//   ]}
// ]
// Auto-gen: "1-2-1-001" = Arabic, Picked In, Dual Name, #001

// ===== TAGS =====

model TagCategory {
  id       String  @id @default(uuid())
  name     String  @unique // "Season", "Content Type", "Platform"
  isFixed  Boolean @default(true) // fixed categories can't be deleted
  tags     Tag[]
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

model Tag {
  id         String       @id @default(uuid())
  name       String       // "Ramadan", "UGC", "Meta"
  categoryId String?
  category   TagCategory? @relation(fields: [categoryId], references: [id])
  creatives  CreativeTag[]
  @@unique([name, categoryId])
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

model CreativeTag {
  id         String   @id @default(uuid())
  creativeId String
  creative   Creative @relation(fields: [creativeId], references: [id])
  tagId      String
  tag        Tag      @relation(fields: [tagId], references: [id])
  @@unique([creativeId, tagId])
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

model SavedFilter {
  id      String @id @default(uuid())
  name    String // "Ramadan Dual Name Videos"
  userId  String
  filters Json   // { projectId: "x", tags: ["y"], status: "PUBLISHED", type: "VIDEO" }
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

// ===== PROJECTS & PRODUCTS =====

model Project {
  id        String     @id @default(uuid())
  name      String     @unique // "Print In", "Picked In", "Choroida"
  slug      String     @unique
  language  String     // "ar" | "en"
  creatives Creative[]
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

model Product {
  id            String     @id @default(uuid())
  name          String     // "Dual Name", "Slipperz"
  wooCommerceId String?    // linked from Leads module
  projectId     String
  creatives     Creative[]
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

// ===== CREATIVE REQUESTS =====

model CreativeRequest {
  id           String        @id @default(uuid())
  title        String
  projectId    String
  productId    String?
  platform     String        // "meta", "tiktok", "snapchat"
  language     String        // "ar" | "en"
  instructions String        // detailed brief
  referenceUrls Json?        // ["url1", "url2"]
  deadline     DateTime?
  status       RequestStatus @default(NEW)
  requestedBy  String        // account manager user ID
  assignedTo   String?       // content creator user ID
  creatives    Creative[]    // linked creatives once produced
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

enum RequestStatus {
  NEW
  IN_PRODUCTION
  DONE
  CANCELLED
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

// ===== CREATIVE PERFORMANCE =====

model CreativePerformance {
  id           String   @id @default(uuid())
  creativeId   String
  creative     Creative @relation(fields: [creativeId], references: [id])
  date         DateTime
  platform     String   // "meta", "google", "tiktok", "snapchat"
  impressions  Int      @default(0)
  clicks       Int      @default(0)
  spend        Float    @default(0)
  leads        Int      @default(0)  // from Dolphin Leads
  orders       Int      @default(0)  // from Dolphin Leads
  revenue      Float    @default(0)  // from Dolphin Leads
  @@unique([creativeId, date, platform])
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}
```

## 4.2 Creative Code Auto-Generation Logic

```typescript
async function generateCreativeCode(segments: SegmentSelection[]): string {
  // 1. Get config from DB
  const config = await prisma.creativeCodeConfig.findFirst();

  // 2. Build prefix from selected segment values
  // User selects: Language=Arabic(1), Project=Print In(2), Product=Dual Name(3)
  const prefix = segments.map(s => s.code).join(config.separator);
  // prefix = "1-2-3"

  // 3. Find next sequential number for this prefix
  const lastCreative = await prisma.creative.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' }
  });
  const nextSeq = lastCreative
    ? parseInt(lastCreative.code.split(config.separator).pop()) + 1
    : 1;

  // 4. Pad sequential number
  const seqStr = String(nextSeq).padStart(config.seqDigits, '0');

  // 5. Return full code
  return `${prefix}${config.separator}${seqStr}`;
  // Result: "1-2-3-001"
}
```

## 4.3 API Routes

### Creatives
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/marketing/creatives` | List with filters (project, product, tags, status, type, date range, creator) |
| GET | `/api/v1/marketing/creatives/:id` | Get one with tags + performance |
| POST | `/api/v1/marketing/creatives` | Create (auto-generates code) |
| PUT | `/api/v1/marketing/creatives/:id` | Update |
| DELETE | `/api/v1/marketing/creatives/:id` | Delete |
| PUT | `/api/v1/marketing/creatives/:id/status` | Update status |
| GET | `/api/v1/marketing/creatives/:id/performance` | Performance metrics |
| GET | `/api/v1/marketing/creatives/reports` | Aggregated reports |

### Tags
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/marketing/tags` | All tags grouped by category |
| POST | `/api/v1/marketing/tags` | Create tag |
| DELETE | `/api/v1/marketing/tags/:id` | Delete tag |
| GET | `/api/v1/marketing/tag-categories` | All categories |
| POST | `/api/v1/marketing/tag-categories` | Create category |

### Requests
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/marketing/requests` | List (filterable by status, project) |
| POST | `/api/v1/marketing/requests` | Create request |
| PUT | `/api/v1/marketing/requests/:id` | Update |
| PUT | `/api/v1/marketing/requests/:id/status` | Change status |
| PUT | `/api/v1/marketing/requests/:id/assign` | Assign to creator |

### Saved Filters
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/marketing/saved-filters` | User's saved filters |
| POST | `/api/v1/marketing/saved-filters` | Save filter |
| DELETE | `/api/v1/marketing/saved-filters/:id` | Delete |

### Creative Code Config
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/marketing/settings/creative-code` | Get config |
| PUT | `/api/v1/marketing/settings/creative-code` | Update config |

## 4.4 Frontend Pages

### Creative Library `/marketing/creatives`
```
┌─────────────────────────────────────────────────────┐
│ Creative Library                    [+ New Creative] │
├─────────────────────────────────────────────────────┤
│ Filters: [Project ▼] [Product ▼] [Status ▼]        │
│          [Tags: Ramadan × UGC ×] [+ Add Tag]       │
│          [Date Range] [Creator ▼]                   │
│          [Saved: ★ Ramadan Dual Name ▼]             │
│ View: [Grid] [Table]                                │
├─────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│ │ 🎬 thumb│ │ 🎬 thumb│ │ 📸 thumb│ │ 🎬 thumb│   │
│ │ 1-2-3-01│ │ 1-2-3-02│ │ 2-1-1-01│ │ 1-1-2-01│   │
│ │ Dual Nam│ │ Dual Nam│ │ Slipperz│ │ Decor   │   │
│ │ ✅ Done  │ │ 🧪 Test │ │ 🏆Winner│ │ 📦 Prod │   │
│ │ Ahmed   │ │ Sara    │ │ Ayad    │ │ Maram   │   │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│                                                     │
│ Page 1 of 25  [< 1 2 3 ... 25 >]                  │
└─────────────────────────────────────────────────────┘
```

### Creative Detail `/marketing/creatives/:id`
```
┌────────────────────────────────┬────────────────────┐
│ ▶ Video Preview (GDrive embed) │ Code: 1-2-3-001    │
│                                │ Project: Print In  │
│                                │ Product: Dual Name │
│                                │ Language: Arabic   │
│                                │ Creator: Ahmed     │
│                                │ Status: [Published]│
│                                │ Created: 2025-03-01│
│                                │ Tags: Ramadan, UGC │
│                                │ Drive: [Open Link] │
├────────────────────────────────┴────────────────────┤
│ Performance (last 30 days)                          │
│ ┌─────────┬─────────┬─────────┬─────────┐          │
│ │ Spend   │ Leads   │ Orders  │ ROAS    │          │
│ │ $1,240  │ 87      │ 23      │ 3.2x    │          │
│ └─────────┴─────────┴─────────┴─────────┘          │
│ [Chart: daily performance over time]                │
│ ⚠️ Fatigue Alert: CTR dropped 25% in last 7 days   │
└─────────────────────────────────────────────────────┘
```

### Requests Dashboard `/marketing/requests`
```
┌─────────────────────────────────────────────────────┐
│ Creative Requests                 [+ New Request]    │
├────────┬────────┬─────────┬──────────┬──────────────┤
│ NEW(3) │PROD(2) │ DONE(15)│CANCELLED │ ALL          │
├────────┴────────┴─────────┴──────────┴──────────────┤
│ Request #12 - Dual Name Ramadan Video               │
│ Project: Print In | Platform: Meta | Deadline: Mar 20│
│ Assigned to: Ahmed | Status: IN_PRODUCTION          │
│ Instructions: "فيديو 15 ثانية للدوال نيم..."        │
├─────────────────────────────────────────────────────┤
│ Request #11 - Slipperz Unboxing                     │
│ Project: Picked In | Platform: TikTok | Deadline: -  │
│ Assigned to: — | Status: NEW                        │
└─────────────────────────────────────────────────────┘
```

## 4.5 Creative Fatigue Detection

```typescript
// Runs daily via BullMQ repeatable job (see Phase 6.3 for queue setup)
async function checkCreativeFatigue() {
  // Get creatives with status PUBLISHED or TESTING
  const activeCreatives = await prisma.creative.findMany({
    where: { status: { in: ['PUBLISHED', 'TESTING'] } },
    include: { performances: { orderBy: { date: 'desc' }, take: 14 } }
  });

  for (const creative of activeCreatives) {
    const last7 = performances.slice(0, 7);
    const prev7 = performances.slice(7, 14);

    const avgCTR_recent = avg(last7.map(p => p.clicks / p.impressions));
    const avgCTR_prev = avg(prev7.map(p => p.clicks / p.impressions));

    // If CTR dropped more than 20%
    if (avgCTR_prev > 0 && (avgCTR_prev - avgCTR_recent) / avgCTR_prev > 0.2) {
      await createNotification({
        type: 'CREATIVE_FATIGUE',
        title: `كرييتف ${creative.code} وصل creative fatigue`,
        body: `CTR نزل ${Math.round(drop * 100)}% في آخر 7 أيام`,
        targetUsers: getMarketingManagers(),
      });
    }
  }
}
```

## 4.6 Default Tag Categories & Tags

| Category | Tags |
|----------|------|
| **Season** | Ramadan, Valentine's, Back to School, Mother's Day, National Day, Black Friday, Summer |
| **Content Type** | UGC, Product Shot, Lifestyle, Motion Graphics, Unboxing, Tutorial, Testimonial |
| **Platform** | Meta, TikTok, Snapchat, Google |
| **Project** | Print In, Picked In, Choroida |
| **Product** | Dual Name, Slipperz, Decor Lamp, (dynamic from WooCommerce) |

---

# PHASE 5: Ideas Bank + AI

## 5.1 Database Schema

```prisma
// ===== IDEAS =====

model Idea {
  id          String      @id @default(uuid())
  title       String
  description String
  projectId   String      // Print In, Picked In, Choroida
  platform    String?     // meta, tiktok, snapchat
  contentType String?     // UGC, product shot, etc.
  status      IdeaStatus  @default(NEW)
  submittedBy String      // user ID
  referenceUrls Json?     // ["url1", "url2"]
  comments    IdeaComment[]
  scripts     Script[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

enum IdeaStatus {
  NEW
  APPROVED
  IN_PRODUCTION
  DONE
  REJECTED
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

model IdeaComment {
  id        String   @id @default(uuid())
  ideaId    String
  idea      Idea     @relation(fields: [ideaId], references: [id])
  userId    String
  text      String
  createdAt DateTime @default(now())
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

// ===== COMPETITOR REFERENCES =====

model CompetitorReference {
  id             String   @id @default(uuid())
  title          String
  url            String   // video/post link
  screenshotUrl  String?  // screenshot image
  competitorName String?
  platform       String   // meta, tiktok, snapchat, youtube
  notes          String   // what's special about this
  tags           Json?    // ["product_demo", "emotional", "fast_paced"]
  addedBy        String   // user ID
  createdAt      DateTime @default(now())
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

// ===== AI SCRIPTS =====

model Script {
  id          String         @id @default(uuid())
  ideaId      String?
  idea        Idea?          @relation(fields: [ideaId], references: [id])
  title       String
  projectId   String
  platform    String
  audience    String?        // target audience description
  language    String         // "ar" | "en"
  status      ScriptStatus   @default(DRAFT)
  assignedTo  String?        // content creator ID
  scenes      ScriptScene[]
  versions    ScriptVersion[]
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

enum ScriptStatus {
  DRAFT
  APPROVED
  IN_PRODUCTION
  DONE
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

model ScriptScene {
  id           String  @id @default(uuid())
  scriptId     String
  script       Script  @relation(fields: [scriptId], references: [id])
  order        Int
  description  String  // shot description
  cameraAngle  String? // "close-up", "wide", "overhead"
  setting      String? // "studio", "outdoor", "lifestyle"
  textOverlay  String? // text shown on screen
  voiceover    String? // voiceover script
  durationSec  Int?    // estimated seconds
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

model ScriptVersion {
  id        String   @id @default(uuid())
  scriptId  String
  script    Script   @relation(fields: [scriptId], references: [id])
  version   Int
  content   Json     // full script snapshot
  createdAt DateTime @default(now())
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}
```

## 5.2 API Routes

### Ideas
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/marketing/ideas` | List (filter by status, project, platform) |
| POST | `/api/v1/marketing/ideas` | Submit idea |
| PUT | `/api/v1/marketing/ideas/:id` | Update |
| PUT | `/api/v1/marketing/ideas/:id/status` | Change status |
| POST | `/api/v1/marketing/ideas/:id/comments` | Add comment |

### Competitor References
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/marketing/competitors` | List references |
| POST | `/api/v1/marketing/competitors` | Add reference |
| PUT | `/api/v1/marketing/competitors/:id` | Update |
| DELETE | `/api/v1/marketing/competitors/:id` | Delete |
| POST | `/api/v1/marketing/competitors/:id/generate-ideas` | AI: generate ideas from reference |

### AI Scripts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/marketing/scripts` | List scripts |
| POST | `/api/v1/marketing/scripts/generate` | AI: generate script |
| GET | `/api/v1/marketing/scripts/:id` | Get with scenes |
| PUT | `/api/v1/marketing/scripts/:id` | Update |
| PUT | `/api/v1/marketing/scripts/:id/scenes/:sceneId` | Edit scene |
| PUT | `/api/v1/marketing/scripts/:id/status` | Change status |
| PUT | `/api/v1/marketing/scripts/:id/assign` | Assign to creator |
| GET | `/api/v1/marketing/scripts/:id/versions` | Version history |
| GET | `/api/v1/marketing/scripts/:id/export-pdf` | Export as PDF |

## 5.3 AI Script Generation

### System Prompt
```
You are a professional video ad script writer for e-commerce brands.
You create detailed video scripts with scene-by-scene breakdowns.

For each scene provide:
- Scene number and duration (seconds)
- Visual description (what the viewer sees)
- Camera angle (close-up, wide, overhead, etc.)
- Setting (studio, outdoor, lifestyle, etc.)
- Text overlay (if any)
- Voiceover script (if any)

The script should be optimized for the specified platform:
- Meta/Instagram: 15-30 seconds, hook in first 3 seconds
- TikTok: 15-60 seconds, native/authentic feel
- Snapchat: 6-10 seconds, vertical, fast-paced

Write in the specified language (Arabic or English).
Make it conversion-focused with clear CTA.
```

### API Call
```typescript
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `
      Product: ${product.name} - ${product.description}
      Store: ${project.name}
      Platform: ${platform}
      Target Audience: ${audience}
      Language: ${language}
      Idea: ${idea.description}
      References: ${competitorNotes}

      Generate a detailed video script.
    `}
  ],
  temperature: 0.8,
  max_tokens: 2000,
  response_format: { type: "json_object" }
});
```

### Response Structure
```json
{
  "title": "Dual Name - هدية مش هتتنسي",
  "totalDuration": 25,
  "scenes": [
    {
      "order": 1,
      "durationSec": 3,
      "description": "Close-up of hands opening a gift box",
      "cameraAngle": "close-up",
      "setting": "lifestyle home",
      "textOverlay": "🎁 هدية مش هتتنسي",
      "voiceover": "عايز تهدي حد هدية مميزة؟"
    },
    {
      "order": 2,
      "durationSec": 5,
      "description": "Reveal the Dual Name product inside the box",
      "cameraAngle": "overhead",
      "setting": "lifestyle home",
      "textOverlay": null,
      "voiceover": "دوال نيم - اسمين في تصميم واحد"
    }
  ]
}
```

---

# PHASE 6: Publishing Tool

## 6.1 Database Schema

```prisma
// ===== SOCIAL PAGES =====

model SocialPage {
  id           String   @id @default(uuid())
  platform     String   // "facebook", "instagram", "tiktok"
  pageId       String   // platform's page/account ID
  pageName     String
  accessToken  String   // encrypted with AES-256-GCM (see Token Encryption below)
  refreshToken String?  // encrypted with AES-256-GCM
  tokenExpiry  DateTime?
  brandId      String   // linked to which brand
  brand        Brand    @relation(fields: [brandId], references: [id])
  isActive     Boolean  @default(true)
  posts        ScheduledPost[]
  @@unique([platform, pageId])
  @@map("mktg_social_pages")
}

// ===== TOKEN ENCRYPTION =====
// All access tokens & refresh tokens MUST be encrypted at rest.
// Implementation:
//
// import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
//
// const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY; // 32 bytes, stored ONLY in env vars
// const ALGORITHM = 'aes-256-gcm';
//
// function encryptToken(plaintext: string): string {
//   const iv = randomBytes(16);
//   const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
//   let encrypted = cipher.update(plaintext, 'utf8', 'hex');
//   encrypted += cipher.final('hex');
//   const authTag = cipher.getAuthTag().toString('hex');
//   return `${iv.toString('hex')}:${authTag}:${encrypted}`; // stored in DB
// }
//
// function decryptToken(ciphertext: string): string {
//   const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
//   const decipher = createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(ivHex, 'hex'));
//   decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
//   let decrypted = decipher.update(encrypted, 'hex', 'utf8');
//   decrypted += decipher.final('utf8');
//   return decrypted;
// }
//
// IMPORTANT: TOKEN_ENCRYPTION_KEY must be:
// - Generated with: openssl rand -hex 32
// - Stored ONLY in environment variables (Render dashboard)
// - NEVER committed to git or stored in the database
// - Rotated periodically with a migration script

model Brand {
  id        String       @id @default(uuid())
  name      String       @unique // "Print In", "Picked In", "Choroida"
  slug      String       @unique
  language  String       // "ar" | "en"
  pages     SocialPage[]
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

// ===== SCHEDULED POSTS =====

model ScheduledPost {
  id            String        @id @default(uuid())
  creativeId    String?       // linked creative from library
  caption       String        // post text/description
  mediaUrl      String?       // Google Drive URL or direct URL
  postType      PostType      // POST, STORY, REEL
  scheduledAt   DateTime
  status        PostStatus    @default(DRAFT)
  publishedAt   DateTime?
  publishedIds  Json?         // { facebook: "post_123", instagram: "media_456" }
  error         String?       // error message if publish failed
  createdBy     String
  pages         ScheduledPostPage[] // which pages to publish to
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

model ScheduledPostPage {
  id              String        @id @default(uuid())
  scheduledPostId String
  scheduledPost   ScheduledPost @relation(fields: [scheduledPostId], references: [id])
  socialPageId    String
  socialPage      SocialPage    @relation(fields: [socialPageId], references: [id])
  publishedId     String?       // platform's post ID after publishing
  status          PostStatus    @default(DRAFT)
  error           String?
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

enum PostType {
  POST
  STORY
  REEL
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

enum PostStatus {
  DRAFT
  SCHEDULED
  PUBLISHING
  PUBLISHED
  FAILED
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}
```

## 6.2 API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/marketing/calendar` | Posts by date range (for calendar view) |
| GET | `/api/v1/marketing/posts` | List all scheduled posts |
| POST | `/api/v1/marketing/posts` | Create scheduled post |
| PUT | `/api/v1/marketing/posts/:id` | Update post |
| DELETE | `/api/v1/marketing/posts/:id` | Delete (only if DRAFT/SCHEDULED) |
| POST | `/api/v1/marketing/posts/:id/publish-now` | Publish immediately |
| GET | `/api/v1/marketing/social-pages` | List connected pages |
| POST | `/api/v1/marketing/social-pages/connect` | Start OAuth flow |
| DELETE | `/api/v1/marketing/social-pages/:id` | Disconnect page |
| PUT | `/api/v1/marketing/social-pages/:id/brand` | Link page to brand |

## 6.3 Auto-Publishing Flow (BullMQ)

> **⚠️ لماذا NOT cron every minute:**
> - Cron job كل دقيقة على Render مكلف ويستهلك موارد
> - لو الـ publish فشل ما فيه retry تلقائي
> - لو في أكثر من instance يصير duplicate publishing
>
> **SOLUTION:** استخدام **BullMQ** مع Redis (الموجود أصلاً في docker-compose):
> - عند إنشاء scheduled post → يُضاف BullMQ delayed job بالوقت المحدد
> - BullMQ يشغّل الـ job في الوقت المضبوط بالتحديد
> - فيه retry تلقائي (3 محاولات مع backoff)
> - فيه dead letter queue للـ jobs اللي فشلت نهائياً
> - thread-safe: لو في أكثر من worker ما يصير duplicate

```typescript
import { Queue, Worker } from 'bullmq';
import { redisConnection } from './config/redis';

// --- Queue Setup ---
const publishQueue = new Queue('post-publishing', { connection: redisConnection });

// --- When scheduling a post ---
async function schedulePost(post: ScheduledPost) {
  const delay = post.scheduledAt.getTime() - Date.now();
  await publishQueue.add('publish', { postId: post.id }, {
    delay: Math.max(delay, 0),
    attempts: 3,
    backoff: { type: 'exponential', delay: 60000 }, // retry after 1min, 2min, 4min
    removeOnComplete: true,
    removeOnFail: false, // keep failed jobs for debugging
  });
}

// --- Worker processes jobs ---
const publishWorker = new Worker('post-publishing', async (job) => {
  const post = await prisma.scheduledPost.findUnique({
    where: { id: job.data.postId },
    include: { pages: { include: { socialPage: true } } }
  });

  if (!post || post.status !== 'SCHEDULED') return; // already processed

  await prisma.scheduledPost.update({
    where: { id: post.id },
    data: { status: 'PUBLISHING' }
  });

  for (const postPage of post.pages) {
    try {
      const publishedId = await publishToPlatform(
        postPage.socialPage.platform,
        decryptToken(postPage.socialPage.accessToken),
        postPage.socialPage.pageId,
        {
          caption: post.caption,
          mediaUrl: post.mediaUrl,
          postType: post.postType
        }
      );
      await prisma.scheduledPostPage.update({
        where: { id: postPage.id },
        data: { publishedId, status: 'PUBLISHED' }
      });
    } catch (err) {
      await prisma.scheduledPostPage.update({
        where: { id: postPage.id },
        data: { error: err.message, status: 'FAILED' }
      });
      // Sentry captures the error automatically
      logger.error({ postId: post.id, platform: postPage.socialPage.platform, err }, 'Publish failed');
      throw err; // rethrow so BullMQ retries
    }
  }

  await prisma.scheduledPost.update({
    where: { id: post.id },
    data: { status: 'PUBLISHED', publishedAt: new Date() }
  });
}, { connection: redisConnection, concurrency: 5 });

// --- Recurring Jobs (instead of cron) ---
// These run on schedule via BullMQ repeatable jobs
await publishQueue.add('check-fatigue', {}, {
  repeat: { pattern: '0 6 * * *' }, // daily at 6 AM
});
await publishQueue.add('sync-ad-data', {}, {
  repeat: { pattern: '0 */6 * * *' }, // every 6 hours
});
await publishQueue.add('check-budget-alerts', {}, {
  repeat: { pattern: '0 */6 * * *' }, // every 6 hours
});
```
```

## 6.4 Platform Publishing APIs

> **⚠️ IMPORTANT: Social API Limitations & Realistic Expectations**
>
> | Platform | Status | Notes |
> |----------|--------|-------|
> | **Facebook Pages** | ✅ Ready | Full support, straightforward |
> | **Instagram Posts** | ✅ Ready | Image + Video posts work well |
> | **Instagram Reels** | ⚠️ Limited | Works but video must be publicly accessible URL, no direct upload |
> | **Instagram Stories** | ❌ Not supported | Graph API does NOT support publishing Stories (only reading) |
> | **TikTok** | ⚠️ Requires Approval | `video.publish` scope needs app review — can take **weeks/months** |
> | **Snapchat** | ❌ No Publishing API | Snapchat has NO public content publishing API — only Ads API |
>
> **SOLUTION:** Implement in phases:
> - **Phase 6a (Now):** Facebook + Instagram Posts — fully automated
> - **Phase 6b (After TikTok approval):** TikTok — automated when approved
> - **Phase 6c (Manual fallback):** Snapchat + IG Stories — show "ready to post" with caption + media download, user posts manually
>
> For unsupported platforms, the calendar still tracks the post but shows a "Manual Post" badge with copy-caption and download-media buttons.

### Facebook Pages
```typescript
// Post with image
POST https://graph.facebook.com/v19.0/{page_id}/photos
Body: { url: imageUrl, caption: text, access_token: token }

// Post with video
POST https://graph.facebook.com/v19.0/{page_id}/videos
Body: { file_url: videoUrl, description: text, access_token: token }

// Required permissions: pages_manage_posts, pages_read_engagement
```

### Instagram (Business Account via Graph API)
```typescript
// Step 1: Create container
POST https://graph.facebook.com/v19.0/{ig_user_id}/media
Body: { image_url: url, caption: text, access_token: token }
// For reels: { video_url: url, caption: text, media_type: "REELS" }
// ❌ Stories: NOT supported via API — use manual fallback

// Step 2: Publish container
POST https://graph.facebook.com/v19.0/{ig_user_id}/media_publish
Body: { creation_id: containerId, access_token: token }

// Required permissions: instagram_basic, instagram_content_publish
```

### TikTok
```typescript
// ⚠️ Requires approved app — apply ASAP at business-api.tiktok.com
// Step 1: Init upload
POST https://open.tiktokapis.com/v2/post/publish/content/init/
Headers: { Authorization: "Bearer {token}" }
Body: {
  post_info: { title: caption, privacy_level: "PUBLIC_TO_EVERYONE" },
  source_info: { source: "PULL_FROM_URL", video_url: videoUrl }
}

// Required: video.publish scope (needs app review approval)
// Fallback while waiting: show "Manual Post" with video download link
```

### Snapchat (Manual Only)
```typescript
// ❌ Snapchat has NO content publishing API
// The calendar will track Snapchat posts but with manual workflow:
// 1. Post appears in calendar with "Manual" badge
// 2. User clicks → sees caption (copy button) + media (download button)
// 3. User posts manually on Snapchat
// 4. User marks as "Published" in the calendar
```

## 6.5 Content Calendar UI

```
┌─────────────────────────────────────────────────────────────┐
│ Content Calendar - March 2026        [< March >] [+New Post]│
├─────┬──────┬──────┬──────┬──────┬──────┬──────┬─────────────┤
│ Sun │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │ Sat  │             │
├─────┼──────┼──────┼──────┼──────┼──────┼──────┤             │
│  1  │  2   │  3   │  4   │  5   │  6   │  7   │             │
│     │📸 IG │      │🎬 FB │      │      │📸 TT │             │
│     │10:00 │      │15:00 │      │      │18:00 │             │
├─────┼──────┼──────┼──────┼──────┼──────┼──────┤             │
│  8  │  9   │ 10   │ 11   │ 12   │ 13   │ 14   │ Ramadan 🌙  │
│     │📸📸  │🎬    │      │📸    │      │🎬🎬  │             │
└─────┴──────┴──────┴──────┴──────┴──────┴──────┴─────────────┘

Click on a day → shows posts for that day
Click on a post → edit/preview
Drag post → reschedule
Color coding: 🟢 Published, 🟡 Scheduled, 🔴 Failed, ⚪ Draft
```

---

# PHASE 7: Media Buying Dashboard

## 7.1 Database Schema

```prisma
// ===== AD ACCOUNTS =====

model AdAccount {
  id            String     @id @default(uuid())
  platform      String     // "meta", "google", "tiktok", "snapchat"
  accountId     String     // platform's account ID
  accountName   String
  accessToken   String     // encrypted with AES-256-GCM (same encryptToken/decryptToken from SocialPage)
  refreshToken  String?    // encrypted with AES-256-GCM
  tokenExpiry   DateTime?
  brandId       String
  brand         Brand      @relation(fields: [brandId], references: [id])
  isActive      Boolean    @default(true)
  lastSyncAt    DateTime?
  campaigns     Campaign[]
  syncLogs      SyncLog[]
  @@unique([platform, accountId])
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

model Campaign {
  id           String     @id @default(uuid())
  adAccountId  String
  adAccount    AdAccount  @relation(fields: [adAccountId], references: [id])
  platformId   String     // campaign ID on the platform
  name         String
  status       String     // ACTIVE, PAUSED, COMPLETED
  objective    String?    // CONVERSIONS, TRAFFIC, etc.
  budget       Float?
  startDate    DateTime?
  endDate      DateTime?
  adSets       AdSet[]
  metrics      AdMetric[]
  @@unique([adAccountId, platformId])
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

model AdSet {
  id           String    @id @default(uuid())
  campaignId   String
  campaign     Campaign  @relation(fields: [campaignId], references: [id])
  platformId   String
  name         String
  status       String
  targeting    Json?     // audience targeting details
  budget       Float?
  ads          Ad[]
  metrics      AdMetric[]
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

model Ad {
  id           String    @id @default(uuid())
  adSetId      String
  adSet        AdSet     @relation(fields: [adSetId], references: [id])
  platformId   String
  name         String    // should contain creative code for UTM tracking
  status       String
  creativeCode String?   // extracted from ad name (e.g., "1-2-3-001")
  metrics      AdMetric[]
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

model AdMetric {
  id           String    @id @default(uuid())
  date         DateTime
  adAccountId  String?
  campaignId   String?
  campaign     Campaign? @relation(fields: [campaignId], references: [id])
  adSetId      String?
  adSet        AdSet?    @relation(fields: [adSetId], references: [id])
  adId         String?
  ad           Ad?       @relation(fields: [adId], references: [id])
  impressions  Int       @default(0)
  clicks       Int       @default(0)
  spend        Float     @default(0)
  conversions  Int       @default(0)
  leads        Int       @default(0)
  purchases    Int       @default(0)
  revenue      Float     @default(0)
  ctr          Float?    // calculated: clicks/impressions
  cpc          Float?    // calculated: spend/clicks
  cpl          Float?    // calculated: spend/leads
  cpa          Float?    // calculated: spend/purchases
  roas         Float?    // calculated: revenue/spend
  @@unique([date, adId])
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

model SyncLog {
  id             String   @id @default(uuid())
  adAccountId    String
  adAccount      AdAccount @relation(fields: [adAccountId], references: [id])
  syncType       String   // "incremental" | "full"
  status         String   // "success" | "failed" | "in_progress"
  recordsUpdated Int      @default(0)
  error          String?
  duration       Int?     // milliseconds
  startedAt      DateTime @default(now())
  completedAt    DateTime?
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}
```

## 7.2 OAuth Flows

### Meta Marketing API
```
1. App creation: developers.facebook.com → Create App → Business type
2. Required permissions: ads_management, ads_read, business_management
3. OAuth URL: https://www.facebook.com/v19.0/dialog/oauth
   ?client_id={app_id}
   &redirect_uri={callback_url}
   &scope=ads_management,ads_read
4. Token exchange: GET /oauth/access_token?code={code}&client_id=&client_secret=
5. Long-lived token: GET /oauth/access_token?grant_type=fb_exchange_token&fb_exchange_token={short_token}
   (60 day expiry, refresh before expiry)
```

### Google Ads API
```
1. Google Cloud Console → Create Project → Enable Google Ads API
2. Create OAuth 2.0 credentials
3. Apply for Developer Token (Basic access for own accounts)
4. OAuth URL: https://accounts.google.com/o/oauth2/auth
   ?client_id={id}
   &redirect_uri={callback}
   &scope=https://www.googleapis.com/auth/adwords
5. Token exchange: POST https://oauth2.googleapis.com/token
6. Refresh tokens don't expire (unless revoked)
```

### TikTok Marketing API
```
1. TikTok for Business → Developer Portal → Create App
2. Required scopes: ad.read, campaign.read, report.read
3. OAuth: https://business-api.tiktok.com/portal/auth
4. Token exchange: POST /open_api/v1.3/oauth2/access_token/
5. Token valid 24h, refresh with refresh_token
```

### Snapchat Marketing API
```
1. Snap Kit Developer Portal → Create App
2. Required scopes: snapchat-marketing-api
3. OAuth: https://accounts.snapchat.com/login/oauth2/authorize
4. Token exchange: POST /login/oauth2/access_token
5. Token valid 30 min, refresh with refresh_token
```

## 7.3 Data Sync (Cron Job)

```typescript
// Runs as BullMQ repeatable job (configured in Phase 6.3)
// Default: every 6h, configurable in Settings
async function syncAdData(account: AdAccount) {
  const log = await prisma.syncLog.create({
    data: { adAccountId: account.id, syncType: 'incremental', status: 'in_progress' }
  });

  try {
    // 1. Refresh token if needed
    await refreshTokenIfExpired(account);

    // 2. Pull campaigns
    const campaigns = await fetchCampaigns(account);

    // 3. Pull ad sets for each campaign
    for (const campaign of campaigns) {
      const adSets = await fetchAdSets(account, campaign.platformId);

      // 4. Pull ads for each ad set
      for (const adSet of adSets) {
        const ads = await fetchAds(account, adSet.platformId);

        // 5. Extract creative code from ad name
        for (const ad of ads) {
          ad.creativeCode = extractCreativeCode(ad.name);
          // e.g., ad name "1-2-3-001_conv_EG" → creativeCode: "1-2-3-001"
        }
      }
    }

    // 6. Pull metrics (last 7 days for incremental)
    const metrics = await fetchMetrics(account, { days: 7 });

    // 7. Upsert all data
    await upsertCampaigns(campaigns);
    await upsertMetrics(metrics);

    // 8. Link metrics to creatives via creative code
    await linkMetricsToCreatives(metrics);

    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: 'success', completedAt: new Date(), recordsUpdated: count }
    });
  } catch (err) {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: err.message, completedAt: new Date() }
    });
  }
}
```

## 7.4 API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/marketing/ad-accounts` | List connected accounts |
| POST | `/api/v1/marketing/ad-accounts/connect/:platform` | Start OAuth |
| GET | `/api/v1/marketing/ad-accounts/callback/:platform` | OAuth callback |
| DELETE | `/api/v1/marketing/ad-accounts/:id` | Disconnect |
| POST | `/api/v1/marketing/ad-accounts/:id/sync` | Force sync now |
| GET | `/api/v1/marketing/ad-accounts/:id/sync-logs` | Sync history |
| GET | `/api/v1/marketing/dashboard/overview` | Overview metrics (all platforms) |
| GET | `/api/v1/marketing/dashboard/by-platform` | Breakdown by platform |
| GET | `/api/v1/marketing/dashboard/by-brand` | Breakdown by brand/store |
| GET | `/api/v1/marketing/dashboard/campaigns` | Campaign list with metrics |
| GET | `/api/v1/marketing/dashboard/campaigns/:id` | Campaign detail with ad sets |

## 7.5 Dashboard UI

```
┌─────────────────────────────────────────────────────────┐
│ Media Buying Dashboard          [Date: Last 30 Days ▼]  │
├─────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ Total    │ │ Total    │ │ Total    │ │ Overall  │    │
│ │ Spend    │ │ Leads    │ │ Orders   │ │ ROAS     │    │
│ │ $12,450  │ │ 1,234    │ │ 345      │ │ 3.2x     │    │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                         │
│ Spend by Platform [Pie Chart]  │ Performance [Line Chart]│
│ ● Meta 65%                     │ 📈 Spend vs Revenue     │
│ ● Google 20%                   │    over time            │
│ ● TikTok 10%                  │                          │
│ ● Snapchat 5%                 │                          │
│                                                         │
│ By Store:                                               │
│ ┌──────────────┬────────┬───────┬────────┬──────┐       │
│ │ Store        │ Spend  │ Leads │ Orders │ ROAS │       │
│ │ Print In     │ $7,200 │ 720   │ 201    │ 3.5x │       │
│ │ Picked In    │ $3,800 │ 380   │ 108    │ 2.9x │       │
│ │ Choroida     │ $1,450 │ 134   │ 36     │ 2.8x │       │
│ └──────────────┴────────┴───────┴────────┴──────┘       │
│                                                         │
│ Top Campaigns:                                          │
│ ┌──────────────────┬────────┬──────┬──────┬──────┐      │
│ │ Campaign         │Platform│Spend │Leads │ ROAS │      │
│ │ Ramadan_DualName │ Meta   │$3,200│ 450  │ 4.1x │      │
│ │ Slipperz_Conv    │ Google │$1,800│ 190  │ 3.2x │      │
│ │ ...              │        │      │      │      │      │
│ └──────────────────┴────────┴──────┴──────┴──────┘      │
└─────────────────────────────────────────────────────────┘
```

---

# PHASE 8: Landing Page Builder

## 8.1 Database Schema

```prisma
model LandingPage {
  id           String              @id @default(uuid())
  title        String
  slug         String              // URL slug: "dual-name-ramadan"
  brandId      String
  brand        Brand               @relation(fields: [brandId], references: [id])
  productId    String?             // linked WooCommerce product
  html         String              // current HTML content
  status       LandingPageStatus   @default(DRAFT)
  createdBy    String
  publishedAt  DateTime?
  versions     LandingPageVersion[]
  fieldMappings FormFieldMapping[]
  abTests      ABTest[]            @relation("LPa")
  abTestsB     ABTest[]            @relation("LPb")
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt
  @@unique([brandId, slug])
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

enum LandingPageStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

model LandingPageVersion {
  id             String      @id @default(uuid())
  landingPageId  String
  landingPage    LandingPage @relation(fields: [landingPageId], references: [id])
  versionNumber  Int
  html           String
  editPrompt     String?     // "غيّر لون الزرار لأحمر"
  createdAt      DateTime    @default(now())
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

model FormFieldMapping {
  id             String      @id @default(uuid())
  landingPageId  String
  landingPage    LandingPage @relation(fields: [landingPageId], references: [id])
  formFieldName  String      // field name in HTML form: "name", "phone"
  leadField      String      // Dolphin Leads field: "name", "mobile", "email", "address", "custom1"...
  @@unique([landingPageId, formFieldName])
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

model ABTest {
  id              String      @id @default(uuid())
  landingPageAId  String
  landingPageA    LandingPage @relation("LPa", fields: [landingPageAId], references: [id])
  landingPageBId  String
  landingPageB    LandingPage @relation("LPb", fields: [landingPageBId], references: [id])
  status          ABTestStatus @default(RUNNING)
  winnerId        String?
  trafficSplit    Int          @default(50) // percentage for variant A
  startedAt       DateTime     @default(now())
  endedAt         DateTime?
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}

enum ABTestStatus {
  RUNNING
  COMPLETED
  CANCELLED
  @@map("mktg_...")  // use proper table name with mktg_ prefix
}
```

## 8.2 AI Generation (Claude API)

### System Prompt
```
You are an expert landing page designer and developer.
Generate a complete, self-contained HTML landing page.

Requirements:
- Complete HTML5 document (<!DOCTYPE>, <html>, <head>, <body>)
- All CSS inline in <style> tags
- Mobile-responsive (mobile-first)
- NO external stylesheets, NO JavaScript (will be injected separately)
- Modern, clean design with excellent typography
- Conversion-optimized with clear CTA
- Include a lead capture form with fields as specified
- Use the provided product images via their URLs
- RTL support if Arabic content
- Return ONLY the HTML code, no explanations

Form Requirements:
- Each form field must have a unique "name" attribute
- Form must have id="lp-form"
- Submit button must have type="submit"
- Common field names: "name", "phone", "email", "address", "city", "notes"
```

### Generation API Call
```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 8096,
  system: SYSTEM_PROMPT,
  messages: [{
    role: "user",
    content: [
      // Text instructions
      { type: "text", text: `
        Product: ${product.name}
        Price: ${product.price}
        Description: ${product.description}
        Store: ${brand.name}
        Language: ${brand.language === 'ar' ? 'Arabic (RTL)' : 'English'}

        Instructions: ${userInstructions}
        Reference URL: ${referenceUrl || 'none'}

        Form fields needed: ${requiredFields.join(', ')}
      `},
      // Product images as base64
      ...images.map(img => ({
        type: "image",
        source: { type: "base64", media_type: img.mimeType, data: img.base64 }
      }))
    ]
  }]
});

// Clean the HTML
let html = response.content[0].text;
html = html.replace(/<script[\s\S]*?<\/script>/gi, ''); // strip scripts
html = html.replace(/```html\n?/g, '').replace(/```\n?/g, ''); // strip markdown
```

## 8.3 AI Edit Chat

### Edit System Prompt
```
You are editing an existing HTML landing page.
The user will request changes in natural language.

Rules:
- Apply ONLY the requested changes
- Preserve all existing structure and styling not mentioned
- Keep the form id="lp-form" and all field names intact
- Return the COMPLETE modified HTML (not just the changed parts)
- NO JavaScript, NO external resources
- Return ONLY HTML, no explanations
```

### Edit Flow
```typescript
async function editLandingPage(currentHtml: string, editRequest: string) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8096,
    system: EDIT_SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `Current HTML:\n${currentHtml}\n\nRequested change: ${editRequest}`
    }]
  });

  const newHtml = cleanHtml(response.content[0].text);

  // Save version
  const versionCount = await prisma.landingPageVersion.count({
    where: { landingPageId }
  });
  await prisma.landingPageVersion.create({
    data: {
      landingPageId,
      versionNumber: versionCount + 1,
      html: newHtml,
      editPrompt: editRequest
    }
  });

  return newHtml;
}
```

## 8.4 Form Submission → Lead Creation

### Injected JavaScript (added when serving LP)
```javascript
// This script is injected into the landing page HTML before serving
const FORM_SCRIPT = `
<div style="position:absolute;left:-9999px;"><input type="text" name="_hp" tabindex="-1" autocomplete="off"></div>
<script>
document.getElementById('lp-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());

  // Add UTM params from URL
  const urlParams = new URLSearchParams(window.location.search);
  data._utm_source = urlParams.get('utm_source') || '';
  data._utm_medium = urlParams.get('utm_medium') || '';
  data._utm_campaign = urlParams.get('utm_campaign') || '';
  data._utm_content = urlParams.get('utm_content') || ''; // creative code here
  data._landing_page_id = '{{LANDING_PAGE_ID}}';

  try {
    const res = await fetch('{{API_URL}}/lp/submit/{{LP_ID}}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      // Show success message or redirect
      e.target.innerHTML = '<h2 style="text-align:center;color:green">✅ تم التسجيل بنجاح!</h2>';
    }
  } catch (err) {
    alert('حدث خطأ، حاول مرة أخرى');
  }
});
</script>`;
```

### Backend: Form Submission Handler

> **⚠️ SECURITY: Landing Page Form Protection**
> This endpoint is PUBLIC — it MUST be protected against spam bots and abuse.

```typescript
// POST /lp/submit/:landingPageId
// Protected by: rate limiting + honeypot + phone validation
const lpSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 submissions per IP per 15 min
  store: new RedisStore({ client: redisClient }),
  message: { success: false, error: 'Too many submissions, try again later' },
});

router.post('/lp/submit/:landingPageId', lpSubmitLimiter, handleFormSubmission);

async function handleFormSubmission(req, res) {
  const { landingPageId } = req.params;
  const formData = req.body;

  // --- HONEYPOT CHECK ---
  // The LP HTML includes a hidden field: <input type="text" name="_hp" style="display:none">
  // Bots fill it, humans don't
  if (formData._hp) {
    // Bot detected — return fake success (don't reveal detection)
    return res.json({ success: true });
  }

  // --- PHONE VALIDATION ---
  // Most spam bots submit garbage phone numbers
  if (formData.phone && !isValidPhone(formData.phone)) {
    return res.status(400).json({ success: false, error: 'رقم الهاتف غير صالح' });
  }

  // --- DUPLICATE CHECK ---
  // Prevent same phone submitting to same LP within 24 hours
  const existing = await prisma.lead.findFirst({
    where: {
      mobile: normalizePhone(formData.phone),
      landingPageId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }
  });
  if (existing) {
    return res.json({ success: true }); // fake success, don't create duplicate

  // 1. Get landing page + field mappings
  const lp = await prisma.landingPage.findUnique({
    where: { id: landingPageId },
    include: { fieldMappings: true }
  });

  // 2. Map form fields to lead fields
  const leadData = {};
  for (const mapping of lp.fieldMappings) {
    if (formData[mapping.formFieldName]) {
      leadData[mapping.leadField] = formData[mapping.formFieldName];
    }
  }

  // 3. Create lead in sales schema (cross-schema query)
  const lead = await prisma.lead.create({
    data: {
      ...leadData,
      source: 'landing_page',
      landingPageId: landingPageId,
      campaignId: formData._utm_campaign || null,
      creativeCode: formData._utm_content || null,
      productInterests: lp.productId ? { connect: { id: lp.productId } } : undefined,
    }
  });

  // 4. Create event for cross-module tracking
  await prisma.platformEvent.create({
    data: {
      eventType: 'marketing.landing.form_submitted',
      sourceModule: 'marketing',
      payload: { leadId: lead.id, landingPageId, campaignId: formData._utm_campaign }
    }
  });

  res.json({ success: true });
}
```

## 8.5 Landing Page Serving

```typescript
// GET lp.printin.sa/dual-name-ramadan
// or GET /lp/printin/dual-name-ramadan (if using path-based routing)
async function serveLandingPage(req, res) {
  const { brand, slug } = req.params;

  const lp = await prisma.landingPage.findUnique({
    where: { brandId_slug: { brandId: brand, slug } }
  });

  if (!lp || lp.status !== 'PUBLISHED') return res.status(404).send('Not found');

  // Check A/B test
  const abTest = await getActiveABTest(lp.id);
  let html = lp.html;
  if (abTest) {
    // Cookie-based: check if user already assigned
    const variant = req.cookies[`ab_${abTest.id}`] || (Math.random() < 0.5 ? 'A' : 'B');
    res.cookie(`ab_${abTest.id}`, variant, { maxAge: 30 * 24 * 60 * 60 * 1000 });
    html = variant === 'A' ? abTest.landingPageA.html : abTest.landingPageB.html;
  }

  // Inject form submission script
  html = html.replace('</body>', `${FORM_SCRIPT}</body>`);

  res.send(html);
}
```

## 8.6 API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/marketing/landing-pages` | List all LPs |
| POST | `/api/v1/marketing/landing-pages/generate` | AI generate new LP |
| GET | `/api/v1/marketing/landing-pages/:id` | Get LP with versions |
| POST | `/api/v1/marketing/landing-pages/:id/edit` | AI edit (chat) |
| PUT | `/api/v1/marketing/landing-pages/:id` | Update metadata |
| POST | `/api/v1/marketing/landing-pages/:id/publish` | Publish LP |
| POST | `/api/v1/marketing/landing-pages/:id/unpublish` | Unpublish |
| GET | `/api/v1/marketing/landing-pages/:id/versions` | Version history |
| POST | `/api/v1/marketing/landing-pages/:id/rollback/:versionId` | Rollback |
| GET | `/api/v1/marketing/landing-pages/:id/field-mappings` | Get mappings |
| PUT | `/api/v1/marketing/landing-pages/:id/field-mappings` | Update mappings |
| POST | `/api/v1/marketing/landing-pages/:id/ab-test` | Create A/B test |
| GET | `/api/v1/marketing/ab-tests` | List A/B tests |
| PUT | `/api/v1/marketing/ab-tests/:id/end` | End test, declare winner |
| GET | `/lp/:brand/:slug` | Serve public LP (public route) |
| POST | `/lp/submit/:landingPageId` | Form submission (public) |

## 8.7 Landing Page Editor UI

```
┌──────────────────────────────────────────────────────────┐
│ Landing Page: Dual Name - Ramadan    [v3] [Publish] [⚙️] │
├──────────────────┬───────────────────────────────────────┤
│  💬 AI Edit Chat │  📱 Live Preview                      │
│                  │                                       │
│  You: "أضف قسم  │  ┌─────────────────────────────────┐  │
│  آراء العملاء"   │  │                                 │  │
│                  │  │   [Landing Page HTML Preview]    │  │
│  🤖: تم إضافة   │  │   rendered in iframe             │  │
│  قسم آراء       │  │                                 │  │
│  العملاء ✅      │  │                                 │  │
│                  │  │                                 │  │
│  You: "غيّر     │  │                                 │  │
│  الزرار لأخضر"  │  │                                 │  │
│                  │  │                                 │  │
│  🤖: تم تغيير   │  │                                 │  │
│  لون الزرار ✅   │  │                                 │  │
│                  │  └─────────────────────────────────┘  │
│  [Type message]  │  [📱 Mobile] [💻 Desktop] [⬜ Tablet] │
├──────────────────┴───────────────────────────────────────┤
│ Version History: v1 (Created) → v2 (آراء) → v3 (زرار)  │
│ Field Mapping: [name→name] [phone→mobile] [city→address] │
│ Product: Dual Name (Print In)                            │
│ A/B Test: [Create A/B Test]                              │
│ URL: lp.printin.sa/dual-name-ramadan                     │
└──────────────────────────────────────────────────────────┘
```

---

# PHASE 9: Integration (Marketing ↔ Leads)

## 9.1 Changes to Leads Schema

> **⚠️ Cross-Module Queries:**
> بما أننا نستخدم single schema مع table prefixes (وليس separate schemas)، كل الـ tables في نفس الـ database
> والـ Prisma client واحد — فالـ cross-module queries تعمل مباشرة بدون مشاكل!
> مثلاً: `prisma.lead.findMany({ where: { creativeCode: "1-2-3-001" } })` يعمل من أي مكان.

```prisma
// Add these fields to the existing Lead model in schema.prisma (sales section)

model Lead {
  // ... existing fields ...
  campaignId     String?   // from UTM utm_campaign
  creativeCode   String?   // from UTM utm_content (e.g., "1-2-3-001")
  landingPageId  String?   // from landing page form submission
  utmSource      String?   // "facebook", "google", "tiktok"
  utmMedium      String?   // "cpc", "cpm"
  utmCampaign    String?   // campaign name
  utmContent     String?   // creative code
  @@map("sales_leads")
}
```

## 9.2 Full Data Flow

```
1. CREATIVE CREATION
   Creative created in Marketing → code: "1-2-3-001"

2. AD CREATION (on Meta/Google/TikTok)
   Ad name includes creative code: "1-2-3-001_conv_EG"
   UTM in ad URL: ?utm_content=1-2-3-001&utm_campaign=ramadan_2026

3. USER CLICKS AD
   → Goes to Landing Page: lp.printin.sa/dual-name?utm_content=1-2-3-001&...

4. USER FILLS FORM
   → POST /lp/submit/{lpId}
   → Backend creates Lead with:
     - name, phone, email (from form mapping)
     - productId (from LP product assignment)
     - creativeCode: "1-2-3-001" (from utm_content)
     - campaignId (from utm_campaign)
     - landingPageId (from LP ID)

5. SALES TEAM WORKS THE LEAD
   → Lead status: new → contacted → qualified → order
   → Order created with revenue amount

6. MARKETING SEES RESULTS
   → Creative "1-2-3-001":
     - Spend: $500 (from Ad APIs sync)
     - Leads: 45 (count from Dolphin Leads where creativeCode = "1-2-3-001")
     - Orders: 12 (count from Leads where order exists)
     - Revenue: $2,400 (sum of order values)
     - ROAS: $2,400 / $500 = 4.8x
     - CPL: $500 / 45 = $11.11
     - CPA: $500 / 12 = $41.67
```

## 9.3 ROI Calculation Queries

```typescript
// Get creative performance with real lead/order data
async function getCreativeROI(creativeCode: string, dateRange: DateRange) {
  // 1. Get spend from ad metrics
  const adMetrics = await prisma.adMetric.aggregate({
    where: {
      ad: { creativeCode },
      date: { gte: dateRange.from, lte: dateRange.to }
    },
    _sum: { spend: true, impressions: true, clicks: true }
  });

  // 2. Get leads from Dolphin Leads (cross-schema)
  const leadCount = await prisma.lead.count({
    where: {
      creativeCode,
      createdAt: { gte: dateRange.from, lte: dateRange.to }
    }
  });

  // 3. Get orders from leads
  const orders = await prisma.order.findMany({
    where: {
      lead: { creativeCode },
      createdAt: { gte: dateRange.from, lte: dateRange.to }
    }
  });

  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);

  return {
    creativeCode,
    spend: adMetrics._sum.spend || 0,
    impressions: adMetrics._sum.impressions || 0,
    clicks: adMetrics._sum.clicks || 0,
    leads: leadCount,
    orders: orders.length,
    revenue: totalRevenue,
    ctr: adMetrics._sum.clicks / adMetrics._sum.impressions,
    cpl: adMetrics._sum.spend / leadCount,
    cpa: adMetrics._sum.spend / orders.length,
    roas: totalRevenue / adMetrics._sum.spend
  };
}
```

## 9.4 Notification System

### Database Schema
```prisma
model Notification {
  id        String   @id @default(uuid())
  userId    String   // target user
  type      String   // "creative_fatigue", "budget_alert", "new_request", "conversion_drop"
  title     String
  body      String
  link      String?  // URL to navigate to
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())
  @@map("platform_...")  // use proper table name with platform_ prefix
}
```

### Notification Triggers

| Trigger | Condition | Cron |
|---------|-----------|------|
| Creative Fatigue | CTR drops >20% over 7 days | Daily |
| Budget Alert | Campaign spend > 80% of budget | Every 6h |
| New Request | Creative request created | Immediate (event) |
| Conversion Drop | LP conversion rate drops >30% | Daily |
| Scheduled Post | Post scheduled within 1 hour | Every 30min |
| Sync Failed | Ad account sync fails | Immediate |
| A/B Test Winner | Statistical significance reached | Daily |

### API Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/notifications` | User's notifications (paginated) |
| GET | `/api/v1/notifications/unread-count` | Count of unread |
| PUT | `/api/v1/notifications/:id/read` | Mark as read |
| PUT | `/api/v1/notifications/read-all` | Mark all as read |

### Frontend: Notification Bell
```tsx
// In Header component
function NotificationBell() {
  const { data } = useQuery('/api/v1/notifications/unread-count');
  // Shows bell icon with red badge showing unread count
  // Click → dropdown with recent notifications
  // Each notification → click to navigate to relevant page
}
```

---

# USER ROLES — FULL PERMISSIONS MATRIX

## Marketing Module Permissions

| Permission | CEO | Mkt Manager | Content Super | Content Creator | Media Buyer | Account Mgr |
|-----------|-----|-------------|---------------|-----------------|-------------|-------------|
| `creatives.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `creatives.create` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `creatives.edit` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `creatives.delete` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `requests.view` | ✅ | ✅ | ✅ | own only | ❌ | ✅ |
| `requests.create` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `requests.manage` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `ideas.view` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `ideas.create` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `ideas.approve` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `scripts.generate` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `scripts.view` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `publishing.schedule` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `publishing.publish` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `campaigns.view` | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `spend.view` | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `landing_pages.create` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `landing_pages.edit` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `landing_pages.view` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `settings.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `settings.view` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

---

# SETTINGS PAGE — COMPLETE

1. **Ad Accounts** — Connect Meta, Google, TikTok, Snapchat (OAuth)
2. **Social Pages** — Connect FB/IG/TikTok pages + link to Brand
3. **Landing Page Domains** — Configure subdomain per brand
4. **Creative Code Format** — Define segments, values, separator
5. **Tags & Categories** — Manage categories + tags
6. **Products & Projects** — Manage dropdowns (synced from Leads)
7. **AI Configuration** — OpenAI key (scripts) + Claude key (LPs)
8. **Sync Schedule** — Ad data pull frequency
9. **Notifications** — Which alerts are on/off
10. **Team & Permissions** — Module role assignments

---

# DEPLOYMENT ON RENDER

```
Render Dashboard:
├── Web Service: "dolphin-platform"
│   ├── Build: pnpm install && pnpm build
│   ├── Start: node backend/dist/index.js
│   ├── Auto-deploy from GitHub main branch
│   └── Environment Variables:
│       ├── DATABASE_URL=postgresql://...
│       ├── REDIS_URL=redis://...
│       ├── JWT_SECRET=...
│       ├── TOKEN_ENCRYPTION_KEY=...          # For AES-256-GCM token encryption
│       ├── OPENAI_API_KEY=...
│       ├── ANTHROPIC_API_KEY=...
│       ├── META_APP_ID=...
│       ├── META_APP_SECRET=...
│       ├── GOOGLE_CLIENT_ID=...
│       ├── GOOGLE_CLIENT_SECRET=...
│       ├── SENTRY_DSN=...                    # Error tracking
│       ├── CLOUDFLARE_R2_ACCESS_KEY=...      # File storage
│       ├── CLOUDFLARE_R2_SECRET_KEY=...
│       ├── CLOUDFLARE_R2_BUCKET=...
│       └── NODE_ENV=production
│
├── PostgreSQL: "dolphin-platform-db"
│   └── Plan: Starter ($7/mo) or Standard
│
├── Redis: "dolphin-platform-redis"
│   └── Plan: Starter ($10/mo) — for BullMQ + rate limiting + permissions cache
│
└── Custom Domains:
    ├── dolphin.digitics.com → Web Service
    ├── lp.printin.sa → Web Service (LP route)
    ├── lp.pickedin.com → Web Service (LP route)
    └── lp.choroida.com → Web Service (LP route)
```

---

# PARALLEL ACTIONS (Start Now)

1. **Developer Accounts** (Claude will guide step by step):
   - Meta Business → developers.facebook.com
   - Google Ads → console.cloud.google.com
   - TikTok → business-api.tiktok.com
   - Snapchat → kit.snapchat.com

2. **DNS for Landing Pages:**
   - `lp.printin.sa` → CNAME to Render
   - `lp.pickedin.com` → CNAME to Render
   - `lp.choroida.com` → CNAME to Render

3. **SSL:** Render provides auto-SSL for custom domains (free)

---

# VERIFICATION CHECKLIST

## Phase 1: Monorepo + Move
- [ ] `pnpm install` works from root
- [ ] `@dolphin/*` packages resolve
- [ ] Leads works at `/leads` exactly as before
- [ ] Homepage shows module switcher
- [ ] "دولفين ليدز" appears in titles
- [ ] Docker builds locally

## Phase 2: Auth
- [ ] Login at `/login` works
- [ ] JWT token contains module permissions
- [ ] User management page works
- [ ] Sidebar shows only accessible modules
- [ ] Protected routes enforce permissions

## Phase 3: Marketing Scaffold
- [ ] Marketing accessible at `/marketing`
- [ ] All sub-pages render
- [ ] Auth enforced

## Phase 4: Creative Index
- [ ] Create creative with auto-generated code
- [ ] Tags CRUD + multi-tag filtering
- [ ] Saved filters work
- [ ] Creative requests workflow
- [ ] Performance data displays
- [ ] Fatigue alert fires

## Phase 5: Ideas + AI
- [ ] Submit/approve ideas
- [ ] Competitor library CRUD
- [ ] AI script generation returns usable output
- [ ] Script editing + versioning
- [ ] PDF export

## Phase 6: Publishing
- [ ] Content calendar renders
- [ ] Schedule posts via BullMQ delayed jobs
- [ ] Auto-publish to Facebook
- [ ] Auto-publish to Instagram (Posts + Reels)
- [ ] Manual fallback UI for Snapchat + IG Stories
- [ ] TikTok app review submitted
- [ ] Social pages connected + linked to brands
- [ ] Failed jobs visible in admin dashboard

## Phase 7: Media Buying
- [ ] Meta OAuth connects
- [ ] Google OAuth connects
- [ ] TikTok OAuth connects
- [ ] Data sync pulls real metrics
- [ ] Dashboard shows unified view
- [ ] Creative code extracted from ad names

## Phase 8: Landing Pages
- [ ] AI generates LP from instructions
- [ ] AI edit chat works
- [ ] Version history + rollback
- [ ] Form field mapping
- [ ] Form submission → Lead created
- [ ] Product auto-assigned
- [ ] LP served on brand subdomain
- [ ] A/B testing works
- [ ] Honeypot spam protection working
- [ ] Rate limiting on submission endpoint
- [ ] Duplicate phone check within 24h

## Phase 9: Integration
- [ ] Creative code flows: Marketing → Ad → UTM → Lead
- [ ] Campaign ID on leads
- [ ] ROI calculations accurate
- [ ] Notifications fire correctly

## Cross-Cutting (All Phases)
- [ ] API versioning: all routes under `/api/v1/`
- [ ] Pino structured logging working
- [ ] Sentry error tracking connected
- [ ] Rate limiting on all public endpoints
- [ ] Token encryption (AES-256-GCM) for all stored access tokens
- [ ] Redis permissions cache working
- [ ] BullMQ dashboard accessible (admin only)
- [ ] Cloudflare R2 for thumbnails/assets
- [ ] Unit tests for critical services (auth, creative code generation, ROI calculation)
- [ ] Integration tests for critical API flows (form submission → lead creation)

---

# PHASE 10: Migration Plan (Dolphin → Dolphin Platform)

> **⚠️ This phase was missing from the original plan.** Moving from `dolphin/` to `dolphin-platform/` requires a careful migration strategy to avoid data loss and downtime.

## 10.1 Migration Strategy: Zero-Downtime

```
Step 1: PREPARE (while old system is running)
├── Create dolphin-platform repo on GitHub
├── Set up monorepo structure (Phase 1.1)
├── Move code into new structure (Phase 1.3)
├── Test locally: all Leads features work at /leads
└── Duration: 1-2 days

Step 2: DATABASE MIGRATION
├── Option A (Recommended): Same database, add new tables
│   ├── Keep existing tables as-is (they become sales_* tables)
│   ├── Add auth_* tables (new)
│   ├── Add mktg_* tables (new)
│   ├── Add migration columns to existing leads table (utmSource, creativeCode, etc.)
│   └── Run: prisma migrate deploy
│
├── Option B (Clean start): New database + data migration
│   ├── Create new PostgreSQL on Render
│   ├── Run schema migration
│   ├── Export data from old DB: pg_dump --data-only --table=leads,customers,orders,products,shifts
│   ├── Import into new DB with table mapping
│   └── Verify row counts match
│
└── Duration: 2-4 hours

Step 3: DEPLOY NEW VERSION
├── Deploy dolphin-platform to Render (new Web Service)
├── Test all Leads features at new URL
├── Switch DNS: dolphin.digitics.com → new service
├── Keep old service running for 48h (rollback safety)
└── Duration: 1 hour

Step 4: VERIFY + CLEANUP
├── Verify all features work
├── Check data integrity
├── Monitor Sentry for errors (48h)
├── If all good: shut down old service
└── Duration: 48 hours monitoring
```

## 10.2 Rollback Plan

```
IF something goes wrong:
├── DNS rollback: point dolphin.digitics.com back to old service (< 5 min)
├── Old service is still running with original database
├── Investigate issue, fix, redeploy
└── Re-attempt migration
```

## 10.3 Data Migration Script

```typescript
// scripts/migrate-data.ts
// Only needed if using Option B (new database)
import { PrismaClient as OldClient } from './old-prisma';
import { PrismaClient as NewClient } from './new-prisma';

async function migrateData() {
  const old = new OldClient({ datasources: { db: { url: OLD_DATABASE_URL } } });
  const newDb = new NewClient({ datasources: { db: { url: NEW_DATABASE_URL } } });

  // 1. Migrate users → auth_users
  const users = await old.user.findMany();
  for (const user of users) {
    await newDb.user.create({
      data: {
        id: user.id, // preserve IDs
        email: user.email,
        passwordHash: user.passwordHash,
        name: user.name,
        phone: user.phone,
        isActive: user.isActive,
        isSuperAdmin: user.role === 'admin',
      }
    });
  }

  // 2. Migrate leads, customers, orders, products, shifts
  // ... similar pattern for each table

  // 3. Verify counts
  const oldCount = await old.lead.count();
  const newCount = await newDb.lead.count();
  console.log(`Leads: old=${oldCount}, new=${newCount}, match=${oldCount === newCount}`);
}
```

---

# PHASE 11: Error Handling & Logging

## 11.1 Global Error Handler

```typescript
// backend/src/shared/middleware/error-handler.ts
import * as Sentry from '@sentry/node';
import { logger } from '../config/logger';

export function globalErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // Log with full context
  logger.error({
    err,
    method: req.method,
    url: req.url,
    userId: req.user?.sub,
    body: req.method !== 'GET' ? req.body : undefined,
  }, 'Unhandled error');

  // Report to Sentry
  Sentry.captureException(err, {
    tags: {
      module: req.url.includes('/marketing') ? 'marketing' : req.url.includes('/leads') ? 'leads' : 'auth',
    },
    user: req.user ? { id: req.user.sub, email: req.user.email } : undefined,
  });

  // Don't leak internal errors to client
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: statusCode === 500 ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
```

## 11.2 Structured Logging (Pino)

```typescript
// backend/src/config/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined, // JSON in production (Render captures it)
  redact: [
    'req.headers.authorization',
    'req.body.password',
    'req.body.accessToken',
  ], // never log sensitive data
});
```

## 11.3 Sentry Setup

```typescript
// backend/src/config/sentry.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
  integrations: [
    Sentry.prismaIntegration(), // track slow DB queries
  ],
  beforeSend(event) {
    // Scrub sensitive data
    if (event.request?.data) {
      delete event.request.data.password;
      delete event.request.data.accessToken;
    }
    return event;
  },
});
```

---

# PHASE 12: File Storage (Cloudflare R2)

> **لماذا NOT Google Drive فقط:**
> - Google Drive URLs ممكن تنكسر أو تتغير صلاحياتها
> - الـ thumbnails تحتاج تكون سريعة و reliable
> - R2 أرخص من S3 (لا توجد رسوم egress)

## 12.1 Setup

```typescript
// backend/src/config/storage.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY!,
  },
});

export async function uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
  await r2Client.send(new PutObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

export async function getSignedDownloadUrl(key: string): Promise<string> {
  return getSignedUrl(r2Client, new GetObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET,
    Key: key,
  }), { expiresIn: 3600 });
}
```

## 12.2 Usage

```
Storage Structure:
├── thumbnails/
│   └── {creativeId}.jpg          # Creative thumbnails (auto-generated)
├── lp-assets/
│   └── {landingPageId}/{file}    # Landing page images
├── competitor-screenshots/
│   └── {referenceId}.jpg         # Competitor screenshots
└── exports/
    └── {scriptId}.pdf            # Exported script PDFs
```

## 12.3 Thumbnail Generation

```typescript
// When creative is created with a Drive URL, auto-generate thumbnail
async function generateThumbnail(creative: Creative) {
  if (creative.type === 'IMAGE' && creative.driveUrl) {
    // Download from Google Drive
    const imageBuffer = await downloadFromDrive(creative.driveUrl);
    // Resize to thumbnail (sharp library)
    const thumbnail = await sharp(imageBuffer).resize(400, 400, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
    // Upload to R2
    const url = await uploadFile(`thumbnails/${creative.id}.jpg`, thumbnail, 'image/jpeg');
    // Update creative
    await prisma.creative.update({ where: { id: creative.id }, data: { thumbnailUrl: url } });
  }
}
```

---

# PHASE 13: Testing Strategy

> **⚠️ الخطة الأصلية ما تذكر أي tests — هذا خطير لنظام بهذا الحجم.**

## 13.1 Testing Stack

- **Unit Tests:** Vitest (fast, TypeScript-native)
- **Integration Tests:** Vitest + Supertest (API endpoints)
- **E2E Tests:** Playwright (critical flows only — later)

## 13.2 What to Test (Priority Order)

### Critical (Must Have Before Launch)

```
backend/src/modules/auth/__tests__/
├── auth.service.test.ts         # login, register, token refresh
├── permissions.test.ts          # role-based access control
└── auth.routes.test.ts          # API integration tests

backend/src/modules/leads/__tests__/
├── leads.routes.test.ts         # CRUD operations
└── lead-creation.test.ts        # form submission → lead creation flow

backend/src/shared/__tests__/
├── creative-code.test.ts        # code generation logic (edge cases!)
├── roi-calculation.test.ts      # ROI/ROAS calculations
└── token-encryption.test.ts     # encrypt/decrypt roundtrip
```

### Important (Before Production)

```
backend/src/modules/marketing/__tests__/
├── creative.service.test.ts     # CRUD + code generation
├── fatigue-detection.test.ts    # creative fatigue logic
├── publishing.test.ts           # BullMQ job creation
└── landing-page.test.ts         # form submission + field mapping
```

## 13.3 Example Test

```typescript
// backend/src/shared/__tests__/creative-code.test.ts
import { describe, it, expect } from 'vitest';
import { generateCreativeCode } from '../utils/creative-code';

describe('generateCreativeCode', () => {
  it('generates first code with 001 suffix', async () => {
    const code = await generateCreativeCode([
      { code: '1' }, // Arabic
      { code: '2' }, // Picked In
      { code: '3' }, // Dual Name
    ]);
    expect(code).toBe('1-2-3-001');
  });

  it('increments sequence number correctly', async () => {
    // Mock: last creative with prefix "1-2-3" has code "1-2-3-005"
    const code = await generateCreativeCode([
      { code: '1' }, { code: '2' }, { code: '3' },
    ]);
    expect(code).toBe('1-2-3-006');
  });

  it('handles different separators', async () => {
    // Config separator = "."
    const code = await generateCreativeCode([
      { code: '1' }, { code: '2' },
    ], { separator: '.' });
    expect(code).toBe('1.2.001');
  });
});
```

## 13.4 CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: dolphin_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: pnpm --filter backend prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/dolphin_test
      - run: pnpm --filter backend test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/dolphin_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret
          TOKEN_ENCRYPTION_KEY: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```
