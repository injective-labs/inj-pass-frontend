import { getAuthToken } from './passkey';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_BASE_URL) {
  throw new Error('NEXT_PUBLIC_API_URL environment variable is required');
}

export interface PointsTransaction {
  id: number;
  type: string;
  amount: number;
  balanceAfter: number;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface SyncResponse {
  success: boolean;
  balance?: number;
  transactionId?: number;
  error?: string;
}

export interface BalanceResponse {
  balance: number;
}

export interface NinjaMinerState {
  ninjaBalance: number;
  cooldownEndsAt: number;
  sessionStartedAt: number;
  sessionEndsAt: number;
  sessionEarned: number;
}

export interface TransactionsResponse {
  transactions: PointsTransaction[];
  total: number;
  page: number;
  limit: number;
}

interface NinjaMinerStateResponse {
  state: NinjaMinerState | null;
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
 * Sync NIJIA from tap game to backend
 */
export async function syncPoints(earnedNinjia: number): Promise<SyncResponse> {
  const safeEarnedNinjia = Number(earnedNinjia);
  if (!Number.isFinite(safeEarnedNinjia) || safeEarnedNinjia <= 0) {
    return { success: false, error: 'Invalid earnedNinjia' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/points/sync`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ earnedNinjia: safeEarnedNinjia }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Sync failed' }));
      return { success: false, error: error.message || 'Sync failed' };
    }

    return response.json();
  } catch (error) {
    console.error('[Points] Sync failed:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Get NIJIA balance from backend
 */
export async function getBalance(): Promise<number> {
  try {
    const response = await fetch(`${API_BASE_URL}/points/balance`, {
      method: 'GET',
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      return 0;
    }

    const data: BalanceResponse = await response.json();
    const safeBalance = Number((data as { balance?: unknown })?.balance);
    return Number.isFinite(safeBalance) ? safeBalance : 0;
  } catch (error) {
    console.error('[Points] Get balance failed:', error);
    return 0;
  }
}

/**
 * Get transaction history from backend
 */
export async function getTransactions(
  page: number = 1,
  limit: number = 20
): Promise<TransactionsResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/points/transactions?page=${page}&limit=${limit}`,
      {
        method: 'GET',
        headers: getAuthHeader(),
      }
    );

    if (!response.ok) {
      return { transactions: [], total: 0, page: 1, limit };
    }

    return response.json();
  } catch (error) {
    console.error('[Points] Get transactions failed:', error);
    return { transactions: [], total: 0, page: 1, limit };
  }
}

/**
 * Read Ninja Miner state from backend Redis storage
 */
export async function getNinjaMinerState(walletAddress?: string): Promise<NinjaMinerState | null> {
  try {
    const query = walletAddress
      ? `?walletAddress=${encodeURIComponent(walletAddress)}`
      : '';

    const response = await fetch(`${API_BASE_URL}/points/ninja-miner-state${query}`, {
      method: 'GET',
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as NinjaMinerStateResponse;
    const state = data?.state;

    if (!state) {
      return null;
    }

    return {
      ninjaBalance: Number.isFinite(Number(state.ninjaBalance)) ? Number(state.ninjaBalance) : 0,
      cooldownEndsAt: Number.isFinite(Number(state.cooldownEndsAt)) ? Number(state.cooldownEndsAt) : 0,
      sessionStartedAt: Number.isFinite(Number(state.sessionStartedAt)) ? Number(state.sessionStartedAt) : 0,
      sessionEndsAt: Number.isFinite(Number(state.sessionEndsAt)) ? Number(state.sessionEndsAt) : 0,
      sessionEarned: Number.isFinite(Number(state.sessionEarned)) ? Number(state.sessionEarned) : 0,
    };
  } catch (error) {
    console.error('[Points] Get Ninja Miner state failed:', error);
    return null;
  }
}

/**
 * Persist Ninja Miner state to backend Redis storage
 */
export async function saveNinjaMinerState(
  walletAddress: string,
  state: NinjaMinerState,
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/points/ninja-miner-state`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ walletAddress, state }),
    });

    return response.ok;
  } catch (error) {
    console.error('[Points] Save Ninja Miner state failed:', error);
    return false;
  }
}
