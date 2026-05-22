import { describe, it, expect, vi } from 'vitest';
import { getAuthFromRequest, setAuthCookie, clearAuthCookie } from '../common/auth.helper';
import { i18nContext } from '../common/view.helper';
import {
  generateToken, setCsrfCookie, getCsrfToken, validateCsrf, checkSameOrigin,
  CSRF_COOKIE, CSRF_FIELD, CSRF_HEADER,
} from '../common/csrf';
import { preloadTranslations, createTranslator, detectLanguage, SUPPORTED_LANGS, DEFAULT_LANG } from '../common/i18n';
import { AllExceptionsFilter } from '../common/all-exceptions.filter';
import { HttpException, HttpStatus } from '@nestjs/common';

/* ── auth.helper ───────────────────────────────── */
describe('auth.helper', () => {
  it('getAuthFromRequest returns null when no cookie', () => {
    const req = { cookies: {} } as any;
    const authService = { verifyToken: vi.fn() } as any;
    expect(getAuthFromRequest(req, authService)).toBeNull();
    expect(authService.verifyToken).not.toHaveBeenCalled();
  });

  it('getAuthFromRequest returns payload when token exists', () => {
    const req = { cookies: { token: 'my-jwt' } } as any;
    const payload = { sub: '1', email: 'a@b.com', role: 'customer' as const };
    const authService = { verifyToken: vi.fn().mockReturnValue(payload) } as any;
    expect(getAuthFromRequest(req, authService)).toEqual(payload);
    expect(authService.verifyToken).toHaveBeenCalledWith('my-jwt');
  });

  it('setAuthCookie sets cookie with secure=true when x-forwarded-proto is https', () => {
    const req = { headers: { 'x-forwarded-proto': 'https' } } as any;
    const res = { setCookie: vi.fn() } as any;
    setAuthCookie(req, res, 'tok');
    expect(res.setCookie).toHaveBeenCalledWith('token', 'tok', expect.objectContaining({
      path: '/', httpOnly: true, sameSite: 'lax', secure: true,
    }));
  });

  it('setAuthCookie sets cookie with secure=false when x-forwarded-proto is http', () => {
    const req = { headers: { 'x-forwarded-proto': 'http' } } as any;
    const res = { setCookie: vi.fn() } as any;
    setAuthCookie(req, res, 'tok');
    expect(res.setCookie).toHaveBeenCalledWith('token', 'tok', expect.objectContaining({ secure: false }));
  });

  it('setAuthCookie falls back to request protocol', () => {
    const req = { headers: {}, protocol: 'https' } as any;
    const res = { setCookie: vi.fn() } as any;
    setAuthCookie(req, res, 'tok');
    expect(res.setCookie).toHaveBeenCalledWith('token', 'tok', expect.objectContaining({ secure: true }));
  });

  it('clearAuthCookie clears cookie', () => {
    const res = { clearCookie: vi.fn() } as any;
    clearAuthCookie(res);
    expect(res.clearCookie).toHaveBeenCalledWith('token', { path: '/' });
  });
});

/* ── view.helper ───────────────────────────────── */
describe('view.helper', () => {
  it('i18nContext returns default values when req has no t/lang/currency', () => {
    const ctx = i18nContext({} as any);
    expect(ctx.currentLang).toBe('en');
    expect(ctx.currency).toBe('IDR');
    expect(ctx.currencies).toEqual([]);
    expect(ctx.t('key')).toBe('key');
  });

  it('i18nContext returns values from request', () => {
    const tFn = (k: string) => `tr(${k})`;
    const req = { t: tFn, lang: 'id', currency: 'USD', currencies: [{ code: 'USD' }] } as any;
    const ctx = i18nContext(req);
    expect(ctx.currentLang).toBe('id');
    expect(ctx.currency).toBe('USD');
    expect(ctx.currencies).toEqual([{ code: 'USD' }]);
    expect(ctx.t('hello')).toBe('tr(hello)');
  });
});

/* ── csrf ──────────────────────────────────────── */
describe('csrf', () => {
  it('generateToken returns 64-char hex string', () => {
    const tok = generateToken();
    expect(tok).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(tok)).toBe(true);
  });

  it('setCsrfCookie sets cookie with httpOnly=false', () => {
    const reply = { setCookie: vi.fn() } as any;
    setCsrfCookie(reply, 'mytoken');
    expect(reply.setCookie).toHaveBeenCalledWith('_csrf', 'mytoken', expect.objectContaining({
      path: '/', httpOnly: false, sameSite: 'lax', maxAge: 86400,
    }));
  });

  it('getCsrfToken returns null when no cookie', () => {
    expect(getCsrfToken({ cookies: {} })).toBeNull();
  });

  it('getCsrfToken returns token from cookie', () => {
    expect(getCsrfToken({ cookies: { _csrf: 'abc' } })).toBe('abc');
  });

  it('validateCsrf returns true for exempt paths', () => {
    expect(validateCsrf({ url: '/health' }, {})).toBe(true);
    expect(validateCsrf({ url: '/api/test' }, {})).toBe(true);
    expect(validateCsrf({ url: '/xendit/webhook' }, {})).toBe(true);
  });

  it('validateCsrf returns false when no cookie token', () => {
    expect(validateCsrf({ url: '/admin', cookies: {} }, {})).toBe(false);
  });

  it('validateCsrf returns true when form token matches cookie', () => {
    expect(validateCsrf({
      url: '/admin', cookies: { _csrf: 'abc' }, body: { _csrf: 'abc' },
    }, {})).toBe(true);
  });

  it('validateCsrf returns false when form token does not match', () => {
    expect(validateCsrf({
      url: '/admin', cookies: { _csrf: 'abc' }, body: { _csrf: 'xyz' },
    }, {})).toBe(false);
  });

  it('checkSameOrigin returns true for exempt paths', () => {
    expect(checkSameOrigin({ url: '/health', headers: {} })).toBe(true);
  });

  it('checkSameOrigin returns false when no host header', () => {
    expect(checkSameOrigin({ url: '/admin', headers: {} })).toBe(false);
  });

  it('checkSameOrigin returns false when no origin or referer', () => {
    expect(checkSameOrigin({ url: '/admin', headers: { host: 'example.com' } })).toBe(false);
  });

  it('checkSameOrigin returns true when origin matches host', () => {
    expect(checkSameOrigin({
      url: '/admin', headers: { host: 'example.com', origin: 'https://example.com' },
    })).toBe(true);
  });

  it('checkSameOrigin returns false when origin does not match', () => {
    expect(checkSameOrigin({
      url: '/admin', headers: { host: 'example.com', origin: 'https://evil.com' },
    })).toBe(false);
  });

  it('checkSameOrigin returns false when URL parse fails', () => {
    expect(checkSameOrigin({
      url: '/admin', headers: { host: 'example.com', origin: 'not-a-url' },
    })).toBe(false);
  });

  it('checkSameOrigin checks referer when origin absent', () => {
    expect(checkSameOrigin({
      url: '/admin', headers: { host: 'example.com', referer: 'https://example.com/page' },
    })).toBe(true);
  });

  it('exports constants', () => {
    expect(CSRF_COOKIE).toBe('_csrf');
    expect(CSRF_FIELD).toBe('_csrf');
    expect(CSRF_HEADER).toBe('x-csrf-token');
  });
});

