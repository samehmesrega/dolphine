import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

type Lead = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  customerId: string | null;
};

type Product = {
  id: string;
  name: string;
  variations?: unknown;
};

type OrderItemInput = {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  notes: string;
};

type GeoSuggestion = {
  governorate: string;
  city: string;
};

async function fetchLead(id: string) {
  const { data } = await api.get(`/leads/${id}`);
  return data.lead as Lead;
}

async function fetchProducts() {
  const { data } = await api.get('/products');
  return data.products as Product[];
}

async function createOrder(formData: FormData) {
  const { data } = await api.post('/orders', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.order;
}

async function geocodeAddress(query: string): Promise<GeoSuggestion | null> {
  if (!query.trim() || query.trim().length < 4) return null;
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(query + ' مصر')}&countrycodes=eg&format=json&addressdetails=1&limit=3&accept-language=ar`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Dolphin-CRM/1.0' },
    });
    if (!res.ok) return null;
    const results = await res.json();
    if (!results || results.length === 0) return null;
    const addr = results[0].address ?? {};
    const governorate = addr.state || addr.county || '';
    const city =
      addr.city || addr.town || addr.village || addr.suburb || addr.county || '';
    if (!governorate && !city) return null;
    return { governorate, city };
  } catch {
    return null;
  }
}

export default function CreateOrderPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [error, setError] = useState('');

  const [shipping, setShipping] = useState({
    name: '',
    phone: '',
    governorate: '',
    city: '',
    addressDetail: '',
  });
  const [notes, setNotes] = useState('');
  const [paymentType, setPaymentType] = useState<'full' | 'partial'>('full');
  const [items, setItems] = useState<OrderItemInput[]>([
    { productId: '', productName: '', quantity: 1, price: 0, notes: '' },
  ]);
  const [transferFile, setTransferFile] = useState<File | null>(null);

  // Discount / partial
  const [discount, setDiscount] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [partialAmount, setPartialAmount] = useState<number | ''>('');
  const [customPartial, setCustomPartial] = useState(false);

  // Geo suggestion state
  const [geoSuggestion, setGeoSuggestion] = useState<GeoSuggestion | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Computed totals
  const orderTotal = items.reduce((sum, it) => sum + it.quantity * it.price, 0);
  const remaining =
    orderTotal - discount - (typeof partialAmount === 'number' ? partialAmount : 0);

  const { data: lead, isLoading: leadLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => fetchLead(id!),
    enabled: !!id,
  });

  const { data: products } = useQuery({ queryKey: ['products'], queryFn: fetchProducts });

  // Auto-fill from lead on load
  useEffect(() => {
    if (lead?.name) {
      setShipping((p) => ({
        ...p,
        name: lead.name,
        phone: lead.phone,
        addressDetail: lead.address || '',
      }));
    }
  }, [lead?.id]);

  // Geocode when addressDetail changes (debounced 800ms)
  const handleAddressChange = (value: string) => {
    setShipping((p) => ({ ...p, addressDetail: value }));
    setGeoSuggestion(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim() || value.trim().length < 5) return;
    debounceRef.current = setTimeout(async () => {
      setGeoLoading(true);
      const suggestion = await geocodeAddress(value);
      setGeoLoading(false);
      if (suggestion) setGeoSuggestion(suggestion);
    }, 800);
  };

  // Accept suggestion chips
  const acceptGovernorate = () => {
    if (geoSuggestion?.governorate) {
      setShipping((p) => ({ ...p, governorate: geoSuggestion.governorate }));
    }
  };
  const acceptCity = () => {
    if (geoSuggestion?.city) {
      setShipping((p) => ({ ...p, city: geoSuggestion.city }));
    }
  };

  const createMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', id] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'فشل إنشاء الطلب');
    },
  });

  const addItem = () => {
    setItems((p) => [...p, { productId: '', productName: '', quantity: 1, price: 0, notes: '' }]);
  };

  const updateItem = (index: number, field: keyof OrderItemInput, value: string | number) => {
    setItems((p) => {
      const next = [...p];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((p) => p.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const fd = new FormData();
    fd.append('leadId', id!);
    fd.append('shippingName', shipping.name.trim());
    fd.append('shippingPhone', shipping.phone.trim());
    if (shipping.governorate.trim()) fd.append('shippingGovernorate', shipping.governorate.trim());
    if (shipping.city.trim()) fd.append('shippingCity', shipping.city.trim());
    if (shipping.addressDetail.trim()) fd.append('shippingAddress', shipping.addressDetail.trim());
    fd.append('notes', notes.trim());
    fd.append('paymentType', paymentType);
    const validItems = items
      .map((it) => ({
        productId: it.productId || undefined,
        productName: it.productName.trim() || undefined,
        quantity: it.quantity,
        price: Number(it.price),
        notes: it.notes.trim() || undefined,
      }))
      .filter((it) => (it.productId || it.productName) && it.quantity >= 1 && it.price >= 0);
    if (validItems.length === 0) {
      setError('أضف صنف واحد على الأقل');
      return;
    }
    fd.append('items', JSON.stringify(validItems));
    if (transferFile) fd.append('transferImage', transferFile);
    fd.append('discount', String(discount));
    if (discountReason.trim()) fd.append('discountReason', discountReason.trim());
    if (paymentType === 'partial' && typeof partialAmount === 'number') {
      fd.append('partialAmount', String(partialAmount));
    }
    createMutation.mutate(fd);
  };

  if (!id) {
    return (
      <div className="p-4">
        <p className="text-slate-500">معرف الليد غير صالح.</p>
        <Link to="/leads" className="text-blue-600 mt-2 inline-block">
          ← ليدز
        </Link>
      </div>
    );
  }

  if (leadLoading || !lead) {
    return <div className="p-4 text-slate-500">جاري التحميل...</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/leads/${id}`} className="text-slate-600 hover:text-slate-800">
          ← تفاصيل الليد
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">إنشاء طلب من الليد</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        {/* Shipping section */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-slate-700 mb-4">بيانات الشحن</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-sm text-slate-600 mb-1">الاسم</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={shipping.name}
                onChange={(e) => setShipping((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            {/* Phone */}
            <div>
              <label className="block text-sm text-slate-600 mb-1">رقم الموبايل</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={shipping.phone}
                onChange={(e) => setShipping((p) => ({ ...p, phone: e.target.value }))}
                required
              />
            </div>

            {/* Governorate */}
            <div>
              <label className="block text-sm text-slate-600 mb-1">المحافظة</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={shipping.governorate}
                onChange={(e) => setShipping((p) => ({ ...p, governorate: e.target.value }))}
                placeholder="مثال: القاهرة"
              />
              {geoSuggestion?.governorate && shipping.governorate !== geoSuggestion.governorate && (
                <button
                  type="button"
                  onClick={acceptGovernorate}
                  className="mt-1 inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 hover:bg-blue-100 transition"
                >
                  <span>اقتراح:</span>
                  <span className="font-medium">{geoSuggestion.governorate}</span>
                  <span className="text-blue-400">← اضغط للقبول</span>
                </button>
              )}
            </div>

            {/* City */}
            <div>
              <label className="block text-sm text-slate-600 mb-1">المدينة / المنطقة</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={shipping.city}
                onChange={(e) => setShipping((p) => ({ ...p, city: e.target.value }))}
                placeholder="مثال: وسط البلد"
              />
              {geoSuggestion?.city && shipping.city !== geoSuggestion.city && (
                <button
                  type="button"
                  onClick={acceptCity}
                  className="mt-1 inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 hover:bg-blue-100 transition"
                >
                  <span>اقتراح:</span>
                  <span className="font-medium">{geoSuggestion.city}</span>
                  <span className="text-blue-400">← اضغط للقبول</span>
                </button>
              )}
            </div>

            {/* Address detail */}
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-600 mb-1">
                العنوان التفصيلي
                {geoLoading && (
                  <span className="mr-2 text-xs text-slate-400">جاري البحث في الخريطة...</span>
                )}
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={shipping.addressDetail}
                onChange={(e) => handleAddressChange(e.target.value)}
                placeholder="الشارع / العمارة / الدور..."
              />
              {geoSuggestion && (shipping.governorate !== geoSuggestion.governorate || shipping.city !== geoSuggestion.city) && (
                <p className="text-xs text-slate-400 mt-1">
                  تم العثور على اقتراح — اضغط على الشريط أعلاه لكل حقل لقبوله
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Order items */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-slate-700 mb-4">عناصر الطلب</h2>
          {items.map((item, index) => (
            <div key={index} className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-slate-50 rounded-lg">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs text-slate-500 mb-1">المنتج (أو اسم يدوي)</label>
                {products && products.length > 0 ? (
                  <>
                    <select
                      className="w-full border rounded px-2 py-2"
                      value={item.productId}
                      onChange={(e) => {
                        const pid = e.target.value;
                        const p = products.find((x) => x.id === pid);
                        updateItem(index, 'productId', pid);
                        if (p) updateItem(index, 'productName', p.name);
                      }}
                    >
                      <option value="">— اسم يدوي أدناه —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className="w-full border rounded px-2 py-2 mt-1"
                      placeholder="أو اكتب اسم المنتج"
                      value={item.productName}
                      onChange={(e) => updateItem(index, 'productName', e.target.value)}
                    />
                  </>
                ) : (
                  <input
                    className="w-full border rounded px-2 py-2"
                    placeholder="اسم المنتج"
                    value={item.productName}
                    onChange={(e) => updateItem(index, 'productName', e.target.value)}
                  />
                )}
              </div>
              <div className="w-20">
                <label className="block text-xs text-slate-500 mb-1">الكمية</label>
                <input
                  type="number"
                  min={1}
                  className="w-full border rounded px-2 py-2"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value, 10) || 1)}
                />
              </div>
              <div className="w-28">
                <label className="block text-xs text-slate-500 mb-1">السعر</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full border rounded px-2 py-2"
                  value={item.price}
                  onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="flex-1 min-w-[100px]">
                <label className="block text-xs text-slate-500 mb-1">ملاحظات</label>
                <input
                  className="w-full border rounded px-2 py-2"
                  value={item.notes}
                  onChange={(e) => updateItem(index, 'notes', e.target.value)}
                />
              </div>
              <button type="button" onClick={() => removeItem(index)} className="text-red-600 text-sm px-2 py-1">
                حذف
              </button>
            </div>
          ))}
          <button type="button" onClick={addItem} className="text-blue-600 text-sm border border-blue-600 rounded px-3 py-1">
            + إضافة صنف
          </button>

          {/* Order total summary */}
          <div className="bg-slate-50 border-t border-slate-200 mt-4 pt-4 px-2 space-y-1 text-sm text-slate-700">
            <div className="flex justify-between">
              <span>الإجمالي</span>
              <span className="font-medium">{orderTotal.toLocaleString()} ج.م</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>الخصم</span>
                <span className="font-medium">- {discount.toLocaleString()} ج.م</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-slate-800 border-t border-slate-200 pt-1 mt-1">
              <span>صافي الطلب</span>
              <span>{(orderTotal - discount).toLocaleString()} ج.م</span>
            </div>
          </div>

          {/* Discount fields */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-3 items-end">
            <div className="w-32">
              <label className="block text-xs text-slate-500 mb-1">الخصم (ج.م)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-slate-500 mb-1">سبب الخصم</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="مثال: عميل مميز"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Payment section */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-slate-700 mb-4">الدفع وصورة التحويل</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">نوع الدفع</label>
              <select
                className="border rounded-lg px-3 py-2"
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as 'full' | 'partial')}
              >
                <option value="full">دفع كامل</option>
                <option value="partial">دفع جزئي</option>
              </select>
            </div>

            {paymentType === 'partial' && (
              <div>
                <label className="block text-sm text-slate-600 mb-2">المبلغ المدفوع جزئياً</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {[60, 100, 150, 200].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setPartialAmount(amt);
                        setCustomPartial(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                        partialAmount === amt && !customPartial
                          ? 'bg-slate-700 text-white border-slate-700'
                          : 'border-slate-300 text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      {amt} ج.م
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setCustomPartial(true);
                      setPartialAmount('');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                      customPartial
                        ? 'bg-slate-700 text-white border-slate-700'
                        : 'border-slate-300 text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    مخصص
                  </button>
                </div>
                {customPartial && (
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-40"
                    placeholder="أدخل المبلغ"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(parseFloat(e.target.value) || 0)}
                  />
                )}
                {typeof partialAmount === 'number' && partialAmount > 0 && (
                  <p className="text-sm text-slate-600 mt-2">
                    المدفوع:{' '}
                    <span className="font-medium text-green-700">
                      {partialAmount.toLocaleString()} ج.م
                    </span>
                    {' · '}
                    الباقي:{' '}
                    <span className="font-medium text-amber-700">
                      {Math.max(0, remaining).toLocaleString()} ج.م
                    </span>
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm text-slate-600 mb-1">صورة التحويل (اختياري)</label>
              <input
                type="file"
                accept="image/*"
                className="w-full border rounded-lg px-3 py-2"
                onChange={(e) => setTransferFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">ملاحظات خاصة بالطلب</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 min-h-[80px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أي ملاحظات من العميل..."
              />
            </div>
          </div>
        </div>

        {error && <p className="text-red-600 bg-red-50 p-3 rounded">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'جاري الحفظ...' : 'إنشاء الطلب'}
          </button>
          <Link to={`/leads/${id}`} className="px-6 py-2 border rounded-lg text-slate-700">
            إلغاء
          </Link>
        </div>
      </form>

      {createMutation.isSuccess && (
        <div className="mt-6 p-4 bg-green-50 text-green-800 rounded-xl">
          تم إنشاء الطلب بنجاح. الطلب سيظهر في قسم «طلبات» وبانتظار تأكيد الحسابات.
          <Link to="/orders" className="mr-2 text-green-700 underline">
            عرض الطلبات
          </Link>
        </div>
      )}
    </div>
  );
}
