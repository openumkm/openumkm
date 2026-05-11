import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyView from '@fastify/view';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import fastifyFormbody from '@fastify/formbody';
import fastifyMultipart from '@fastify/multipart';
import * as ejs from 'ejs';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { AuthService } from './services/auth.service';
import { SettingsService } from './services/settings.service';
import { preloadTranslations, createTranslator, detectLanguage } from './common/i18n';
import { generateToken, setCsrfCookie, validateCsrf, checkSameOrigin } from './common/csrf';
import { UploadService } from './services/upload.service';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { bodyParser: false },
  );

  const fastify = app.getHttpAdapter().getInstance() as any;

  // Parse URL-encoded form bodies (required for all POST forms)
  await fastify.register(fastifyFormbody);

  // File upload support (max 5MB per file)
  await fastify.register(fastifyMultipart, {
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  // Preload translation files
  preloadTranslations();

  await fastify.register(fastifyView, {
    engine: { ejs },
    templates: join(__dirname, 'views'),
    includeViewExtension: true,
    defaultContext: {
      isLoggedIn: false,
      isAdmin: false,
      cartCount: 0,
      currentLang: 'en',
      currentCurrency: 'IDR',
      csrfToken: '',
      t: createTranslator('en'),
    },
  });

  // Serve /static/ from public dir
  await fastify.register(fastifyStatic, {
    root: join(__dirname, 'public'),
    prefix: '/static/',
    decorateReply: false,
  });

  // Serve /uploads/ from uploads dir
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
  await fastify.register(fastifyStatic, {
    root: uploadsDir,
    prefix: '/uploads/',
    decorateReply: false,
  });

  await fastify.register(fastifyCookie, {
    secret: process.env.JWT_SECRET || 'opencode-secret',
  });

  // Setup guard + i18n language detection
  let setupComplete: boolean | null = null;
  let defaultLang: string | null = null;
  let defaultLangFetchedAt = 0;
  let activeCurrencies: any[] | null = null;
  let activeCurrenciesFetchedAt = 0;
  let cachedStoreName: string | null = null;
  let storeNameFetchedAt = 0;
  const SETTINGS_TTL = 5_000; // re-fetch at most every 5s (fast enough for post-save UX)
  const authService = app.get(AuthService);
  const settingsService = app.get(SettingsService);
  const uploadService = app.get(UploadService);

  fastify.addHook('onRequest', async (request: any, reply: any) => {
    const url = request.url as string;

    // Skip for health, static, uploads
    if (url === '/health' || url.startsWith('/static/') || url.startsWith('/uploads/')) {
      return;
    }

    // Setup guard
    if (!url.startsWith('/setup')) {
      if (setupComplete === null || setupComplete === false) {
        const count = await authService.getUserCount();
        setupComplete = count > 0;
      }
      if (!setupComplete) {
        return reply.redirect('/setup', 302);
      }
    }

    // i18n: detect language and set cookie + inject t() into view context
    const nowMs = Date.now();
    if (defaultLang === null || nowMs - defaultLangFetchedAt > SETTINGS_TTL) {
      defaultLang = (await settingsService.get('default_language')) || 'en';
      defaultLangFetchedAt = nowMs;
    }

    const lang = detectLanguage(request, defaultLang);

    // If ?lang= query param, set cookie for persistence
    if (request.query?.lang) {
      reply.setCookie('lang', lang, {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60,
      });
    }

    // Inject into request for controllers to use
    (request as any).lang = lang;
    (request as any).t = createTranslator(lang);

    // Currency detection
    if (activeCurrencies === null || nowMs - activeCurrenciesFetchedAt > SETTINGS_TTL) {
      activeCurrencies = await settingsService.getCurrencies();
      activeCurrenciesFetchedAt = nowMs;
    }

    const currencies = activeCurrencies.filter((c: any) => c.isActive);
    const defaultCurr = currencies.find((c: any) => c.isDefault);

    const requestedCurrency = request.query?.currency || request.cookies?.currency;
    const currencyCode = requestedCurrency || defaultCurr?.code || 'IDR';

    if (request.query?.currency) {
      reply.setCookie('currency', currencyCode, {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60,
      });
    }

    (request as any).currency = currencyCode;
    (request as any).currencies = currencies;

    // URL resolver for S3 files
    (request as any).resolveUrl = async (path: string) => {
      if (!path) return '';
      if (path.startsWith('s3://')) return uploadService.getPublicUrl(path);
      return path;
    };

    // CSRF token: read from cookie
    const csrfToken = request.cookies?._csrf || '';
    // For GET requests without a token, generate one
    if (request.method === 'GET' && !csrfToken && !url.startsWith('/static/') && !url.startsWith('/uploads/')) {
      const newToken = generateToken();
      setCsrfCookie(reply, newToken);
      (request as any).csrfToken = newToken;
    } else {
      (request as any).csrfToken = csrfToken;
    }

    // Fetch store name (cached, TTL 5s). Falls back to "OpenUMKM"
    // during initial setup when the setting does not exist yet.
    if (cachedStoreName === null || nowMs - storeNameFetchedAt > SETTINGS_TTL) {
      cachedStoreName = (await settingsService.get('store_name')) || 'OpenUMKM';
      storeNameFetchedAt = nowMs;
    }
    (request as any).storeName = cachedStoreName;

    // Monkey-patch reply.view to auto-inject shared context into every view
    // render, so controllers don't have to repeat storeName / csrf / t / etc.
    const origView = (reply as any).view?.bind(reply);
    if (origView) {
      (reply as any).view = (template: string, data: any = {}, opts?: any) => {
        const merged = {
          storeName: cachedStoreName,
          csrfToken: (request as any).csrfToken || '',
          currentLang: (request as any).lang || 'en',
          currentCurrency: (request as any).currency || 'IDR',
          currencies: (request as any).currencies || [],
          t: (request as any).t || ((k: string) => k),
          ...(data || {}),
        };
        return origView(template, merged, opts);
      };
    }
  });

  // Expose a helper to invalidate the store name cache (called after
  // admin saves settings so the new brand shows up immediately).
  // NestJS wraps `app` in a Proxy that rejects arbitrary property writes,
  // so we attach it to fastify instance instead (not that it's used right
  // now — the 5s cache TTL is fast enough for post-save UX).
  (fastify as any).invalidateStoreNameCache = () => {
    cachedStoreName = null;
    storeNameFetchedAt = 0;
  };

  // CSRF validation for POST/PUT/PATCH/DELETE
  fastify.addHook('preHandler', async (request: any, reply: any) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;

    const url = request.url as string;
    const contentType = (request.headers['content-type'] || '').toLowerCase();

    // Multipart uploads (files) cannot carry a CSRF cookie+body token cleanly
    // because body parsing is stream-based. Fall back to Origin/Referer check
    // to still block cross-site POSTs.
    if (contentType.includes('multipart/form-data')) {
      if (!checkSameOrigin(request)) {
        if (url.startsWith('/api/')) {
          return reply.status(403).send({ error: 'Cross-origin request blocked' });
        }
        return reply.status(403).send('Cross-origin upload blocked.');
      }
      return;
    }

    if (!validateCsrf(request, reply)) {
      if (url.startsWith('/api/') || url.startsWith('/health')) {
        return reply.status(403).send({ error: 'Invalid CSRF token' });
      }
      return reply.status(403).send('Invalid or missing CSRF token. Please go back and try again.');
    }
  });

  // 404 + error handling via Nest exception filter (avoids Fastify
  // "already set" conflicts with Nest's built-in handlers)
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`[eCommerce] Running on http://0.0.0.0:${port}`);
}
bootstrap();
