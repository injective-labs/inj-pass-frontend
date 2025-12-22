/**
 * Create wallet using Passkey
 * Integrates WebAuthn API with wallet key derivation
 */

import { deriveSecp256k1 } from './deriveSecp256k1';
import { encryptKey } from '../keystore/encryptKey';
import { saveWallet } from '../keystore/storage';
import { LocalKeystore } from '@/types/wallet';
import {
  requestChallenge,
  verifyPasskey,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from '@/services/passkey';
import { sha256 } from '@noble/hashes/sha2.js';

export interface CreateByPasskeyResult {
  address: string;
  credentialId: string;
}

/**
 * Create a new wallet using Passkey
 * 
 * Flow:
 * 1. Request challenge from backend
 * 2. Create WebAuthn credential
 * 3. Verify with backend
 * 4. Generate wallet private key from random entropy
 * 5. Derive encryption key from Passkey credential
 * 6. Encrypt and save wallet
 */
export async function createByPasskey(
  username: string = 'user@injective-pass'
): Promise<CreateByPasskeyResult> {
  try {
    // 1. Request challenge
    const { challenge, rpId, rpName } = await requestChallenge('register');

    // 2. Create WebAuthn credential with deterministic userId
    // Use SHA256 of username as userId to ensure same user → same credential
    const userIdHash = sha256(new TextEncoder().encode(username));
    const userId = new Uint8Array(userIdHash.buffer.slice(0)) as BufferSource;
    
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: base64ToArrayBuffer(challenge),
        rp: { id: rpId, name: rpName },
        user: {
          id: userId,
          name: username,
          displayName: username,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        timeout: 60000,
        attestation: 'none',
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          requireResidentKey: true, // Store credential on device
          userVerification: 'required',
        },
      },
    }) as PublicKeyCredential | null;

    if (!credential || !credential.response) {
      throw new Error('Passkey creation cancelled or failed');
    }

    const response = credential.response as AuthenticatorAttestationResponse;

    // 3. Verify with backend
    const verifyResult = await verifyPasskey(challenge, {
      id: credential.id,
      rawId: arrayBufferToBase64(credential.rawId),
      response: {
        clientDataJSON: arrayBufferToBase64(response.clientDataJSON),
        attestationObject: arrayBufferToBase64(response.attestationObject),
      },
      type: credential.type,
    });

    if (!verifyResult.success || !verifyResult.credentialId) {
      throw new Error('Passkey verification failed');
    }

    // 4. Derive deterministic wallet private key from credential ID
    // Same Passkey → Same credentialId → Same private key → Same address
    const credentialIdBytes = new TextEncoder().encode(verifyResult.credentialId);
    const walletEntropy = sha256(credentialIdBytes);
    const { privateKey, address } = deriveSecp256k1(walletEntropy);

    // 5. Derive encryption key from credential ID (same as wallet entropy for simplicity)
    const encryptionEntropy = walletEntropy;

    // 6. Encrypt and save
    const encryptedPrivateKey = await encryptKey(privateKey, encryptionEntropy);

    const keystore: LocalKeystore = {
      address,
      encryptedPrivateKey,
      source: 'passkey',
      credentialId: verifyResult.credentialId,
      createdAt: Date.now(),
    };

    saveWallet(keystore);

    return {
      address,
      credentialId: verifyResult.credentialId,
    };
  } catch (error) {
    throw new Error(
      `Failed to create wallet with Passkey: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Unlock wallet using Passkey
 * 
 * Flow:
 * 1. Load keystore from storage
 * 2. Request challenge from backend
 * 3. Get WebAuthn assertion
 * 4. Verify with backend
 * 5. Derive decryption key from credential ID
 * 6. Decrypt and return private key
 */
export async function unlockByPasskey(credentialId: string): Promise<Uint8Array> {
  try {
    // 1. Request challenge
    const { challenge } = await requestChallenge('authenticate');

    // 2. Get WebAuthn assertion
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: base64ToArrayBuffer(challenge),
        allowCredentials: [
          {
            id: base64ToArrayBuffer(credentialId),
            type: 'public-key',
          },
        ],
        timeout: 60000,
        userVerification: 'required',
      },
    }) as PublicKeyCredential | null;

    if (!assertion || !assertion.response) {
      throw new Error('Passkey authentication cancelled or failed');
    }

    const response = assertion.response as AuthenticatorAssertionResponse;

    // 3. Verify with backend
    const verifyResult = await verifyPasskey(challenge, {
      id: assertion.id,
      rawId: arrayBufferToBase64(assertion.rawId),
      response: {
        clientDataJSON: arrayBufferToBase64(response.clientDataJSON),
        authenticatorData: arrayBufferToBase64(response.authenticatorData),
        signature: arrayBufferToBase64(response.signature),
        userHandle: response.userHandle ? arrayBufferToBase64(response.userHandle) : undefined,
      },
      type: assertion.type,
    });

    if (!verifyResult.success || !verifyResult.verified) {
      throw new Error('Passkey verification failed');
    }

    // 4. Derive decryption key
    const credentialIdBytes = new TextEncoder().encode(credentialId);
    const decryptionEntropy = sha256(credentialIdBytes);

    return decryptionEntropy;
  } catch (error) {
    throw new Error(
      `Failed to unlock wallet with Passkey: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
