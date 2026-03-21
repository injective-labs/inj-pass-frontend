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

export interface TransactionsResponse {
  transactions: PointsTransaction[];
  total: number;
  page: number;
  limit: number;
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
  try {
    const response = await fetch(`${API_BASE_URL}/points/sync`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ earnedNinjia }),
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
    return data.balance;
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
