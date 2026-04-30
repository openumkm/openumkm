import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { db } from '../db';
import { users, passwordResetTokens } from '../db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'opencode-secret';
const SALT_ROUNDS = 10;

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'customer' | 'seller';
}

@Injectable()
export class AuthService {
  async register(data: { email: string; password: string; name: string; phone?: string }) {
    const existing = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      return { error: 'Email already registered.' };
    }

    const hash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const [user] = await db.insert(users).values({
      email: data.email.toLowerCase(),
      passwordHash: hash,
      name: data.name,
      phone: data.phone || null,
      role: 'customer',
    }).returning();

    return { user };
  }

  async login(email: string, password: string) {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) return { error: 'Invalid email or password.' };

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return { error: 'Invalid email or password.' };

    const token = this.signToken(user);
    return { user, token };
  }

  signToken(user: { id: string; email: string; role: 'customer' | 'seller' }) {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  }

  verifyToken(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
      return null;
    }
  }

  async createResetToken(email: string) {
    const [user] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) return null;

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
    });

    return token;
  }

  async resetPassword(token: string, newPassword: string) {
    const [record] = await db.select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token))
      .limit(1);

    if (!record || record.expiresAt < new Date()) {
      return { error: 'Invalid or expired reset token.' };
    }

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.update(users)
      .set({ passwordHash: hash, updatedAt: new Date() })
      .where(eq(users.id, record.userId));

    await db.delete(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));

    return { success: true };
  }

  async getUserById(id: string) {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user || null;
  }

  async getUserCount() {
    const result = await db.select({ id: users.id }).from(users).limit(1);
    return result.length;
  }
}
