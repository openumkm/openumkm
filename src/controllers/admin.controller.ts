import { Controller, Get, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service';
import { OrderService } from '../services/order.service';
import { RevenueService } from '../services/revenue.service';
import { getAuthFromRequest } from '../common/auth.helper';

@Controller('/admin')
export class AdminController {
  constructor(
    private readonly authService: AuthService,
    private readonly orderService: OrderService,
    private readonly revenueService: RevenueService,
  ) {}

  @Get()
  async adminDashboard(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = getAuthFromRequest(req, this.authService);
    if (!auth || auth.role !== 'seller') return res.redirect('/auth/login');

    const user = await this.authService.getUserById(auth.sub);
    const daily = await this.revenueService.getRevenueStats('daily');
    const weekly = await this.revenueService.getRevenueStats('weekly');
    const monthly = await this.revenueService.getRevenueStats('monthly');
    const yearly = await this.revenueService.getRevenueStats('yearly');
    const { orders: recentOrders } = await this.orderService.list({ limit: 5 });
    const breakdown = await this.revenueService.getRevenueBreakdown('monthly');

    return res.view('admin/dashboard.ejs', {
      pageTitle: 'Admin Dashboard',
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
        { label: 'Yearly', total: yearly.totalRevenue, orders: yearly.totalOrders },
      ],
      statusBreakdown: breakdown,
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

  @Get('/revenue')
  async revenueEndpoint(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = getAuthFromRequest(req, this.authService);
    if (!auth || auth.role !== 'seller') return res.status(401).send({ error: 'Unauthorized' });

    const period = ((req.query as any).period || 'monthly') as 'daily' | 'weekly' | 'monthly' | 'yearly';
    const stats = await this.revenueService.getRevenueStats(period);
    const breakdown = await this.revenueService.getRevenueBreakdown(period);

    return res.send({ ...stats, breakdown });
  }
}
