import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService, JwtPayload } from '../services/auth.service';

const COOKIE_NAME = 'token';

/** Extract JWT payload from cookie. Returns null if not authenticated. */
export function getAuthFromRequest(req: FastifyRequest, authService: AuthService): JwtPayload | null {
  const token = (req.cookies as Record<string, string>)?.[COOKIE_NAME];
  if (!token) return null;
  return authService.verifyToken(token);
}

/**
 * Detect whether the current request is served over HTTPS. Respects the
 * `X-Forwarded-Proto` header so reverse-proxied deployments (nginx, ELB)
 * still mark cookies as Secure correctly. Falls back to the connection
 * protocol, then to NODE_ENV when neither is available.
 *
 * Returning `false` over plain HTTP is critical: browsers silently drop
 * `Secure` cookies on non-HTTPS origins, which would cause login to appear
 * to succeed while the JWT cookie never lands — the page "just refreshes".
 */
function isSecureRequest(req: FastifyRequest): boolean {
  const forwarded = (req.headers['x-forwarded-proto'] || '') as string;
  if (forwarded) return forwarded.split(',')[0].trim().toLowerCase() === 'https';
  return (req as any).protocol === 'https';
}

/** Set JWT cookie on response */
export function setAuthCookie(req: FastifyRequest, res: FastifyReply, token: string) {
  res.setCookie(COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    secure: isSecureRequest(req),
  });
}

/** Clear JWT cookie */
export function clearAuthCookie(res: FastifyReply) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}
