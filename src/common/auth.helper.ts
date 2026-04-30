import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService, JwtPayload } from '../services/auth.service';

const COOKIE_NAME = 'token';

/** Extract JWT payload from cookie. Returns null if not authenticated. */
export function getAuthFromRequest(req: FastifyRequest, authService: AuthService): JwtPayload | null {
  const token = (req.cookies as Record<string, string>)?.[COOKIE_NAME];
  if (!token) return null;
  return authService.verifyToken(token);
}

/** Set JWT cookie on response */
export function setAuthCookie(res: FastifyReply, token: string) {
  res.setCookie(COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    secure: process.env.NODE_ENV === 'production',
  });
}

/** Clear JWT cookie */
export function clearAuthCookie(res: FastifyReply) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}
