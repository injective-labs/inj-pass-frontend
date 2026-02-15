/**
 * Utility functions for wallet operations
 */

/**
 * Convert Uint8Array private key to hex string format
 */
export function privateKeyToHex(privateKey: Uint8Array): `0x${string}` {
  const hex = Array.from(privateKey)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `0x${hex}`;
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToPrivateKey(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Format address for display (e.g., 0x1234...5678)
 */
export function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format token amount for display
 */
export function formatTokenAmount(amount: string, decimals: number = 6): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0.00';
  
  if (num === 0) return '0.00';
  if (num < 0.01) return '<0.01';
  
  return num.toFixed(decimals);
}

/**
 * Validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
