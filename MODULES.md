# MODULES.md

توثيق تفصيلي لكل موديول في Dolphin Platform — مبني على الكود الفعلي.

---

## Built Modules (موديولات مبنية)

---

### Leads

**الهدف:** إدارة العملاء المحتملين (CRM) — من أول ما الـ lead يدخل لحد ما الطلب يتشحن ويتسلم.

**الحالة:** مكتمل (الموديول الأكبر والأكثر نضجاً)

**الـ Features الموجودة فعلاً:**
- إنشاء وتعديل وحذف الـ leads مع بحث وفلترة (بالحالة، المسؤول، التاريخ، الترتيب)
- حذف جماعي (bulk delete) للـ leads والعملاء والطلبات
- نظام حالات الـ leads (Lead Statuses) — CRUD كامل مع ألوان وترتيب
- تسجيل التواصل (Communication) — أنواع: whatsapp, call, physical, email
- طلبات الرد (Response Requests) بين الموظفين
- اهتمامات المنتج (Product Interests) لكل lead
- إنشاء العملاء تلقائي عند إنشاء الطلب
- إدارة الطلبات (Orders) — CRUD كامل مع عناصر الطلب (OrderItems)
- رفع صورة التحويل البنكي + تحقق OCR (Google Vision API) + كشف احتيال (trust score, image hash, blacklist)
- تأكيد الطلبات من قسم الحسابات (accounts confirmation workflow)
- رفض الطلبات مع سبب
- إحصائيات الاحتيال (fraud stats dashboard)
- إنشاء شحنة Bosta + تتبع + إلغاء
- إنشاء طلب WooCommerce + مزامنة
- إدارة المنتجات (إخفاء/استعادة من WooCommerce)
- إدارة العملاء (Customers) مع بحث بالرقم/الاسم
- Dashboard — إجمالي leads، طلبات، طلبات معلقة، leads بمرور الوقت، طلبات حسب الحالة
- تقارير — أداء الموظفين (agents)، الورديات (shifts)، المصادر (UTM)، تقارير عامة
- Hall of Fame — أفضل الموظفين
- نظام المهام (Tasks) — إنشاء يدوي + إنشاء تلقائي من القواعد
- قواعد المهام (Task Rules) — تنفيذ تلقائي حسب حالة الـ lead ومدة الانتظار
- الورديات (Shifts) — جدولة موظفين مع توزيع round-robin تلقائي (timezone-aware, Africa/Cairo)
- القائمة السوداء (Blacklist) — حظر أرقام هواتف
- سجل المراجعة (Audit Log) — تتبع كل تغيير
- الإشعارات — إنشاء + قراءة + عداد غير مقروء
- Google Sheets — استيراد leads + تصدير بيانات + مزامنة تواصل + backfill
- Form Connections — استقبال leads من WordPress Forminator عبر webhooks
- WooCommerce — مزامنة منتجات وطلبات (اتجاهين)
- Bosta — إعدادات + إنشاء شحنات + webhook لتحديث الحالة
- WhatsApp Monitor — ربط محادثات WhatsApp بالـ leads (عبر Chrome Extension)
- إعدادات التكاملات (Integration Settings) — key/value store
- إدارة المستخدمين والأدوار والصلاحيات
- Dual Name — صفحة عرض + إعدادات (ألوان + watermark)

**الـ Features الناقصة:**
- قواعد المهام (Task Rules) الـ scheduler اللي بينفذهم تلقائي مش موجود — الفحص بيتم فقط عند فتح صفحة المهام
- تصدير CSV غير موجود في الـ backend (موجود في الـ frontend بس كـ client-side)
- الـ round-robin بدون distributed lock (اتصلح بـ SELECT FOR UPDATE بس محتاج اختبار)

**الـ Database Tables/Models:**
Lead, Customer, LeadStatus, Communication, ResponseRequest, ProductInterest, Order, OrderItem, Product, Shift, ShiftMember, Task, TaskRule, SheetConnection, FormConnection, BlacklistedPhone, IntegrationSetting, AuditLog, Notification, LeadSource, CustomFieldConfig, WhatsappChatSession

**الـ API Endpoints:**

