import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertSettings, type CheckResult } from "@shared/schema";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

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
export function useStartCheck() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (cards: string[]) => {
      const res = await fetch(api.check.start.path, {
        method: api.check.start.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards }),
      });
      if (!res.ok) throw new Error("Failed to start check");
      return api.check.start.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      toast({
        title: "Sequence Initiated",
        description: "Card checking process started.",
        className: "border-primary text-primary font-mono",
      });
    },
  });
}

export function useStopCheck() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.check.stop.path, {
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
      const res = await fetch(api.check.clear.path, {
        method: api.check.clear.method,
      });
      if (!res.ok) throw new Error("Failed to clear results");
      return api.check.clear.responses[200].parse(await res.json());
    },
  });
}

// === WEBSOCKET HOOK ===
export function useCheckerSocket() {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [stats, setStats] = useState({ active: false, processed: 0, total: 0 });
  const [logs, setLogs] = useState<{ message: string; type: string }[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Determine protocol (ws or wss) based on current window location
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const { type, payload } = JSON.parse(event.data);
          
          if (type === 'result') {
            setResults((prev) => [payload, ...prev]);
          } else if (type === 'status_update') {
            setStats(payload);
          } else if (type === 'log') {
            setLogs((prev) => [payload, ...prev].slice(0, 50)); // Keep last 50 logs
          }
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };

      ws.onclose = () => {
        // Simple reconnect logic
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
    setStats(prev => ({ ...prev, processed: 0, total: 0 }));
  };

  return { results, stats, logs, clearLocalResults };
}
