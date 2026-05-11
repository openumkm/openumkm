import { Controller, Get, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

@Controller()
export class HealthController {
  @Get('/health')
  health(@Res({ passthrough: true }) res: FastifyReply) {
    return res.send({ status: 'ok', uptime: process.uptime() });
  }
}
