import { utf8Encode } from '../utils/bytes';

export function normalizePassword(input: string): string {
  return input.trim().normalize('NFKC');
}

export function passwordToKdfBytes(input: string): Uint8Array {
  return utf8Encode(normalizePassword(input));
}
