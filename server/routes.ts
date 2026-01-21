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
  const activeProcesses: Set<ReturnType<typeof spawn>> = new Set();

  // Kill all active Python processes
  const killAllProcesses = () => {
    activeProcesses.forEach(proc => {
      try {
        proc.kill('SIGTERM');
      } catch (e) {}
    });
    activeProcesses.clear();
  };

  // Function to check a single card using Python script
  const checkCardWithPython = (card: string, siteUrl: string, proxy: string, onLog: (msg: string) => void): Promise<{status: string, message: string}> => {
    return new Promise((resolve) => {
      if (shouldStop) {
        resolve({ status: 'error', message: '[STOPPED] Cancelled by user' });
        return;
      }

      const scriptPath = path.join(process.cwd(), 'server', 'python', 'checker.py');
      
      const pythonProcess = spawn('python', [scriptPath, card, siteUrl, proxy], {
        timeout: 120000 // 2 minute timeout per card
      });
      
      activeProcesses.add(pythonProcess);
      
      let stdout = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      // Stream logs from stderr in real-time
      pythonProcess.stderr.on('data', (data) => {
        const logLines = data.toString().trim().split('\n');
        for (const line of logLines) {
          if (line.startsWith('[LOG]')) {
            onLog(line.replace('[LOG] ', ''));
          }
        }
      });
      
      pythonProcess.on('close', (code) => {
        activeProcesses.delete(pythonProcess);
        
        if (shouldStop) {
          resolve({ status: 'error', message: '[STOPPED] Cancelled by user' });
          return;
        }
        
        try {
          const lines = stdout.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const result = JSON.parse(lastLine);
          resolve(result);
        } catch (e) {
          resolve({ 
            status: 'error', 
            message: '[ERROR] Python script failed' 
          });
        }
      });
      
      pythonProcess.on('error', (err) => {
        activeProcesses.delete(pythonProcess);
        resolve({ status: 'error', message: `[ERROR] Process: ${err.message}` });
      });
    });
  };

  const BATCH_SIZE = 10; // Process 10 cards in parallel

  const processQueue = async (cards: string[], targetUrl: string, proxyListStr: string) => {
    isRunning = true;
    shouldStop = false;

    // Parse proxies - get list for rotation
    const proxies = proxyListStr.split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const total = cards.length;
    let processedCount = 0;

    // Broadcast ACTIVE status immediately
    broadcast({ type: WS_EVENTS.STATUS_UPDATE, payload: { active: true, processed: 0, total: total } });
    broadcast({ type: WS_EVENTS.LOG, payload: { message: `Starting check on ${targetUrl}...`, type: 'info' } });
    broadcast({ type: WS_EVENTS.LOG, payload: { message: `${total} cards | ${proxies.length} proxies | Batch: ${BATCH_SIZE}`, type: 'info' } });

    // Filter valid cards
    const validCards = cards
      .map(c => c.trim())
      .filter(c => c && c.includes('|'));

    // Process cards in batches of BATCH_SIZE
    for (let i = 0; i < validCards.length; i += BATCH_SIZE) {
      if (shouldStop) {
        broadcast({ type: WS_EVENTS.LOG, payload: { message: 'Stopped by user', type: 'info' } });
        break;
      }

      const batch = validCards.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(validCards.length / BATCH_SIZE);
      
      broadcast({ type: WS_EVENTS.LOG, payload: { message: `Batch ${batchNum}/${totalBatches} - Processing ${batch.length} cards...`, type: 'info' } });

      // Process batch in parallel
      const batchPromises = batch.map(async (cardStr, idx) => {
        const proxyIndex = (i + idx) % (proxies.length || 1);
        const currentProxy = proxies[proxyIndex] || '';

        try {
          const onLog = (msg: string) => {
            if (shouldStop) return; // Don't log if stopped
            const cardPrefix = cardStr.substring(0, 6);
            broadcast({ type: WS_EVENTS.LOG, payload: { message: `[${cardPrefix}] ${msg}`, type: 'info' } });
          };
          
          const result = await checkCardWithPython(cardStr, targetUrl, currentProxy, onLog);
          
          // Skip saving cancelled/stopped cards
          if (shouldStop || result.message?.includes('[STOPPED]')) {
            return { success: false, stopped: true };
          }
          
          let status = 'unknown';
          if (result.status === 'live') status = 'live';
          else if (result.status === 'dead' || result.status === 'error') status = 'dead';
          else status = 'unknown';

          const saved = await storage.addResult({
            card: cardStr,
            status: status,
            message: result.message || 'No message'
          });

          broadcast({ type: WS_EVENTS.RESULT, payload: saved });

          if (status === 'live') {
            broadcast({ type: WS_EVENTS.LOG, payload: { message: `LIVE: ${cardStr.substring(0, 6)}*** | ${result.message}`, type: 'success' } });
          } else {
            broadcast({ type: WS_EVENTS.LOG, payload: { message: `DEAD: ${cardStr.substring(0, 6)}*** | ${result.message}`, type: 'error' } });
          }

          return { success: true, stopped: false };
        } catch (e: any) {
          if (!shouldStop) {
            broadcast({ type: WS_EVENTS.LOG, payload: { message: `Error [${cardStr.substring(0, 6)}]: ${e.message}`, type: 'error' } });
          }
          return { success: false, stopped: shouldStop };
        }
      });

      // Wait for all cards in batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Only count cards that were actually processed (not stopped)
      const actuallyProcessed = batchResults.filter(r => !r.stopped).length;
      processedCount += actuallyProcessed;
      
      if (!shouldStop) {
        broadcast({ type: WS_EVENTS.STATUS_UPDATE, payload: { active: true, processed: processedCount, total: validCards.length } });
      }
    }

    isRunning = false;
    
    if (shouldStop) {
      // Already handled in stop endpoint
    } else {
      broadcast({ type: WS_EVENTS.STATUS_UPDATE, payload: { active: false, processed: processedCount, total: validCards.length } });
      broadcast({ type: WS_EVENTS.LOG, payload: { message: `Finished! ${processedCount}/${validCards.length} processed.`, type: 'info' } });
    }
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

    // Clear all previous results before starting new check
    await storage.clearResults();
    broadcast({ type: WS_EVENTS.LOG, payload: { message: 'Cleared previous results', type: 'info' } });

    // Start background process (don't await)
    processQueue(cards, settings.targetUrl, settings.proxyList || '');
    
    res.json({ message: 'Job started', jobId: '1' });
  });

  app.post(api.check.stop.path, async (req, res) => {
    shouldStop = true;
    killAllProcesses();
    isRunning = false;
    broadcast({ type: WS_EVENTS.STATUS_UPDATE, payload: { active: false, processed: 0, total: 0 } });
    broadcast({ type: WS_EVENTS.LOG, payload: { message: 'STOPPED - All processes killed', type: 'error' } });
    res.json({ message: 'Stopped' });
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
