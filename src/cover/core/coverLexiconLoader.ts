import type { CoverStyle } from '../../payload/payloadTypes';
import type { StyleLexicon } from './coverTypes';

const cache = new Map<CoverStyle, Promise<StyleLexicon>>();

export function loadStyleLexicon(style: CoverStyle): Promise<StyleLexicon> {
  const existing = cache.get(style);
  if (existing) {
    return existing;
  }
  const promise = load(style);
  cache.set(style, promise);
  return promise;
}

export async function loadAllStyleLexicons(): Promise<StyleLexicon[]> {
  return Promise.all(['daily', 'chat', 'novel', 'classical'].map((style) => loadStyleLexicon(style as CoverStyle)));
}

async function load(style: CoverStyle): Promise<StyleLexicon> {
  switch (style) {
    case 'chat':
      return (await import('../lexicons/chat/chatLexicon')).chatLexicon;
    case 'daily':
      return (await import('../lexicons/daily/dailyLexicon')).dailyLexicon;
    case 'novel':
      return (await import('../lexicons/novel/novelLexicon')).novelLexicon;
    case 'classical':
      return (await import('../lexicons/classical/classicalLexicon')).classicalLexicon;
  }
}
