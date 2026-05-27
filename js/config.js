// Provider + model registry and app-wide constants.
// Model IDs live here so they are trivial to edit. The settings UI also lets
// the user type any custom model ID, so this list is just convenient defaults.

export const PROVIDERS = {
  anthropic: {
    label: 'Anthropic (Claude)',
    endpoint: 'https://api.anthropic.com/v1/messages',
    anthropicVersion: '2023-06-01',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'Starts with "sk-ant-". Created at console.anthropic.com.',
    note: 'Claude officially supports direct browser calls.',
    models: [
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — balanced (default)' },
      { id: 'claude-opus-4-7', label: 'Claude Opus 4.7 — best quality' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — fast & cheap' },
    ],
    defaultModel: 'claude-sonnet-4-6',
  },
  openai: {
    label: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'Starts with "sk-". Created at platform.openai.com.',
    note: 'OpenAI does not officially support browser calls — if you hit a CORS error you may need a proxy.',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o — vision (default)' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini — fast & cheap' },
    ],
    defaultModel: 'gpt-4o',
  },
  gemini: {
    label: 'Google Gemini',
    // model id + ":streamGenerateContent?alt=sse" is appended by the adapter
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'Created at aistudio.google.com/apikey.',
    note: 'Works with a user key directly from the browser.',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — fast (default)' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro — best quality' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    ],
    defaultModel: 'gemini-2.5-flash',
  },
};

export const DEFAULT_PROVIDER = 'anthropic';

// How many of the most recent text turns to send each request.
export const MAX_TEXT_TURNS = 12;

// Upper bound on tokens the model may produce for a generated page.
export const MAX_OUTPUT_TOKENS = 16000;
