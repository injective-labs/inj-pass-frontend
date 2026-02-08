/**
 * Simple integration test for wallet key management
 * Run in browser console or Next.js page
 */

import { deriveSecp256k1, fromHex } from '@/wallet/key-management/deriveSecp256k1';
import { encryptKey, decryptKey } from '@/wallet/keystore/encryptKey';
import { importPrivateKey } from '@/wallet/key-management/importPrivateKey';
import { saveWallet, loadWallet, deleteWallet } from '@/wallet/keystore/storage';
import { LocalKeystore } from '@/types/wallet';

export async function runKeystoreTests() {
  console.log('🧪 Starting Keystore Tests...\n');

  try {
    // Test 1: Private key derivation
    console.log('Test 1: Private key derivation');
    const entropy = crypto.getRandomValues(new Uint8Array(32));
    const { privateKey, address } = deriveSecp256k1(entropy);
    console.log('✅ Generated address:', address);
    console.log('✅ Private key length:', privateKey.length, 'bytes\n');

    // Test 2: Encryption/Decryption
    console.log('Test 2: Encryption/Decryption');
    const encryptionKey = crypto.getRandomValues(new Uint8Array(32));
    const encrypted = await encryptKey(privateKey, encryptionKey);
    console.log('✅ Encrypted format:', encrypted.split(':').map(p => p.length).join(':'));
    
    const decrypted = await decryptKey(encrypted, encryptionKey);
    const match = decrypted.every((byte, i) => byte === privateKey[i]);
    console.log('✅ Decryption match:', match ? 'YES' : 'NO\n');

    if (!match) {
      throw new Error('Decryption failed!');
    }

    // Test 3: Import private key
    console.log('Test 3: Import private key');
    const testKey = '0x' + Array.from(privateKey).map(b => b.toString(16).padStart(2, '0')).join('');
    const imported = importPrivateKey(testKey);
    console.log('✅ Imported address:', imported.address);
    console.log('✅ Address match:', imported.address === address ? 'YES' : 'NO\n');

    // Test 4: Storage
    console.log('Test 4: Storage operations');
    const keystore: LocalKeystore = {
      address,
      encryptedPrivateKey: encrypted,
      source: 'import',
      createdAt: Date.now(),
    };
    
    saveWallet(keystore);
    console.log('✅ Saved to localStorage');
    
    const loaded = loadWallet();
    console.log('✅ Loaded from localStorage:', loaded?.address === address ? 'MATCH' : 'NO MATCH');
    
    deleteWallet();
    console.log('✅ Deleted from localStorage');
    
    const afterDelete = loadWallet();
    console.log('✅ After delete:', afterDelete === null ? 'NULL (correct)' : 'ERROR\n');

    // Test 5: Wrong decryption key
    console.log('Test 5: Wrong decryption key (should fail)');
    const wrongKey = crypto.getRandomValues(new Uint8Array(32));
    try {
      await decryptKey(encrypted, wrongKey);
      console.log('❌ Should have thrown error!\n');
    } catch (error) {
      console.log('✅ Correctly rejected wrong key:', (error as Error).message, '\n');
    }

    console.log('✅ All tests passed!');
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Export for use in browser console or test page
if (typeof window !== 'undefined') {
  (window as any).runKeystoreTests = runKeystoreTests;
}
