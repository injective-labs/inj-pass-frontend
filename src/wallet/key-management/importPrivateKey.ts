/**
 * Import private key (from Metamask or other wallet)
 * Validates and normalizes the private key format
 */

import { deriveSecp256k1, fromHex, isValidPrivateKeyHex } from './deriveSecp256k1';

export interface ImportResult {
  privateKey: Uint8Array;
  address: string;
}

/**
 * Import and validate a private key
 * 
 * @param privateKeyInput - Private key as hex string (with or without 0x prefix)
 * @returns Validated private key and derived address
 */
export function importPrivateKey(privateKeyInput: string): ImportResult {
  // Validate format
  if (!isValidPrivateKeyHex(privateKeyInput)) {
    throw new Error('Invalid private key format. Must be 64 hex characters (with or without 0x prefix)');
  }

  // Convert to bytes
  const privateKeyBytes = fromHex(privateKeyInput);

  // Derive address to validate key
  const { privateKey, address } = deriveSecp256k1(privateKeyBytes);

  return {
    privateKey,
    address,
  };
}

/**
 * Validate private key without importing
 */
export function validatePrivateKey(privateKeyInput: string): boolean {
  try {
    importPrivateKey(privateKeyInput);
    return true;
  } catch {
    return false;
  }
}
