import { getAuthToken } from './passkey';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_BASE_URL) {
  throw new Error('NEXT_PUBLIC_API_URL environment variable is required');
}

export interface InviteCodeResponse {
  inviteCode: string | null;
}

export interface InviterInfo {
  inviteCode: string;
  ninjaBalance: number;
}

export interface ValidateResponse {
  valid: boolean;
  inviterInfo?: InviterInfo;
}

export interface ReferralStats {
  inviteCode: string;
  inviteeCount: number;
  totalRewards: number;
  invitedBy: string | null;
}

/**
 * Get auth header with Bearer token
 */
function getAuthHeader(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

/**
 * Get user's invite code
 */
export async function getInviteCode(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/referral/code`, {
      method: 'GET',
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      return null;
    }

    const data: InviteCodeResponse = await response.json();
    return data.inviteCode;
  } catch (error) {
    console.error('[Referral] Get invite code failed:', error);
    return null;
  }
}

/**
 * Validate an invite code (check if it exists)
 */
export async function validateInviteCode(inviteCode: string): Promise<ValidateResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/referral/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode }),
    });

    if (!response.ok) {
      return { valid: false };
    }

    return response.json();
  } catch (error) {
    console.error('[Referral] Validate invite code failed:', error);
    return { valid: false };
  }
}

/**
 * Get referral stats (invitee count, total rewards, etc.)
 */
export async function getStats(): Promise<ReferralStats> {
  try {
    const response = await fetch(`${API_BASE_URL}/referral/stats`, {
      method: 'GET',
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      return {
        inviteCode: '',
        inviteeCount: 0,
        totalRewards: 0,
        invitedBy: null,
      };
    }

    return response.json();
  } catch (error) {
    console.error('[Referral] Get stats failed:', error);
    return {
      inviteCode: '',
      inviteeCount: 0,
      totalRewards: 0,
      invitedBy: null,
    };
  }
}
