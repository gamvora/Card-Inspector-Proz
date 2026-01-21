import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertSettings, type CheckResult } from "@shared/schema";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { authFetch, getAuthToken, getTelegramId } from "@/lib/auth";

// === SETTINGS HOOKS ===
export function useSettings() {
  return useQuery({
    queryKey: [api.settings.get.path],
    queryFn: async () => {
      const res = await fetch(api.settings.get.path);
      if (!res.ok) throw new Error("Failed to fetch settings");
      return api.settings.get.responses[200].parse(await res.json());
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: InsertSettings) => {
      const res = await fetch(api.settings.update.path, {
        method: api.settings.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update settings");
      return api.settings.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.settings.get.path] });
      toast({
        title: "System Updated",
        description: "Configuration parameters saved successfully.",
        className: "border-primary text-primary font-mono",
      });
    },
  });
}

// === CHECKER ACTIONS ===
interface StartCheckParams {
  cards: string[];
  siteId?: number;
}

export function useStartCheck() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ cards, siteId }: StartCheckParams) => {
      const res = await authFetch(api.check.start.path, {
        method: api.check.start.method,
        body: JSON.stringify({ cards, siteId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to start check");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sequence Initiated",
        description: "Card checking process started.",
        className: "border-primary text-primary font-mono",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useStopCheck() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const res = await authFetch(api.check.stop.path, {
        method: api.check.stop.method,
      });
      if (!res.ok) throw new Error("Failed to stop check");
      return api.check.stop.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      toast({
        title: "Sequence Halted",
        description: "Process stopped by user.",
        variant: "destructive",
        className: "font-mono",
      });
    },
  });
}

export function useClearResults() {
  return useMutation({
    mutationFn: async () => {
      const res = await authFetch(api.check.clear.path, {
        method: api.check.clear.method,
      });
      if (!res.ok) throw new Error("Failed to clear results");
      return api.check.clear.responses[200].parse(await res.json());
    },
  });
}

interface Stats {
  active: boolean;
  processed: number;
  total: number;
  charged?: number;
  rejected?: number;
}

// === WEBSOCKET HOOK ===
export function useCheckerSocket() {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [stats, setStats] = useState<Stats>({ active: false, processed: 0, total: 0, charged: 0, rejected: 0 });
  const [logs, setLogs] = useState<{ message: string; type: string }[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  const refreshCredits = async () => {
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
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshCredits();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    const interval = setInterval(refreshCredits, 30000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        refreshCredits();
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
        setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const clearLocalResults = () => {
    setResults([]);
    setLogs([]);
    setStats(prev => ({ ...prev, processed: 0, total: 0, charged: 0, rejected: 0 }));
  };

  return { results, stats, logs, credits, clearLocalResults, isConnected };
}
