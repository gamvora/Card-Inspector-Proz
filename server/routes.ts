import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { WS_EVENTS, ADMIN_TELEGRAM_ID } from "@shared/schema";
import { spawn } from "child_process";
import path from "path";
import jwt from "jsonwebtoken";
import { telegramService } from "./services/telegram";
import { handleBotUpdate, initBot, sendChargedCardNotification } from "./services/telegramBot";
import { setWss } from "./services/wsManager";

const JWT_SECRET = process.env.SESSION_SECRET || 'nexus-checker-secret-key-2025';

interface AuthRequest extends Request {
  user?: {
    id: number;
    telegramId: string;
    isAdmin: boolean;
    credits: number;
  };
}

interface UserWebSocket extends WebSocket {
  userId?: number;
  telegramId?: string;
  isAlive?: boolean;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === WebSocket Setup with User Scoping ===
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  setWss(wss);

  // Broadcast to all clients (for global events only)
  const broadcastAll = (data: any) => {
    const payload = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  };

  // Broadcast to specific user only (for user-scoped events)
  const broadcastToUser = (userId: number | string, data: any) => {
    const payload = JSON.stringify(data);
    wss.clients.forEach((client) => {
      const userClient = client as UserWebSocket;
      if (userClient.readyState === WebSocket.OPEN) {
        if (userClient.userId === userId || userClient.telegramId === String(userId)) {
          userClient.send(payload);
        }
      }
    });
  };

