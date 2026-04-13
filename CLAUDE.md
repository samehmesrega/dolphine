# CLAUDE.md

دليل عمل لـ Claude Code عند التعامل مع كود المشروع.

## Git & Code Navigation

- دايماً تأكد من الـ repository والـ branch والـ file paths الصح **قبل** أي تعديل. لو مش متأكد أنهي codebase أو directory فيه الكود الشغال — **اسأل الأول**
- الـ default branch هو `main` مش `master`. دايماً اعمل push على `main` إلا لو اتقالك غير كدا
- دايماً عمل commit و push بعد أي تغيير إلا لو اتقالك غير كدا
- TypeScript لازم يعمل compile نظيف قبل الـ commit

## Development Principles

- ابدأ بأبسط حل ممكن. **ما تعملش over-engineer** (مثلاً: ما تقترحش VPS لما local يكفي، ما تبنيش من الصفر لما نسخ الملفات يحل الموضوع). اسأل قبل ما تضيف تعقيد
- ما تبنيش من الصفر لو تقدر تنسخ أو تعيد استخدام كود موجود
- اسأل قبل ما تختار architecture معقد

## Deployment & Production

- لما تصلح مشكلة في الـ production، **جرب التغييرات locally الأول** قبل ما تعمل deploy
- ما تستخدمش destructive flags (زي `--accept-data-loss`) بدون موافقة صريحة من المستخدم
- خلّي بالك من تغييرات البنية التحتية (Redis, rate limiting, env vars) — ممكن توقع الـ production

## Communication & Accuracy

- لو المستخدم شارك screenshot أو mockup، اشتغل على اللي ظاهر فيه بس
- ما تفترضش قيود platform — تحقق الأول

## External APIs

- لما تشتغل مع APIs خارجية (Meta, WhatsApp, Google)، **تحقق من القواعد الخاصة بكل platform** قبل ما تقولها
- الـ 24-hour messaging window بتخص **WhatsApp API بس** — مش Messenger أو Instagram DMs

## Domain Knowledge

- الـ stack الأساسي: TypeScript (backend + frontend)
- لما تعمل WooCommerce integrations، استخدم **منتج واحد generic/reusable** بدل ما تعمل منتجات فردية تملأ المتجر

## Project Overview

Dolphin Platform — نظام إدارة داخلي لشركة Digitics المصرية. يشمل إدارة العملاء المحتملين (CRM)، التسويق، صندوق الوارد (Messenger/Instagram)، بنك المعلومات، والتذاكر. المشروع **pnpm monorepo** يتكون من backend و frontend ومشاريع مساعدة. منشور على **Render.com** على `dolphin-platform.onrender.com`.

---

## Tech Stack

### Backend

| Library | Version | الغرض |
|---|---|---|
| Express | ^4.21.1 | HTTP server |
| TypeScript | ^5.6.3 | Type safety |
| Prisma | ^5.22.0 | PostgreSQL ORM |
| PostgreSQL | 16 | قاعدة البيانات (عبر Docker) |
| Redis | 7 | Cache + rate limiting + job queue |
| BullMQ | ^5.12.0 | Job queue (مبني على Redis) |
| ioredis | ^5.4.1 | Redis client |
| jsonwebtoken | ^9.0.2 | JWT authentication |
| bcryptjs | ^2.4.3 | Password hashing |
| Zod | ^4.3.6 | Input validation |
| Pino + pino-http | ^9.5.0 / ^10.3.0 | Structured logging |
| Helmet | ^8.1.0 | Security headers |
| express-rate-limit | ^7.4.1 | Rate limiting (مع rate-limit-redis) |
| Multer | ^1.4.5-lts.1 | File uploads |
| Nodemailer | ^8.0.3 | Email sending (SMTP) |
| google-auth-library | ^10.6.2 | Google OAuth |
| AWS S3 SDK | ^3.1006.0 | Cloudflare R2 storage (S3-compatible) |
| cors | ^2.8.5 | CORS |
| dotenv | ^16.4.5 | Environment variables |
| libphonenumber-js | ^1.11.14 | Phone number normalization |
| exif-reader | ^2.0.3 | Image metadata |
| uuid | ^10.0.0 | UUID generation |
| tsx | ^4.19.2 | TypeScript execution (dev) |
| Vitest | ^2.1.0 | Testing |

