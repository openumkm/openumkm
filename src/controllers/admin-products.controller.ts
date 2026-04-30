import { Controller, Get, Post, Param, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service';
import { ProductService } from '../services/product.service';
import { getAuthFromRequest } from '../common/auth.helper';

@Controller('/admin/products')
export class AdminProductsController {
  constructor(
    private readonly authService: AuthService,
    private readonly productService: ProductService,
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

    return res.view('admin/products.ejs', {
      pageTitle: 'Products — Admin',
      userName: user?.name || 'Admin',
      adminPage: 'products',
      products: result.products.map((p) => ({
        ...p,
        image: null, // images loaded separately if needed
      })),
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
      error: null,
    });
  }

  @Post()
  async createProduct(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const body = req.body as Record<string, any>;
    const slug = body.slug || this.productService.generateSlug(body.name || '');

    if (!body.name || !body.price || !body.weight) {
      const user = await this.authService.getUserById(auth.sub);
      return res.view('admin/product-form.ejs', {
        pageTitle: 'New Product — Admin',
        userName: user?.name || 'Admin',
        adminPage: 'products',
        error: 'Name, price, and weight are required.',
      });
    }

    await this.productService.create({
      name: body.name,
      slug,
      description: body.description || null,
      price: parseInt(body.price, 10),
      weight: parseInt(body.weight, 10),
      stock: parseInt(body.stock || '0', 10),
      minOrder: parseInt(body.minOrder || '1', 10),
      metaTitle: body.metaTitle || null,
      metaDescription: body.metaDescription || null,
      isActive: body.isActive === '1',
    });

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

    const body = req.body as Record<string, any>;
    await this.productService.update(id, {
      name: body.name,
      slug: body.slug || undefined,
      description: body.description || null,
      price: parseInt(body.price, 10),
      weight: parseInt(body.weight, 10),
      stock: parseInt(body.stock || '0', 10),
      minOrder: parseInt(body.minOrder || '1', 10),
      metaTitle: body.metaTitle || null,
      metaDescription: body.metaDescription || null,
      isActive: body.isActive === '1',
    });

    return res.redirect(302, '/admin/products');
  }

  @Post('/:id/delete')
  async deleteProduct(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    await this.productService.delete(id);
    return res.redirect(302, '/admin/products');
  }
}
