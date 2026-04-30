import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

type Translations = Record<string, string>;
type LangCache = Record<string, Record<string, Translations>>;

const cache: LangCache = {};
const SUPPORTED_LANGS = ['id', 'en'];
const DEFAULT_LANG = 'en';

/** Load a translation namespace for a language */
function loadNamespace(lang: string, ns: string): Translations {
  if (cache[lang]?.[ns]) return cache[lang][ns];

  const filePath = join(__dirname, '..', 'locales', lang, `${ns}.json`);
  let data: Translations = {};

  if (existsSync(filePath)) {
    try {
      data = JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch {
      console.error(`[i18n] Failed to parse ${filePath}`);
    }
  }

  if (!cache[lang]) cache[lang] = {};
  cache[lang][ns] = data;
  return data;
}

/** Preload all namespaces for all languages */
export function preloadTranslations() {
  const namespaces = ['storefront', 'admin', 'dashboard', 'auth'];
  for (const lang of SUPPORTED_LANGS) {
    for (const ns of namespaces) {
      loadNamespace(lang, ns);
    }
  }
}

/**
 * Create a translation function for a given language.
 * Usage in EJS: t('storefront.add_to_cart') or t('auth.login')
 */
export function createTranslator(lang: string) {
  const activeLang = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;

  return function t(key: string, fallback?: string): string {
    const parts = key.split('.');
    if (parts.length < 2) return fallback || key;

    const ns = parts[0];
    const k = parts.slice(1).join('.');

    // Try active language first
    const translations = loadNamespace(activeLang, ns);
    if (translations[k]) return translations[k];

    // Fallback to English
    if (activeLang !== 'en') {
      const enTranslations = loadNamespace('en', ns);
      if (enTranslations[k]) return enTranslations[k];
    }

    // Fallback to key or provided fallback
    return fallback || k;
  };
}

/** Determine language from request (cookie > query > settings default) */
export function detectLanguage(req: any, defaultLang = 'en'): string {
  // 1. Query param ?lang=
  const queryLang = req.query?.lang;
  if (queryLang && SUPPORTED_LANGS.includes(queryLang)) return queryLang;

  // 2. Cookie
  const cookieLang = req.cookies?.lang;
  if (cookieLang && SUPPORTED_LANGS.includes(cookieLang)) return cookieLang;

  // 3. Default from settings
  return SUPPORTED_LANGS.includes(defaultLang) ? defaultLang : 'en';
}

export { SUPPORTED_LANGS, DEFAULT_LANG };
