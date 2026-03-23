import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrderForms, createOrderForm, updateOrderForm, deleteOrderForm } from '../services/marketing-api';

interface FieldDef {
  label: string;
  fieldName: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'textarea' | 'number';
  required: boolean;
  leadField: 'name' | 'phone' | 'email' | 'address' | 'whatsapp' | 'custom';
  options: string;
}

interface FormTemplate {
  name: string;
  slug: string;
  paymentMethods: string[];
  fields: FieldDef[];
}

const EMPTY_FIELD: FieldDef = {
  label: '',
  fieldName: '',
  type: 'text',
  required: false,
  leadField: 'custom',
  options: '',
};

const EMPTY_FORM: FormTemplate = {
  name: '',
  slug: '',
  paymentMethods: ['cod'],
  fields: [{ ...EMPTY_FIELD }],
};

const FIELD_TYPES = [
  { value: 'text', label: 'نص' },
  { value: 'email', label: 'بريد إلكتروني' },
  { value: 'tel', label: 'هاتف' },
  { value: 'select', label: 'قائمة منسدلة' },
  { value: 'textarea', label: 'نص طويل' },
  { value: 'number', label: 'رقم' },
];

const LEAD_FIELDS = [
  { value: 'name', label: 'الاسم' },
  { value: 'phone', label: 'الهاتف' },
  { value: 'email', label: 'البريد' },
  { value: 'address', label: 'العنوان' },
  { value: 'whatsapp', label: 'واتساب' },
  { value: 'custom', label: 'مخصص' },
];

