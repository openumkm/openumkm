import { Injectable } from '@nestjs/common';
import { db } from '../db';
import { products, productImages, productVariants } from '../db/schema';
import { eq, like, desc, asc, sql, and, SQL } from 'drizzle-orm';

@Injectable()
export class ProductService {
  async list(opts: { search?: string; page?: number; limit?: number; activeOnly?: boolean; sort?: string } = {}) {
    const { search, page = 1, limit = 20, activeOnly = false, sort } = opts;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (search) conditions.push(like(products.name, `%${search}%`));
    if (activeOnly) conditions.push(eq(products.isActive, true));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Determine sort order
    let orderBy;
    switch (sort) {
      case 'price_asc': orderBy = asc(products.price); break;
      case 'price_desc': orderBy = desc(products.price); break;
      case 'name_asc': orderBy = asc(products.name); break;
      case 'name_desc': orderBy = desc(products.name); break;
      default: orderBy = desc(products.createdAt);
    }

    const rows = await db.select()
      .from(products)
      .where(where)
      .orderBy(orderBy)
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

  /** Get images for a product (without loading full product) */
  async getImages(productId: string) {
    return db.select()
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(productImages.sortOrder);
  }

  async create(data: {
    name: string; slug: string; description?: string | null;
    price: number; weight: number; stock: number; minOrder?: number;
    metaTitle?: string | null; metaDescription?: string | null; ogImage?: string | null; isActive?: boolean;
  }) {
    const [product] = await db.insert(products).values({
      ...data,
      minOrder: data.minOrder || 1,
      isActive: data.isActive ?? true,
    }).returning();
    return product;
  }

  async update(id: string, data: Partial<{
    name: string; slug: string; description: string | null;
    price: number; weight: number; stock: number; minOrder: number;
    metaTitle: string | null; metaDescription: string | null; ogImage: string | null; isActive: boolean;
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
    const [img] = await db.insert(productImages).values({ productId, url, isPrimary }).returning();
    return img;
  }

  async setPrimaryImage(productId: string, imageId: string) {
    // Unset all images for this product, then set the target one
    await db.update(productImages)
      .set({ isPrimary: false })
      .where(eq(productImages.productId, productId));
    await db.update(productImages)
      .set({ isPrimary: true })
      .where(eq(productImages.id, imageId));
  }

  async deleteImage(imageId: string) {
    const [img] = await db.delete(productImages).where(eq(productImages.id, imageId)).returning();
    return img;
  }

  async addVariant(productId: string, data: {
    name: string; size?: string; color?: string; price?: number; weight?: number; stock: number;
  }) {
    const [variant] = await db.insert(productVariants).values({ productId, ...data }).returning();
    return variant;
  }

  async deleteVariant(variantId: string) {
    await db.delete(productVariants).where(eq(productVariants.id, variantId));
  }

  /** Deduct stock from product or variant */
  async deductStock(productId: string, variantId?: string, qty = 1) {
    if (variantId) {
      await db.update(productVariants)
        .set({ stock: sql`GREATEST(${productVariants.stock} - ${qty}, 0)` })
        .where(eq(productVariants.id, variantId));
    } else {
      await db.update(products)
        .set({ stock: sql`GREATEST(${products.stock} - ${qty}, 0)` })
        .where(eq(products.id, productId));
    }
  }

  generateSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
}
