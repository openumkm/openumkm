import { Controller, Get, Post, Param, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service';
import { EmailService } from '../services/email.service';
import { setAuthCookie, clearAuthCookie } from '../common/auth.helper';
import { i18nContext } from '../common/view.helper';

@Controller('/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
  ) {}

  private ctx(req: FastifyRequest) {
    return { ...i18nContext(req), isLoggedIn: false, cartCount: 0 };
  }

  @Get('/login')
  loginPage(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    return res.view('auth/login.ejs', {
      pageTitle: 'Login',
      error: null, ...this.ctx(req),
    });
  }

  @Post('/login')
  async loginSubmit(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const { email, password } = req.body as Record<string, string>;

    if (!email || !password) {
      return res.view('auth/login.ejs', {
        pageTitle: 'Login',
        error: 'Email and password are required.', ...this.ctx(req),
      });
    }

    const result = await this.authService.login(email, password);
    if ('error' in result) {
      return res.view('auth/login.ejs', {
        pageTitle: 'Login',
        error: result.error, ...this.ctx(req),
      });
    }

    setAuthCookie(res, result.token);
    return res.redirect(result.user.role === 'seller' ? '/admin' : '/dashboard');
  }

  @Get('/register')
  registerPage(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    return res.view('auth/register.ejs', {
      pageTitle: 'Register',
      error: null, ...this.ctx(req),
    });
  }

  @Post('/register')
  async registerSubmit(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const { fullName, email, phone, password, confirmPassword } = req.body as Record<string, string>;

    if (!fullName || !email || !password) {
      return res.view('auth/register.ejs', {
        pageTitle: 'Register',
        error: 'Name, email, and password are required.', ...this.ctx(req),
      });
    }

    if (password.length < 8) {
      return res.view('auth/register.ejs', {
        pageTitle: 'Register',
        error: 'Password must be at least 8 characters.', ...this.ctx(req),
      });
    }

    if (password !== confirmPassword) {
      return res.view('auth/register.ejs', {
        pageTitle: 'Register',
        error: 'Passwords do not match.', ...this.ctx(req),
      });
    }

    const result = await this.authService.register({ email, password, name: fullName, phone });
    if ('error' in result) {
      return res.view('auth/register.ejs', {
        pageTitle: 'Register',
        error: result.error, ...this.ctx(req),
      });
    }

    const loginResult = await this.authService.login(email, password);
    if ('token' in loginResult && loginResult.token) {
      setAuthCookie(res, loginResult.token);
    }

    return res.redirect('/dashboard');
  }

  @Get('/forgot-password')
  forgotPasswordPage(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    return res.view('auth/forgot-password.ejs', {
      pageTitle: 'Forgot Password',
      message: null, error: null, ...this.ctx(req),
    });
  }

  @Post('/forgot-password')
  async forgotPasswordSubmit(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const { email } = req.body as Record<string, string>;
    if (email) {
      const token = await this.authService.createResetToken(email);
      if (token) {
        await this.emailService.sendPasswordReset(email, token);
      }
    }

    return res.view('auth/forgot-password.ejs', {
      pageTitle: 'Forgot Password',
      message: 'If an account with that email exists, a reset link has been sent.',
      error: null, ...this.ctx(req),
    });
  }

  @Get('/reset-password/:token')
  resetPasswordPage(@Param('token') token: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    return res.view('auth/reset-password.ejs', {
      pageTitle: 'Reset Password',
      token, error: null, ...this.ctx(req),
    });
  }

  @Post('/reset-password/:token')
  async resetPasswordSubmit(@Param('token') token: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const { password, confirmPassword } = req.body as Record<string, string>;

    if (!password || password.length < 8) {
      return res.view('auth/reset-password.ejs', {
        pageTitle: 'Reset Password',
        token, error: 'Password must be at least 8 characters.', ...this.ctx(req),
      });
    }

    if (password !== confirmPassword) {
      return res.view('auth/reset-password.ejs', {
        pageTitle: 'Reset Password',
        token, error: 'Passwords do not match.', ...this.ctx(req),
      });
    }

    const result = await this.authService.resetPassword(token, password);
    if ('error' in result) {
      return res.view('auth/reset-password.ejs', {
        pageTitle: 'Reset Password',
        token, error: result.error, ...this.ctx(req),
      });
    }

    return res.redirect('/auth/login');
  }

  @Get('/logout')
  logout(@Res() res: FastifyReply) {
    clearAuthCookie(res);
    return res.redirect('/');
  }
}