### Frontend

| Library | Version | الغرض |
|---|---|---|
| React | ^18.3.1 | UI library |
| React Router DOM | ^6.28.0 | Client-side routing (lazy-loaded) |
| TanStack React Query | ^5.90.21 | Data fetching/caching (staleTime: 60s) |
| Axios | ^1.7.7 | HTTP client (JWT interceptors) |
| Vite | ^5.4.11 | Build tool + dev server (port 3000) |
| TypeScript | ^5.6.3 | Type safety |
| Tailwind CSS | ^3.4.15 | Utility CSS |
| Recharts | ^3.7.0 | Charts/data visualization |
| Three.js | ^0.183.2 | 3D rendering (dual-name engine) |
| @jscad/modeling | ^2.13.0 | CSG operations (3D) |
| opentype.js | ^1.3.4 | Font parsing (3D) |
| @react-oauth/google | ^0.13.4 | Google OAuth login |
| react-google-recaptcha-v3 | ^1.11.0 | Bot protection |
| html2canvas | ^1.4.1 | Screenshot capture |
| PostCSS + Autoprefixer | ^8.4.49 / ^10.4.20 | CSS processing |

### Dual-Name (مشروع مستقل)

| Library | Version | الغرض |
|---|---|---|
| Vite | ^6.3.0 | Build tool + dev server (port 3001) |
| Three.js | ^0.175.0 | 3D rendering |
| @jscad/modeling | ^2.13.0 | CSG operations |
| opentype.js | ^1.3.4 | Font parsing |
| Express | ^5.2.1 | Static server (production) |
| jszip | ^3.10.1 | Batch ZIP export |
| googleapis | ^171.4.0 | Google Sheets (batch generation) |
| Multer | ^2.1.1 | File uploads |

---

## Folder Structure

```
dolphin-platform/
├── backend/                    # Express REST API (port 4000)
│   ├── src/
│   │   ├── index.ts            # Entry point — route mounting, middleware, startup
│   │   ├── db.ts               # Prisma client instance
│   │   ├── modules/
│   │   │   ├── auth/           # تسجيل دخول، OAuth، صلاحيات
│   │   │   ├── leads/          # CRM: عملاء، طلبات، منتجات، تقارير
│   │   │   ├── marketing/      # حملات إعلانية، كرييتيفز، landing pages
│   │   │   ├── inbox/          # رسائل Messenger/Instagram، تعليقات
│   │   │   ├── knowledge-base/ # بنك المعلومات: منتجات، أسعار، FAQ
│   │   │   ├── settings/       # إعدادات المنصة والمستخدمين
│   │   │   └── tickets/        # نظام التذاكر الداخلي
│   │   └── shared/
│   │       ├── config/         # Environment config, logger (Pino), Redis client
│   │       ├── middleware/      # auth (JWT+RBAC), error-handler, upload (Multer)
│   │       ├── services/       # email, Google Drive, Google API, metrics, WooCommerce config
│   │       └── utils/          # phone normalization, R2 storage, token encryption
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema (~1685 سطر)
│   │   └── seed.ts             # Seed: roles, permissions, modules
│   └── dist/                   # Compiled output
├── frontend/                   # React SPA (Vite, port 3000)
│   ├── src/
│   │   ├── App.tsx             # Routing, providers, lazy loading
│   │   ├── main.tsx            # Entry point + service worker registration
│   │   ├── index.css           # Tailwind imports + Arabic font setup
│   │   ├── modules/
│   │   │   ├── auth/           # Login, Register, OAuth callbacks, AuthContext
│   │   │   ├── leads/          # Dashboard, Leads, Customers, Orders, Reports, DualName
│   │   │   ├── marketing/      # Creatives, Campaigns, Landing Pages, Scripts, Media Buying
│   │   │   ├── inbox/          # Conversations, Channel Settings, Stats
│   │   │   ├── knowledge-base/ # Products, ProductDetail, ProductForm
│   │   │   └── settings/       # Pending Users, Tickets
│   │   └── shared/
│   │       ├── Layout/         # AppShell, Sidebar, ModuleSwitcher
│   │       ├── components/     # ErrorBoundary, FloatingBugButton, DateRangePicker, NotificationBell
│   │       ├── pages/          # ProfilePage, RolesPage, UsersPage
│   │       └── services/       # api.ts (Axios instance + interceptors)
│   └── dist/                   # Build output (يقدمه الـ backend في production)
├── dual-name/                  # مولّد أسماء ثلاثية الأبعاد (Ambigram 3D)
│   ├── src/
│   │   ├── engine/             # FontLoader, GlyphToJSCAD, AmbigramBuilder, SceneManager, STLExporter
│   │   ├── ui/                 # InputPanel, PreviewPanel, CustomerPanel
│   │   └── ecommerce/         # Shopify integration
│   ├── shopify-extension/      # Shopify snippet (Liquid)
│   ├── woocommerce-plugin/     # WooCommerce integration
│   ├── slicer-profiles/        # 3D printing profiles
│   ├── index.html              # الواجهة الرئيسية
│   ├── embed.html              # Iframe embed للمتاجر
│   └── customer.html           # واجهة العميل (Shopify)
├── chrome-extension/           # Dolphin WhatsApp Monitor (Manifest v3)
│   ├── content/                # DOM injection في WhatsApp Web
│   ├── background/             # Service worker
│   └── popup/                  # UI تسجيل الدخول + التحكم
├── whatsapp-otp-verification/  # WordPress plugin — تحقق OTP عبر WhatsApp
│   └── includes/               # OTP handler + WhatsApp API integration
├── agent/                      # أدوات مزامنة التذاكر
│   ├── sync-tickets.ts         # مزامنة التذاكر
│   ├── ticket-reader.ts        # قراءة التذاكر حسب الموديول
│   └── ticket-updater.ts       # تحديث حالة التذاكر
├── docker-compose.yml          # PostgreSQL 16 + Redis 7
├── render.yaml                 # إعدادات النشر على Render.com
├── pnpm-workspace.yaml         # Workspaces: backend, frontend, packages/*
├── DESIGN.md                   # مواصفات نظام التصميم
└── package.json                # Root scripts, engines (node >=18, pnpm >=8)
```