/* ── i18n ──────────────────────────────────────── */
describe('i18n', () => {
  it('preloadTranslations does not throw', () => {
    expect(() => preloadTranslations()).not.toThrow();
  });

  it('createTranslator creates function', () => {
    const t = createTranslator('en');
    expect(typeof t).toBe('function');
  });

  it('t returns fallback for unknown key', () => {
    const t = createTranslator('en');
    expect(t('nonexistent.key', 'fallback')).toBe('fallback');
  });

  it('t returns key when no dot', () => {
    const t = createTranslator('en');
    expect(t('nested')).toBe('nested');
  });

  it('detectLanguage returns default when no indicators', () => {
    expect(detectLanguage({ query: {}, cookies: {} }, 'id')).toBe('id');
  });

  it('detectLanguage returns en default', () => {
    expect(detectLanguage({ query: {}, cookies: {} })).toBe('en');
  });

  it('detectLanguage picks query param', () => {
    expect(detectLanguage({ query: { lang: 'id' }, cookies: {} })).toBe('id');
  });

  it('detectLanguage ignores unsupported query lang', () => {
    expect(detectLanguage({ query: { lang: 'fr' }, cookies: {} }, 'en')).toBe('en');
  });

  it('detectLanguage picks cookie', () => {
    expect(detectLanguage({ query: {}, cookies: { lang: 'id' } })).toBe('id');
  });

  it('detectLanguage query overrides cookie', () => {
    const req = { query: { lang: 'id' }, cookies: { lang: 'en' } };
    expect(detectLanguage(req)).toBe('id');
  });

  it('exports SUPPORTED_LANGS and DEFAULT_LANG', () => {
    expect(SUPPORTED_LANGS).toEqual(['id', 'en']);
    expect(DEFAULT_LANG).toBe('en');
  });
});

/* ── all-exceptions.filter ─────────────────────── */
describe('AllExceptionsFilter', () => {
  function createHost(url: string, method = 'GET') {
    const mockJson = vi.fn();
    const mockView = vi.fn();
    const mockStatus = vi.fn().mockReturnValue({ send: mockJson, view: mockView });
    const response = {
      status: mockStatus,
    } as any;
    const request = { url, method } as any;
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as any;
    return { mockJson, mockView, mockStatus, response, request, host };
  }

  it('renders 404 for HttpException 404 on HTML route', () => {
    const { mockView, host } = createHost('/some-page');
    const filter = new AllExceptionsFilter();
    filter.catch(new HttpException('Not Found', 404), host);
    expect(mockView).toHaveBeenCalledWith('404.ejs', expect.objectContaining({
      pageTitle: '404 — Page Not Found',
      error: null,
      isLoggedIn: false,
      cartCount: 0,
    }));
  });

  it('renders error page for 500 HttpException on HTML route', () => {
    const { mockView, host } = createHost('/some-page');
    const filter = new AllExceptionsFilter();
    filter.catch(new HttpException('Server Error', 500), host);
    expect(mockView).toHaveBeenCalledWith('404.ejs', expect.objectContaining({
      pageTitle: '500 — Error',
      error: 'Server Error',
    }));
  });

  it('returns JSON for /api/ routes', () => {
    const { mockJson, host } = createHost('/api/products');
    const filter = new AllExceptionsFilter();
    filter.catch(new HttpException('Bad Request', 400), host);
    expect(mockJson).toHaveBeenCalledWith({
      error: 'Bad Request',
      statusCode: 400,
    });
  });

  it('returns JSON for /health routes', () => {
    const { mockJson, host } = createHost('/health');
    const filter = new AllExceptionsFilter();
    filter.catch(new HttpException('OK', 200), host);
    expect(mockJson).toHaveBeenCalledWith({
      error: 'OK',
      statusCode: 200,
    });
  });

  it('handles non-HttpException as 500', () => {
    const { mockView, host } = createHost('/some-page');
    const filter = new AllExceptionsFilter();
    filter.catch(new Error('Something broke'), host);
    expect(mockView).toHaveBeenCalledWith('404.ejs', expect.objectContaining({
      pageTitle: '500 — Error',
      error: 'Something broke',
    }));
  });
});
