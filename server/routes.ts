import type { Express } from "express";
import { type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { WS_EVENTS } from "@shared/schema";
import { spawn } from "child_process";
import path from "path";

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

  // Function to check a single card using Python script
  const checkCardWithPython = (card: string, siteUrl: string, proxy: string): Promise<{status: string, message: string}> => {
    return new Promise((resolve) => {
      const scriptPath = path.join(process.cwd(), 'server', 'python', 'checker.py');
      
      const pythonProcess = spawn('python', [scriptPath, card, siteUrl, proxy], {
        timeout: 120000 // 2 minute timeout per card
      });
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        try {
          // Try to parse the last line as JSON (in case there's debug output)
          const lines = stdout.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const result = JSON.parse(lastLine);
          resolve(result);
        } catch (e) {
          resolve({ 
            status: 'error', 
            message: stderr || stdout || 'Python script failed' 
          });
        }
      });
      
      pythonProcess.on('error', (err) => {
        resolve({ status: 'error', message: `Process error: ${err.message}` });
      });
    });
  };

  const processQueue = async (cards: string[], targetUrl: string, proxyListStr: string) => {
    isRunning = true;
    shouldStop = false;

    // Parse proxies - get list for rotation
    const proxies = proxyListStr.split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const total = cards.length;
    let processedCount = 0;

    broadcast({ type: WS_EVENTS.LOG, payload: { message: `Starting check on ${targetUrl}...`, type: 'info' } });
    broadcast({ type: WS_EVENTS.LOG, payload: { message: `${total} cards to process, ${proxies.length} proxies configured`, type: 'info' } });

    // Process cards one by one (sequential for stability)
    for (const cardStr of cards) {
      if (shouldStop) {
        broadcast({ type: WS_EVENTS.LOG, payload: { message: 'Stopped by user', type: 'info' } });
        break;
      }

      const trimmedCard = cardStr.trim();
      if (!trimmedCard || !trimmedCard.includes('|')) {
        processedCount++;
        broadcast({ type: WS_EVENTS.LOG, payload: { message: `Skipped invalid: ${trimmedCard}`, type: 'error' } });
        continue;
      }

      // Rotate proxy
      const proxyIndex = processedCount % (proxies.length || 1);
      const currentProxy = proxies[proxyIndex] || '';

      broadcast({ type: WS_EVENTS.LOG, payload: { message: `Checking: ${trimmedCard.substring(0, 6)}...`, type: 'info' } });

      try {
        const result = await checkCardWithPython(trimmedCard, targetUrl, currentProxy);
        
        // Normalize status
        let status = 'unknown';
        if (result.status === 'live') status = 'live';
        else if (result.status === 'dead' || result.status === 'error') status = 'dead';
        else status = 'unknown';

        // Save to database
        const saved = await storage.addResult({
          card: trimmedCard,
          status: status,
          message: result.message || 'No message'
        });

        broadcast({ type: WS_EVENTS.RESULT, payload: saved });

        // Log based on status
        if (status === 'live') {
          broadcast({ type: WS_EVENTS.LOG, payload: { message: `LIVE: ${trimmedCard.substring(0, 6)}*** | ${result.message}`, type: 'success' } });
        } else if (status === 'dead') {
          broadcast({ type: WS_EVENTS.LOG, payload: { message: `DEAD: ${trimmedCard.substring(0, 6)}*** | ${result.message}`, type: 'error' } });
        } else {
          broadcast({ type: WS_EVENTS.LOG, payload: { message: `UNKNOWN: ${trimmedCard.substring(0, 6)}*** | ${result.message}`, type: 'info' } });
        }

      } catch (e: any) {
        broadcast({ type: WS_EVENTS.LOG, payload: { message: `Error: ${e.message}`, type: 'error' } });
      }

      processedCount++;
      broadcast({ type: WS_EVENTS.STATUS_UPDATE, payload: { active: true, processed: processedCount, total } });
    }

    isRunning = false;
    broadcast({ type: WS_EVENTS.STATUS_UPDATE, payload: { active: false, processed: processedCount, total } });
    broadcast({ type: WS_EVENTS.LOG, payload: { message: `Job finished. ${processedCount}/${total} processed.`, type: 'info' } });
  };

  // === API Routes ===

  app.get(api.settings.get.path, async (req, res) => {
    const config = await storage.getSettings();
    if (!config) {
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

    // Start background process (don't await)
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
