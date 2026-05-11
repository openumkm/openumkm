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
    if (!product) return res.redirect('/', 302);

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

    if (stock <= 0) return res.redirect(`/product/${product.slug}`, 302);

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

    return res.redirect('/cart', 302);
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

    return res.redirect('/cart', 302);
  }

  @Post('/cart/remove')
  async cartRemove(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = this.getAuth(req);
    const body = req.body as Record<string, string>;
    const { sessionId } = await this.sessionService.getOrCreate(req, res, auth?.sub);

    await this.sessionService.removeFromCart(sessionId, body.productId, body.variantId || undefined);
    return res.redirect('/cart', 302);
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

    if (!destination) {
      console.log('[checkout:debug] /api/shipping/calculate — no destination');
      return res.send({ services: [], error: 'Destination not selected.' });
    }

    const shippingMode = (await this.settingsService.get('shipping_mode')) || 'custom';
    const rajaOngkirEnabled = (await this.settingsService.get('rajaongkir_enabled')) === 'true';

    console.log('[checkout:debug] /api/shipping/calculate', { shippingMode, rajaOngkirEnabled, destination });

    let customServices: any[] = [];
    if (shippingMode === 'custom' || shippingMode === 'both') {
      const methods = await this.settingsService.getActiveShippingMethods();
      console.log('[checkout:debug] custom shipping methods loaded:', methods.length);
      customServices = methods.map((m) => ({
        courier: m.name,
        service: m.description || m.name,
        cost: m.cost,
        description: m.description || null,
        etd: '—',
      }));
    }

    if (shippingMode === 'custom' || !rajaOngkirEnabled) {
      console.log('[checkout:debug] returning custom-only, services:', customServices.length);
      return res.send({
        services: customServices,
        error: !customServices.length ? 'No shipping methods available. Please contact the seller.' : undefined,
      });
    }

    const rajaOngkirServices: any[] = [];
    if (shippingMode === 'rajaongkir' || shippingMode === 'both') {
      const origin = await this.settingsService.get('origin_city');
      console.log('[checkout:debug] origin city:', origin || '<not set>');

      if (!origin) {
        console.log('[checkout:debug] no origin, returning custom with error');
        return res.send({
          services: customServices,
          error: customServices.length ? 'RajaOngkir shipping unavailable — origin city not configured.' : 'Origin city not configured. Please contact the seller.',
        });
      }

      const auth = this.getAuth(req);
      const { cart } = await this.sessionService.getCart(req, res, auth?.sub);
      const totalWeight = cart.reduce((sum, item) => sum + (item.weight * item.qty), 0);

      console.log('[checkout:debug] cart items:', cart.length, 'total weight (grams):', totalWeight);

      if (totalWeight <= 0) {
        console.log('[checkout:debug] total weight is 0, returning custom-only');
        return res.send({
          services: customServices,
          error: !customServices.length ? 'Unable to calculate shipping — cart has no weight.' : undefined,
        });
      }

      console.log('[checkout:debug] calling shippingService.calculateCost with', { origin, destination, totalWeight });
      const services = await this.shippingService.calculateCost(origin, destination, totalWeight);
      console.log('[checkout:debug] rajaongkir returned', services.length, 'services');
      if (services.length > 0) {
        rajaOngkirServices.push(...services);
      } else if (!customServices.length) {
        console.log('[checkout:debug] no rajaongkir services and no custom, returning error');
        return res.send({ services: [], error: 'No shipping services available for this destination. Please try a different location.' });
      }
    }

    const allServices = [...customServices, ...rajaOngkirServices];
    console.log('[checkout:debug] final services:', allServices.length);
    return res.send({ services: allServices });
  }
}
