import { Controller, Get, Post, Param, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service';
import { OrderService } from '../services/order.service';
import { getAuthFromRequest } from '../common/auth.helper';

@Controller('/admin')
export class AdminOrdersController {
  constructor(
    private readonly authService: AuthService,
    private readonly orderService: OrderService,
  ) {}

  private async guardAdmin(req: FastifyRequest, res: FastifyReply) {
    const auth = getAuthFromRequest(req, this.authService);
    if (!auth || auth.role !== 'seller') { res.redirect(302, '/auth/login'); return null; }
    return auth;
  }

  @Get('/orders')
  async orderList(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
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
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: (o.shippingAddress as any)?.recipientName || 'Guest',
        customerEmail: (o.shippingAddress as any)?.email || null,
        total: o.total,
        status: o.status,
        paymentMethod: o.paymentMethod,
        createdAt: o.createdAt,
      })),
      search: q,
      filterStatus: status,
      page: result.page,
      pages: result.pages,
    });
  }

  @Get('/orders/:id')
  async orderDetail(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const user = await this.authService.getUserById(auth.sub);
    let order = await this.orderService.getById(id);
    if (!order) return res.status(404).send('Order not found');

    // Check expiry on view
    order = await this.orderService.checkExpiry(order);

    const addr = (order.shippingAddress || {}) as Record<string, any>;
    return res.view('admin/order-detail.ejs', {
      pageTitle: `Order ${order.orderNumber} — Admin`,
      userName: user?.name || 'Admin',
      adminPage: 'orders',
      order: {
        ...order,
        customerName: addr.recipientName || 'Guest',
        customerEmail: addr.email || null,
        taxTotal: order.taxTotal,
      },
    });
  }

  @Post('/orders/:id/status')
  async updateStatus(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const { status } = req.body as Record<string, string>;
    await this.orderService.updateStatus(id, status);
    return res.redirect(302, `/admin/orders/${id}`);
  }

  @Post('/orders/:id/tracking')
  async setTracking(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const { trackingNumber } = req.body as Record<string, string>;
    await this.orderService.setTracking(id, trackingNumber);
    return res.redirect(302, `/admin/orders/${id}`);
  }

  @Get('/payments/confirmations')
  async paymentConfirmations(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const user = await this.authService.getUserById(auth.sub);
    const status = (req.query as any).status || '';
    const confirmations = await this.orderService.getPaymentConfirmations(status || undefined);

    return res.view('admin/payment-confirmations.ejs', {
      pageTitle: 'Payment Confirmations — Admin',
      userName: user?.name || 'Admin',
      adminPage: 'payments',
      paymentConfirmations: confirmations,
      filterStatus: status,
    });
  }

  @Post('/payments/:id/approve')
  async approvePayment(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    await this.orderService.approvePayment(id);
    return res.redirect(302, '/admin/payments/confirmations');
  }

  @Post('/payments/:id/reject')
  async rejectPayment(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const { reason } = req.body as Record<string, string>;
    await this.orderService.rejectPayment(id, reason || 'Rejected');
    return res.redirect(302, '/admin/payments/confirmations');
  }
}
