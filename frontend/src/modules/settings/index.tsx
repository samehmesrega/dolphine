import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SettingsShell from './components/SettingsShell';

// Reuse existing pages from leads (will move files later in cleanup step)
const UsersPage = lazy(() => import('../leads/pages/UsersPage'));
const RolesPage = lazy(() => import('../leads/pages/RolesPage'));
const ProfilePage = lazy(() => import('../leads/pages/ProfilePage'));
const PendingUsersPage = lazy(() => import('./pages/PendingUsersPage'));

const Loading = () => <div className="p-8 text-center text-slate-400">جاري التحميل...</div>;

export default function SettingsModule() {
  return (
    <SettingsShell>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route index element={<Navigate to="users" replace />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="pending" element={<PendingUsersPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Routes>
      </Suspense>
    </SettingsShell>
  );
}
