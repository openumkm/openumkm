import { Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';
import { SettingsService } from '../services/settings.service';
import { OrderService } from '../services/order.service';
import { PaymentConfirmationService } from '../services/payment-confirmation.service';
import { EmailService } from '../services/email.service';
import { UploadService } from '../services/upload.service';
import { getAuthFromRequest } from '../common/auth.helper';
import { i18nContext } from '../common/view.helper';

@Controller()
export class PaymentController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly settingsService: SettingsService,
    private readonly orderService: OrderService,
    private readonly paymentConfirmationService: PaymentConfirmationService,
    private readonly emailService: EmailService,
    private readonly uploadService: UploadService,
  ) {}

  private getAuth(req: FastifyRequest) {
    return getAuthFromRequest(req, this.authService);
  }

  @Get('/payment/confirm/:id')
  async paymentConfirmPage(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = this.getAuth(req);
    const order = await this.orderService.getById(id);
    if (!order) return res.status(404).send('Order not found');

    const bankAccounts = await this.settingsService.getBankAccounts();
    const activeBanks = bankAccounts.filter((b) => b.isActive);
    const { cart } = await this.sessionService.getCart(req, res, auth?.sub);

    return res.view('storefront/payment-confirmation.ejs', {
      pageTitle: 'Payment Confirmation',
      orderNumber: order.orderNumber,
      orderId: order.id,
      total: order.total,
      bankAccounts: activeBanks,
      cartCount: cart.reduce((sum, i) => sum + i.qty, 0),
      isLoggedIn: !!auth,
      error: null,
      success: false,
      ...i18nContext(req),
    });
  }

  @Post('/payment/confirm/:id')
  async paymentConfirmSubmit(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = this.getAuth(req);
    const order = await this.orderService.getById(id);
    if (!order) return res.status(404).send('Order not found');

    const parts = (req as any).parts();
    const fields: Record<string, string> = {};
    let receiptImageUrl: string | null = null;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'receiptImage') {
        const buffer = await part.toBuffer();
        receiptImageUrl = await this.uploadService.uploadBuffer(buffer, 'receipts', part.mimetype || 'image/jpeg');
      } else if (part.type === 'field') {
        fields[part.fieldname] = part.value;
      }
    }

    if (!receiptImageUrl || !fields.senderBank || !fields.senderName || !fields.amount || !fields.transferDate) {
      const bankAccounts = await this.settingsService.getBankAccounts();
      const { cart } = await this.sessionService.getCart(req, res, auth?.sub);
      return res.view('storefront/payment-confirmation.ejs', {
        pageTitle: 'Payment Confirmation',
        orderNumber: order.orderNumber,
        orderId: order.id,
        total: order.total,
        bankAccounts: bankAccounts.filter((b) => b.isActive),
        cartCount: cart.reduce((sum, i) => sum + i.qty, 0),
        isLoggedIn: !!auth,
        error: 'Please fill all required fields and upload receipt image.',
        success: false,
        ...i18nContext(req),
      });
    }

    await this.paymentConfirmationService.create({
      orderId: order.id,
      senderBank: fields.senderBank,
      senderName: fields.senderName,
      amount: parseInt(fields.amount, 10),
      transferDate: fields.transferDate,
      receiptImage: receiptImageUrl,
      notes: fields.notes || null,
    });

    await this.orderService.updateStatus(order.id, 'waiting_confirmation');

    await this.emailService.sendPaymentProofUploaded(
      { orderNumber: order.orderNumber, total: order.total, id: order.id },
      { senderBank: fields.senderBank, senderName: fields.senderName, amount: parseInt(fields.amount, 10) },
    );

    const bankAccounts = await this.settingsService.getBankAccounts();
    const { cart } = await this.sessionService.getCart(req, res, auth?.sub);
    return res.view('storefront/payment-confirmation.ejs', {
      pageTitle: 'Payment Confirmation',
      orderNumber: order.orderNumber,
      orderId: order.id,
      total: order.total,
      bankAccounts: bankAccounts.filter((b) => b.isActive),
      cartCount: cart.reduce((sum, i) => sum + i.qty, 0),
      isLoggedIn: !!auth,
      error: null,
      success: true,
      ...i18nContext(req),
    });
  }
}
