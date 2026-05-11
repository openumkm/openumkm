import { Controller, Get, Post, Param, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service';
import { SettingsService } from '../services/settings.service';
import { UploadService } from '../services/upload.service';
import { getAuthFromRequest } from '../common/auth.helper';

@Controller('/admin/settings')
export class AdminSettingsBankController {
  constructor(
    private readonly authService: AuthService,
    private readonly settingsService: SettingsService,
    private readonly uploadService: UploadService,
  ) {}

  private async guardAdmin(req: FastifyRequest, res: FastifyReply) {
    const auth = getAuthFromRequest(req, this.authService);
    if (!auth || auth.role !== 'seller') { res.redirect('/auth/login'); return null; }
    return auth;
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

    const parts = (req as any).parts();
    const fields: Record<string, string> = {};
    let logoUrl: string | null = null;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'logo') {
        const buffer = await part.toBuffer();
        logoUrl = await this.uploadService.uploadBuffer(buffer, 'bank-logos', part.mimetype || 'image/png');
      } else if (part.type === 'field') {
        fields[part.fieldname] = part.value;
      }
    }

    const { bankName, accountNumber, accountHolder } = fields;
    if (bankName && accountNumber && accountHolder) {
      await this.settingsService.addBankAccount({ bankName, accountNumber, accountHolder, logoUrl });
    }
    return res.redirect('/admin/settings/bank-accounts');
  }

  @Post('/bank-accounts/:id')
  async editBankAccount(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;

    const parts = (req as any).parts();
    const fields: Record<string, string> = {};
    let logoUrl: string | null = null;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'logo') {
        const buffer = await part.toBuffer();
        logoUrl = await this.uploadService.uploadBuffer(buffer, 'bank-logos', part.mimetype || 'image/png');
      } else if (part.type === 'field') {
        fields[part.fieldname] = part.value;
      }
    }

    const { bankName, accountNumber, accountHolder } = fields;
    if (bankName && accountNumber && accountHolder) {
      const data: any = { bankName, accountNumber, accountHolder };
      if (logoUrl) data.logoUrl = logoUrl;
      await this.settingsService.editBankAccount(id, data);
    }
    return res.redirect('/admin/settings/bank-accounts');
  }

  @Post('/bank-accounts/:id/toggle')
  async toggleBankAccount(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;
    await this.settingsService.toggleBankAccount(id);
    return res.redirect('/admin/settings/bank-accounts');
  }

  @Post('/bank-accounts/:id/delete')
  async deleteBankAccount(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = await this.guardAdmin(req, res);
    if (!auth) return;
    await this.settingsService.deleteBankAccount(id);
    return res.redirect('/admin/settings/bank-accounts');
  }
}
