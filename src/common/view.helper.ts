import type { FastifyRequest } from 'fastify';

/**
 * Extract i18n context from request (injected by onRequest hook in main.ts).
 * Returns { t, currentLang } to spread into view data.
 */
export function i18nContext(req: FastifyRequest): { t: (key: string, fallback?: string) => string; currentLang: string } {
  return {
    t: (req as any).t || ((key: string) => key),
    currentLang: (req as any).lang || 'en',
  };
}
