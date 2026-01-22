import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { getAuthToken, getTelegramId } from "@/lib/auth";

interface CheckResult {
  id: number;
  card: string;
  status: string;
  message?: string | null;
}

interface Stats {
  active: boolean;
  processed: number;
  total: number;
  charged?: number;
  rejected?: number;
}

interface CheckerContextType {
  results: CheckResult[];
  stats: Stats;
  logs: { message: string; type: string }[];
  credits: number | null;
  isConnected: boolean;
  clearLocalResults: () => void;
  refreshCredits: () => Promise<void>;
  fetchCheckStatus: () => Promise<void>;
}

const CheckerContext = createContext<CheckerContextType | null>(null);

export function CheckerProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [stats, setStats] = useState<Stats>({ active: false, processed: 0, total: 0, charged: 0, rejected: 0 });
  const [logs, setLogs] = useState<{ message: string; type: string }[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const refreshCredits = useCallback(async () => {
    try {
      const token = getAuthToken();
      const telegramId = getTelegramId();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else if (telegramId) {
        headers['x-telegram-id'] = telegramId;
      }
      const res = await fetch('/api/auth/me', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.user?.credits !== undefined) {
          setCredits(data.user.credits);
        }
      }
    } catch (e) {
      console.error('Failed to refresh credits', e);
    }
  }, []);

  const fetchCheckStatus = useCallback(async () => {
    try {
      const token = getAuthToken();
      const telegramId = getTelegramId();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else if (telegramId) {
        headers['x-telegram-id'] = telegramId;
      }
      const res = await fetch('/api/check/status', { headers });
      if (res.ok) {
        const data = await res.json();
        setStats({
          active: data.active || false,
          processed: data.processed || 0,
          total: data.total || 0,
          charged: data.charged || 0,
          rejected: data.rejected || 0,
        });
        if (data.results && Array.isArray(data.results)) {
          setResults(data.results);
        }
      }
    } catch (e) {
      console.error('Failed to fetch check status', e);
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshCredits();
        fetchCheckStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    const creditsInterval = setInterval(refreshCredits, 30000);
    const statusInterval = setInterval(fetchCheckStatus, 5000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(creditsInterval);
      clearInterval(statusInterval);
    };
  }, [refreshCredits, fetchCheckStatus]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    const connect = () => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        return;
      }

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        refreshCredits();
        fetchCheckStatus();
        const token = getAuthToken();
        if (token) {
          ws.send(JSON.stringify({ type: 'auth', token }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const { type, payload } = JSON.parse(event.data);
          
          if (type === 'auth_success') {
            console.log('WebSocket authenticated');
          } else if (type === 'result') {
            setResults((prev) => [payload, ...prev]);
          } else if (type === 'status_update') {
            setStats(payload);
          } else if (type === 'log') {
            setLogs((prev) => [payload, ...prev].slice(0, 50));
          } else if (type === 'credits_update') {
            setCredits(payload.credits);
          }
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [refreshCredits, fetchCheckStatus]);

  const clearLocalResults = useCallback(() => {
    setResults([]);
    setLogs([]);
    setStats(prev => ({ ...prev, processed: 0, total: 0, charged: 0, rejected: 0 }));
  }, []);

  return (
    <CheckerContext.Provider value={{
      results,
      stats,
      logs,
      credits,
      isConnected,
      clearLocalResults,
      refreshCredits,
      fetchCheckStatus,
    }}>
      {children}
    </CheckerContext.Provider>
  );
}

export function useCheckerContext() {
  const context = useContext(CheckerContext);
  if (!context) {
    throw new Error("useCheckerContext must be used within a CheckerProvider");
  }
  return context;
}
