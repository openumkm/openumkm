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

  /**
   * Fetch the list of available models from an OpenAI-compatible endpoint.
   * Accepts explicit credentials (so the admin can test before saving).
   *
   * Returns a sorted list of model IDs, or an error message on failure.
   */
  async listModels(baseUrl: string, apiKey: string): Promise<{ models: string[] } | { error: string }> {
    if (!baseUrl || !apiKey) {
      return { error: 'Base URL and API key are required.' };
    }

    const cleanBase = baseUrl.replace(/\/+$/, '');
    const url = `${cleanBase}/models`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return { error: `API returned ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}` };
      }

      const data = await response.json() as {
        data?: Array<{ id?: string }>;
        models?: Array<{ id?: string; name?: string } | string>;
      };

      // OpenAI/most compatible APIs return { data: [{ id: ... }, ...] }.
      // Some providers (e.g. Ollama, LM Studio variants) return { models: [...] } or a plain array.
      const ids = new Set<string>();
      const pushId = (v: unknown) => {
        if (typeof v === 'string' && v.trim()) ids.add(v.trim());
        else if (v && typeof v === 'object') {
          const obj = v as { id?: unknown; name?: unknown };
          if (typeof obj.id === 'string' && obj.id.trim()) ids.add(obj.id.trim());
          else if (typeof obj.name === 'string' && obj.name.trim()) ids.add(obj.name.trim());
        }
      };

      if (Array.isArray(data)) data.forEach(pushId);
      if (Array.isArray(data?.data)) data.data.forEach(pushId);
      if (Array.isArray(data?.models)) data.models.forEach(pushId);

      const models = Array.from(ids).sort((a, b) => a.localeCompare(b));
      if (!models.length) {
        return { error: 'No models found in the API response.' };
      }

      return { models };
    } catch (err: any) {
      if (err?.name === 'AbortError') return { error: 'Request timed out after 15s.' };
      return { error: err?.message || 'Failed to reach the API.' };
    }
  }
}