---

## Built Modules (الموديولات المبنية)

### Auth — مكتمل
تسجيل دخول (email + Google OAuth + Slack OAuth)، تسجيل حساب، نسيت كلمة المرور، تحقق البريد، RBAC بصلاحيات granular.

### Leads — مكتمل (الموديول الأكبر)
إدارة الـ leads، العملاء، الطلبات، المنتجات. Dashboard وتقارير (مبيعات، تسويق، عام، Hall of Fame). نظام المهام (tasks) مع قواعد تلقائية (task rules). الورديات (shifts) مع توزيع round-robin. القائمة السوداء. سجل المراجعة (audit log). الإشعارات.

**Integrations في Leads:**
- WooCommerce sync (منتجات + طلبات عبر webhooks)
- Bosta shipping (تتبع الشحنات عبر webhooks)
- Google Sheets (استيراد leads + تصدير طلبات)
- Form connections (استقبال leads من WordPress Forminator)
- WhatsApp monitor (عبر Chrome extension)

### Marketing — مكتمل
مكتبة الكرييتيفز (أكواد تلقائية)، طلبات كرييتيف (workflow)، بنك الأفكار (مع تعليقات)، مكتبة المنافسين، مولّد السكربتات (AI — OpenAI)، Landing pages (AI-generated مع A/B testing)، Order forms، Content calendar (جدولة نشر)، Media buying (حملات Meta مع sync كل ساعتين)، إعدادات الموديول (AI providers، Meta OAuth).

### Inbox — في التطوير
صندوق وارد لرسائل Messenger و Instagram DM وتعليقات. ربط القنوات (Meta OAuth). مزامنة المحادثات والتعليقات. إحصائيات. تحويل محادثة إلى lead.

### Knowledge Base (بنك المعلومات) — في التطوير
كتالوج منتجات شامل: بيانات المنتج، الأسعار (بالعملات والأنواع)، المتغيرات (variations)، الموردين، التصنيع، التسويق (USPs, target audience)، الأسئلة الشائعة، الاعتراضات، الـ upsells، ما بعد البيع، سكربتات المبيعات، الوسائط. استيراد من WooCommerce.

