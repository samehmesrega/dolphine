import { useQuery } from '@tanstack/react-query';
import { getCreatives, getRequests, getIdeas } from '../services/marketing-api';

export default function MarketingDashboard() {
  const { data: creativesData } = useQuery({
    queryKey: ['marketing', 'creatives', 'summary'],
    queryFn: () => getCreatives({ pageSize: '1' }),
  });

  const { data: requestsData } = useQuery({
    queryKey: ['marketing', 'requests', 'summary'],
    queryFn: () => getRequests({ status: 'NEW', pageSize: '1' }),
  });

  const { data: ideasData } = useQuery({
    queryKey: ['marketing', 'ideas', 'summary'],
    queryFn: () => getIdeas({ status: 'NEW', pageSize: '1' }),
  });

  const totalCreatives = creativesData?.data?.total ?? 0;
  const pendingRequests = requestsData?.data?.total ?? 0;
  const newIdeas = ideasData?.data?.total ?? 0;

  const cards = [
    { label: 'إجمالي الكرييتيف', value: totalCreatives, color: 'bg-blue-500' },
    { label: 'طلبات جديدة', value: pendingRequests, color: 'bg-orange-500' },
    { label: 'أفكار جديدة', value: newIdeas, color: 'bg-green-500' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">دولفين ماركتينج</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${card.color}`} />
              <span className="text-sm text-slate-500">{card.label}</span>
            </div>
            <p className="text-3xl font-bold text-slate-800 mt-2">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">مرحباً في دولفين ماركتينج</h2>
        <p className="text-slate-600">
          من هنا تقدر تدير الكرييتيف، الأفكار، طلبات المحتوى، ومراجع المنافسين.
        </p>
      </div>
    </div>
  );
}