| Method | Path | الوصف |
|--------|------|-------|
| GET | /leads | قائمة الـ leads مع فلترة |
| POST | /leads | إنشاء lead |
| GET | /leads/:id | تفاصيل lead |
| PATCH | /leads/:id | تعديل lead |
| DELETE | /leads/:id | حذف lead |
| POST | /leads/bulk-delete | حذف جماعي |
| POST | /leads/:id/communications | إضافة تواصل |
| PATCH | /leads/:id/communications/:commId | تعديل ملاحظات التواصل |
| GET | /leads/:id/product-interests | اهتمامات المنتج |
| POST | /leads/:id/product-interests | إضافة اهتمام |
| DELETE | /leads/:id/product-interests/:interestId | حذف اهتمام |
| POST | /leads/:id/response-requests | طلب رد |
| DELETE | /leads/:id/response-requests/:requestId | حذف طلب رد |
| POST | /leads/:id/response-requests/:requestId/reply | الرد على طلب |
| GET | /lead-statuses | قائمة الحالات |
| POST | /lead-statuses | إنشاء/تحديث حالة |
| PATCH | /lead-statuses/:id | تعديل حالة |
| DELETE | /lead-statuses/:id | حذف حالة |
| GET | /customers | قائمة العملاء |
| POST | /customers/bulk-delete | حذف جماعي |
| DELETE | /customers/:id | حذف عميل |
| GET | /orders | قائمة الطلبات |
| POST | /orders | إنشاء طلب |
| GET | /orders/:id | تفاصيل طلب |
| PATCH | /orders/:id | تعديل طلب |
| DELETE | /orders/:id | حذف طلب |
| POST | /orders/bulk-delete | حذف جماعي |
| POST | /orders/:id/upload-transfer | رفع صورة تحويل |
| PATCH | /orders/:id/verify-transfer | تحقق OCR |
| POST | /orders/:id/create-bosta-delivery | إنشاء شحنة Bosta |
| PATCH | /orders/:id/cancel-bosta | إلغاء شحنة |
| POST | /orders/:id/mark-accounts-confirmed | تأكيد حسابات |
| POST | /orders/:id/mark-rejected | رفض طلب |
| POST | /orders/:id/create-woo-order | إنشاء طلب WooCommerce |
| POST | /orders/:id/sync-woo-order | مزامنة طلب |
| GET | /orders/fraud-stats | إحصائيات احتيال |
| GET | /products | قائمة المنتجات |
| POST | /products/:id/hide | إخفاء منتج |
| POST | /products/:id/restore | استعادة منتج |
| GET | /dashboard/stats | إحصائيات عامة |
| GET | /dashboard/leads-over-time | leads بمرور الوقت |
| GET | /dashboard/orders-by-status | طلبات حسب الحالة |
| GET | /reports/agents | تقرير أداء الموظفين |
| GET | /reports/shifts | تقرير الورديات |
| GET | /reports/sources | تقرير المصادر |
| GET | /reports/general | تقرير عام |
| GET | /shifts | قائمة الورديات |
| GET | /shifts/:id | تفاصيل وردية |
| POST | /shifts | إنشاء وردية |
| PATCH | /shifts/:id | تعديل وردية |
| GET | /tasks | قائمة المهام |
| POST | /tasks | إنشاء مهمة |
| PATCH | /tasks/:id | تعديل مهمة |
| DELETE | /tasks/:id | حذف مهمة |
| GET | /task-rules | قائمة القواعد |
| POST | /task-rules | إنشاء قاعدة |
| PATCH | /task-rules/:id | تعديل قاعدة |
| DELETE | /task-rules/:id | حذف قاعدة |
| GET | /notifications | قائمة الإشعارات |
| GET | /notifications/unread-count | عداد غير مقروء |
| PATCH | /notifications/:id/read | قراءة إشعار |
| POST | /notifications/read-all | قراءة الكل |
| GET | /audit-logs | سجل المراجعة |
| GET | /blacklist | القائمة السوداء |
| POST | /blacklist | إضافة رقم |
| DELETE | /blacklist/:id | حذف رقم |
| GET | /sheet-connections | Google Sheets connections |
| POST | /sheet-connections | إنشاء connection |
| PATCH | /sheet-connections/:id | تعديل |
| POST | /sheet-connections/:id/import-leads | استيراد leads |
| POST | /sheet-connections/:id/backfill | تصدير للشيت |
| GET | /sheet-connections/google-config | حالة إعداد Google |
| POST | /sheet-connections/google-config | حفظ Google API key |
| GET | /form-connections | Form connections |
| POST | /form-connections | إنشاء |
| PATCH | /form-connections/:id | تعديل |
| PATCH | /form-connections/:id/mapping | تعديل field mapping |
| GET | /woocommerce/status | حالة WooCommerce |
| GET | /woocommerce/config | إعدادات WooCommerce |
| POST | /woocommerce/config | حفظ إعدادات |
| POST | /woocommerce/sync-products | مزامنة منتجات |
| POST | /woocommerce/sync-orders | مزامنة طلبات |
| GET | /bosta/status | حالة Bosta |
| GET | /bosta/config | إعدادات Bosta |
| POST | /bosta/config | حفظ إعدادات |
| GET | /users | قائمة المستخدمين |
| POST | /users | إنشاء مستخدم |
| GET | /users/me | الملف الشخصي |
| PATCH | /users/me | تعديل الملف |
| GET | /users/:id | تفاصيل مستخدم |
| PATCH | /users/:id | تعديل مستخدم |
| GET | /users/roles | الأدوار |
| GET | /users/permissions | الصلاحيات |
| PUT | /users/roles/:id/permissions | تعديل صلاحيات دور |
| GET | /integrations/setting/:key | قراءة إعداد |
| PUT | /integrations/setting/:key | حفظ إعداد |
| GET | /whatsapp-monitor/check-lead | مطابقة رقم بـ lead |
| POST | /whatsapp-monitor/sessions | حفظ جلسة WhatsApp |

