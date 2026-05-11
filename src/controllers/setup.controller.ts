import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { SetupService } from '../services/setup.service';
import { AuthService } from '../services/auth.service';
import { setAuthCookie } from '../common/auth.helper';

@Controller('/setup')
export class SetupController {
  constructor(
    private readonly setupService: SetupService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async setupPage(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const done = await this.setupService.isSetupComplete();
    if (done) return res.status(404).send('Not found');

    // Check SETUP_SECRET if configured
    const secret = process.env.SETUP_SECRET || '';
    if (secret) {
      const provided = (req.query as any).secret || '';
      if (provided !== secret) return res.status(403).send('Forbidden');
    }

    return res.view('setup/index.ejs', {
      pageTitle: 'Setup Store — OpenUMKM',
      error: null,
    });
  }

  @Post()
  async setupSubmit(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const done = await this.setupService.isSetupComplete();
    if (done) return res.status(404).send('Not found');

    const body = req.body as Record<string, string>;

    // Validate required fields
    if (!body.storeName || !body.email || !body.password) {
      return res.view('setup/index.ejs', {
        pageTitle: 'Setup Store — OpenUMKM',
        error: 'Store name, admin email, and password are required.',
      });
    }

    if (body.password.length < 8) {
      return res.view('setup/index.ejs', {
        pageTitle: 'Setup Store — OpenUMKM',
        error: 'Password must be at least 8 characters.',
      });
    }

    if (body.password !== body.confirmPassword) {
      return res.view('setup/index.ejs', {
        pageTitle: 'Setup Store — OpenUMKM',
        error: 'Passwords do not match.',
      });
    }

    const result = await this.setupService.runSetup({
      // Admin account
      email: body.email,
      password: body.password,
      // Store info
      storeName: body.storeName,
      storeEmail: body.storeEmail || '',
      storePhone: body.storePhone || '',
      defaultLanguage: body.defaultLanguage || 'id',
      defaultCurrency: body.defaultCurrency || 'IDR',
      invoicePrefix: body.invoicePrefix || 'INV',
      // Payment
      manualTransferEnabled: !!body.manualTransferEnabled,
      xenditEnabled: !!body.xenditEnabled,
      autoExpireHours: parseInt(body.autoExpireHours || '24', 10),
      // Bank account
      bankName: body.bankName || undefined,
      bankAccountNumber: body.bankAccountNumber || undefined,
      bankAccountHolder: body.bankAccountHolder || undefined,
    });

    if ('error' in result) {
      return res.view('setup/index.ejs', {
        pageTitle: 'Setup Store — OpenUMKM',
        error: result.error,
      });
    }

    // Auto-login as admin
    const loginResult = await this.authService.login(body.email, body.password);
    if ('token' in loginResult && loginResult.token) {
      setAuthCookie(req, res, loginResult.token);
    }

    return res.redirect('/admin', 302);
  }
}
