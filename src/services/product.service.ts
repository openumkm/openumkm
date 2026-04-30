import { Injectable } from '@nestjs/common';
import { db } from '../db';
import { products, productImages, productVariants } from '../db/schema';
import { eq, like, desc, sql, and, SQL } from 'drizzle-orm';

@Injectable()
export class ProductService {
  async list(opts: { search?: string; page?: number; limit?: number; activeOnly?: boolean } = {}) {
    const { search, page = 1, limit = 20, activeOnly = false } = opts;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (search) conditions.push(like(products.name, `%${search}%`));
    if (activeOnly) conditions.push(eq(products.isActive, true));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db.select()
      .from(products)
      .where(where)
      .orderBy(desc(products.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(products)
      .where(where);

    return {
      products: rows,
      total: Number(countResult.count),
      pages: Math.ceil(Number(countResult.count) / limit),
      page,
    };
  }

  async getBySlug(slug: string) {
    const [product] = await db.select()
      .from(products)
      .where(eq(products.slug, slug))
      .limit(1);

    if (!product) return null;

    const images = await db.select()
      .from(productImages)
      .where(eq(productImages.productId, product.id))
      .orderBy(productImages.sortOrder);

    const variants = await db.select()
      .from(productVariants)
      .where(eq(productVariants.productId, product.id));

    return { ...product, images, variants };
  }

  async getById(id: string) {
    const [product] = await db.select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!product) return null;

    const images = await db.select()
      .from(productImages)
      .where(eq(productImages.productId, id))
      .orderBy(productImages.sortOrder);

    const variants = await db.select()
      .from(productVariants)
      .where(eq(productVariants.productId, id));

    return { ...product, images, variants };
  }

  async create(data: {
    name: string; slug: string; description?: string;
    price: number; weight: number; stock: number; minOrder?: number;
    metaTitle?: string; metaDescription?: string; isActive?: boolean;
  }) {
    const [product] = await db.insert(products).values({
      ...data,
      minOrder: data.minOrder || 1,
      isActive: data.isActive ?? true,
    }).returning();
    return product;
  }

  async update(id: string, data: Partial<{
    name: string; slug: string; description: string;
    price: number; weight: number; stock: number; minOrder: number;
    metaTitle: string; metaDescription: string; isActive: boolean;
  }>) {
    const [product] = await db.update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async delete(id: string) {
    await db.delete(products).where(eq(products.id, id));
  }

  async addImage(productId: string, url: string, isPrimary = false) {
    await db.insert(productImages).values({ productId, url, isPrimary });
  }

  async addVariant(productId: string, data: {
    name: string; size?: string; color?: string; price?: number; weight?: number; stock: number;
  }) {
    await db.insert(productVariants).values({ productId, ...data });
  }

  generateSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
}