**Webhooks (عامة — بدون auth):**

| Method | Path | الوصف |
|--------|------|-------|
| POST | /api/webhooks/leads/:token | استقبال leads من WordPress forms |
| POST | /api/webhooks/woocommerce | webhook لتحديث طلبات/منتجات WooCommerce |
| POST | /api/webhooks/bosta | webhook لتحديث حالة شحنات Bosta |

**علاقته بالموديولات التانية:**
- **Marketing:** الـ leads فيهم حقول UTM (utmSource, utmCampaign, creativeCode, landingPageId) بتربطهم بالحملات
- **Inbox:** المحادثات بتترقط بـ leads/customers عبر `convert/to-lead`
- **Knowledge Base:** المنتجات (Product) مشتركة بين الموديولين
- **Auth:** كل الـ endpoints محمية بـ authMiddleware + requirePermission
- **Tickets:** التذاكر بتتصنف حسب الموديول (module: "leads")

---

### Marketing

**الهدف:** إدارة المحتوى التسويقي والحملات الإعلانية — من الفكرة للسكربت للكرييتيف للنشر للقياس.

**الحالة:** مكتمل

**الـ Features الموجودة فعلاً:**
- المشاريع (Projects) — Print In, Picked In, Choroida + منتجات لكل مشروع
- مكتبة الكرييتيفز (Creative Library) — CRUD مع أكواد تلقائية (auto-generated codes)، فلترة بالمشروع/المنتج/الحالة/النوع/التاجز
- أنواع الكرييتيف: REEL, VIDEO, STORY, IMAGE, SESSION
- نظام التاجز (Tags) مع تصنيفات (TagCategories)
- إعدادات أكواد الكرييتيفز (CreativeCodeConfig) — segments + separator + sequence digits
- فلاتر محفوظة (SavedFilters) لكل مستخدم
- طلبات كرييتيف (Creative Requests) — workflow: NEW → IN_PRODUCTION → DONE/CANCELLED
- بنك الأفكار (Ideas Bank) — workflow: NEW → APPROVED → IN_PRODUCTION → DONE/REJECTED + تعليقات
- مكتبة المنافسين (Competitor Library) — URLs + screenshots + ملاحظات + تاجز
- السكربتات (Scripts) — إنشاء يدوي + توليد بالـ AI (OpenAI) — مع مشاهد (scenes) + versions
- Content Calendar — جدولة نشر على منصات التواصل
- النشر (Publishing) — Posts مجدولة مع ربط بصفحات اجتماعية
- البراندز (Brands) مع صفحات اجتماعية (SocialPages) — Facebook, Instagram, TikTok
- حسابات الإعلانات (Ad Accounts) — Meta, Google, TikTok, Snapchat
- Media Buying — عرض حملات + Ad Sets + Ads مع metrics
- مزامنة Meta Ads (API v21.0) — OAuth + sync تلقائي كل ساعتين + sync يدوي
- metrics تفصيلية: impressions, reach, clicks, spend, conversions, leads, purchases, revenue, CTR, CPL, CPA, ROAS
- Breakdown — تحليل leads حسب sales/shift/status لكل campaign/adset/ad
- Landing Pages — إنشاء يدوي + توليد بالـ AI (Anthropic/OpenAI/Google) + تعديل بالـ AI
- Landing Pages — نشر/إلغاء نشر + version history + rollback
- A/B Testing — تقسيم traffic بين صفحتين + تحديد الفائز
- Form Field Mapping — ربط حقول الـ form بحقول الـ Lead
- Order Form Templates — قوالب نماذج الطلب مع حقول مخصصة
- إعدادات AI Providers — إضافة مفاتيح Anthropic/OpenAI/Google مع تشفير
- Dashboard تسويقي — إحصائيات شاملة + leads حسب المصدر + ROI لكل كرييتيف
- Meta OAuth — ربط حسابات Meta + استخراج Ad Accounts

**الـ Features الناقصة:**
- النشر الفعلي (actual publishing) على المنصات — الـ UI والـ models موجودين بس **مفيش background job ينشر الـ posts المجدولة تلقائي**
- Google Ads, TikTok Ads, Snapchat Ads — الـ models والـ API structure موجودين بس التكامل الفعلي **مبني لـ Meta بس**
- Creative Performance — الـ model موجود بس **مفيش آلية تربط أداء الكرييتيف بالـ ad metrics تلقائي**
- الـ sync schedule — الـ UI موجود بس الـ backend بيستخدم `setInterval` بدل job queue

**الـ Database Tables/Models:**
MktProject, MktProduct, Creative, CreativeTag, Tag, TagCategory, CreativeCodeConfig, SavedFilter, CreativeRequest, CreativePerformance, Idea, IdeaComment, CompetitorReference, Script, ScriptScene, ScriptVersion, Brand, SocialPage, ScheduledPost, ScheduledPostPage, AdAccount, Campaign, AdSet, Ad, AdMetric, SyncLog, LandingPage, LandingPageVersion, FormFieldMapping, ABTest, AiProvider, OrderFormTemplate, OrderFormField

