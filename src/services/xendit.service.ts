import { Injectable } from '@nestjs/common';
import { SettingsService } from './settings.service';

interface CreateInvoiceParams {
  externalId: string;
  amount: number;
  payerEmail: string;
  description: string;
  successRedirectUrl: string;
  failureRedirectUrl?: string;
  invoiceDuration?: number;
  currency?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
}

interface XenditInvoice {
  id: string;
  external_id: string;
  status: string;
  amount: number;
  invoice_url: string;
  expiry_date: string;
}

@Injectable()
export class XenditService {
  constructor(private readonly settingsService: SettingsService) {}

  private async getApiKey(): Promise<string | null> {
    return this.settingsService.get('xendit_secret_key');
  }

  async isEnabled(): Promise<boolean> {
    const key = await this.getApiKey();
    const enabled = await this.settingsService.get('xendit_enabled');
    return !!(key && enabled === 'true');
  }

  async createInvoice(params: CreateInvoiceParams): Promise<XenditInvoice | null> {
    const apiKey = await this.getApiKey();
    if (!apiKey) return null;

    const baseUrl = process.env.XENDIT_API_URL || 'https://api.xendit.co';
    const auth = Buffer.from(`${apiKey}:`).toString('base64');

    const body: Record<string, unknown> = {
      external_id: params.externalId,
      amount: params.amount,
      payer_email: params.payerEmail || undefined,
      description: params.description,
      success_redirect_url: params.successRedirectUrl,
      invoice_duration: params.invoiceDuration || 86400, // default 24 hours
      currency: params.currency || 'IDR',
      items: params.items || [],
    };

    if (params.failureRedirectUrl) {
      body.failure_redirect_url = params.failureRedirectUrl;
    }

    const res = await fetch(`${baseUrl}/v2/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[Xendit] Invoice creation failed:', res.status, err);
      return null;
    }

    const invoice: XenditInvoice = await res.json();
    return invoice;
  }
}
