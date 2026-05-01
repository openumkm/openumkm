import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service';
import { ProductService } from '../services/product.service';
import { SessionService } from '../services/session.service';
import { SettingsService } from '../services/settings.service';
import { getAuthFromRequest } from '../common/auth.helper';
import { i18nContext } from '../common/view.helper';

@Controller()
export class StorefrontController {
  constructor(
    private readonly authService: AuthService,
    private readonly productService: ProductService,
    private readonly sessionService: SessionService,
    private readonly settingsService: SettingsService,
  ) {}

  private getAuth(req: FastifyRequest) {
    return getAuthFromRequest(req, this.authService);
  }

  @Get('/')
  async homePage(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = this.getAuth(req);
    const query = req.query as Record<string, string>;
    const search = query.q || '';
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '12', 10);
    const sort = query.sort || '';

    const result = await this.productService.list({
      search: search || undefined,
      page,
      limit,
      activeOnly: true,
      sort,
    });

    const productsWithImages = await Promise.all(
      result.products.map(async (p) => {
        const images = await this.productService.getImages(p.id);
        const primary = images.find((i) => i.isPrimary) || images[0];
        return { ...p, image: primary?.url || null };
      }),
    );

    const { cart } = await this.sessionService.getCart(req, res, auth?.sub);
    const seoTitle = await this.settingsService.get('seo_title');
    const seoDesc = await this.settingsService.get('seo_description');
    const storeName = await this.settingsService.get('store_name');

    return res.view('storefront/home.ejs', {
      pageTitle: seoTitle || storeName || 'Store',
      products: productsWithImages,
      search,
      page: result.page,
      pages: result.pages,
      sort,
      cartCount: cart.reduce((sum, i) => sum + i.qty, 0),
      isLoggedIn: !!auth,
      metaDescription: seoDesc || '',
      ...i18nContext(req),
    });
  }

  @Get('/product/:slug')
  async productDetailPage(@Param('slug') slug: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = this.getAuth(req);
    const product = await this.productService.getBySlug(slug);
    if (!product) return res.status(404).send('Product not found');

    const { cart } = await this.sessionService.getCart(req, res, auth?.sub);

    const related = await this.productService.list({ activeOnly: true, limit: 4 });
    const relatedWithImages = await Promise.all(
      related.products
        .filter((p) => p.id !== product.id)
        .slice(0, 4)
        .map(async (p) => {
          const images = await this.productService.getImages(p.id);
          const primary = images.find((i) => i.isPrimary) || images[0];
          return { ...p, image: primary?.url || null };
        }),
    );

    return res.view('storefront/product-detail.ejs', {
      pageTitle: `${product.metaTitle || product.name} — Store`,
      product: {
        ...product,
        images: product.images.map((i) => i.url),
      },
      cartCount: cart.reduce((sum, i) => sum + i.qty, 0),
      isLoggedIn: !!auth,
      relatedProducts: relatedWithImages,
      ...i18nContext(req),
    });
  }
}
