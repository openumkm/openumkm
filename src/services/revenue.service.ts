import { Injectable } from '@nestjs/common';
import { db } from '../db';
import { orders } from '../db/schema';
import { and, sql } from 'drizzle-orm';

const VALID_STATUSES = ['pending', 'waiting_confirmation', 'paid', 'processing', 'shipped', 'completed', 'cancelled', 'expired'];

@Injectable()
export class RevenueService {
  private getSince(period: 'daily' | 'weekly' | 'monthly' | 'yearly'): Date {
    const now = new Date();
    switch (period) {
      case 'daily': return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'weekly': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'monthly': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'yearly': return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }
  }

  async getRevenueStats(period: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    const since = this.getSince(period);

    const [result] = await db.select({
      totalRevenue: sql<number>`coalesce(sum(${orders.total}), 0)`,
      totalOrders: sql<number>`count(*)`,
    })
      .from(orders)
      .where(and(
        sql`${orders.createdAt} >= ${since}`,
        sql`${orders.status} NOT IN ('cancelled', 'expired')`,
      ));

    const total = Number(result.totalRevenue);
    const count = Number(result.totalOrders);

    return {
      totalRevenue: total,
      totalOrders: count,
      avgOrderValue: count > 0 ? Math.round(total / count) : 0,
    };
  }

  async getRevenueBreakdown(period: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    const since = this.getSince(period);

    const rows = await db.select({
      status: orders.status,
      count: sql<number>`count(*)`,
    })
      .from(orders)
      .where(sql`${orders.createdAt} >= ${since}`)
      .groupBy(orders.status);

    const breakdown: Record<string, number> = {};
    for (const s of VALID_STATUSES) breakdown[s] = 0;
    for (const row of rows) {
      if (row.status && row.status in breakdown) {
        breakdown[row.status] = Number(row.count);
      }
    }

    return breakdown;
  }
}
