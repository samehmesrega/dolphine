import { Routes, Route, Navigate } from 'react-router-dom';
import MarketingShell from './components/MarketingShell';
import Dashboard from './pages/Dashboard';
import CreativeLibrary from './pages/CreativeLibrary';
import CreativeDetail from './pages/CreativeDetail';
import CreativeRequests from './pages/CreativeRequests';
import IdeasBank from './pages/IdeasBank';
import CompetitorLibrary from './pages/CompetitorLibrary';
import ScriptGenerator from './pages/ScriptGenerator';
import ContentCalendar from './pages/ContentCalendar';
import MediaBuying from './pages/MediaBuying';
import MetaOAuthCallback from './pages/MetaOAuthCallback';
import CreativeForm from './pages/CreativeForm';
import LandingPages from './pages/LandingPages';
import LandingPageEditor from './pages/LandingPageEditor';
import Settings from './pages/Settings';

export default function MarketingModule() {
  return (
    <MarketingShell>
      <Routes>
        <Route path="/" element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="creatives" element={<CreativeLibrary />} />
        <Route path="creatives/new" element={<CreativeForm />} />
        <Route path="creatives/:id" element={<CreativeDetail />} />
        <Route path="requests" element={<CreativeRequests />} />
        <Route path="ideas" element={<IdeasBank />} />
        <Route path="competitors" element={<CompetitorLibrary />} />
        <Route path="scripts" element={<ScriptGenerator />} />
        <Route path="calendar" element={<ContentCalendar />} />
        <Route path="media-buying" element={<MediaBuying />} />
        <Route path="media-buying/oauth/meta/callback" element={<MetaOAuthCallback />} />
        <Route path="landing-pages" element={<LandingPages />} />
        <Route path="landing-pages/:id" element={<LandingPageEditor />} />
        <Route path="settings" element={<Settings />} />
      </Routes>
    </MarketingShell>
  );
}
