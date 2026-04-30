/**
 * Dummy data for admin pages (UI-first development).
 * Will be replaced with real DB queries later.
 */

export const dummyAdminStats = {
  revenueToday: 2350000,
  ordersToday: 8,
  totalRevenue: 28750000,
  totalOrders: 156,
  avgOrderValue: 184294,
};

export const dummyRevenuePeriods = [
  { label: 'Daily', total: 2350000, orders: 8 },
  { label: 'Weekly', total: 12450000, orders: 42 },
  { label: 'Monthly', total: 28750000, orders: 156 },
];

export const dummyRecentOrders = [
  { id: '1', orderNumber: 'INV/20260430/001', customerName: 'Aji Prakoso', customerEmail: 'aji@example.com', total: 1590000, status: 'paid', paymentMethod: 'xendit', createdAt: '30 Apr 2026' },
  { id: '2', orderNumber: 'INV/20260430/002', customerName: null, customerEmail: null, total: 480000, status: 'pending', paymentMethod: 'manual_transfer', createdAt: '30 Apr 2026' },
  { id: '3', orderNumber: 'INV/20260430/003', customerName: 'Budi Santoso', customerEmail: 'budi@example.com', total: 890000, status: 'waiting_confirmation', paymentMethod: 'manual_transfer', createdAt: '30 Apr 2026' },
  { id: '4', orderNumber: 'INV/20260429/005', customerName: 'Siti Nurhaliza', customerEmail: 'siti@example.com', total: 1250000, status: 'shipped', paymentMethod: 'xendit', createdAt: '29 Apr 2026' },
  { id: '5', orderNumber: 'INV/20260429/002', customerName: 'Dewi Lestari', customerEmail: 'dewi@example.com', total: 675000, status: 'completed', paymentMethod: 'xendit', createdAt: '29 Apr 2026' },
];

export const dummyProducts = [
  { id: '1', name: 'Sneaker Urban 01', slug: 'sneaker-urban-01', price: 350000, stock: 25, isActive: true, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100&h=100&fit=crop', createdAt: '28 Apr 2026' },
  { id: '2', name: 'Classic Leather Watch', slug: 'classic-leather-watch', price: 1250000, stock: 12, isActive: true, image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100&h=100&fit=crop', createdAt: '27 Apr 2026' },
  { id: '3', name: 'Minimalist Backpack', slug: 'minimalist-backpack', price: 480000, stock: 0, isActive: true, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=100&h=100&fit=crop', createdAt: '26 Apr 2026' },
  { id: '4', name: 'Wireless Earbuds Pro', slug: 'wireless-earbuds-pro', price: 890000, stock: 3, isActive: false, image: 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=100&h=100&fit=crop', createdAt: '25 Apr 2026' },
  { id: '5', name: 'Cotton Tee Essential', slug: 'cotton-tee-essential', price: 150000, stock: 50, isActive: true, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=100&h=100&fit=crop', createdAt: '24 Apr 2026' },
];

export const dummyOrderDetail = {
  id: '1',
  orderNumber: 'INV/20260430/001',
  status: 'paid',
  paymentMethod: 'xendit',
  currency: 'IDR',
  courier: 'JNE',
  courierService: 'REG',
  trackingNumber: null,
  subtotal: 1590000,
  taxTotal: 174900,
  shippingCost: 25000,
  total: 1789900,
  expiresAt: '1 May 2026 14:30',
  createdAt: '30 Apr 2026 14:30',
  customerName: 'Aji Prakoso',
  customerEmail: 'aji@example.com',
  items: [
    { name: 'Sneaker Urban 01', variant: 'White / 42', price: 350000, qty: 2, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100&h=100&fit=crop' },
    { name: 'Wireless Earbuds Pro', variant: 'Black', price: 890000, qty: 1, image: 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=100&h=100&fit=crop' },
  ],
  shippingAddress: {
    recipientName: 'Aji Prakoso',
    phone: '08123456789',
    address: 'Jl. Sudirman No. 123, RT 05 RW 02',
    city: 'Jakarta Selatan',
    province: 'DKI Jakarta',
    postalCode: '12190',
  },
};

export const dummyPaymentConfirmations = [
  { id: 'pc1', orderNumber: 'INV/20260430/003', senderBank: 'BCA', senderName: 'Budi Santoso', amount: 890000, transferDate: '30 Apr 2026', receiptImage: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=200&h=150&fit=crop', notes: 'Transferred via mobile banking', status: 'pending', rejectionReason: null },
  { id: 'pc2', orderNumber: 'INV/20260428/002', senderBank: 'Mandiri', senderName: 'Dewi Lestari', amount: 675000, transferDate: '28 Apr 2026', receiptImage: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=200&h=150&fit=crop', notes: null, status: 'approved', rejectionReason: null },
  { id: 'pc3', orderNumber: 'INV/20260427/001', senderBank: 'BNI', senderName: 'Rudi Hartono', amount: 350000, transferDate: '27 Apr 2026', receiptImage: null, notes: 'Amount does not match', status: 'rejected', rejectionReason: 'Transfer amount does not match order total.' },
];
