import { z } from 'zod';
import { insertSettingsSchema, results } from './schema';

export const api = {
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
      path: '/api/check/clear', // Clear results history
      responses: {
        200: z.object({ message: z.string() }),
      },
    }
  },
};

// Helper for URL building
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
