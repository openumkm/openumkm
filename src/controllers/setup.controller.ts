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
  async setupPage(@Res() res: FastifyReply) {
    const done = await this.setupService.isSetupComplete();
    if (done) return res.status(404).send('Not found');

    return res.view('setup/index.ejs', {
      pageTitle: 'Setup Store — Swift Commerce',
      error: null,
    });
  }

  @Post()
  async setupSubmit(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const done = await this.setupService.isSetupComplete();
    if (done) return res.status(404).send('Not found');

    const body = req.body as Record<string, string>;
    const { storeName, email, password, confirmPassword } = body;

    if (!storeName || !email || !password) {
      return res.view('setup/index.ejs', {
        pageTitle: 'Setup Store — Swift Commerce',
        error: 'All fields are required.',
      });
    }

    if (password.length < 8) {
      return res.view('setup/index.ejs', {
        pageTitle: 'Setup Store — Swift Commerce',
        error: 'Password must be at least 8 characters.',
      });
    }

    if (password !== confirmPassword) {
      return res.view('setup/index.ejs', {
        pageTitle: 'Setup Store — Swift Commerce',
        error: 'Passwords do not match.',
      });
    }

    const result = await this.setupService.runSetup({ storeName, email, password });
    if ('error' in result) {
      return res.view('setup/index.ejs', {
        pageTitle: 'Setup Store — Swift Commerce',
        error: result.error,
      });
    }

    // Auto-login as admin
    const loginResult = await this.authService.login(email, password);
    if ('token' in loginResult && loginResult.token) {
      setAuthCookie(res, loginResult.token);
    }

    return res.redirect(302, '/admin');
  }
}
