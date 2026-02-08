export type WalletSource = 'passkey' | 'nfc' | 'import';

export interface LocalKeystore {
  address: string; // 0x... or inj...
  encryptedPrivateKey: string; // "iv:tag:encrypted" format
  source: WalletSource;
  credentialId?: string; // Passkey only
  nfcUID?: string; // NFC only
  createdAt: number; // Unix timestamp
}

export interface Wallet {
  address: string;
  privateKey: Uint8Array;
  source: WalletSource;
}

export interface EncryptedData {
  iv: string; // hex
  tag: string; // hex
  encrypted: string; // hex
}