export default function OrderForms() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormTemplate>({ ...EMPTY_FORM });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['order-forms'],
    queryFn: () => getOrderForms(),
  });

  const forms: any[] = data?.data?.templates ?? data?.data?.orderForms ?? [];

  const [saveError, setSaveError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: any) => createOrderForm(data),
    onSuccess: () => {
      setSaveError('');
      qc.invalidateQueries({ queryKey: ['order-forms'] });
      closeModal();
    },
    onError: (err: any) => setSaveError(err.response?.data?.error || err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateOrderForm(id, data),
    onSuccess: () => {
      setSaveError('');
      qc.invalidateQueries({ queryKey: ['order-forms'] });
      closeModal();
    },
    onError: (err: any) => setSaveError(err.response?.data?.error || err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteOrderForm(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order-forms'] });
      setDeleteConfirm(null);
    },
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM, fields: [{ ...EMPTY_FIELD }] });
  };

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, fields: [{ ...EMPTY_FIELD }] });
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (item: any) => {
    setForm({
      name: item.name,
      slug: item.slug,
      paymentMethods: item.paymentMethods ?? ['cod'],
      fields: (item.fields ?? []).map((f: any) => ({
        label: f.label ?? '',
        fieldName: f.fieldName ?? '',
        type: f.type ?? 'text',
        required: f.required ?? false,
        leadField: f.leadField ?? 'custom',
        options: f.options ?? '',
      })),
    });
    setEditingId(item.id);
    setModalOpen(true);
  };

  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^\w\u0600-\u06FF\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      || `form-${Date.now().toString(36)}`;
    setForm((prev) => ({ ...prev, name, slug }));
  };

  const updateField = (index: number, updates: Partial<FieldDef>) => {
    setForm((prev) => ({
      ...prev,
      fields: prev.fields.map((f, i) => (i === index ? { ...f, ...updates } : f)),
    }));
  };

  const removeField = (index: number) => {
    setForm((prev) => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index),
    }));
  };

  const addField = () => {
    setForm((prev) => ({
      ...prev,
      fields: [...prev.fields, { ...EMPTY_FIELD }],
    }));
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name,
      slug: form.slug || form.name.toLowerCase().replace(/\s+/g, '-'),
      paymentMethods: form.paymentMethods,
      fields: form.fields.map((f, i) => ({ ...f, orderNum: i })),
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">نماذج الشراء</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          إنشاء نموذج جديد
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <p className="text-sm text-slate-400 text-center py-12">جاري التحميل...</p>
      ) : forms.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <p className="text-slate-400 mb-4">لا توجد نماذج بعد</p>
          <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            إنشاء أول نموذج
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((item: any) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => openEdit(item)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-800">{item.name}</h3>
                  <p className="text-xs text-slate-400 font-mono" dir="ltr">{item.slug}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(item.id);
                  }}
                  className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                <span>{(item.fields ?? []).length} حقل</span>
              </div>

              <div className="flex flex-wrap gap-1">
                {(item.paymentMethods ?? []).map((pm: string) => (
                  <span key={pm} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                    {pm === 'cod' ? 'الدفع عند الاستلام' : pm}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">تأكيد الحذف</h3>
            <p className="text-sm text-slate-600 mb-4">هل أنت متأكد من حذف هذا النموذج؟</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'جاري الحذف...' : 'حذف'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-8" onClick={closeModal}>
          <div
            className="bg-white rounded-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingId ? 'تعديل النموذج' : 'إنشاء نموذج جديد'}
              </h2>
            </div>

            <div className="p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">اسم النموذج</label>
                <input
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="مثال: نموذج طلب المنتج"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Slug</label>
                <input
                  value={form.slug}
                  onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="product-order-form"
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                  dir="ltr"
                />
              </div>

              {/* Payment Methods */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">طرق الدفع</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.paymentMethods.includes('cod')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setForm((prev) => ({ ...prev, paymentMethods: [...prev.paymentMethods, 'cod'] }));
                      } else {
                        setForm((prev) => ({ ...prev, paymentMethods: prev.paymentMethods.filter((m) => m !== 'cod') }));
                      }
                    }}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-700">الدفع عند الاستلام</span>
                </label>
              </div>

              {/* Fields */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">الحقول</label>
                <div className="space-y-3">
                  {form.fields.map((field, index) => (
                    <div key={index} className="border border-slate-200 rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">حقل {index + 1}</span>
                        <button
                          onClick={() => removeField(index)}
                          className="p-1 text-slate-400 hover:text-red-500"
                          disabled={form.fields.length <= 1}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {/* Label */}
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">العنوان</label>
                          <input
                            value={field.label}
                            onChange={(e) => updateField(index, { label: e.target.value })}
                            placeholder="الاسم الكامل"
                            className="w-full border rounded-lg px-2 py-1.5 text-sm"
                          />
                        </div>

                        {/* Field Name */}
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">اسم الحقل (HTML)</label>
                          <input
                            value={field.fieldName}
                            onChange={(e) => updateField(index, { fieldName: e.target.value })}
                            placeholder="full_name"
                            className="w-full border rounded-lg px-2 py-1.5 text-sm font-mono"
                            dir="ltr"
                          />
                        </div>

                        {/* Type */}
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">النوع</label>
                          <select
                            value={field.type}
                            onChange={(e) => updateField(index, { type: e.target.value as FieldDef['type'] })}
                            className="w-full border rounded-lg px-2 py-1.5 text-sm"
                          >
                            {FIELD_TYPES.map((ft) => (
                              <option key={ft.value} value={ft.value}>{ft.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* Lead Field */}
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">حقل الليد</label>
                          <select
                            value={field.leadField}
                            onChange={(e) => updateField(index, { leadField: e.target.value as FieldDef['leadField'] })}
                            className="w-full border rounded-lg px-2 py-1.5 text-sm"
                          >
                            {LEAD_FIELDS.map((lf) => (
                              <option key={lf.value} value={lf.value}>{lf.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* Required */}
                        <div className="flex items-end pb-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => updateField(index, { required: e.target.checked })}
                              className="rounded border-slate-300"
                            />
                            <span className="text-sm text-slate-700">مطلوب</span>
                          </label>
                        </div>
                      </div>

                      {/* Options (only for select) */}
                      {field.type === 'select' && (
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">الخيارات</label>
                          <input
                            value={field.options}
                            onChange={(e) => updateField(index, { options: e.target.value })}
                            placeholder="قيم مفصولة بفاصلة"
                            className="w-full border rounded-lg px-2 py-1.5 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={addField}
                  className="mt-3 px-4 py-2 text-sm border border-dashed border-slate-300 text-slate-500 rounded-lg hover:border-blue-400 hover:text-blue-600 w-full"
                >
                  + إضافة حقل
                </button>
              </div>
            </div>

            {saveError && (
              <div className="mx-6 mb-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{saveError}</div>
            )}

            {/* Footer */}
            <div className="p-6 border-t border-slate-200 flex gap-2 justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || isSaving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
