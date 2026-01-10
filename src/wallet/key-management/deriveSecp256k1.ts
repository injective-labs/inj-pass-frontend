import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';

/**
 * Derive secp256k1 private key from entropy
 * 
 * @param entropy - Random bytes (32 bytes minimum)
 * @returns Private key (32 bytes) and corresponding Ethereum address
 */
export function deriveSecp256k1(entropy: Uint8Array): {
  privateKey: Uint8Array;
  address: string;
} {
  if (entropy.length < 32) {
    throw new Error('Entropy must be at least 32 bytes');
  }

  // Ensure private key is valid for secp256k1 curve
  const privateKey = entropy.slice(0, 32);
  
  // Validate private key is in valid range (1 to n-1)
  if (!isValidPrivateKey(privateKey)) {
    throw new Error('Invalid private key derived from entropy');
  }

  // Derive public key
  const publicKey = secp256k1.getPublicKey(privateKey, false); // uncompressed

  // Generate Ethereum address (last 20 bytes of keccak256(publicKey))
  const hash = keccak_256(publicKey.slice(1)); // Remove 0x04 prefix
  const address = '0x' + toHex(hash.slice(-20));

  return {
    privateKey,
    address: checksumAddress(address),
  };
}

/**
 * Check if private key is valid for secp256k1
 */
function isValidPrivateKey(privateKey: Uint8Array): boolean {
  // Must not be zero
  if (privateKey.every((b) => b === 0)) {
    return false;
  }

  // Must be less than curve order
  // secp256k1 curve order (n)
  const n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
  const keyBigInt = bytesToBigInt(privateKey);
  
  return keyBigInt > 0n && keyBigInt < n;
}

/**
 * Convert bytes to BigInt
 */
function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }
  return result;
}

/**
 * Apply EIP-55 checksum to Ethereum address
 */
function checksumAddress(address: string): string {
  const addr = address.toLowerCase().replace('0x', '');
  const hash = toHex(keccak_256(new TextEncoder().encode(addr)));
  
  let checksummed = '0x';
  for (let i = 0; i < addr.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      checksummed += addr[i].toUpperCase();
    } else {
      checksummed += addr[i];
    }
  }
  
  return checksummed;
}

/**
 * Convert bytes to hex string
 */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to bytes
 */
export function fromHex(hex: string): Uint8Array {
  const cleaned = hex.replace(/^0x/, '');
  const matches = cleaned.match(/.{1,2}/g);
  if (!matches) {
    throw new Error('Invalid hex string');
  }
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Validate private key format (hex string)
 */
export function isValidPrivateKeyHex(privateKey: string): boolean {
  const cleaned = privateKey.replace(/^0x/, '');
  if (cleaned.length !== 64) {
    return false;
  }
  return /^[0-9a-fA-F]{64}$/.test(cleaned);
}
