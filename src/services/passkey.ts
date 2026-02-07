export interface PasskeyChallenge {
  challenge: string;
  expiresAt: number;
  rpId: string;
  rpName: string;
}

export interface PasskeyVerifyResponse {
  success: boolean;
  credentialId?: string;
  publicKey?: string;
  verified?: boolean;
  sessionToken?: string; // Added for session management
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_BASE_URL) {
  throw new Error('NEXT_PUBLIC_API_URL environment variable is required');
}

/**
 * Request a Passkey challenge from backend
 */
export async function requestChallenge(
  action: 'register' | 'authenticate',
  userId?: string
): Promise<PasskeyChallenge> {
  const response = await fetch(`${API_BASE_URL}/passkey/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, userId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || 'Failed to request challenge');
  }

  return response.json();
}

/**
 * Verify Passkey attestation/assertion with backend
 */
export async function verifyPasskey(
  challenge: string,
  credential: any
): Promise<PasskeyVerifyResponse> {
  const response = await fetch(`${API_BASE_URL}/passkey/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challenge,
      attestation: credential,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || 'Verification failed');
  }

  return response.json();
}

// Utility functions for ArrayBuffer <-> Base64 conversion
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Handle URL-safe base64
  let b64 = base64.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding
  while (b64.length % 4) {
    b64 += '=';
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