### Settings — في التطوير
إدارة المستخدمين المعلقين (pending). صفحة التذاكر.

### Tickets — مكتمل
نظام تذاكر داخلي (bug/improvement/suggestion) مع تعليقات ولقطات شاشة. كل تذكرة مرتبطة بموديول معين.

### Dual-Name 3D — مكتمل (مشروع مستقل)
مولّد أسماء ثلاثية الأبعاد (ambigram). يقرأ كلمة من زاوية 45° وكلمة تانية من 135°. يدعم 6 خطوط + نقش عربي/إنجليزي على القاعدة. تصدير STL للطباعة ثلاثية الأبعاد. فيه integration مع Shopify و WooCommerce. منشور على `dna-si1n.onrender.com`.

### Chrome Extension (WhatsApp Monitor) — مكتمل
يراقب محادثات WhatsApp Web ويربطها بالـ leads الموجودين في النظام (مطابقة برقم الموبايل).

### WhatsApp OTP Verification — مكتمل
WordPress plugin (PHP) لتحقق أرقام الموبايل عبر WhatsApp OTP قبل إرسال فورم Forminator. يستخدم Meta WhatsApp Business API.

## Planned Modules (موديولات مخططة — لم تُبنى بعد)

| Module | الغرض |
|---|---|
| Operations | إدارة العمليات والطلبات والشحن |
| HR | إدارة الموظفين والحضور والمرتبات |
| Inventory | إدارة المخزون والمستودعات |
| Accounting | الحسابات والمصروفات والإيرادات |

---

## Module Relationships (علاقات الموديولات)

```
Auth ──────► كل الموديولات (JWT + RBAC)
              │
Leads ◄──────┤ (العملاء والطلبات هم القلب)
  │          │
  ├── Inbox: تحويل محادثة → lead (convert)
  ├── Marketing: الحملات بتجيب leads، الـ landing pages بتجمع بيانات
  ├── Knowledge Base: بيانات المنتجات بتُستخدم في الطلبات والمبيعات
  ├── WooCommerce: sync منتجات وطلبات (webhooks)
  ├── Bosta: تتبع شحنات الطلبات (webhooks)
  ├── Google Sheets: استيراد leads / تصدير طلبات
  └── Chrome Extension: ربط محادثات WhatsApp بالـ leads

Marketing ──► Meta API: مزامنة حملات وإعلانات (كل ساعتين)
  ├── OpenAI: توليد سكربتات وlanding pages
  └── Landing Pages → Lead form submissions → Leads module

Tickets ──── مستقل (كل تذكرة مرتبطة بموديول عبر حقل module)
Settings ─── مستقل (إعدادات عامة)
```

**قاعدة البيانات المشتركة:** كل الموديولات بتستخدم Prisma client واحد (`db.ts`) على نفس قاعدة PostgreSQL.

---

## Backend Module Structure

كل module تحت `backend/src/modules/` بيتبع: `routes/` → `services/` → Prisma DB.

| Module | API Path | الغرض |
|---|---|---|
| auth | `/api/v1/auth/*` | تسجيل دخول، OAuth (Google/Slack)، reset password، RBAC |
| leads | `/api/v1/leads/*` | CRM: leads, customers, orders, products, dashboard, reports, tasks, shifts |
| marketing | `/api/v1/marketing/*` | حملات، كرييتيفز، أفكار، سكربتات، landing pages، media buying |
| inbox | `/api/v1/inbox/*` | محادثات Messenger/Instagram، تعليقات، قنوات |
| knowledge-base | `/api/v1/knowledge-base/*` | بنك معلومات: منتجات، أسعار، FAQ، موردين |
| settings | `/api/v1/settings/*` | إعدادات المنصة والمستخدمين |
| tickets | `/api/v1/tickets/*` | نظام التذاكر |

### Public Endpoints (بدون auth)

