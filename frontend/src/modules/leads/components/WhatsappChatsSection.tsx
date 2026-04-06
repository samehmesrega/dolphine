import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../shared/services/api';

type ChatMessage = {
  text: string;
  timestamp: string;
  direction: 'in' | 'out';
};

type ChatSession = {
  id: string;
  phoneNumber: string;
  messages: ChatMessage[];
  messageCount: number;
  chatStartedAt: string;
  chatEndedAt: string;
  createdAt: string;
  agent: { id: string; name: string };
};

export default function WhatsappChatsSection({ leadId }: { leadId: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-sessions', leadId],
    queryFn: async () => {
      const { data } = await api.get(`/whatsapp-monitor/leads/${leadId}/sessions`);
      return data as { sessions: ChatSession[]; total: number };
    },
  });

  if (isLoading) {
    return (
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <h2 className="font-semibold text-slate-700 mb-2">محادثات واتساب</h2>
        <p className="text-slate-500 text-sm">جاري التحميل...</p>
      </div>
    );
  }

  if (!data?.sessions?.length) return null; // Don't show section if no chats

  return (
    <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <h2 className="font-semibold text-slate-700 p-4 border-b flex items-center gap-2">
        <span className="text-green-600">&#x1F4AC;</span>
        محادثات واتساب
        <span className="text-xs text-slate-400 font-normal">({data.total})</span>
      </h2>

      <ul className="divide-y">
        {data.sessions.map((s) => (
          <li key={s.id}>
            {/* Session Header */}
            <button
              type="button"
              onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-right"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-sm font-bold">
                  {s.messageCount}
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800">
                    {s.agent.name}
                    <span className="text-slate-400 font-normal mx-1">—</span>
                    <span className="text-slate-500 font-normal">{s.phoneNumber}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(s.chatStartedAt).toLocaleString('ar-EG')}
                    {' — '}
                    {new Date(s.chatEndedAt).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              <span className="text-slate-400 text-lg">{expandedId === s.id ? '▲' : '▼'}</span>
            </button>

            {/* Expanded Messages */}
            {expandedId === s.id && (
              <div className="px-4 pb-4 bg-slate-50 space-y-2 max-h-80 overflow-y-auto">
                {(s.messages as ChatMessage[]).map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.direction === 'out' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                        m.direction === 'out'
                          ? 'bg-green-100 text-green-900'
                          : 'bg-white text-slate-800 border border-slate-200'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.text}</p>
                      <div className={`text-[10px] mt-1 ${m.direction === 'out' ? 'text-green-600' : 'text-slate-400'}`}>
                        {new Date(m.timestamp).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
