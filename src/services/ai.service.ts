import { Injectable } from '@nestjs/common';
import { SettingsService } from './settings.service';

interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

@Injectable()
export class AiService {
  constructor(private readonly settingsService: SettingsService) {}

  /** Check if AI is configured and enabled */
  async getConfig(): Promise<AiConfig | null> {
    const keys = ['ai_enabled', 'ai_base_url', 'ai_api_key', 'ai_model'];
    const s = await this.settingsService.getMany(keys);

    if (s.ai_enabled !== 'true' || !s.ai_base_url || !s.ai_api_key || !s.ai_model) {
      return null;
    }

    return {
      baseUrl: s.ai_base_url.replace(/\/+$/, ''),
      apiKey: s.ai_api_key,
      model: s.ai_model,
    };
  }

  /**
   * Generate text using OpenAI-compatible chat completions API.
   * Returns the generated text or null on failure.
   */
  async generate(prompt: string, context?: string): Promise<string | null> {
    const config = await this.getConfig();
    if (!config) return null;

    const messages: Array<{ role: string; content: string }> = [];

    if (context) {
      messages.push({
        role: 'system',
        content: context,
      });
    }

    messages.push({
      role: 'user',
      content: prompt,
    });

    try {
      const url = `${config.baseUrl}/chat/completions`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          max_tokens: 1024,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ai] API error ${response.status}: ${errorText}`);
        return null;
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data.choices?.[0]?.message?.content?.trim();
      return content || null;
    } catch (err) {
      console.error('[ai] Request failed:', err);
      return null;
    }
  }

  /** Generate a product description */
  async generateProductDescription(productName: string, instruction?: string): Promise<string | null> {
    const lang = (await this.settingsService.get('default_language')) || 'en';
    const langLabel = lang === 'id' ? 'Bahasa Indonesia' : 'English';

    const systemPrompt = `You are a copywriter for an online store. Write compelling product descriptions that are concise, highlight key features, and encourage purchase. Write in ${langLabel}. Output only the description text, no markdown formatting.`;

    const userPrompt = instruction
      ? `Write a product description for "${productName}". Additional instructions: ${instruction}`
      : `Write a product description for "${productName}".`;

    return this.generate(userPrompt, systemPrompt);
  }

  /** Generate SEO meta title */
  async generateMetaTitle(productName: string, description?: string): Promise<string | null> {
    const lang = (await this.settingsService.get('default_language')) || 'en';
    const langLabel = lang === 'id' ? 'Bahasa Indonesia' : 'English';

    const systemPrompt = `You are an SEO specialist. Generate a concise, keyword-rich meta title (max 60 characters) for a product page. Write in ${langLabel}. Output only the title text.`;

    const userPrompt = description
      ? `Generate a meta title for the product "${productName}". Description: ${description}`
      : `Generate a meta title for the product "${productName}".`;

    return this.generate(userPrompt, systemPrompt);
  }

  /** Generate SEO meta description */
  async generateMetaDescription(productName: string, description?: string): Promise<string | null> {
    const lang = (await this.settingsService.get('default_language')) || 'en';
    const langLabel = lang === 'id' ? 'Bahasa Indonesia' : 'English';

    const systemPrompt = `You are an SEO specialist. Generate a compelling meta description (max 160 characters) for a product page. Write in ${langLabel}. Output only the description text.`;

    const userPrompt = description
      ? `Generate a meta description for the product "${productName}". Description: ${description}`
      : `Generate a meta description for the product "${productName}".`;

    return this.generate(userPrompt, systemPrompt);
  }

  /** Generate any text from a custom prompt (for the generic "Generate with AI" button) */
  async generateCustom(prompt: string, fieldContext?: string): Promise<string | null> {
    const lang = (await this.settingsService.get('default_language')) || 'en';
    const langLabel = lang === 'id' ? 'Bahasa Indonesia' : 'English';

    const systemPrompt = `You are a helpful assistant for an online store. Write in ${langLabel}. Output only the requested text, no markdown formatting, no extra explanation.${fieldContext ? ` Context: this text is for the "${fieldContext}" field.` : ''}`;

    return this.generate(prompt, systemPrompt);
  }
}
