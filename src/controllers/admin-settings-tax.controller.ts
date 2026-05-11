import { Controller, Get, Post, Param, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service';
import { SettingsService } from '../services/settings.service';
import { getAuthFromRequest } from '../common/auth.helper';

@Controller('/admin/settings')
export class AdminSettingsTaxController {
  constructor(
    private readonly authService: AuthService,
    private readonly settingsService: SettingsService,
  ) {}

  private async guardAdmin(req: FastifyRequest, res: FastifyReply) {
    const auth = getAuthFromRequest(req, this.authService);
    if (!auth || auth.role !== 'seller') { res.redirect(302, '/auth/login'); return null; }
    return auth;
  }

  @Get('/taxes')
  async taxRatesPage(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
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
  async addTaxRate(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const { name, rate, applyTo } = req.body as Record<string, string>;
    if (name && rate) {
      await this.settingsService.addTaxRate({ name, rate, applyTo: (applyTo as any) || 'subtotal' });
    }
    return res.redirect(302, '/admin/settings/taxes');
  }

  @Post('/taxes/:id')
  async editTaxRate(@Param('id') id: string, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;
    const { name, rate, applyTo } = req.body as Record<string, string>;
    if (name && rate) {
      await this.settingsService.editTaxRate(id, { name, rate, applyTo: (applyTo as any) || 'subtotal' });
    }
    return res.redirect(302, '/admin/settings/taxes');
  }

  @Post('/taxes/:id/toggle')
  async toggleTaxRate(@Param('id') id: string, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;
    await this.settingsService.toggleTaxRate(id);
    return res.redirect(302, '/admin/settings/taxes');
  }

  @Post('/taxes/:id/delete')
  async deleteTaxRate(@Param('id') id: string, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;
    await this.settingsService.deleteTaxRate(id);
    return res.redirect(302, '/admin/settings/taxes');
  }
}
