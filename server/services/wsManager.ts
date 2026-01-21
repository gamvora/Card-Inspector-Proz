import { WebSocket, WebSocketServer } from "ws";

interface UserWebSocket extends WebSocket {
  userId?: number;
  telegramId?: string;
  isAlive?: boolean;
}

let wssInstance: WebSocketServer | null = null;

export function setWss(wss: WebSocketServer) {
  wssInstance = wss;
}

export function getWss(): WebSocketServer | null {
  return wssInstance;
}

export function broadcastToTelegramId(telegramId: string, data: any) {
  if (!wssInstance) return;
  
  const payload = JSON.stringify(data);
  wssInstance.clients.forEach((client) => {
    const userClient = client as UserWebSocket;
    if (userClient.readyState === WebSocket.OPEN && userClient.telegramId === telegramId) {
      userClient.send(payload);
    }
  });
}

export function broadcastToUserId(userId: number, data: any) {
  if (!wssInstance) return;
  
  const payload = JSON.stringify(data);
  wssInstance.clients.forEach((client) => {
    const userClient = client as UserWebSocket;
    if (userClient.readyState === WebSocket.OPEN && userClient.userId === userId) {
      userClient.send(payload);
    }
  });
}
