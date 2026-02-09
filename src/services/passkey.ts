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
  token?: string;
}

export interface TokenVerifyResponse {
  valid: boolean;
  credentialId?: string;
  userId?: string;
  expiresAt?: number;
}

export interface TokenRefreshResponse {
  success: boolean;
  token?: string;
  error?: string;
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

// Token management functions
const AUTH_TOKEN_KEY = 'auth_token';

/**
 * Get stored auth token
 */
export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Store auth token
 */
export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

/**
 * Remove auth token
 */
export function removeAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

/**
 * Verify token with backend
 */
export async function verifyToken(token?: string): Promise<TokenVerifyResponse> {
  const authToken = token || getAuthToken();
  console.log('[verifyToken] Token to verify:', authToken ? 'Present' : 'Missing');
  if (!authToken) {
    console.log('[verifyToken] No auth token available');
    return { valid: false };
  }

  try {
    console.log('[verifyToken] Calling API:', `${API_BASE_URL}/passkey/verify-token`);
    const response = await fetch(`${API_BASE_URL}/passkey/verify-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('[verifyToken] Response status:', response.status);
    if (!response.ok) {
      console.log('[verifyToken] Response not OK');
      return { valid: false };
    }

    const result = await response.json();
    console.log('[verifyToken] API response:', result);
    return result;
  } catch (error) {
    console.error('[verifyToken] Token verification failed:', error);
    return { valid: false };
  }
}

/**
 * Refresh token with backend
 */
export async function refreshToken(token?: string): Promise<string | null> {
  const authToken = token || getAuthToken();
  if (!authToken) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/passkey/refresh-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const result: TokenRefreshResponse = await response.json();
    if (result.success && result.token) {
      setAuthToken(result.token);
      return result.token;
    }

    return null;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
}

/**
 * Logout and revoke token
 */
export async function logout(): Promise<boolean> {
  const authToken = getAuthToken();
  if (!authToken) {
    return true;
  }

  try {
    await fetch(`${API_BASE_URL}/passkey/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Logout failed:', error);
  } finally {
    removeAuthToken();
  }

  return true;
}

/**
 * Check if user has a valid session
 */
export async function hasValidSession(): Promise<boolean> {
  const token = getAuthToken();
  console.log('[hasValidSession] Auth token:', token ? 'Found' : 'Not found');
  if (!token) {
    console.log('[hasValidSession] No token in localStorage');
    return false;
  }

  const result = await verifyToken(token);
  console.log('[hasValidSession] Verify result:', result);
  return result.valid;
}

/**
 * Auto-refresh token if it's close to expiring (within 5 minutes)
 */
export async function autoRefreshToken(): Promise<void> {
  const token = getAuthToken();
  if (!token) {
    return;
  }

  const result = await verifyToken(token);
  if (!result.valid || !result.expiresAt) {
    return;
  }

  const now = Date.now();
  const timeLeft = result.expiresAt - now;
  const fiveMinutes = 5 * 60 * 1000;

  if (timeLeft < fiveMinutes && timeLeft > 0) {
    await refreshToken(token);
  }
}
