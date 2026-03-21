import { useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/context/AuthContext';
import * as kbApi from '../services/kb-api';

/* ─────────────── Constants ─────────────── */

const TABS = [
  { key: 'overview', label: 'نظرة عامة' },
  { key: 'media', label: 'الصور والفيديوهات' },
  { key: 'supply', label: 'التوريد والتصنيع' },
  { key: 'pricing', label: 'الأسعار والفاريشنز' },
  { key: 'marketing', label: 'التسويق' },
  { key: 'sales', label: 'المبيعات' },
  { key: 'aftersales', label: 'ما بعد البيع' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const CURRENCY_OPTIONS = ['EGP', 'USD', 'SAR', 'AED', 'EUR'];
const PRICE_TYPE_OPTIONS = [
  { value: 'wholesale', label: 'جملة' },
  { value: 'retail', label: 'تجزئة' },
  { value: 'offer', label: 'عرض' },
];

/* ─────────────── Shared Section Header ─────────────── */

function SectionHeader({
  title,
  canEdit,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  isSaving,
}: {
  title: string;
  canEdit: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onSave?: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      {canEdit && !isEditing && (
        <button
          onClick={onEdit}
          className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 text-sm"
        >
          تعديل
        </button>
      )}
      {isEditing && (
        <div className="flex gap-2">
          {onSave && (
            <button
              onClick={onSave}
              disabled={isSaving}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50"
            >
              {isSaving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          )}
          <button
            onClick={onCancel}
            className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-sm"
          >
            إلغاء
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Main Component ─────────────── */

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [editingSection, setEditingSection] = useState<string | null>(null);

  // Permissions
  const canEditMedia = hasPermission('kb.media.edit');
  const canEditManufacturing = hasPermission('kb.manufacturing.edit');
  const canEditPricing = hasPermission('kb.pricing.edit');
  const canEditMarketing = hasPermission('kb.marketing.edit');
  const canEditSales = hasPermission('kb.sales.edit');
  const canEditAftersales = hasPermission('kb.aftersales.edit');

  const { data, isLoading } = useQuery({
    queryKey: ['kb-product', id],
    queryFn: () => kbApi.getProduct(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="p-8 text-slate-500" dir="rtl">جاري التحميل...</div>;

  const product = data?.data?.product;
  if (!product) return <div className="p-8 text-red-500" dir="rtl">المنتج غير موجود</div>;

  const startEditing = (section: string) => setEditingSection(section);
  const stopEditing = () => setEditingSection(null);

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-800">{product.name}</h1>
            {product.sku && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-mono">
                {product.sku}
              </span>
            )}
            {product.category && (
              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs">
                {product.category}
              </span>
            )}
          </div>
          <Link to="/knowledge-base/products" className="text-sm text-slate-500 hover:text-emerald-600">
            العودة للمنتجات
          </Link>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-slate-200 bg-white rounded-t-xl">
        <nav className="flex overflow-x-auto -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); stopEditing(); }}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {activeTab === 'overview' && (
          <OverviewTab
            product={product}
            productId={id!}
            canEdit={hasPermission('kb.product.edit')}
            isEditing={editingSection === 'overview'}
            onEdit={() => startEditing('overview')}
            onCancel={stopEditing}
          />
        )}
        {activeTab === 'media' && (
          <MediaTab
            productId={id!}
            product={product}
            canEdit={canEditMedia}
            qc={qc}
            isEditing={editingSection === 'media'}
            onEdit={() => startEditing('media')}
            onCancel={stopEditing}
          />
        )}
        {activeTab === 'supply' && (
          <SupplyTab
            productId={id!}
            product={product}
            canEdit={canEditManufacturing}
            qc={qc}
            isEditing={editingSection === 'supply'}
            onEdit={() => startEditing('supply')}
            onCancel={stopEditing}
            onSaved={stopEditing}
          />
        )}
        {activeTab === 'pricing' && (
          <PricingTab
            productId={id!}
            product={product}
            canEdit={canEditPricing}
            qc={qc}
            isEditing={editingSection === 'pricing'}
            onEdit={() => startEditing('pricing')}
            onCancel={stopEditing}
          />
        )}
        {activeTab === 'marketing' && (
          <MarketingTab
            productId={id!}
            product={product}
            canEdit={canEditMarketing}
            qc={qc}
            isEditing={editingSection === 'marketing'}
            onEdit={() => startEditing('marketing')}
            onCancel={stopEditing}
            onSaved={stopEditing}
          />
        )}
        {activeTab === 'sales' && (
          <SalesTab
            productId={id!}
            product={product}
            canEdit={canEditSales}
            qc={qc}
            isEditing={editingSection === 'sales'}
            onEdit={() => startEditing('sales')}
            onCancel={stopEditing}
          />
        )}
        {activeTab === 'aftersales' && (
          <AfterSalesTab
            productId={id!}
            product={product}
            canEdit={canEditAftersales}
            qc={qc}
            isEditing={editingSection === 'aftersales'}
            onEdit={() => startEditing('aftersales')}
            onCancel={stopEditing}
            onSaved={stopEditing}
          />
        )}
      </div>
    </div>
  );
}

/* ─────────────── Shared ReadOnly Field ─────────────── */

function ReadOnlyField({ label, value, mono, dir: fieldDir }: { label: string; value: any; mono?: boolean; dir?: string }) {
  return (
    <div>
      <span className="block text-sm text-slate-500 mb-1">{label}</span>
      <p className={`text-sm text-slate-800 ${mono ? 'font-mono' : ''}`} dir={fieldDir}>
        {value || '-'}
      </p>
    </div>
  );
}

/* ─────────────── Tab 1: Overview ─────────────── */

function OverviewTab({
  product,
  productId,
  canEdit,
  isEditing: _isEditing,
  onEdit: _onEdit,
  onCancel: _onCancel,
}: {
  product: any;
  productId: string;
  canEdit: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const navigate = useNavigate();

  const handleEdit = () => {
    // Navigate to the ProductForm page for editing overview
    navigate(`/knowledge-base/products/${productId}/edit`);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="معلومات المنتج"
        canEdit={canEdit}
        isEditing={false}
        onEdit={handleEdit}
        onCancel={_onCancel}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ReadOnlyField label="الاسم" value={product.name} />
        <ReadOnlyField label="SKU" value={product.sku} mono />
        <ReadOnlyField label="الفئة" value={product.category} />
        <ReadOnlyField label="الأبعاد" value={product.dimensions} />
        <ReadOnlyField label="الوزن" value={product.weight != null ? `${product.weight} كجم` : null} />
        <div>
          <span className="block text-sm text-slate-500 mb-1">مجلد Drive</span>
          {product.driveFolderUrl ? (
            <a
              href={product.driveFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-emerald-600 hover:underline break-all"
              dir="ltr"
            >
              {product.driveFolderUrl}
            </a>
          ) : (
            <p className="text-sm text-slate-400">-</p>
          )}
        </div>
      </div>

      {product.description && (
        <div>
          <span className="block text-sm text-slate-500 mb-1">الوصف</span>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{product.description}</p>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Tab 2: Media ─────────────── */

function MediaTab({
  productId,
  product,
  canEdit,
  qc,
  isEditing,
  onEdit,
  onCancel,
}: {
  productId: string;
  product: any;
  canEdit: boolean;
  qc: any;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaItems: any[] = product.media ?? [];

  const [syncMsg, setSyncMsg] = useState('');
  const syncMutation = useMutation({
    mutationFn: () => kbApi.syncDrive(productId, product.driveFolderUrl),
    onSuccess: (res: any) => {
      const data = res.data || res;
      setSyncMsg(`تم مزامنة ${data.synced ?? 0} ملف جديد من أصل ${data.total ?? 0}`);
      qc.invalidateQueries({ queryKey: ['kb-product', productId] });
    },
    onError: (err: any) => {
      setSyncMsg(`خطأ: ${err.response?.data?.error || err.message}`);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => kbApi.uploadMedia(productId, formData),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kb-product', productId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (mediaId: string) => kbApi.deleteMedia(productId, mediaId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kb-product', productId] }),
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    uploadMutation.mutate(formData);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="الصور والفيديوهات"
        canEdit={canEdit}
        isEditing={isEditing}
        onEdit={onEdit}
        onCancel={onCancel}
      />

      {/* Upload / Sync controls — only in edit mode */}
      {isEditing && canEdit && (
        <div className="flex gap-2">
          <button
            onClick={() => { setSyncMsg(''); syncMutation.mutate(); }}
            disabled={syncMutation.isPending || !product.driveFolderUrl}
            title={!product.driveFolderUrl ? 'أضف رابط فولدر Drive في بيانات المنتج أولاً' : ''}
            className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm disabled:opacity-50"
          >
            {syncMutation.isPending ? 'جاري المزامنة...' : 'مزامنة من Drive'}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 text-sm disabled:opacity-50"
          >
            {uploadMutation.isPending ? 'جاري الرفع...' : 'رفع ملفات'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      )}

      {syncMsg && (
        <div className={`p-3 rounded-lg text-sm ${syncMsg.startsWith('خطأ') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {syncMsg}
        </div>
      )}

      {mediaItems.length === 0 ? (
        <div className="p-8 text-center text-slate-400">لا توجد ملفات وسائط</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {mediaItems.map((item: any) => {
            const isVideo = item.type?.startsWith('video') || item.mediaType === 'VIDEO';
            return (
              <div key={item.id} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                {isVideo ? (
                  <div className="aspect-square bg-slate-200 flex items-center justify-center">
                    <svg className="w-12 h-12 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                ) : (
                  <img
                    src={item.url || item.thumbnailUrl}
                    alt={item.name || ''}
                    className="aspect-square object-cover w-full"
                    referrerPolicy="no-referrer"
                  />
                )}
                {/* Delete button only visible in edit mode */}
                {isEditing && canEdit && (
                  <button
                    onClick={() => {
                      if (confirm('حذف هذا الملف؟')) deleteMutation.mutate(item.id);
                    }}
                    className="absolute top-2 left-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    X
                  </button>
                )}
                {item.name && (
                  <div className="p-2 text-xs text-slate-600 truncate">{item.name}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Tab 3: Supply & Manufacturing ─────────────── */

function SupplyTab({
  productId,
  product,
  canEdit,
  qc,
  isEditing,
  onEdit,
  onCancel,
  onSaved,
}: {
  productId: string;
  product: any;
  canEdit: boolean;
  qc: any;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const suppliers: any[] = product.suppliers ?? [];
  const mfg = product.manufacturing ?? {};

  return (
    <div className="space-y-8">
      {/* Suppliers Section */}
      <SuppliersSection productId={productId} suppliers={suppliers} canEdit={canEdit} qc={qc} isEditing={isEditing} onEdit={onEdit} onCancel={onCancel} />

      {/* Manufacturing Section */}
      <ManufacturingSection productId={productId} mfg={mfg} canEdit={canEdit} qc={qc} isEditing={isEditing} onEdit={onEdit} onCancel={onCancel} onSaved={onSaved} />
    </div>
  );
}

function SuppliersSection({
  productId,
  suppliers,
  canEdit: _canEdit,
  qc,
  isEditing,
  onEdit: _onEdit,
  onCancel: _onCancel,
}: {
  productId: string;
  suppliers: any[];
  canEdit: boolean;
  qc: any;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', contact: '', rating: '5', notes: '' });

  const createMutation = useMutation({
    mutationFn: (data: any) => kbApi.createSupplier(productId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-product', productId] });
      setForm({ name: '', contact: '', rating: '5', notes: '' });
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (supplierId: string) => kbApi.deleteSupplier(productId, supplierId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kb-product', productId] }),
  });

  /* ── Read-only view ── */
  if (!isEditing) {
    return (
      <div>
        <h3 className="text-base font-semibold text-slate-800 mb-4">الموردين</h3>
        {suppliers.length === 0 ? (
          <p className="text-sm text-slate-400">لا يوجد موردين مسجلين</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suppliers.map((s: any) => (
              <div key={s.id} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-slate-800">{s.name}</span>
                  <span className="text-amber-500 text-sm">{'★'.repeat(s.rating || 0)}{'☆'.repeat(5 - (s.rating || 0))}</span>
                </div>
                {s.contact && (
                  <p className="text-xs text-slate-500 mb-1">{s.contact}</p>
                )}
                {s.notes && (
                  <p className="text-xs text-slate-400 mt-1">{s.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── Edit mode ── */
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-800">الموردين</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 text-sm"
        >
          {showForm ? 'إلغاء' : '+ إضافة مورد'}
        </button>
      </div>

      {/* Inline Add Form */}
      {showForm && (
        <div className="bg-slate-50 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="اسم المورد *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <input
              type="text"
              placeholder="معلومات التواصل"
              value={form.contact}
              onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">التقييم</label>
              <select
                value={form.rating}
                onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                {[1, 2, 3, 4, 5].map((r) => (
                  <option key={r} value={r}>{r} {'★'.repeat(r)}</option>
                ))}
              </select>
            </div>
            <input
              type="text"
              placeholder="ملاحظات"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <button
            onClick={() => {
              if (!form.name.trim()) return;
              createMutation.mutate({
                name: form.name,
                contact: form.contact || undefined,
                rating: parseInt(form.rating),
                notes: form.notes || undefined,
              });
            }}
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50"
          >
            {createMutation.isPending ? 'جاري الحفظ...' : 'إضافة'}
          </button>
        </div>
      )}

      {/* Suppliers List (edit mode — with delete buttons) */}
      {suppliers.length === 0 ? (
        <p className="text-sm text-slate-400">لا يوجد موردين مسجلين</p>
      ) : (
        <div className="space-y-3">
          {suppliers.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <span className="font-medium text-sm text-slate-800">{s.name}</span>
                {s.contact && <span className="text-xs text-slate-500 mr-3">{s.contact}</span>}
                {s.notes && <p className="text-xs text-slate-400 mt-1">{s.notes}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-amber-500 text-sm">{'★'.repeat(s.rating || 0)}{'☆'.repeat(5 - (s.rating || 0))}</span>
                <button
                  onClick={() => { if (confirm('حذف هذا المورد؟')) deleteMutation.mutate(s.id); }}
                  className="text-red-400 hover:text-red-600 text-xs"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ManufacturingSection({
  productId,
  mfg,
  canEdit,
  qc,
  isEditing,
  onEdit,
  onCancel,
  onSaved,
}: {
  productId: string;
  mfg: any;
  canEdit: boolean;
  qc: any;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    materials: mfg.materials ?? '',
    productionSteps: mfg.productionSteps ?? '',
    wastePercentage: mfg.wastePercentage != null ? String(mfg.wastePercentage) : '',
    unitCost: mfg.unitCost != null ? String(mfg.unitCost) : '',
    unitCostCurrency: mfg.unitCostCurrency ?? 'EGP',
    packagingType: mfg.packagingType ?? '',
    packagingDimensions: mfg.packagingDimensions ?? '',
    packagingCost: mfg.packagingCost != null ? String(mfg.packagingCost) : '',
    shippingTerms: mfg.shippingTerms ?? '',
  });

  // Reset form when mfg data changes (e.g., after cancel)
  const resetForm = () => {
    setForm({
      materials: mfg.materials ?? '',
      productionSteps: mfg.productionSteps ?? '',
      wastePercentage: mfg.wastePercentage != null ? String(mfg.wastePercentage) : '',
      unitCost: mfg.unitCost != null ? String(mfg.unitCost) : '',
      unitCostCurrency: mfg.unitCostCurrency ?? 'EGP',
      packagingType: mfg.packagingType ?? '',
      packagingDimensions: mfg.packagingDimensions ?? '',
      packagingCost: mfg.packagingCost != null ? String(mfg.packagingCost) : '',
      shippingTerms: mfg.shippingTerms ?? '',
    });
  };

  const mutation = useMutation({
    mutationFn: (data: any) => kbApi.updateManufacturing(productId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-product', productId] });
      onSaved();
    },
  });

  const handleSave = () => {
    mutation.mutate({
      materials: form.materials || undefined,
      productionSteps: form.productionSteps || undefined,
      wastePercentage: form.wastePercentage ? parseFloat(form.wastePercentage) : undefined,
      unitCost: form.unitCost ? parseFloat(form.unitCost) : undefined,
      unitCostCurrency: form.unitCostCurrency || undefined,
      packagingType: form.packagingType || undefined,
      packagingDimensions: form.packagingDimensions || undefined,
      packagingCost: form.packagingCost ? parseFloat(form.packagingCost) : undefined,
      shippingTerms: form.shippingTerms || undefined,
    });
  };

  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  /* ── Read-only view ── */
  if (!isEditing) {
    return (
      <div>
        <SectionHeader
          title="التصنيع"
          canEdit={canEdit}
          isEditing={false}
          onEdit={onEdit}
          onCancel={onCancel}
        />

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <span className="block text-sm text-slate-500 mb-1">المواد الخام</span>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{mfg.materials || '-'}</p>
            </div>
            <div>
              <span className="block text-sm text-slate-500 mb-1">خطوات الإنتاج</span>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{mfg.productionSteps || '-'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ReadOnlyField label="نسبة الهدر %" value={mfg.wastePercentage != null ? `${mfg.wastePercentage}%` : null} />
            <ReadOnlyField label="تكلفة الوحدة" value={mfg.unitCost != null ? `${mfg.unitCost} ${mfg.unitCostCurrency || 'EGP'}` : null} />
            <ReadOnlyField label="نوع التغليف" value={mfg.packagingType} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ReadOnlyField label="أبعاد التغليف" value={mfg.packagingDimensions} />
            <ReadOnlyField label="تكلفة التغليف" value={mfg.packagingCost != null ? `${mfg.packagingCost} ${mfg.unitCostCurrency || 'EGP'}` : null} />
            <div>
              <span className="block text-sm text-slate-500 mb-1">شروط الشحن</span>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{mfg.shippingTerms || '-'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Edit mode ── */
  return (
    <div>
      <SectionHeader
        title="التصنيع"
        canEdit={canEdit}
        isEditing={true}
        onEdit={onEdit}
        onSave={handleSave}
        onCancel={handleCancel}
        isSaving={mutation.isPending}
      />

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">المواد الخام</label>
          <textarea
            value={form.materials}
            onChange={(e) => set('materials', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            placeholder="المواد المستخدمة في التصنيع..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">خطوات الإنتاج</label>
          <textarea
            value={form.productionSteps}
            onChange={(e) => set('productionSteps', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            placeholder="خطوات عملية الإنتاج..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">نسبة الهدر %</label>
            <input
              type="number"
              step="0.1"
              value={form.wastePercentage}
              onChange={(e) => set('wastePercentage', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">تكلفة الوحدة</label>
            <input
              type="number"
              step="0.01"
              value={form.unitCost}
              onChange={(e) => set('unitCost', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">عملة التكلفة</label>
            <select
              value={form.unitCostCurrency}
              onChange={(e) => set('unitCostCurrency', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">نوع التغليف</label>
            <input
              type="text"
              value={form.packagingType}
              onChange={(e) => set('packagingType', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              placeholder="كرتون، بلاستيك..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">أبعاد التغليف</label>
            <input
              type="text"
              value={form.packagingDimensions}
              onChange={(e) => set('packagingDimensions', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              placeholder="30x20x10 سم"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">تكلفة التغليف</label>
            <input
              type="number"
              step="0.01"
              value={form.packagingCost}
              onChange={(e) => set('packagingCost', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">شروط الشحن</label>
          <textarea
            value={form.shippingTerms}
            onChange={(e) => set('shippingTerms', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            placeholder="شروط وأحكام الشحن..."
          />
        </div>

        {mutation.isError && (
          <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            {(mutation.error as any)?.response?.data?.error || 'حدث خطأ'}
          </p>
        )}
        {mutation.isSuccess && (
          <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">تم الحفظ بنجاح</p>
        )}
      </div>
    </div>
  );
}

/* ─────────────── Tab 4: Pricing & Variations ─────────────── */

function PricingTab({
  productId,
  product,
  canEdit,
  qc,
  isEditing,
  onEdit,
  onCancel,
}: {
  productId: string;
  product: any;
  canEdit: boolean;
  qc: any;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const variations: any[] = product.variations ?? [];
  const pricing: any[] = product.pricing ?? [];

  return (
    <div className="space-y-8">
      <SectionHeader
        title="الأسعار والفاريشنز"
        canEdit={canEdit}
        isEditing={isEditing}
        onEdit={onEdit}
        onCancel={onCancel}
      />
      <VariationsSection productId={productId} variations={variations} canEdit={canEdit} qc={qc} isEditing={isEditing} />
      <PricingSection productId={productId} pricing={pricing} variations={variations} canEdit={canEdit} qc={qc} isEditing={isEditing} />
    </div>
  );
}

function VariationsSection({
  productId,
  variations,
  canEdit,
  qc,
  isEditing,
}: {
  productId: string;
  variations: any[];
  canEdit: boolean;
  qc: any;
  isEditing: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', color: '', size: '', sku: '', source: '' });

  const createMutation = useMutation({
    mutationFn: (data: any) => kbApi.createVariation(productId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-product', productId] });
      setForm({ name: '', color: '', size: '', sku: '', source: '' });
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (varId: string) => kbApi.deleteVariation(productId, varId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kb-product', productId] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-800">الفاريشنز</h3>
        {isEditing && canEdit && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 text-sm"
          >
            {showForm ? 'إلغاء' : '+ إضافة فاريشن'}
          </button>
        )}
      </div>

      {showForm && isEditing && canEdit && (
        <div className="bg-slate-50 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
            <input
              type="text"
              placeholder="الاسم *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <input
              type="text"
              placeholder="اللون"
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <input
              type="text"
              placeholder="المقاس"
              value={form.size}
              onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <input
              type="text"
              placeholder="SKU"
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
              dir="ltr"
            />
            <input
              type="text"
              placeholder="المصدر"
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <button
            onClick={() => {
              if (!form.name.trim()) return;
              createMutation.mutate({
                name: form.name,
                color: form.color || undefined,
                size: form.size || undefined,
                sku: form.sku || undefined,
                source: form.source || undefined,
              });
            }}
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50"
          >
            {createMutation.isPending ? 'جاري الحفظ...' : 'إضافة'}
          </button>
        </div>
      )}

      {variations.length === 0 ? (
        <p className="text-sm text-slate-400">لا يوجد فاريشنز</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-right py-2 px-3 text-slate-500 font-medium">الاسم</th>
                <th className="text-right py-2 px-3 text-slate-500 font-medium">اللون</th>
                <th className="text-right py-2 px-3 text-slate-500 font-medium">المقاس</th>
                <th className="text-right py-2 px-3 text-slate-500 font-medium">SKU</th>
                <th className="text-right py-2 px-3 text-slate-500 font-medium">المصدر</th>
                {isEditing && canEdit && <th className="py-2 px-3"></th>}
              </tr>
            </thead>
            <tbody>
              {variations.map((v: any) => (
                <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-3 text-slate-800">{v.name}</td>
                  <td className="py-2 px-3 text-slate-600">{v.color || '-'}</td>
                  <td className="py-2 px-3 text-slate-600">{v.size || '-'}</td>
                  <td className="py-2 px-3 text-slate-600 font-mono" dir="ltr">{v.sku || '-'}</td>
                  <td className="py-2 px-3 text-slate-600">{v.source || '-'}</td>
                  {isEditing && canEdit && (
                    <td className="py-2 px-3 text-left">
                      <button
                        onClick={() => { if (confirm('حذف هذا الفاريشن؟')) deleteMutation.mutate(v.id); }}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        حذف
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PricingSection({
  productId,
  pricing,
  variations,
  canEdit,
  qc,
  isEditing,
}: {
  productId: string;
  pricing: any[];
  variations: any[];
  canEdit: boolean;
  qc: any;
  isEditing: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    currency: 'EGP',
    priceType: 'retail',
    price: '',
    variationId: '',
    notes: '',
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => kbApi.createPricing(productId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-product', productId] });
      setForm({ currency: 'EGP', priceType: 'retail', price: '', variationId: '', notes: '' });
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (priceId: string) => kbApi.deletePricing(productId, priceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kb-product', productId] }),
  });

  const priceTypeLabel = (type: string) => {
    const found = PRICE_TYPE_OPTIONS.find((o) => o.value === type);
    return found?.label ?? type;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-800">الأسعار</h3>
        {isEditing && canEdit && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 text-sm"
          >
            {showForm ? 'إلغاء' : '+ إضافة سعر'}
          </button>
        )}
      </div>

      {showForm && isEditing && canEdit && (
        <div className="bg-slate-50 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
            <select
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={form.priceType}
              onChange={(e) => setForm((f) => ({ ...f, priceType: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              {PRICE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              placeholder="السعر *"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <select
              value={form.variationId}
              onChange={(e) => setForm((f) => ({ ...f, variationId: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">بدون فاريشن</option>
              {variations.map((v: any) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="ملاحظات"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <button
            onClick={() => {
              if (!form.price) return;
              createMutation.mutate({
                currency: form.currency,
                priceType: form.priceType,
                price: parseFloat(form.price),
                variationId: form.variationId || undefined,
                notes: form.notes || undefined,
              });
            }}
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50"
          >
            {createMutation.isPending ? 'جاري الحفظ...' : 'إضافة'}
          </button>
        </div>
      )}

      {pricing.length === 0 ? (
        <p className="text-sm text-slate-400">لا يوجد أسعار مسجلة</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-right py-2 px-3 text-slate-500 font-medium">العملة</th>
                <th className="text-right py-2 px-3 text-slate-500 font-medium">النوع</th>
                <th className="text-right py-2 px-3 text-slate-500 font-medium">السعر</th>
                <th className="text-right py-2 px-3 text-slate-500 font-medium">الفاريشن</th>
                <th className="text-right py-2 px-3 text-slate-500 font-medium">ملاحظات</th>
                {isEditing && canEdit && <th className="py-2 px-3"></th>}
              </tr>
            </thead>
            <tbody>
              {pricing.map((p: any) => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-3 text-slate-800 font-mono">{p.currency}</td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      p.priceType === 'wholesale' ? 'bg-blue-50 text-blue-700' :
                      p.priceType === 'offer' ? 'bg-amber-50 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {priceTypeLabel(p.priceType)}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-800 font-medium">{p.price}</td>
                  <td className="py-2 px-3 text-slate-600">{p.variation?.name || '-'}</td>
                  <td className="py-2 px-3 text-slate-500 text-xs">{p.notes || '-'}</td>
                  {isEditing && canEdit && (
                    <td className="py-2 px-3 text-left">
                      <button
                        onClick={() => { if (confirm('حذف هذا السعر؟')) deleteMutation.mutate(p.id); }}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        حذف
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Tab 5: Marketing ─────────────── */

function MarketingTab({
  productId,
  product,
  canEdit,
  qc,
  isEditing,
  onEdit,
  onCancel,
  onSaved,
}: {
  productId: string;
  product: any;
  canEdit: boolean;
  qc: any;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const mktg = product.marketing ?? {};

  const [form, setForm] = useState({
    usps: mktg.usps ?? '',
    targetAudience: mktg.targetAudience ?? '',
    competitorComparison: mktg.competitorComparison ?? '',
    brandVoice: mktg.brandVoice ?? '',
    keywords: mktg.keywords ?? '',
  });

  const resetForm = () => {
    setForm({
      usps: mktg.usps ?? '',
      targetAudience: mktg.targetAudience ?? '',
      competitorComparison: mktg.competitorComparison ?? '',
      brandVoice: mktg.brandVoice ?? '',
      keywords: mktg.keywords ?? '',
    });
  };

  const mutation = useMutation({
    mutationFn: (data: any) => kbApi.updateMarketing(productId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-product', productId] });
      onSaved();
    },
  });

  const handleSave = () => {
    mutation.mutate({
      usps: form.usps || undefined,
      targetAudience: form.targetAudience || undefined,
      competitorComparison: form.competitorComparison || undefined,
      brandVoice: form.brandVoice || undefined,
      keywords: form.keywords || undefined,
    });
  };

  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const MARKETING_FIELDS = [
    { key: 'usps', label: 'نقاط البيع الفريدة (USPs)', placeholder: 'ما الذي يميز هذا المنتج عن غيره...' },
    { key: 'targetAudience', label: 'الجمهور المستهدف', placeholder: 'وصف الجمهور المستهدف...' },
    { key: 'competitorComparison', label: 'مقارنة بالمنافسين', placeholder: 'كيف يقارن المنتج بالمنافسين...' },
    { key: 'brandVoice', label: 'صوت البراند', placeholder: 'نبرة وأسلوب التواصل...' },
    { key: 'keywords', label: 'الكلمات المفتاحية', placeholder: 'كلمات مفتاحية مفصولة بفواصل...' },
  ];

  /* ── Read-only view ── */
  if (!isEditing) {
    return (
      <div className="space-y-5">
        <SectionHeader
          title="بيانات التسويق"
          canEdit={canEdit}
          isEditing={false}
          onEdit={onEdit}
          onCancel={onCancel}
        />

        {MARKETING_FIELDS.map((field) => (
          <div key={field.key}>
            <span className="block text-sm text-slate-500 mb-1">{field.label}</span>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {(mktg as any)[field.key] || '-'}
            </p>
          </div>
        ))}
      </div>
    );
  }

  /* ── Edit mode ── */
  return (
    <div className="space-y-5">
      <SectionHeader
        title="بيانات التسويق"
        canEdit={canEdit}
        isEditing={true}
        onEdit={onEdit}
        onSave={handleSave}
        onCancel={handleCancel}
        isSaving={mutation.isPending}
      />

      {MARKETING_FIELDS.map((field) => (
        <div key={field.key}>
          <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
          <textarea
            value={(form as any)[field.key]}
            onChange={(e) => set(field.key, e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            placeholder={field.placeholder}
          />
        </div>
      ))}

      {mutation.isError && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          {(mutation.error as any)?.response?.data?.error || 'حدث خطأ'}
        </p>
      )}
      {mutation.isSuccess && (
        <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">تم الحفظ بنجاح</p>
      )}
    </div>
  );
}

/* ─────────────── Tab 6: Sales ─────────────── */

function SalesTab({
  productId,
  product,
  canEdit,
  qc,
  isEditing,
  onEdit,
  onCancel,
}: {
  productId: string;
  product: any;
  canEdit: boolean;
  qc: any;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-8">
      <SectionHeader
        title="المبيعات"
        canEdit={canEdit}
        isEditing={isEditing}
        onEdit={onEdit}
        onCancel={onCancel}
      />
      <FaqsSection productId={productId} faqs={product.faqs ?? []} canEdit={canEdit} qc={qc} isEditing={isEditing} />
      <ObjectionsSection productId={productId} objections={product.objections ?? []} canEdit={canEdit} qc={qc} isEditing={isEditing} />
      <UpsellsSection productId={productId} upsells={product.upsells ?? []} canEdit={canEdit} qc={qc} isEditing={isEditing} />
      <SalesScriptsSection productId={productId} scripts={product.salesScripts ?? []} canEdit={canEdit} qc={qc} isEditing={isEditing} />
    </div>
  );
}

/* -- FAQs -- */

function FaqsSection({
  productId,
  faqs,
  canEdit,
  qc,
  isEditing,
}: {
  productId: string;
  faqs: any[];
  canEdit: boolean;
  qc: any;
  isEditing: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ question: '', answer: '' });

  const createMutation = useMutation({
    mutationFn: (data: any) => kbApi.createFaq(productId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-product', productId] });
      setForm({ question: '', answer: '' });
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (faqId: string) => kbApi.deleteFaq(productId, faqId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kb-product', productId] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-800">الأسئلة الشائعة</h3>
        {isEditing && canEdit && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 text-sm"
          >
            {showForm ? 'إلغاء' : '+ إضافة سؤال'}
          </button>
        )}
      </div>

      {showForm && isEditing && canEdit && (
        <div className="bg-slate-50 rounded-lg p-4 mb-4 space-y-3">
          <input
            type="text"
            placeholder="السؤال *"
            value={form.question}
            onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <textarea
            placeholder="الإجابة *"
            value={form.answer}
            onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <button
            onClick={() => {
              if (!form.question.trim() || !form.answer.trim()) return;
              createMutation.mutate({ question: form.question, answer: form.answer });
            }}
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50"
          >
            {createMutation.isPending ? 'جاري الحفظ...' : 'إضافة'}
          </button>
        </div>
      )}

      {faqs.length === 0 ? (
        <p className="text-sm text-slate-400">لا توجد أسئلة شائعة</p>
      ) : (
        <div className="space-y-2">
          {faqs.map((faq: any) => (
            <div key={faq.id} className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-slate-50 text-right"
              >
                <span className="font-medium text-sm text-slate-800">{faq.question}</span>
                <svg
                  className={`w-4 h-4 text-slate-400 transition-transform ${expandedId === faq.id ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {expandedId === faq.id && (
                <div className="px-3 pb-3 border-t border-slate-100">
                  <p className="text-sm text-slate-600 whitespace-pre-wrap mt-2">{faq.answer}</p>
                  {isEditing && canEdit && (
                    <button
                      onClick={() => { if (confirm('حذف هذا السؤال؟')) deleteMutation.mutate(faq.id); }}
                      className="mt-2 text-red-400 hover:text-red-600 text-xs"
                    >
                      حذف
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -- Objections -- */

function ObjectionsSection({
  productId,
  objections,
  canEdit,
  qc,
  isEditing,
}: {
  productId: string;
  objections: any[];
  canEdit: boolean;
  qc: any;
  isEditing: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ objection: '', response: '' });

  const createMutation = useMutation({
    mutationFn: (data: any) => kbApi.createObjection(productId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-product', productId] });
      setForm({ objection: '', response: '' });
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (objId: string) => kbApi.deleteObjection(productId, objId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kb-product', productId] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-800">الاعتراضات</h3>
        {isEditing && canEdit && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 text-sm"
          >
            {showForm ? 'إلغاء' : '+ إضافة اعتراض'}
          </button>
        )}
      </div>

      {showForm && isEditing && canEdit && (
        <div className="bg-slate-50 rounded-lg p-4 mb-4 space-y-3">
          <input
            type="text"
            placeholder="الاعتراض *"
            value={form.objection}
            onChange={(e) => setForm((f) => ({ ...f, objection: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <textarea
            placeholder="الرد *"
            value={form.response}
            onChange={(e) => setForm((f) => ({ ...f, response: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <button
            onClick={() => {
              if (!form.objection.trim() || !form.response.trim()) return;
              createMutation.mutate({ objection: form.objection, response: form.response });
            }}
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50"
          >
            {createMutation.isPending ? 'جاري الحفظ...' : 'إضافة'}
          </button>
        </div>
      )}

      {objections.length === 0 ? (
        <p className="text-sm text-slate-400">لا توجد اعتراضات مسجلة</p>
      ) : (
        <div className="space-y-3">
          {objections.map((obj: any) => (
            <div key={obj.id} className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700 mb-1">
                    <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded ml-2">اعتراض</span>
                    {obj.objection}
                  </p>
                  <p className="text-sm text-slate-600">
                    <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded ml-2">الرد</span>
                    {obj.response}
                  </p>
                </div>
                {isEditing && canEdit && (
                  <button
                    onClick={() => { if (confirm('حذف هذا الاعتراض؟')) deleteMutation.mutate(obj.id); }}
                    className="text-red-400 hover:text-red-600 text-xs mr-3"
                  >
                    حذف
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -- Upsells / Cross-sells -- */

function UpsellsSection({
  productId,
  upsells,
  canEdit: _canEdit,
  qc,
  isEditing,
}: {
  productId: string;
  upsells: any[];
  canEdit: boolean;
  qc: any;
  isEditing: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ relatedProductId: '', type: 'upsell' });
  const [searchQuery, setSearchQuery] = useState('');

  const { data: searchData } = useQuery({
    queryKey: ['kb-product-search', searchQuery],
    queryFn: () => kbApi.searchProducts(searchQuery),
    enabled: searchQuery.length >= 2,
  });

  const searchResults = searchData?.data?.products ?? [];

  const createMutation = useMutation({
    mutationFn: (data: any) => kbApi.createUpsell(productId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-product', productId] });
      setForm({ relatedProductId: '', type: 'upsell' });
      setSearchQuery('');
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (upsellId: string) => kbApi.deleteUpsell(productId, upsellId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kb-product', productId] }),
  });

  /* ── Read-only view ── */
  if (!isEditing) {
    return (
      <div>
        <h3 className="text-base font-semibold text-slate-800 mb-4">منتجات مقترحة</h3>
        {upsells.length === 0 ? (
          <p className="text-sm text-slate-400">لا توجد منتجات مقترحة</p>
        ) : (
          <div className="space-y-2">
            {upsells.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Link
                  to={`/knowledge-base/products/${u.relatedProductId}`}
                  className="text-sm font-medium text-emerald-700 hover:underline"
                >
                  {u.relatedProduct?.name || u.relatedProductId}
                </Link>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  u.type === 'upsell' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                }`}>
                  {u.type === 'upsell' ? 'Upsell' : 'Cross-sell'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── Edit mode ── */
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-800">منتجات مقترحة</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 text-sm"
        >
          {showForm ? 'إلغاء' : '+ إضافة منتج مقترح'}
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-50 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <input
                type="text"
                placeholder="ابحث عن منتج..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setForm((f) => ({ ...f, relatedProductId: '' }));
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              {searchResults.length > 0 && !form.relatedProductId && (
                <div className="mt-1 bg-white border border-slate-200 rounded-lg shadow-sm max-h-40 overflow-y-auto">
                  {searchResults.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setForm((f) => ({ ...f, relatedProductId: p.id }));
                        setSearchQuery(p.name);
                      }}
                      className="w-full text-right px-3 py-2 hover:bg-slate-50 text-sm border-b border-slate-100 last:border-0"
                    >
                      {p.name}
                      {p.sku && <span className="text-xs text-slate-400 mr-2">({p.sku})</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="upsell">Upsell</option>
              <option value="crosssell">Cross-sell</option>
            </select>
          </div>
          <button
            onClick={() => {
              if (!form.relatedProductId) return;
              createMutation.mutate({ relatedProductId: form.relatedProductId, type: form.type });
            }}
            disabled={createMutation.isPending || !form.relatedProductId}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50"
          >
            {createMutation.isPending ? 'جاري الحفظ...' : 'إضافة'}
          </button>
        </div>
      )}

      {upsells.length === 0 ? (
        <p className="text-sm text-slate-400">لا توجد منتجات مقترحة</p>
      ) : (
        <div className="space-y-2">
          {upsells.map((u: any) => (
            <div key={u.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-800">
                  {u.relatedProduct?.name || u.relatedProductId}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  u.type === 'upsell' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                }`}>
                  {u.type === 'upsell' ? 'Upsell' : 'Cross-sell'}
                </span>
              </div>
              <button
                onClick={() => { if (confirm('حذف هذا الاقتراح؟')) deleteMutation.mutate(u.id); }}
                className="text-red-400 hover:text-red-600 text-xs"
              >
                حذف
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -- Sales Scripts -- */

function SalesScriptsSection({
  productId,
  scripts,
  canEdit,
  qc,
  isEditing,
}: {
  productId: string;
  scripts: any[];
  canEdit: boolean;
  qc: any;
  isEditing: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '' });

  const createMutation = useMutation({
    mutationFn: (data: any) => kbApi.createSalesScript(productId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-product', productId] });
      setForm({ title: '', content: '' });
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (scriptId: string) => kbApi.deleteSalesScript(productId, scriptId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kb-product', productId] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-800">سكربت البيع</h3>
        {isEditing && canEdit && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 text-sm"
          >
            {showForm ? 'إلغاء' : '+ إضافة سكربت'}
          </button>
        )}
      </div>

      {showForm && isEditing && canEdit && (
        <div className="bg-slate-50 rounded-lg p-4 mb-4 space-y-3">
          <input
            type="text"
            placeholder="العنوان *"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <textarea
            placeholder="محتوى السكربت *"
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            rows={5}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <button
            onClick={() => {
              if (!form.title.trim() || !form.content.trim()) return;
              createMutation.mutate({ title: form.title, content: form.content });
            }}
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50"
          >
            {createMutation.isPending ? 'جاري الحفظ...' : 'إضافة'}
          </button>
        </div>
      )}

      {scripts.length === 0 ? (
        <p className="text-sm text-slate-400">لا يوجد سكربتات بيع</p>
      ) : (
        <div className="space-y-3">
          {scripts.map((s: any) => (
            <div key={s.id} className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-sm text-slate-800">{s.title}</h4>
                {isEditing && canEdit && (
                  <button
                    onClick={() => { if (confirm('حذف هذا السكربت؟')) deleteMutation.mutate(s.id); }}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    حذف
                  </button>
                )}
              </div>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{s.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Tab 7: After-Sales ─────────────── */

function AfterSalesTab({
  productId,
  product,
  canEdit,
  qc,
  isEditing,
  onEdit,
  onCancel,
  onSaved,
}: {
  productId: string;
  product: any;
  canEdit: boolean;
  qc: any;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const as = product.afterSales ?? {};

  const [form, setForm] = useState({
    returnPolicy: as.returnPolicy ?? '',
    usageInstructions: as.usageInstructions ?? '',
    troubleshooting: as.troubleshooting ?? '',
    spareParts: as.spareParts ?? '',
    warrantyTerms: as.warrantyTerms ?? '',
  });

  const resetForm = () => {
    setForm({
      returnPolicy: as.returnPolicy ?? '',
      usageInstructions: as.usageInstructions ?? '',
      troubleshooting: as.troubleshooting ?? '',
      spareParts: as.spareParts ?? '',
      warrantyTerms: as.warrantyTerms ?? '',
    });
  };

  const mutation = useMutation({
    mutationFn: (data: any) => kbApi.updateAfterSales(productId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-product', productId] });
      onSaved();
    },
  });

  const handleSave = () => {
    mutation.mutate({
      returnPolicy: form.returnPolicy || undefined,
      usageInstructions: form.usageInstructions || undefined,
      troubleshooting: form.troubleshooting || undefined,
      spareParts: form.spareParts || undefined,
      warrantyTerms: form.warrantyTerms || undefined,
    });
  };

  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const AFTERSALES_FIELDS = [
    { key: 'returnPolicy', label: 'سياسة الإرجاع', placeholder: 'سياسة الإرجاع والاستبدال...' },
    { key: 'usageInstructions', label: 'تعليمات الاستخدام', placeholder: 'كيفية استخدام المنتج...' },
    { key: 'troubleshooting', label: 'حل المشكلات', placeholder: 'مشاكل شائعة وطرق حلها...' },
    { key: 'spareParts', label: 'قطع الغيار', placeholder: 'قطع الغيار المتاحة...' },
    { key: 'warrantyTerms', label: 'شروط الضمان', placeholder: 'مدة وشروط الضمان...' },
  ];

  /* ── Read-only view ── */
  if (!isEditing) {
    return (
      <div className="space-y-5">
        <SectionHeader
          title="ما بعد البيع"
          canEdit={canEdit}
          isEditing={false}
          onEdit={onEdit}
          onCancel={onCancel}
        />

        {AFTERSALES_FIELDS.map((field) => (
          <div key={field.key}>
            <span className="block text-sm text-slate-500 mb-1">{field.label}</span>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {(as as any)[field.key] || '-'}
            </p>
          </div>
        ))}
      </div>
    );
  }

  /* ── Edit mode ── */
  return (
    <div className="space-y-5">
      <SectionHeader
        title="ما بعد البيع"
        canEdit={canEdit}
        isEditing={true}
        onEdit={onEdit}
        onSave={handleSave}
        onCancel={handleCancel}
        isSaving={mutation.isPending}
      />

      {AFTERSALES_FIELDS.map((field) => (
        <div key={field.key}>
          <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
          <textarea
            value={(form as any)[field.key]}
            onChange={(e) => set(field.key, e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            placeholder={field.placeholder}
          />
        </div>
      ))}

      {mutation.isError && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          {(mutation.error as any)?.response?.data?.error || 'حدث خطأ'}
        </p>
      )}
      {mutation.isSuccess && (
        <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">تم الحفظ بنجاح</p>
      )}
    </div>
  );
}