**الـ API Endpoints:**

| Method | Path | الوصف |
|--------|------|-------|
| GET/POST | /projects | مشاريع |
| PUT | /projects/:id | تعديل مشروع |
| GET/POST | /projects/:id/products | منتجات المشروع |
| GET/POST | /creatives | مكتبة الكرييتيفز |
| GET/PUT/DELETE | /creatives/:id | CRUD كرييتيف |
| PUT | /creatives/:id/tags | تعديل تاجز |
| GET/POST | /requests | طلبات كرييتيف |
| GET | /requests/:id | تفاصيل طلب |
| PUT | /requests/:id/status | تعديل حالة |
| PUT | /requests/:id/assign | تعيين مسؤول |
| GET/POST | /ideas | بنك الأفكار |
| GET | /ideas/:id | تفاصيل فكرة |
| PUT | /ideas/:id/status | تعديل حالة |
| POST | /ideas/:id/comments | إضافة تعليق |
| GET/POST | /tags | تاجز |
| DELETE | /tags/:id | حذف تاج |
| GET/POST | /tags/categories | تصنيفات |
| GET/POST | /competitors | مكتبة المنافسين |
| PUT/DELETE | /competitors/:id | CRUD منافس |
| GET/POST | /scripts | سكربتات |
| POST | /scripts/generate | توليد AI |
| GET/PUT | /scripts/:id | CRUD سكربت |
| PUT | /scripts/:id/status | تعديل حالة |
| PUT | /scripts/:id/assign | تعيين مسؤول |
| PUT | /scripts/:id/scenes/:sceneId | تعديل مشهد |
| GET/POST | /scripts/:id/versions | version history |
| GET | /calendar | تقويم المحتوى |
| GET/POST | /posts | posts مجدولة |
| GET/PUT/DELETE | /posts/:id | CRUD post |
| PUT | /posts/:id/status | تعديل حالة |
| GET/POST/DELETE | /social-pages | صفحات اجتماعية |
| POST | /social-pages/connect | ربط صفحة |
| GET/POST | /brands | البراندز |
| GET | /media-buying/overview | dashboard الإعلانات |
| GET | /media-buying/by-platform | تحليل حسب المنصة |
| GET | /media-buying/by-brand | تحليل حسب البراند |
| GET | /media-buying/campaigns | قائمة الحملات |
| GET | /media-buying/campaigns/:id | تفاصيل حملة |
| GET | /media-buying/adsets | Ad Sets |
| GET | /media-buying/ads | Ads |
| POST | /media-buying/sync | مزامنة سريعة |
| POST | /media-buying/resync | إعادة مزامنة كاملة |
| GET/PUT | /media-buying/sync-schedule | جدول المزامنة |
| GET | /media-buying/breakdown | تحليل leads |
| GET | /media-buying/ad-accounts | حسابات إعلانية |
| POST | /media-buying/ad-accounts/connect | ربط حساب |
| DELETE | /media-buying/ad-accounts/:id | فصل حساب |
| GET | /media-buying/meta-available-accounts | حسابات Meta المتاحة |
| POST | /media-buying/meta-connect-existing | ربط حساب Meta موجود |
| GET | /oauth/meta | OAuth URL |
| POST | /oauth/meta/callback | OAuth callback |
| POST | /oauth/meta/connect | ربط حساب |
| POST | /oauth/meta/sync/:adAccountId | مزامنة حساب |
| GET/POST | /landing-pages | Landing pages |
| GET/PUT/DELETE | /landing-pages/:id | CRUD landing page |
| POST | /landing-pages/generate | توليد AI |
| POST | /landing-pages/:id/edit | تعديل AI |
| POST | /landing-pages/:id/publish | نشر |
| POST | /landing-pages/:id/unpublish | إلغاء نشر |
| GET | /landing-pages/:id/versions | versions |
| POST | /landing-pages/:id/rollback/:versionId | rollback |
| GET/PUT | /landing-pages/:id/field-mappings | field mappings |
| GET/POST | /landing-pages/ab-tests/list | A/B tests |
| POST | /landing-pages/:id/ab-test | إنشاء A/B test |
| PUT | /landing-pages/ab-tests/:testId/end | إنهاء test |
| GET/POST | /order-forms | قوالب نماذج الطلب |
| GET/PUT/DELETE | /order-forms/:id | CRUD template |
| GET/POST | /ai-providers | مقدمي AI |
| GET | /ai-providers/models | موديلات متاحة |
| DELETE | /ai-providers/:id | حذف provider |
| GET/PUT | /settings/creative-code | إعدادات أكواد الكرييتيف |
| GET/POST/DELETE | /settings/saved-filters | فلاتر محفوظة |
| GET | /dashboard/stats | إحصائيات |
| GET | /dashboard/leads-by-source | leads حسب المصدر |
| GET | /dashboard/creative-roi/:code | ROI لكرييتيف |

**Landing Pages (عامة — بدون auth):**

| Method | Path | الوصف |
|--------|------|-------|
| GET | /lp/:slug | عرض landing page |
| POST | /lp/:slug/submit | إرسال form (ينشئ lead) |

