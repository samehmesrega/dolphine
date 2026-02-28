import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const { token } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white" dir="rtl">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center font-bold text-lg">
            D
          </div>
          <span className="text-xl font-bold tracking-tight">دولفين</span>
        </div>
        <Link
          to={token ? '/' : '/login'}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors text-sm"
        >
          {token ? 'لوحة التحكم' : 'تسجيل الدخول'}
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 md:px-12 pt-20 pb-28 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-6">
          نظام إدارة الليدز
          <br />
          <span className="text-blue-400">والمبيعات المتكامل</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
          دولفين يساعدك على تتبع الليدز، إدارة فريق المبيعات، متابعة الطلبات،
          وتحليل الأداء — كل ذلك من مكان واحد.
        </p>
        <Link
          to={token ? '/' : '/login'}
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors text-base shadow-lg shadow-blue-600/30"
        >
          {token ? 'الدخول للوحة التحكم' : 'ابدأ الآن'}
        </Link>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 md:px-12 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors"
            >
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 text-center text-slate-500 text-sm">
        دولفين &copy; {new Date().getFullYear()} — نظام إدارة الليدز والمبيعات
      </footer>
    </div>
  );
}

const FEATURES = [
  {
    title: 'إدارة الليدز',
    desc: 'تتبع كل ليد من لحظة دخوله حتى تحويله لعميل. حالات مخصصة، تواصل مباشر، وتعيين تلقائي.',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  },
  {
    title: 'مهام تلقائية',
    desc: 'قواعد ذكية تنشئ مهام تلقائياً بناءً على حالة الليد والوقت. لا تفوّت أي متابعة.',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    title: 'تقارير وتحليلات',
    desc: 'داشبورد شامل وتقارير مفصلة عن أداء فريق المبيعات، مصادر الليدز، ومعدلات التحويل.',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    title: 'إدارة الطلبات',
    desc: 'ربط مباشر مع ووردبريس/ووكومرس. تتبع حالة كل طلب من الإنشاء حتى التسليم.',
    icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
  },
  {
    title: 'صلاحيات متقدمة',
    desc: 'نظام أدوار وصلاحيات مرن. تحكم كامل في ما يراه ويفعله كل عضو في الفريق.',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    title: 'شيفتات وجدولة',
    desc: 'جدولة شيفتات الموظفين وتوزيع الليدز تلقائياً على الموظف المناوب.',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
];
