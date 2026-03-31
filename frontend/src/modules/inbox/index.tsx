import { Routes, Route, Navigate } from 'react-router-dom';
import InboxShell from './components/InboxShell';
import InboxLayout from './pages/InboxLayout';
import InboxStats from './pages/InboxStats';
import ChannelSettings from './pages/ChannelSettings';

export default function InboxModule() {
  return (
    <InboxShell>
      <Routes>
        <Route path="/" element={<Navigate to="conversations" replace />} />
        <Route path="conversations" element={<InboxLayout />} />
        <Route path="conversations/:id" element={<InboxLayout />} />
        <Route path="comments" element={<InboxLayout />} />
        <Route path="comments/:id" element={<InboxLayout />} />
        <Route path="stats" element={<InboxStats />} />
        <Route path="settings" element={<ChannelSettings />} />
      </Routes>
    </InboxShell>
  );
}
