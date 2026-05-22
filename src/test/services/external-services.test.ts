import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  pool: {},
}));

vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn() }, createTransport: vi.fn() }));
vi.mock('ejs', () => ({ default: { renderFile: vi.fn() }, renderFile: vi.fn() }));
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
}));
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}));

import nodemailer from 'nodemailer';
import * as ejs from 'ejs';

import { UploadService } from '../../services/upload.service';
import { EmailService } from '../../services/email.service';
import { ShippingService } from '../../services/shipping.service';
import { XenditService } from '../../services/xendit.service';

/* ── UploadService ────────────────────────────── */
describe('UploadService', () => {
  let service: UploadService;
  let mockSettings: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings = { get: vi.fn() };
    service = new UploadService(mockSettings);
  });

  describe('isS3Configured', () => {
    it('returns false when s3 not enabled', async () => {
      mockSettings.get.mockResolvedValue(null);
      expect(await service.isS3Configured()).toBe(false);
    });

    it('returns true when s3 is configured', async () => {
      mockSettings.get.mockImplementation((key: string) => {
        const vals: Record<string, string> = {
          s3_enabled: 'true', s3_endpoint: 'https://s3.example.com',
          s3_region: 'us-east-1', s3_bucket: 'mybucket',
          s3_access_key: 'ak', s3_secret_key: 'sk',
        };
        return vals[key] || null;
      });
      expect(await service.isS3Configured()).toBe(true);
    });
  });

  describe('uploadBuffer', () => {
    it('uploads locally when s3 not configured', async () => {
      mockSettings.get.mockResolvedValue(null);
      const result = await service.uploadBuffer(Buffer.from('data'), 'products', 'image/jpeg');
      expect(result).toContain('/uploads/products/');
    });

    it('uploads to S3 when configured', async () => {
      const mockSend = vi.fn().mockResolvedValue({});
      (service as any).s3Client = { send: mockSend };
      (service as any).s3Config = { endpoint: 'https://s3.example.com', region: 'us-east-1', bucket: 'mybucket', accessKey: 'ak', secretKey: 'sk' };
      const result = await service.uploadBuffer(Buffer.from('data'), 'products', 'image/jpeg');
      expect(result).toContain('s3://products/');
      expect(mockSend).toHaveBeenCalled();
    });

    it('returns null for file exceeding MAX_FILE_SIZE', async () => {
      const largeBuffer = Buffer.alloc(5 * 1024 * 1024 + 1);
      const result = await service.uploadBuffer(largeBuffer, 'products', 'image/jpeg');
      expect(result).toBeNull();
    });
  });

  describe('getPublicUrl', () => {
    it('returns presigned URL for S3 path', async () => {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      vi.mocked(getSignedUrl).mockResolvedValue('https://presigned.url');
      (service as any).s3Client = { send: vi.fn() };
      (service as any).s3Config = { endpoint: 'https://s3.example.com', region: 'us-east-1', bucket: 'mybucket', accessKey: 'ak', secretKey: 'sk' };

      const result = await service.getPublicUrl('s3://products/test.jpg');
      expect(result).toBe('https://presigned.url');
      expect(GetObjectCommand).toHaveBeenCalled();
    });

    it('returns null for null/empty path', async () => {
      expect(await service.getPublicUrl(null as any)).toBeNull();
      expect(await service.getPublicUrl('')).toBeNull();
    });

    it('returns storedPath for local path', async () => {
      const result = await service.getPublicUrl('/uploads/products/test.jpg');
      expect(result).toBe('/uploads/products/test.jpg');
    });
  });

  describe('deleteFile', () => {
    it('deletes S3 file', async () => {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const mockSend = vi.fn().mockResolvedValue({});
      (service as any).s3Client = { send: mockSend };
      (service as any).s3Config = { endpoint: 'https://s3.example.com', region: 'us-east-1', bucket: 'mybucket', accessKey: 'ak', secretKey: 'sk' };

      await service.deleteFile('s3://products/test.jpg');
      expect(mockSend).toHaveBeenCalled();
      expect(DeleteObjectCommand).toHaveBeenCalled();
    });

    it('deletes local file', async () => {
      const { existsSync, unlinkSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(true);

      await service.deleteFile('/uploads/products/test.jpg');
      expect(unlinkSync).toHaveBeenCalled();
    });

    it('does nothing for null/empty path', async () => {
      await service.deleteFile('');
      await service.deleteFile(null as any);
    });

    it('does nothing for non-upload local path', async () => {
      const { unlinkSync } = await import('fs');
      await service.deleteFile('/other/file.txt');
      expect(unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('getExtension', () => {
    it.each([
      ['image/jpeg', '.jpg'],
      ['image/png', '.png'],
      ['image/webp', '.webp'],
      ['image/gif', '.gif'],
      ['image/svg+xml', '.bin'],
    ])('returns %s for MIME type %s', (mime, ext) => {
      expect((service as any).getExtension(mime)).toBe(ext);
    });
  });
});

/* ── EmailService ─────────────────────────────── */
describe('EmailService', () => {
  let service: EmailService;
  let mockSettings: any;
  let mockTransporter: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings = { get: vi.fn(), getMany: vi.fn() };
    mockTransporter = { sendMail: vi.fn().mockResolvedValue({}) };
    vi.mocked(nodemailer.createTransport).mockReturnValue(mockTransporter as any);
    service = new EmailService(mockSettings);
  });

  describe('send', () => {
    it('skips when smtp not configured', async () => {
      mockSettings.getMany.mockResolvedValue({ smtp_enabled: 'false', smtp_host: null, smtp_port: null, smtp_username: null, smtp_password: null, smtp_from_address: null });
      const result = await (service as any).send({ to: 'a@b.com', subject: 'Test', template: 'test', data: {} });
      expect(result).toBe(false);
    });

    it('sends email when smtp configured', async () => {
      (service as any).getTransporter = vi.fn().mockResolvedValue(mockTransporter);
      mockSettings.get.mockImplementation((k: string) => {
        if (k === 'smtp_from_address') return 'noreply@example.com';
        if (k === 'store_name') return 'My Store';
        return null;
      });
      (ejs as any).renderFile.mockResolvedValue('<html></html>');
      const result = await (service as any).send({ to: 'a@b.com', subject: 'Test', template: 'test', data: {} });
      expect(result).toBe(true);
    });

    it('handles errors gracefully', async () => {
      (service as any).getTransporter = vi.fn().mockResolvedValue(mockTransporter);
      mockSettings.get.mockResolvedValue('noreply@example.com');
      (ejs as any).renderFile.mockRejectedValue(new Error('Template error'));
      const result = await (service as any).send({ to: 'a@b.com', subject: 'Test', template: 'test', data: {} });
      expect(result).toBe(false);
    });
  });

  describe('trigger methods', () => {
    it('sendOrderCreatedXendit skips if no email', async () => {
      const spy = vi.spyOn(service as any, 'send');
      await service.sendOrderCreatedXendit({ orderNumber: 'INV/001', total: 1000, currency: 'IDR', items: [], expiresAt: new Date() }, '');
      expect(spy).not.toHaveBeenCalled();
    });

    it('sendOrderCreatedXendit sends email', async () => {
      const spy = vi.spyOn(service as any, 'send').mockResolvedValue(true);
      await service.sendOrderCreatedXendit({ orderNumber: 'INV/001', total: 1000, currency: 'IDR', items: [], expiresAt: new Date() }, 'a@b.com');
      expect(spy).toHaveBeenCalled();
    });

    it('sendOrderCreatedManual sends email', async () => {
      const spy = vi.spyOn(service as any, 'send').mockResolvedValue(true);
      await service.sendOrderCreatedManual({ orderNumber: 'INV/001', total: 1000, currency: 'IDR', items: [], expiresAt: new Date(), bankAccounts: [] }, 'a@b.com');
      expect(spy).toHaveBeenCalled();
    });

    it('sendPaymentConfirmed sends email', async () => {
      const spy = vi.spyOn(service as any, 'send').mockResolvedValue(true);
      await service.sendPaymentConfirmed({ orderNumber: 'INV/001', total: 1000, currency: 'IDR' }, 'a@b.com');
      expect(spy).toHaveBeenCalled();
    });

    it('sendPaymentProofUploaded sends email', async () => {
      mockSettings.get.mockResolvedValue('seller@example.com');
      const spy = vi.spyOn(service as any, 'send').mockResolvedValue(true);
      await service.sendPaymentProofUploaded(
        { orderNumber: 'INV/001', total: 1000, id: 'o1' },
        { senderBank: 'BCA', senderName: 'A', amount: 1000 },
      );
      expect(spy).toHaveBeenCalled();
    });

    it('sendOrderShipped sends email', async () => {
      const spy = vi.spyOn(service as any, 'send').mockResolvedValue(true);
      await service.sendOrderShipped({ orderNumber: 'INV/001', courier: 'JNE', courierService: 'Reg', trackingNumber: '123' }, 'a@b.com');
      expect(spy).toHaveBeenCalled();
    });

    it('sendOrderCancelled sends email', async () => {
      const spy = vi.spyOn(service as any, 'send').mockResolvedValue(true);
      await service.sendOrderCancelled({ orderNumber: 'INV/001', total: 1000 }, 'a@b.com');
      expect(spy).toHaveBeenCalled();
    });

    it('sendPaymentRejected sends email', async () => {
      const spy = vi.spyOn(service as any, 'send').mockResolvedValue(true);
      await service.sendPaymentRejected({ orderNumber: 'INV/001', total: 1000 }, 'a@b.com', 'Invalid receipt');
      expect(spy).toHaveBeenCalled();
    });

    it('sendPasswordReset sends email', async () => {
      const spy = vi.spyOn(service as any, 'send').mockResolvedValue(true);
      await service.sendPasswordReset('a@b.com', 'reset-token');
      expect(spy).toHaveBeenCalled();
    });
  });
});

/* ── ShippingService ──────────────────────────── */
describe('ShippingService', () => {
  let service: ShippingService;
  let mockSettings: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings = { get: vi.fn() };
    service = new ShippingService(mockSettings);
  });

  describe('searchDestination', () => {
    it('returns empty when no api key', async () => {
      mockSettings.get.mockResolvedValue(null);
      expect(await service.searchDestination('Jakarta')).toEqual([]);
    });

    it('returns empty when no query', async () => {
      mockSettings.get.mockResolvedValue('key');
      expect(await service.searchDestination('')).toEqual([]);
    });

    it('returns empty on fetch failure', async () => {
      mockSettings.get.mockResolvedValue('some-api-key');
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
      expect(await service.searchDestination('Jakarta')).toEqual([]);
    });

    it('returns destinations on success', async () => {
      mockSettings.get.mockResolvedValue('some-api-key');
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ rajaongkir: { results: [{ subdistrict_name: 'Menteng', district: 'Menteng', city_name: 'Jakarta Pusat', province_name: 'DKI Jakarta' }] } }),
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any);
      const result = await service.searchDestination('Menteng');
      expect(result).toHaveLength(1);
    });

    it('handles non-ok response', async () => {
      mockSettings.get.mockResolvedValue('key');
      const mockResponse = { ok: false, status: 429, text: () => Promise.resolve('Too many') };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any);
      expect(await service.searchDestination('test')).toEqual([]);
    });

    it('handles non-array results', async () => {
      mockSettings.get.mockResolvedValue('key');
      const mockResponse = { ok: true, json: () => Promise.resolve({ data: 'not-array' }) };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any);
      expect(await service.searchDestination('test')).toEqual([]);
    });
  });

  describe('calculateCost', () => {
    it('returns empty when prerequisites missing', async () => {
      mockSettings.get.mockResolvedValue(null);
      expect(await service.calculateCost('', '', 1000)).toEqual([]);
    });

    it('returns costs on success', async () => {
      mockSettings.get.mockImplementation((k: string) => {
        if (k === 'rajaongkir_api_key') return 'key';
        if (k === 'enabled_couriers') return 'jne,tiki';
        return null;
      });
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ rajaongkir: { results: [{ name: 'JNE', costs: [{ service: 'REG', description: 'Reguler', cost: [{ value: 10000, etd: '1-2' }] }] }] } }),
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any);
      const result = await service.calculateCost('1', '2', 1000);
      expect(result).toHaveLength(1);
      expect(result[0].cost).toBe(10000);
    });

    it('handles fetch error', async () => {
      mockSettings.get.mockImplementation((k: string) => {
        if (k === 'rajaongkir_api_key') return 'key';
        if (k === 'enabled_couriers') return 'jne';
        return null;
      });
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));
      expect(await service.calculateCost('1', '2', 1000)).toEqual([]);
    });

    it('handles non-ok response', async () => {
      mockSettings.get.mockImplementation((k: string) => {
        if (k === 'rajaongkir_api_key') return 'key';
        if (k === 'enabled_couriers') return 'jne';
        return null;
      });
      const mockResponse = { ok: false, status: 500, text: () => Promise.resolve('Server error') };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any);
      expect(await service.calculateCost('1', '2', 1000)).toEqual([]);
    });

    it('handles malformed response', async () => {
      mockSettings.get.mockImplementation((k: string) => {
        if (k === 'rajaongkir_api_key') return 'key';
        if (k === 'enabled_couriers') return 'jne';
        return null;
      });
      const mockResponse = { ok: true, json: () => Promise.resolve({}) };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any);
      expect(await service.calculateCost('1', '2', 1000)).toEqual([]);
    });
  });
});

