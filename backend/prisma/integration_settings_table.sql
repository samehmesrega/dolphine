-- جدول إعدادات التكامل (ووكومرس من صفحة الربط)
-- شغّل هذا الملف إذا لم تستخدم prisma migrate

CREATE TABLE IF NOT EXISTS "integration_settings" (
    "id"    TEXT NOT NULL PRIMARY KEY,
    "key"   TEXT NOT NULL UNIQUE,
    "value" TEXT NOT NULL
);
