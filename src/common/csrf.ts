import { randomBytes } from 'crypto';

const CSRF_COOKIE = '_csrf';
const CSRF_FIELD = '_csrf';
const CSRF_HEADER = 'x-csrf-token';
const EXEMPT_PATHS = ['/health', '/api/', '/xendit/webhook'];

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export function setCsrfCookie(reply: any, token: string) {
  reply.setCookie(CSRF_COOKIE, token, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 86400, // 24 hours
  });
}

export function getCsrfToken(request: any): string | null {
  const cookie = request.cookies?.[CSRF_COOKIE];
  return cookie || null;
}

export function validateCsrf(request: any, reply: any): boolean {
  const url = request.url as string;

  // Skip validation for exempt paths
  if (EXEMPT_PATHS.some((p) => url.startsWith(p))) {
    return true;
  }

  const cookieToken = request.cookies?.[CSRF_COOKIE];
  if (!cookieToken) return false;

  const formToken = (request.body as any)?._csrf || '';
  if (formToken && formToken === cookieToken) return true;

  return false;
}

export { CSRF_COOKIE, CSRF_FIELD, CSRF_HEADER };
