import { Injectable } from '@nestjs/common';
import { db } from '../db';
import { sessions } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { FastifyRequest, FastifyReply } from 'fastify';

const SESSION_COOKIE = 'sid';
const GUEST_EXPIRY_DAYS = 14;
const USER_EXPIRY_DAYS = 30;

export interface CartItem {
  productId: string;
  variantId?: string;
  name: string;
  variant?: string;
  price: number;
  qty: number;
  image?: string;
  weight: number;
  stock: number;
}

export interface SessionData {
  cart?: CartItem[];
}

@Injectable()
export class SessionService {
  /** Get or create a session. Returns session id + data. */
  async getOrCreate(req: FastifyRequest, res: FastifyReply, userId?: string): Promise<{ sessionId: string; data: SessionData }> {
    const sid = (req.cookies as Record<string, string>)?.[SESSION_COOKIE];

    if (sid) {
      const [existing] = await db.select()
        .from(sessions)
        .where(and(eq(sessions.id, sid), gt(sessions.expiresAt, new Date())))
        .limit(1);

      if (existing) {
        return { sessionId: existing.id, data: (existing.data || {}) as SessionData };
      }
    }

    // Create new session
    const expiryDays = userId ? USER_EXPIRY_DAYS : GUEST_EXPIRY_DAYS;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
    const id = uuidv4();

    await db.insert(sessions).values({
      id,
      userId: userId || null,
      data: {},
      expiresAt,
    });

    res.setCookie(SESSION_COOKIE, id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: expiryDays * 24 * 60 * 60,
      secure: process.env.NODE_ENV === 'production',
    });

    return { sessionId: id, data: {} };
  }

  /** Update session data */
  async update(sessionId: string, data: SessionData) {
    await db.update(sessions)
      .set({ data: data as Record<string, unknown> })
      .where(eq(sessions.id, sessionId));
  }

  /** Get cart items from session */
  async getCart(req: FastifyRequest, res: FastifyReply, userId?: string): Promise<{ sessionId: string; cart: CartItem[] }> {
    const { sessionId, data } = await this.getOrCreate(req, res, userId);
    return { sessionId, cart: data.cart || [] };
  }

  /** Add item to cart */
  async addToCart(sessionId: string, item: CartItem): Promise<CartItem[]> {
    const [session] = await db.select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) return [];

    const data = (session.data || {}) as SessionData;
    const cart = data.cart || [];

    // Check if same product+variant already in cart
    const existingIdx = cart.findIndex(
      (c) => c.productId === item.productId && c.variantId === item.variantId,
    );

    if (existingIdx >= 0) {
      cart[existingIdx].qty += item.qty;
    } else {
      cart.push(item);
    }

    await this.update(sessionId, { ...data, cart });
    return cart;
  }

  /** Update item quantity */
  async updateCartQty(sessionId: string, productId: string, variantId: string | undefined, qty: number): Promise<CartItem[]> {
    const [session] = await db.select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) return [];

    const data = (session.data || {}) as SessionData;
    const cart = data.cart || [];

    const idx = cart.findIndex(
      (c) => c.productId === productId && c.variantId === (variantId || undefined),
    );

    if (idx >= 0) {
      if (qty <= 0) {
        cart.splice(idx, 1);
      } else {
        cart[idx].qty = qty;
      }
    }

    await this.update(sessionId, { ...data, cart });
    return cart;
  }

  /** Remove item from cart */
  async removeFromCart(sessionId: string, productId: string, variantId?: string): Promise<CartItem[]> {
    return this.updateCartQty(sessionId, productId, variantId, 0);
  }

  /** Clear cart */
  async clearCart(sessionId: string) {
    const [session] = await db.select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) return;

    const data = (session.data || {}) as SessionData;
    await this.update(sessionId, { ...data, cart: [] });
  }

  /** Merge guest cart into user session (on login) */
  async mergeGuestCart(guestSessionId: string, userId: string, userSessionId: string) {
    const [guestSession] = await db.select()
      .from(sessions)
      .where(eq(sessions.id, guestSessionId))
      .limit(1);

    if (!guestSession) return;

    const guestData = (guestSession.data || {}) as SessionData;
    const guestCart = guestData.cart || [];
    if (guestCart.length === 0) return;

    const [userSession] = await db.select()
      .from(sessions)
      .where(eq(sessions.id, userSessionId))
      .limit(1);

    const userData = (userSession?.data || {}) as SessionData;
    const userCart = userData.cart || [];

    // Merge: guest items added, duplicates update qty
    for (const guestItem of guestCart) {
      const existingIdx = userCart.findIndex(
        (c) => c.productId === guestItem.productId && c.variantId === guestItem.variantId,
      );
      if (existingIdx >= 0) {
        userCart[existingIdx].qty += guestItem.qty;
      } else {
        userCart.push(guestItem);
      }
    }

    await this.update(userSessionId, { ...userData, cart: userCart });

    // Clear guest session cart
    await this.update(guestSessionId, { ...guestData, cart: [] });
  }

  /** Link session to user (after login) */
  async linkToUser(sessionId: string, userId: string) {
    await db.update(sessions)
      .set({ userId })
      .where(eq(sessions.id, sessionId));
  }
}
