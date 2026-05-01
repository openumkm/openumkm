import { Injectable } from '@nestjs/common';
import { db } from '../db';
import { paymentConfirmations } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { OrderService } from './order.service';

@Injectable()
export class PaymentConfirmationService {
  constructor(private readonly orderService: OrderService) {}

  async list(status?: string) {
    const conditions = status ? eq(paymentConfirmations.status, status as any) : undefined;
    return db.select()
      .from(paymentConfirmations)
      .where(conditions)
      .orderBy(desc(paymentConfirmations.createdAt));
  }

  async approve(confirmationId: string) {
    const [pc] = await db.update(paymentConfirmations)
      .set({ status: 'approved', reviewedAt: new Date() })
      .where(eq(paymentConfirmations.id, confirmationId))
      .returning();

    if (pc) {
      await this.orderService.updateStatus(pc.orderId, 'paid');
    }
    return pc;
  }

  async reject(confirmationId: string, reason: string) {
    await db.update(paymentConfirmations)
      .set({ status: 'rejected', rejectionReason: reason, reviewedAt: new Date() })
      .where(eq(paymentConfirmations.id, confirmationId));
  }

  async create(data: {
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

  async getOrderByConfirmationId(confirmationId: string) {
    const [pc] = await db.select({ orderId: paymentConfirmations.orderId })
      .from(paymentConfirmations)
      .where(eq(paymentConfirmations.id, confirmationId))
      .limit(1);
    if (!pc) return null;
    return this.orderService.getById(pc.orderId);
  }
}
