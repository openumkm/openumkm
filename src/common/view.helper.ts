import type { FastifyRequest } from 'fastify';

export function i18nContext(req: FastifyRequest): {
  t: (key: string, fallback?: string) => string;
  currentLang: string;
  currency: string;
  currencies: any[];
} {
  return {
    t: (req as any).t || ((key: string) => key),
    currentLang: (req as any).lang || 'en',
    currency: (req as any).currency || 'IDR',
    currencies: (req as any).currencies || [],
  };
}
