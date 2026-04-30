import { Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

const dummyProducts = [
  { id: '1', slug: 'sneaker-urban-01', name: 'Sneaker Urban 01', price: 350000, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop', category: 'Shoes' },
  { id: '2', slug: 'classic-leather-watch', name: 'Classic Leather Watch', price: 1250000, image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop', category: 'Accessories' },
  { id: '3', slug: 'minimalist-backpack', name: 'Minimalist Backpack', price: 480000, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop', category: 'Bags' },
  { id: '4', slug: 'wireless-earbuds-pro', name: 'Wireless Earbuds Pro', price: 890000, image: 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=400&h=400&fit=crop', category: 'Electronics' },
  { id: '5', slug: 'cotton-tee-essential', name: 'Cotton Tee Essential', price: 150000, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop', category: 'Clothing' },
  { id: '6', slug: 'ceramic-coffee-mug', name: 'Ceramic Coffee Mug', price: 95000, image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop', category: 'Home' },
  { id: '7', slug: 'denim-jacket-v2', name: 'Denim Jacket V2', price: 675000, image: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=400&h=400&fit=crop', category: 'Clothing' },
  { id: '8', slug: 'smart-fitness-band', name: 'Smart Fitness Band', price: 420000, image: 'https://images.unsplash.com/photo-1575311373937-040b8e3fd6ce?w=400&h=400&fit=crop', category: 'Electronics' },
];

const productDetail = {
  id: '1',
  slug: 'sneaker-urban-01',
  name: 'Sneaker Urban 01',
  price: 350000,
  description: 'Step into comfort with our Urban Sneaker collection. Crafted with premium canvas and a vulcanized rubber sole, these sneakers offer all-day comfort with a timeless silhouette. The minimalist design pairs effortlessly with any outfit, making it a versatile addition to your wardrobe.',
  images: [
    'https://images.unsplash.com/photo-1542291026-7eec264c7ff?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&h=600&fit=crop',
  ],
  weight: 800,
  stock: 25,
  variants: [
    { label: 'Size', name: 'size', options: ['40', '41', '42'] },
    { label: 'Color', name: 'color', options: ['White', 'Black'] },
  ],
  category: 'Shoes',
  metaTitle: 'Sneaker Urban 01 - Swift Commerce',
  metaDescription: 'Premium canvas sneakers with vulcanized rubber sole. All-day comfort.',
};

@Controller()
export class StorefrontController {
  @Get('/')
  homePage(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const search = (req.query as any).q || '';
    const filtered = search
      ? dummyProducts.filter((p) =>
          p.name.toLowerCase().includes(search.toLowerCase()),
        )
      : dummyProducts;

    return res.view('storefront/home.ejs', {
      pageTitle: 'Swift Commerce — Modern Online Store',
      products: filtered,
      search,
      cartCount: 0,
      isLoggedIn: false,
      metaDescription: 'Discover curated premium products at Swift Commerce. Modern minimalist online store.',
    });
  }

  @Get('/product/:slug')
  productDetailPage(@Param('slug') slug: string, @Res() res: FastifyReply) {
    const product = slug === 'sneaker-urban-01'
      ? productDetail
      : { ...dummyProducts[0], ...productDetail, images: [dummyProducts[0].image] };

    return res.view('storefront/product-detail.ejs', {
      pageTitle: `${product.name} — Swift Commerce`,
      product,
      cartCount: 0,
      isLoggedIn: false,
      relatedProducts: dummyProducts.slice(0, 4),
    });
  }

  @Get('/cart')
  cartPage(@Res() res: FastifyReply) {
    const cartItems = [
      { id: '1', name: 'Sneaker Urban 01', variant: 'White / 42', price: 350000, qty: 2, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop' },
      { id: '4', name: 'Wireless Earbuds Pro', variant: 'Black', price: 890000, qty: 1, image: 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=200&h=200&fit=crop' },
    ];
    const subtotal = cartItems.reduce((sum, i) => sum + i.price * i.qty, 0);

    return res.view('storefront/cart.ejs', {
      pageTitle: 'Shopping Cart — Swift Commerce',
      cartItems,
      subtotal,
      cartCount: 3,
      isLoggedIn: false,
    });
  }

  @Get('/checkout')
  checkoutPage(@Res() res: FastifyReply) {
    const cartItems = [
      { id: '1', name: 'Sneaker Urban 01', variant: 'White / 42', price: 350000, qty: 2, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100&h=100&fit=crop' },
      { id: '4', name: 'Wireless Earbuds Pro', variant: 'Black', price: 890000, qty: 1, image: 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=100&h=100&fit=crop' },
    ];
    const subtotal = cartItems.reduce((sum, i) => sum + i.price * i.qty, 0);
    const shipping = 25000;
    const tax = Math.round(subtotal * 0.11);
    const total = subtotal + shipping + tax;

    const couriers = [
      { code: 'jne', name: 'JNE', services: [{ name: 'REG', cost: 25000, etd: '2-3 days' }] },
      { code: 'tiki', name: 'TIKI', services: [{ name: 'REG', cost: 30000, etd: '2-4 days' }] },
      { code: 'pos', name: 'POS Indonesia', services: [{ name: 'REG', cost: 20000, etd: '3-5 days' }] },
    ];

    const bankAccounts = [
      { bankName: 'BCA', accountNumber: '1234567890', accountHolder: 'Swift Commerce', logo: 'bca' },
      { bankName: 'Mandiri', accountNumber: '0987654321', accountHolder: 'Swift Commerce', logo: 'mandiri' },
    ];

    return res.view('storefront/checkout.ejs', {
      pageTitle: 'Checkout — Swift Commerce',
      cartItems,
      subtotal,
      shipping,
      tax,
      total,
      couriers,
      bankAccounts,
      cartCount: 3,
      isLoggedIn: false,
    });
  }

  @Get('/checkout/success/:id')
  checkoutSuccessPage(@Param('id') id: string, @Res() res: FastifyReply) {
    return res.view('storefront/checkout-success.ejs', {
      pageTitle: 'Order Confirmed — Swift Commerce',
      isLoggedIn: false,
      order: {
        id,
        orderNumber: 'INV/20260430/001',
        total: 1789900,
        paymentMethod: 'manual_transfer',
        paymentUrl: null,
      },
      bankAccounts: [
        { bankName: 'BCA', accountNumber: '1234567890', accountHolder: 'Swift Commerce' },
        { bankName: 'Mandiri', accountNumber: '0987654321', accountHolder: 'Swift Commerce' },
      ],
    });
  }

  @Get('/payment/confirm/:id')
  paymentConfirmationPage(@Param('id') id: string, @Res() res: FastifyReply) {
    return res.view('storefront/payment-confirmation.ejs', {
      pageTitle: 'Payment Confirmation — Swift Commerce',
      orderNumber: 'INV/20260430/001',
      orderId: id,
      total: 1590000,
      bankAccounts: [
        { bankName: 'BCA', accountNumber: '1234567890', accountHolder: 'Swift Commerce', logo: 'bca' },
        { bankName: 'Mandiri', accountNumber: '0987654321', accountHolder: 'Swift Commerce', logo: 'mandiri' },
      ],
      cartCount: 0,
      isLoggedIn: false,
    });
  }
}
