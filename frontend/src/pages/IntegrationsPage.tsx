import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

const apiBase = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');

type FieldMapping = {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
};

type FormConnection = {
  id: string;
  name: string;
  shortcode: string | null;
  token: string;
  fieldMapping: FieldMapping | null;
  createdAt: string;
};

function useFormConnections() {
  return useQuery({
    queryKey: ['form-connections'],
    queryFn: async () => {
      const { data } = await api.get<{ connections: FormConnection[] }>('/form-connections');
      return data.connections;
    },
  });
}

function useWooStatus() {
  return useQuery({
    queryKey: ['woocommerce-status'],
    queryFn: async () => {
      const { data } = await api.get<{ configured: boolean }>('/woocommerce/status');
      return data;
    },
  });
}

type WooConfig = {
  configured: boolean;
  baseUrl: string;
  consumerKeyMasked: string;
  consumerSecretMasked: string;
  source: 'db' | 'env';
};

function useWooConfig() {
  return useQuery({
    queryKey: ['woocommerce-config'],
    queryFn: async () => {
      const { data } = await api.get<WooConfig>('/woocommerce/config');
      return data;
    },
  });
}

const MAPPING_FIELDS: { key: keyof FieldMapping; label: string; placeholder: string }[] = [
  { key: 'name',    label: 'الاسم',         placeholder: 'مثال: text-1 أو name-1' },
  { key: 'phone',   label: 'التليفون',       placeholder: 'مثال: phone-1' },
  { key: 'email',   label: 'الإيميل',        placeholder: 'مثال: email-1 (اختياري)' },
  { key: 'address', label: 'العنوان',        placeholder: 'مثال: textarea-1 (اختياري)' },
  { key: 'notes',   label: 'حقل مخصص/ملاحظات', placeholder: 'مثال: textarea-2 (اختياري)' },
];

