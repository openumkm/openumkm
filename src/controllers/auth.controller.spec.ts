// import module @nestjs/testing, auth contoller, auth service and email service
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';
import { EmailService } from '../services/email.service';

  describe('AuthController - Login', () => {
  let controller: AuthController;
  let service: AuthService;

  // Mocking respons dari AuthService
  const mockAuthService = {
    login: jest.fn().mockResolvedValue({
      token: 'mock-jwt-token',
      user: { role: 'admin' }
    } as any),
  };

  const mockEmailService = {}; // Mock sederhana untuk EmailService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  it('should call loginSubmit and trigger authService.login', async () => {
    const loginDto = { email: 'admin@openukm.com', password: 'password123' };
    
    // Mock Request
    const mockReq = { 
      body: loginDto 
    } as any;

    // Mock Response
    const mockRes = {
      view: jest.fn(),
      redirect: jest.fn(),
      setCookie: jest.fn().mockReturnThis(),
    } as any;

    // running function
    await controller.loginSubmit(mockReq, mockRes);

    // verification
    expect(service.login).toHaveBeenCalledWith(loginDto.email, loginDto.password);
  });
});