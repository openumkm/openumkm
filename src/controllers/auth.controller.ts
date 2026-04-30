import { Controller, Get, Post, Param, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service';
import { setAuthCookie, clearAuthCookie } from '../common/auth.helper';

@Controller('/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('/login')
  loginPage(@Res() res: FastifyReply) {
    return res.view('auth/login.ejs', {
      pageTitle: 'Login — Swift Commerce',
      error: null, isLoggedIn: false, cartCount: 0,
    });
  }

  @Post('/login')
  async loginSubmit(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const { email, password } = req.body as Record<string, string>;

    if (!email || !password) {
      return res.view('auth/login.ejs', {
        pageTitle: 'Login — Swift Commerce',
        error: 'Email and password are required.', isLoggedIn: false, cartCount: 0,
      });
    }

    const result = await this.authService.login(email, password);
    if ('error' in result) {
      return res.view('auth/login.ejs', {
        pageTitle: 'Login — Swift Commerce',
        error: result.error, isLoggedIn: false, cartCount: 0,
      });
    }

    setAuthCookie(res, result.token);
    return res.redirect(302, result.user.role === 'seller' ? '/admin' : '/dashboard');
  }

  @Get('/register')
  registerPage(@Res() res: FastifyReply) {
    return res.view('auth/register.ejs', {
      pageTitle: 'Register — Swift Commerce',
      error: null, isLoggedIn: false, cartCount: 0,
    });
  }

  @Post('/register')
  async registerSubmit(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const { fullName, email, phone, password, confirmPassword } = req.body as Record<string, string>;

    if (!fullName || !email || !password) {
      return res.view('auth/register.ejs', {
        pageTitle: 'Register — Swift Commerce',
        error: 'Name, email, and password are required.', isLoggedIn: false, cartCount: 0,
      });
    }

    if (password.length < 8) {
      return res.view('auth/register.ejs', {
        pageTitle: 'Register — Swift Commerce',
        error: 'Password must be at least 8 characters.', isLoggedIn: false, cartCount: 0,
      });
    }

    if (password !== confirmPassword) {
      return res.view('auth/register.ejs', {
        pageTitle: 'Register — Swift Commerce',
        error: 'Passwords do not match.', isLoggedIn: false, cartCount: 0,
      });
    }

    const result = await this.authService.register({ email, password, name: fullName, phone });
    if ('error' in result) {
      return res.view('auth/register.ejs', {
        pageTitle: 'Register — Swift Commerce',
        error: result.error, isLoggedIn: false, cartCount: 0,
      });
    }

    const loginResult = await this.authService.login(email, password);
    if ('token' in loginResult && loginResult.token) {
      setAuthCookie(res, loginResult.token);
    }

    return res.redirect(302, '/dashboard');
  }

  @Get('/forgot-password')
  forgotPasswordPage(@Res() res: FastifyReply) {
    return res.view('auth/forgot-password.ejs', {
      pageTitle: 'Forgot Password — Swift Commerce',
      message: null, error: null, isLoggedIn: false, cartCount: 0,
    });
  }

  @Post('/forgot-password')
  async forgotPasswordSubmit(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const { email } = req.body as Record<string, string>;
    if (email) await this.authService.createResetToken(email);

    return res.view('auth/forgot-password.ejs', {
      pageTitle: 'Forgot Password — Swift Commerce',
      message: 'If an account with that email exists, a reset link has been sent.',
      error: null, isLoggedIn: false, cartCount: 0,
    });
  }

  @Get('/reset-password/:token')
  resetPasswordPage(@Param('token') token: string, @Res() res: FastifyReply) {
    return res.view('auth/reset-password.ejs', {
      pageTitle: 'Reset Password — Swift Commerce',
      token, error: null, isLoggedIn: false, cartCount: 0,
    });
  }

  @Post('/reset-password/:token')
  async resetPasswordSubmit(@Param('token') token: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const { password, confirmPassword } = req.body as Record<string, string>;

    if (!password || password.length < 8) {
      return res.view('auth/reset-password.ejs', {
        pageTitle: 'Reset Password — Swift Commerce',
        token, error: 'Password must be at least 8 characters.', isLoggedIn: false, cartCount: 0,
      });
    }

    if (password !== confirmPassword) {
      return res.view('auth/reset-password.ejs', {
        pageTitle: 'Reset Password — Swift Commerce',
        token, error: 'Passwords do not match.', isLoggedIn: false, cartCount: 0,
      });
    }

    const result = await this.authService.resetPassword(token, password);
    if ('error' in result) {
      return res.view('auth/reset-password.ejs', {
        pageTitle: 'Reset Password — Swift Commerce',
        token, error: result.error, isLoggedIn: false, cartCount: 0,
      });
    }

    return res.redirect(302, '/auth/login');
  }

  @Get('/logout')
  logout(@Res() res: FastifyReply) {
    clearAuthCookie(res);
    return res.redirect(302, '/');
  }
}
