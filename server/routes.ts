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
import { searchTracks as spotifySearch, getAccessTokenForClient, playTrack as spotifyPlayTrack } from "./services/spotify";

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
        timeout: 90000
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
          // Handle empty output
          if (!stdout.trim()) {
            resolve({ status: 'error', message: 'Invalid Response' });
            return;
          }
          
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
          resolve({ status: 'error', message: 'Invalid Response' });
        } catch (e) {
          resolve({ status: 'error', message: 'Invalid Response' });
        }
      });
      
      pythonProcess.on('error', (err) => {
        job.processes.delete(pythonProcess);
        resolve({ status: 'error', message: 'Invalid Response' });
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

    // Shuffle cards randomly to avoid pattern detection
    for (let i = allCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
    }

    // Calculate batch size for parallel processing (fifth of cards or max 10)
    const BATCH_SIZE = Math.min(Math.max(Math.ceil(allCards.length / 5), 1), 10);

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

      // Process batch in parallel with small random delay for anti-detection
      const batchPromises = batch.map(async (cardStr, idx) => {
        if (job.shouldStop) {
          return { success: false, stopped: true, charged: false };
        }

        // Add small random delay (0.5-1.5s) per card position to avoid pattern detection
        if (idx > 0) {
          const delay = 500 + Math.random() * 1000; // 0.5-1.5 seconds
          await new Promise(r => setTimeout(r, delay));
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
          
          let result = await checkCardWithPython(cardStr, targetUrl, currentProxy, userId, onLog);
          
          // Retry once if Invalid Response (use different proxy if available)
          if (result.message === 'Invalid Response' && !job.shouldStop) {
            const retryProxyIndex = (proxyIndex + 1) % (proxies.length || 1);
            const retryProxy = proxies[retryProxyIndex] || currentProxy;
            broadcastToUser(userId, { type: WS_EVENTS.LOG, payload: { message: `[${cardStr.substring(0, 6)}] Invalid Response - Retrying with new proxy...`, type: 'info' } });
            
            // Wait 2 seconds before retry to let proxy/site settle
            await new Promise(r => setTimeout(r, 2000));
            result = await checkCardWithPython(cardStr, targetUrl, retryProxy, userId, onLog);
          }
          
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

  // === Tutorial Routes ===
  app.post('/api/tutorial/complete', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const updatedUser = await storage.markTutorialSeen(req.user!.telegramId);
      res.json({ success: true, user: updatedUser });
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
    
    const { cards: rawCards, siteId } = req.body;
    
    // Normalize cards input - accept both array and newline-separated string
    const cards = Array.isArray(rawCards) 
      ? rawCards 
      : (typeof rawCards === 'string' ? rawCards.split('\n').filter((c: string) => c.trim()) : []);
    
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

  // Music Search API (using Deezer - free, no API key needed)
  app.get('/api/music/search', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: 'Search query required' });
      }

      let results: any[] = [];

      // Use Deezer API (free, reliable, no API key required)
      try {
        console.log('[Music] Searching Deezer for:', query);
        const response = await fetch(
          `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=10`,
          { 
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000)
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data.length > 0) {
            results = data.data.slice(0, 8).map((track: any) => ({
              id: track.id.toString(),
              title: track.title,
              artist: track.artist?.name || 'Unknown',
              channel: track.artist?.name || 'Unknown',
              thumbnail: track.album?.cover_medium || track.album?.cover || '',
              duration: formatDurationSeconds(track.duration || 0),
              previewUrl: track.preview,
              deezerId: track.id
            }));
            console.log(`[Music] Found ${results.length} results from Deezer`);
          }
        }
      } catch (e: any) {
        console.log('[Music] Deezer failed:', e.message);
      }

      // Fallback to local library if Deezer fails
      if (results.length === 0) {
        console.log('[Music] Deezer failed, using local library');
        const popularSongs = [
          // K-Pop
          { id: 'gdZLi9oWNZg', title: 'Dynamite - BTS', duration: '3:43', channel: 'BTS' },
          { id: 'WMweEpGlu_U', title: 'Boy With Luv - BTS ft. Halsey', duration: '4:12', channel: 'BTS' },
          { id: 'MBdVXkSdhwU', title: 'Butter - BTS', duration: '3:00', channel: 'BTS' },
          { id: 'pBuZEGYXA6E', title: 'Permission to Dance - BTS', duration: '3:37', channel: 'BTS' },
          { id: 'XsX3ATc3FbA', title: 'Spring Day - BTS', duration: '4:35', channel: 'BTS' },
          { id: 'ioNng23DkIM', title: 'How You Like That - BLACKPINK', duration: '3:01', channel: 'BLACKPINK' },
          { id: 'POe9SOEKotk', title: 'Pink Venom - BLACKPINK', duration: '3:07', channel: 'BLACKPINK' },
          { id: 'CKZvWhCqx1s', title: 'Kill This Love - BLACKPINK', duration: '3:15', channel: 'BLACKPINK' },
          { id: '2S24-y0Ij3Y', title: 'DDU-DU DDU-DU - BLACKPINK', duration: '3:36', channel: 'BLACKPINK' },
          { id: 'IHNzOHi8sJs', title: 'Psycho - Red Velvet', duration: '3:32', channel: 'Red Velvet' },
          { id: '3ymwOvzhwHs', title: 'Next Level - aespa', duration: '3:42', channel: 'aespa' },
          { id: 'WPdWvnAAurg', title: 'Super Shy - NewJeans', duration: '2:34', channel: 'NewJeans' },
          // Pop Hits
          { id: '7wtfhZwyrcc', title: 'Believer - Imagine Dragons', duration: '3:24', channel: 'Imagine Dragons' },
          { id: 'ktvTqknDobU', title: 'Radioactive - Imagine Dragons', duration: '4:21', channel: 'Imagine Dragons' },
          { id: 'sENM2wA_FTg', title: 'Thunder - Imagine Dragons', duration: '3:24', channel: 'Imagine Dragons' },
          { id: 'mWRsgZuwf_8', title: 'Whatever It Takes - Imagine Dragons', duration: '3:21', channel: 'Imagine Dragons' },
          { id: 'gOsM-DYAEhY', title: 'Natural - Imagine Dragons', duration: '3:09', channel: 'Imagine Dragons' },
          { id: 'JGwWNGJdvx8', title: 'Shape of You - Ed Sheeran', duration: '4:24', channel: 'Ed Sheeran' },
          { id: '2Vv-BfVoq4g', title: 'Perfect - Ed Sheeran', duration: '4:23', channel: 'Ed Sheeran' },
          { id: 'lp-EO5I60KA', title: 'Thinking Out Loud - Ed Sheeran', duration: '4:57', channel: 'Ed Sheeran' },
          { id: 'orJSJGHjBLI', title: 'Photograph - Ed Sheeran', duration: '4:19', channel: 'Ed Sheeran' },
          { id: '60ItHLz5WEA', title: 'Faded - Alan Walker', duration: '3:33', channel: 'Alan Walker' },
          { id: 'IcrbM1l_BoI', title: 'Alone - Alan Walker', duration: '2:57', channel: 'Alan Walker' },
          { id: 'J9NQFACZYEU', title: 'Darkside - Alan Walker', duration: '3:32', channel: 'Alan Walker' },
          { id: 'viNRKSMpJ-0', title: 'The Spectre - Alan Walker', duration: '3:15', channel: 'Alan Walker' },
          // Arabic
          { id: 'rVzRkNL3XNo', title: 'Ah W Noss - Nancy Ajram', duration: '4:02', channel: 'Nancy Ajram' },
          { id: 'gFuqYQmCQm4', title: 'Enta Eih - Nancy Ajram', duration: '5:15', channel: 'Nancy Ajram' },
          { id: 'yvnGpUt-WbU', title: 'Tamally Maak - Amr Diab', duration: '4:25', channel: 'Amr Diab' },
          { id: '5HVsHs8vCkI', title: 'Nour El Ain - Amr Diab', duration: '5:01', channel: 'Amr Diab' },
          { id: 'JRfuAukYTKg', title: 'Habibi Ya Nour El Ain - Amr Diab', duration: '5:04', channel: 'Amr Diab' },
          { id: 'kYQxFE4Gx4A', title: 'Boshret Kheir - Hussain Al Jassmi', duration: '3:44', channel: 'Hussain Al Jassmi' },
          { id: 'LjOmcG7hRBk', title: 'Aa Bali Habibi - Elissa', duration: '4:45', channel: 'Elissa' },
          { id: 'g3rA-qi4BWQ', title: 'Saharna Ya Lail - Elissa', duration: '4:20', channel: 'Elissa' },
          { id: 'gupCkL_mHwY', title: '3 Daqat - Abu ft. Yousra', duration: '3:47', channel: 'Abu' },
          { id: 'nrAq1rlAH6E', title: 'Ergaaly - Sherine', duration: '5:08', channel: 'Sherine' },
          { id: 'DP4VgEzJJY4', title: 'Smile - Tamer Hosny', duration: '4:10', channel: 'Tamer Hosny' },
          // Latin
          { id: 'ru0K8uYEZWw', title: 'Despacito - Luis Fonsi ft. Daddy Yankee', duration: '4:41', channel: 'Luis Fonsi' },
          { id: 'kJQP7kiw5Fk', title: 'Despacito (Official) - Luis Fonsi', duration: '4:41', channel: 'Luis Fonsi' },
          { id: 'moSFlvxnbgk', title: 'Shakira - Hips Dont Lie', duration: '3:38', channel: 'Shakira' },
          { id: 'pRpeEdMmmQ0', title: 'Shakira - Waka Waka', duration: '3:31', channel: 'Shakira' },
          { id: 'DUT5rEU6pqM', title: 'Shakira - La Tortura', duration: '3:35', channel: 'Shakira' },
          { id: 'GxBSyx85Kp8', title: 'Bad Bunny - Dakiti', duration: '3:26', channel: 'Bad Bunny' },
          { id: 'TmKh7lAwnBI', title: 'Bad Bunny x Jhay Cortez - Dakiti', duration: '3:26', channel: 'Bad Bunny' },
          // Pop Icons
          { id: 'RgKAFK5djSk', title: 'See You Again - Wiz Khalifa ft. Charlie Puth', duration: '4:05', channel: 'Wiz Khalifa' },
          { id: 'YQHsXMglC9A', title: 'Hello - Adele', duration: '6:07', channel: 'Adele' },
          { id: 'hLQl3WQQoQ0', title: 'Someone Like You - Adele', duration: '4:45', channel: 'Adele' },
          { id: 'rYEDA3JcQqw', title: 'Rolling in the Deep - Adele', duration: '3:48', channel: 'Adele' },
          { id: '4NRXx6U8ABQ', title: 'Blinding Lights - The Weeknd', duration: '4:22', channel: 'The Weeknd' },
          { id: 'XXYlFuWEuKI', title: 'Starboy - The Weeknd', duration: '4:16', channel: 'The Weeknd' },
          { id: 'fHI8X4OXluQ', title: 'The Hills - The Weeknd', duration: '4:02', channel: 'The Weeknd' },
          { id: 'DyDfgMOUjCI', title: 'Bad Guy - Billie Eilish', duration: '3:14', channel: 'Billie Eilish' },
          { id: 'Dm9Zfao3vSU', title: 'Lovely - Billie Eilish & Khalid', duration: '3:20', channel: 'Billie Eilish' },
          { id: 'pbMwTqkKSps', title: 'Ocean Eyes - Billie Eilish', duration: '3:24', channel: 'Billie Eilish' },
          // Rock/Alternative
          { id: 'kXYiU_JCYtU', title: 'Numb - Linkin Park', duration: '3:07', channel: 'Linkin Park' },
          { id: 'eVTXPUF4Oz4', title: 'In The End - Linkin Park', duration: '3:36', channel: 'Linkin Park' },
          { id: 'Gd9OhYroLN0', title: 'What Ive Done - Linkin Park', duration: '3:25', channel: 'Linkin Park' },
          { id: '1w7OgIMMRc4', title: 'Cant Feel My Face - The Weeknd', duration: '3:35', channel: 'The Weeknd' },
          { id: 'hT_nvWreIhg', title: 'Counting Stars - OneRepublic', duration: '4:44', channel: 'OneRepublic' },
          { id: 'QcIy9NiNbmo', title: 'Take Me To Church - Hozier', duration: '4:38', channel: 'Hozier' },
          // Electronic/Dance
          { id: 'PT2_F-1esPk', title: 'Something Just Like This - Coldplay & The Chainsmokers', duration: '4:07', channel: 'Coldplay' },
          { id: '1-xGerv5FOk', title: 'Closer - The Chainsmokers ft. Halsey', duration: '4:22', channel: 'The Chainsmokers' },
          { id: 'mRD0-GxqHVo', title: 'Dont Let Me Down - The Chainsmokers', duration: '3:28', channel: 'The Chainsmokers' },
          { id: 'FM7MFYoylVs', title: 'Paris - The Chainsmokers', duration: '3:41', channel: 'The Chainsmokers' },
          { id: 'bo_efYhYU2A', title: 'The Nights - Avicii', duration: '2:56', channel: 'Avicii' },
          { id: 'IcrbM1l_BoI', title: 'Wake Me Up - Avicii', duration: '4:07', channel: 'Avicii' },
          { id: 'sAebYQgy4n4', title: 'Waiting For Love - Avicii', duration: '3:50', channel: 'Avicii' },
          { id: 'cMg8KaMdDYo', title: 'Hey Brother - Avicii', duration: '4:18', channel: 'Avicii' },
          // Pop Queens
          { id: 'CevxZvSJLk8', title: 'Roar - Katy Perry', duration: '4:30', channel: 'Katy Perry' },
          { id: 'QYh6mYIJG2Y', title: 'Firework - Katy Perry', duration: '3:52', channel: 'Katy Perry' },
          { id: 'nfWlot6h_JM', title: 'Shake It Off - Taylor Swift', duration: '4:01', channel: 'Taylor Swift' },
          { id: 'e-ORhEE9VVg', title: 'Blank Space - Taylor Swift', duration: '4:33', channel: 'Taylor Swift' },
          { id: 'ApXoWvfEYVU', title: 'Anti-Hero - Taylor Swift', duration: '3:21', channel: 'Taylor Swift' },
          { id: 'WA4iX5D9Z64', title: 'Love Story - Taylor Swift', duration: '3:56', channel: 'Taylor Swift' },
          { id: 'oygrmJFKYZY', title: 'Levitating - Dua Lipa', duration: '3:23', channel: 'Dua Lipa' },
          { id: 'F4neLJQC1_E', title: 'Dont Start Now - Dua Lipa', duration: '3:03', channel: 'Dua Lipa' },
          { id: 'k2qgadSvNyU', title: 'New Rules - Dua Lipa', duration: '3:35', channel: 'Dua Lipa' },
          // Hip Hop/Rap
          { id: 'uxpDa-c-4Mc', title: 'One Dance - Drake ft. Wizkid', duration: '2:54', channel: 'Drake' },
          { id: 'xpVfcZ0ZcFM', title: 'Gods Plan - Drake', duration: '5:57', channel: 'Drake' },
          { id: 'JFm7YDVlqnI', title: 'Hotline Bling - Drake', duration: '4:27', channel: 'Drake' },
          { id: 'RsEZmictANA', title: 'Happy - Pharrell Williams', duration: '4:00', channel: 'Pharrell Williams' },
          { id: 'ZbZSe6N_BXs', title: 'Happy (Official) - Pharrell Williams', duration: '4:00', channel: 'Pharrell Williams' },
          { id: 'uelHwf8o7_U', title: 'Love Yourself - Justin Bieber', duration: '3:53', channel: 'Justin Bieber' },
          { id: 'fRh_vgS2dFE', title: 'Sorry - Justin Bieber', duration: '3:26', channel: 'Justin Bieber' },
          { id: 'kffacxfA7G4', title: 'Baby - Justin Bieber ft. Ludacris', duration: '3:33', channel: 'Justin Bieber' },
          // Post Malone
          { id: 'SC4xMk98Pdc', title: 'Sunflower - Post Malone', duration: '2:38', channel: 'Post Malone' },
          { id: 'UceaB4D0jpo', title: 'Circles - Post Malone', duration: '3:35', channel: 'Post Malone' },
          { id: 'ApXoWvfEYVU', title: 'Rockstar - Post Malone', duration: '3:38', channel: 'Post Malone' },
          // Maroon 5
          { id: '09R8_2nJtjg', title: 'Sugar - Maroon 5', duration: '5:01', channel: 'Maroon 5' },
          { id: 'aJOTlE1K90k', title: 'Memories - Maroon 5', duration: '3:09', channel: 'Maroon 5' },
          { id: 'iS1g8G_njx8', title: 'Girls Like You - Maroon 5 ft. Cardi B', duration: '3:55', channel: 'Maroon 5' },
          // Charlie Puth
          { id: 'e9ieAz_2oEs', title: 'Attention - Charlie Puth', duration: '3:31', channel: 'Charlie Puth' },
          { id: 'CnAmeh0-E-U', title: 'We Dont Talk Anymore - Charlie Puth ft. Selena Gomez', duration: '3:37', channel: 'Charlie Puth' },
          // Classics
          { id: 'oofSnsGkops', title: 'Havana - Camila Cabello', duration: '3:37', channel: 'Camila Cabello' },
          { id: 'kOkQ4T5WO9E', title: 'Senorita - Shawn Mendes & Camila Cabello', duration: '3:11', channel: 'Shawn Mendes' },
          { id: 'xo1VInw-SKc', title: 'Stitches - Shawn Mendes', duration: '3:27', channel: 'Shawn Mendes' }
        ];

        const searchLower = query.toLowerCase();
        results = popularSongs
          .filter(s => s.title.toLowerCase().includes(searchLower) || s.channel.toLowerCase().includes(searchLower))
          .slice(0, 8)
          .map(s => ({ ...s, thumbnail: `https://i.ytimg.com/vi/${s.id}/hqdefault.jpg` }));

        if (results.length === 0) {
          results = popularSongs.slice(0, 8).map(s => ({ ...s, thumbnail: `https://i.ytimg.com/vi/${s.id}/hqdefault.jpg` }));
        }
      }

      res.json({ results });
    } catch (e: any) {
      console.error('[Music] Search error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  function formatDurationSeconds(seconds: number): string {
    if (!seconds || seconds === 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Spotify Token API (for Web Playback SDK)
  app.get('/api/spotify/token', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { accessToken, clientId } = await getAccessTokenForClient();
      res.json({ accessToken, clientId });
    } catch (e: any) {
      console.error('[Spotify] Token error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // Spotify Play Track API
  app.put('/api/spotify/play', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { uri, deviceId } = req.body;
      if (!uri || !deviceId) {
        return res.status(400).json({ error: 'URI and deviceId required' });
      }

      await spotifyPlayTrack(uri, deviceId);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Spotify] Play error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // Spotify Search API
  app.get('/api/spotify/search', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: 'Search query required' });
      }

      console.log('[Spotify] Searching for:', query);
      const results = await spotifySearch(query, 8);
      console.log('[Spotify] Found', results.length, 'tracks');
      
      res.json({ results });
    } catch (e: any) {
      console.error('[Spotify] Search error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // YouTube Search API (using Official YouTube Data API v3 with fallback)
  app.get('/api/youtube/search', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: 'Search query required' });
      }

      const apiKey = process.env.GOOGLE_API_KEY;
      
      // Try YouTube Data API v3 first
      if (apiKey) {
        try {
          console.log('[YouTube API] Attempting search with API key...');
          const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=8&q=${encodeURIComponent(query + ' music')}&key=${apiKey}`,
            { 
              headers: { 'Accept': 'application/json' },
              signal: AbortSignal.timeout(5000)
            }
          );

          if (response.ok) {
            const data = await response.json();
            console.log('[YouTube API] Success! Found', data.items?.length || 0, 'results');
            if (data.items && data.items.length > 0) {
              const results = data.items.map((item: any) => ({
                id: item.id.videoId,
                title: item.snippet.title,
                thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
                duration: '',
                channel: item.snippet.channelTitle
              }));
              return res.json({ results });
            }
          } else {
            const errorData = await response.json();
            console.log('[YouTube API] Error:', JSON.stringify(errorData.error || errorData));
          }
        } catch (e: any) {
          console.log('[YouTube API] Exception:', e.message);
        }
      } else {
        console.log('[YouTube API] No API key configured');
      }

      // Fallback: Extended library of popular songs
      const popularSongs = [
        // BTS
        { id: 'gdZLi9oWNZg', title: 'Dynamite - BTS', duration: '3:43', channel: 'BTS' },
        { id: 'WMweEpGlu_U', title: 'Boy With Luv - BTS ft. Halsey', duration: '4:12', channel: 'BTS' },
        { id: 'MBdVXkSdhwU', title: 'Butter - BTS', duration: '3:00', channel: 'BTS' },
        { id: 'pBuZEGYXA6E', title: 'Permission to Dance - BTS', duration: '3:37', channel: 'BTS' },
        // BLACKPINK
        { id: 'ioNng23DkIM', title: 'How You Like That - BLACKPINK', duration: '3:01', channel: 'BLACKPINK' },
        { id: 'POe9SOEKotk', title: 'Pink Venom - BLACKPINK', duration: '3:07', channel: 'BLACKPINK' },
        { id: 'CKZvWhCqx1s', title: 'Kill This Love - BLACKPINK', duration: '3:15', channel: 'BLACKPINK' },
        { id: '2S24-y0Ij3Y', title: 'DDU-DU DDU-DU - BLACKPINK', duration: '3:36', channel: 'BLACKPINK' },
        // Imagine Dragons
        { id: '7wtfhZwyrcc', title: 'Believer - Imagine Dragons', duration: '3:24', channel: 'Imagine Dragons' },
        { id: 'ktvTqknDobU', title: 'Radioactive - Imagine Dragons', duration: '4:21', channel: 'Imagine Dragons' },
        { id: 'sENM2wA_FTg', title: 'Thunder - Imagine Dragons', duration: '3:24', channel: 'Imagine Dragons' },
        { id: 'mWRsgZuwf_8', title: 'Whatever It Takes - Imagine Dragons', duration: '3:21', channel: 'Imagine Dragons' },
        // Ed Sheeran
        { id: 'JGwWNGJdvx8', title: 'Shape of You - Ed Sheeran', duration: '4:24', channel: 'Ed Sheeran' },
        { id: '2Vv-BfVoq4g', title: 'Perfect - Ed Sheeran', duration: '4:23', channel: 'Ed Sheeran' },
        { id: 'lp-EO5I60KA', title: 'Thinking Out Loud - Ed Sheeran', duration: '4:57', channel: 'Ed Sheeran' },
        // Alan Walker
        { id: '60ItHLz5WEA', title: 'Faded - Alan Walker', duration: '3:33', channel: 'Alan Walker' },
        { id: 'IcrbM1l_BoI', title: 'Alone - Alan Walker', duration: '2:57', channel: 'Alan Walker' },
        { id: 'J9NQFACZYEU', title: 'Darkside - Alan Walker', duration: '3:32', channel: 'Alan Walker' },
        // Arabic songs
        { id: 'rVzRkNL3XNo', title: 'Ah W Noss - Nancy Ajram', duration: '4:02', channel: 'Nancy Ajram' },
        { id: 'yvnGpUt-WbU', title: 'Tamally Maak - Amr Diab', duration: '4:25', channel: 'Amr Diab' },
        { id: '5HVsHs8vCkI', title: 'Nour El Ain - Amr Diab', duration: '5:01', channel: 'Amr Diab' },
        { id: 'LjOmcG7hRBk', title: 'Aa Bali Habibi - Elissa', duration: '4:45', channel: 'Elissa' },
        { id: 'kYQxFE4Gx4A', title: 'Boshret Kheir - Hussain Al Jassmi', duration: '3:44', channel: 'Hussain Al Jassmi' },
        // More hits
        { id: 'ru0K8uYEZWw', title: 'Despacito - Luis Fonsi ft. Daddy Yankee', duration: '4:41', channel: 'Luis Fonsi' },
        { id: 'RgKAFK5djSk', title: 'See You Again - Wiz Khalifa ft. Charlie Puth', duration: '4:05', channel: 'Wiz Khalifa' },
        { id: 'hT_nvWreIhg', title: 'Counting Stars - OneRepublic', duration: '4:44', channel: 'OneRepublic' },
        { id: 'YQHsXMglC9A', title: 'Hello - Adele', duration: '6:07', channel: 'Adele' },
        { id: 'PT2_F-1esPk', title: 'Something Just Like This - Coldplay', duration: '4:07', channel: 'Coldplay' },
        { id: '1-xGerv5FOk', title: 'Closer - The Chainsmokers ft. Halsey', duration: '4:22', channel: 'The Chainsmokers' },
        { id: 'kXYiU_JCYtU', title: 'Numb - Linkin Park', duration: '3:07', channel: 'Linkin Park' },
        { id: 'eVTXPUF4Oz4', title: 'In The End - Linkin Park', duration: '3:36', channel: 'Linkin Park' },
        { id: 'oofSnsGkops', title: 'Havana - Camila Cabello', duration: '3:37', channel: 'Camila Cabello' },
        { id: 'uelHwf8o7_U', title: 'Love Yourself - Justin Bieber', duration: '3:53', channel: 'Justin Bieber' },
        { id: 'fRh_vgS2dFE', title: 'Sorry - Justin Bieber', duration: '3:26', channel: 'Justin Bieber' },
        { id: 'nfWlot6h_JM', title: 'Shake It Off - Taylor Swift', duration: '4:01', channel: 'Taylor Swift' },
        { id: 'e-ORhEE9VVg', title: 'Blank Space - Taylor Swift', duration: '4:33', channel: 'Taylor Swift' },
        { id: 'ApXoWvfEYVU', title: 'Anti-Hero - Taylor Swift', duration: '3:21', channel: 'Taylor Swift' },
        { id: 'bo_efYhYU2A', title: 'The Nights - Avicii', duration: '2:56', channel: 'Avicii' },
        { id: 'IcrbM1l_BoI', title: 'Wake Me Up - Avicii', duration: '4:07', channel: 'Avicii' },
        { id: 'CevxZvSJLk8', title: 'Roar - Katy Perry', duration: '4:30', channel: 'Katy Perry' },
        { id: 'e9ieAz_2oEs', title: 'Attention - Charlie Puth', duration: '3:31', channel: 'Charlie Puth' },
        // Drake
        { id: 'uxpDa-c-4Mc', title: 'One Dance - Drake ft. Wizkid', duration: '2:54', channel: 'Drake' },
        { id: 'xpVfcZ0ZcFM', title: "God's Plan - Drake", duration: '5:57', channel: 'Drake' },
        // The Weeknd
        { id: 'XXYlFuWEuKI', title: 'Starboy - The Weeknd', duration: '4:16', channel: 'The Weeknd' },
        { id: '4NRXx6U8ABQ', title: 'Blinding Lights - The Weeknd', duration: '4:22', channel: 'The Weeknd' },
        // Dua Lipa
        { id: 'oygrmJFKYZY', title: 'Levitating - Dua Lipa', duration: '3:23', channel: 'Dua Lipa' },
        { id: 'F4neLJQC1_E', title: "Don't Start Now - Dua Lipa", duration: '3:03', channel: 'Dua Lipa' },
        // Bad Bunny
        { id: 'TmKh7lAwnBI', title: 'Dakiti - Bad Bunny x Jhay Cortez', duration: '3:26', channel: 'Bad Bunny' },
        // Billie Eilish
        { id: 'DyDfgMOUjCI', title: 'Bad Guy - Billie Eilish', duration: '3:14', channel: 'Billie Eilish' },
        { id: 'Dm9Zfao3vSU', title: 'Lovely - Billie Eilish & Khalid', duration: '3:20', channel: 'Billie Eilish' },
        // Post Malone
        { id: 'ApXoWvfEYVU', title: 'Circles - Post Malone', duration: '3:35', channel: 'Post Malone' },
        { id: 'SC4xMk98Pdc', title: 'Sunflower - Post Malone', duration: '2:38', channel: 'Post Malone' },
        // Maroon 5
        { id: '09R8_2nJtjg', title: 'Sugar - Maroon 5', duration: '5:01', channel: 'Maroon 5' },
        { id: 'aJOTlE1K90k', title: 'Memories - Maroon 5', duration: '3:09', channel: 'Maroon 5' }
      ];

      const searchLower = query.toLowerCase();
      let results = popularSongs
        .filter(s => 
          s.title.toLowerCase().includes(searchLower) || 
          s.channel.toLowerCase().includes(searchLower)
        )
        .slice(0, 8)
        .map(s => ({
          ...s,
          thumbnail: `https://i.ytimg.com/vi/${s.id}/hqdefault.jpg`
        }));

      // If no matches, return popular songs
      if (results.length === 0) {
        results = popularSongs.slice(0, 8).map(s => ({
          ...s,
          thumbnail: `https://i.ytimg.com/vi/${s.id}/hqdefault.jpg`
        }));
      }

      res.json({ results });
    } catch (e: any) {
      console.error('YouTube search error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Initialize Telegram bot (webhook in production, polling in development)
  initBot();

  return httpServer;
}
