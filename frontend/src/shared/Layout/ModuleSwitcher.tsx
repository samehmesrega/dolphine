import { useNavigate } from 'react-router-dom';
// import { useAuth } from '../../modules/auth/context/AuthContext';

interface ModuleCard {
  slug: string;
  name: string;
  nameAr: string;
  description: string;
  icon: string;
  path: string;
  color: string;
}

const MODULES: ModuleCard[] = [
  {
    slug: 'leads',
    name: 'Dolphin Leads',
    nameAr: 'دولفين ليدز',
    description: 'إدارة الليدز والعملاء والطلبات',
    icon: '📊',
    path: '/leads',
    color: 'from-amber-500 to-orange-600',
  },
  {
    slug: 'marketing',
    name: 'Dolphin Marketing',
    nameAr: 'دولفين ماركتنج',
    description: 'إدارة المحتوى والحملات واللاندنج بيدجز',
    icon: '📢',
    path: '/marketing',
    color: 'from-blue-500 to-indigo-600',
  },
];

export default function ModuleSwitcher() {
  const navigate = useNavigate();
  // TODO: gate modules with hasPermission() in production
  const availableModules = MODULES;

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Dolphin Platform</h1>
        <p className="text-slate-500 mb-8">اختر الموديول</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {availableModules.map((mod) => (
            <button
              key={mod.slug}
              onClick={() => navigate(mod.path)}
              className={`bg-gradient-to-br ${mod.color} text-white rounded-2xl p-8 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 text-right`}
            >
              <div className="text-4xl mb-3">{mod.icon}</div>
              <h2 className="text-xl font-bold mb-1">{mod.nameAr}</h2>
              <p className="text-sm opacity-80">{mod.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
