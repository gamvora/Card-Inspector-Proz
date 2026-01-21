import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiRequest } from './queryClient';

interface User {
  id: number;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  credits: number;
  totalCharged: number;
  totalRejected: number;
  isAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (initData: string) => Promise<boolean>;
  refreshUser: () => Promise<void>;
  telegramId: string | null;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
        };
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
        };
      };
    };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [telegramId, setTelegramId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const login = async (initData: string): Promise<boolean> => {
    try {
      const response = await apiRequest('POST', '/api/auth/login', { initData });
      const data = await response.json();
      
      if (data.user && data.token) {
        setUser(data.user);
        setTelegramId(data.user.telegramId);
        setToken(data.token);
        localStorage.setItem('telegramId', data.user.telegramId);
        localStorage.setItem('authToken', data.token);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const refreshUser = async () => {
    const storedToken = localStorage.getItem('authToken');
    const storedTelegramId = localStorage.getItem('telegramId');
    if (!storedToken && !storedTelegramId) return;

    try {
      const headers: Record<string, string> = {};
      if (storedToken) {
        headers['Authorization'] = `Bearer ${storedToken}`;
      } else if (storedTelegramId) {
        headers['x-telegram-id'] = storedTelegramId;
      }
      
      const response = await fetch('/api/auth/me', { headers });
      const data = await response.json();
      if (data.user) {
        setUser(data.user);
        setTelegramId(data.user.telegramId);
        if (storedToken) setToken(storedToken);
      }
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      
      // Check for stored token first
      const storedToken = localStorage.getItem('authToken');
      if (storedToken) {
        setToken(storedToken);
        await refreshUser();
        if (user) {
          setIsLoading(false);
          return;
        }
      }
      
      // Check for Telegram WebApp
      const tg = window.Telegram?.WebApp;
      if (tg && tg.initData) {
        tg.ready();
        tg.expand();
        
        const success = await login(tg.initData);
        if (success) {
          setIsLoading(false);
          return;
        }
      }

      // Check localStorage for existing session
      const storedTelegramId = localStorage.getItem('telegramId');
      if (storedTelegramId) {
        await refreshUser();
        setIsLoading(false);
        return;
      }

      // Development mode: create a demo user for testing
      if (import.meta.env.DEV || !tg?.initData) {
        try {
          const res = await fetch('/api/auth/dev-login', { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            if (data.user && data.token) {
              setUser(data.user);
              setTelegramId(data.user.telegramId);
              setToken(data.token);
              localStorage.setItem('telegramId', data.user.telegramId);
              localStorage.setItem('authToken', data.token);
            }
          }
        } catch (e) {
          console.log('Dev login not available');
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoading, 
      isAuthenticated: !!user,
      login,
      refreshUser,
      telegramId,
      token,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function getTelegramId(): string | null {
  return localStorage.getItem('telegramId');
}

export function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const telegramId = getTelegramId();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (telegramId) {
    headers['x-telegram-id'] = telegramId;
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
}
