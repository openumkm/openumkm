import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyView from '@fastify/view';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import * as ejs from 'ejs';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  const fastify = app.getHttpAdapter().getInstance() as any;

  await fastify.register(fastifyView, {
    engine: { ejs },
    templates: join(__dirname, 'views'),
    includeViewExtension: true,
    defaultContext: {
      isLoggedIn: false,
      isAdmin: false,
      cartCount: 0,
    },
  });

  await fastify.register(fastifyStatic, {
    root: join(__dirname, 'public'),
    prefix: '/static/',
    decorateReply: false,
  });

  await fastify.register(fastifyCookie, {
    secret: process.env.JWT_SECRET || 'opencode-secret',
  });

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`[eCommerce] Running on http://0.0.0.0:${port}`);
}
bootstrap();
