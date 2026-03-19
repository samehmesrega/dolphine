import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as mktApi from '../services/marketing-api';

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  loading?: boolean;
}

export default function LandingPageEditor() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('desktop');
  const [showSettings, setShowSettings] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  const { data: pageData, refetch } = useQuery({
    queryKey: ['landing-page', id],
    queryFn: () => mktApi.getLandingPage(id!),
    enabled: !!id,
  });

  const { data: versionsData } = useQuery({
    queryKey: ['lp-versions', id],
    queryFn: () => mktApi.getLandingPageVersions(id!),
    enabled: !!id && showVersions,
  });

  const page = pageData?.data?.landingPage;
  const versions: any[] = versionsData?.data?.versions || [];

  // AI Edit mutation
  const editMutation = useMutation({
    mutationFn: (editRequest: string) => mktApi.aiEditLandingPage(id!, editRequest),
    onSuccess: () => {
      setChatMessages((prev) => [
        ...prev.filter((m) => !m.loading),
        { role: 'ai', text: 'تم التعديل بنجاح ✅' },
      ]);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['lp-versions', id] });
    },
    onError: (err: any) => {
      setChatMessages((prev) => [
        ...prev.filter((m) => !m.loading),
        { role: 'ai', text: `خطأ: ${err.response?.data?.error || err.message}` },
      ]);
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => mktApi.publishLandingPage(id!),
    onSuccess: () => refetch(),
  });

  const unpublishMutation = useMutation({
    mutationFn: () => mktApi.unpublishLandingPage(id!),
    onSuccess: () => refetch(),
  });

  const rollbackMutation = useMutation({
    mutationFn: (versionId: string) => mktApi.rollbackLandingPage(id!, versionId),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['lp-versions', id] });
    },
  });

  const handleSendChat = () => {
    if (!chatInput.trim() || editMutation.isPending) return;

    setChatMessages((prev) => [
      ...prev,
      { role: 'user', text: chatInput },
      { role: 'ai', text: 'جاري التعديل...', loading: true },
    ]);

    editMutation.mutate(chatInput);
    setChatInput('');

    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // Field Mappings
  const [mappings, setMappings] = useState<Array<{ formFieldName: string; leadField: string }>>([]);
  const [mappingsLoaded, setMappingsLoaded] = useState(false);

  const { data: mappingsData } = useQuery({
    queryKey: ['lp-mappings', id],
    queryFn: () => mktApi.getLandingPageFieldMappings(id!),
    enabled: !!id && showSettings,
  });

  if (mappingsData?.data?.mappings && !mappingsLoaded) {
    setMappings(mappingsData.data.mappings.map((m: any) => ({
      formFieldName: m.formFieldName,
      leadField: m.leadField,
    })));
    setMappingsLoaded(true);
  }

  const saveMappingsMutation = useMutation({
    mutationFn: () => mktApi.updateLandingPageFieldMappings(id!, mappings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lp-mappings', id] }),
  });

  if (!page) {
    return <div className="p-6 text-center text-gray-400">جاري التحميل...</div>;
  }

  const previewWidth = previewMode === 'mobile' ? '375px' : '100%';

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-bold">{page.title}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            page.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' :
            page.status === 'ARCHIVED' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {page.status}
          </span>
          <span className="text-sm text-gray-400">v{page.versions?.[0]?.versionNumber || 1}</span>
        </div>
        <div className="flex items-center gap-2">
          {page.status === 'PUBLISHED' ? (
            <button
              onClick={() => unpublishMutation.mutate()}
              className="border border-red-300 text-red-600 px-3 py-1.5 rounded text-sm hover:bg-red-50"
            >
              إلغاء النشر
            </button>
          ) : (
            <button
              onClick={() => publishMutation.mutate()}
              className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700"
            >
              نشر
            </button>
          )}
          <button
            onClick={() => { setShowVersions(!showVersions); setShowSettings(false); }}
            className={`border px-3 py-1.5 rounded text-sm ${showVersions ? 'bg-purple-50 border-purple-300' : ''}`}
          >
            السجل
          </button>
          <button
            onClick={() => { setShowSettings(!showSettings); setShowVersions(false); }}
            className={`border px-3 py-1.5 rounded text-sm ${showSettings ? 'bg-purple-50 border-purple-300' : ''}`}
          >
            الإعدادات
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* AI Chat Panel */}
        <div className="w-80 border-l bg-gray-50 flex flex-col">
          <div className="p-3 border-b bg-white">
            <h3 className="font-semibold text-sm">تعديل بالـ AI</h3>
            <p className="text-xs text-gray-400">اكتب التعديل المطلوب بالعربي أو الإنجليزي</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center text-gray-400 text-sm mt-8">
                <p className="mb-2">أمثلة:</p>
                <p className="text-xs">"غيّر لون الزرار لأخضر"</p>
                <p className="text-xs">"أضف قسم آراء العملاء"</p>
                <p className="text-xs">"كبّر الخط الرئيسي"</p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-purple-600 text-white'
                    : msg.loading
                    ? 'bg-gray-200 text-gray-500 animate-pulse'
                    : 'bg-white border'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t bg-white">
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="اكتب التعديل..."
                className="flex-1 border rounded px-3 py-2 text-sm"
                disabled={editMutation.isPending}
              />
              <button
                onClick={handleSendChat}
                disabled={editMutation.isPending || !chatInput.trim()}
                className="bg-purple-600 text-white px-3 py-2 rounded text-sm disabled:opacity-50"
              >
                إرسال
              </button>
            </div>
          </div>
        </div>

        {/* Preview + Side Panels */}
        <div className="flex-1 flex flex-col">
          {/* Preview Controls */}
          <div className="bg-gray-100 border-b px-4 py-2 flex items-center justify-center gap-2">
            <button
              onClick={() => setPreviewMode('mobile')}
              className={`px-3 py-1 rounded text-sm ${previewMode === 'mobile' ? 'bg-white shadow' : ''}`}
            >
              موبايل
            </button>
            <button
              onClick={() => setPreviewMode('desktop')}
              className={`px-3 py-1 rounded text-sm ${previewMode === 'desktop' ? 'bg-white shadow' : ''}`}
            >
              ديسكتوب
            </button>
          </div>

          {/* Iframe Preview */}
          <div className="flex-1 bg-gray-200 flex items-start justify-center p-4 overflow-auto">
            <iframe
              ref={iframeRef}
              srcDoc={page.html}
              style={{ width: previewWidth, height: '100%', maxWidth: '100%' }}
              className="bg-white rounded shadow-lg border"
              title="Landing Page Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        {/* Side panels (Versions / Settings) */}
        {(showVersions || showSettings) && (
          <div className="w-72 border-r bg-white overflow-y-auto">
            {showVersions && (
              <div className="p-4">
                <h3 className="font-semibold mb-3">سجل الإصدارات</h3>
                <div className="space-y-2">
                  {versions.map((v: any) => (
                    <div key={v.id} className="border rounded p-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">v{v.versionNumber}</span>
                        <button
                          onClick={() => rollbackMutation.mutate(v.id)}
                          className="text-xs text-purple-600 hover:underline"
                        >
                          استرجاع
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{v.editPrompt || 'Initial'}</p>
                      <p className="text-xs text-gray-400">{new Date(v.createdAt).toLocaleString('ar-EG')}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showSettings && (
              <div className="p-4">
                <h3 className="font-semibold mb-3">ربط الحقول</h3>
                <p className="text-xs text-gray-500 mb-3">ربط حقول الفورم بحقول الليد</p>
                <div className="space-y-2">
                  {mappings.map((m, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        value={m.formFieldName}
                        onChange={(e) => {
                          const updated = [...mappings];
                          updated[i] = { ...updated[i], formFieldName: e.target.value };
                          setMappings(updated);
                        }}
                        placeholder="Form field"
                        className="flex-1 border rounded px-2 py-1 text-xs"
                        dir="ltr"
                      />
                      <span className="text-gray-400">→</span>
                      <select
                        value={m.leadField}
                        onChange={(e) => {
                          const updated = [...mappings];
                          updated[i] = { ...updated[i], leadField: e.target.value };
                          setMappings(updated);
                        }}
                        className="flex-1 border rounded px-2 py-1 text-xs"
                      >
                        <option value="name">name</option>
                        <option value="phone">phone</option>
                        <option value="email">email</option>
                        <option value="address">address</option>
                        <option value="whatsapp">whatsapp</option>
                      </select>
                      <button
                        onClick={() => setMappings(mappings.filter((_, j) => j !== i))}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        X
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setMappings([...mappings, { formFieldName: '', leadField: 'name' }])}
                    className="text-xs text-purple-600 hover:underline"
                  >
                    + إضافة حقل
                  </button>
                </div>
                <button
                  onClick={() => saveMappingsMutation.mutate()}
                  disabled={saveMappingsMutation.isPending}
                  className="mt-3 bg-purple-600 text-white px-3 py-1.5 rounded text-xs w-full"
                >
                  {saveMappingsMutation.isPending ? 'جاري الحفظ...' : 'حفظ الربط'}
                </button>

                <hr className="my-4" />

                <h3 className="font-semibold mb-2">معلومات</h3>
                <div className="text-xs space-y-1 text-gray-600">
                  <p>البراند: {page.brand?.name}</p>
                  <p dir="ltr" className="text-left">Slug: /{page.slug}</p>
                  {page.status === 'PUBLISHED' && (
                    <p dir="ltr" className="text-left text-green-600">
                      URL: /lp/{page.brand?.slug}/{page.slug}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
