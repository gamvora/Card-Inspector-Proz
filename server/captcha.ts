import crypto from 'crypto';

const activeCaptchas = new Map<string, { numbers: string; expiresAt: number }>();

let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of Array.from(activeCaptchas.entries())) {
      if (value.expiresAt < now) {
        activeCaptchas.delete(key);
      }
    }
  }, 60000);
}

export function generateCaptcha(): { id: string; numbers: string } {
  startCleanup();
  
  const id = crypto.randomBytes(16).toString('hex');
  const numbers = Math.floor(1000 + Math.random() * 9000).toString();
  
  activeCaptchas.set(id, {
    numbers,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  return { id, numbers };
}

export function verifyCaptcha(id: string, answer: string): boolean {
  const captcha = activeCaptchas.get(id);
  if (!captcha) return false;
  
  if (captcha.expiresAt < Date.now()) {
    activeCaptchas.delete(id);
    return false;
  }
  
  const isValid = captcha.numbers === answer.trim();
  if (isValid) {
    activeCaptchas.delete(id);
  }
  
  return isValid;
}
