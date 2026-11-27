import { createContext, useContext, useMemo, useState } from 'react';
import client from '../api/client';
import { AuthUser, Role } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: { firstName: string; lastName: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readUser(): AuthUser | null {
  const raw = localStorage.getItem('lms_user');
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function homeForRole(role: Role): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'INSTRUCTOR') return '/instructor';
  return '/learner';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readUser);
  const [token, setToken] = useState<string | null>(localStorage.getItem('lms_token'));

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      async login(email, password) {
        const { data } = await client.post('/auth/login', { email, password });
        localStorage.setItem('lms_token', data.accessToken);
        localStorage.setItem('lms_user', JSON.stringify(data.user));
        setToken(data.accessToken);
        setUser(data.user);
        return data.user as AuthUser;
      },
      async register(input) {
        await client.post('/auth/register', input);
      },
      logout() {
        localStorage.removeItem('lms_token');
        localStorage.removeItem('lms_user');
        setToken(null);
        setUser(null);
      },
    }),
    [user, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
