import { Routes, Route, Navigate } from 'react-router-dom';
import MarketingShell from './components/MarketingShell';
import Dashboard from './pages/Dashboard';
import CreativeLibrary from './pages/CreativeLibrary';
import CreativeDetail from './pages/CreativeDetail';
import CreativeRequests from './pages/CreativeRequests';
import IdeasBank from './pages/IdeasBank';
import CompetitorLibrary from './pages/CompetitorLibrary';
import Settings from './pages/Settings';

export default function MarketingModule() {
  return (
    <MarketingShell>
      <Routes>
        <Route path="/" element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="creatives" element={<CreativeLibrary />} />
        <Route path="creatives/:id" element={<CreativeDetail />} />
        <Route path="requests" element={<CreativeRequests />} />
        <Route path="ideas" element={<IdeasBank />} />
        <Route path="competitors" element={<CompetitorLibrary />} />
        <Route path="settings" element={<Settings />} />
      </Routes>
    </MarketingShell>
  );
}
