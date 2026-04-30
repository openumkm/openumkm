import { Controller, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { SettingsService } from '../services/settings.service';
import { OrderService } from '../services/order.service';
import { EmailService } from '../services/email.service';

@Controller()
export class XenditWebhookController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly orderService: OrderService,
    private readonly emailService: EmailService,
  ) {}

  @Post('/xendit/webhook')
  async handleWebhook(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const callbackToken = (req.headers as any)['x-callback-token'];
    const storedToken = await this.settingsService.get('xendit_callback_token');

    // Verify callback token
    if (storedToken && callbackToken !== storedToken) {
      return res.status(403).send({ error: 'Invalid callback token' });
    }

    const body = req.body as Record<string, any>;
    if (!body || !body.external_id || !body.status) {
      return res.status(400).send({ error: 'Invalid payload' });
    }

    const { external_id: orderNumber, status } = body;

    // Find order by order number
    const { orders: matches } = await this.orderService.list({ search: orderNumber, limit: 1 });
    const order = matches.find((o) => o.orderNumber === orderNumber);

    if (!order) {
      return res.status(404).send({ error: 'Order not found' });
    }

    // Handle payment status
    switch (status) {
      case 'PAID':
      case 'SETTLED':
        if (order.status === 'pending' || order.status === 'waiting_confirmation') {
          await this.orderService.updateStatus(order.id, 'paid');
          const addr = (order.shippingAddress || {}) as Record<string, any>;
          await this.emailService.sendPaymentConfirmed(
            { orderNumber: order.orderNumber, total: order.total, currency: order.currency },
            addr.email || '',
          );
        }
        break;

      case 'EXPIRED':
        await this.orderService.updateStatus(order.id, 'expired');
        break;
    }

    return res.send({ status: 'ok' });
  }
}
