import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../../../shared/services/api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: { id?: string; name: string; slug: string };
  permissions?: string[];
  modules?: string[];
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  hasPermission: (slug: string) => boolean;
  hasModuleAccess: (slug: string) => boolean;
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

  // Refresh user data on mount and every 10 minutes (keeps permissions fresh + detects token expiry)
  useEffect(() => {
    if (!token) return;

    const refreshUser = () => {
      api.get('/auth/me')
        .then(({ data }) => {
          const u = {
            ...data.user,
            permissions: data.user.permissions ?? [],
            modules: data.user.modules ?? [],
          };
          setUser(u);
          localStorage.setItem('dolphin_user', JSON.stringify(u));
        })
        .catch((err) => {
          if (err.response?.status === 401) {
            // Token expired — log out
            logout();
            window.location.href = '/login';
          }
        });
    };

    refreshUser();
    const interval = setInterval(refreshUser, 10 * 60 * 1000); // every 10 minutes
    return () => clearInterval(interval);
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    const u = {
      ...newUser,
      permissions: newUser.permissions ?? [],
      modules: newUser.modules ?? [],
    };
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

  const hasModuleAccess = (slug: string) => {
    if (user?.permissions?.includes('*')) return true;
    return user?.modules?.includes(slug) ?? false;
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, hasPermission, hasModuleAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
