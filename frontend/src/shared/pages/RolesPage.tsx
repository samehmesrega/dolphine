import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

type Permission = {
  id: string;
  name: string;
  slug: string;
  module: string;
  description: string | null;
};

type Role = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  rolePermissions: { permission: Permission }[];
};

const MODULE_LABELS: Record<string, { name: string; color: string; bg: string; border: string }> = {
  leads: { name: 'ليدز', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  marketing: { name: 'ماركتنج', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  'knowledge-base': { name: 'بنك المعلومات', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  inbox: { name: 'إنبوكس', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  settings: { name: 'إعدادات', color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
  'dual-name': { name: 'Dual Name', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
};

function Tooltip({ text, slug }: { text: string; slug: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="w-4 h-4 inline-flex items-center justify-center rounded-full border border-slate-300 text-slate-400 text-[10px] hover:bg-slate-100 hover:text-slate-600 transition cursor-help"
      >
        ?
      </button>
      {show && (
        <div className="absolute z-50 bottom-full right-0 mb-2 w-56 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-lg pointer-events-none">
          <p className="leading-relaxed">{text}</p>
          <p className="mt-1.5 pt-1.5 border-t border-slate-600 text-slate-400 font-mono text-[10px]">{slug}</p>
        </div>
      )}
    </span>
  );
}

export default function RolesPage() {
  const queryClient = useQueryClient();

  const { data: rolesData, isLoading: loadingRoles } = useQuery({
    queryKey: ['roles-with-permissions'],
    queryFn: async () => {
      const { data } = await api.get<{ roles: Role[] }>('/users/roles');
      return data.roles;
    },
  });

  const { data: permissionsData, isLoading: loadingPerms } = useQuery({
    queryKey: ['all-permissions'],
    queryFn: async () => {
      const { data } = await api.get<{ permissions: Permission[] }>('/users/permissions');
      return data.permissions;
    },
  });

  const roles = rolesData ?? [];
  const allPermissions = permissionsData ?? [];

  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);

  // When role changes, load its permissions
  const selectedRole = roles.find(r => r.id === selectedRoleId);

  const selectRole = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    setSelectedRoleId(roleId);
    setSelected(new Set(role?.rolePermissions.map(rp => rp.permission.id) ?? []));
    setDirty(false);
  };

  // Auto-select first role on load
  if (roles.length > 0 && !selectedRoleId) {
    selectRole(roles[0].id);
  }

  const isLocked = selectedRole?.slug === 'super_admin';

  // Group permissions by module
  const grouped = useMemo(() => {
    const g: Record<string, Permission[]> = {};
    for (const p of allPermissions) {
      if (!g[p.module]) g[p.module] = [];
      g[p.module].push(p);
    }
    return g;
  }, [allPermissions]);

  const toggle = (id: string) => {
    if (isLocked) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setDirty(true);
  };

  const toggleModule = (modulePerms: Permission[]) => {
    if (isLocked) return;
    const allSelected = modulePerms.every(p => selected.has(p.id));
    setSelected(prev => {
      const next = new Set(prev);
      modulePerms.forEach(p => allSelected ? next.delete(p.id) : next.add(p.id));
      return next;
    });
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.put(`/users/roles/${selectedRoleId}/permissions`, { permissionIds: Array.from(selected) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles-with-permissions'] });
      setDirty(false);
    },
  });

  const activeCount = selected.size;
  const totalCount = allPermissions.length;

  if (loadingRoles || loadingPerms) {
    return <div className="p-8 text-slate-500 text-center">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">الأدوار والصلاحيات</h1>
        <p className="text-slate-500 text-sm mt-1">اختر الدور وعدّل صلاحياته. التغييرات تسري عند تسجيل الدخول التالي.</p>
      </div>

      {/* Role Dropdown */}
      <div className="bg-white rounded-xl shadow p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <label className="text-sm font-medium text-slate-700">الدور:</label>
          <select
            value={selectedRoleId}
            onChange={e => selectRole(e.target.value)}
            className="border border-slate-300 rounded-lg px-4 py-2 text-sm bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 min-w-[200px]"
          >
            {roles.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
            {activeCount}/{totalCount} صلاحية
          </span>
          {isLocked && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
              صلاحيات المدير العام لا يمكن تعديلها
            </span>
          )}
        </div>
      </div>

      {/* Permissions by Module */}
      {selectedRole && (
        <div className="space-y-4">
          {Object.entries(grouped).map(([module, perms]) => {
            const meta = MODULE_LABELS[module] || { name: module, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' };
            const moduleAllSelected = perms.every(p => selected.has(p.id));
            const moduleSomeSelected = perms.some(p => selected.has(p.id));
            const moduleActiveCount = perms.filter(p => selected.has(p.id)).length;

            return (
              <div key={module} className={`bg-white rounded-xl shadow border ${meta.border} overflow-hidden`}>
                {/* Module Header */}
                <div className={`${meta.bg} px-5 py-3 flex items-center justify-between border-b ${meta.border}`}>
                  <div className="flex items-center gap-3">
                    <label className={`flex items-center gap-2 cursor-pointer ${isLocked ? 'cursor-not-allowed opacity-60' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isLocked || moduleAllSelected}
                        ref={el => { if (el) el.indeterminate = !moduleAllSelected && moduleSomeSelected && !isLocked; }}
                        onChange={() => toggleModule(perms)}
                        disabled={isLocked}
                        className="rounded border-slate-400"
                      />
                      <span className={`text-sm font-semibold ${meta.color}`}>{meta.name}</span>
                    </label>
                    <span className="text-xs text-slate-400">{moduleActiveCount}/{perms.length}</span>
                  </div>
                </div>

                {/* Permissions Grid */}
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {perms.map(p => (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition cursor-pointer ${
                        isLocked
                          ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                          : selected.has(p.id)
                          ? `border-amber-300 bg-amber-50`
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isLocked || selected.has(p.id)}
                        onChange={() => toggle(p.id)}
                        disabled={isLocked}
                        className="rounded border-slate-400 shrink-0"
                      />
                      <span className="text-sm text-slate-700 flex-1">{p.name}</span>
                      <Tooltip text={p.description || p.name} slug={p.slug} />
                    </label>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Save Button */}
          {!isLocked && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !dirty}
                className="bg-amber-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition"
              >
                {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
              </button>
              {saveMutation.isSuccess && !dirty && (
                <span className="text-green-600 text-sm">تم الحفظ بنجاح</span>
              )}
              {saveMutation.isError && (
                <span className="text-red-600 text-sm">حدث خطأ أثناء الحفظ</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
