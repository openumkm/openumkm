import { Controller, Get, Post, Param, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service';
import { ProductService } from '../services/product.service';
import { UploadService } from '../services/upload.service';
import { getAuthFromRequest } from '../common/auth.helper';

@Controller('/admin/products')
export class AdminProductsController {
  constructor(
    private readonly authService: AuthService,
    private readonly productService: ProductService,
    private readonly uploadService: UploadService,
  ) {}

  private async guardAdmin(req: FastifyRequest, res: FastifyReply) {
    const auth = getAuthFromRequest(req, this.authService);
    if (!auth || auth.role !== 'seller') { res.redirect(302, '/auth/login'); return null; }
    return auth;
  }

  @Get()
  async productList(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const q = (req.query as any).q || '';
    const page = parseInt((req.query as any).page || '1', 10);
    const user = await this.authService.getUserById(auth.sub);
    const result = await this.productService.list({ search: q || undefined, page });

    // Load primary image for each product
    const productsWithImages = await Promise.all(
      result.products.map(async (p) => {
        const images = await this.productService.getImages(p.id);
        const primary = images.find((i) => i.isPrimary) || images[0];
        return { ...p, image: primary?.url || null };
      }),
    );

    return res.view('admin/products.ejs', {
      pageTitle: 'Products — Admin',
      userName: user?.name || 'Admin',
      adminPage: 'products',
      products: productsWithImages,
      search: q,
      page: result.page,
      pages: result.pages,
    });
  }

  @Get('/new')
  async newProductForm(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;
    const user = await this.authService.getUserById(auth.sub);

    return res.view('admin/product-form.ejs', {
      pageTitle: 'New Product — Admin',
      userName: user?.name || 'Admin',
      adminPage: 'products',
      product: null,
      error: null,
    });
  }

  @Post()
  async createProduct(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    // Parse multipart form
    const parts = (req as any).parts();
    const fields: Record<string, string> = {};
    const imageUrls: string[] = [];
    let ogImageUrl: string | null = null;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'images') {
        const buffer = await part.toBuffer();
        if (buffer.length > 0 && buffer.length <= 5 * 1024 * 1024) {
          const { v4: uuidv4 } = await import('uuid');
          const ext = part.mimetype === 'image/png' ? '.png' : part.mimetype === 'image/webp' ? '.webp' : '.jpg';
          const filename = `${uuidv4()}${ext}`;
          const { join } = await import('path');
          const { existsSync, mkdirSync, writeFileSync } = await import('fs');
          const dir = join(process.cwd(), 'uploads', 'products');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, filename), buffer);
          imageUrls.push(`/uploads/products/${filename}`);
        }
      } else if (part.type === 'file' && part.fieldname === 'ogImage') {
        const buffer = await part.toBuffer();
        if (buffer.length > 0 && buffer.length <= 5 * 1024 * 1024) {
          const { v4: uuidv4 } = await import('uuid');
          const ext = part.mimetype === 'image/png' ? '.png' : part.mimetype === 'image/webp' ? '.webp' : '.jpg';
          const filename = `${uuidv4()}${ext}`;
          const { join } = await import('path');
          const { existsSync, mkdirSync, writeFileSync } = await import('fs');
          const dir = join(process.cwd(), 'uploads', 'og');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, filename), buffer);
          ogImageUrl = `/uploads/og/${filename}`;
        }
      } else if (part.type === 'field') {
        fields[part.fieldname] = part.value;
      }
    }

    const slug = fields.slug || this.productService.generateSlug(fields.name || '');

    if (!fields.name || !fields.price || !fields.weight) {
      const user = await this.authService.getUserById(auth.sub);
      return res.view('admin/product-form.ejs', {
        pageTitle: 'New Product — Admin',
        userName: user?.name || 'Admin',
        adminPage: 'products',
        product: null,
        error: 'Name, price, and weight are required.',
      });
    }

    const product = await this.productService.create({
      name: fields.name,
      slug,
      description: fields.description || null,
      price: parseInt(fields.price, 10),
      weight: parseInt(fields.weight, 10),
      stock: parseInt(fields.stock || '0', 10),
      minOrder: parseInt(fields.minOrder || '1', 10),
      metaTitle: fields.metaTitle || null,
      metaDescription: fields.metaDescription || null,
      ogImage: ogImageUrl,
      isActive: fields.isActive === '1',
    });

    // Save images
    for (let i = 0; i < imageUrls.length; i++) {
      await this.productService.addImage(product.id, imageUrls[i], i === 0);
    }

    return res.redirect(302, '/admin/products');
  }

  @Get('/:id/edit')
  async editProductForm(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const user = await this.authService.getUserById(auth.sub);
    const product = await this.productService.getById(id);
    if (!product) return res.status(404).send('Product not found');

    return res.view('admin/product-form.ejs', {
      pageTitle: `Edit ${product.name} — Admin`,
      userName: user?.name || 'Admin',
      adminPage: 'products',
      product,
      error: null,
    });
  }

  @Post('/:id')
  async updateProduct(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    // Parse multipart form
    const parts = (req as any).parts();
    const fields: Record<string, string> = {};
    const imageUrls: string[] = [];
    let ogImageUrl: string | null = null;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'images') {
        const buffer = await part.toBuffer();
        if (buffer.length > 0 && buffer.length <= 5 * 1024 * 1024) {
          const { v4: uuidv4 } = await import('uuid');
          const ext = part.mimetype === 'image/png' ? '.png' : part.mimetype === 'image/webp' ? '.webp' : '.jpg';
          const filename = `${uuidv4()}${ext}`;
          const { join } = await import('path');
          const { existsSync, mkdirSync, writeFileSync } = await import('fs');
          const dir = join(process.cwd(), 'uploads', 'products');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, filename), buffer);
          imageUrls.push(`/uploads/products/${filename}`);
        }
      } else if (part.type === 'file' && part.fieldname === 'ogImage') {
        const buffer = await part.toBuffer();
        if (buffer.length > 0 && buffer.length <= 5 * 1024 * 1024) {
          const { v4: uuidv4 } = await import('uuid');
          const ext = part.mimetype === 'image/png' ? '.png' : part.mimetype === 'image/webp' ? '.webp' : '.jpg';
          const filename = `${uuidv4()}${ext}`;
          const { join } = await import('path');
          const { existsSync, mkdirSync, writeFileSync } = await import('fs');
          const dir = join(process.cwd(), 'uploads', 'og');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, filename), buffer);
          ogImageUrl = `/uploads/og/${filename}`;
        }
      } else if (part.type === 'field') {
        fields[part.fieldname] = part.value;
      }
    }

    const updateData: any = {
      name: fields.name,
      slug: fields.slug || undefined,
      description: fields.description || null,
      price: parseInt(fields.price, 10),
      weight: parseInt(fields.weight, 10),
      stock: parseInt(fields.stock || '0', 10),
      minOrder: parseInt(fields.minOrder || '1', 10),
      metaTitle: fields.metaTitle || null,
      metaDescription: fields.metaDescription || null,
      isActive: fields.isActive === '1',
    };
    if (ogImageUrl) updateData.ogImage = ogImageUrl;

    await this.productService.update(id, updateData);

    // Add new images if uploaded
    for (const url of imageUrls) {
      await this.productService.addImage(id, url, false);
    }

    return res.redirect(302, '/admin/products');
  }

  @Post('/:id/delete')
  async deleteProduct(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    await this.productService.delete(id);
    return res.redirect(302, '/admin/products');
  }

  /* ── Image Management ────────────────────────── */

  @Post('/:id/images/:imageId/delete')
  async deleteImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const img = await this.productService.deleteImage(imageId);
    if (img) this.uploadService.deleteFile(img.url);

    return res.redirect(302, `/admin/products/${id}/edit`);
  }

  /* ── Variant Management ──────────────────────── */

  @Post('/:id/variants')
  async addVariant(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const body = req.body as Record<string, string>;
    if (body.name) {
      await this.productService.addVariant(id, {
        name: body.name,
        size: body.size || undefined,
        color: body.color || undefined,
        price: body.price ? parseInt(body.price, 10) : undefined,
        weight: body.weight ? parseInt(body.weight, 10) : undefined,
        stock: parseInt(body.stock || '0', 10),
      });
    }

    return res.redirect(302, `/admin/products/${id}/edit`);
  }

  @Post('/:id/variants/:variantId/delete')
  async deleteVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    await this.productService.deleteVariant(variantId);
    return res.redirect(302, `/admin/products/${id}/edit`);
  }
}
