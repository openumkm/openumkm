import { Controller, Get, Post, Param, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service';
import { OrderService } from '../services/order.service';
import { AddressService } from '../services/address.service';
import { SessionService } from '../services/session.service';
import { getAuthFromRequest } from '../common/auth.helper';
import { i18nContext } from '../common/view.helper';

@Controller('/dashboard')
export class DashboardController {
  constructor(
    private readonly authService: AuthService,
    private readonly orderService: OrderService,
    private readonly addressService: AddressService,
    private readonly sessionService: SessionService,
  ) {}

  private async guard(req: FastifyRequest, res: FastifyReply) {
    const auth = getAuthFromRequest(req, this.authService);
    if (!auth) { res.redirect(302, '/auth/login'); return null; }
    return auth;
  }

  @Get()
  async dashboardPage(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guard(req, res);
    if (!auth) return;

    const user = await this.authService.getUserById(auth.sub);
    const { orders: recentOrders } = await this.orderService.listByCustomer(auth.sub, { limit: 5 });
    const { total: totalOrders } = await this.orderService.listByCustomer(auth.sub);
    const { cart } = await this.sessionService.getCart(req, res, auth.sub);

    const pendingOrders = recentOrders.filter((o) => o.status === 'pending' || o.status === 'waiting_confirmation').length;
    const completedOrders = recentOrders.filter((o) => o.status === 'completed').length;

    return res.view('dashboard/index.ejs', {
      pageTitle: 'My Dashboard',
      isLoggedIn: true,
      cartCount: cart.reduce((sum, i) => sum + i.qty, 0),
      userName: user?.name || 'Customer',
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: o.total,
        items: (o.items as any[])?.length || 0,
        createdAt: o.createdAt,
      })),
      stats: { totalOrders, pendingOrders, completedOrders },
      ...i18nContext(req),
    });
  }

  @Get('/orders')
  async ordersPage(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guard(req, res);
    if (!auth) return;

    const user = await this.authService.getUserById(auth.sub);
    const page = parseInt((req.query as any).page || '1', 10);
    const result = await this.orderService.listByCustomer(auth.sub, { page });
    const { cart } = await this.sessionService.getCart(req, res, auth.sub);

    return res.view('dashboard/orders.ejs', {
      pageTitle: 'My Orders',
      isLoggedIn: true,
      cartCount: cart.reduce((sum, i) => sum + i.qty, 0),
      userName: user?.name || 'Customer',
      orders: result.orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: o.total,
        items: (o.items as any[])?.length || 0,
        createdAt: o.createdAt,
      })),
      page: result.page,
      pages: result.pages,
      ...i18nContext(req),
    });
  }

  @Get('/orders/:id')
  async orderDetailPage(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guard(req, res);
    if (!auth) return;

    const user = await this.authService.getUserById(auth.sub);
    let order = await this.orderService.getById(id);
    if (!order || (order.customerId && order.customerId !== auth.sub)) {
      return res.status(404).send('Order not found');
    }

    // Check expiry
    order = await this.orderService.checkExpiry(order);

    const addr = (order.shippingAddress || {}) as Record<string, any>;
    const { cart } = await this.sessionService.getCart(req, res, auth.sub);

    return res.view('dashboard/order-detail.ejs', {
      pageTitle: `Order ${order.orderNumber}`,
      isLoggedIn: true,
      cartCount: cart.reduce((sum, i) => sum + i.qty, 0),
      userName: user?.name || 'Customer',
      order: {
        ...order,
        shippingAddress: addr,
      },
      ...i18nContext(req),
    });
  }

  /* ── Addresses ───────────────────────────────── */

  @Get('/addresses')
  async addressesPage(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guard(req, res);
    if (!auth) return;

    const user = await this.authService.getUserById(auth.sub);
    const addresses = await this.addressService.listByUser(auth.sub);
    const { cart } = await this.sessionService.getCart(req, res, auth.sub);

    return res.view('dashboard/addresses.ejs', {
      pageTitle: 'My Addresses',
      isLoggedIn: true,
      cartCount: cart.reduce((sum, i) => sum + i.qty, 0),
      userName: user?.name || 'Customer',
      addresses,
      ...i18nContext(req),
    });
  }

  @Post('/addresses')
  async addAddress(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guard(req, res);
    if (!auth) return;

    const body = req.body as Record<string, string>;
    if (body.label && body.recipientName && body.phone && body.addressLine && body.city && body.province && body.postalCode) {
      await this.addressService.create(auth.sub, {
        label: body.label,
        recipientName: body.recipientName,
        phone: body.phone,
        addressLine: body.addressLine,
        city: body.city,
        province: body.province,
        postalCode: body.postalCode,
        isDefault: body.isDefault === '1',
      });
    }

    return res.redirect(302, '/dashboard/addresses');
  }

  @Post('/addresses/:id')
  async editAddress(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guard(req, res);
    if (!auth) return;

    const body = req.body as Record<string, string>;
    await this.addressService.update(id, auth.sub, {
      label: body.label,
      recipientName: body.recipientName,
      phone: body.phone,
      addressLine: body.addressLine,
      city: body.city,
      province: body.province,
      postalCode: body.postalCode,
      isDefault: body.isDefault === '1',
    });

    return res.redirect(302, '/dashboard/addresses');
  }

  @Post('/addresses/:id/delete')
  async deleteAddress(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guard(req, res);
    if (!auth) return;

    await this.addressService.delete(id, auth.sub);
    return res.redirect(302, '/dashboard/addresses');
  }
}
