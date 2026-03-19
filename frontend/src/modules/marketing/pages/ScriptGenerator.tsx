import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as mktApi from '../services/marketing-api';

interface Scene {
  id: string;
  order: number;
  description: string;
  cameraAngle?: string;
  setting?: string;
  textOverlay?: string;
  voiceover?: string;
  durationSec?: number;
}

interface Script {
  id: string;
  title: string;
  platform: string;
  language: string;
  status: string;
  project?: { name: string };
  idea?: { title: string };
  scenes: Scene[];
  _count?: { scenes: number; versions: number };
  createdAt: string;
}

export default function ScriptGenerator() {
  const queryClient = useQueryClient();
  const [selectedScript, setSelectedScript] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [form, setForm] = useState({
    projectId: '',
    platform: 'meta',
    audience: '',
    language: 'ar',
    ideaId: '',
    productName: '',
    productDescription: '',
    additionalNotes: '',
  });

  const { data: scriptsData } = useQuery({
    queryKey: ['scripts'],
    queryFn: () => mktApi.getScripts(),
  });

  const { data: scriptDetail } = useQuery({
    queryKey: ['script', selectedScript],
    queryFn: () => mktApi.getScript(selectedScript!),
    enabled: !!selectedScript,
  });

  const { data: projectsData } = useQuery({
    queryKey: ['mkt-projects'],
    queryFn: () => mktApi.getProjects(),
  });

  const { data: ideasData } = useQuery({
    queryKey: ['ideas'],
    queryFn: () => mktApi.getIdeas(),
  });

  const generateMutation = useMutation({
    mutationFn: (data: typeof form) => mktApi.generateScript(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
      setSelectedScript(res.data.script.id);
      setShowForm(false);
      setGenerating(false);
    },
    onError: () => setGenerating(false),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      mktApi.updateScriptStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
      queryClient.invalidateQueries({ queryKey: ['script', selectedScript] });
    },
  });

  const scripts: Script[] = scriptsData?.data?.scripts || [];
  const script: Script | null = scriptDetail?.data?.script || null;
  const projects = projectsData?.data?.projects || [];
  const ideas = ideasData?.data?.ideas || [];

  const handleGenerate = () => {
    if (!form.projectId) return;
    setGenerating(true);
    generateMutation.mutate(form);
  };

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    APPROVED: 'bg-green-100 text-green-700',
    IN_PRODUCTION: 'bg-blue-100 text-blue-700',
    DONE: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="p-6" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Script Generator</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
        >
          + Generate Script
        </button>
      </div>

      {/* AI Generation Form */}
      {showForm && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">AI Script Generation</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Project *</label>
              <select
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">Select project...</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Platform</label>
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="meta">Meta / Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="snapchat">Snapchat</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Language</label>
              <select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="ar">Arabic</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Linked Idea</label>
              <select
                value={form.ideaId}
                onChange={(e) => setForm({ ...form, ideaId: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">None</option>
                {ideas.map((i: any) => (
                  <option key={i.id} value={i.id}>{i.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Product Name</label>
              <input
                value={form.productName}
                onChange={(e) => setForm({ ...form, productName: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="e.g. Dual Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Target Audience</label>
              <input
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="e.g. Young couples looking for gifts"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Product Description</label>
              <textarea
                value={form.productDescription}
                onChange={(e) => setForm({ ...form, productDescription: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                rows={2}
                placeholder="Describe the product..."
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Additional Notes</label>
              <textarea
                value={form.additionalNotes}
                onChange={(e) => setForm({ ...form, additionalNotes: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                rows={2}
                placeholder="Any specific requirements..."
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating || !form.projectId}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {generating ? 'Generating with AI...' : 'Generate Script'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="border px-4 py-2 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
          {generateMutation.isError && (
            <p className="text-red-500 mt-2 text-sm">
              Error: {(generateMutation.error as any)?.response?.data?.error || 'Failed to generate'}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Scripts List */}
        <div className="col-span-1 bg-white rounded-lg border">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Scripts ({scripts.length})</h3>
          </div>
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {scripts.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedScript(s.id)}
                className={`w-full text-right p-4 hover:bg-gray-50 ${selectedScript === s.id ? 'bg-purple-50 border-r-4 border-purple-600' : ''}`}
              >
                <div className="font-medium text-sm">{s.title}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {s.project?.name} - {s.platform}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[s.status] || 'bg-gray-100'}`}>
                    {s.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    {s._count?.scenes || 0} scenes
                  </span>
                </div>
              </button>
            ))}
            {scripts.length === 0 && (
              <p className="p-4 text-gray-400 text-sm">No scripts yet. Generate one!</p>
            )}
          </div>
        </div>

        {/* Script Detail */}
        <div className="col-span-2">
          {script ? (
            <div className="bg-white rounded-lg border">
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">{script.title}</h2>
                  <p className="text-sm text-gray-500">
                    {script.project?.name} - {script.platform} - {script.language === 'ar' ? 'Arabic' : 'English'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <select
                    value={script.status}
                    onChange={(e) => statusMutation.mutate({ id: script.id, status: e.target.value })}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="APPROVED">Approved</option>
                    <option value="IN_PRODUCTION">In Production</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>
              </div>
              <div className="p-4 space-y-4">
                {script.scenes.map((scene) => (
                  <div key={scene.id} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">
                        Scene {scene.order}
                        {scene.durationSec && ` (${scene.durationSec}s)`}
                      </span>
                      <div className="flex gap-2 text-xs text-gray-500">
                        {scene.cameraAngle && <span className="bg-white px-2 py-0.5 rounded">{scene.cameraAngle}</span>}
                        {scene.setting && <span className="bg-white px-2 py-0.5 rounded">{scene.setting}</span>}
                      </div>
                    </div>
                    <p className="text-sm mb-2">{scene.description}</p>
                    {scene.textOverlay && (
                      <p className="text-sm text-purple-700 bg-purple-50 px-2 py-1 rounded mb-1">
                        Text: {scene.textOverlay}
                      </p>
                    )}
                    {scene.voiceover && (
                      <p className="text-sm text-blue-700 bg-blue-50 px-2 py-1 rounded">
                        VO: {scene.voiceover}
                      </p>
                    )}
                  </div>
                ))}
                {script.scenes.length === 0 && (
                  <p className="text-gray-400 text-center py-8">No scenes in this script</p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border p-8 text-center text-gray-400">
              Select a script or generate a new one
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