**علاقته بالموديولات التانية:**
- **Leads:** الـ leads بتيجي من الحملات (UTM tracking)، الـ landing pages بتجمع بيانات وتنشئ leads
- **Knowledge Base:** الـ landing page generator بيقدر يسحب بيانات المنتج من KB
- **Inbox:** الـ SocialPages مشتركة — نفس الصفحة ممكن تكون في Marketing (نشر) و Inbox (رسائل)
- **Auth:** كل الـ endpoints محمية

---

### Inbox

**الهدف:** صندوق وارد موحد لرسائل Messenger و Instagram DM وتعليقات Facebook/Instagram — مع ربط بالـ leads.

**الحالة:** في التطوير

**الـ Features الموجودة فعلاً:**
- ربط القنوات عبر Meta OAuth — لكل صفحة يتم إنشاء 4 قنوات (messenger, instagram_dm, facebook_comments, instagram_comments)
- قائمة المحادثات مع فلترة (brandId, channelId, status, assignedTo)
- عرض رسائل المحادثة (cursor-based pagination)
- إرسال رسائل عبر Messenger و Instagram DM (عبر Meta Graph API)
- تعيين محادثة لموظف
- تغيير حالة المحادثة (open/closed/snoozed)
- ربط محادثة بـ lead أو customer
- قراءة المحادثة (reset unread count)
- قائمة comment threads مع فلترة
- الرد على تعليقات (publicly عبر Meta API)
- الرد الخاص (private reply — إرسال DM للمعلق)
- إخفاء/إظهار تعليقات (عبر Meta API)
- تحويل محادثة إلى lead (مع إنشاء customer تلقائي)
- مزامنة المحادثات والرسائل من Meta
- مزامنة التعليقات من Meta
- Webhook receiver لاستقبال رسائل/تعليقات real-time (HMAC-SHA256 verified)
- Webhook data deletion callback (GDPR)
- إحصائيات — overview + أداء الفريق + أداء موظف فردي (conversations handled, messages sent, avg response time, leads converted)
- حساب وقت الرد الأول (firstResponseTimeMs)
- تسجيل webhook logs

**الـ Features الناقصة:**
- `TODO: Download attachment and upload to R2 — for now store Meta URLs` (conversation-sync.service.ts:89) — المرفقات بتتخزن كـ Meta URLs بدل ما تترفع على R2
- `TODO: Implement full processing in Phase 5/6` (webhooks.ts:127) — معالجة بعض أنواع الـ webhook events مش مكتملة
- `TODO: Update message delivery status` (webhooks.ts:144) — تحديث حالة التسليم (delivered)
- `TODO: Update message read status` (webhooks.ts:148) — تحديث حالة القراءة (read)
- مفيش real-time updates (WebSocket/SSE) — الـ frontend بيعمل polling
- مفيش search في الرسائل

**الـ Database Tables/Models:**
InboxChannel, InboxConversation, InboxMessage, InboxCommentThread, InboxComment, InboxWebhookLog

**الـ API Endpoints:**

| Method | Path | الوصف |
|--------|------|-------|
| GET | /channels | قائمة القنوات |
| GET | /channels/oauth/meta | OAuth URL |
| POST | /channels/oauth/meta/callback | OAuth callback |
| POST | /channels/oauth/meta/connect | ربط صفحات |
| POST | /channels/:id/sync | مزامنة يدوية |
| DELETE | /channels/:id | إلغاء تفعيل قناة |
| GET | /conversations | قائمة المحادثات |
| GET | /conversations/:id | تفاصيل محادثة |
| GET | /conversations/:id/messages | رسائل المحادثة |
| POST | /conversations/:id/messages | إرسال رسالة |
| PUT | /conversations/:id/assign | تعيين موظف |
| PUT | /conversations/:id/status | تغيير حالة |
| PUT | /conversations/:id/link | ربط بـ lead/customer |
| PUT | /conversations/:id/read | قراءة |
| GET | /comments/threads | قائمة threads |
| GET | /comments/threads/:id | تفاصيل thread |
| PUT | /comments/threads/:id/status | تغيير حالة |
| POST | /comments/:commentId/reply | رد عام |
| POST | /comments/:commentId/private-reply | رد خاص |
| POST | /comments/:commentId/hide | إخفاء تعليق |
| POST | /convert/to-lead | تحويل لـ lead |
| POST | /convert/to-order | تحويل لطلب |
| GET | /stats/overview | إحصائيات عامة |
| GET | /stats/team | أداء الفريق |
| GET | /stats/agent/:userId | أداء موظف |

**Webhooks (عامة):**

| Method | Path | الوصف |
|--------|------|-------|
| GET | /api/webhooks/meta | Meta webhook verification |
| POST | /api/webhooks/meta | استقبال أحداث Meta |
| POST | /api/webhooks/meta/data-deletion | GDPR data deletion |

