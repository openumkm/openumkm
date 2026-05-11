import { Controller, Get, Post, Param, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service';
import { SettingsService } from '../services/settings.service';
import { getAuthFromRequest } from '../common/auth.helper';

@Controller('/admin/settings')
export class AdminSettingsShippingController {
  constructor(
    private readonly authService: AuthService,
    private readonly settingsService: SettingsService,
  ) {}

  private async guardAdmin(req: FastifyRequest, res: FastifyReply) {
    const auth = getAuthFromRequest(req, this.authService);
    if (!auth || auth.role !== 'seller') { res.redirect('/auth/login'); return null; }
    return auth;
  }

  /* ── Currencies ──────────────────────────────── */

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
    return res.redirect('/admin/settings/currencies');
  }

  @Post('/currencies/:code/rate')
  async updateExchangeRate(@Param('code') code: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;
    const { exchangeRate } = req.body as Record<string, string>;
    if (exchangeRate) await this.settingsService.updateExchangeRate(code, exchangeRate);
    return res.redirect('/admin/settings/currencies');
  }

  /* ── Custom Shipping Methods ─────────────────── */

  @Get('/shipping-methods')
  async shippingMethodsPage(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const user = await this.authService.getUserById(auth.sub);
    const methods = await this.settingsService.getShippingMethods();

    return res.view('admin/settings-shipping-methods.ejs', {
      pageTitle: 'Shipping Methods — Admin',
      userName: user?.name || 'Admin',
      adminPage: 'settings',
      shippingMethods: methods,
    });
  }

  @Post('/shipping-methods')
  async addShippingMethod(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const { name, cost, description } = req.body as Record<string, string>;
    if (name && cost !== undefined) {
      await this.settingsService.addShippingMethod({
        name,
        cost: parseInt(cost, 10) || 0,
        description: description || null,
      });
    }
    return res.redirect('/admin/settings/shipping-methods');
  }

  @Post('/shipping-methods/:id')
  async editShippingMethod(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const { name, cost, description } = req.body as Record<string, string>;
    if (name && cost !== undefined) {
      await this.settingsService.editShippingMethod(id, {
        name,
        cost: parseInt(cost, 10) || 0,
        description: description || null,
      });
    }
    return res.redirect('/admin/settings/shipping-methods');
  }

  @Post('/shipping-methods/:id/toggle')
  async toggleShippingMethod(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;
    await this.settingsService.toggleShippingMethod(id);
    return res.redirect('/admin/settings/shipping-methods');
  }

  @Post('/shipping-methods/:id/delete')
  async deleteShippingMethod(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;
    await this.settingsService.deleteShippingMethod(id);
    return res.redirect('/admin/settings/shipping-methods');
  }
}
