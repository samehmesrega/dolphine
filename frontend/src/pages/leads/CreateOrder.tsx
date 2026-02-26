import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

// ============ بيانات المحافظات والمدن ============
const EGYPT_GOVERNORATES: Record<string, string[]> = {
  'القاهرة': ['وسط البلد', 'مدينة نصر', 'النزهة', 'العباسية', 'حلوان', 'المعادي', 'المقطم', 'مصر الجديدة', 'مصر القديمة', 'شبرا', 'الزيتون', 'عين شمس', 'التجمع الخامس', 'الشروق', 'بولاق', 'الأميرية', 'عزبة النخل', 'الزاوية الحمراء', 'السلام', 'المرج', 'منشية ناصر', 'الموسكي', 'روض الفرج'],
  'الجيزة': ['الجيزة', '6 أكتوبر', 'الشيخ زايد', 'إمبابة', 'فيصل', 'الهرم', 'العجوزة', 'الدقي', 'المنيب', 'الحوامدية', 'البدرشين', 'الصف', 'أوسيم', 'كرداسة', 'بولاق الدكرور'],
  'الإسكندرية': ['وسط الإسكندرية', 'المنتزه', 'العجمي', 'العامرية', 'برج العرب', 'سيدي جابر', 'سيدي بشر', 'كامب شيزار', 'المكس', 'الدخيلة', 'أبو قير', 'الأنفوشي', 'باب شرق', 'محرم بك', 'سموحة', 'ميامي', 'الإبراهيمية'],
  'الدقهلية': ['المنصورة', 'طلخا', 'ميت غمر', 'دكرنس', 'أجا', 'المنزلة', 'بلقاس', 'شربين', 'تمي الأمديد', 'السنبلاوين', 'نبروه', 'منية النصر'],
  'البحر الأحمر': ['الغردقة', 'رأس غارب', 'سفاجا', 'القصير', 'مرسى علم', 'الشلاتين'],
  'البحيرة': ['دمنهور', 'كفر الدوار', 'رشيد', 'أبو المطامير', 'شبراخيت', 'إيتاي البارود', 'المحمودية', 'حوش عيسى', 'وادي النطرون', 'أبو حمص'],
  'الفيوم': ['الفيوم', 'سنورس', 'إطسا', 'طامية', 'يوسف الصديق', 'أبشواي'],
  'الغربية': ['طنطا', 'المحلة الكبرى', 'كفر الزيات', 'زفتى', 'السنطة', 'بسيون', 'قطور'],
  'الإسماعيلية': ['الإسماعيلية', 'القنطرة', 'أبو صوير', 'فايد', 'القصاصين'],
  'المنوفية': ['شبين الكوم', 'مينوف', 'تلا', 'الشهداء', 'قويسنا', 'بركة السبع', 'أشمون', 'الباجور'],
  'المنيا': ['المنيا', 'ملوي', 'مغاغة', 'بني مزار', 'أبو قرقاص', 'سمالوط', 'دير مواس', 'العدوة', 'مطاي'],
  'القليوبية': ['بنها', 'شبين القناطر', 'قليوب', 'الخانكة', 'القناطر الخيرية', 'طوخ', 'كفر شكر', 'العبور'],
  'الوادي الجديد': ['الخارجة', 'الداخلة', 'الفرافرة', 'بريس', 'موط'],
  'السويس': ['السويس', 'الأربعين', 'عتاقة', 'الجناين'],
  'أسوان': ['أسوان', 'كوم أمبو', 'إدفو', 'نصر النوبة', 'دراو', 'أبو سمبل'],
  'أسيوط': ['أسيوط', 'ديروط', 'منفلوط', 'القوصية', 'أبنوب', 'صدفا', 'البداري', 'الغنايم'],
  'بني سويف': ['بني سويف', 'الفشن', 'ناصر', 'إهناسيا', 'ببا', 'سمسطا', 'الواسطى'],
  'بورسعيد': ['بورسعيد', 'بورفؤاد', 'الضواحي', 'العرب'],
  'دمياط': ['دمياط', 'رأس البر', 'الزرقا', 'فارسكور', 'كفر سعد', 'عزبة البرج'],
  'الشرقية': ['الزقازيق', 'العاشر من رمضان', 'منيا القمح', 'فاقوس', 'بلبيس', 'كفر صقر', 'أبو حماد', 'ديرب نجم', 'أبو كبير', 'مشتول السوق'],
  'جنوب سيناء': ['الطور', 'شرم الشيخ', 'دهب', 'نويبع', 'طابا', 'أبو زنيمة', 'أبو رديس', 'رأس سدر'],
  'كفر الشيخ': ['كفر الشيخ', 'دسوق', 'فوه', 'سيدي سالم', 'بيلا', 'مطوبس', 'الحامول', 'الرياض'],
  'مرسى مطروح': ['مرسى مطروح', 'سيوة', 'سيدي براني', 'الضبعة', 'العلمين', 'النجيلة'],
  'الأقصر': ['الأقصر', 'أرمنت', 'إسنا', 'البياضية', 'القرنة', 'الزينية'],
  'قنا': ['قنا', 'نجع حمادي', 'دشنا', 'قوص', 'فرشوط', 'أبو تشت', 'الوقف'],
  'شمال سيناء': ['العريش', 'رفح', 'الشيخ زويد', 'بئر العبد', 'الحسنة', 'نخل'],
  'سوهاج': ['سوهاج', 'طهطا', 'طما', 'أخميم', 'المنشاة', 'جرجا', 'البلينا', 'دار السلام', 'ساقلته'],
};