/* ── XenditService ────────────────────────────── */
describe('XenditService', () => {
  let service: XenditService;
  let mockSettings: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings = { get: vi.fn() };
    service = new XenditService(mockSettings);
  });

  describe('isEnabled', () => {
    it('returns false when no key', async () => {
      mockSettings.get.mockResolvedValue(null);
      expect(await service.isEnabled()).toBe(false);
    });

    it('returns true when key present and enabled', async () => {
      mockSettings.get.mockImplementation((k: string) => {
        if (k === 'xendit_secret_key') return 'sk_test_123';
        if (k === 'xendit_enabled') return 'true';
        return null;
      });
      expect(await service.isEnabled()).toBe(true);
    });
  });

  describe('createInvoice', () => {
    it('returns null when no api key', async () => {
      mockSettings.get.mockResolvedValue(null);
      expect(await service.createInvoice({
        externalId: 'ext1', amount: 50000, payerEmail: 'a@b.com',
        description: 'Test', successRedirectUrl: 'https://example.com/success',
      })).toBeNull();
    });

    it('creates invoice on success', async () => {
      mockSettings.get.mockResolvedValue('sk_test_123');
      const invoiceData = { id: 'inv1', external_id: 'ext1', status: 'PENDING', amount: 50000, invoice_url: 'https://pay.url', expiry_date: '2024-01-02T00:00:00Z' };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: () => Promise.resolve(invoiceData) } as any);
      const result = await service.createInvoice({
        externalId: 'ext1', amount: 50000, payerEmail: 'a@b.com',
        description: 'Test', successRedirectUrl: 'https://example.com/success',
        failureRedirectUrl: 'https://example.com/fail',
        items: [{ name: 'Product', quantity: 1, price: 50000 }],
      });
      expect(result).toEqual(invoiceData);
    });

    it('returns null on API error', async () => {
      mockSettings.get.mockResolvedValue('sk_test_123');
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 400, text: () => Promise.resolve('Bad request') } as any);
      expect(await service.createInvoice({
        externalId: 'ext1', amount: 50000, payerEmail: 'a@b.com',
        description: 'Test', successRedirectUrl: 'https://example.com/success',
      })).toBeNull();
    });
  });
});
