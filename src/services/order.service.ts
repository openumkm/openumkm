import { Injectable } from '@nestjs/common';
import { db } from '../db';
import { orders, products, productVariants, settings } from '../db/schema';
import { eq, desc, and, like, sql, SQL } from 'drizzle-orm';

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
    paymentInvoiceId?: string | null;
    paymentUrl?: string | null;
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
      paymentInvoiceId: data.paymentInvoiceId || null,
      paymentUrl: data.paymentUrl || null,
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

  async updatePaymentInfo(id: string, paymentInvoiceId: string, paymentUrl: string) {
    await db.update(orders)
      .set({ paymentInvoiceId, paymentUrl, updatedAt: new Date() })
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

}
