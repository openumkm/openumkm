import { Controller, Get, Post, Param, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service';
import { SettingsService } from '../services/settings.service';
import { getAuthFromRequest } from '../common/auth.helper';

const SETTING_KEYS = [
  'store_name', 'store_email', 'store_phone', 'invoice_prefix', 'default_language',
  'xendit_secret_key', 'rajaongkir_api_key', 'origin_city',
  'smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'smtp_from_address', 'smtp_enabled',
  'xendit_enabled', 'manual_transfer_enabled', 'auto_expire_hours', 'tax_enabled',
  'seo_title', 'seo_description',
  'ai_base_url', 'ai_api_key', 'ai_model', 'ai_enabled',
  'rajaongkir_enabled', 'shipping_mode',
];

const COURIERS = [
  { code: 'jne', name: 'JNE' }, { code: 'pos', name: 'POS Indonesia' },
  { code: 'tiki', name: 'TIKI' }, { code: 'jnt', name: 'J&T Express' },
  { code: 'sicepat', name: 'SiCepat' }, { code: 'anteraja', name: 'AnterAja' },
  { code: 'ninja', name: 'Ninja Express' }, { code: 'idexpress', name: 'ID Express' },
];

@Controller('/admin/settings')
export class AdminSettingsController {
  constructor(
    private readonly authService: AuthService,
    private readonly settingsService: SettingsService,
  ) {}

  private async guardAdmin(req: FastifyRequest, res: FastifyReply) {
    const auth = getAuthFromRequest(req, this.authService);
    if (!auth || auth.role !== 'seller') { res.redirect(302, '/auth/login'); return null; }
    return auth;
  }

  @Get()
  async settingsPage(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const user = await this.authService.getUserById(auth.sub);
    const s = await this.settingsService.getMany([...SETTING_KEYS, 'enabled_couriers']);
    const enabledCouriers = (s.enabled_couriers || '').split(',').filter(Boolean);

    return res.view('admin/settings.ejs', {
      pageTitle: 'Settings — Admin',
      userName: user?.name || 'Admin',
      adminPage: 'settings',
      settings: {
        storeName: s.store_name, storeEmail: s.store_email, storePhone: s.store_phone,
        invoicePrefix: s.invoice_prefix, defaultLanguage: s.default_language,
        xenditSecretKey: s.xendit_secret_key, rajaOngkirApiKey: s.rajaongkir_api_key,
        originCity: s.origin_city,
        smtpHost: s.smtp_host, smtpPort: s.smtp_port, smtpUsername: s.smtp_username,
        smtpPassword: s.smtp_password, smtpFromAddress: s.smtp_from_address,
        smtpEnabled: s.smtp_enabled === 'true',
        xenditEnabled: s.xendit_enabled === 'true',
        manualTransferEnabled: s.manual_transfer_enabled === 'true',
        autoExpireHours: s.auto_expire_hours || '24',
        taxEnabled: s.tax_enabled === 'true',
        seoTitle: s.seo_title, seoDescription: s.seo_description,
        aiBaseUrl: s.ai_base_url, aiApiKey: s.ai_api_key, aiModel: s.ai_model,
        aiEnabled: s.ai_enabled === 'true',
        rajaOngkirEnabled: s.rajaongkir_enabled === 'true',
        shippingMode: s.shipping_mode || 'custom',
      },
      couriers: COURIERS.map((c) => ({ ...c, enabled: enabledCouriers.includes(c.code) })),
    });
  }

  @Post()
  async saveSettings(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const body = req.body as Record<string, any>;
    const pairs: Record<string, string> = {
      store_name: body.storeName || '', store_email: body.storeEmail || '',
      store_phone: body.storePhone || '', invoice_prefix: body.invoicePrefix || 'INV',
      default_language: body.defaultLanguage || 'id',
      xendit_secret_key: body.xenditSecretKey || '', rajaongkir_api_key: body.rajaOngkirApiKey || '',
      origin_city: body.originCity || '',
      smtp_host: body.smtpHost || '', smtp_port: body.smtpPort || '587',
      smtp_username: body.smtpUsername || '', smtp_password: body.smtpPassword || '',
      smtp_from_address: body.smtpFromAddress || '',
      smtp_enabled: body.smtpEnabled ? 'true' : 'false',
      xendit_enabled: body.xenditEnabled ? 'true' : 'false',
      manual_transfer_enabled: body.manualTransferEnabled ? 'true' : 'false',
      auto_expire_hours: body.autoExpireHours || '24',
      tax_enabled: body.taxEnabled ? 'true' : 'false',
      seo_title: body.seoTitle || '', seo_description: body.seoDescription || '',
      ai_base_url: body.aiBaseUrl || '', ai_api_key: body.aiApiKey || '',
      ai_model: body.aiModel || '', ai_enabled: body.aiEnabled ? 'true' : 'false',
      rajaongkir_enabled: body.rajaOngkirEnabled ? 'true' : 'false',
      shipping_mode: body.shippingMode || 'custom',
    };

    const courierArr = Array.isArray(body['couriers[]']) ? body['couriers[]'] : (body['couriers[]'] ? [body['couriers[]']] : []);
    pairs.enabled_couriers = courierArr.join(',');

    await this.settingsService.setMany(pairs);
    return res.redirect(302, '/admin/settings');
  }

  @Get('/bank-accounts')
  async bankAccountsPage(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const user = await this.authService.getUserById(auth.sub);
    const bankAccounts = await this.settingsService.getBankAccounts();

    return res.view('admin/settings-bank-accounts.ejs', {
      pageTitle: 'Bank Accounts — Admin',
      userName: user?.name || 'Admin',
      adminPage: 'settings',
      bankAccounts,
    });
  }

  @Post('/bank-accounts')
  async addBankAccount(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const { bankName, accountNumber, accountHolder } = req.body as Record<string, string>;
    if (bankName && accountNumber && accountHolder) {
      await this.settingsService.addBankAccount({ bankName, accountNumber, accountHolder });
    }
    return res.redirect(302, '/admin/settings/bank-accounts');
  }

  @Post('/bank-accounts/:id')
  async editBankAccount(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;
    const { bankName, accountNumber, accountHolder } = req.body as Record<string, string>;
    if (bankName && accountNumber && accountHolder) {
      await this.settingsService.editBankAccount(id, { bankName, accountNumber, accountHolder });
    }
    return res.redirect(302, '/admin/settings/bank-accounts');
  }

  @Post('/bank-accounts/:id/toggle')
  async toggleBankAccount(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;
    await this.settingsService.toggleBankAccount(id);
    return res.redirect(302, '/admin/settings/bank-accounts');
  }

  @Post('/bank-accounts/:id/delete')
  async deleteBankAccount(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;
    await this.settingsService.deleteBankAccount(id);
    return res.redirect(302, '/admin/settings/bank-accounts');
  }

  @Get('/taxes')
  async taxRatesPage(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const user = await this.authService.getUserById(auth.sub);
    const taxRates = await this.settingsService.getTaxRates();
    const taxEnabled = (await this.settingsService.get('tax_enabled')) === 'true';

    return res.view('admin/settings-taxes.ejs', {
      pageTitle: 'Tax Rates — Admin',
      userName: user?.name || 'Admin',
      adminPage: 'settings',
      taxRates,
      taxEnabled,
    });
  }

  @Post('/taxes')
  async addTaxRate(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const { name, rate, applyTo } = req.body as Record<string, string>;
    if (name && rate) {
      await this.settingsService.addTaxRate({ name, rate, applyTo: (applyTo as any) || 'subtotal' });
    }
    return res.redirect(302, '/admin/settings/taxes');
  }

  @Post('/taxes/:id')
  async editTaxRate(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;
    const { name, rate, applyTo } = req.body as Record<string, string>;
    if (name && rate) {
      await this.settingsService.editTaxRate(id, { name, rate, applyTo: (applyTo as any) || 'subtotal' });
    }
    return res.redirect(302, '/admin/settings/taxes');
  }

  @Post('/taxes/:id/toggle')
  async toggleTaxRate(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;
    await this.settingsService.toggleTaxRate(id);
    return res.redirect(302, '/admin/settings/taxes');
  }

  @Post('/taxes/:id/delete')
  async deleteTaxRate(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;
    await this.settingsService.deleteTaxRate(id);
    return res.redirect(302, '/admin/settings/taxes');
  }

  @Get('/currencies')
  async currenciesPage(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const user = await this.authService.getUserById(auth.sub);
    const currencies = await this.settingsService.getCurrencies();

    return res.view('admin/settings-currencies.ejs', {
      pageTitle: 'Currencies — Admin',
      userName: user?.name || 'Admin',
      adminPage: 'settings',
      currencies,
    });
  }

  @Post('/currencies/toggle')
  async toggleCurrency(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;
    const { code } = req.body as Record<string, string>;
    if (code) await this.settingsService.toggleCurrency(code);
    return res.redirect(302, '/admin/settings/currencies');
  }

  @Post('/currencies/:code/rate')
  async updateExchangeRate(@Param('code') code: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;
    const { exchangeRate } = req.body as Record<string, string>;
    if (exchangeRate) await this.settingsService.updateExchangeRate(code, exchangeRate);
    return res.redirect(302, '/admin/settings/currencies');
  }
}
