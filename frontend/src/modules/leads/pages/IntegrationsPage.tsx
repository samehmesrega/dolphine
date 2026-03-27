import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../shared/services/api';

const apiBase = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');

type CustomFieldDef = { label: string; field: string; type?: 'customer' | 'product' };

type FieldMapping = {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  createdAt?: string;
  statusColumn?: string;
  statusMapping?: Record<string, string>;
  userColumn?: string;
  userMapping?: Record<string, string>;
  customFields?: CustomFieldDef[];
};

type FormConnection = {
  id: string;
  name: string;
  shortcode: string | null;
  token: string;
  fieldMapping: FieldMapping | null;
  productId: string | null;
  product: { id: string; name: string } | null;
  createdAt: string;
};

type Product = { id: string; name: string };

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

type BostaConfig = {
  configured: boolean;
  enabled: boolean;
  baseUrl: string;
  apiKeyMasked: string;
  source: 'db' | 'env';
  webhookUrl: string;
};

function useBostaConfig() {
  return useQuery({
    queryKey: ['bosta-config'],
    queryFn: async () => {
      const { data } = await api.get<BostaConfig>('/bosta/config');
      return data;
    },
  });
}

function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await api.get<{ products: Product[] }>('/products');
      return data.products;
    },
  });
}

type CoreFieldKey = 'name' | 'phone' | 'email' | 'address';
const CORE_FIELDS: { key: CoreFieldKey; label: string; placeholder: string }[] = [
  { key: 'name',    label: 'الاسم',    placeholder: 'مثال: text-1' },
  { key: 'phone',   label: 'التليفون', placeholder: 'مثال: phone-1' },
  { key: 'email',   label: 'الإيميل',  placeholder: 'مثال: email-1 (اختياري)' },
  { key: 'address', label: 'العنوان',  placeholder: 'مثال: textarea-1 (اختياري)' },
];

