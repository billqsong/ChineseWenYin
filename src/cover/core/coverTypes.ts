import type { CoverStyle } from '../../payload/payloadTypes';
import type { CoverMode } from '../../payload/payloadTypes';

export type SlotName =
  | 'time' | 'weather' | 'emotion' | 'place' | 'object' | 'action'
  | 'person' | 'scene' | 'feeling' | 'connector' | 'ending'
  | 'opener' | 'subject' | 'status' | 'tone'
  | 'environment' | 'result'
  | 'atmosphere' | 'character' | 'motion' | 'inner';
export type LengthTier = 'short' | 'medium' | 'long';

export type LexiconItem = {
  text: string;
  slot: SlotName;
  style: CoverStyle;
  value: number;
  topics?: string[];
  weight: number;
  tone?: string;
  maxPerParagraph?: number;
  incompatibleWith?: string[];
};

export type CoverTemplate = {
  id: string;
  style: CoverStyle;
  value: number;
  lengthTier: LengthTier;
  slots: SlotName[];
  pattern: string;
  weight: number;
  mode?: CoverMode;
  maxUsePerOutput?: number;
};

export type CoverRule = {
  id: string;
  style: CoverStyle;
  kind: 'allow' | 'block';
  slots?: SlotName[];
  topics?: string[];
  pattern?: string;
  reason: string;
};

export type StyleLexicon = {
  style: CoverStyle;
  items: LexiconItem[];
  templates: CoverTemplate[];
  allowRules: CoverRule[];
  blockRules: CoverRule[];
  fallbackTemplate: CoverTemplate;
};

export const COVER_VALUE_BITS = 6;
export const COVER_VALUE_SPACE = 1 << COVER_VALUE_BITS;

export const slotOrder: SlotName[] = [
  'time', 'weather', 'emotion', 'place', 'object', 'action',
  'person', 'scene', 'feeling', 'connector', 'ending',
  'opener', 'subject', 'status', 'tone',
  'environment', 'result',
  'atmosphere', 'character', 'motion', 'inner'
];
