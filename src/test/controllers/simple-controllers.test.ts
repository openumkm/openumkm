import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── HealthController ─────────────────────────── */
describe('HealthController', () => {
  it('returns status ok with uptime', async () => {
    const { HealthController } = await import('../../controllers/health.controller');
    const controller = new HealthController();
    const res = { send: vi.fn() } as any;
    controller.health(res);
    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok' }));
  });
});

/* ── SetupController ──────────────────────────── */
describe('SetupController', () => {
  let controller: any;
  let mockSetupService: any;
  let mockAuthService: any;

  beforeEach(async () => {
    mockSetupService = { isSetupComplete: vi.fn(), runSetup: vi.fn() };
    mockAuthService = { login: vi.fn() };
    const { SetupController } = await import('../../controllers/setup.controller');
    controller = new SetupController(mockSetupService, mockAuthService);
  });

  it('setupPage returns 404 when setup is complete', async () => {
    mockSetupService.isSetupComplete.mockResolvedValue(true);
    const res = { status: vi.fn().mockReturnValue({ send: vi.fn() }) } as any;
    await controller.setupPage({ query: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('setupPage returns 403 when SETUP_SECRET mismatch', async () => {
    process.env.SETUP_SECRET = 'secret123';
    mockSetupService.isSetupComplete.mockResolvedValue(false);
    const res = { status: vi.fn().mockReturnValue({ send: vi.fn() }) } as any;
    await controller.setupPage({ query: { secret: 'wrong' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(403);
    delete process.env.SETUP_SECRET;
  });

  it('setupPage renders setup page', async () => {
    mockSetupService.isSetupComplete.mockResolvedValue(false);
    const res = { view: vi.fn() } as any;
    await controller.setupPage({ query: {} } as any, res);
    expect(res.view).toHaveBeenCalledWith('setup/index.ejs', expect.objectContaining({ pageTitle: 'Setup Store — OpenUMKM' }));
  });

  it('setupSubmit returns 404 when setup is complete', async () => {
    mockSetupService.isSetupComplete.mockResolvedValue(true);
    const res = { status: vi.fn().mockReturnValue({ send: vi.fn() }) } as any;
    await controller.setupSubmit({ body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('setupSubmit returns error when fields missing', async () => {
    mockSetupService.isSetupComplete.mockResolvedValue(false);
    const res = { view: vi.fn() } as any;
    await controller.setupSubmit({ body: { storeName: '', email: '', password: '' } } as any, res);
    expect(res.view).toHaveBeenCalledWith('setup/index.ejs', expect.objectContaining({ error: 'Store name, admin email, and password are required.' }));
  });

  it('setupSubmit returns error when password too short', async () => {
    mockSetupService.isSetupComplete.mockResolvedValue(false);
    const res = { view: vi.fn() } as any;
    await controller.setupSubmit({ body: { storeName: 'S', email: 'a@b.com', password: '123' } } as any, res);
    expect(res.view).toHaveBeenCalledWith('setup/index.ejs', expect.objectContaining({ error: 'Password must be at least 8 characters.' }));
  });

  it('setupSubmit returns error when passwords mismatch', async () => {
    mockSetupService.isSetupComplete.mockResolvedValue(false);
    const res = { view: vi.fn() } as any;
    await controller.setupSubmit({ body: { storeName: 'S', email: 'a@b.com', password: '12345678', confirmPassword: 'different' } } as any, res);
    expect(res.view).toHaveBeenCalledWith('setup/index.ejs', expect.objectContaining({ error: 'Passwords do not match.' }));
  });

  it('setupSubmit returns error when setup service fails', async () => {
    mockSetupService.isSetupComplete.mockResolvedValue(false);
    mockSetupService.runSetup.mockResolvedValue({ error: 'DB error' });
    const res = { view: vi.fn() } as any;
    await controller.setupSubmit({ body: { storeName: 'S', email: 'a@b.com', password: '12345678', confirmPassword: '12345678' } } as any, res);
    expect(res.view).toHaveBeenCalledWith('setup/index.ejs', expect.objectContaining({ error: 'DB error' }));
  });

  it('setupSubmit redirects to /admin on success', async () => {
    mockSetupService.isSetupComplete.mockResolvedValue(false);
    mockSetupService.runSetup.mockResolvedValue({ success: true });
    mockAuthService.login.mockResolvedValue({ token: 'jwt-token', user: { role: 'seller' } });
    const res = { redirect: vi.fn(), setCookie: vi.fn() } as any;
    const req = { body: { storeName: 'S', email: 'a@b.com', password: '12345678', confirmPassword: '12345678' }, headers: {} };
    await controller.setupSubmit(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/admin', 302);
  });
});

/* ── AuthController ───────────────────────────── */
describe('AuthController', () => {
  let controller: any;
  let mockAuthService: any;
  let mockEmailService: any;
  let req: any;

  function ctxBase() {
    return { currentLang: 'en', currency: 'IDR', currencies: [], t: expect.any(Function), isLoggedIn: false, cartCount: 0 };
  }

  beforeEach(async () => {
    mockAuthService = { login: vi.fn(), register: vi.fn(), createResetToken: vi.fn(), resetPassword: vi.fn() };
    mockEmailService = { sendPasswordReset: vi.fn() };
    req = { t: (k: string) => k, lang: 'en', currency: 'IDR', currencies: [] };
    const { AuthController } = await import('../../controllers/auth.controller');
    controller = new AuthController(mockAuthService, mockEmailService);
  });

  it('loginPage renders', () => {
    const res = { view: vi.fn() };
    controller.loginPage(req, res);
    expect(res.view).toHaveBeenCalledWith('auth/login.ejs', expect.objectContaining({ pageTitle: 'Login' }));
  });

  it('loginSubmit returns error when fields missing', async () => {
    const res = { view: vi.fn() };
    await controller.loginSubmit({ ...req, body: {} }, res);
    expect(res.view).toHaveBeenCalledWith('auth/login.ejs', expect.objectContaining({ error: 'Email and password are required.' }));
  });

  it('loginSubmit returns error on bad credentials', async () => {
    mockAuthService.login.mockResolvedValue({ error: 'Invalid email or password.' });
    const res = { view: vi.fn() };
    await controller.loginSubmit({ ...req, body: { email: 'a@b.com', password: 'wrong' } }, res);
    expect(res.view).toHaveBeenCalledWith('auth/login.ejs', expect.objectContaining({ error: 'Invalid email or password.' }));
  });

  it('loginSubmit redirects seller to /admin', async () => {
    mockAuthService.login.mockResolvedValue({ token: 'tok', user: { role: 'seller' } });
    const res = { redirect: vi.fn(), setCookie: vi.fn() };
    const reqWithBody = { ...req, body: { email: 'a@b.com', password: 'pass' }, headers: {} };
    await controller.loginSubmit(reqWithBody, res);
    expect(res.redirect).toHaveBeenCalledWith('/admin', 302);
  });

  it('loginSubmit redirects customer to /dashboard', async () => {
    mockAuthService.login.mockResolvedValue({ token: 'tok', user: { role: 'customer' } });
    const res = { redirect: vi.fn(), setCookie: vi.fn() };
    const reqWithBody = { ...req, body: { email: 'a@b.com', password: 'pass' }, headers: {} };
    await controller.loginSubmit(reqWithBody, res);
    expect(res.redirect).toHaveBeenCalledWith('/dashboard', 302);
  });

  it('registerPage renders', () => {
    const res = { view: vi.fn() };
    controller.registerPage(req, res);
    expect(res.view).toHaveBeenCalledWith('auth/register.ejs', expect.objectContaining({ pageTitle: 'Register' }));
  });

  it('registerSubmit returns error when fields missing', async () => {
    const res = { view: vi.fn() };
    await controller.registerSubmit({ ...req, body: {} }, res);
    expect(res.view).toHaveBeenCalledWith('auth/register.ejs', expect.objectContaining({ error: 'Name, email, and password are required.' }));
  });

  it('registerSubmit returns error when password too short', async () => {
    const res = { view: vi.fn() };
    await controller.registerSubmit({ ...req, body: { fullName: 'A', email: 'a@b.com', password: '123' } }, res);
    expect(res.view).toHaveBeenCalledWith('auth/register.ejs', expect.objectContaining({ error: 'Password must be at least 8 characters.' }));
  });

  it('registerSubmit returns error when passwords mismatch', async () => {
    const res = { view: vi.fn() };
    await controller.registerSubmit({ ...req, body: { fullName: 'A', email: 'a@b.com', password: '12345678', confirmPassword: 'different' } }, res);
    expect(res.view).toHaveBeenCalledWith('auth/register.ejs', expect.objectContaining({ error: 'Passwords do not match.' }));
  });

  it('registerSubmit returns error from service', async () => {
    mockAuthService.register.mockResolvedValue({ error: 'Email already exists.' });
    const res = { view: vi.fn() };
    await controller.registerSubmit({ ...req, body: { fullName: 'A', email: 'a@b.com', password: '12345678', confirmPassword: '12345678' } }, res);
    expect(res.view).toHaveBeenCalledWith('auth/register.ejs', expect.objectContaining({ error: 'Email already exists.' }));
  });

  it('registerSubmit redirects on success', async () => {
    mockAuthService.register.mockResolvedValue({ user: { id: '1' } });
    mockAuthService.login.mockResolvedValue({ token: 'tok' });
    const res = { redirect: vi.fn(), setCookie: vi.fn() };
    const reqBody = { ...req, body: { fullName: 'A', email: 'a@b.com', password: '12345678', confirmPassword: '12345678' }, headers: {} };
    await controller.registerSubmit(reqBody, res);
    expect(res.redirect).toHaveBeenCalledWith('/dashboard', 302);
  });

  it('forgotPasswordPage renders', () => {
    const res = { view: vi.fn() };
    controller.forgotPasswordPage(req, res);
    expect(res.view).toHaveBeenCalledWith('auth/forgot-password.ejs', expect.objectContaining({ pageTitle: 'Forgot Password' }));
  });

  it('forgotPasswordSubmit sends email and renders message', async () => {
    mockAuthService.createResetToken.mockResolvedValue('reset-tok');
    const res = { view: vi.fn() };
    await controller.forgotPasswordSubmit({ ...req, body: { email: 'a@b.com' } }, res);
    expect(mockEmailService.sendPasswordReset).toHaveBeenCalledWith('a@b.com', 'reset-tok');
  });

  it('forgotPasswordSubmit handles missing email', async () => {
    const res = { view: vi.fn() };
    await controller.forgotPasswordSubmit({ ...req, body: {} }, res);
    expect(res.view).toHaveBeenCalledWith('auth/forgot-password.ejs', expect.objectContaining({ message: expect.stringContaining('reset link') }));
  });

  it('resetPasswordPage renders', () => {
    const res = { view: vi.fn() };
    controller.resetPasswordPage('token123', req, res);
    expect(res.view).toHaveBeenCalledWith('auth/reset-password.ejs', expect.objectContaining({ token: 'token123' }));
  });

  it('resetPasswordSubmit returns error when password too short', async () => {
    const res = { view: vi.fn() };
    await controller.resetPasswordSubmit('token123', { ...req, body: { password: '123', confirmPassword: '123' } }, res);
    expect(res.view).toHaveBeenCalledWith('auth/reset-password.ejs', expect.objectContaining({ error: 'Password must be at least 8 characters.' }));
  });

  it('resetPasswordSubmit returns error when passwords mismatch', async () => {
    const res = { view: vi.fn() };
    await controller.resetPasswordSubmit('token123', { ...req, body: { password: '12345678', confirmPassword: 'different' } }, res);
    expect(res.view).toHaveBeenCalledWith('auth/reset-password.ejs', expect.objectContaining({ error: 'Passwords do not match.' }));
  });

  it('resetPasswordSubmit returns error from service', async () => {
    mockAuthService.resetPassword.mockResolvedValue({ error: 'Invalid token.' });
    const res = { view: vi.fn() };
    await controller.resetPasswordSubmit('bad', { ...req, body: { password: '12345678', confirmPassword: '12345678' } }, res);
    expect(res.view).toHaveBeenCalledWith('auth/reset-password.ejs', expect.objectContaining({ error: 'Invalid token.' }));
  });

  it('resetPasswordSubmit redirects on success', async () => {
    mockAuthService.resetPassword.mockResolvedValue({ success: true });
    const res = { redirect: vi.fn() };
    await controller.resetPasswordSubmit('good', { ...req, body: { password: '12345678', confirmPassword: '12345678' } }, res);
    expect(res.redirect).toHaveBeenCalledWith('/auth/login', 302);
  });

  it('logout clears cookie and redirects', () => {
    const res = { redirect: vi.fn(), clearCookie: vi.fn() };
    controller.logout(res);
    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/', 302);
  });
});
