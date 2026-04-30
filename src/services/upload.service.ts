import { Injectable } from '@nestjs/common';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { FastifyRequest } from 'fastify';

const UPLOADS_DIR = join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

@Injectable()
export class UploadService {
  constructor() {
    // Ensure upload directories exist
    for (const sub of ['products', 'receipts', 'logos', 'general']) {
      const dir = join(UPLOADS_DIR, sub);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Save an uploaded file from a multipart request.
   * Returns the public URL path (e.g. /uploads/products/abc.jpg)
   */
  async saveFile(
    req: FastifyRequest,
    subfolder: 'products' | 'receipts' | 'logos' | 'general' = 'general',
    fieldName = 'file',
  ): Promise<string | null> {
    try {
      const data = await (req as any).file();
      if (!data) return null;

      if (!ALLOWED_MIME.includes(data.mimetype)) {
        // Consume the stream to avoid hanging
        await data.toBuffer();
        return null;
      }

      const buffer = await data.toBuffer();
      if (buffer.length > MAX_FILE_SIZE) return null;

      const ext = this.getExtension(data.mimetype);
      const filename = `${uuidv4()}${ext}`;
      const dir = join(UPLOADS_DIR, subfolder);
      const filepath = join(dir, filename);

      writeFileSync(filepath, buffer);
      return `/uploads/${subfolder}/${filename}`;
    } catch {
      return null;
    }
  }

  /**
   * Save multiple files from a multipart request.
   * Returns array of public URL paths.
   */
  async saveFiles(
    req: FastifyRequest,
    subfolder: 'products' | 'receipts' | 'logos' | 'general' = 'general',
  ): Promise<string[]> {
    const urls: string[] = [];
    try {
      const parts = (req as any).files();
      for await (const part of parts) {
        if (!ALLOWED_MIME.includes(part.mimetype)) {
          await part.toBuffer();
          continue;
        }

        const buffer = await part.toBuffer();
        if (buffer.length > MAX_FILE_SIZE) continue;

        const ext = this.getExtension(part.mimetype);
        const filename = `${uuidv4()}${ext}`;
        const dir = join(UPLOADS_DIR, subfolder);
        const filepath = join(dir, filename);

        writeFileSync(filepath, buffer);
        urls.push(`/uploads/${subfolder}/${filename}`);
      }
    } catch {
      // partial upload is fine
    }
    return urls;
  }

  /** Delete a file by its public URL path */
  deleteFile(urlPath: string) {
    if (!urlPath || !urlPath.startsWith('/uploads/')) return;
    const filepath = join(process.cwd(), urlPath);
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
