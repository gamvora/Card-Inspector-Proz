import { storage } from '../storage';
import { ADMIN_TELEGRAM_ID } from '@shared/schema';

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

  if (text.startsWith('/start')) {
    const webAppUrl = getWebAppUrl();
    const isAdmin = senderId === ADMIN_ID;
    
    await sendMessageWithButton(chat.id, `
<b>Welcome to NexusChecker!</b>

Hello <b>${from.first_name}</b>! 

NexusChecker is a powerful card validation tool that helps you verify payment cards quickly and efficiently.

<b>Your Telegram ID:</b> <code>${from.id}</code>

<b>How to Get Started:</b>
1. Click the button below to open the app
2. Your account will be automatically created
3. Add credits to start checking cards
4. Configure your target sites and proxies
5. Start validating!

<b>Available Commands:</b>
/balance - Check your credit balance
/myid - Get your Telegram ID
${isAdmin ? `
<b>Admin Commands:</b>
/credit [user_id] [amount] - Add credits to a user
/stats - View system statistics` : ''}
`, 'Open NexusChecker', webAppUrl);
    return;
  }

  if (text.startsWith('/credit') && senderId === ADMIN_ID) {
    const parts = text.split(' ');
    if (parts.length < 3) {
      await sendMessage(chat.id, `
<b>Credit Command Usage</b>

<code>/credit [user_id] [amount]</code>

<b>Examples:</b>
<code>/credit 123456789 100</code> - Add 100 credits
<code>/credit 123456789 -50</code> - Remove 50 credits

<b>Note:</b> If the user doesn't exist, a new account will be created.
      `);
      return;
    }

    const targetUserId = parts[1];
    const amount = parseInt(parts[2]);

    if (isNaN(amount)) {
      await sendMessage(chat.id, 'Please enter a valid number for the amount.');
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

      await sendMessage(chat.id, `
<b>Credits Updated Successfully!</b>

<b>User ID:</b> <code>${targetUserId}</code>
<b>Change:</b> ${amount > 0 ? '+' : ''}${amount} credits
<b>New Balance:</b> ${updatedUser.credits} credits
      `);

      if (targetUserId !== senderId) {
        await sendMessage(parseInt(targetUserId), `
<b>Credits Added to Your Account!</b>

<b>Amount:</b> ${amount > 0 ? '+' : ''}${amount} credits
<b>Current Balance:</b> ${updatedUser.credits} credits

Open NexusChecker to start using your credits!
        `);
      }
    } else {
      await sendMessage(chat.id, 'Failed to update credits. Please try again.');
    }
    return;
  }

  if (text.startsWith('/stats') && senderId === ADMIN_ID) {
    await sendMessage(chat.id, 'Gathering system statistics...');
    return;
  }

  if (text.startsWith('/myid')) {
    await sendMessage(chat.id, `<b>Your Telegram ID:</b> <code>${from.id}</code>\n\nUse this ID to receive credits from the admin.`);
    return;
  }

  if (text.startsWith('/balance')) {
    const user = await storage.getUserByTelegramId(senderId);
    if (user) {
      await sendMessage(chat.id, `
<b>Your Account Balance</b>

<b>Available Credits:</b> ${user.credits}
<b>Cards Charged:</b> ${user.totalCharged}
<b>Cards Rejected:</b> ${user.totalRejected}

Need more credits? Contact the admin.
      `);
    } else {
      const webAppUrl = getWebAppUrl();
      await sendMessageWithButton(chat.id, 
        'Your account has not been created yet. Please open the app first to create your account.',
        'Open NexusChecker',
        webAppUrl
      );
    }
    return;
  }

  const webAppUrl = getWebAppUrl();
  await sendMessageWithButton(chat.id, 
    `Unknown command. Use /start to see available commands or click the button below to open the app.`,
    'Open NexusChecker',
    webAppUrl
  );
}

function getWebAppUrl(): string {
  const replitUrl = process.env.REPLIT_DEV_DOMAIN || process.env.REPL_SLUG;
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
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
