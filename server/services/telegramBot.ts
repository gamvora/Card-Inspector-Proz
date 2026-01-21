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

export async function handleBotUpdate(update: TelegramUpdate): Promise<void> {
  if (!update.message?.text) return;

  const { text, from, chat } = update.message;
  const senderId = from.id.toString();

  if (text.startsWith('/start')) {
    await sendMessage(chat.id, `
<b>NexusChecker Bot</b>

مرحباً ${from.first_name}! 

<b>ID الخاص بك:</b> <code>${from.id}</code>

افتح التطبيق من خلال الزر في الأسفل للبدء في فحص البطاقات.

${senderId === ADMIN_ID ? '\n<b>أنت المدير!</b>\nأوامر المدير:\n/credit [user_id] [amount] - إضافة رصيد\n/stats - إحصائيات النظام' : ''}
    `);
    return;
  }

  if (text.startsWith('/credit') && senderId === ADMIN_ID) {
    const parts = text.split(' ');
    if (parts.length < 3) {
      await sendMessage(chat.id, '❌ الاستخدام: /credit [user_id] [amount]\n\nمثال: /credit 123456789 100');
      return;
    }

    const targetUserId = parts[1];
    const amount = parseInt(parts[2]);

    if (isNaN(amount)) {
      await sendMessage(chat.id, '❌ الرجاء إدخال رقم صحيح للرصيد');
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
✅ <b>تم تحديث الرصيد</b>

<b>المستخدم:</b> ${targetUserId}
<b>التغيير:</b> ${amount > 0 ? '+' : ''}${amount}
<b>الرصيد الجديد:</b> ${updatedUser.credits}
      `);

      if (targetUserId !== senderId) {
        await sendMessage(parseInt(targetUserId), `
🎉 <b>تم إضافة رصيد لحسابك!</b>

<b>المبلغ:</b> ${amount > 0 ? '+' : ''}${amount}
<b>رصيدك الحالي:</b> ${updatedUser.credits}
        `);
      }
    } else {
      await sendMessage(chat.id, '❌ فشل تحديث الرصيد');
    }
    return;
  }

  if (text.startsWith('/stats') && senderId === ADMIN_ID) {
    await sendMessage(chat.id, '📊 جاري جمع الإحصائيات...');
    return;
  }

  if (text.startsWith('/myid')) {
    await sendMessage(chat.id, `<b>ID الخاص بك:</b> <code>${from.id}</code>`);
    return;
  }

  if (text.startsWith('/balance')) {
    const user = await storage.getUserByTelegramId(senderId);
    if (user) {
      await sendMessage(chat.id, `
💳 <b>رصيدك</b>

<b>الرصيد المتاح:</b> ${user.credits}
<b>إجمالي الشحنات:</b> ${user.totalCharged}
<b>إجمالي المرفوضات:</b> ${user.totalRejected}
      `);
    } else {
      await sendMessage(chat.id, '❌ لم يتم العثور على حسابك. افتح التطبيق أولاً.');
    }
    return;
  }
}

async function sendMessage(chatId: number, text: string): Promise<boolean> {
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
