import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import DateRangePicker, { DateRange } from '../../components/DateRangePicker';

function defaultRange(): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function RateBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-2">
        <div
          className="bg-amber-500 h-2 rounded-full"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 w-8 text-left">{value}%</span>
    </div>
  );
}

type SourceStat = {
  label: string;
  totalLeads: number;
  confirmedLeads: number;
  confirmationRate: number;
  orderCount: number;
  totalOrderValue: number;
  avgOrderValue: number;
};

type SourcesData = {
  byUtmSource: SourceStat[];
  byUtmCampaign: SourceStat[];
  byForm: SourceStat[];
};

const TABS: { key: keyof SourcesData; label: string }[] = [
  { key: 'byUtmSource', label: 'مصدر الزيارة' },
  { key: 'byUtmCampaign', label: 'الحملة الإعلانية' },
  { key: 'byForm', label: 'مصدر النموذج' },
];

const TD = 'py-3 px-2 text-slate-600';

export default function MarketingReports() {
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [activeTab, setActiveTab] = useState<keyof SourcesData>('byUtmSource');

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'sources', range.from, range.to],
    queryFn: async () => {
      const { data } = await api.get('/reports/sources', { params: range });
      return data as SourcesData;
    },
  });

  const rows = data?.[activeTab] ?? [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-4">
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex gap-1 border-b border-slate-200 mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                activeTab === tab.key
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-slate-500">جاري التحميل...</div>
        ) : !rows.length ? (
          <div className="py-8 text-center text-slate-500">لا توجد بيانات لهذه الفترة</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs">
                  <th className="pb-3 pr-2 font-medium text-right">المصدر</th>
                  <th className="pb-3 px-2 font-medium text-right">الليدز</th>
                  <th className="pb-3 px-2 font-medium text-right">مؤكد</th>
                  <th className="pb-3 px-2 font-medium text-right w-36">نسبة التأكيد</th>
                  <th className="pb-3 px-2 font-medium text-right">الطلبات</th>
                  <th className="pb-3 px-2 font-medium text-right">القيمة الإجمالية</th>
                  <th className="pb-3 px-2 font-medium text-right">متوسط الطلب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.label} className="hover:bg-slate-50">
                    <td className="py-3 pr-2 font-medium text-slate-800">{r.label}</td>
                    <td className={TD}>{r.totalLeads}</td>
                    <td className={TD}>{r.confirmedLeads}</td>
                    <td className="py-3 px-2">
                      <RateBar value={r.confirmationRate} />
                    </td>
                    <td className={TD}>{r.orderCount}</td>
                    <td className={TD}>{r.totalOrderValue.toLocaleString()}</td>
                    <td className={TD}>{r.avgOrderValue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
