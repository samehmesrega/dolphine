import { useState } from 'react';
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

function RoleCard({ role, allPermissions }: { role: Role; allPermissions: Permission[] }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(role.rolePermissions.map((rp) => rp.permission.id))
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.put(`/users/roles/${role.id}/permissions`, { permissionIds: Array.from(selected) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles-with-permissions'] });
    },
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isLocked = role.slug === 'super_admin';

  const grouped = allPermissions.reduce<Record<string, Permission[]>>((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">{role.name}</h3>
          {role.description && <p className="text-sm text-slate-500">{role.description}</p>}
          {isLocked && <p className="text-xs text-amber-600 mt-1">صلاحيات المدير العام لا يمكن تعديلها</p>}
        </div>
        {!isLocked && (
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-slate-700 text-white px-3 py-1.5 rounded text-sm hover:bg-slate-600 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
          </button>
        )}
      </div>

      {saveMutation.isSuccess && <p className="text-green-600 text-xs mb-3">تم الحفظ بنجاح.</p>}
      {saveMutation.isError && <p className="text-red-600 text-xs mb-3">حدث خطأ أثناء الحفظ.</p>}

      <div className="space-y-4">
        {Object.entries(grouped).map(([module, perms]) => (
          <div key={module}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{module}</p>
            <div className="grid grid-cols-2 gap-2">
              {perms.map((p) => (
                <label
                  key={p.id}
                  className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${
                    isLocked
                      ? 'border-slate-200 opacity-60 cursor-not-allowed'
                      : selected.has(p.id)
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isLocked || selected.has(p.id)}
                    onChange={() => !isLocked && toggle(p.id)}
                    disabled={isLocked}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{p.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{p.slug}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RolesPage() {
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

  if (loadingRoles || loadingPerms) {
    return <div className="text-slate-500">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">الأدوار والصلاحيات</h1>
        <p className="text-slate-600 text-sm mt-1">حدد صلاحيات كل دور. التغييرات تسري على المستخدمين عند تسجيل الدخول التالي.</p>
      </div>
      <div className="space-y-6">
        {(rolesData ?? []).map((role) => (
          <RoleCard key={role.id} role={role} allPermissions={permissionsData ?? []} />
        ))}
      </div>
    </div>
  );
}
