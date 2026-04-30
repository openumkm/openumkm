import 'reflect-metadata';
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

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
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
  const authService = app.get(AuthService);
  const settingsService = app.get(SettingsService);

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
        return reply.redirect(302, '/setup');
      }
    }

    // i18n: detect language and set cookie + inject t() into view context
    if (defaultLang === null) {
      defaultLang = (await settingsService.get('default_language')) || 'en';
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
  });

  // 404 handler
  fastify.setNotFoundHandler(async (_request: any, reply: any) => {
    if (_request.url.startsWith('/api/') || _request.url.startsWith('/health')) {
      return reply.status(404).send({ error: 'Not found' });
    }
    return reply.status(404).view('404.ejs', {
      pageTitle: '404 — Page Not Found',
      isLoggedIn: false,
      cartCount: 0,
    });
  });

  // Global error handler
  fastify.setErrorHandler(async (error: any, _request: any, reply: any) => {
    console.error('[Error]', error.message || error);
    if (_request.url.startsWith('/api/') || _request.url.startsWith('/health')) {
      return reply.status(error.statusCode || 500).send({
        error: error.message || 'Internal Server Error',
        statusCode: error.statusCode || 500,
      });
    }
    return reply.status(error.statusCode || 500).view('404.ejs', {
      pageTitle: error.statusCode ? `${error.statusCode} — Error` : 'Error',
      error: error.message || 'Something went wrong.',
      isLoggedIn: false,
      cartCount: 0,
    });
  });

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`[eCommerce] Running on http://0.0.0.0:${port}`);
}
bootstrap();