| Endpoint | Rate Limit | الغرض |
|---|---|---|
| `GET/POST /api/webhooks/meta` | 300/min | Meta Messenger/Instagram webhooks |
| `POST /api/webhooks/leads/:token` | 60/min | Form webhook receiver (WordPress Forminator) |
| `POST /api/webhooks/woocommerce` | 60/min | WooCommerce product/order sync |
| `POST /api/webhooks/bosta` | 60/min | Bosta delivery tracking |
| `GET/POST /lp/*` | 5/min (POST only) | Landing pages عامة + form submissions |
| `GET /health` | — | Health check |

### Rate Limiting

| Scope | Limit |
|---|---|
| General (`/api`) | 1000 req / 15 min |
| Auth (`/api/v1/auth`) | 20 req / 15 min |
| Webhooks | 60 req / min |
| Meta webhooks | 300 req / min |
| Landing page submissions | 5 req / min |

### Frontend Module Structure

كل module تحت `frontend/src/modules/` فيه: `pages/`, `components/`, `services/`.

- **Routing**: React Router DOM مع lazy loading عبر `React.lazy()`
- **Data fetching**: TanStack React Query v5 (staleTime: 60s, بدون refetch on focus)
- **HTTP client**: Axios مع interceptors — يضيف JWT bearer تلقائي، auto-logout عند 401
- **Auth state**: React Context، مخزن في localStorage (`dolphin_token`, `dolphin_user`)
- **Styling**: Tailwind CSS
- **Shared UI**: `frontend/src/shared/` — Layout (AppShell, Sidebar, ModuleSwitcher), reusable components

---

## Database

PostgreSQL مع Prisma ORM. Schema واحد في `backend/prisma/schema.prisma` (~1685 سطر).

**نماذج الـ Models الرئيسية:**

| مجموعة | Models | ملاحظات |
|---|---|---|
| Auth | User, Role, Permission, RolePermission, UserPermission, Module, ModuleRole, ModuleAccess | بدون prefix |
| Leads | Lead, Customer, Order, OrderItem, Product, LeadStatus, Communication, ResponseRequest, LeadSource, SheetConnection, FormConnection, CustomFieldConfig | بدون prefix |
| Marketing | MktProject, MktProduct, Creative, Tag, TagCategory, CreativeTag, CreativeCodeConfig, CreativeRequest, CreativePerformance, Idea, IdeaComment, CompetitorReference, Script, ScriptScene, ScriptVersion, SavedFilter | بعضها بـ prefix `Mkt` |
| Landing Pages | LandingPage, LandingPageVersion, FormFieldMapping, ABTest, OrderFormTemplate, OrderFormField | بدون prefix |
| Ads | Brand, SocialPage, ScheduledPost, ScheduledPostPage, AdAccount, Campaign, AdSet, Ad, AdMetric, SyncLog | بدون prefix |
| Knowledge Base | KbProduct, KbMedia, KbSupplier, KbManufacturing, KbPricing, KbVariation, KbMarketing, KbFaq, KbObjection, KbUpsell, KbAfterSales, KbSalesScript | prefix `Kb` |
| Inbox | InboxChannel, InboxConversation, InboxMessage, InboxCommentThread, InboxComment, InboxWebhookLog | prefix `Inbox` |
| Tickets | Ticket, TicketComment | بدون prefix |
| Platform | AuditLog, Notification, Task, TaskRule, Shift, ShiftMember, BlacklistedPhone, IntegrationSetting, WhatsappChatSession | بدون prefix |

---

## Auth & Permissions

- JWT-based (HS256). الـ expiry يتحدد بالـ env vars (default: 7d، production: 15m عبر render.yaml)
- Refresh token: 7d
- RBAC مع صلاحيات granular: `authMiddleware` يتحقق من الـ token، `requirePermission(slug)` و `requireModule(slug)` يحموا الـ routes
- Super admin عنده wildcard `*` permission
- Input validation بـ Zod
- كلمات المرور مشفرة بـ bcryptjs

## Key Integrations

