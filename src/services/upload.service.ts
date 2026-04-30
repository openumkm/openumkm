import { Injectable } from '@nestjs/common';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { SettingsService } from './settings.service';

const UPLOADS_DIR = join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
}

@Injectable()
export class UploadService {
  private s3Client: any = null;
  private s3Config: S3Config | null = null;

  constructor(private readonly settingsService: SettingsService) {
    for (const sub of ['products', 'receipts', 'logos', 'bank-logos', 'og', 'general']) {
      const dir = join(UPLOADS_DIR, sub);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    }
  }

  private async getS3Config(): Promise<S3Config | null> {
    if (this.s3Config) return this.s3Config;

    const [endpoint, region, bucket, accessKey, secretKey, enabled] = await Promise.all([
      this.settingsService.get('s3_endpoint'),
      this.settingsService.get('s3_region'),
      this.settingsService.get('s3_bucket'),
      this.settingsService.get('s3_access_key'),
      this.settingsService.get('s3_secret_key'),
      this.settingsService.get('s3_enabled'),
    ]);

    if (enabled !== 'true' || !endpoint || !bucket || !accessKey || !secretKey) return null;

    this.s3Config = {
      endpoint: endpoint.replace(/\/$/, ''),
      region: region || 'us-east-1',
      bucket,
      accessKey,
      secretKey,
    };
    return this.s3Config;
  }

  private async getS3Client(): Promise<any> {
    if (this.s3Client) return this.s3Client;

    try {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const config = await this.getS3Config();
      if (!config) return null;

      this.s3Client = new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        credentials: {
          accessKeyId: config.accessKey,
          secretAccessKey: config.secretKey,
        },
        forcePathStyle: true,
      });
      return this.s3Client;
    } catch {
      return null;
    }
  }

  async isS3Configured(): Promise<boolean> {
    const config = await this.getS3Config();
    return config !== null;
  }

  /**
   * Upload a buffer to storage (S3 or local) and return public URL.
   * @param buffer File buffer
   * @param subfolder e.g. 'products', 'receipts', 'logos'
   * @param mimeType MIME type for extension detection
   */
  async uploadBuffer(
    buffer: Buffer,
    subfolder: string,
    mimeType = 'image/jpeg',
  ): Promise<string | null> {
    if (buffer.length > MAX_FILE_SIZE) return null;

    const ext = this.getExtension(mimeType);
    const filename = `${uuidv4()}${ext}`;
    const key = `${subfolder}/${filename}`;

    const s3Client = await this.getS3Client();
    if (s3Client) {
      try {
        const { PutObjectCommand } = await import('@aws-sdk/client-s3');
        const config = await this.getS3Config();
        await s3Client.send(new PutObjectCommand({
          Bucket: config!.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        }));
        return `s3://${key}`;
      } catch (err) {
        console.error('[Upload] S3 upload failed, falling back to local:', err);
      }
    }

    // Fallback to local storage
    const dir = join(UPLOADS_DIR, subfolder);
    const filepath = join(dir, filename);
    writeFileSync(filepath, buffer);
    return `/uploads/${key}`;
  }

  /**
   * Get a publicly accessible URL for a stored file.
   * For S3: returns a presigned URL (1 hour expiry).
   * For local: returns the local URL path.
   */
  async getPublicUrl(storedPath: string): Promise<string | null> {
    if (!storedPath) return null;

    if (storedPath.startsWith('s3://')) {
      const key = storedPath.slice(5); // Remove 's3://'
      const s3Client = await this.getS3Client();
      const config = await this.getS3Config();
      if (!s3Client || !config) return null;

      try {
        const { GetObjectCommand } = await import('@aws-sdk/client-s3');
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
        const command = new GetObjectCommand({
          Bucket: config.bucket,
          Key: key,
        });
        return getSignedUrl(s3Client, command, { expiresIn: 3600 });
      } catch {
        return null;
      }
    }

    return storedPath;
  }

  /** Delete a file by its stored path */
  async deleteFile(storedPath: string) {
    if (!storedPath) return;

    if (storedPath.startsWith('s3://')) {
      const key = storedPath.slice(5);
      const s3Client = await this.getS3Client();
      const config = await this.getS3Config();
      if (!s3Client || !config) return;

      try {
        const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
        await s3Client.send(new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: key,
        }));
      } catch {
        // ignore
      }
      return;
    }

    if (!storedPath.startsWith('/uploads/')) return;
    const filepath = join(process.cwd(), storedPath);
    try {
      if (existsSync(filepath)) unlinkSync(filepath);
    } catch {
      // ignore
    }
  }

  private getExtension(mime: string): string {
    switch (mime) {
      case 'image/jpeg': return '.jpg';
      case 'image/png': return '.png';
      case 'image/webp': return '.webp';
      case 'image/gif': return '.gif';
      default: return '.bin';
    }
  }
}
