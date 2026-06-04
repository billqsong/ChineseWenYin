import { ensureSodiumReady } from './kdf';

export async function encryptAead(message: string, aad: Uint8Array, nonce: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  const sodium = await ensureSodiumReady();
  return sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(message, aad, null, nonce, key);
}

export async function decryptAead(
  ciphertextWithTag: Uint8Array,
  aad: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array
): Promise<Uint8Array> {
  const sodium = await ensureSodiumReady();
  return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ciphertextWithTag, aad, nonce, key);
}