**علاقته بالموديولات التانية:**
- **Leads:** تحويل محادثة → lead (مع إنشاء customer)، ربط محادثات بـ leads موجودين
- **Marketing:** SocialPages مشتركة — نفس صفحة Facebook/Instagram ممكن تكون في الاتنين
- **Auth:** كل الـ endpoints محمية

---

### Knowledge Base (بنك المعلومات)

**الهدف:** كتالوج منتجات شامل يحتوي على كل المعلومات اللي فريق المبيعات والتسويق محتاجها عن كل منتج.

**الحالة:** في التطوير

**الـ Features الموجودة فعلاً:**
- إنشاء وتعديل وحذف المنتجات (soft delete)
- بحث في المنتجات (بالاسم/الوصف/الـ SKU)
- فلترة بالتصنيف والمشروع
- 12 sub-resource لكل منتج:
  - Media — صور وفيديوهات (upload + Google Drive sync + ترتيب)
  - Suppliers — موردين (اسم، معلومات اتصال، تقييم 1-5)
  - Manufacturing — تصنيع (مواد، خطوات إنتاج، نسبة هدر، تكلفة وحدة، تغليف)
  - Pricing — أسعار متعددة (حسب النوع: RETAIL/WHOLESALE/OFFER وحسب العملة)
  - Variations — متغيرات (لون، حجم، SKU)
  - Marketing — تسويق (USPs, target audience, competitor comparison, brand voice, keywords)
  - FAQs — أسئلة شائعة
  - Objections — اعتراضات المبيعات مع الردود
  - Upsells — بيع إضافي/متقاطع (cross-sell)
  - After Sales — ما بعد البيع (سياسة إرجاع، تعليمات استخدام، ضمان)
  - Sales Scripts — سكربتات مبيعات
- استيراد من JSON (مع template قابل للتحميل)
- استيراد من WooCommerce (عرض منتجات WooCommerce + استيراد)
- ربط بالمشاريع التسويقية (MktProject)

**الـ Features الناقصة:**
- مفيش search داخل الـ sub-resources (بس في المنتجات نفسها)
- مفيش تصدير (export) للبيانات
- مفيش AI-powered content generation للـ FAQs أو Sales Scripts
- مفيش تقارير أو analytics عن استخدام بنك المعلومات

**الـ Database Tables/Models:**
KbProduct, KbMedia, KbSupplier, KbManufacturing, KbPricing, KbVariation, KbMarketing, KbFaq, KbObjection, KbUpsell, KbAfterSales, KbSalesScript

**الـ API Endpoints:**

| Method | Path | الوصف |
|--------|------|-------|
| GET | /products | قائمة المنتجات |
| GET | /products/search | بحث |
| POST | /products | إنشاء منتج |
| GET | /products/:id | تفاصيل منتج |
| PUT | /products/:id | تعديل منتج |
| DELETE | /products/:id | حذف منتج |
| GET | /products/import/template | تحميل template |
| POST | /products/import | استيراد JSON |
| GET | /products/woo-products | منتجات WooCommerce |
| POST | /products/import-woo/:wooProductId | استيراد من WooCommerce |
| GET/POST/PUT/DELETE | /products/:id/media | وسائط |
| POST | /products/:id/media/sync-drive | مزامنة Drive |
| GET/POST/PUT/DELETE | /products/:id/suppliers | موردين |
| GET/PUT/DELETE | /products/:id/manufacturing | تصنيع |
| GET/POST/PUT/DELETE | /products/:id/pricing | أسعار |
| GET/POST/PUT/DELETE | /products/:id/variations | متغيرات |
| GET/PUT/DELETE | /products/:id/marketing | تسويق |
| GET/POST/PUT/DELETE | /products/:id/faqs | أسئلة شائعة |
| GET/POST/PUT/DELETE | /products/:id/objections | اعتراضات |
| GET/POST/DELETE | /products/:id/upsells | بيع إضافي |
| GET/PUT/DELETE | /products/:id/after-sales | ما بعد البيع |
| GET/POST/PUT/DELETE | /products/:id/sales-scripts | سكربتات مبيعات |

**علاقته بالموديولات التانية:**
- **Leads:** المنتجات (Product من leads) مرتبطة بـ KbProduct عبر wooProductId
- **Marketing:** Landing page generator يسحب بيانات من KB عبر kbProductId. المشاريع (MktProject) مرتبطة بمنتجات KB
- **WooCommerce:** استيراد منتجات ومتغيرات من WooCommerce

---

### Dual-Name 3D

**الهدف:** مولّد أسماء ثلاثية الأبعاد (Ambigram) — يقرأ كلمة من زاوية 45° وكلمة تانية من 135°، مع تصدير STL للطباعة ثلاثية الأبعاد.

**الحالة:** مكتمل (مشروع مستقل + مدمج في الـ frontend)