- **Meta/Facebook**: Messenger + Instagram inbox (webhooks real-time)، Ads Manager (sync كل ساعتين)، OAuth لربط الصفحات
- **Google**: OAuth login، Sheets sync (service account — استيراد leads / تصدير طلبات)، Drive (image proxy مع SSRF protection)
- **WooCommerce**: Sync منتجات وطلبات عبر webhooks (HMAC verified)
- **Bosta**: تتبع الشحنات عبر webhooks (API key verified)
- **OpenAI**: توليد سكربتات إعلانية و landing pages بالـ AI
- **Slack**: OAuth workspace linking
- **Cloudflare R2**: تخزين ملفات (S3-compatible API)
- **Shopify**: Integration في مشروع dual-name (iframe embed + postMessage)
- **Google Recaptcha v3**: Bot protection في الـ frontend

---

## Design System

راجع `DESIGN.md` للمواصفات الكاملة. القواعد الأساسية:
- **بدون 1px borders** — استخدم فروقات الألوان/الشفافية بين طبقات الـ surface
- **Surface hierarchy**: `surface` (#f8f9fa) → `surface-container-low` (#f3f4f5) → `surface-container-lowest` (#ffffff)
- **Typography**:
  - Arabic: `Cairo` للنصوص، `Tajawal` للعناوين (bold 700)
  - Latin: `Manrope` للعناوين، `Inter` للنصوص
- **Primary gradient**: (#0040a1) → (#0056d2) عند 135deg للـ CTAs
- **Rounding**: 12px للأزرار، 24px للـ containers الكبيرة
- **ألوان blue-* في Tailwind**: متحولة لـ Teal (اللون الرسمي لدولفين)

## Language

التطبيق يخدم مستخدمين عرب. النصوص ورسائل الخطأ والتعليقات بالعربي. مفيش i18n framework — النصوص hardcoded في الـ components وال route handlers.

## Encryption Rule

كل API keys/tokens المخزنة في قاعدة البيانات لازم تتشفر باستخدام `backend/src/shared/utils/token-encryption.ts` (AES-256-GCM) قبل الحفظ. ما تعرضش API keys كاملة للـ frontend أبداً.

---

## Environment Variables

### Backend (مطلوبة)

```
# Server
PORT                        # default: 4000
NODE_ENV                    # development / production
ALLOWED_ORIGINS             # Comma-separated CORS origins

# Database
DATABASE_URL                # PostgreSQL connection string
REDIS_URL                   # default: redis://localhost:6379

# Security
JWT_SECRET                  # مطلوب في production
JWT_EXPIRES_IN              # default: 7d
JWT_REFRESH_EXPIRES_IN      # default: 7d
TOKEN_ENCRYPTION_KEY        # مطلوب في production (openssl rand -hex 32)

# Google
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_DRIVE_REFRESH_TOKEN
GOOGLE_DRIVE_UPLOADS_FOLDER_ID
GOOGLE_SERVICE_ACCOUNT_KEY  # JSON key لـ Sheets sync

# Meta/Facebook
META_APP_ID
META_APP_SECRET
META_REDIRECT_URI
META_INBOX_REDIRECT_URI
META_WEBHOOK_VERIFY_TOKEN

# WooCommerce
WOOCOMMERCE_BASE_URL
WOOCOMMERCE_CONSUMER_KEY
WOOCOMMERCE_CONSUMER_SECRET
WOOCOMMERCE_WEBHOOK_SECRET

# Bosta
BOSTA_API_KEY
BOSTA_BASE_URL              # default: https://app.bosta.co/api/v2
BOSTA_WEBHOOK_SECRET

# Slack
SLACK_CLIENT_ID
SLACK_CLIENT_SECRET
SLACK_REDIRECT_URI

# Cloudflare R2
CF_ACCOUNT_ID
CLOUDFLARE_R2_ACCESS_KEY
CLOUDFLARE_R2_SECRET_KEY
CLOUDFLARE_R2_BUCKET
R2_PUBLIC_URL

# SMTP (Email)
SMTP_HOST                   # default: smtp.gmail.com
SMTP_PORT                   # default: 587
SMTP_USER
SMTP_PASS
SMTP_FROM

# Misc
APP_URL                     # fallback: RENDER_EXTERNAL_URL or localhost:4000
UPLOAD_DIR                  # default: ./uploads
MAX_FILE_SIZE_MB            # default: 5
RECAPTCHA_SECRET_KEY
OPENAI_API_KEY
LEADS_API_KEY               # اختياري
SENTRY_DSN                  # اختياري
LOG_LEVEL                   # default: info
```

### Frontend

```
VITE_API_BASE_URL           # اختياري — fallback: window.location.origin
```

---

## Local Development Setup

```bash
# 1. Prerequisites
# Node.js >= 18, pnpm >= 8, Docker

# 2. شغّل قواعد البيانات
docker compose up -d         # PostgreSQL 16 (port 5432) + Redis 7 (port 6379)

# 3. إعداد الـ environment
cp backend/.env.example backend/.env
# عدّل backend/.env بالقيم المطلوبة (على الأقل DATABASE_URL و JWT_SECRET)

# 4. إعداد قاعدة البيانات
pnpm install
pnpm db:generate             # Generate Prisma client
pnpm db:push                 # Push schema to DB
pnpm db:seed                 # Seed roles, permissions, modules

# 5. شغّل المشروع
pnpm dev                     # Backend (port 4000) + Frontend (port 3000) معاً
# أو منفصلين:
pnpm dev:backend             # Backend بس (tsx watch)
pnpm dev:frontend            # Frontend بس (Vite, proxies /api → localhost:4000)
```

## Commands

```bash
# Development
pnpm dev                     # تشغيل كل الحزم بالتوازي
pnpm dev:backend             # Backend بس (tsx watch, port 4000)
pnpm dev:frontend            # Frontend بس (Vite, port 3000)

# Database (PostgreSQL via Prisma)
pnpm db:generate             # Generate Prisma client
pnpm db:migrate              # Create migration (prisma migrate dev)
pnpm db:push                 # Push schema to DB (dev, بدون migration file)
pnpm db:seed                 # Seed roles, permissions, modules
pnpm db:studio               # Prisma Studio GUI

# Build
pnpm build                   # Build كل الحزم
pnpm build:backend           # Backend (generates Prisma, pushes schema, seeds, compiles TS)
pnpm build:frontend          # Frontend (tsc + vite build)
pnpm build:dual-name         # Dual-name project

# Test
pnpm test                    # Run all tests (vitest)
cd backend && npx vitest run # Backend tests بس
cd backend && npx vitest     # Watch mode

# Production
pnpm start                   # node backend/dist/index.js

# Tickets
pnpm tickets                 # Sync tickets من النظام الخارجي

# Infrastructure
docker compose up -d         # Start PostgreSQL 16 + Redis 7
```

---

## Module Boundaries (Parallel Development Rules)

كل module (`backend/src/modules/*`, `frontend/src/modules/*`) قابل للتعديل بشكل مستقل. ممكن عدة agents/worktrees يشتغلوا على modules مختلفة بالتوازي.

### Import Rules
- Module يقدر يستورد من: **نفسه**، `shared/`، `db.ts`، و npm packages بس
- **ما تستوردش أبداً** من `../../<other-module>/` — ده بيعمل coupling
- لو محتاج data من module تاني، استخدم `prisma` مباشرة (للقراءة) أو call الـ API endpoint
- لما تستخدم prisma لقراءة cross-module، دايماً أعد فلاتر الأمان (`isActive`, etc.)
- `useAuth()` هو الـ cross-module import الوحيد المسموح في الـ frontend

### Shared Files (Conflict Zones)
الملفات دي بتتأثر من كل الموديولات — نسّق عند التعديل:
- `backend/prisma/schema.prisma` — أضف models جديدة في **آخر** الملف
- `backend/src/index.ts` — عدّل بس لربط routes module جديد
- `frontend/src/App.tsx` — عدّل بس لإضافة lazy route لـ module جديد

### Tickets
- كل تذكرة فيها حقل `module` (leads, marketing, inbox, knowledge-base, settings, general)
- بتتحدد تلقائي من URL الصفحة اللي المستخدم عملها منها
- فلترة بالموديول: `GET /api/v1/tickets?module=leads`
- Agent scripts: `npx tsx agent/ticket-reader.ts --module leads`

### Adding a New Feature
- Feature جوا module موجود → آمن للعمل بالتوازي
- Module جديد → أضف schema models + route mount + App.tsx route، اعمل merge الأول، بعدين كمّل بالتوازي
- Cross-module data → prisma queries (مع فلاتر أمان) أو API calls، مش direct imports