function MappingEditor({ connection }: { connection: FormConnection }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mapping, setMapping] = useState<FieldMapping>(connection.fieldMapping ?? {});

  const saveMutation = useMutation({
    mutationFn: async (data: FieldMapping) => {
      await api.patch(`/form-connections/${connection.id}/mapping`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-connections'] });
      setOpen(false);
    },
  });

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={() => {
          setMapping(connection.fieldMapping ?? {});
          setOpen(!open);
        }}
        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        {open ? 'إخفاء' : 'ضبط تعيين الحقول'}
        {connection.fieldMapping && !open && (
          <span className="mr-1 text-green-600 text-xs">(مضبوط)</span>
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-2 max-w-lg">
          <p className="text-xs text-slate-500 mb-3">
            اكتب اسم الحقل كما هو في Forminator (الـ Element ID). اتركه فارغاً للكشف التلقائي.
          </p>
          {MAPPING_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key} className="flex items-center gap-2">
              <label className="text-sm text-slate-700 w-32 shrink-0">{label}</label>
              <input
                type="text"
                value={mapping[key] ?? ''}
                onChange={(e) => setMapping((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                className="border border-slate-300 rounded px-2 py-1 text-sm flex-1 font-mono"
              />
            </div>
          ))}
          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              onClick={() => {
                const cleaned: FieldMapping = {};
                for (const { key } of MAPPING_FIELDS) {
                  const v = mapping[key]?.trim();
                  if (v) cleaned[key] = v;
                }
                saveMutation.mutate(cleaned);
              }}
              disabled={saveMutation.isPending}
              className="bg-slate-700 text-white px-3 py-1.5 rounded text-sm hover:bg-slate-600 disabled:opacity-50"
            >
              {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ التعيين'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              إلغاء
            </button>
          </div>
          {saveMutation.isSuccess && <p className="text-green-600 text-xs">تم الحفظ.</p>}
          {saveMutation.isError && <p className="text-red-600 text-xs">حدث خطأ أثناء الحفظ.</p>}
        </div>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  const queryClient = useQueryClient();
  const { data: connections = [], isLoading: loadingConn } = useFormConnections();
  const { data: wooStatus, isLoading: loadingWoo } = useWooStatus();
  const { data: wooConfig, isLoading: loadingWooConfig } = useWooConfig();
  const [name, setName] = useState('');
  const [shortcode, setShortcode] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [wooBaseUrl, setWooBaseUrl] = useState('');
  const [wooConsumerKey, setWooConsumerKey] = useState('');
  const [wooConsumerSecret, setWooConsumerSecret] = useState('');

  const saveWooMutation = useMutation({
    mutationFn: async (body: { baseUrl: string; consumerKey: string; consumerSecret: string }) => {
      await api.post('/woocommerce/config', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['woocommerce-status'] });
      queryClient.invalidateQueries({ queryKey: ['woocommerce-config'] });
    },
  });

  React.useEffect(() => {
    if (wooConfig) {
      setWooBaseUrl(wooConfig.baseUrl);
      if (!wooConfig.consumerKeyMasked && !wooConfig.consumerSecretMasked) {
        setWooConsumerKey('');
        setWooConsumerSecret('');
      }
    }
  }, [wooConfig]);

  const createMutation = useMutation({
    mutationFn: async (body: { name: string; shortcode?: string }) => {
      const { data } = await api.post<{ connection: FormConnection }>('/form-connections', body);
      return data.connection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-connections'] });
      setName('');
      setShortcode('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/form-connections/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['form-connections'] }),
  });

  const webhookUrl = (token: string) => `${apiBase}/api/webhooks/leads/${token}`;

  const copyUrl = (id: string, token: string) => {
    navigator.clipboard.writeText(webhookUrl(token));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-800">الربط مع ووردبريس وووكومرس</h1>

      {/* ووكومرس */}
      <section className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-2">ووكومرس</h2>
        <p className="text-slate-600 text-sm mb-4">
          أدخل رابط الموقع وبيانات ووكومرس (من ووكومرس → الإعدادات → متقدّم → REST API). يمكنك أيضاً ضبطها عبر متغيرات البيئة على السيرفر.
        </p>
        {(loadingWoo || loadingWooConfig) ? (
          <p className="text-slate-500">جاري التحميل...</p>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                  wooStatus?.configured ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${wooStatus?.configured ? 'bg-green-500' : 'bg-amber-500'}`} />
                {wooStatus?.configured ? 'متصل' : 'غير مضبوط'}
              </span>
              {wooConfig?.source === 'env' && wooStatus?.configured && (
                <span className="text-slate-500 text-sm">(من متغيرات البيئة)</span>
              )}
            </div>
            <form
              className="space-y-3 max-w-xl"
              onSubmit={(e) => {
                e.preventDefault();
                saveWooMutation.mutate({
                  baseUrl: wooBaseUrl.trim(),
                  consumerKey: wooConsumerKey.trim(),
                  consumerSecret: wooConsumerSecret.trim(),
                });
              }}
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">رابط الموقع</label>
                <input
                  type="url"
                  value={wooBaseUrl}
                  onChange={(e) => setWooBaseUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="border border-slate-300 rounded-lg px-3 py-2 w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Consumer Key</label>
                <input
                  type="password"
                  value={wooConsumerKey}
                  onChange={(e) => setWooConsumerKey(e.target.value)}
                  placeholder={wooConfig?.consumerKeyMasked || 'ck_...'}
                  className="border border-slate-300 rounded-lg px-3 py-2 w-full"
                  autoComplete="off"
                />
                {wooConfig?.consumerKeyMasked && !wooConsumerKey && (
                  <p className="text-xs text-slate-500 mt-1">اتركه فارغاً للإبقاء على القيمة الحالية</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Consumer Secret</label>
                <input
                  type="password"
                  value={wooConsumerSecret}
                  onChange={(e) => setWooConsumerSecret(e.target.value)}
                  placeholder={wooConfig?.consumerSecretMasked || 'cs_...'}
                  className="border border-slate-300 rounded-lg px-3 py-2 w-full"
                  autoComplete="off"
                />
                {wooConfig?.consumerSecretMasked && !wooConsumerSecret && (
                  <p className="text-xs text-slate-500 mt-1">اتركه فارغاً للإبقاء على القيمة الحالية</p>
                )}
              </div>
              <button
                type="submit"
                disabled={
                  !wooBaseUrl.trim() ||
                  (!wooConfig?.consumerKeyMasked && (!wooConsumerKey.trim() || !wooConsumerSecret.trim())) ||
                  saveWooMutation.isPending
                }
                className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-600 disabled:opacity-50"
              >
                {saveWooMutation.isPending ? 'جاري الحفظ...' : 'حفظ إعدادات ووكومرس'}
              </button>
              {saveWooMutation.isError && (
                <p className="text-red-600 text-sm">
                  {(() => {
                    const e = saveWooMutation.error as { response?: { data?: { error?: string }; status?: number } };
                    const apiError = e?.response?.data?.error;
                    if (typeof apiError === 'string') return apiError;
                    return (saveWooMutation.error as Error)?.message || 'حدث خطأ';
                  })()}
                </p>
              )}
              {saveWooMutation.isSuccess && <p className="text-green-600 text-sm">تم الحفظ.</p>}
            </form>
          </>
        )}
      </section>

      {/* نماذج ووردبريس → ليدز */}
      <section className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-2">نماذج ووردبريس → ليدز</h2>
        <p className="text-slate-600 text-sm mb-4">
          أنشئ اتصالاً لكل نموذج، انسخ رابط الويب هوك وضعه في Forminator، ثم اضبط تعيين الحقول لتحديد أي حقل يقابل أي معلومة في الليد.
        </p>

        <div className="mb-6 flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="اسم الاتصال (مثلاً: لاندنج الكورس)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 w-64"
          />
          <input
            type="text"
            placeholder="Shortcode (اختياري)"
            value={shortcode}
            onChange={(e) => setShortcode(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 w-48"
          />
          <button
            type="button"
            onClick={() => name.trim() && createMutation.mutate({ name: name.trim(), shortcode: shortcode.trim() || undefined })}
            disabled={!name.trim() || createMutation.isPending}
            className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-600 disabled:opacity-50"
          >
            {createMutation.isPending ? 'جاري الإنشاء...' : 'إضافة اتصال'}
          </button>
        </div>

        {createMutation.isError && (
          <p className="text-red-600 text-sm mb-2">
            {(createMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'حدث خطأ'}
          </p>
        )}

        {loadingConn ? (
          <p className="text-slate-500">جاري تحميل الاتصالات...</p>
        ) : connections.length === 0 ? (
          <p className="text-slate-500">لا توجد اتصالات. أضف اتصالاً ثم انسخ الرابط إلى Forminator.</p>
        ) : (
          <ul className="space-y-4">
            {connections.map((c) => (
              <li key={c.id} className="border border-slate-200 rounded-lg p-4">
                <div className="flex flex-wrap items-start gap-3 justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{c.name}</p>
                    {c.shortcode && <p className="text-sm text-slate-500 font-mono">{c.shortcode}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs bg-slate-100 px-2 py-1 rounded max-w-xs truncate block">
                      {webhookUrl(c.token)}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyUrl(c.id, c.token)}
                      className="text-sm bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded"
                    >
                      {copiedId === c.id ? 'تم النسخ' : 'نسخ الرابط'}
                    </button>
                    <button
                      type="button"
                      onClick={() => window.confirm('حذف هذا الاتصال؟') && deleteMutation.mutate(c.id)}
                      disabled={deleteMutation.isPending}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      حذف
                    </button>
                  </div>
                </div>
                <MappingEditor connection={c} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