**الـ Features الموجودة فعلاً:**
- محرك 3D كامل — JSCAD CSG intersection + Three.js rendering
- تحويل خطوط TrueType → أشكال هندسية (مع hole detection)
- دعم Arabic shaping و RTL
- 20 نموذج قلب (heart variants) مع Bezier curves
- خط واحد للأحرف (OverpassMono-Bold) + خط عربي للنقش (IBM Plex Arabic Bold)
- نقش نص على القاعدة (inscription) — عربي/إنجليزي
- نقش رقم الطلب على أسفل القاعدة
- قاعدة بزوايا مدورة (rounded corners)
- تصدير STL (binary, pre-scaled to mm: 192×42/48×37)
- Batch processing — Google Sheets → ZIP من STL/G-code files
- واجهة تحكم كاملة (InputPanel) — اسمين + حجم خط + fillet + سماكة قاعدة + padding
- معاينة 3D تفاعلية (OrbitControls + إضاءة احترافية)
- G-code slicing عبر backend API
- رفع G-code على Google Drive
- واجهة عميل للـ Shopify (customer.html + iframe embed)
- تكامل Shopify (postMessage protocol — set-names, set-color, preview-ready)
- تسجيل فيديو 5 ثواني مع watermark (في الـ frontend)
- إعدادات الألوان (terracotta, black, gold, silver, white, wood, blue, pink)
- إعدادات Watermark text
- واجهة مستخدم mobile-responsive (tab toggle)
- shopify-extension/ — Liquid snippet
- woocommerce-plugin/ — WooCommerce integration
- slicer-profiles/ — ملفات إعداد الطابعة

**الـ Features الناقصة:**
- غير محدد — المشروع يبدو مكتمل وظيفياً

**الـ Database Tables/Models:**
مفيش tables خاصة — يستخدم IntegrationSetting لتخزين الإعدادات (dual_name_colors, dual_name_watermark)

**الـ API Endpoints:**
مشروع مستقل — الـ API في `server.js`:
- `POST /api/slice` — G-code slicing
- `POST /api/upload-drive` — رفع على Google Drive
- Static serving للـ HTML/JS/CSS

في الـ frontend (ضمن Leads module):
- `/leads/dual-name` — صفحة عرض الـ 3D
- `/leads/dual-name-settings` — إعدادات الألوان والـ watermark

**علاقته بالموديولات التانية:**
- **Leads:** مدمج كصفحات داخل Leads module (DualNamePage, DualNameSettingsPage)
- **Leads:** يستخدم IntegrationSetting لحفظ الإعدادات
- **Google Drive:** رفع ملفات الـ G-code
- **Google Sheets:** Batch processing من spreadsheet

---

### Auth

**الهدف:** نظام مصادقة وصلاحيات — تسجيل دخول، تسجيل حساب، OAuth، وإدارة الأدوار والصلاحيات.

**الحالة:** مكتمل

**الـ Features الموجودة فعلاً:**
- تسجيل دخول بالإيميل وكلمة المرور (bcrypt)
- تسجيل دخول بـ Google OAuth
- تسجيل دخول بـ Slack OAuth
- تسجيل حساب جديد (مع reCAPTCHA v3)
- تأكيد الإيميل (verification token)
- نسيت كلمة المرور + إعادة تعيين (reset token, 1 hour expiry)
- JWT tokens (configurable expiry)
- RBAC — أدوار (Roles) + صلاحيات (Permissions) + صلاحيات مستخدم (UserPermission grant/deny)
- Super Admin wildcard permission (`*`)
- حالة الحساب: pending → active → suspended
- إشعار الأدمن عند تسجيل مستخدم جديد
- نظام الموديولات (Module + ModuleRole + ModuleAccess)
- Google Drive OAuth callback (لـ refresh token setup)
- middleware: `authMiddleware`, `requirePermission(slug)`, `requireModule(slug)`

**الـ Features الناقصة:**
- مفيش refresh token endpoint — الـ token لما يـ expire المستخدم لازم يعمل login تاني
- الـ token مخزن في localStorage (عرضة لـ XSS)

**الـ Database Tables/Models:**
User, Role, Permission, RolePermission, UserPermission, Module, ModuleRole, ModuleAccess

**الـ API Endpoints:**

| Method | Path | الوصف |
|--------|------|-------|
| POST | /auth/login | تسجيل دخول |
| GET | /auth/me | المستخدم الحالي + الصلاحيات |
| POST | /auth/register | تسجيل حساب |
| POST | /auth/google | تسجيل دخول بـ Google |
| GET | /auth/slack | Slack OAuth URL |
| POST | /auth/slack/callback | Slack OAuth callback |
| GET | /auth/google/drive-callback | Google Drive refresh token |
| GET | /auth/verify-email/:token | تأكيد الإيميل |
| POST | /auth/forgot-password | نسيت كلمة المرور |
| POST | /auth/reset-password | إعادة تعيين كلمة المرور |

**علاقته بالموديولات التانية:**
- **كل الموديولات:** `authMiddleware` + `requirePermission` بيحموا كل الـ API endpoints
- **Settings:** إدارة المستخدمين المعلقين والأدوار

---

### Settings

**الهدف:** إعدادات المنصة وإدارة المستخدمين والأدوار.

**الحالة:** في التطوير

