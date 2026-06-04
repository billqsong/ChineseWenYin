import sodium from 'libsodium-wrappers-sumo';
import type { PayloadHeader, SecurityLevel } from '../payload/payloadTypes';
import { normalizePassword } from '../password/normalizePassword';

export type ArgonParams = {
  code: PayloadHeader['argonParamCode'];
  opsLimit: number;
  memLimit: number;
};

let sodiumReady: Promise<void> | undefined;

export async function ensureSodiumReady(): Promise<typeof sodium> {
  sodiumReady ??= sodium.ready;
  await sodiumReady;
  return sodium;
}

export async function getArgonParamsByCode(code: PayloadHeader['argonParamCode']): Promise<ArgonParams> {
  const s = await ensureSodiumReady();
  const baseOps = s.crypto_pwhash_OPSLIMIT_INTERACTIVE;
  const baseMem = s.crypto_pwhash_MEMLIMIT_INTERACTIVE;
  if (code === 1) {
    return { code, opsLimit: baseOps, memLimit: baseMem };
  }
  if (code === 2) {
    return { code, opsLimit: baseOps * 2, memLimit: baseMem };
  }
  return { code, opsLimit: baseOps * 3, memLimit: baseMem };
}

export function argonCodeForSecurityLevel(level: SecurityLevel): PayloadHeader['argonParamCode'] {
  if (level === 'extreme') {
    return 3;
  }
  return 1;
}

export async function deriveKey(password: string, salt: Uint8Array, code: PayloadHeader['argonParamCode']): Promise<Uint8Array> {
  const s = await ensureSodiumReady();
  const params = await getArgonParamsByCode(code);
  return s.crypto_pwhash(
    32,
    normalizePassword(password),
    salt,
    params.opsLimit,
    params.memLimit,
    s.crypto_pwhash_ALG_ARGON2ID13
  );
}
