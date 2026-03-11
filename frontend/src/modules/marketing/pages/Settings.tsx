import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCreativeCodeConfig, getProjects, createProject } from '../services/marketing-api';
import { useState } from 'react';

export default function MarketingSettings() {
  const qc = useQueryClient();
  const [newProject, setNewProject] = useState({ name: '', slug: '', language: 'ar' });

  const { data: configData } = useQuery({
    queryKey: ['marketing', 'creative-code-config'],
    queryFn: () => getCreativeCodeConfig(),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['marketing', 'projects'],
    queryFn: () => getProjects(),
  });

  const createProjectMutation = useMutation({
    mutationFn: () => createProject(newProject),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing', 'projects'] });
      setNewProject({ name: '', slug: '', language: 'ar' });
    },
  });

  const config = configData?.data?.config;
  const projects = projectsData?.data?.projects ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">إعدادات التسويق</h1>

      {/* Projects */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">المشاريع</h2>
        <div className="space-y-2 mb-4">
          {projects.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
              <div>
                <span className="font-medium">{p.name}</span>
                <span className="text-slate-500 text-xs mr-2">({p.slug})</span>
              </div>
              <span className="text-xs text-slate-500">{p._count?.creatives ?? 0} كرييتيف</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newProject.name}
            onChange={(e) => setNewProject((p) => ({ ...p, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
            placeholder="اسم المشروع"
            className="border rounded-lg px-3 py-2 text-sm flex-1"
          />
          <select
            value={newProject.language}
            onChange={(e) => setNewProject((p) => ({ ...p, language: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="ar">عربي</option>
            <option value="en">English</option>
          </select>
          <button
            onClick={() => newProject.name && createProjectMutation.mutate()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
          >
            إضافة
          </button>
        </div>
      </div>

      {/* Creative Code Config */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">إعدادات كود الكرييتيف</h2>
        {config ? (
          <div className="space-y-3">
            <div className="text-sm text-slate-600">
              <p>الفاصل: <code className="bg-slate-100 px-1 rounded">{config.separator}</code></p>
              <p>عدد الأرقام التسلسلية: {config.seqDigits}</p>
            </div>
            <div>
              <h3 className="font-medium text-slate-700 mb-2">الأقسام:</h3>
              {(config.segments as any[]).sort((a: any, b: any) => a.order - b.order).map((seg: any, i: number) => (
                <div key={i} className="bg-slate-50 rounded-lg p-3 mb-2">
                  <span className="font-medium">{seg.name}</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {seg.values.map((v: any) => (
                      <span key={v.code} className="px-2 py-0.5 bg-white border rounded text-xs">
                        {v.code} = {v.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              مثال: 1-2-3-001 (عربي - Print In - Dual Name - تسلسلي)
            </p>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">جاري التحميل...</p>
        )}
      </div>
    </div>
  );
}
