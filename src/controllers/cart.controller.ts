import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service';
import { ProductService } from '../services/product.service';
import { SessionService } from '../services/session.service';
import { SettingsService } from '../services/settings.service';
import { ShippingService } from '../services/shipping.service';
import { getAuthFromRequest } from '../common/auth.helper';
import { i18nContext } from '../common/view.helper';

@Controller()
export class CartController {
  constructor(
    private readonly authService: AuthService,
    private readonly productService: ProductService,
    private readonly sessionService: SessionService,
    private readonly settingsService: SettingsService,
    private readonly shippingService: ShippingService,
  ) {}

  private getAuth(req: FastifyRequest) {
    return getAuthFromRequest(req, this.authService);
  }

  @Post('/cart/add')
  async cartAdd(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = this.getAuth(req);
    const body = req.body as Record<string, string>;
    const productId = body.productId;
    const variantId = body.variantId || undefined;
    const qty = Math.max(1, parseInt(body.qty || '1', 10));

    const product = await this.productService.getById(productId);
    if (!product) return res.redirect(302, '/');

    let price = product.price;
    let stock = product.stock;
    let weight = product.weight;
    let variantLabel = '';

    if (variantId) {
      const variant = product.variants.find((v) => v.id === variantId);
      if (variant) {
        price = variant.price ?? product.price;
        stock = variant.stock;
        weight = variant.weight ?? product.weight;
        variantLabel = variant.name;
      }
    }

    if (stock <= 0) return res.redirect(302, `/product/${product.slug}`);

    const primaryImage = product.images.find((i) => i.isPrimary) || product.images[0];

    const { sessionId } = await this.sessionService.getOrCreate(req, res, auth?.sub);
    await this.sessionService.addToCart(sessionId, {
      productId,
      variantId,
      name: product.name,
      variant: variantLabel || undefined,
      price,
      qty: Math.min(qty, stock),
      image: primaryImage?.url || undefined,
      weight,
      stock,
    });

    return res.redirect(302, '/cart');
  }

  @Get('/cart')
  async cartPage(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = this.getAuth(req);
    const { cart } = await this.sessionService.getCart(req, res, auth?.sub);

    const cartItems = await Promise.all(
      cart.map(async (item) => {
        const product = await this.productService.getById(item.productId);
        let currentStock = product?.stock || 0;
        if (item.variantId && product) {
          const variant = product.variants.find((v) => v.id === item.variantId);
          currentStock = variant?.stock ?? currentStock;
        }
        const stockChanged = currentStock !== item.stock;
        return { ...item, stock: currentStock, stockChanged, outOfStock: currentStock <= 0 };
      }),
    );

    const subtotal = cartItems.reduce((sum, i) => sum + i.price * i.qty, 0);

    return res.view('storefront/cart.ejs', {
      pageTitle: 'Shopping Cart',
      cartItems,
      subtotal,
      cartCount: cartItems.reduce((sum, i) => sum + i.qty, 0),
      isLoggedIn: !!auth,
      ...i18nContext(req),
    });
  }

  @Post('/cart/update')
  async cartUpdate(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = this.getAuth(req);
    const body = req.body as Record<string, string>;
    const { sessionId } = await this.sessionService.getOrCreate(req, res, auth?.sub);

    await this.sessionService.updateCartQty(
      sessionId,
      body.productId,
      body.variantId || undefined,
      Math.max(0, parseInt(body.qty || '1', 10)),
    );

    return res.redirect(302, '/cart');
  }

  @Post('/cart/remove')
  async cartRemove(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = this.getAuth(req);
    const body = req.body as Record<string, string>;
    const { sessionId } = await this.sessionService.getOrCreate(req, res, auth?.sub);

    await this.sessionService.removeFromCart(sessionId, body.productId, body.variantId || undefined);
    return res.redirect(302, '/cart');
  }

  /* ── Shipping AJAX ─────────────────────────────── */

  @Get('/api/shipping/search')
  async shippingSearch(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const query = (req.query as any).q || '';
    if (!query || query.length < 2) return res.send({ results: [] });

    const results = await this.shippingService.searchDestination(query, 10);
    return res.send({ results });
  }

  @Post('/api/shipping/calculate')
  async shippingCalculate(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const body = req.body as Record<string, string>;
    const { destination } = body;

    if (!destination) return res.send({ services: [] });

    const shippingMode = (await this.settingsService.get('shipping_mode')) || 'custom';
    const rajaOngkirEnabled = (await this.settingsService.get('rajaongkir_enabled')) === 'true';

    let customServices: any[] = [];
    if (shippingMode === 'custom' || shippingMode === 'both') {
      const methods = await this.settingsService.getActiveShippingMethods();
      customServices = methods.map((m) => ({
        courier: m.name,
        service: m.description || m.name,
        cost: m.cost,
        description: m.description || null,
        etd: '—',
      }));
    }

    if (shippingMode === 'custom' || !rajaOngkirEnabled) {
      return res.send({ services: customServices });
    }

    const rajaOngkirServices: any[] = [];
    if (shippingMode === 'rajaongkir' || shippingMode === 'both') {
      const origin = await this.settingsService.get('origin_city');
      if (!origin) {
        return res.send({ services: customServices, error: !customServices.length ? 'Origin city not configured.' : undefined });
      }

      const auth = this.getAuth(req);
      const { cart } = await this.sessionService.getCart(req, res, auth?.sub);
      const totalWeight = cart.reduce((sum, item) => sum + (item.weight * item.qty), 0);

      if (totalWeight > 0) {
        const services = await this.shippingService.calculateCost(origin, destination, totalWeight);
        rajaOngkirServices.push(...services);
      }
    }

    const allServices = [...customServices, ...rajaOngkirServices];
    return res.send({ services: allServices });
  }
}
