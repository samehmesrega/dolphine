import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: { id?: string; name: string; slug: string };
  permissions?: string[];
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  hasPermission: (slug: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('dolphin_token')
  );
  const [user, setUser] = useState<User | null>(() => {
    const u = localStorage.getItem('dolphin_user');
    return u ? JSON.parse(u) : null;
  });

  useEffect(() => {
    if (!token) return;
    const stored = localStorage.getItem('dolphin_user');
    const parsed = stored ? JSON.parse(stored) : null;
    if (parsed?.permissions != null && Array.isArray(parsed.permissions)) return;
    api.get('/auth/me')
      .then(({ data }) => {
        const u = { ...data.user, permissions: data.user.permissions ?? [] };
        setUser(u);
        localStorage.setItem('dolphin_user', JSON.stringify(u));
      })
      .catch(() => {});
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    const u = { ...newUser, permissions: newUser.permissions ?? [] };
    setUser(u);
    localStorage.setItem('dolphin_token', newToken);
    localStorage.setItem('dolphin_user', JSON.stringify(u));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('dolphin_token');
    localStorage.removeItem('dolphin_user');
  };

  const hasPermission = (slug: string) => {
    const perms = user?.permissions;
    if (!perms) return false;
    if (perms.includes('*')) return true;
    return perms.includes(slug);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
