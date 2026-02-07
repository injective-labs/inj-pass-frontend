/**
 * Session Token Management Service
 * Handles session token storage, validation, and auto-authentication
 */

export interface SessionToken {
  token: string;
  expiresAt: number; // Unix timestamp in milliseconds
  address: string;
}

const SESSION_STORAGE_KEY = 'wallet_session_token';
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Save session token to localStorage
 */
export function saveSessionToken(token: string, address: string): void {
  const expiresAt = Date.now() + SESSION_DURATION;
  const sessionData: SessionToken = {
    token,
    expiresAt,
    address,
  };
  
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
}

/**
 * Get session token from localStorage
 * Returns null if token doesn't exist or is expired
 */
export function getSessionToken(): SessionToken | null {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const sessionData: SessionToken = JSON.parse(stored);
    
    // Check if token is expired
    if (Date.now() >= sessionData.expiresAt) {
      clearSessionToken();
      return null;
    }

    return sessionData;
  } catch (error) {
    console.error('Failed to parse session token:', error);
    clearSessionToken();
    return null;
  }
}

/**
 * Clear session token from localStorage
 */
export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

/**
 * Check if a valid session token exists
 */
export function hasValidSession(): boolean {
  return getSessionToken() !== null;
}

/**
 * Validate session token with backend
 * Returns true if session is valid, false otherwise
 */
export async function validateSessionToken(token: string): Promise<boolean> {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
  
  if (!API_BASE_URL) {
    console.error('NEXT_PUBLIC_API_URL environment variable is required');
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/session/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.valid === true;
  } catch (error) {
    console.error('Failed to validate session token:', error);
    return false;
  }
}

/**
 * Get wallet data from session token
 * Returns the decrypted private key if session is valid
 */
export async function unlockWithSessionToken(): Promise<{
  privateKey: Uint8Array;
  address: string;
} | null> {
  const sessionData = getSessionToken();
  
  if (!sessionData) {
    return null;
  }

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
  
  if (!API_BASE_URL) {
    console.error('NEXT_PUBLIC_API_URL environment variable is required');
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/session/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionData.token}`,
      },
    });

    if (!response.ok) {
      clearSessionToken();
      return null;
    }

    const data = await response.json();
    
    if (!data.privateKey) {
      clearSessionToken();
      return null;
    }

    // Convert hex string to Uint8Array
    const privateKeyHex = data.privateKey.startsWith('0x') 
      ? data.privateKey.slice(2) 
      : data.privateKey;
    const privateKey = new Uint8Array(
      privateKeyHex.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []
    );

    return {
      privateKey,
      address: data.address || sessionData.address,
    };
  } catch (error) {
    console.error('Failed to unlock with session token:', error);
    clearSessionToken();
    return null;
  }
}