const GOVERNORATE_LIST = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'الشرقية', 'القليوبية', 'الغربية',
  'البحر الأحمر', 'البحيرة', 'دمياط', 'المنوفية', 'أسيوط', 'كفر الشيخ', 'الإسماعيلية',
  'المنيا', 'الفيوم', 'بني سويف', 'قنا', 'أسوان', 'السويس', 'سوهاج', 'بورسعيد',
  'مرسى مطروح', 'الأقصر', 'جنوب سيناء', 'الوادي الجديد', 'شمال سيناء',
];

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

  const [discount, setDiscount] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [partialAmount, setPartialAmount] = useState<number | ''>('');
  const [customPartial, setCustomPartial] = useState(false);

  const orderTotal = items.reduce((sum, it) => sum + it.quantity * it.price, 0);
  const remaining =
    orderTotal - discount - (typeof partialAmount === 'number' ? partialAmount : 0);

  // المدن المتاحة حسب المحافظة المختارة
  const availableCities = shipping.governorate
    ? (EGYPT_GOVERNORATES[shipping.governorate] ?? [])
    : [];

  const { data: lead, isLoading: leadLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => fetchLead(id!),
    enabled: !!id,
  });

  const { data: products } = useQuery({ queryKey: ['products'], queryFn: fetchProducts });

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

  // عند تغيير المحافظة امسح المدينة
  const handleGovernoraChange = (val: string) => {
    setShipping((p) => ({ ...p, governorate: val, city: '' }));
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
    if (shipping.governorate) fd.append('shippingGovernorate', shipping.governorate);
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
        <Link to="/leads" className="text-blue-600 mt-2 inline-block">← ليدز</Link>
      </div>
    );
  }

  if (leadLoading || !lead) {
    return <div className="p-4 text-slate-500">جاري التحميل...</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/leads/${id}`} className="text-slate-600 hover:text-slate-800">← تفاصيل الليد</Link>
        <h1 className="text-2xl font-bold text-slate-800">إنشاء طلب من الليد</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">

        {/* بيانات الشحن */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-slate-700 mb-4">بيانات الشحن</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* الاسم */}
            <div>
              <label className="block text-sm text-slate-600 mb-1">الاسم</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={shipping.name}
                onChange={(e) => setShipping((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>

            {/* رقم الموبايل */}
            <div>
              <label className="block text-sm text-slate-600 mb-1">رقم الموبايل</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={shipping.phone}
                onChange={(e) => setShipping((p) => ({ ...p, phone: e.target.value }))}
                required
              />
            </div>

            {/* المحافظة */}
            <div>
              <label className="block text-sm text-slate-600 mb-1">المحافظة</label>
              <select
                className="w-full border rounded-lg px-3 py-2 bg-white"
                value={shipping.governorate}
                onChange={(e) => handleGovernoraChange(e.target.value)}
              >
                <option value="">— اختر المحافظة —</option>
                {GOVERNORATE_LIST.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* المدينة / المنطقة */}
            <div>
              <label className="block text-sm text-slate-600 mb-1">المدينة / المنطقة</label>
              {availableCities.length > 0 ? (
                <>
                  <input
                    list="cities-datalist"
                    className="w-full border rounded-lg px-3 py-2"
                    value={shipping.city}
                    onChange={(e) => setShipping((p) => ({ ...p, city: e.target.value }))}
                    placeholder="اختر أو اكتب المدينة"
                  />
                  <datalist id="cities-datalist">
                    {availableCities.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </>
              ) : (
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={shipping.city}
                  onChange={(e) => setShipping((p) => ({ ...p, city: e.target.value }))}
                  placeholder={shipping.governorate ? 'اكتب المدينة' : 'اختر المحافظة أولاً'}
                  disabled={!shipping.governorate}
                />
              )}
            </div>

            {/* العنوان التفصيلي */}
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-600 mb-1">العنوان التفصيلي</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={shipping.addressDetail}
                onChange={(e) => setShipping((p) => ({ ...p, addressDetail: e.target.value }))}
                placeholder="الشارع / العمارة / الدور..."
              />
            </div>

          </div>
        </div>

        {/* عناصر الطلب */}
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
                        <option key={p.id} value={p.id}>{p.name}</option>
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

          {/* ملخص الإجمالي */}
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

          {/* الخصم */}
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

        {/* الدفع */}
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
                      onClick={() => { setPartialAmount(amt); setCustomPartial(false); }}
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
                    onClick={() => { setCustomPartial(true); setPartialAmount(''); }}
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
                    المدفوع: <span className="font-medium text-green-700">{partialAmount.toLocaleString()} ج.م</span>
                    {' · '}
                    الباقي: <span className="font-medium text-amber-700">{Math.max(0, remaining).toLocaleString()} ج.م</span>
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
          <Link to="/orders" className="mr-2 text-green-700 underline">عرض الطلبات</Link>
        </div>
      )}
    </div>
  );
}