**الـ Features الموجودة فعلاً:**
- قائمة المستخدمين النشطين (مع فلترة حسب الدور)
- المستخدمين المعلقين (Pending) — قبول/رفض
- إرسال إيميل عند القبول
- إنشاء مستخدم يدوي (admin فقط)
- تعديل الملف الشخصي
- إدارة الأدوار والصلاحيات (Role permissions)
- صفحة التذاكر (داخل Settings)

**الـ Features الناقصة:**
- مفيش إعدادات عامة للمنصة (company info, branding, etc.)
- مفيش إعدادات الإشعارات (notification preferences)
- مفيش export/import للمستخدمين

**الـ Database Tables/Models:**
يستخدم User, Role, Permission, RolePermission من Auth module

**الـ API Endpoints:**

| Method | Path | الوصف |
|--------|------|-------|
| GET | /settings/users | قائمة المستخدمين |
| GET | /settings/users/pending | المعلقين |
| PATCH | /settings/users/:id/approve | قبول |
| PATCH | /settings/users/:id/reject | رفض |
| GET | /settings/users/roles | الأدوار |
| GET | /settings/users/permissions | الصلاحيات |
| PUT | /settings/users/roles/:id/permissions | تعديل صلاحيات |
| POST | /settings/users | إنشاء مستخدم |
| GET | /settings/users/me | الملف الشخصي |
| PATCH | /settings/users/me | تعديل الملف |
| GET | /settings/users/:id | تفاصيل مستخدم |
| PATCH | /settings/users/:id | تعديل مستخدم |

**علاقته بالموديولات التانية:**
- **Auth:** يشارك نفس الـ User/Role/Permission models
- **Tickets:** صفحة التذاكر موجودة ضمن Settings في الـ frontend

---

### Tickets

**الهدف:** نظام تذاكر داخلي لتسجيل المشاكل والتحسينات والاقتراحات.

**الحالة:** مكتمل

**الـ Features الموجودة فعلاً:**
- إنشاء تذكرة (bug/improvement/suggestion) مع وصف + screenshot (base64) + صور إضافية
- تحديد الموديول تلقائي من URL الصفحة
- حفظ pageUrl و userAgent
- قائمة التذاكر مع فلترة (type, status, priority, module)
- المستخدم العادي يشوف تذاكره بس
- تفاصيل التذكرة مع التعليقات
- تعديل الحالة والأولوية والمسؤول (admin فقط)
- حالات: new → reviewing → in_progress → resolved → closed
- أولويات: critical, high, medium, low
- إضافة تعليقات
- FloatingBugButton في كل صفحة (frontend) لإنشاء تذكرة بسرعة مع screenshot تلقائي

**الـ Features الناقصة:**
- غير محدد — يبدو مكتمل وظيفياً

**الـ Database Tables/Models:**
Ticket, TicketComment

**الـ API Endpoints:**

| Method | Path | الوصف |
|--------|------|-------|
| POST | /tickets | إنشاء تذكرة |
| GET | /tickets | قائمة التذاكر |
| GET | /tickets/:id | تفاصيل تذكرة |
| PATCH | /tickets/:id | تعديل حالة/أولوية/مسؤول |
| POST | /tickets/:id/comments | إضافة تعليق |

**علاقته بالموديولات التانية:**
- **كل الموديولات:** كل تذكرة فيها حقل `module` بيحدد الموديول المرتبط
- **Settings:** صفحة التذاكر موجودة ضمن Settings في الـ frontend

---

## Planned Modules (موديولات مخططة)

---

### Operations

**الهدف:** إدارة العمليات والطلبات والشحن

**الحالة:** مخطط — لم يبدأ التطوير بعد

---

### HR

**الهدف:** إدارة الموظفين والحضور والمرتبات

**الحالة:** مخطط — لم يبدأ التطوير بعد

---

### Inventory

**الهدف:** إدارة المخزون والمستودعات

**الحالة:** مخطط — لم يبدأ التطوير بعد

---

### Accounting

**الهدف:** الحسابات والمصروفات والإيرادات

**الحالة:** مخطط — لم يبدأ التطوير بعد

---

## Summary (ملخص)

### أكتر موديول مكتمل:
**Leads** — أكبر وأنضج موديول. فيه 70+ endpoint، 23 route file، 9 service files، 23 database model. يغطي دورة حياة الـ lead الكاملة من الاستقبال للتوزيع للبيع للشحن. مدمج مع 5 خدمات خارجية (WooCommerce, Bosta, Google Sheets, Google Drive, Google Vision).

يليه **Marketing** — فيه 120+ endpoint، 33 database model، AI integration كامل مع 3 providers. يغطي الكرييتيفز والحملات والـ landing pages والـ media buying.

### أكتر حاجة ناقصة:
1. **Background Jobs** — الـ scheduled posts مش بتتنشر تلقائي، الـ task rules مش بتتنفذ تلقائي (BullMQ مثبت بس مش مستخدم)
2. **Inbox TODOs** — 4 TODO comments واضحة: attachment upload to R2، webhook processing، delivery/read status
3. **4 موديولات مخططة** (Operations, HR, Inventory, Accounting) ما اتبنتش خالص
