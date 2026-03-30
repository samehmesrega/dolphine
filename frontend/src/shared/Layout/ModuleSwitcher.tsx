import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../modules/auth/context/AuthContext';

const MODULES = [
  {
    slug: 'leads',
    nameAr: 'دولفين ليدز',
    nameEn: 'Dolphin Leads',
    description: 'إدارة الليدز والعملاء والطلبات والمبيعات',
    path: '/leads/dashboard',
    gradient: 'from-amber-500 to-orange-600',
    iconPath: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  },
  {
    slug: 'marketing',
    nameAr: 'دولفين ماركتنج',
    nameEn: 'Dolphin Marketing',
    description: 'إدارة المحتوى والحملات والكريتيفز واللاندنج بيدجز',
    path: '/marketing',
    gradient: 'from-blue-500 to-indigo-600',
    iconPath: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
  },
  {
    slug: 'knowledge-base',
    nameAr: 'بنك المعلومات',
    nameEn: 'Knowledge Base',
    description: 'بنك معلومات شامل لكل منتج — صور، فيديوهات، أسئلة شائعة، ومواصفات',
    path: '/knowledge-base',
    gradient: 'from-emerald-500 to-teal-600',
    iconPath: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
  {
    slug: 'dual-name',
    nameAr: 'Dual Name 3D',
    nameEn: 'Dual Name Generator',
    description: 'مولد أسماء مزدوجة ثلاثية الأبعاد — تصدير STL و G-code',
    path: '/dual-name',
    gradient: 'from-rose-500 to-pink-600',
    iconPath: 'M21 7.5V18M15 7.5V18M3 16.811V8.69c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 010 1.954l-7.108 4.061A1.125 1.125 0 013 16.811z',
  },
];

const FEATURES = [
  {
    title: 'إدارة الليدز',
    desc: 'تتبع كل ليد من لحظة دخوله حتى تحويله لعميل. حالات مخصصة، تواصل مباشر، وتعيين تلقائي.',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  },
  {
    title: 'كريتيفز وتصميمات',
    desc: 'مكتبة كريتيفز متكاملة. إدارة طلبات التصميم، بنك أفكار، وتتبع حالة كل كريتيف.',
    icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    title: 'مهام تلقائية',
    desc: 'قواعد ذكية تنشئ مهام تلقائياً بناءً على حالة الليد والوقت. لا تفوّت أي متابعة.',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    title: 'لاندنج بيدجز',
    desc: 'أنشئ صفحات هبوط احترافية بالذكاء الاصطناعي. ربط مباشر بالحملات الإعلانية.',
    icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
  {
    title: 'إدارة الطلبات',
    desc: 'ربط مباشر مع ووردبريس/ووكومرس. تتبع حالة كل طلب من الإنشاء حتى التسليم.',
    icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
  },
  {
    title: 'سكربتات بالـ AI',
    desc: 'توليد سكربتات فيديو وإعلانات باستخدام الذكاء الاصطناعي. تعديل ومراجعة سهلة.',
    icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
  },
  {
    title: 'تقارير وتحليلات',
    desc: 'داشبورد شامل وتقارير مفصلة عن أداء فريق المبيعات، مصادر الليدز، ومعدلات التحويل.',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    title: 'نشر وجدولة',
    desc: 'جدولة المنشورات على منصات التواصل الاجتماعي. تقويم محتوى متكامل وربط مع Meta.',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    title: 'صلاحيات متقدمة',
    desc: 'نظام أدوار وصلاحيات مرن. تحكم كامل في ما يراه ويفعله كل عضو في الفريق.',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
];

const BRANDS = [
  { name: 'Digitics', initial: 'D', gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
  { name: 'Print IN', initial: 'P', gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
  { name: 'Picked IN', initial: 'P', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
  { name: 'Choroida', initial: 'C', gradient: 'linear-gradient(135deg, #10b981, #059669)' },
];

export default function ModuleSwitcher() {
  const { token, logout, user, hasPermission } = useAuth();
  const isAdmin = hasPermission('*') || ['admin', 'super_admin'].includes(user?.role?.slug ?? '');
  const navigate = useNavigate();

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
        <div className="flex items-center gap-3">
          {token ? (
            <>
              <span className="text-sm text-slate-300 hidden md:inline">
                مرحباً، {user?.name || 'مستخدم'}
              </span>
              <Link to="/settings/profile" className="bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-2 rounded-xl transition-colors text-sm">
                ملفي
              </Link>
              {isAdmin && (
                <Link to="/settings" className="bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-2 rounded-xl transition-colors text-sm">
                  ⚙ الإعدادات
                </Link>
              )}
              <button
                onClick={() => { logout(); navigate('/login'); }}
                className="bg-white/10 hover:bg-white/20 text-white font-medium px-5 py-2 rounded-xl transition-colors text-sm"
              >
                تسجيل خروج
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors text-sm"
            >
              تسجيل الدخول
            </Link>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 md:px-12 pt-16 pb-20 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-6">
          منصة دولفين
          <br />
          <span className="text-blue-400">لإدارة الأعمال المتكاملة</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-12 leading-relaxed">
          دولفين يجمعلك إدارة الليدز، المبيعات، التسويق، المحتوى، والحملات
          الإعلانية — كل ذلك من مكان واحد.
        </p>

        {/* Module Cards */}
        {token ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {MODULES.map((mod) => (
              <button
                key={mod.slug}
                onClick={() => navigate(mod.path)}
                className={`bg-gradient-to-br ${mod.gradient} text-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-200 text-right group`}
              >
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-white/30 transition-colors">
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={mod.iconPath} />
                  </svg>
                </div>
                <h2 className="text-xl font-bold mb-1">{mod.nameAr}</h2>
                <p className="text-xs font-medium opacity-60 mb-2">{mod.nameEn}</p>
                <p className="text-sm opacity-80">{mod.description}</p>
              </button>
            ))}
          </div>
        ) : (
          <Link
            to="/login"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors text-base shadow-lg shadow-blue-600/30"
          >
            ابدأ الآن
          </Link>
        )}
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 md:px-12 pb-24">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">كل اللي تحتاجه في مكان واحد</h2>
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

      {/* Powered by */}
      <section className="border-t border-white/10 py-16">
        <div className="max-w-4xl mx-auto px-6 md:px-12 text-center">
          <p className="text-slate-500 text-xs uppercase tracking-widest mb-4">تم التطوير بواسطة</p>
          <h3 className="text-2xl font-bold text-white mb-3">Digitics</h3>
          <p className="text-slate-400 text-sm max-w-lg mx-auto mb-8 leading-relaxed">
            شركة ديجتيكس للحلول الرقمية — المطوّر والمشغّل لمشاريع
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {BRANDS.map((b) => (
              <div key={b.name} className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-5 py-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: b.gradient }}
                >
                  {b.initial}
                </div>
                <span className="text-white font-semibold text-sm">{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 text-center text-slate-500 text-sm">
        <span>دولفين &copy; {new Date().getFullYear()}</span>
        <span className="mx-2">—</span>
        <span>تم التطوير بواسطة <span className="text-slate-400 font-medium">Digitics</span></span>
      </footer>
    </div>
  );
}
