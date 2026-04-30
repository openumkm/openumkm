import { Injectable } from '@nestjs/common';
import { db } from '../db';
import { orders, paymentConfirmations, products, productVariants, settings } from '../db/schema';
import { eq, desc, and, like, sql, or, SQL } from 'drizzle-orm';

const VALID_STATUSES = ['pending', 'waiting_confirmation', 'paid', 'processing', 'shipped', 'completed', 'cancelled', 'expired'];

@Injectable()
export class OrderService {
  async list(opts: { search?: string; status?: string; page?: number; limit?: number } = {}) {
    const { search, status, page = 1, limit = 20 } = opts;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (status) conditions.push(eq(orders.status, status as any));
    if (search) {
      conditions.push(like(orders.orderNumber, `%${search}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db.select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(where);

    return {
      orders: rows,
      total: Number(countResult.count),
      pages: Math.ceil(Number(countResult.count) / limit),
      page,
    };
  }

  async getById(id: string) {
    const [order] = await db.select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);
    return order || null;
  }

  async generateOrderNumber(): Promise<string> {
    const [prefixRow] = await db.select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, 'invoice_prefix'))
      .limit(1);
    const prefix = prefixRow?.value || 'INV';

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(like(orders.orderNumber, `${prefix}/${dateStr}/%`));

    const seq = (Number(countResult.count) + 1).toString().padStart(3, '0');
    return `${prefix}/${dateStr}/${seq}`;
  }

  async create(data: {
    customerId?: string;
    paymentMethod: 'xendit' | 'manual_transfer';
    subtotal: number;
    taxTotal: number;
    shippingCost: number;
    total: number;
    currency: string;
    items: unknown[];
    shippingAddress: Record<string, unknown>;
    courier?: string;
    courierService?: string;
    expiresInHours?: number;
  }) {
    const orderNumber = await this.generateOrderNumber();
    const hours = data.expiresInHours || 24;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    const [order] = await db.insert(orders).values({
      orderNumber,
      customerId: data.customerId || null,
      paymentMethod: data.paymentMethod,
      subtotal: data.subtotal,
      taxTotal: data.taxTotal,
      shippingCost: data.shippingCost,
      total: data.total,
      currency: data.currency,
      items: data.items,
      shippingAddress: data.shippingAddress,
      courier: data.courier || null,
      courierService: data.courierService || null,
      expiresAt,
    }).returning();

    return order;
  }

  async updateStatus(id: string, status: string) {
    const [order] = await db.update(orders)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();

    // Restore stock if cancelled or expired
    if (status === 'cancelled' || status === 'expired') {
      await this.restoreStock(order);
    }

    return order;
  }

  async setTracking(id: string, trackingNumber: string) {
    await db.update(orders)
      .set({ trackingNumber, updatedAt: new Date() })
      .where(eq(orders.id, id));
  }

  async checkExpiry(order: typeof orders.$inferSelect) {
    if (order.status === 'pending' && order.expiresAt < new Date()) {
      return this.updateStatus(order.id, 'expired');
    }
    return order;
  }

  private async restoreStock(order: typeof orders.$inferSelect) {
    const items = order.items as Array<{ productId?: string; variantId?: string; qty: number }>;
    for (const item of items) {
      if (item.variantId) {
        await db.update(productVariants)
          .set({ stock: sql`${productVariants.stock} + ${item.qty}` })
          .where(eq(productVariants.id, item.variantId));
      } else if (item.productId) {
        await db.update(products)
          .set({ stock: sql`${products.stock} + ${item.qty}` })
          .where(eq(products.id, item.productId));
      }
    }
  }

  // Payment confirmations
  async getPaymentConfirmations(status?: string) {
    const conditions = status ? eq(paymentConfirmations.status, status as any) : undefined;
    return db.select()
      .from(paymentConfirmations)
      .where(conditions)
      .orderBy(desc(paymentConfirmations.createdAt));
  }

  async approvePayment(confirmationId: string) {
    const [pc] = await db.update(paymentConfirmations)
      .set({ status: 'approved', reviewedAt: new Date() })
      .where(eq(paymentConfirmations.id, confirmationId))
      .returning();

    if (pc) {
      await this.updateStatus(pc.orderId, 'paid');
    }
    return pc;
  }

  async rejectPayment(confirmationId: string, reason: string) {
    await db.update(paymentConfirmations)
      .set({ status: 'rejected', rejectionReason: reason, reviewedAt: new Date() })
      .where(eq(paymentConfirmations.id, confirmationId));
  }

  /** Create a payment confirmation (buyer uploads transfer proof) */
  async createPaymentConfirmation(data: {
    orderId: string;
    senderBank: string;
    senderName: string;
    amount: number;
    transferDate: string;
    receiptImage: string;
    notes?: string | null;
  }) {
    const [pc] = await db.insert(paymentConfirmations).values({
      orderId: data.orderId,
      senderBank: data.senderBank,
      senderName: data.senderName,
      amount: data.amount,
      transferDate: data.transferDate,
      receiptImage: data.receiptImage,
      notes: data.notes || null,
    }).returning();
    return pc;
  }

  /** Get order by payment confirmation ID */
  async getOrderByConfirmationId(confirmationId: string) {
    const [pc] = await db.select({ orderId: paymentConfirmations.orderId })
      .from(paymentConfirmations)
      .where(eq(paymentConfirmations.id, confirmationId))
      .limit(1);
    if (!pc) return null;
    return this.getById(pc.orderId);
  }

  /** Get orders by customer ID */
  async listByCustomer(customerId: string, opts: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 20 } = opts;
    const offset = (page - 1) * limit;

    const rows = await db.select()
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(eq(orders.customerId, customerId));

    return {
      orders: rows,
      total: Number(countResult.count),
      pages: Math.ceil(Number(countResult.count) / limit),
      page,
    };
  }

  // Revenue stats
  async getRevenueStats(period: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    const now = new Date();
    let since: Date;

    switch (period) {
      case 'daily': since = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
      case 'weekly': since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case 'monthly': since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      case 'yearly': since = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break;
    }

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
    const now = new Date();
    let since: Date;

    switch (period) {
      case 'daily': since = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
      case 'weekly': since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case 'monthly': since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      case 'yearly': since = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break;
    }

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
