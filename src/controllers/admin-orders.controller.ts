import { Controller, Get, Post, Param, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service';
import { OrderService } from '../services/order.service';
import { PaymentConfirmationService } from '../services/payment-confirmation.service';
import { EmailService } from '../services/email.service';
import { getAuthFromRequest } from '../common/auth.helper';

@Controller('/admin')
export class AdminOrdersController {
  constructor(
    private readonly authService: AuthService,
    private readonly orderService: OrderService,
    private readonly paymentConfirmationService: PaymentConfirmationService,
    private readonly emailService: EmailService,
  ) {}

  private async guardAdmin(req: FastifyRequest, res: FastifyReply) {
    const auth = getAuthFromRequest(req, this.authService);
    if (!auth || auth.role !== 'seller') { res.redirect('/auth/login', 302); return null; }
    return auth;
  }

  @Get('/orders')
  async orderList(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const q = (req.query as any).q || '';
    const status = (req.query as any).status || '';
    const page = parseInt((req.query as any).page || '1', 10);
    const user = await this.authService.getUserById(auth.sub);
    const result = await this.orderService.list({ search: q || undefined, status: status || undefined, page });

    return res.view('admin/orders.ejs', {
      pageTitle: 'Orders — Admin',
      userName: user?.name || 'Admin',
      adminPage: 'orders',
      orders: result.orders.map((o) => ({
        id: o.id, orderNumber: o.orderNumber,
        customerName: (o.shippingAddress as any)?.recipientName || 'Guest',
        customerEmail: (o.shippingAddress as any)?.email || null,
        total: o.total, status: o.status, paymentMethod: o.paymentMethod, createdAt: o.createdAt,
      })),
      search: q, filterStatus: status, page: result.page, pages: result.pages,
    });
  }

  @Get('/orders/:id')
  async orderDetail(@Param('id') id: string, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const user = await this.authService.getUserById(auth.sub);
    let order = await this.orderService.getById(id);
    if (!order) return res.status(404).send('Order not found');

    order = await this.orderService.checkExpiry(order);
    const addr = (order.shippingAddress || {}) as Record<string, any>;

    return res.view('admin/order-detail.ejs', {
      pageTitle: `Order ${order.orderNumber} — Admin`,
      userName: user?.name || 'Admin',
      adminPage: 'orders',
      order: { ...order, customerName: addr.recipientName || 'Guest', customerEmail: addr.email || null, taxTotal: order.taxTotal },
    });
  }

  @Post('/orders/:id/status')
  async updateStatus(@Param('id') id: string, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const { status } = req.body as Record<string, string>;
    const order = await this.orderService.updateStatus(id, status);

    if (order) {
      const addr = (order.shippingAddress || {}) as Record<string, any>;
      const customerEmail = addr.email || '';
      if (status === 'cancelled') {
        await this.emailService.sendOrderCancelled({ orderNumber: order.orderNumber, total: order.total }, customerEmail);
      } else if (status === 'shipped') {
        await this.emailService.sendOrderShipped(
          { orderNumber: order.orderNumber, courier: order.courier, courierService: order.courierService, trackingNumber: order.trackingNumber },
          customerEmail,
        );
      }
    }

    return res.redirect(`/admin/orders/${id}`, 302);
  }

  @Post('/orders/:id/tracking')
  async setTracking(@Param('id') id: string, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const { trackingNumber } = req.body as Record<string, string>;
    await this.orderService.setTracking(id, trackingNumber);

    const order = await this.orderService.getById(id);
    if (order) {
      const addr = (order.shippingAddress || {}) as Record<string, any>;
      await this.emailService.sendOrderShipped(
        { orderNumber: order.orderNumber, courier: order.courier, courierService: order.courierService, trackingNumber: order.trackingNumber },
        addr.email || '',
      );
    }

    return res.redirect(`/admin/orders/${id}`, 302);
  }

  @Get('/payments/confirmations')
  async paymentConfirmations(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const user = await this.authService.getUserById(auth.sub);
    const status = (req.query as any).status || '';
    const confirmations = await this.paymentConfirmationService.list(status || undefined);

    return res.view('admin/payment-confirmations.ejs', {
      pageTitle: 'Payment Confirmations — Admin',
      userName: user?.name || 'Admin',
      adminPage: 'payments',
      paymentConfirmations: confirmations,
      filterStatus: status,
    });
  }

  @Post('/payments/:id/approve')
  async approvePayment(@Param('id') id: string, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const pc = await this.paymentConfirmationService.approve(id);
    if (pc) {
      const order = await this.orderService.getById(pc.orderId);
      if (order) {
        const addr = (order.shippingAddress || {}) as Record<string, any>;
        await this.emailService.sendPaymentConfirmed(
          { orderNumber: order.orderNumber, total: order.total, currency: order.currency },
          addr.email || '',
        );
      }
    }

    return res.redirect('/admin/payments/confirmations', 302);
  }

  @Post('/payments/:id/reject')
  async rejectPayment(@Param('id') id: string, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const { reason } = req.body as Record<string, string>;
    await this.paymentConfirmationService.reject(id, reason || 'Rejected');

    const order = await this.paymentConfirmationService.getOrderByConfirmationId(id);
    if (order) {
      const addr = (order.shippingAddress || {}) as Record<string, any>;
      await this.emailService.sendPaymentRejected(
        { orderNumber: order.orderNumber, total: order.total },
        addr.email || '',
        reason || 'Rejected',
      );
    }

    return res.redirect('/admin/payments/confirmations', 302);
  }
}
