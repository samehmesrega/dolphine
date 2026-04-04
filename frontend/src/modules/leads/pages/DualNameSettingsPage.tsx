import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../shared/services/api';

type ColorItem = { name: string; hex: string };

const DEFAULT_COLORS: ColorItem[] = [
  { name: 'Terracotta', hex: '#e8735a' },
  { name: 'أسود', hex: '#1a1a1a' },
  { name: 'ذهبي', hex: '#d4a843' },
  { name: 'فضي', hex: '#c0c0c0' },
  { name: 'أبيض', hex: '#f5f5f5' },
  { name: 'خشبي', hex: '#8b6914' },
  { name: 'أزرق', hex: '#2563eb' },
  { name: 'وردي', hex: '#ec4899' },
];

const DEFAULT_WATERMARK = {
  line1: 'هذا الفيديو لمجسم تصويري خاص بيك وليس فيديو للمنتج النهائي',
  line2: 'تم التصميم بواسطة Print IN',
};

export default function DualNameSettingsPage() {
  const qc = useQueryClient();

  const { data: watermarkData } = useQuery({
    queryKey: ['setting', 'dual_name_watermark'],
    queryFn: async () => {
      const { data } = await api.get('/integrations/setting/dual_name_watermark');
      return data.value ? JSON.parse(data.value) : DEFAULT_WATERMARK;
    },
  });

  const { data: colorsData } = useQuery({
    queryKey: ['setting', 'dual_name_colors'],
    queryFn: async () => {
      const { data } = await api.get('/integrations/setting/dual_name_colors');
      return data.value ? JSON.parse(data.value) as ColorItem[] : DEFAULT_COLORS;
    },
  });

  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [colors, setColors] = useState<ColorItem[]>([]);
  const [newName, setNewName] = useState('');
  const [newHex, setNewHex] = useState('#000000');

  useEffect(() => {
    if (watermarkData) { setLine1(watermarkData.line1 || ''); setLine2(watermarkData.line2 || ''); }
  }, [watermarkData]);

  useEffect(() => {
    if (colorsData) setColors(colorsData);
  }, [colorsData]);

  const saveWatermark = useMutation({
    mutationFn: () => api.put('/integrations/setting/dual_name_watermark', { value: JSON.stringify({ line1, line2 }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['setting', 'dual_name_watermark'] }),
  });

  const saveColors = useMutation({
    mutationFn: (newColors: ColorItem[]) => api.put('/integrations/setting/dual_name_colors', { value: JSON.stringify(newColors) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['setting', 'dual_name_colors'] }),
  });

  const addColor = () => {
    if (!newName.trim() || !newHex.trim()) return;
    const updated = [...colors, { name: newName.trim(), hex: newHex }];
    setColors(updated);
    saveColors.mutate(updated);
    setNewName('');
    setNewHex('#000000');
  };

  const removeColor = (index: number) => {
    const updated = colors.filter((_, i) => i !== index);
    setColors(updated);
    saveColors.mutate(updated);
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">إعدادات Dual Name</h1>
        <p className="text-slate-500 text-sm mt-1">التحكم في نص الفيديو وألوان المجسم</p>
      </div>

      {/* Watermark Text */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">نص الفيديو (Watermark)</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">السطر الأول</label>
            <input
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="هذا الفيديو لمجسم تصويري..."
              dir="rtl"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">السطر الثاني</label>
            <input
              value={line2}
              onChange={(e) => setLine2(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="تم التصميم بواسطة..."
              dir="rtl"
            />
          </div>
          <button
            onClick={() => saveWatermark.mutate()}
            disabled={saveWatermark.isPending}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saveWatermark.isPending ? 'جاري الحفظ...' : 'حفظ النص'}
          </button>
          {saveWatermark.isSuccess && <span className="text-green-600 text-sm mr-2">تم الحفظ</span>}
        </div>
      </div>

      {/* Colors */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">ألوان المجسم</h2>

        {/* Current Colors */}
        <div className="space-y-2 mb-4">
          {colors.map((c, i) => (
            <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2">
              <div className="w-8 h-8 rounded-lg border border-slate-200" style={{ backgroundColor: c.hex }} />
              <span className="text-sm font-medium text-slate-700 flex-1">{c.name}</span>
              <span className="text-xs text-slate-400 font-mono">{c.hex}</span>
              <button
                onClick={() => removeColor(i)}
                className="text-red-400 hover:text-red-600 text-sm"
              >
                حذف
              </button>
            </div>
          ))}
          {colors.length === 0 && <p className="text-slate-400 text-sm">لا توجد ألوان</p>}
        </div>

        {/* Add Color */}
        <div className="flex items-end gap-3 border-t border-slate-100 pt-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">اسم اللون</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="مثلاً: أخضر"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">اللون</label>
            <input
              type="color"
              value={newHex}
              onChange={(e) => setNewHex(e.target.value)}
              className="w-12 h-10 border border-slate-300 rounded-lg cursor-pointer"
            />
          </div>
          <button
            onClick={addColor}
            disabled={!newName.trim()}
            className="bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-600 disabled:opacity-50"
          >
            إضافة
          </button>
        </div>
      </div>
    </div>
  );
}
