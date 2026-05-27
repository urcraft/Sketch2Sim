import * as anthropic from './anthropic.js';
import * as openai from './openai.js';
import * as gemini from './gemini.js';

const ADAPTERS = { anthropic, openai, gemini };

export function getProvider(name) {
  const adapter = ADAPTERS[name];
  if (!adapter) throw new Error(`Unknown provider: ${name}`);
  return adapter;
}
