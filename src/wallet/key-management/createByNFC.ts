/**
 * Create wallet using NFC
 * Uses NFC UID as entropy source
 */

import { deriveSecp256k1 } from './deriveSecp256k1';
import { encryptKey } from '../keystore/encryptKey';
import { saveWallet } from '../keystore/storage';
import { LocalKeystore } from '@/types/wallet';
import { sha256 } from '@noble/hashes/sha2.js';

export interface CreateByNFCResult {
  address: string;
  nfcUID: string;
}

/**
 * Create a new wallet using NFC UID as entropy
 * 
 * @param nfcUID - NFC UID (hex string)
 * @param additionalEntropy - Optional additional entropy (defaults to random)
 */
export async function createByNFC(
  nfcUID: string,
  additionalEntropy?: Uint8Array
): Promise<CreateByNFCResult> {
  try {
    if (!nfcUID || nfcUID.length < 8) {
      throw new Error('Invalid NFC UID');
    }

    // Convert NFC UID to bytes
    const uidBytes = new TextEncoder().encode(nfcUID);

    // Generate additional entropy if not provided
    const extra = additionalEntropy || crypto.getRandomValues(new Uint8Array(32));

    // Combine NFC UID and additional entropy
    const combined = new Uint8Array(uidBytes.length + extra.length);
    combined.set(uidBytes, 0);
    combined.set(extra, uidBytes.length);

    // Hash to get wallet entropy
    const walletEntropy = sha256(combined);

    // Derive wallet
    const { privateKey, address } = deriveSecp256k1(walletEntropy);

    // Use NFC UID hash as encryption key
    const encryptionEntropy = sha256(uidBytes);

    // Encrypt and save
    const encryptedPrivateKey = await encryptKey(privateKey, encryptionEntropy);

    const keystore: LocalKeystore = {
      address,
      encryptedPrivateKey,
      source: 'nfc',
      nfcUID,
      createdAt: Date.now(),
    };

    saveWallet(keystore);

    return {
      address,
      nfcUID,
    };
  } catch (error) {
    throw new Error(
      `Failed to create wallet with NFC: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Unlock wallet using NFC
 * 
 * @param nfcUID - NFC UID to derive decryption key
 */
export async function unlockByNFC(nfcUID: string): Promise<Uint8Array> {
  try {
    if (!nfcUID || nfcUID.length < 8) {
      throw new Error('Invalid NFC UID');
    }

    // Derive decryption key from NFC UID
    const uidBytes = new TextEncoder().encode(nfcUID);
    const decryptionEntropy = sha256(uidBytes);

    return decryptionEntropy;
  } catch (error) {
    throw new Error(
      `Failed to unlock wallet with NFC: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Read NFC tag (Web NFC API)
 * Note: Web NFC is only supported on Android Chrome
 */
export async function readNFCTag(): Promise<string> {
  if (!('NDEFReader' in window)) {
    throw new Error('Web NFC is not supported on this device/browser');
  }

  try {
    const ndef = new (window as any).NDEFReader();
    await ndef.scan();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('NFC scan timeout'));
      }, 30000); // 30 second timeout

      ndef.addEventListener('reading', ({ serialNumber }: any) => {
        clearTimeout(timeout);
        // Convert serial number to consistent format
        const uid = serialNumber.replace(/:/g, '').toUpperCase();
        resolve(uid);
      });

      ndef.addEventListener('readingerror', () => {
        clearTimeout(timeout);
        reject(new Error('Failed to read NFC tag'));
      });
    });
  } catch (error) {
    throw new Error(
      `NFC reading failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Check if Web NFC is supported
 */
export function isNFCSupported(): boolean {
  return 'NDEFReader' in window;
}
