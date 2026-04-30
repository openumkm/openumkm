import { Controller, Get, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service';
import { OrderService } from '../services/order.service';
import { getAuthFromRequest } from '../common/auth.helper';

@Controller('/admin')
export class AdminController {
  constructor(
    private readonly authService: AuthService,
    private readonly orderService: OrderService,
  ) {}

  @Get()
  async adminDashboard(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = getAuthFromRequest(req, this.authService);
    if (!auth || auth.role !== 'seller') return res.redirect(302, '/auth/login');

    const user = await this.authService.getUserById(auth.sub);
    const daily = await this.orderService.getRevenueStats('daily');
    const weekly = await this.orderService.getRevenueStats('weekly');
    const monthly = await this.orderService.getRevenueStats('monthly');
    const { orders: recentOrders } = await this.orderService.list({ limit: 5 });

    return res.view('admin/dashboard.ejs', {
      pageTitle: 'Admin Dashboard — Swift Commerce',
      userName: user?.name || 'Admin',
      adminPage: 'dashboard',
      stats: {
        revenueToday: daily.totalRevenue,
        ordersToday: daily.totalOrders,
        totalRevenue: monthly.totalRevenue,
        totalOrders: monthly.totalOrders,
      },
      revenuePeriods: [
        { label: 'Daily', total: daily.totalRevenue, orders: daily.totalOrders },
        { label: 'Weekly', total: weekly.totalRevenue, orders: weekly.totalOrders },
        { label: 'Monthly', total: monthly.totalRevenue, orders: monthly.totalOrders },
      ],
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: (o.shippingAddress as any)?.recipientName || 'Guest',
        total: o.total,
        status: o.status,
        createdAt: o.createdAt,
      })),
    });
  }
}
