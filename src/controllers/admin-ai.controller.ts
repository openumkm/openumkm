import { Controller, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service';
import { AiService } from '../services/ai.service';
import { getAuthFromRequest } from '../common/auth.helper';

@Controller('/admin/ai')
export class AdminAiController {
  constructor(
    private readonly authService: AuthService,
    private readonly aiService: AiService,
  ) {}

  /**
   * POST /admin/ai/generate
   * AJAX endpoint — accepts JSON, returns JSON.
   *
   * Body: { type, productName?, description?, prompt?, field? }
   * - type: 'product_description' | 'meta_title' | 'meta_description' | 'custom'
   * - productName: product name (for product-related generation)
   * - description: existing description (for SEO context)
   * - prompt: custom prompt (for type 'custom')
   * - field: field name context (for type 'custom')
   *
   * Response: { success: true, text: '...' } or { success: false, error: '...' }
   */
  @Post('/generate')
  async generate(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = getAuthFromRequest(req, this.authService);
    if (!auth || auth.role !== 'seller') {
      return res.status(401).send({ success: false, error: 'Unauthorized' });
    }

    const body = req.body as Record<string, string>;
    const { type, productName, description, prompt, field } = body;

    if (!type) {
      return res.send({ success: false, error: 'Missing "type" parameter.' });
    }

    let result: string | null = null;

    switch (type) {
      case 'product_description':
        if (!productName) return res.send({ success: false, error: 'Product name is required.' });
        result = await this.aiService.generateProductDescription(productName, prompt);
        break;

      case 'meta_title':
        if (!productName) return res.send({ success: false, error: 'Product name is required.' });
        result = await this.aiService.generateMetaTitle(productName, description);
        break;

      case 'meta_description':
        if (!productName) return res.send({ success: false, error: 'Product name is required.' });
        result = await this.aiService.generateMetaDescription(productName, description);
        break;

      case 'custom':
        if (!prompt) return res.send({ success: false, error: 'Prompt is required.' });
        result = await this.aiService.generateCustom(prompt, field);
        break;

      default:
        return res.send({ success: false, error: `Unknown type: ${type}` });
    }

    if (result === null) {
      return res.send({ success: false, error: 'AI generation failed. Check your AI configuration in Settings.' });
    }

    return res.send({ success: true, text: result });
  }
}
