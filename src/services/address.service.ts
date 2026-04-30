import { Injectable } from '@nestjs/common';
import { db } from '../db';
import { customerAddresses } from '../db/schema';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class AddressService {
  async listByUser(userId: string) {
    return db.select()
      .from(customerAddresses)
      .where(eq(customerAddresses.userId, userId))
      .orderBy(customerAddresses.createdAt);
  }

  async getById(id: string, userId: string) {
    const [addr] = await db.select()
      .from(customerAddresses)
      .where(and(eq(customerAddresses.id, id), eq(customerAddresses.userId, userId)))
      .limit(1);
    return addr || null;
  }

  async create(userId: string, data: {
    label: string;
    recipientName: string;
    phone: string;
    addressLine: string;
    city: string;
    province: string;
    postalCode: string;
    isDefault?: boolean;
  }) {
    // If setting as default, unset other defaults first
    if (data.isDefault) {
      await db.update(customerAddresses)
        .set({ isDefault: false })
        .where(eq(customerAddresses.userId, userId));
    }

    const [addr] = await db.insert(customerAddresses).values({
      userId,
      ...data,
      isDefault: data.isDefault ?? false,
    }).returning();
    return addr;
  }

  async update(id: string, userId: string, data: {
    label?: string;
    recipientName?: string;
    phone?: string;
    addressLine?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    isDefault?: boolean;
  }) {
    if (data.isDefault) {
      await db.update(customerAddresses)
        .set({ isDefault: false })
        .where(eq(customerAddresses.userId, userId));
    }

    const [addr] = await db.update(customerAddresses)
      .set(data)
      .where(and(eq(customerAddresses.id, id), eq(customerAddresses.userId, userId)))
      .returning();
    return addr;
  }

  async delete(id: string, userId: string) {
    await db.delete(customerAddresses)
      .where(and(eq(customerAddresses.id, id), eq(customerAddresses.userId, userId)));
  }
}