  // Handle WebSocket connections with authentication
  wss.on('connection', (ws: UserWebSocket, req) => {
    ws.isAlive = true;
    
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Listen for auth message with token
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'auth' && data.token) {
          const decoded = jwt.verify(data.token, JWT_SECRET) as { telegramId: string; userId: number };
          ws.telegramId = decoded.telegramId;
          ws.userId = decoded.userId;
          ws.send(JSON.stringify({ type: 'auth_success' }));
        }
      } catch (e) {
        // Ignore invalid messages
      }
    });
  });

  // Ping interval to keep connections alive
  setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = ws as UserWebSocket;
      if (!client.isAlive) {
        return client.terminate();
      }
      client.isAlive = false;
      client.ping();
    });
  }, 30000);

  // Track online users from WebSocket connections
  const onlineUsersCache = new Map<string, { telegramId: string; userId: number; lastSeen: Date }>();
  
  const getOnlineUsers = async () => {
    const onlineList: Array<{ telegramId: string; userId: number; username: string | null; firstName: string | null; photoUrl: string | null }> = [];
    const seenIds = new Set<string>();
    
    const clients = Array.from(wss.clients) as UserWebSocket[];
    for (const userClient of clients) {
      if (userClient.readyState === WebSocket.OPEN && userClient.telegramId && !seenIds.has(userClient.telegramId)) {
        seenIds.add(userClient.telegramId);
        const user = await storage.getUserByTelegramId(userClient.telegramId);
        if (user) {
          onlineList.push({
            telegramId: userClient.telegramId,
            userId: user.id,
            username: user.username,
            firstName: user.firstName,
            photoUrl: user.photoUrl,
          });
        }
      }
    }
    return onlineList;
  };

  // === Job Management (Per-User) ===
  interface UserJob {
    isRunning: boolean;
    shouldStop: boolean;
    sessionId: string | null;
    processes: Set<ReturnType<typeof spawn>>;
    processed: number;
    total: number;
    charged: number;
    rejected: number;
  }
  
  const userJobs = new Map<number, UserJob>();
  
  const getUserJob = (userId: number): UserJob => {
    if (!userJobs.has(userId)) {
      userJobs.set(userId, {
        isRunning: false,
        shouldStop: false,
        sessionId: null,
        processes: new Set(),
        processed: 0,
        total: 0,
        charged: 0,
        rejected: 0,
      });
    }
    return userJobs.get(userId)!;
  };

  const killUserProcesses = (userId: number) => {
    const job = getUserJob(userId);
    job.shouldStop = true;
    job.isRunning = false;
    
    // Kill all processes with SIGKILL for immediate termination
    job.processes.forEach(proc => {
      try {
        proc.kill('SIGTERM');
        // Force kill after 1 second if still running
        setTimeout(() => {
          try {
            proc.kill('SIGKILL');
          } catch (e) {}
        }, 1000);
      } catch (e) {}
    });
    job.processes.clear();
    job.sessionId = null;
    job.processed = 0;
    job.total = 0;
    job.charged = 0;
    job.rejected = 0;
  };

  const checkCardWithPython = (card: string, siteUrl: string, proxy: string, userId: number, onLog: (msg: string) => void): Promise<{status: string, message: string}> => {
    return new Promise((resolve) => {
      const job = getUserJob(userId);
      
      if (job.shouldStop) {
        resolve({ status: 'error', message: '[STOPPED] Cancelled by user' });
        return;
      }

      const scriptPath = path.join(process.cwd(), 'server', 'python', 'checker.py');
      
      const pythonProcess = spawn('python', [scriptPath, card, siteUrl, proxy], {
        timeout: 60000
      });
      
      job.processes.add(pythonProcess);
      
      let stdout = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        const logLines = data.toString().trim().split('\n');
        for (const line of logLines) {
          if (line.startsWith('[LOG]')) {
            onLog(line.replace('[LOG] ', ''));
          }
        }
      });
      
      pythonProcess.on('close', (code) => {
        job.processes.delete(pythonProcess);
        
        if (job.shouldStop) {
          resolve({ status: 'error', message: '[STOPPED] Cancelled by user' });
          return;
        }
        
        try {
          const lines = stdout.trim().split('\n');
          // Find the last valid JSON line (search from end)
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('{') && line.endsWith('}')) {
              try {
                const result = JSON.parse(line);
                if (result.status && result.message) {
                  resolve(result);
                  return;
                }
              } catch (parseErr) {
                // Try next line
              }
            }
          }
          // No valid JSON found
          resolve({ 
            status: 'error', 
            message: '[ERROR] Invalid response from checker' 
          });
        } catch (e) {
          resolve({ 
            status: 'error', 
            message: '[ERROR] Python script failed' 
          });
        }
      });
      
      pythonProcess.on('error', (err) => {
        job.processes.delete(pythonProcess);
        resolve({ status: 'error', message: `[ERROR] Process: ${err.message}` });
      });
    });
  };

  const getBatchSize = (totalCards: number) => Math.max(1, Math.ceil(totalCards / 2));

  // Check if card is expired (returns true if expired)
  const isCardExpired = (cardStr: string): boolean => {
    const parts = cardStr.split('|');
    if (parts.length < 3) return false;
    
    let month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    
    if (isNaN(month) || isNaN(year)) return false;
    
    // Handle 2-digit year (e.g., 25 -> 2025)
    if (year < 100) {
      year += 2000;
    }
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed
    
    // Card is expired if year is past, or if same year but month is past
    if (year < currentYear) return true;
    if (year === currentYear && month < currentMonth) return true;
    
    return false;
  };

  const processQueue = async (cards: string[], targetUrl: string, proxyListStr: string, userId: number, telegramId: string, sessionId: string, siteId?: number) => {
    const job = getUserJob(userId);
    job.isRunning = true;
    job.shouldStop = false;
    job.sessionId = sessionId;
    job.processed = 0;
    job.total = cards.length;
    job.charged = 0;
    job.rejected = 0;

    const proxies = proxyListStr.split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const total = cards.length;
    let processedCount = 0;
    let chargedCount = 0;
    let rejectedCount = 0;

    const allCards = cards
      .map(c => c.trim())
      .filter(c => c && c.includes('|'));

    // Calculate batch size for parallel processing (third of cards or max 10)
    const BATCH_SIZE = Math.min(Math.max(Math.ceil(allCards.length / 3), 1), 10);

    broadcastToUser(userId, { type: WS_EVENTS.STATUS_UPDATE, payload: { active: true, processed: 0, total: allCards.length } });
    broadcastToUser(userId, { type: WS_EVENTS.LOG, payload: { message: `Starting check on ${targetUrl}...`, type: 'info' } });
    broadcastToUser(userId, { type: WS_EVENTS.LOG, payload: { message: `${allCards.length} cards | ${proxies.length} proxies | Parallel: ${BATCH_SIZE}`, type: 'info' } });

    // Process cards in parallel batches
    for (let i = 0; i < allCards.length; i += BATCH_SIZE) {
      if (job.shouldStop) {
        broadcastToUser(userId, { type: WS_EVENTS.LOG, payload: { message: 'Stopped by user', type: 'info' } });
        break;
      }

      const batch = allCards.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allCards.length / BATCH_SIZE);
      
      broadcastToUser(userId, { type: WS_EVENTS.LOG, payload: { message: `Batch ${batchNum}/${totalBatches} - Processing ${batch.length} cards...`, type: 'info' } });

      // Process batch in parallel
      const batchPromises = batch.map(async (cardStr, idx) => {
        if (job.shouldStop) {
          return { success: false, stopped: true, charged: false };
        }

        const proxyIndex = (i + idx) % (proxies.length || 1);
        const currentProxy = proxies[proxyIndex] || '';

        // Check if card is expired first (fast check, no network)
        if (isCardExpired(cardStr)) {
          const saved = await storage.addResult({
            card: cardStr,
            status: 'dead',
            message: 'Expired Card',
            userId: userId,
            sessionId: sessionId,
          });
          
          broadcastToUser(userId, { type: WS_EVENTS.RESULT, payload: saved });
          await storage.updateUserStats(telegramId, 0, 1);
          return { success: true, stopped: false, charged: false };
        }

        // Process valid card with checker
        try {
          const onLog = (msg: string) => {
            if (job.shouldStop) return;
            const cardPrefix = cardStr.substring(0, 6);
            broadcastToUser(userId, { type: WS_EVENTS.LOG, payload: { message: `[${cardPrefix}] ${msg}`, type: 'info' } });
          };
          
          const result = await checkCardWithPython(cardStr, targetUrl, currentProxy, userId, onLog);
          
          if (job.shouldStop || result.message?.includes('[STOPPED]')) {
            return { success: false, stopped: true, charged: false };
          }
          
          let status = 'unknown';
          let isCharged = false;
          
          if (result.status === 'live') {
            status = 'live';
            isCharged = true;
          } else if (result.status === 'dead' || result.status === 'error') {
            status = 'dead';
          }

          const saved = await storage.addResult({
            card: cardStr,
            status: status,
            message: result.message || 'No message',
            userId: userId,
            sessionId: sessionId,
          });

          broadcastToUser(userId, { type: WS_EVENTS.RESULT, payload: saved });

          // Deduct 1 credit for this card
          const currentUser = await storage.getUserByTelegramId(telegramId);
          if (currentUser && !currentUser.isAdmin) {
            const updatedUser = await storage.updateUserCredits(telegramId, -1);
            if (updatedUser) {
              broadcastToUser(userId, { type: WS_EVENTS.CREDITS_UPDATE, payload: { credits: updatedUser.credits } });
            }
          }

          // Send charged card to Telegram bot
          if (isCharged && siteId) {
            const site = await storage.getSiteById(siteId);
            const siteName = site?.name || targetUrl;
            sendChargedCardNotification(telegramId, cardStr, siteName, result.message || 'Charged').catch(console.error);
          } else if (isCharged) {
            sendChargedCardNotification(telegramId, cardStr, targetUrl, result.message || 'Charged').catch(console.error);
          }

          return { success: true, stopped: false, charged: isCharged };
        } catch (e: any) {
          if (!job.shouldStop) {
            broadcastToUser(userId, { type: WS_EVENTS.LOG, payload: { message: `Error [${cardStr.substring(0, 6)}]: ${e.message}`, type: 'error' } });
          }
          return { success: false, stopped: job.shouldStop, charged: false };
        }
      });

      // Wait for all cards in batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      const actuallyProcessed = batchResults.filter(r => !r.stopped).length;
      const batchCharged = batchResults.filter(r => r.charged).length;
      const batchRejected = actuallyProcessed - batchCharged;
      
      processedCount += actuallyProcessed;
      chargedCount += batchCharged;
      rejectedCount += batchRejected;
      
      job.processed = processedCount;
      job.charged = chargedCount;
      job.rejected = rejectedCount;
      
      if (!job.shouldStop) {
        broadcastToUser(userId, { type: WS_EVENTS.STATUS_UPDATE, payload: { 
          active: true, 
          processed: processedCount, 
          total: allCards.length,
          charged: chargedCount,
          rejected: rejectedCount 
        }});
      }
    }

    // Update user stats
    await storage.updateUserStats(telegramId, chargedCount, rejectedCount);

    job.isRunning = false;
    job.sessionId = null;
    
    if (!job.shouldStop) {
      broadcastToUser(userId, { type: WS_EVENTS.STATUS_UPDATE, payload: { 
        active: false, 
        processed: processedCount, 
        total: allCards.length,
        charged: chargedCount,
        rejected: rejectedCount
      }});
      broadcastToUser(userId, { type: WS_EVENTS.LOG, payload: { message: `Finished! ${processedCount}/${allCards.length} processed. Charged: ${chargedCount} | Declined: ${rejectedCount}`, type: 'info' } });
    }
  };


  // === Auth Middleware with JWT Validation ===
  const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Try JWT token first (from Authorization header)
    const authHeader = req.headers['authorization'] as string;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET) as { telegramId: string; userId: number };
        const user = await storage.getUserByTelegramId(decoded.telegramId);
        if (user) {
          req.user = {
            id: user.id,
            telegramId: user.telegramId,
            isAdmin: user.isAdmin,
            credits: user.credits,
          };
          return next();
        }
      } catch (e) {
        // Token invalid, try fallback in dev mode only
      }
    }
    
    // Fallback to x-telegram-id ONLY in development mode
    if (process.env.NODE_ENV === 'development') {
      const telegramId = req.headers['x-telegram-id'] as string;
      if (telegramId) {
        const user = await storage.getUserByTelegramId(telegramId);
        if (user) {
          req.user = {
            id: user.id,
            telegramId: user.telegramId,
            isAdmin: user.isAdmin,
            credits: user.credits,
          };
          return next();
        }
      }
    }
    
    return res.status(401).json({ error: 'Unauthorized - valid token required' });
  };

  // === Auth Routes ===
  app.post(api.auth.login.path, async (req, res) => {
    try {
      const { initData } = req.body;
      const result = await telegramService.authenticateUser(initData);
      
      if (!result.success || !result.user) {
        return res.status(401).json({ error: result.error });
      }
      
      // Generate JWT token for secure auth
      const token = jwt.sign(
        { telegramId: result.user.telegramId, userId: result.user.id },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      res.json({ user: result.user, token });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Dev login endpoint removed - only Telegram authentication is supported
  // This prevents dev_tester from being created in production/testing environments

  app.get(api.auth.me.path, authMiddleware, async (req: AuthRequest, res) => {
    const user = await storage.getUserByTelegramId(req.user!.telegramId);
    res.json({ user });
  });

  // === Sites Routes ===
  app.get(api.sites.list.path, authMiddleware, async (req: AuthRequest, res) => {
    const sites = await storage.getUserSites(req.user!.id);
    res.json(sites);
  });

  app.post(api.sites.add.path, authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { name, url } = req.body;
      const site = await storage.addSite({
        userId: req.user!.id,
        name,
        url,
        isActive: false,
      });
      res.json(site);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put('/api/sites/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id as string);
      // Verify ownership
      const userSites = await storage.getUserSites(req.user!.id);
      const ownsSite = userSites.some(s => s.id === id);
      if (!ownsSite) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const { name, url } = req.body;
      const site = await storage.updateSite(id, { name, url });
      res.json(site);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete('/api/sites/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id as string);
      // Verify ownership
      const userSites = await storage.getUserSites(req.user!.id);
      const ownsSite = userSites.some(s => s.id === id);
      if (!ownsSite) {
        return res.status(403).json({ error: 'Access denied' });
      }
      await storage.deleteSite(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/sites/:id/activate', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const siteId = parseInt(req.params.id as string);
      // Verify ownership
      const userSites = await storage.getUserSites(req.user!.id);
      const ownsSite = userSites.some(s => s.id === siteId);
      if (!ownsSite) {
        return res.status(403).json({ error: 'Access denied' });
      }
      await storage.setActiveSite(req.user!.id, siteId);
      const site = await storage.getActiveSite(req.user!.id);
      res.json(site);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // === Proxies Routes ===
  app.get(api.proxies.list.path, authMiddleware, async (req: AuthRequest, res) => {
    const proxies = await storage.getUserProxies(req.user!.id);
    res.json(proxies);
  });

  app.post(api.proxies.add.path, authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { proxies: proxyList } = req.body;
      const added = [];
      for (const proxy of proxyList) {
        if (proxy.trim()) {
          const p = await storage.addProxy({
            userId: req.user!.id,
            proxy: proxy.trim(),
            isValid: true,
          });
          added.push(p);
        }
      }
      res.json(added);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post(api.proxies.validate.path, async (req, res) => {
    try {
      const { proxy } = req.body;
      // Simple validation - check format
      const parts = proxy.split(':');
      const isValid = parts.length >= 2;
      res.json({ valid: isValid, proxy });
    } catch (e: any) {
      res.status(400).json({ error: e.message, valid: false });
    }
  });

  app.post('/api/proxies/test', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { proxy } = req.body;
      if (!proxy) {
        return res.status(400).json({ error: 'Proxy required', valid: false });
      }

      const parts = proxy.split(':');
      if (parts.length < 2) {
        return res.status(400).json({ error: 'Invalid proxy format (host:port:user:pass)', valid: false });
      }

      const host = parts[0];
      const port = parseInt(parts[1]);
      const username = parts[2] || null;
      const password = parts[3] || null;

      if (isNaN(port) || port < 1 || port > 65535) {
        return res.json({
          valid: false,
          proxy,
          error: 'Invalid port number'
        });
      }

      // Build proxy URL for curl
      let proxyUrl = `http://${host}:${port}`;
      if (username && password) {
        proxyUrl = `http://${username}:${password}@${host}:${port}`;
      }

      // Test proxy with 2 requests to check IP and rotation
      const testProxyConnection = (): Promise<{ ip: string; time: number } | null> => {
        return new Promise((resolve) => {
          const startTime = Date.now();
          const { exec } = require('child_process');
          const cmd = `curl -x "${proxyUrl}" -s --connect-timeout 10 --max-time 15 "https://api.ipify.org?format=json"`;
          
          exec(cmd, { timeout: 20000 }, (error: any, stdout: string) => {
            if (error) {
              resolve(null);
              return;
            }
            try {
              const data = JSON.parse(stdout.trim());
              resolve({ ip: data.ip, time: Date.now() - startTime });
            } catch {
              resolve(null);
            }
          });
        });
      };

      // First request
      const result1 = await testProxyConnection();
      if (!result1) {
        return res.json({
          valid: false,
          proxy,
          error: 'Connection failed - proxy not working',
          ip: null,
          speed: null,
          isRotating: false
        });
      }

      // Small delay before second request
      await new Promise(r => setTimeout(r, 500));

      // Second request to check if IP changes (rotating)
      const result2 = await testProxyConnection();
      
      const isRotating = result2 ? result1.ip !== result2.ip : false;
      const avgSpeed = result2 ? Math.round((result1.time + result2.time) / 2) : result1.time;

      // Determine proxy type
      let proxyType = 'Static';
      if (isRotating) {
        proxyType = 'Rotating';
      } else if (host.includes('datacenter') || host.includes('dc')) {
        proxyType = 'Datacenter';
      } else if (host.includes('residential') || host.includes('resi')) {
        proxyType = 'Residential';
      }

      res.json({
        valid: true,
        proxy,
        type: proxyType,
        hasAuth: !!(username && password),
        ip1: result1.ip,
        ip2: result2?.ip || result1.ip,
        isRotating,
        speed: avgSpeed,
        status: 'working'
      });
    } catch (e: any) {
      res.status(400).json({ error: e.message, valid: false });
    }
  });

  app.delete('/api/proxies/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id as string);
      // Verify ownership
      const userProxies = await storage.getUserProxies(req.user!.id);
      const ownsProxy = userProxies.some(p => p.id === id);
      if (!ownsProxy) {
        return res.status(403).json({ error: 'Access denied' });
      }
      await storage.deleteProxy(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete(api.proxies.clear.path, authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.deleteAllUserProxies(req.user!.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // === Credits Routes ===
  app.get(api.credits.balance.path, authMiddleware, async (req: AuthRequest, res) => {
    const user = await storage.getUserByTelegramId(req.user!.telegramId);
    res.json({ credits: user?.credits || 0 });
  });

  app.post(api.credits.add.path, authMiddleware, async (req: AuthRequest, res) => {
    if (!req.user!.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    try {
      const { userId, amount } = req.body;
      const updatedUser = await storage.updateUserCredits(userId, amount);
      if (updatedUser) {
        await storage.addCreditTransaction(
          updatedUser.id,
          amount,
          amount > 0 ? 'admin_add' : 'admin_remove',
          'Added by admin',
          req.user!.telegramId
        );
      }
      res.json({ user: updatedUser });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get(api.credits.history.path, authMiddleware, async (req: AuthRequest, res) => {
    const transactions = await storage.getCreditTransactions(req.user!.id);
    res.json(transactions);
  });

  // === Settings Routes (Admin-only for global settings) ===
  app.get(api.settings.get.path, authMiddleware, async (req: AuthRequest, res) => {
    // Only admins can access global settings
    if (!req.user!.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const config = await storage.getSettings();
    if (!config) {
      return res.json({ targetUrl: '', proxyList: '', proxyEnabled: true });
    }
    res.json(config);
  });

  app.post(api.settings.update.path, authMiddleware, async (req: AuthRequest, res) => {
    // Only admins can modify global settings
    if (!req.user!.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    try {
      const input = api.settings.update.input.parse(req.body);
      const updated = await storage.updateSettings(input);
      res.json(updated);
    } catch (e) {
      res.status(400).json({ message: 'Invalid settings' });
    }
  });

  // === Check Routes ===
  app.post(api.check.start.path, authMiddleware, async (req: AuthRequest, res) => {
    const job = getUserJob(req.user!.id);
    if (job.isRunning) return res.status(400).json({ message: 'Job already running' });
    
    const { cards, siteId } = req.body;
    const user = await storage.getUserByTelegramId(req.user!.telegramId);
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Check credits
    if (user.credits < cards.length && !user.isAdmin) {
      return res.status(400).json({ message: `Insufficient credits. You have ${user.credits} credits but need ${cards.length}` });
    }

    // Get target URL from active site or fallback to settings
    let targetUrl = '';
    let proxyList = '';

    if (siteId) {
      const sites = await storage.getUserSites(user.id);
      const site = sites.find(s => s.id === siteId);
      if (site) targetUrl = site.url;
    }

    if (!targetUrl) {
      const activeSite = await storage.getActiveSite(user.id);
      if (activeSite) {
        targetUrl = activeSite.url;
      } else {
        const settings = await storage.getSettings();
        targetUrl = settings?.targetUrl || '';
      }
    }

    if (!targetUrl) {
      return res.status(400).json({ message: 'No target site configured. Please add a site in Settings.' });
    }

    // Get user proxies
    const userProxies = await storage.getUserProxies(user.id);
    proxyList = userProxies.map(p => p.proxy).join('\n');

    // Clear previous results
    await storage.clearResults(user.id);
    broadcastToUser(user.id, { type: WS_EVENTS.LOG, payload: { message: 'Cleared previous results', type: 'info' } });

    const sessionId = `${user.id}-${Date.now()}`;

    // Determine siteId for notifications
    const activeSite = await storage.getActiveSite(user.id);
    const effectiveSiteId = siteId || activeSite?.id;

    // Start background process
    processQueue(cards, targetUrl, proxyList, user.id, user.telegramId, sessionId, effectiveSiteId);
    
    res.json({ message: 'Job started', jobId: sessionId });
  });

  app.post(api.check.stop.path, authMiddleware, async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    killUserProcesses(userId);
    broadcastToUser(userId, { type: WS_EVENTS.STATUS_UPDATE, payload: { active: false, processed: 0, total: 0 } });
    broadcastToUser(userId, { type: WS_EVENTS.LOG, payload: { message: 'STOPPED - All processes killed', type: 'error' } });
    res.json({ message: 'Stopped' });
  });

  app.post(api.check.clear.path, authMiddleware, async (req: AuthRequest, res) => {
    await storage.clearResults(req.user!.id);
    res.json({ message: 'Cleared' });
  });
  
  app.get('/api/check/status', authMiddleware, async (req: AuthRequest, res) => {
    const job = getUserJob(req.user!.id);
    const results = await storage.getResults(200, req.user!.id);
    res.json({
      active: job.isRunning,
      processed: job.processed,
      total: job.total,
      charged: job.charged,
      rejected: job.rejected,
      sessionId: job.sessionId,
      results: results,
    });
  });
  
  app.get('/api/results', authMiddleware, async (req: AuthRequest, res) => {
    const data = await storage.getResults(200, req.user!.id);
    res.json(data);
  });

  // === Telegram Webhook ===
  app.post(api.telegram.webhook.path, async (req, res) => {
    try {
      await handleBotUpdate(req.body);
      res.json({ ok: true });
    } catch (e) {
      console.error('Webhook error:', e);
      res.status(500).json({ error: 'Webhook error' });
    }
  });

  // === Stats Route ===
  app.get('/api/stats', authMiddleware, async (req: AuthRequest, res) => {
    const user = await storage.getUserByTelegramId(req.user!.telegramId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      totalCharged: user.totalCharged,
      totalRejected: user.totalRejected,
      credits: user.credits,
    });
  });

  app.get('/api/stats/global', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const globalStats = await storage.getGlobalStats();
      res.json(globalStats);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/leaderboard', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const leaderboard = await storage.getLeaderboard(10);
      res.json(leaderboard);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/online-users', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const onlineUsers = await getOnlineUsers();
      res.json(onlineUsers);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Initialize Telegram bot (webhook in production, polling in development)
  initBot();

  return httpServer;
}
