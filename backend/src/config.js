import 'dotenv/config';

const env = process.env;

export const config = {
  port: Number(env.PORT || 8787),
  provider: (env.AI_PROVIDER || 'auto').toLowerCase(),
  confidenceThreshold: Number(env.CONFIDENCE_THRESHOLD || 0.8),
  gemini: {
    key: env.GEMINI_API_KEY || '',
    fast: env.GEMINI_MODEL_FAST || 'gemini-1.5-flash',
    fallback: env.GEMINI_MODEL_FALLBACK || 'gemini-1.5-pro',
  },
  anthropic: {
    key: env.ANTHROPIC_API_KEY || '',
    fast: env.ANTHROPIC_MODEL_FAST || 'claude-haiku-4-5',
    fallback: env.ANTHROPIC_MODEL_FALLBACK || 'claude-sonnet-4-6',
  },
  openai: {
    key: env.OPENAI_API_KEY || '',
    whisper: env.OPENAI_WHISPER_MODEL || 'whisper-1',
  },
};

export function hasAnyKey() {
  return Boolean(config.gemini.key || config.anthropic.key || config.openai.key);
}

// MOCK quando nenhuma chave OU provider=mock
export function isMock() {
  return config.provider === 'mock' || !hasAnyKey();
}

export function visionProvider() {
  if (config.provider === 'gemini') return 'gemini';
  if (config.provider === 'anthropic') return 'anthropic';
  if (config.gemini.key) return 'gemini';
  if (config.anthropic.key) return 'anthropic';
  return 'mock';
}
