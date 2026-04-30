import { Controller, Get, Param, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

const dummyOrders = [
  { id: '1', orderNumber: 'INV/20260430/001', status: 'paid', total: 1590000, items: 2, createdAt: '2026-04-30' },
  { id: '2', orderNumber: 'INV/20260429/003', status: 'shipped', total: 480000, items: 1, createdAt: '2026-04-29' },
  { id: '3', orderNumber: 'INV/20260428/001', status: 'completed', total: 350000, items: 1, createdAt: '2026-04-28' },
];

const orderDetail = {
  id: '1',
  orderNumber: 'INV/20260430/001',
  status: 'paid',
  subtotal: 1590000,
  shipping: 25000,
  tax: 174900,
  total: 1789900,
  items: [
    { name: 'Sneaker Urban 01', variant: 'White / 42', price: 350000, qty: 2, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100&h=100&fit=crop' },
    { name: 'Wireless Earbuds Pro', variant: 'Black', price: 890000, qty: 1, image: 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=100&h=100&fit=crop' },
  ],
  shippingAddress: {
    recipient: 'Aji Prakoso',
    phone: '08123456789',
    address: 'Jl. Sudirman No. 123, RT 05 RW 02',
    city: 'Jakarta Selatan',
    province: 'DKI Jakarta',
    postalCode: '12190',
  },
  courier: 'JNE REG',
  trackingNumber: null,
  paymentMethod: 'xendit',
  createdAt: '2026-04-30 14:30',
};

const dummyAddresses = [
  { id: '1', label: 'Rumah', recipientName: 'Aji Prakoso', phone: '08123456789', address: 'Jl. Sudirman No. 123, Jakarta Selatan', isDefault: true },
  { id: '2', label: 'Kantor', recipientName: 'Aji Prakoso', phone: '08129876543', address: 'Jl. Thamrin No. 45, Jakarta Pusat', isDefault: false },
];

@Controller('/dashboard')
export class DashboardController {
  @Get()
  dashboardPage(@Res() res: FastifyReply) {
    return res.view('dashboard/index.ejs', {
      pageTitle: 'My Dashboard — Swift Commerce',
      isLoggedIn: true,
      cartCount: 0,
      userName: 'Aji Prakoso',
      recentOrders: dummyOrders,
      stats: {
        totalOrders: 12,
        pendingOrders: 2,
        completedOrders: 10,
      },
    });
  }

  @Get('/orders')
  ordersPage(@Res() res: FastifyReply) {
    return res.view('dashboard/orders.ejs', {
      pageTitle: 'My Orders — Swift Commerce',
      isLoggedIn: true,
      cartCount: 0,
      userName: 'Aji Prakoso',
      orders: dummyOrders,
    });
  }

  @Get('/orders/:id')
  orderDetailPage(@Param('id') id: string, @Res() res: FastifyReply) {
    return res.view('dashboard/order-detail.ejs', {
      pageTitle: `Order ${orderDetail.orderNumber} — Swift Commerce`,
      isLoggedIn: true,
      cartCount: 0,
      userName: 'Aji Prakoso',
      order: orderDetail,
    });
  }

  @Get('/addresses')
  addressesPage(@Res() res: FastifyReply) {
    return res.view('dashboard/addresses.ejs', {
      pageTitle: 'My Addresses — Swift Commerce',
      isLoggedIn: true,
      cartCount: 0,
      userName: 'Aji Prakoso',
      addresses: dummyAddresses,
    });
  }
}
