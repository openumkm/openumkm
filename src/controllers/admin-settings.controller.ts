import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service';
import { SettingsService } from '../services/settings.service';
import { UploadService } from '../services/upload.service';
import { getAuthFromRequest } from '../common/auth.helper';

const SETTING_KEYS = [
  'store_name', 'store_email', 'store_phone', 'invoice_prefix', 'default_language',
  'xendit_secret_key', 'rajaongkir_api_key', 'origin_city',
  'smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'smtp_from_address', 'smtp_enabled',
  'xendit_enabled', 'manual_transfer_enabled', 'auto_expire_hours', 'tax_enabled',
  'xendit_callback_token',
  'seo_title', 'seo_description',
  'ai_base_url', 'ai_api_key', 'ai_model', 'ai_enabled',
  'rajaongkir_enabled', 'shipping_mode',
  's3_endpoint', 's3_region', 's3_bucket', 's3_access_key', 's3_secret_key', 's3_enabled',
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
    private readonly uploadService: UploadService,
  ) {}

  private async guardAdmin(req: FastifyRequest, res: FastifyReply) {
    const auth = getAuthFromRequest(req, this.authService);
    if (!auth || auth.role !== 'seller') { res.redirect('/auth/login', 302); return null; }
    return auth;
  }

  @Get()
  async settingsPage(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const user = await this.authService.getUserById(auth.sub);
    const s = await this.settingsService.getMany([...SETTING_KEYS, 'enabled_couriers', 'store_logo']);
    const enabledCouriers = (s.enabled_couriers || '').split(',').filter(Boolean);

    return res.view('admin/settings.ejs', {
      pageTitle: 'Settings — Admin',
      userName: user?.name || 'Admin',
      adminPage: 'settings',
      settings: {
        storeName: s.store_name, storeEmail: s.store_email, storePhone: s.store_phone,
        storeLogo: s.store_logo || null,
        invoicePrefix: s.invoice_prefix, defaultLanguage: s.default_language,
        xenditSecretKey: s.xendit_secret_key, rajaOngkirApiKey: s.rajaongkir_api_key,
        originCity: s.origin_city,
        smtpHost: s.smtp_host, smtpPort: s.smtp_port, smtpUsername: s.smtp_username,
        smtpPassword: s.smtp_password, smtpFromAddress: s.smtp_from_address,
        smtpEnabled: s.smtp_enabled === 'true',
        xenditEnabled: s.xendit_enabled === 'true',
        xenditCallbackToken: s.xendit_callback_token,
        manualTransferEnabled: s.manual_transfer_enabled === 'true',
        autoExpireHours: s.auto_expire_hours || '24',
        taxEnabled: s.tax_enabled === 'true',
        seoTitle: s.seo_title, seoDescription: s.seo_description,
        aiBaseUrl: s.ai_base_url, aiApiKey: s.ai_api_key, aiModel: s.ai_model,
        aiEnabled: s.ai_enabled === 'true',
        rajaOngkirEnabled: s.rajaongkir_enabled === 'true',
        shippingMode: s.shipping_mode || 'custom',
        s3Endpoint: s.s3_endpoint, s3Region: s.s3_region, s3Bucket: s.s3_bucket,
        s3AccessKey: s.s3_access_key, s3SecretKey: s.s3_secret_key,
        s3Enabled: s.s3_enabled === 'true',
      },
      couriers: COURIERS.map((c) => ({ ...c, enabled: enabledCouriers.includes(c.code) })),
    });
  }

  @Post()
  async saveSettings(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const parts = (req as any).parts();
    const fields: Record<string, any> = {};
    let logoUrl: string | null = null;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'logo') {
        const buffer = await part.toBuffer();
        logoUrl = await this.uploadService.uploadBuffer(buffer, 'logos', part.mimetype || 'image/png');
      } else if (part.type === 'field') {
        if (part.fieldname === 'couriers[]') {
          if (!fields['couriers[]']) fields['couriers[]'] = [];
          fields['couriers[]'].push(part.value);
        } else {
          fields[part.fieldname] = part.value;
        }
      }
    }

    const pairs: Record<string, string> = {
      store_name: fields.storeName || '', store_email: fields.storeEmail || '',
      store_phone: fields.storePhone || '', invoice_prefix: fields.invoicePrefix || 'INV',
      default_language: fields.defaultLanguage || 'id',
      xendit_secret_key: fields.xenditSecretKey || '', rajaongkir_api_key: fields.rajaOngkirApiKey || '',
      origin_city: fields.originCity || '',
      smtp_host: fields.smtpHost || '', smtp_port: fields.smtpPort || '587',
      smtp_username: fields.smtpUsername || '', smtp_password: fields.smtpPassword || '',
      smtp_from_address: fields.smtpFromAddress || '',
      smtp_enabled: fields.smtpEnabled ? 'true' : 'false',
      xendit_enabled: fields.xenditEnabled ? 'true' : 'false',
      xendit_callback_token: fields.xenditCallbackToken || '',
      manual_transfer_enabled: fields.manualTransferEnabled ? 'true' : 'false',
      auto_expire_hours: fields.autoExpireHours || '24',
      tax_enabled: fields.taxEnabled ? 'true' : 'false',
      seo_title: fields.seoTitle || '', seo_description: fields.seoDescription || '',
      ai_base_url: fields.aiBaseUrl || '', ai_api_key: fields.aiApiKey || '',
      ai_model: fields.aiModel || '', ai_enabled: fields.aiEnabled ? 'true' : 'false',
      rajaongkir_enabled: fields.rajaOngkirEnabled ? 'true' : 'false',
      shipping_mode: fields.shippingMode || 'custom',
      s3_endpoint: fields.s3Endpoint || '', s3_region: fields.s3Region || 'us-east-1',
      s3_bucket: fields.s3Bucket || '', s3_access_key: fields.s3AccessKey || '',
      s3_secret_key: fields.s3SecretKey || '', s3_enabled: fields.s3Enabled ? 'true' : 'false',
    };

    const courierArr = fields['couriers[]'] || [];
    pairs.enabled_couriers = Array.isArray(courierArr) ? courierArr.join(',') : '';

    if (logoUrl) pairs.store_logo = logoUrl;

    await this.settingsService.setMany(pairs);
    return res.redirect('/admin/settings', 302);
  }
}
