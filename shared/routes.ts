import { z } from 'zod';
import { insertSettingsSchema, insertSiteSchema, insertProxySchema } from './schema';

export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/auth/login',
      input: z.object({ initData: z.string() }),
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me',
    },
  },
  sites: {
    list: {
      method: 'GET' as const,
      path: '/api/sites',
    },
    add: {
      method: 'POST' as const,
      path: '/api/sites',
      input: z.object({ name: z.string(), url: z.string() }),
    },
    update: {
      method: 'PUT' as const,
      path: '/api/sites/:id',
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/sites/:id',
    },
    setActive: {
      method: 'POST' as const,
      path: '/api/sites/:id/activate',
    },
  },
  proxies: {
    list: {
      method: 'GET' as const,
      path: '/api/proxies',
    },
    add: {
      method: 'POST' as const,
      path: '/api/proxies',
      input: z.object({ proxies: z.array(z.string()) }),
    },
    validate: {
      method: 'POST' as const,
      path: '/api/proxies/validate',
      input: z.object({ proxy: z.string() }),
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/proxies/:id',
    },
    clear: {
      method: 'DELETE' as const,
      path: '/api/proxies',
    },
  },
  credits: {
    balance: {
      method: 'GET' as const,
      path: '/api/credits/balance',
    },
    add: {
      method: 'POST' as const,
      path: '/api/credits/add',
      input: z.object({ userId: z.string(), amount: z.number() }),
    },
    history: {
      method: 'GET' as const,
      path: '/api/credits/history',
    },
  },
  settings: {
    get: {
      method: 'GET' as const,
      path: '/api/settings',
      responses: {
        200: insertSettingsSchema,
        404: z.object({ message: z.string() }),
      },
    },
    update: {
      method: 'POST' as const,
      path: '/api/settings',
      input: insertSettingsSchema,
      responses: {
        200: insertSettingsSchema,
      },
    },
  },
  check: {
    start: {
      method: 'POST' as const,
      path: '/api/check/start',
      input: z.object({
        cards: z.array(z.string()),
        siteId: z.number().optional(),
      }),
      responses: {
        200: z.object({ message: z.string(), jobId: z.string() }),
      },
    },
    stop: {
      method: 'POST' as const,
      path: '/api/check/stop',
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    clear: {
      method: 'POST' as const,
      path: '/api/check/clear',
      responses: {
        200: z.object({ message: z.string() }),
      },
    }
  },
  results: {
    list: {
      method: 'GET' as const,
      path: '/api/results',
    },
    clear: {
      method: 'DELETE' as const,
      path: '/api/results',
    },
  },
  telegram: {
    webhook: {
      method: 'POST' as const,
      path: '/api/telegram/webhook',
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

