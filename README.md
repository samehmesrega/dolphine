# دولفين (Dolphin)

نظام إدارة الليدز والمبيعات — تطبيق ويب منفصل لاستيراد الليدز، إدارة التواصل، وتحويلها لعملاء وطلبات مع رفع الطلبات على ووكومرس.

## المتطلبات

- Node.js 18+
- PostgreSQL (أو استخدام Docker)
- Redis (اختياري للـ Queue لاحقاً)

## التشغيل المحلي

### 1. تشغيل قاعدة البيانات

**خيار أ — Docker:**
```bash
cd dolphin
docker compose up -d
```

**خيار ب — بدون Docker:** استخدم PostgreSQL محلي أو سحابي (مثل [Neon](https://neon.tech)). عدّل `DATABASE_URL` في `backend/.env`.

### 2. إعداد Backend

```bash
cd backend
npm install
cp .env.example .env
# عدّل .env واضبط DATABASE_URL و JWT_SECRET
```

### 3. إنشاء قاعدة البيانات والبيانات الأولية

```bash
cd backend
npx prisma db push
npm run db:seed
```

### 4. تشغيل API

```bash
npm run dev
```

الـ API يعمل على: http://localhost:3001

### بيانات الدخول الافتراضية

- البريد: `admin@dolphin.local`
- كلمة المرور: `admin123`

### 5. إعداد Frontend (قريباً)

```bash
cd frontend
npm install
npm run dev
```

## هيكل المشروع

```
dolphin/
├── backend/       # Express + Prisma API
├── frontend/      # React + TypeScript (قيد البناء)
├── wordpress-plugin/  # بلجن استقبال الليدز (قيد البناء)
└── docker-compose.yml
```

## ملاحظة

دولفين مشروع منفصل تماماً عن أي مشروع آخر (مثل Notes App).
