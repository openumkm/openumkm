import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as ejs from 'ejs';
import { join } from 'path';
import { SettingsService } from './settings.service';

interface EmailPayload {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
}

@Injectable()
export class EmailService {
  constructor(private readonly settingsService: SettingsService) {}

  /** Check if SMTP is configured and enabled */
  private async getTransporter(): Promise<nodemailer.Transporter | null> {
    const keys = [
      'smtp_enabled', 'smtp_host', 'smtp_port',
      'smtp_username', 'smtp_password', 'smtp_from_address',
    ];
    const s = await this.settingsService.getMany(keys);

    if (s.smtp_enabled !== 'true' || !s.smtp_host || !s.smtp_from_address) {
      return null;
    }

    return nodemailer.createTransport({
      host: s.smtp_host,
      port: parseInt(s.smtp_port || '587', 10),
      secure: parseInt(s.smtp_port || '587', 10) === 465,
      auth: (s.smtp_username && s.smtp_password) ? {
        user: s.smtp_username,
        pass: s.smtp_password,
      } : undefined,
    });
  }

  /** Render an EJS email template */
  private async render(template: string, data: Record<string, unknown>): Promise<string> {
    const templatePath = join(__dirname, '..', 'mail', 'templates', `${template}.ejs`);
    return ejs.renderFile(templatePath, data);
  }

  /** Send an email. Fails silently (logs error, never throws). */
  async send(payload: EmailPayload): Promise<boolean> {
    try {
      const transporter = await this.getTransporter();
      if (!transporter) {
        console.info(`[email] SMTP not configured, skipping: ${payload.subject}`);
        return false;
      }

      const fromAddress = await this.settingsService.get('smtp_from_address');
      const storeName = await this.settingsService.get('store_name') || 'Store';
      const html = await this.render(payload.template, {
        ...payload.data,
        storeName,
      });

      await transporter.sendMail({
        from: `"${storeName}" <${fromAddress}>`,
        to: payload.to,
        subject: payload.subject,
        html,
      });

      console.info(`[email] Sent: ${payload.subject} → ${payload.to}`);
      return true;
    } catch (err) {
      console.error(`[email] Failed: ${payload.subject} → ${payload.to}`, err);
      return false;
    }
  }

  /* ── Trigger Methods ─────────────────────────── */

  /** Order created with Xendit payment */
  async sendOrderCreatedXendit(order: {
    orderNumber: string;
    total: number;
    currency: string;
    paymentUrl?: string | null;
    items: unknown[];
    expiresAt: Date;
  }, customerEmail: string) {
    if (!customerEmail) return;
    await this.send({
      to: customerEmail,
      subject: `Order Confirmation — ${order.orderNumber}`,
      template: 'order-created-xendit',
      data: { order },
    });
  }

  /** Order created with manual bank transfer */
  async sendOrderCreatedManual(order: {
    orderNumber: string;
    total: number;
    currency: string;
    items: unknown[];
    expiresAt: Date;
  }, customerEmail: string, bankAccounts: Array<{
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  }>) {
    if (!customerEmail) return;
    await this.send({
      to: customerEmail,
      subject: `Order Confirmation — ${order.orderNumber}`,
      template: 'order-created-manual',
      data: { order, bankAccounts },
    });
  }

  /** Payment proof uploaded — notify seller */
  async sendPaymentProofUploaded(order: {
    orderNumber: string;
    total: number;
    id: string;
  }, confirmation: {
    senderBank: string;
    senderName: string;
    amount: number;
  }) {
    const sellerEmail = await this.settingsService.get('store_email');
    if (!sellerEmail) return;
    await this.send({
      to: sellerEmail,
      subject: `New Payment Confirmation — ${order.orderNumber}`,
      template: 'payment-proof-uploaded',
      data: { order, confirmation },
    });
  }

  /** Payment confirmed (paid) — notify customer + seller */
  async sendPaymentConfirmed(order: {
    orderNumber: string;
    total: number;
    currency: string;
  }, customerEmail: string) {
    const sellerEmail = await this.settingsService.get('store_email');

    if (customerEmail) {
      await this.send({
        to: customerEmail,
        subject: `Payment Confirmed — ${order.orderNumber}`,
        template: 'payment-confirmed',
        data: { order, recipient: 'customer' },
      });
    }

    if (sellerEmail) {
      await this.send({
        to: sellerEmail,
        subject: `Payment Confirmed — ${order.orderNumber}`,
        template: 'payment-confirmed',
        data: { order, recipient: 'seller' },
      });
    }
  }

  /** Payment rejected — notify customer */
  async sendPaymentRejected(order: {
    orderNumber: string;
    total: number;
  }, customerEmail: string, reason: string) {
    if (!customerEmail) return;
    await this.send({
      to: customerEmail,
      subject: `Payment Rejected — ${order.orderNumber}`,
      template: 'payment-rejected',
      data: { order, reason },
    });
  }

  /** Order shipped — notify customer */
  async sendOrderShipped(order: {
    orderNumber: string;
    courier?: string | null;
    courierService?: string | null;
    trackingNumber?: string | null;
  }, customerEmail: string) {
    if (!customerEmail) return;
    await this.send({
      to: customerEmail,
      subject: `Order Shipped — ${order.orderNumber}`,
      template: 'order-shipped',
      data: { order },
    });
  }

  /** Order cancelled — notify customer */
  async sendOrderCancelled(order: {
    orderNumber: string;
    total: number;
  }, customerEmail: string) {
    if (!customerEmail) return;
    await this.send({
      to: customerEmail,
      subject: `Order Cancelled — ${order.orderNumber}`,
      template: 'order-cancelled',
      data: { order },
    });
  }

  /** Forgot password — send reset link */
  async sendPasswordReset(email: string, token: string) {
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const resetUrl = `${baseUrl}/auth/reset-password/${token}`;
    await this.send({
      to: email,
      subject: 'Reset Your Password',
      template: 'password-reset',
      data: { resetUrl },
    });
  }
}