function MappingEditor({ connection }: { connection: FormConnection }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mapping, setMapping] = useState<FieldMapping>(connection.fieldMapping ?? {});
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>(
    connection.fieldMapping?.customFields ?? []
  );
  const [selectedProductId, setSelectedProductId] = useState<string>(connection.productId ?? '');

  const { data: products } = useProducts();

  const saveMutation = useMutation({
    mutationFn: async (data: FieldMapping) => {
      await api.patch(`/form-connections/${connection.id}/mapping`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-connections'] });
      setOpen(false);
    },
  });

  const productMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/form-connections/${connection.id}`, { productId: selectedProductId || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-connections'] });
    },
  });

  const addCustomField = () => {
    setCustomFields((prev) => [...prev, { label: '', field: '' }]);
  };

  const updateCustomField = (i: number, key: keyof CustomFieldDef, val: string) => {
    setCustomFields((prev) => prev.map((f, idx) => idx === i ? { ...f, [key]: val } : f));
  };

  const removeCustomField = (i: number) => {
    setCustomFields((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSave = () => {
    const cleaned: FieldMapping = {};
    for (const { key } of CORE_FIELDS) {
      const v = mapping[key]?.trim();
      if (v) cleaned[key] = v;
    }
    const validCustom = customFields.filter((f) => f.label.trim() && f.field.trim());
    if (validCustom.length > 0) cleaned.customFields = validCustom;
    saveMutation.mutate(cleaned);
    productMutation.mutate();
  };

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={() => {
          setMapping(connection.fieldMapping ?? {});
          setCustomFields(connection.fieldMapping?.customFields ?? []);
          setSelectedProductId(connection.productId ?? '');
          setOpen(!open);
        }}
        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        {open ? 'إخفاء' : 'ضبط تعيين الحقول'}
        {connection.fieldMapping && !open && (
          <span className="mr-1 text-green-600 text-xs">(مضبوط)</span>
        )}
        {connection.product && !open && (
          <span className="mr-2 text-purple-600 text-xs">({connection.product.name})</span>
        )}
      </button>

      {open && (
        <div className="mt-3 max-w-xl space-y-4">
          <p className="text-xs text-slate-500">
            اكتب الـ Element ID للحقل كما هو في Forminator. اتركه فارغاً للكشف التلقائي.
          </p>

          {/* المنتج المرتبط بالفورم */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">المنتج المرتبط</p>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-700 w-24 shrink-0">المنتج</label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 text-sm flex-1"
              >
                <option value="">-- بدون منتج --</option>
                {(products ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-400">اختر المنتج اللي يتسجل اهتمام به تلقائياً عند وصول ليد من هذا الفورم</p>
          </div>

          {/* الحقول الأساسية */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">الحقول الأساسية</p>
            {CORE_FIELDS.map(({ key, label, placeholder }) => (
              <div key={key} className="flex items-center gap-2">
                <label className="text-sm text-slate-700 w-24 shrink-0">{label}</label>
                <input
                  type="text"
                  value={mapping[key] ?? ''}
                  onChange={(e) => setMapping((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="border border-slate-300 rounded px-2 py-1 text-sm flex-1 font-mono"
                />
              </div>
            ))}
          </div>

          {/* الحقول المخصصة */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">حقول مخصصة</p>
            {customFields.map((cf, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={cf.label}
                  onChange={(e) => updateCustomField(i, 'label', e.target.value)}
                  placeholder="اسم الحقل (مثال: الصفة)"
                  className="border border-slate-300 rounded px-2 py-1 text-sm w-36"
                />
                <span className="text-slate-400 text-sm">←</span>
                <input
                  type="text"
                  value={cf.field}
                  onChange={(e) => updateCustomField(i, 'field', e.target.value)}
                  placeholder="ID في Forminator (مثال: text-2)"
                  className="border border-slate-300 rounded px-2 py-1 text-sm flex-1 font-mono"
                />
                <select
                  value={cf.type ?? 'customer'}
                  onChange={(e) => updateCustomField(i, 'type', e.target.value as 'customer' | 'product')}
                  className="border border-slate-300 rounded px-2 py-1 text-sm w-36"
                >
                  <option value="customer">بيانات عميل</option>
                  <option value="product">بيانات منتج</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeCustomField(i)}
                  className="text-red-500 hover:text-red-700 text-sm px-1"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addCustomField}
              className="text-sm text-blue-600 hover:text-blue-700 border border-blue-200 rounded px-3 py-1 hover:bg-blue-50"
            >
              + إضافة حقل مخصص
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending || productMutation.isPending}
              className="bg-slate-700 text-white px-3 py-1.5 rounded text-sm hover:bg-slate-600 disabled:opacity-50"
            >
              {(saveMutation.isPending || productMutation.isPending) ? 'جاري الحفظ...' : 'حفظ التعيين'}
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

// ==================== Google Sheets ====================

type SheetConnection = {
  id: string;
  name: string;
  spreadsheetId: string;
  sheetName: string;
  token: string;
  fieldMapping: FieldMapping | null;
  productId: string | null;
  product: { id: string; name: string } | null;
  lastSyncedRow: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function useSheetConnections() {
  return useQuery({
    queryKey: ['sheet-connections'],
    queryFn: async () => {
      const { data } = await api.get<{ connections: SheetConnection[] }>('/sheet-connections');
      return data.connections;
    },
  });
}

function useGoogleConfig() {
  return useQuery({
    queryKey: ['google-sheets-config'],
    queryFn: async () => {
      const { data } = await api.get<{ configured: boolean; apiKeyMasked: string | null }>('/sheet-connections/google-config');
      return data;
    },
  });
}

type LeadStatusOption = { id: string; name: string; slug: string };
type UserOption = { id: string; name: string };

function useLeadStatuses() {
  return useQuery({
    queryKey: ['lead-statuses'],
    queryFn: async () => {
      const { data } = await api.get<{ statuses: LeadStatusOption[] }>('/lead-statuses');
      return data.statuses;
    },
  });
}

function useUsers() {
  return useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const { data } = await api.get<{ users: UserOption[] }>('/users');
      return data.users;
    },
  });
}

function SheetMappingEditor({ connection }: { connection: SheetConnection }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mapping, setMapping] = useState<FieldMapping>(connection.fieldMapping ?? {});
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>(connection.fieldMapping?.customFields ?? []);
  const [selectedProductId, setSelectedProductId] = useState<string>(connection.productId ?? '');
  const [headers, setHeaders] = useState<string[]>([]);
  const [headersLoading, setHeadersLoading] = useState(false);
  const [headersError, setHeadersError] = useState('');

  // State for status mapping
  const [statusColumn, setStatusColumn] = useState<string>(connection.fieldMapping?.statusColumn ?? '');
  const [statusMapping, setStatusMapping] = useState<Record<string, string>>(connection.fieldMapping?.statusMapping ?? {});
  const [statusValues, setStatusValues] = useState<string[]>([]);
  const [loadingStatusValues, setLoadingStatusValues] = useState(false);

  // State for user mapping
  const [userColumn, setUserColumn] = useState<string>(connection.fieldMapping?.userColumn ?? '');
  const [userMapping, setUserMapping] = useState<Record<string, string>>(connection.fieldMapping?.userMapping ?? {});
  const [userValues, setUserValues] = useState<string[]>([]);
  const [loadingUserValues, setLoadingUserValues] = useState(false);

  const { data: products } = useProducts();
  const { data: leadStatuses } = useLeadStatuses();
  const { data: users } = useUsers();

  const fetchHeaders = async () => {
    setHeadersLoading(true);
    setHeadersError('');
    try {
      const { data } = await api.get<{ headers: string[] }>(`/sheet-connections/${connection.id}/headers`);
      setHeaders(data.headers);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setHeadersError(e?.response?.data?.error || 'خطأ في قراءة أعمدة الشيت');
    } finally {
      setHeadersLoading(false);
    }
  };

  const fetchColumnValues = async (columnName: string): Promise<string[]> => {
    if (!columnName) return [];
    try {
      const { data } = await api.get<{ values: string[] }>(
        `/sheet-connections/${connection.id}/column-values?column=${encodeURIComponent(columnName)}`
      );
      return data.values;
    } catch {
      return [];
    }
  };

  const handleStatusColumnChange = async (col: string) => {
    setStatusColumn(col);
    setStatusMapping({});
    if (col) {
      setLoadingStatusValues(true);
      const values = await fetchColumnValues(col);
      setStatusValues(values);
      setLoadingStatusValues(false);
    } else {
      setStatusValues([]);
    }
  };

  const handleUserColumnChange = async (col: string) => {
    setUserColumn(col);
    setUserMapping({});
    if (col) {
      setLoadingUserValues(true);
      const values = await fetchColumnValues(col);
      setUserValues(values);
      setLoadingUserValues(false);
    } else {
      setUserValues([]);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: FieldMapping) => {
      await api.patch(`/sheet-connections/${connection.id}/mapping`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheet-connections'] });
      setOpen(false);
    },
  });

  const productMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/sheet-connections/${connection.id}`, { productId: selectedProductId || null });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sheet-connections'] }),
  });

  const addCustomField = () => setCustomFields((prev) => [...prev, { label: '', field: '' }]);
  const updateCustomField = (i: number, key: keyof CustomFieldDef, val: string) =>
    setCustomFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, [key]: val } : f)));
  const removeCustomField = (i: number) => setCustomFields((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = () => {
    const cleaned: FieldMapping = {};
    for (const { key } of CORE_FIELDS) {
      const v = mapping[key]?.trim();
      if (v) cleaned[key] = v;
    }
    // createdAt
    const createdAtCol = mapping.createdAt?.trim();
    if (createdAtCol) cleaned.createdAt = createdAtCol;
    // status mapping
    if (statusColumn) {
      cleaned.statusColumn = statusColumn;
      if (Object.keys(statusMapping).length > 0) cleaned.statusMapping = statusMapping;
    }
    // user mapping
    if (userColumn) {
      cleaned.userColumn = userColumn;
      if (Object.keys(userMapping).length > 0) cleaned.userMapping = userMapping;
    }
    const validCustom = customFields.filter((f) => f.label.trim() && f.field.trim());
    if (validCustom.length > 0) cleaned.customFields = validCustom;
    saveMutation.mutate(cleaned);
    productMutation.mutate();
  };

  const handleOpen = () => {
    setMapping(connection.fieldMapping ?? {});
    setCustomFields(connection.fieldMapping?.customFields ?? []);
    setSelectedProductId(connection.productId ?? '');
    setStatusColumn(connection.fieldMapping?.statusColumn ?? '');
    setStatusMapping(connection.fieldMapping?.statusMapping ?? {});
    setUserColumn(connection.fieldMapping?.userColumn ?? '');
    setUserMapping(connection.fieldMapping?.userMapping ?? {});
    setStatusValues([]);
    setUserValues([]);
    if (!open) {
      fetchHeaders();
      // load saved column values
      if (connection.fieldMapping?.statusColumn) {
        fetchColumnValues(connection.fieldMapping.statusColumn).then(setStatusValues);
      }
      if (connection.fieldMapping?.userColumn) {
        fetchColumnValues(connection.fieldMapping.userColumn).then(setUserValues);
      }
    }
    setOpen(!open);
  };

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <button type="button" onClick={handleOpen} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
        {open ? 'إخفاء' : 'ضبط تعيين الأعمدة'}
        {connection.fieldMapping && !open && <span className="mr-1 text-green-600 text-xs">(مضبوط)</span>}
        {connection.product && !open && <span className="mr-2 text-purple-600 text-xs">({connection.product.name})</span>}
      </button>

      {open && (
        <div className="mt-3 max-w-xl space-y-4">
          {headersLoading && <p className="text-slate-500 text-sm">جاري قراءة أعمدة الشيت...</p>}
          {headersError && <p className="text-red-600 text-sm">{headersError}</p>}

          {headers.length > 0 && (
            <>
              {/* المنتج المرتبط */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">المنتج المرتبط</p>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-700 w-24 shrink-0">المنتج</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="border border-slate-300 rounded px-2 py-1 text-sm flex-1"
                  >
                    <option value="">-- بدون منتج --</option>
                    {(products ?? []).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* الحقول الأساسية - dropdowns */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">الحقول الأساسية</p>
                {CORE_FIELDS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <label className="text-sm text-slate-700 w-24 shrink-0">{label}</label>
                    <select
                      value={mapping[key] ?? ''}
                      onChange={(e) => setMapping((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="border border-slate-300 rounded px-2 py-1 text-sm flex-1"
                    >
                      <option value="">-- اختر عمود --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* تاريخ الإنشاء */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">تاريخ الإنشاء</p>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-700 w-24 shrink-0">تاريخ الإنشاء</label>
                  <select
                    value={mapping.createdAt ?? ''}
                    onChange={(e) => setMapping(prev => ({ ...prev, createdAt: e.target.value }))}
                    className="border border-slate-300 rounded px-2 py-1 text-sm flex-1"
                  >
                    <option value="">-- بدون (يستخدم تاريخ الاستيراد) --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <p className="text-xs text-slate-400">اختر عمود التاريخ لاستخدامه كتاريخ إنشاء الليد بدلاً من تاريخ الاستيراد</p>
              </div>

              {/* تعيين الحالات */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">تعيين الحالات</p>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-700 w-24 shrink-0">عمود الحالة</label>
                  <select
                    value={statusColumn}
                    onChange={(e) => handleStatusColumnChange(e.target.value)}
                    className="border border-slate-300 rounded px-2 py-1 text-sm flex-1"
                  >
                    <option value="">-- بدون (كل الليدز = جديد) --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                {loadingStatusValues && <p className="text-slate-500 text-xs">جاري قراءة القيم...</p>}
                {statusColumn && statusValues.length > 0 && (
                  <div className="border border-slate-200 rounded p-3 space-y-2">
                    <p className="text-xs text-slate-500">حدد الحالة المقابلة في دولفين لكل قيمة في الشيت:</p>
                    {statusValues.map(sheetVal => (
                      <div key={sheetVal} className="flex items-center gap-2">
                        <span className="text-sm text-slate-700 w-40 shrink-0 truncate" title={sheetVal}>{sheetVal}</span>
                        <span className="text-slate-400 text-sm">←</span>
                        <select
                          value={statusMapping[sheetVal] ?? ''}
                          onChange={(e) => setStatusMapping(prev => ({ ...prev, [sheetVal]: e.target.value }))}
                          className="border border-slate-300 rounded px-2 py-1 text-sm flex-1"
                        >
                          <option value="">-- جديد (افتراضي) --</option>
                          {(leadStatuses ?? []).map(s => (
                            <option key={s.slug} value={s.slug}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* تعيين المسؤولين */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">تعيين المسؤولين</p>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-700 w-24 shrink-0">عمود المسؤول</label>
                  <select
                    value={userColumn}
                    onChange={(e) => handleUserColumnChange(e.target.value)}
                    className="border border-slate-300 rounded px-2 py-1 text-sm flex-1"
                  >
                    <option value="">-- بدون (توزيع تلقائي) --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                {loadingUserValues && <p className="text-slate-500 text-xs">جاري قراءة القيم...</p>}
                {userColumn && userValues.length > 0 && (
                  <div className="border border-slate-200 rounded p-3 space-y-2">
                    <p className="text-xs text-slate-500">حدد المسؤول في دولفين لكل اسم في الشيت:</p>
                    {userValues.map(sheetVal => (
                      <div key={sheetVal} className="flex items-center gap-2">
                        <span className="text-sm text-slate-700 w-40 shrink-0 truncate" title={sheetVal}>{sheetVal}</span>
                        <span className="text-slate-400 text-sm">←</span>
                        <select
                          value={userMapping[sheetVal] ?? ''}
                          onChange={(e) => setUserMapping(prev => ({ ...prev, [sheetVal]: e.target.value }))}
                          className="border border-slate-300 rounded px-2 py-1 text-sm flex-1"
                        >
                          <option value="">-- توزيع تلقائي --</option>
                          {(users ?? []).map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* حقول مخصصة */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">حقول مخصصة</p>
                {customFields.map((cf, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={cf.label}
                      onChange={(e) => updateCustomField(i, 'label', e.target.value)}
                      placeholder="اسم الحقل"
                      className="border border-slate-300 rounded px-2 py-1 text-sm w-36"
                    />
                    <span className="text-slate-400 text-sm">←</span>
                    <select
                      value={cf.field}
                      onChange={(e) => updateCustomField(i, 'field', e.target.value)}
                      className="border border-slate-300 rounded px-2 py-1 text-sm flex-1"
                    >
                      <option value="">-- اختر عمود --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <select
                      value={cf.type ?? 'customer'}
                      onChange={(e) => updateCustomField(i, 'type', e.target.value as 'customer' | 'product')}
                      className="border border-slate-300 rounded px-2 py-1 text-sm w-36"
                    >
                      <option value="customer">بيانات عميل</option>
                      <option value="product">بيانات منتج</option>
                    </select>
                    <button type="button" onClick={() => removeCustomField(i)} className="text-red-500 hover:text-red-700 text-sm px-1">
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addCustomField}
                  className="text-sm text-blue-600 hover:text-blue-700 border border-blue-200 rounded px-3 py-1 hover:bg-blue-50"
                >
                  + إضافة حقل مخصص
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveMutation.isPending || productMutation.isPending}
                  className="bg-slate-700 text-white px-3 py-1.5 rounded text-sm hover:bg-slate-600 disabled:opacity-50"
                >
                  {saveMutation.isPending || productMutation.isPending ? 'جاري الحفظ...' : 'حفظ التعيين'}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:text-slate-700">
                  إلغاء
                </button>
              </div>
              {saveMutation.isSuccess && <p className="text-green-600 text-xs">تم الحفظ.</p>}
              {saveMutation.isError && <p className="text-red-600 text-xs">حدث خطأ أثناء الحفظ.</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SheetAppsScript({ webhookUrl }: { webhookUrl: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const script = `// ضع هذا الكود في Google Apps Script
// Extensions → Apps Script → الصق الكود → اضغط حفظ
// ثم شغّل installTriggers مرة واحدة فقط

function onFormSubmit(e) {
  sendRow(e.range.getRow());
}

function sendRow(rowNum) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];

  var data = {};
  for (var i = 0; i < headers.length; i++) {
    if (headers[i]) data[headers[i]] = row[i] ? String(row[i]) : '';
  }

  UrlFetchApp.fetch('${webhookUrl}', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ row: data }),
    muteHttpExceptions: true
  });
}

// شغّل هذه الدالة مرة واحدة فقط لتفعيل الإرسال التلقائي
function installTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onFormSubmit()
    .create();
}`;

  const copyScript = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen(!open)} className="text-sm text-purple-600 hover:text-purple-700 font-medium">
        {open ? 'إخفاء' : 'كود الإرسال التلقائي (Apps Script)'}
      </button>
      {open && (
        <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-600">انسخ هذا الكود وضعه في Google Apps Script في الشيت</p>
            <button type="button" onClick={copyScript} className="text-sm bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded">
              {copied ? 'تم النسخ' : 'نسخ الكود'}
            </button>
          </div>
          <pre className="text-xs text-slate-700 overflow-x-auto whitespace-pre leading-relaxed max-h-64 overflow-y-auto font-mono bg-white border border-slate-100 rounded p-2" dir="ltr">
            {script}
          </pre>
        </div>
      )}
    </div>
  );
}

function GoogleSheetsSection() {
  const queryClient = useQueryClient();
  const { data: googleConfig, isLoading: loadingGConfig } = useGoogleConfig();
  const { data: sheetConns = [], isLoading: loadingSheets } = useSheetConnections();

  // API Key
  const [apiKey, setApiKey] = useState('');
  const saveApiKeyMutation = useMutation({
    mutationFn: async () => {
      await api.post('/sheet-connections/google-config', { apiKey: apiKey.trim() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-sheets-config'] });
      setApiKey('');
    },
  });

  // Add connection
  const [sheetName, setSheetName] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetTab, setSheetTab] = useState('');
  const createSheetMutation = useMutation({
    mutationFn: async () => {
      await api.post('/sheet-connections', {
        name: sheetName.trim(),
        spreadsheetUrl: sheetUrl.trim(),
        sheetName: sheetTab.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheet-connections'] });
      setSheetName('');
      setSheetUrl('');
      setSheetTab('');
    },
  });

  // Delete
  const deleteSheetMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sheet-connections/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sheet-connections'] }),
  });

  // Import
  const [importing, setImporting] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ id: string; msg: string } | null>(null);

  const handleImport = async (id: string, all: boolean) => {
    if (all && !window.confirm('هذا سيستورد كل الصفوف من البداية. متأكد؟')) return;
    setImporting(id);
    setImportResult(null);
    try {
      const endpoint = all ? `/sheet-connections/${id}/import-all` : `/sheet-connections/${id}/import`;
      const { data } = await api.post<{ created: number; skipped: number; failed: number; totalRows: number }>(endpoint);
      setImportResult({ id, msg: `تم: ${data.created} ليد جديد، ${data.skipped} تخطي، ${data.failed} فشل (من ${data.totalRows} صف)` });
      queryClient.invalidateQueries({ queryKey: ['sheet-connections'] });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setImportResult({ id, msg: e?.response?.data?.error || 'خطأ في الاستيراد' });
    } finally {
      setImporting(null);
    }
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [autoSyncModal, setAutoSyncModal] = useState<{ script: string; webhookUrl: string } | null>(null);
  const [autoSyncLoading, setAutoSyncLoading] = useState<string | null>(null);
  const [autoSyncCopied, setAutoSyncCopied] = useState(false);

  const handleAutoSync = async (connectionId: string) => {
    setAutoSyncLoading(connectionId);
    try {
      const { data } = await api.get<{ script: string; webhookUrl: string }>(`/sheet-connections/${connectionId}/auto-sync-script`);
      setAutoSyncModal(data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      alert(e?.response?.data?.error || 'خطأ في جلب السكربت');
    } finally {
      setAutoSyncLoading(null);
    }
  };

  const copyAutoSyncScript = () => {
    if (autoSyncModal) {
      navigator.clipboard.writeText(autoSyncModal.script);
      setAutoSyncCopied(true);
      setTimeout(() => setAutoSyncCopied(false), 2000);
    }
  };

  const sheetWebhookUrl = (token: string) => `${apiBase}/api/webhooks/sheets/${token}`;
  const copySheetUrl = (id: string, token: string) => {
    navigator.clipboard.writeText(sheetWebhookUrl(token));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <section className="bg-white rounded-xl shadow p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-2">Google Sheets → ليدز</h2>
      <p className="text-slate-600 text-sm mb-4">
        اربط شيت جوجل لاستيراد الليدز. اعمل الشيت "أي شخص لديه الرابط يمكنه العرض"، حدد أعمدة الماپنج، واستورد الليدز يدوياً أو تلقائياً.
      </p>

      {/* Google API Key */}
      <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-sm font-medium text-slate-700">مفتاح Google Sheets API</p>
          {loadingGConfig ? (
            <span className="text-slate-400 text-xs">جاري...</span>
          ) : (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                googleConfig?.configured ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${googleConfig?.configured ? 'bg-green-500' : 'bg-amber-500'}`} />
              {googleConfig?.configured ? 'مضبوط' : 'غير مضبوط'}
            </span>
          )}
        </div>
        <div className="flex gap-2 max-w-xl">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={googleConfig?.apiKeyMasked || 'AIza...'}
            className="border border-slate-300 rounded-lg px-3 py-2 flex-1 text-sm"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => saveApiKeyMutation.mutate()}
            disabled={!apiKey.trim() || saveApiKeyMutation.isPending}
            className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-600 disabled:opacity-50 text-sm"
          >
            {saveApiKeyMutation.isPending ? 'جاري...' : 'حفظ'}
          </button>
        </div>
        {saveApiKeyMutation.isSuccess && <p className="text-green-600 text-xs mt-1">تم الحفظ.</p>}
        {saveApiKeyMutation.isError && <p className="text-red-600 text-xs mt-1">خطأ في حفظ المفتاح</p>}
        {googleConfig?.apiKeyMasked && !apiKey && (
          <p className="text-xs text-slate-500 mt-1">اتركه فارغاً للإبقاء على القيمة الحالية ({googleConfig.apiKeyMasked})</p>
        )}
      </div>

      {/* إضافة اتصال */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="اسم الاتصال (مثلاً: ليدز فيسبوك)"
            value={sheetName}
            onChange={(e) => setSheetName(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 w-52"
          />
          <input
            type="text"
            placeholder="رابط Google Sheets"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 flex-1 min-w-[200px]"
          />
          <input
            type="text"
            placeholder="اسم الورقة (Sheet1)"
            value={sheetTab}
            onChange={(e) => setSheetTab(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 w-40"
          />
          <button
            type="button"
            onClick={() => createSheetMutation.mutate()}
            disabled={!sheetName.trim() || !sheetUrl.trim() || createSheetMutation.isPending}
            className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-600 disabled:opacity-50"
          >
            {createSheetMutation.isPending ? 'جاري...' : 'إضافة شيت'}
          </button>
        </div>
        {createSheetMutation.isError && (
          <p className="text-red-600 text-sm mt-2">
            {(createSheetMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'خطأ في إنشاء الاتصال'}
          </p>
        )}
      </div>

      {/* قائمة الاتصالات */}
      {loadingSheets ? (
        <p className="text-slate-500">جاري التحميل...</p>
      ) : sheetConns.length === 0 ? (
        <p className="text-slate-500">لا توجد اتصالات شيت. أضف اتصالاً جديداً.</p>
      ) : (
        <ul className="space-y-4">
          {sheetConns.map((sc) => (
            <li key={sc.id} className="border border-slate-200 rounded-lg p-4">
              <div className="flex flex-wrap items-start gap-3 justify-between">
                <div>
                  <p className="font-medium text-slate-800">{sc.name}</p>
                  <p className="text-xs text-slate-500">{sc.sheetName} — {sc.lastSyncedRow} صف مستورد</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleImport(sc.id, false)}
                    disabled={importing === sc.id}
                    className="text-sm bg-green-100 text-green-800 hover:bg-green-200 px-3 py-1 rounded"
                  >
                    {importing === sc.id ? 'جاري...' : 'استيراد الجديد'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleImport(sc.id, true)}
                    disabled={importing === sc.id}
                    className="text-sm bg-blue-100 text-blue-800 hover:bg-blue-200 px-3 py-1 rounded"
                  >
                    استيراد الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAutoSync(sc.id)}
                    disabled={autoSyncLoading === sc.id}
                    className="text-sm bg-purple-100 text-purple-800 hover:bg-purple-200 px-3 py-1 rounded"
                  >
                    {autoSyncLoading === sc.id ? 'جاري...' : 'مزامنة تلقائية'}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.confirm('حذف هذا الاتصال؟') && deleteSheetMutation.mutate(sc.id)}
                    disabled={deleteSheetMutation.isPending}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    حذف
                  </button>
                </div>
              </div>

              {importResult?.id === sc.id && (
                <p className={`text-sm mt-2 ${importResult.msg.includes('خطأ') ? 'text-red-600' : 'text-green-700'}`}>
                  {importResult.msg}
                </p>
              )}

              {/* Webhook URL */}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <code className="text-xs bg-slate-100 px-2 py-1 rounded max-w-xs truncate block" dir="ltr">
                  {sheetWebhookUrl(sc.token)}
                </code>
                <button
                  type="button"
                  onClick={() => copySheetUrl(sc.id, sc.token)}
                  className="text-sm bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded"
                >
                  {copiedId === sc.id ? 'تم النسخ' : 'نسخ الرابط'}
                </button>
              </div>

              <SheetAppsScript webhookUrl={sheetWebhookUrl(sc.token)} />
              <SheetMappingEditor connection={sc} />
            </li>
          ))}
        </ul>
      )}
      {/* Auto-Sync Modal */}
      {autoSyncModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setAutoSyncModal(null); setAutoSyncCopied(false); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">المزامنة التلقائية — Google Apps Script</h3>
              <button type="button" onClick={() => { setAutoSyncModal(null); setAutoSyncCopied(false); }} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-800 mb-2">خطوات التفعيل:</p>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>افتح الشيت المربوط</li>
                <li>من القائمة: Extensions &rarr; Apps Script</li>
                <li>احذف أي كود موجود والصق الكود أدناه</li>
                <li>اضغط Save (Ctrl+S)</li>
                <li>شغّل دالة installTrigger مرة واحدة (من القائمة Run)</li>
                <li>اقبل الصلاحيات المطلوبة</li>
                <li>خلاص! أي صف جديد هيتسحب تلقائي</li>
              </ol>
            </div>

            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs text-slate-500">الكود:</p>
              <button
                type="button"
                onClick={copyAutoSyncScript}
                className="text-sm bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded"
              >
                {autoSyncCopied ? 'تم النسخ ✓' : 'نسخ'}
              </button>
            </div>

            <textarea
              readOnly
              value={autoSyncModal.script}
              className="w-full h-64 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg p-3 resize-none focus:outline-none"
              dir="ltr"
            />

            <div className="mt-3 text-xs text-slate-500">
              <span className="font-medium">Webhook URL:</span>{' '}
              <code className="bg-slate-100 px-1 py-0.5 rounded" dir="ltr">{autoSyncModal.webhookUrl}</code>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => { setAutoSyncModal(null); setAutoSyncCopied(false); }}
                className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-600 text-sm"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
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

  // بوسطة
  const { data: bostaConfig, isLoading: loadingBosta } = useBostaConfig();
  const [bostaApiKey, setBostaApiKey] = useState('');
  const [bostaBaseUrl, setBostaBaseUrl] = useState('https://app.bosta.co/api/v2');
  const [bostaEnabled, setBostaEnabled] = useState(false);
  const [bostaCopied, setBostaCopied] = useState(false);

  const saveBostaToggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      await api.post('/bosta/config', { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bosta-config'] });
    },
  });

  const saveBostaMutation = useMutation({
    mutationFn: async (body: { apiKey?: string; baseUrl?: string }) => {
      await api.post('/bosta/config', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bosta-config'] });
    },
  });

  React.useEffect(() => {
    if (bostaConfig) {
      setBostaBaseUrl(bostaConfig.baseUrl || 'https://app.bosta.co/api/v2');
      setBostaEnabled(bostaConfig.enabled);
    }
  }, [bostaConfig]);

  const saveWooMutation = useMutation({
    mutationFn: async (body: { baseUrl: string; consumerKey: string; consumerSecret: string }) => {
      await api.post('/woocommerce/config', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['woocommerce-status'] });
      queryClient.invalidateQueries({ queryKey: ['woocommerce-config'] });
    },
  });

  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    unmatched: Array<{ wcId: number; phone: string; reason: string }>;
  } | null>(null);

  const importOrdersMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/woocommerce/import-orders', { after: '2026-01-01T00:00:00' });
      return data as { imported: number; skipped: number; unmatched: Array<{ wcId: number; phone: string; reason: string }> };
    },
    onSuccess: (data) => setImportResult(data),
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
      <h1 className="text-2xl font-bold text-slate-800">الربط والتكامل</h1>

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

            {wooConfig?.configured && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h3 className="text-md font-semibold text-slate-700 mb-2">استيراد الطلبات من ووكومرس</h3>
                <p className="text-slate-500 text-sm mb-3">
                  جلب الطلبات من ووكومرس (من بداية 2026) وربطها بالليدز الموجودين حسب رقم الهاتف.
                </p>
                <button
                  type="button"
                  onClick={() => { setImportResult(null); importOrdersMutation.mutate(); }}
                  disabled={importOrdersMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
                >
                  {importOrdersMutation.isPending ? 'جاري الاستيراد...' : 'استيراد طلبات ووكومرس'}
                </button>

                {importOrdersMutation.isError && (
                  <p className="text-red-600 text-sm mt-2">
                    {(importOrdersMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                      (importOrdersMutation.error as Error)?.message || 'فشل الاستيراد'}
                  </p>
                )}

                {importResult && (
                  <div className="mt-3 space-y-2">
                    <p className="text-green-600 text-sm">
                      تم استيراد {importResult.imported} طلب، تخطي {importResult.skipped} (مستورد مسبقاً)
                    </p>
                    {importResult.unmatched.length > 0 && (
                      <details className="text-sm">
                        <summary className="text-amber-600 cursor-pointer">
                          {importResult.unmatched.length} طلب لم يتم ربطه
                        </summary>
                        <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto bg-slate-50 rounded p-2">
                          {importResult.unmatched.map((u) => (
                            <li key={u.wcId} className="text-slate-600">
                              WC #{u.wcId} — {u.phone || 'بدون رقم'} — {u.reason === 'no_lead' ? 'لا يوجد ليد' : u.reason === 'no_items' ? 'بدون منتجات' : 'رقم غير صالح'}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* بوسطة للشحن */}
      <section className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-2">بوسطة للشحن</h2>
        <p className="text-slate-600 text-sm mb-4">
          ربط الطلبات مع شركة بوسطة للشحن. عند تأكيد الطلب من الحسابات، يتم رفع الشحنة تلقائياً لبوسطة.
        </p>
        {loadingBosta ? (
          <p className="text-slate-500">جاري التحميل...</p>
        ) : (
          <>
            {/* حالة الاتصال + زرار التفعيل */}
            <div className="flex items-center gap-3 mb-4">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                  !bostaEnabled
                    ? 'bg-slate-100 text-slate-600'
                    : bostaConfig?.configured
                    ? 'bg-green-100 text-green-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${
                  !bostaEnabled ? 'bg-slate-400' : bostaConfig?.configured ? 'bg-green-500' : 'bg-amber-500'
                }`} />
                {!bostaEnabled ? 'معطّل' : bostaConfig?.configured ? 'متصل ومفعّل' : 'غير مضبوط'}
              </span>
              {bostaConfig?.source === 'env' && bostaConfig?.configured && (
                <span className="text-slate-500 text-sm">(من متغيرات البيئة)</span>
              )}
            </div>

            {/* Toggle تفعيل/إيقاف */}
            <div className="flex items-center gap-3 mb-5">
              <button
                type="button"
                role="switch"
                aria-checked={bostaEnabled}
                onClick={() => {
                  const next = !bostaEnabled;
                  setBostaEnabled(next);
                  saveBostaToggleMutation.mutate(next);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  bostaEnabled ? 'bg-green-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    bostaEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm text-slate-700">
                {bostaEnabled ? 'رفع الشحنات لبوسطة مفعّل' : 'رفع الشحنات لبوسطة معطّل'}
              </span>
            </div>

            {/* فورم الإعدادات */}
            <form
              className="space-y-3 max-w-xl"
              onSubmit={(e) => {
                e.preventDefault();
                saveBostaMutation.mutate({
                  apiKey: bostaApiKey.trim() || undefined,
                  baseUrl: bostaBaseUrl.trim() || undefined,
                });
              }}
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">API Key</label>
                <input
                  type="password"
                  value={bostaApiKey}
                  onChange={(e) => setBostaApiKey(e.target.value)}
                  placeholder={bostaConfig?.apiKeyMasked || 'أدخل مفتاح API من بوسطة'}
                  className="border border-slate-300 rounded-lg px-3 py-2 w-full"
                  autoComplete="off"
                />
                {bostaConfig?.apiKeyMasked && !bostaApiKey && (
                  <p className="text-xs text-slate-500 mt-1">اتركه فارغاً للإبقاء على القيمة الحالية</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Base URL</label>
                <input
                  type="url"
                  value={bostaBaseUrl}
                  onChange={(e) => setBostaBaseUrl(e.target.value)}
                  placeholder="https://app.bosta.co/api/v2"
                  className="border border-slate-300 rounded-lg px-3 py-2 w-full"
                />
              </div>
              <button
                type="submit"
                disabled={
                  (!bostaApiKey.trim() && !bostaBaseUrl.trim()) ||
                  saveBostaMutation.isPending
                }
                className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-600 disabled:opacity-50"
              >
                {saveBostaMutation.isPending ? 'جاري الحفظ...' : 'حفظ إعدادات بوسطة'}
              </button>
              {saveBostaMutation.isError && (
                <p className="text-red-600 text-sm">
                  {(() => {
                    const e = saveBostaMutation.error as { response?: { data?: { error?: string }; status?: number } };
                    const apiError = e?.response?.data?.error;
                    if (typeof apiError === 'string') return apiError;
                    return (saveBostaMutation.error as Error)?.message || 'حدث خطأ';
                  })()}
                </p>
              )}
              {saveBostaMutation.isSuccess && <p className="text-green-600 text-sm">تم الحفظ.</p>}
            </form>

            {/* Webhook URL للنسخ */}
            {bostaConfig?.webhookUrl && (
              <div className="mt-5 pt-5 border-t border-slate-200">
                <h3 className="text-md font-semibold text-slate-700 mb-2">رابط الـ Webhook</h3>
                <p className="text-slate-500 text-sm mb-2">
                  انسخ هذا الرابط وأضفه في إعدادات الـ Webhook في Dashboard بوسطة لاستقبال تحديثات الشحنات.
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-slate-100 px-3 py-2 rounded flex-1 truncate">
                    {bostaConfig.webhookUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(bostaConfig.webhookUrl);
                      setBostaCopied(true);
                      setTimeout(() => setBostaCopied(false), 2000);
                    }}
                    className="text-sm bg-slate-200 hover:bg-slate-300 px-3 py-2 rounded whitespace-nowrap"
                  >
                    {bostaCopied ? 'تم النسخ' : 'نسخ'}
                  </button>
                </div>
              </div>
            )}
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

      {/* Google Sheets */}
      <GoogleSheetsSection />
    </div>
  );
}
